/**
 * Content Generator — Santé des files & pipeline (F5).
 *
 * Module serveur lu par la page admin « Batches & workers » (panneau Santé).
 * Expose `getContentGenQueueHealth()` qui agrège :
 *
 *  1. Profondeur des files BullMQ content-gen (waiting/active/delayed/failed)
 *     lue DIRECTEMENT en Redis via les clés natives BullMQ — même mécanisme
 *     que `content-monitoring-worker.ts` (`bull:<queue>:wait` via ioredis),
 *     étendu aux états active/delayed/failed.
 *  2. État du kill-switch global (`ContentGenConfig.kill_switch.active`) via
 *     `readContentGenConfig` (helper partagé, non-guardé requireAdmin car la
 *     page parente est déjà protégée par le middleware admin + auth()).
 *  3. Dernier ContentGenJob par contentType (createdAt + status) via un
 *     groupBy Prisma efficace (1 requête) + un fetch ciblé des lignes max.
 *
 * Fail-soft TOTAL : Redis indispo / DB indispo / build stub `stub.invalid`
 * → valeurs neutres (0 / null / []) sans throw. Aucune connexion réelle n'est
 * tentée si DATABASE_URL/REDIS_URL pointent vers `stub.invalid` (contrat SSG).
 *
 * NB : ce n'est PAS une Server Action mutante — pas de `"use server"`. C'est un
 * module serveur lu par un Server Component (lecture only, fail-soft).
 */

import { prisma } from "@/lib/prisma";
import { readContentGenConfig } from "./_settings";

/**
 * Files content-gen monitorées. Aligné sur `MONITORED_QUEUES` du
 * content-monitoring-worker (qui n'exporte pas la constante). On garde
 * content-gen / content-publish / content-orchestrator au minimum.
 */
export const CONTENT_GEN_QUEUES: ReadonlyArray<string> = [
  "content-gen",
  "content-publish",
  "content-orchestrator",
];

export interface QueueDepth {
  readonly name: string;
  readonly waiting: number;
  readonly active: number;
  readonly delayed: number;
  readonly failed: number;
}

export interface LastJobByType {
  readonly contentType: string;
  readonly createdAt: string; // ISO
  readonly status: string;
}

export interface ContentGenQueueHealth {
  readonly queues: ReadonlyArray<QueueDepth>;
  readonly killSwitch: { readonly active: boolean };
  readonly lastJobByType: ReadonlyArray<LastJobByType>;
  /** True si Redis n'a pas pu être interrogé (build stub / indispo). */
  readonly redisUnavailable: boolean;
  /** True si la DB n'a pas pu être interrogée (build stub / indispo). */
  readonly dbUnavailable: boolean;
}

function isStub(url: string | undefined): boolean {
  return Boolean(url?.includes("stub.invalid"));
}

/** Profondeurs neutres (toutes à 0) pour une liste de files. */
function neutralQueues(): ReadonlyArray<QueueDepth> {
  return CONTENT_GEN_QUEUES.map((name) => ({
    name,
    waiting: 0,
    active: 0,
    delayed: 0,
    failed: 0,
  }));
}

/**
 * Lit les profondeurs BullMQ en Redis via les clés natives :
 *  - `bull:<queue>:wait`    → liste (llen)   = waiting
 *  - `bull:<queue>:active`  → liste (llen)   = active
 *  - `bull:<queue>:delayed` → sorted set (zcard) = delayed
 *  - `bull:<queue>:failed`  → sorted set (zcard) = failed
 *
 * Connexion ioredis ad-hoc (comme le worker) avec maxRetriesPerRequest:1 pour
 * fail-fast. Fail-soft : toute erreur → profondeurs neutres + redisUnavailable.
 */
async function readQueueDepths(): Promise<{
  queues: ReadonlyArray<QueueDepth>;
  redisUnavailable: boolean;
}> {
  const url = process.env.REDIS_URL;
  if (!url || isStub(url)) {
    return { queues: neutralQueues(), redisUnavailable: true };
  }

  let redis: InstanceType<typeof import("ioredis").default> | null = null;
  try {
    const Redis = (await import("ioredis")).default;
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: false,
      connectTimeout: 2000,
    });

    const depths = await Promise.all(
      CONTENT_GEN_QUEUES.map(async (name): Promise<QueueDepth> => {
        try {
          const [waiting, active, delayed, failed] = await Promise.all([
            redis!.llen(`bull:${name}:wait`),
            redis!.llen(`bull:${name}:active`),
            redis!.zcard(`bull:${name}:delayed`),
            redis!.zcard(`bull:${name}:failed`),
          ]);
          return {
            name,
            waiting: waiting ?? 0,
            active: active ?? 0,
            delayed: delayed ?? 0,
            failed: failed ?? 0,
          };
        } catch {
          return { name, waiting: 0, active: 0, delayed: 0, failed: 0 };
        }
      }),
    );
    return { queues: depths, redisUnavailable: false };
  } catch {
    return { queues: neutralQueues(), redisUnavailable: true };
  } finally {
    try {
      redis?.disconnect();
    } catch {
      // no-op
    }
  }
}

/**
 * Dernier ContentGenJob par contentType. Stratégie efficace : un groupBy sur
 * `contentType` avec `_max.createdAt` (1 requête) donne, pour chaque type, la
 * date du dernier job. On récupère ensuite le `status` de chacune de ces lignes
 * via un findMany ciblé (filtré sur les couples type/createdAt obtenus).
 */
async function readLastJobByType(): Promise<{
  lastJobByType: ReadonlyArray<LastJobByType>;
  dbUnavailable: boolean;
}> {
  if (isStub(process.env.DATABASE_URL)) {
    return { lastJobByType: [], dbUnavailable: true };
  }

  try {
    const grouped = await prisma.contentGenJob.groupBy({
      by: ["contentType"],
      _max: { createdAt: true },
    });
    if (grouped.length === 0) {
      return { lastJobByType: [], dbUnavailable: false };
    }

    // Récupère le status du dernier job de chaque type. On lit en une requête
    // les lignes dont (contentType, createdAt) correspond à un max trouvé.
    const orConditions: Array<{
      contentType: (typeof grouped)[number]["contentType"];
      createdAt: Date;
    }> = [];
    for (const g of grouped) {
      const max = g._max.createdAt;
      if (max !== null) {
        orConditions.push({ contentType: g.contentType, createdAt: max });
      }
    }

    if (orConditions.length === 0) {
      return { lastJobByType: [], dbUnavailable: false };
    }

    const rows = await prisma.contentGenJob.findMany({
      where: { OR: orConditions },
      select: { contentType: true, createdAt: true, status: true },
    });

    // Dédup : garder un seul status par (contentType) — le plus récent.
    const byType = new Map<string, LastJobByType>();
    for (const r of rows) {
      const existing = byType.get(r.contentType);
      if (!existing || new Date(r.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        byType.set(r.contentType, {
          contentType: r.contentType,
          createdAt: r.createdAt.toISOString(),
          status: r.status,
        });
      }
    }

    const lastJobByType = [...byType.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return { lastJobByType, dbUnavailable: false };
  } catch {
    return { lastJobByType: [], dbUnavailable: true };
  }
}

async function readKillSwitch(): Promise<{ active: boolean }> {
  if (isStub(process.env.DATABASE_URL)) return { active: false };
  try {
    const cfg = await readContentGenConfig<{ active?: boolean }>("kill_switch", { active: false });
    return { active: cfg?.active === true };
  } catch {
    return { active: false };
  }
}

/**
 * Agrège la santé des files content-gen pour le panneau admin. Fail-soft :
 * jamais de throw — chaque sous-lecture retourne ses propres neutres.
 */
export async function getContentGenQueueHealth(): Promise<ContentGenQueueHealth> {
  const [depths, last, killSwitch] = await Promise.all([
    readQueueDepths(),
    readLastJobByType(),
    readKillSwitch(),
  ]);

  return {
    queues: depths.queues,
    killSwitch,
    lastJobByType: last.lastJobByType,
    redisUnavailable: depths.redisUnavailable,
    dbUnavailable: last.dbUnavailable,
  };
}

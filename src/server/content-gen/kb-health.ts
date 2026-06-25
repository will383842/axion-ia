/**
 * Content Generator — KB health hard gate (§ 11.2 master prompt v2.5).
 *
 * Sprint 1 Day 4 AGT-E. Vérifie que la KB V4 est suffisamment peuplée
 * avant tout appel LLM. Hard gate :
 * - ≥ 50 entries publiées (KnowledgeEntry status='published', deletedAt=null)
 * - ≥ 60 % audience='public' (canonical ratio)
 * - lastPublishedAt < 90 jours
 *
 * Mode dégradé : `KB_BYPASS=true` env → bypass gate + banner rouge admin.
 */

import { prisma } from "@/lib/prisma";

export interface KbHealthSnapshot {
  readonly publishedTotal: number;
  readonly publicPublished: number;
  readonly canonicalRatio: number;
  readonly lastPublishedAt: Date | null;
  readonly healthy: boolean;
  readonly bypassMode: boolean;
  readonly reason?: string;
}

const HARD_GATE_MIN_PUBLISHED = 50;
const HARD_GATE_MIN_CANONICAL_RATIO = 0.6;
const HARD_GATE_MAX_DAYS_SINCE_LAST = 90;

export class KbNotReadyError extends Error {
  constructor(public readonly snapshot: KbHealthSnapshot) {
    super(
      `KB_NOT_READY: ${snapshot.publishedTotal} published, canonical ratio ${(snapshot.canonicalRatio * 100).toFixed(0)}%, last ingest ${snapshot.lastPublishedAt?.toISOString() ?? "never"}`,
    );
    this.name = "KbNotReadyError";
  }
}

function isBypassActive(): boolean {
  const raw = process.env.KB_BYPASS;
  return raw === "true" || raw === "1";
}

/**
 * Snapshot santé KB. Si DB pas accessible (P2021 / PrismaInit), retourne
 * un snapshot vide marqué `bypassMode=true` (V0 transitoire dev/tests).
 */
export async function getKbHealth(): Promise<KbHealthSnapshot> {
  const bypassMode = isBypassActive();
  try {
    const [publishedTotal, publicPublished, lastIngest] = await Promise.all([
      prisma.knowledgeEntry.count({ where: { status: "published", deletedAt: null } }),
      prisma.knowledgeEntry.count({
        where: { status: "published", audience: "public", deletedAt: null },
      }),
      prisma.knowledgeEntry.findFirst({
        where: { status: "published", deletedAt: null },
        orderBy: { publishedAt: "desc" },
        select: { publishedAt: true },
      }),
    ]);

    const canonicalRatio = publishedTotal > 0 ? publicPublished / publishedTotal : 0;
    const lastPublishedAt = lastIngest?.publishedAt ?? null;
    const daysSinceLast = lastPublishedAt
      ? (Date.now() - lastPublishedAt.getTime()) / 86_400_000
      : Number.POSITIVE_INFINITY;

    const healthy =
      bypassMode ||
      (publishedTotal >= HARD_GATE_MIN_PUBLISHED &&
        canonicalRatio >= HARD_GATE_MIN_CANONICAL_RATIO &&
        daysSinceLast < HARD_GATE_MAX_DAYS_SINCE_LAST);

    let reason: string | undefined;
    if (!healthy) {
      const reasons: string[] = [];
      if (publishedTotal < HARD_GATE_MIN_PUBLISHED) {
        reasons.push(`${publishedTotal} entries publiées < ${HARD_GATE_MIN_PUBLISHED}`);
      }
      if (canonicalRatio < HARD_GATE_MIN_CANONICAL_RATIO) {
        reasons.push(
          `canonical ratio ${(canonicalRatio * 100).toFixed(0)}% < ${HARD_GATE_MIN_CANONICAL_RATIO * 100}%`,
        );
      }
      if (daysSinceLast >= HARD_GATE_MAX_DAYS_SINCE_LAST) {
        reasons.push(`lastPublishedAt > ${HARD_GATE_MAX_DAYS_SINCE_LAST}j`);
      }
      reason = reasons.join(" + ");
    }

    return {
      publishedTotal,
      publicPublished,
      canonicalRatio,
      lastPublishedAt,
      healthy,
      bypassMode,
      ...(reason ? { reason } : {}),
    };
  } catch (err) {
    if (
      err instanceof Error &&
      (("code" in err && (err as { code: string }).code === "P2021") ||
        err.constructor.name === "PrismaClientInitializationError")
    ) {
      // DB pas accessible (test sans DB / table pas migrée) → mode dégradé.
      // ⚠️ Observabilité (audit 2026-06-25) : ce bypass laissait passer le
      // content-gen SANS KB → RAG vide → risque d'hallucinations SILENCIEUSES.
      // On log désormais explicitement pour qu'un incident DB worker soit visible
      // (au build stub.invalid, prisma renvoie 0 sans throw → ce chemin ne s'active pas).
      console.warn(
        "[kb-health] ⚠️ DB inaccessible (P2021/PrismaInit) → bypass dégradé : " +
          "content-gen tourne SANS garde KB (RAG potentiellement vide). " +
          "Vérifier la connexion DB / migrations du worker.",
      );
      return {
        publishedTotal: 0,
        publicPublished: 0,
        canonicalRatio: 0,
        lastPublishedAt: null,
        healthy: true, // accept en mode dégradé
        bypassMode: true,
        reason: "DB not accessible (P2021/PrismaInit) — bypass V0",
      };
    }
    throw err;
  }
}

/**
 * Hard gate à appeler en début d'orchestrator avant tout job content-gen.
 * Throw `KbNotReadyError` si KB pas prête ET pas en bypass mode.
 */
export async function assertKbReady(): Promise<KbHealthSnapshot> {
  const snapshot = await getKbHealth();
  if (!snapshot.healthy) {
    throw new KbNotReadyError(snapshot);
  }
  return snapshot;
}

/**
 * Content Generator — RSS sources Prisma-backed CRUD (Sprint v7 Phase 6).
 *
 * Migration progressive du stockage ContentGenConfig JSON (cf. `rss.ts` legacy
 * V1) vers le modèle Prisma `RssSource` dédié (champs typés + index pgsql +
 * relation future avec `RssItem` + dédup côté DB).
 *
 * Stratégie de coexistence :
 *   - `rss.ts` reste le backend actif pour l'UI admin V1 (ContentGenConfig JSON)
 *   - `rss-sources.ts` (ce fichier) expose la même API conceptuelle mais branchée
 *     sur Prisma. Consommable par les workers BullMQ + nouvelles features.
 *   - Backfill JSON → DB via `backfill-rss-sources-from-config.ts` (script
 *     manuel à lancer par Will une seule fois en prod après deploy).
 *   - UI migration `RssListV2` → `rss-sources.ts` reportée Session 7+ (pour
 *     éviter de toucher le rendu admin et risquer une régression visuelle).
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAdminWriteRateLimited } from "./_auth";

// ─── Schemas ──────────────────────────────────────────────────────────────

const VERTICALE_VALUES = ["interventions", "audit", "implementations", "un_a_un"] as const;

const RssSourceInputSchema = z
  .object({
    url: z.string().url().max(500),
    name: z.string().min(2).max(200),
    enabled: z.boolean().default(true),
    verticale: z.enum(VERTICALE_VALUES).nullable().optional(),
    tags: z.array(z.string().min(1).max(80)).max(100).default([]),
    pollIntervalMin: z.number().int().min(5).max(1440).default(60),
    autoPublish: z.boolean().default(false),
    language: z.string().min(2).max(5).default("fr"),
  })
  .strict();

export type RssSourceInput = z.infer<typeof RssSourceInputSchema>;

export interface RssSourceRow {
  readonly id: string;
  readonly url: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly verticale: string | null;
  readonly tags: ReadonlyArray<string>;
  readonly pollIntervalMin: number;
  readonly autoPublish: boolean;
  readonly language: string;
  readonly lastFetchedAt: Date | null;
  readonly lastSuccessAt: Date | null;
  readonly failureCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function rowFromPrisma(row: {
  id: string;
  url: string;
  name: string;
  enabled: boolean;
  verticale: string | null;
  tags: unknown;
  pollIntervalMin: number;
  autoPublish: boolean;
  language: string;
  lastFetchedAt: Date | null;
  lastSuccessAt: Date | null;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}): RssSourceRow {
  const parsedTags = Array.isArray(row.tags) ? (row.tags as ReadonlyArray<string>) : [];
  return { ...row, tags: parsedTags };
}

// ─── Reads (no auth, read-only) ────────────────────────────────────────────

/**
 * Liste toutes les sources RSS depuis Prisma `rss_sources`. Vide si non
 * backfillées depuis le ContentGenConfig JSON legacy (cf. backfill script).
 */
export async function listRssSourcesFromDb(): Promise<ReadonlyArray<RssSourceRow>> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return [];
  const rows = await prisma.rssSource.findMany({
    orderBy: [{ enabled: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(rowFromPrisma);
}

export async function getRssSourceByIdFromDb(id: string): Promise<RssSourceRow | null> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return null;
  const row = await prisma.rssSource.findUnique({ where: { id } });
  return row ? rowFromPrisma(row) : null;
}

// ─── Writes (admin + rate-limited) ─────────────────────────────────────────

/**
 * Ajoute une source RSS. URL unique (conflit → throw `url_already_added`).
 */
export async function addRssSourceToDb(input: RssSourceInput): Promise<RssSourceRow> {
  const session = await requireAdminWriteRateLimited("addRssSourceToDb", { limit: 30 });
  const parsed = RssSourceInputSchema.parse(input);

  try {
    const existing = await prisma.rssSource.findUnique({ where: { url: parsed.url } });
    if (existing) throw new Error("url_already_added");

    const row = await prisma.rssSource.create({
      data: {
        url: parsed.url,
        name: parsed.name,
        enabled: parsed.enabled,
        verticale: parsed.verticale ?? null,
        tags: parsed.tags,
        pollIntervalMin: parsed.pollIntervalMin,
        autoPublish: parsed.autoPublish,
        language: parsed.language,
      },
    });
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/rss`);
    return rowFromPrisma(row);
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "content-gen", action: "addRssSourceToDb" },
      extra: { adminUserId: session.userId, url: parsed.url },
    });
    throw e;
  }
}

export async function updateRssSourceInDb(
  id: string,
  input: RssSourceInput,
): Promise<RssSourceRow> {
  const session = await requireAdminWriteRateLimited(`updateRssSourceInDb:${id}`, { limit: 30 });
  const parsed = RssSourceInputSchema.parse(input);

  try {
    const existing = await prisma.rssSource.findUnique({ where: { id } });
    if (!existing) throw new Error("source_not_found");
    // Conflit URL si on rename vers une URL déjà occupée par une autre row.
    if (parsed.url !== existing.url) {
      const conflict = await prisma.rssSource.findUnique({ where: { url: parsed.url } });
      if (conflict && conflict.id !== id) throw new Error("url_already_added");
    }
    const row = await prisma.rssSource.update({
      where: { id },
      data: {
        url: parsed.url,
        name: parsed.name,
        enabled: parsed.enabled,
        verticale: parsed.verticale ?? null,
        tags: parsed.tags,
        pollIntervalMin: parsed.pollIntervalMin,
        autoPublish: parsed.autoPublish,
        language: parsed.language,
      },
    });
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/rss`);
    return rowFromPrisma(row);
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "content-gen", action: "updateRssSourceInDb" },
      extra: { adminUserId: session.userId, id, url: parsed.url },
    });
    throw e;
  }
}

export async function removeRssSourceFromDb(id: string): Promise<void> {
  const session = await requireAdminWriteRateLimited(`removeRssSourceFromDb:${id}`, { limit: 30 });

  try {
    const existing = await prisma.rssSource.findUnique({ where: { id } });
    if (!existing) throw new Error("source_not_found");
    await prisma.rssSource.delete({ where: { id } });
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/rss`);
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "content-gen", action: "removeRssSourceFromDb" },
      extra: { adminUserId: session.userId, id },
    });
    throw e;
  }
}

export async function toggleRssSourceInDb(id: string, enabled: boolean): Promise<RssSourceRow> {
  const session = await requireAdminWriteRateLimited(`toggleRssSourceInDb:${id}`, { limit: 60 });
  z.boolean().parse(enabled);

  try {
    const existing = await prisma.rssSource.findUnique({ where: { id } });
    if (!existing) throw new Error("source_not_found");
    const row = await prisma.rssSource.update({
      where: { id },
      data: { enabled },
    });
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/rss`);
    return rowFromPrisma(row);
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "content-gen", action: "toggleRssSourceInDb" },
      extra: { adminUserId: session.userId, id, enabled },
    });
    throw e;
  }
}

// ─── Backfill from ContentGenConfig JSON legacy ───────────────────────────

/**
 * Backfill helper : copie les sources RSS du ContentGenConfig JSON (V1) vers
 * la table Prisma `rss_sources`. Idempotent : upsert par URL, ne réécrase pas
 * les rows existantes (description, lastFetchedAt etc. préservés).
 *
 * À lancer manuellement par un admin via `pnpm tsx src/scripts/backfill-rss-sources.ts`
 * une fois en prod après déploiement Phase 6, puis l'UI peut être basculée
 * en Session 7+ vers ce backend Prisma.
 *
 * Returns : nombre de rows upsertées (créées ou mises à jour).
 */
export async function backfillRssSourcesFromJsonConfig(): Promise<{
  readonly inserted: number;
  readonly skipped: number;
}> {
  // requireAdmin (pas write-rate-limited car action one-shot de migration).
  await requireAdmin();
  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
    return { inserted: 0, skipped: 0 };
  }

  const raw = await prisma.contentGenConfig.findUnique({ where: { key: "rss_sources" } });
  if (!raw) return { inserted: 0, skipped: 0 };
  const legacy = Array.isArray(raw.value)
    ? (raw.value as ReadonlyArray<Record<string, unknown>>)
    : [];

  let inserted = 0;
  let skipped = 0;
  for (const src of legacy) {
    const url = typeof src.url === "string" ? src.url : null;
    if (!url) {
      skipped++;
      continue;
    }
    const existing = await prisma.rssSource.findUnique({ where: { url } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.rssSource.create({
      data: {
        url,
        name: typeof src.name === "string" ? src.name : "(sans nom)",
        enabled: typeof src.enabled === "boolean" ? src.enabled : true,
        verticale: null,
        tags: Array.isArray(src.tags) ? src.tags : [],
        pollIntervalMin: typeof src.pollIntervalMin === "number" ? src.pollIntervalMin : 60,
        autoPublish: typeof src.autoPublish === "boolean" ? src.autoPublish : false,
        language: "fr",
      },
    });
    inserted++;
  }
  return { inserted, skipped };
}

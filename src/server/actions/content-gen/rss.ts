/**
 * Content Generator — RSS sources (V1 stockage ContentGenConfig).
 *
 * Sprint 4 migrera vers tables `RssSource` + `RssItem` dédiées. V1 stocke
 * une liste JSON dans `ContentGenConfig.key="rss_sources"` pour permettre
 * à Will de configurer immédiatement sans attendre la migration SQL.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "./_auth";
import { readContentGenConfig, writeContentGenConfig } from "./_settings";

const KEY = "rss_sources";

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
const RssUrlSchema = z.string().url().max(2048);
const RssSourceSchema = z
  .object({
    url: RssUrlSchema,
    name: z.string().min(2).max(200),
    tags: z.array(z.string().min(1).max(80)).max(100),
    pollIntervalMin: z.number().int().min(5).max(1440),
    autoPublish: z.boolean(),
    enabled: z.boolean(),
  })
  .strict();

export interface RssSource {
  readonly url: string;
  readonly name: string;
  readonly tags: ReadonlyArray<string>;
  readonly pollIntervalMin: number;
  readonly autoPublish: boolean;
  readonly enabled: boolean;
}

export async function listRssSources(): Promise<ReadonlyArray<RssSource>> {
  return readContentGenConfig<ReadonlyArray<RssSource>>(KEY, []);
}

export async function addRssSource(input: RssSource): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation (anti-SSRF / anti-injection).
  RssSourceSchema.parse(input);
  if (!/^https?:\/\//.test(input.url)) throw new Error("url_invalid");
  if (input.name.length < 2) throw new Error("name_too_short");
  if (input.pollIntervalMin < 5 || input.pollIntervalMin > 1440)
    throw new Error("poll_interval_range");
  const current = await listRssSources();
  if (current.some((s) => s.url === input.url)) throw new Error("url_already_added");
  await writeContentGenConfig(KEY, [...current, input], session.userId, "RSS source added");
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/rss`);
}

export async function removeRssSource(url: string): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  RssUrlSchema.parse(url);
  const current = await listRssSources();
  await writeContentGenConfig(
    KEY,
    current.filter((s) => s.url !== url),
    session.userId,
    "RSS source removed",
  );
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/rss`);
}

/**
 * Modifie une source RSS existante (P1-3 audit opérationnel 2026-05-14).
 *
 * Match par `originalUrl` puis remplace la row complète avec `input`. Permet
 * notamment de changer pollInterval, tags, autoPublish, enabled sans devoir
 * remove+add (qui perdait le seen-cache et l'historique).
 */
export async function updateRssSource(originalUrl: string, input: RssSource): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  RssUrlSchema.parse(originalUrl);
  RssSourceSchema.parse(input);
  if (!/^https?:\/\//.test(input.url)) throw new Error("url_invalid");
  if (input.name.length < 2) throw new Error("name_too_short");
  if (input.pollIntervalMin < 5 || input.pollIntervalMin > 1440)
    throw new Error("poll_interval_range");

  const current = await listRssSources();
  const idx = current.findIndex((s) => s.url === originalUrl);
  if (idx === -1) throw new Error("source_not_found");
  // Si on change l'URL et qu'une autre source a déjà cette URL → conflit.
  if (input.url !== originalUrl && current.some((s) => s.url === input.url)) {
    throw new Error("url_already_added");
  }
  const next = [...current];
  next[idx] = input;
  await writeContentGenConfig(KEY, next, session.userId, `RSS source updated (${input.url})`);
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/rss`);
}

/**
 * Toggle enabled d'une source RSS (P1-3 — alias léger de updateRssSource pour
 * 1 seul flip ON/OFF sans avoir à passer tous les champs depuis l'UI).
 */
export async function toggleRssSource(url: string, enabled: boolean): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  RssUrlSchema.parse(url);
  z.boolean().parse(enabled);
  const current = await listRssSources();
  const idx = current.findIndex((s) => s.url === url);
  if (idx === -1) throw new Error("source_not_found");
  const next = [...current];
  next[idx] = { ...current[idx]!, enabled };
  await writeContentGenConfig(
    KEY,
    next,
    session.userId,
    `RSS source ${enabled ? "enabled" : "disabled"} (${url})`,
  );
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/rss`);
}

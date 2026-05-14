/**
 * Content Generator — RSS sources (V1 stockage ContentGenConfig).
 *
 * Sprint 4 migrera vers tables `RssSource` + `RssItem` dédiées. V1 stocke
 * une liste JSON dans `ContentGenConfig.key="rss_sources"` pour permettre
 * à Will de configurer immédiatement sans attendre la migration SQL.
 */

"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./_auth";
import { readContentGenConfig, writeContentGenConfig } from "./_settings";

const KEY = "rss_sources";

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
  const current = await listRssSources();
  await writeContentGenConfig(
    KEY,
    current.filter((s) => s.url !== url),
    session.userId,
    "RSS source removed",
  );
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/rss`);
}

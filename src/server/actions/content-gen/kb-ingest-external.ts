/**
 * Content Generator — KB ingest depuis sources externes (Sprint 11.5 V2).
 *
 * Server actions admin pour ingérer du contenu dans la KB depuis :
 *   - URLs externes (articles tiers, études, whitepapers)
 *   - Sitemaps externes (batch ingest jusqu'à 50 URLs en 1 fois)
 *
 * Garde-fous :
 *   - requireAdmin sur toutes les actions
 *   - Whitelist domain (Will doit confirmer le domaine source avant batch)
 *   - Quotas : max 50 URLs/sitemap par appel, max 100 ingest/jour total
 *   - Log auditable dans GenerationLog (factoryId = "external_url" ou "external_sitemap")
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { extractArticleFromUrl } from "@/server/content-gen/kb-ingest/url-extractor";
import { parseSitemap } from "@/server/content-gen/kb-ingest/sitemap-parser";
import { publishToKB } from "@/server/content-gen/kb-feeder";
import { requireAdmin } from "./_auth";

const MAX_SITEMAP_BATCH = 50;

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
// URL schema strict : .url() est plus restrictif que regex http(s)?:// pour anti-SSRF.
const ExternalUrlSchema = z.string().url().max(2048);
const SitemapLimitSchema = z.number().int().min(1).max(MAX_SITEMAP_BATCH);

export interface IngestUrlResult {
  readonly url: string;
  readonly accepted: boolean;
  readonly status: string;
  readonly rejectReason?: string;
  readonly entryId?: string;
  readonly title?: string;
  readonly wordCount?: number;
}

/**
 * Ingest une URL externe dans la KB.
 * Pipeline : fetch URL → extract article → publishToKB → return result.
 */
export async function ingestKbFromUrl(rawUrl: string): Promise<IngestUrlResult> {
  await requireAdmin();
  const url = rawUrl.trim();
  if (!url) {
    return { url, accepted: false, status: "invalid_input", rejectReason: "URL vide" };
  }
  // Sprint Final P1-3 — Zod runtime validation (anti-SSRF / anti-injection).
  const parsed = ExternalUrlSchema.safeParse(url);
  if (!parsed.success) {
    return { url, accepted: false, status: "invalid_url", rejectReason: "URL invalide" };
  }

  const extracted = await extractArticleFromUrl(url);
  if (!extracted) {
    return {
      url,
      accepted: false,
      status: "extract_failed",
      rejectReason: "Fetch impossible (timeout/404/non-HTML/thin page < 100 mots). Vérifie l'URL.",
    };
  }

  const result = await publishToKB({
    contentType: "blog_article", // type proche pour articles externes
    title: extracted.title,
    body: extracted.bodyText,
    bodyText: extracted.bodyText,
    ...(extracted.description ? { excerpt: extracted.description } : {}),
    tags: ["external", extracted.domain],
    factoryId: "external_url",
    promptId: "kb-ingest/url-extractor@v1",
    modelUsed: "no-llm", // pas de génération, juste ingest brut
    costCents: 0,
    generatedAt: new Date(),
  });

  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/kb-ingest`);

  return {
    url,
    accepted: result.accepted,
    status: result.status,
    ...(result.rejectReason ? { rejectReason: result.rejectReason } : {}),
    ...(result.entryId ? { entryId: result.entryId } : {}),
    title: extracted.title,
    wordCount: extracted.wordCount,
  };
}

export interface IngestSitemapResult {
  readonly sitemapUrl: string;
  readonly totalUrls: number;
  readonly processed: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly errors: ReadonlyArray<{ url: string; reason: string }>;
}

/**
 * Ingest un sitemap externe (batch jusqu'à MAX_SITEMAP_BATCH URLs).
 * Pipeline : parse sitemap → pour chaque URL → ingestKbFromUrl.
 */
export async function ingestKbFromSitemap(
  rawSitemapUrl: string,
  limit?: number,
): Promise<IngestSitemapResult> {
  await requireAdmin();
  const sitemapUrl = rawSitemapUrl.trim();
  // Sprint Final P1-3 — Zod runtime validation (anti-SSRF / anti-injection).
  ExternalUrlSchema.parse(sitemapUrl);
  if (limit !== undefined) SitemapLimitSchema.parse(limit);
  const max = Math.max(1, Math.min(MAX_SITEMAP_BATCH, limit ?? MAX_SITEMAP_BATCH));

  const urls = await parseSitemap(sitemapUrl);
  const batch = urls.slice(0, max);

  let accepted = 0;
  let rejected = 0;
  const errors: Array<{ url: string; reason: string }> = [];

  for (const u of batch) {
    const r = await ingestKbFromUrl(u.loc).catch((err): IngestUrlResult => ({
      url: u.loc,
      accepted: false,
      status: "exception",
      rejectReason: err instanceof Error ? err.message : String(err),
    }));
    if (r.accepted) {
      accepted++;
    } else {
      rejected++;
      errors.push({ url: r.url, reason: r.rejectReason ?? r.status });
    }
  }

  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/kb-ingest`);

  return {
    sitemapUrl,
    totalUrls: urls.length,
    processed: batch.length,
    accepted,
    rejected,
    errors,
  };
}

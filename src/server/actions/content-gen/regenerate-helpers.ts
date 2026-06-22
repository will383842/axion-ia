/**
 * Helpers PURS de la régénération en place (séparés de regenerate.ts qui est
 * `"use server"` — lequel n'autorise que des exports async). Testables sans DB.
 */

import crypto from "node:crypto";
import type {
  ContentType,
  Locale,
  ProviderKey,
  SearchIntent,
  ServiceSector,
} from "../../../../prisma/generated/client";

// Types à générateur direct (aligné sur enqueueDirectGen / generators/index.ts).
// `landing_ville` exclu (CLI-only, hors REGISTRY) → pas régénérable par cette voie.
export const REGENERABLE_CONTENT_TYPES: ReadonlySet<string> = new Set<ContentType>([
  "blog_article",
  "blog_from_rss",
  "blog_from_keywords",
  "blog_from_title",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
  "barometer_insight",
]);

// Statuts NON terminaux : si un job de refresh dans un de ces états cible déjà
// l'article, on ne ré-enqueue pas (anti-doublon en vol).
export const NON_TERMINAL_STATUSES = [
  "queued",
  "running",
  "generating_text",
  "generating_images",
  "fact_checking",
  "needs_review",
  "approved",
  "publishing",
] as const;

/** Shape minimal du job source nécessaire pour reconstruire un job de refresh. */
export interface RegenSourceJob {
  readonly contentType: ContentType;
  readonly targetSearchIntent: SearchIntent;
  readonly targetLocale: Locale;
  readonly anchorVilleSlug: string | null;
  readonly anchorRegionSlug: string | null;
  readonly anchorDepartementCode: string | null;
  readonly templateId: string | null;
  readonly serviceSector: ServiceSector | null;
  readonly campaignId: string | null;
  readonly primaryProvider: ProviderKey;
  readonly fallbackProvider: ProviderKey;
  readonly inputPayload: unknown;
}

/**
 * Construit (PUR) le `data` de création du ContentGenJob de refresh + sa clé
 * d'idempotence. `slotMs` est injecté pour testabilité (slot de 60s).
 */
export function buildRegenerationJobData(params: {
  articleId: string;
  preservedSlug: string | null;
  sourceJob: RegenSourceJob;
  createdBy: string;
  slotMs: number;
}): {
  idempotencyKey: string;
  inputPayload: Record<string, unknown>;
  data: Record<string, unknown>;
} {
  const { articleId, preservedSlug, sourceJob, createdBy, slotMs } = params;

  // Idempotence : un seul refresh par article par fenêtre de 60s (anti double-clic).
  const slot = Math.floor(slotMs / 60_000);
  const idempotencyKey = crypto
    .createHash("sha256")
    .update(["refresh", articleId, slot].join("::"))
    .digest("hex")
    .slice(0, 32);

  const basePayload =
    sourceJob.inputPayload &&
    typeof sourceJob.inputPayload === "object" &&
    !Array.isArray(sourceJob.inputPayload)
      ? { ...(sourceJob.inputPayload as Record<string, unknown>) }
      : {};
  const inputPayload: Record<string, unknown> = {
    ...basePayload,
    // Marqueur consommé par content-publish-worker → UPDATE en place.
    refreshArticleId: articleId,
    refreshOfSlug: preservedSlug ?? null,
  };

  const data: Record<string, unknown> = {
    idempotencyKey,
    contentType: sourceJob.contentType,
    status: "queued",
    priority: 4, // refresh : sous la gen user (3), au-dessus des campagnes (5)
    ...(sourceJob.templateId ? { templateId: sourceJob.templateId } : {}),
    ...(sourceJob.serviceSector ? { serviceSector: sourceJob.serviceSector } : {}),
    ...(sourceJob.campaignId ? { campaignId: sourceJob.campaignId } : {}),
    ...(sourceJob.anchorVilleSlug ? { anchorVilleSlug: sourceJob.anchorVilleSlug } : {}),
    ...(sourceJob.anchorRegionSlug ? { anchorRegionSlug: sourceJob.anchorRegionSlug } : {}),
    ...(sourceJob.anchorDepartementCode
      ? { anchorDepartementCode: sourceJob.anchorDepartementCode }
      : {}),
    inputPayload,
    targetLocale: sourceJob.targetLocale,
    targetSearchIntent: sourceJob.targetSearchIntent,
    primaryProvider: sourceJob.primaryProvider,
    fallbackProvider: sourceJob.fallbackProvider,
    createdBy,
  };

  return { idempotencyKey, inputPayload, data };
}

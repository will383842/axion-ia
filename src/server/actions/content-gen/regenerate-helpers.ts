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

/**
 * Option B (2026-06-25) — dérive un `RegenSourceJob` depuis l'ARTICLE quand le job
 * source a été purgé (`content_gen_job` supprimé après complétion → 0 article
 * régénérable autrement). Rend TOUT article régénérable, jobs purgés inclus.
 *
 * Dérivation volontairement conservatrice (l'article ne stocke ni le mot-clé, ni
 * les anchors, ni le secteur — seulement search_intent + titre) :
 * - contentType = `blog_from_keywords` : fallback universel qui ne requiert QUE
 *   `primaryKeyword` (les autres types ont des dépendances : RSS source, etc.).
 * - primaryKeyword = « lead » du titre (partie avant « : » / « – » / « | »).
 * - intent = celui de l'article (défaut informational) ; locale fr ; providers défaut.
 *
 * Les anchors/secteur d'origine sont perdus → acceptable : le but est de
 * RE-GÉNÉRER un contenu de qualité (grounding KB + prompts durcis) sur le même
 * sujet, en PRÉSERVANT le slug (URL stable). Si le job source existe encore, on
 * l'utilise (params exacts) — ce fallback ne sert qu'aux jobs disparus.
 */
export function deriveSourceJobFromArticle(article: {
  searchIntent: SearchIntent | null;
  title: string | null;
}): RegenSourceJob {
  const rawTitle = (article.title ?? "").trim();
  const lead = rawTitle.split(/\s[:–—|-]\s/)[0]?.trim() ?? rawTitle;
  const primaryKeyword =
    lead.length >= 3 ? lead : rawTitle || "intelligence artificielle entreprise";
  return {
    contentType: "blog_from_keywords",
    targetSearchIntent: article.searchIntent ?? "informational",
    targetLocale: "fr",
    anchorVilleSlug: null,
    anchorRegionSlug: null,
    anchorDepartementCode: null,
    templateId: null,
    serviceSector: null,
    campaignId: null,
    primaryProvider: "anthropic",
    fallbackProvider: "openai",
    inputPayload: { primaryKeyword },
  };
}

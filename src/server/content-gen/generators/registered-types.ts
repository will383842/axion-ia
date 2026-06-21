/**
 * Liste LÉGÈRE des ContentType réellement générables (= présents dans `REGISTRY`
 * de `./index.ts`), SANS importer les générateurs eux-mêmes (qui tirent les SDK
 * providers OpenAI/Anthropic + tout le graphe de prompts).
 *
 * Pourquoi un module séparé : l'orchestrateur (worker BullMQ) a seulement besoin
 * de SAVOIR quels types sont générables pour filtrer les poids de campagne — pas
 * d'exécuter un générateur. Importer `./index.ts` chargeait tout le graphe de
 * génération dans le worker (boot plus lent + import dynamique > 5 s en test).
 *
 * Un test (`registry-phase8.spec.ts`) garantit l'alignement strict de cette liste
 * avec les clés de `REGISTRY` → zéro dérive si un générateur est ajouté/retiré.
 */

import type { ContentType } from "../../../../prisma/generated/client";

export const REGISTERED_CONTENT_TYPE_NAMES = [
  "blog_article",
  "blog_from_rss",
  "blog_from_keywords",
  "blog_from_title",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
  "long_tail_keyword",
  "pain_point_solution",
  "vs_comparator",
  "alternative_to",
  "top_x_in_y",
  "how_to_x_in_y",
  "best_for_x_in_y",
  "calculator_roi",
  "glossary_term",
  "what_is_x",
  "faq_geo",
  "case_study_local",
  "barometer_insight",
] as const satisfies readonly ContentType[];

/** Ensemble des ContentType réellement générables (campagne-safe). */
export const REGISTERED_CONTENT_TYPES: ReadonlySet<ContentType> = new Set(
  REGISTERED_CONTENT_TYPE_NAMES,
);

/** True si un générateur est enregistré pour ce type. */
export function isContentTypeRegistered(contentType: ContentType): boolean {
  return REGISTERED_CONTENT_TYPES.has(contentType);
}

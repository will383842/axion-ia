/**
 * Content Generator — Registry des content-types LLM.
 *
 * Refonte architecture villes 2026-05-26 (Will) — Le ContentType `landing_ville`
 * a été supprimé du registry suite à la suppression des 10 750 pages
 * `/implantations/[region]/[ville]/[verticale]` (risque doorway HCU 2024 +
 * cannibalisation des pages services principales). Les 5 generators verticaux
 * (`landing-ville-by-vertical-*`) + le pipeline partagé `landing-ville-shared.ts`
 * + le dispatcher `landing-ville.ts` ont été supprimés du code.
 *
 * Les generators ville `ville-hub-copy.ts` + `landing-ville-{cas-usage,
 * economic-data,ecosystem,faq-extended,secteurs}.ts` alimentent les sections du
 * hub ville (`/implantations/[region]/[ville]`).
 *
 * ⚠️ DESIGN ASSUMÉ (audit content-gen 2026-06-15, P1-2) — Ces generators ville
 * NE sont VOLONTAIREMENT PAS enregistrés dans `REGISTRY` et ne sont donc PAS
 * atteignables par `getGenerator()` / le pipeline BullMQ (content-gen-worker).
 * Ils tournent EXCLUSIVEMENT via scripts CLI manuels
 * (`scripts/regen-villes-complete.ts`, `regen-villes-stratified.ts`), écrivent
 * dans la table `GeneratedVilleCopy`, puis sont consommés par le hub via
 * `resolve-with-copy.ts`. C'est un CHOIX (contrôle du coût ~$105 pour ~2100
 * villes/run + cadence manuelle décidée par Will), PAS un orphelin accidentel.
 * → Ne PAS les ajouter au REGISTRY sans décision explicite (sinon
 *   l'orchestrateur pourrait déclencher des runs villes massifs non maîtrisés).
 *
 * Note : l'enum Prisma `ContentType` contient toujours `landing_ville` (legacy
 * compat — pas de migration destructive). Les jobs queue historiques avec ce
 * ContentType lèveront une erreur explicite à l'exécution.
 */

import type { ContentType } from "../../../../prisma/generated/client";
import type { Generator } from "./types";
import { blogArticleGenerator } from "./blog-article";
import { blogFromRssGenerator } from "./blog-from-rss";
import { blogFromKeywordsGenerator } from "./blog-from-keywords";
import { blogFromTitleGenerator } from "./blog-from-title";
import { comparisonGenerator } from "./comparison";
import { guidePilierGenerator } from "./guide-pilier";
import { qaDerivedGenerator } from "./qa-derived";
import { faqStandaloneGenerator } from "./faq-standalone";
import { barometerInsightGenerator } from "./barometer-insight";
// Sprint v7 Phase 8 commit 2/4 — 12 nouveaux generators content types.
import {
  longTailKeywordGenerator,
  painPointSolutionGenerator,
  vsComparatorGenerator,
  alternativeToGenerator,
  topXInYGenerator,
  howToXInYGenerator,
  bestForXInYGenerator,
  calculatorRoiGenerator,
  glossaryTermGenerator,
  whatIsXGenerator,
  faqGeoGenerator,
  caseStudyLocalGenerator,
} from "./v7-phase8-generators";

const REGISTRY: Partial<Record<ContentType, Generator>> = {
  blog_article: blogArticleGenerator,
  blog_from_rss: blogFromRssGenerator,
  blog_from_keywords: blogFromKeywordsGenerator,
  blog_from_title: blogFromTitleGenerator,
  comparison: comparisonGenerator,
  guide_pilier: guidePilierGenerator,
  qa_derived: qaDerivedGenerator,
  faq_standalone: faqStandaloneGenerator,
  // Sprint v7 Phase 8 — 12 nouveaux content types.
  long_tail_keyword: longTailKeywordGenerator,
  pain_point_solution: painPointSolutionGenerator,
  vs_comparator: vsComparatorGenerator,
  alternative_to: alternativeToGenerator,
  top_x_in_y: topXInYGenerator,
  how_to_x_in_y: howToXInYGenerator,
  best_for_x_in_y: bestForXInYGenerator,
  calculator_roi: calculatorRoiGenerator,
  glossary_term: glossaryTermGenerator,
  what_is_x: whatIsXGenerator,
  faq_geo: faqGeoGenerator,
  case_study_local: caseStudyLocalGenerator,
  // Observatoire IA 2026 — article ancré sur le BarometerSnapshot (hors wizard,
  // piloté par l'action admin generateBarometerArticle).
  barometer_insight: barometerInsightGenerator,
};

export function getGenerator(contentType: ContentType): Generator {
  const gen = REGISTRY[contentType];
  if (!gen) {
    throw new Error(`No generator registered for ContentType '${contentType}'`);
  }
  return gen;
}

/**
 * Liste des ContentType générables : ré-exportée depuis le module LÉGER
 * `./registered-types` (pas d'import de générateur) pour que l'orchestrateur
 * puisse l'importer sans charger tout le graphe de génération. La cohérence
 * stricte avec les clés de `REGISTRY` est garantie par `registry-phase8.spec.ts`.
 */
export {
  REGISTERED_CONTENT_TYPES,
  REGISTERED_CONTENT_TYPE_NAMES,
  isContentTypeRegistered,
} from "./registered-types";

/** Clés réellement présentes dans REGISTRY (source pour le test anti-dérive). */
export const REGISTRY_CONTENT_TYPES: readonly ContentType[] = Object.keys(
  REGISTRY,
) as ContentType[];

export type { Generator, GeneratorOutput, GeneratorBaseInput } from "./types";

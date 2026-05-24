/**
 * Content Generator — Registry des 9 generators (Sprint 2 AGT-C).
 *
 * Resolve : `ContentType` → `Generator` correspondant.
 *
 * Sprint v7 Phase 5 commit 1 — extension : le `landing_ville` generator
 * (mappé sur le `ContentType` enum DB) est désormais un dispatcher qui
 * route vers 5 generators verticaux dédiés (`landing-ville-by-vertical-*`).
 * Ce file exporte aussi le registry vertical + les 5 generators standalones
 * pour usages avancés (tests, admin UI, dispatch ad-hoc).
 */

import type { ContentType } from "../../../../prisma/generated/client";
import type { Generator } from "./types";
import { landingVilleGenerator } from "./landing-ville";
import { blogArticleGenerator } from "./blog-article";
import { blogFromRssGenerator } from "./blog-from-rss";
import { blogFromKeywordsGenerator } from "./blog-from-keywords";
import { blogFromTitleGenerator } from "./blog-from-title";
import { comparisonGenerator } from "./comparison";
import { guidePilierGenerator } from "./guide-pilier";
import { qaDerivedGenerator } from "./qa-derived";
import { faqStandaloneGenerator } from "./faq-standalone";
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

const REGISTRY: Record<ContentType, Generator> = {
  landing_ville: landingVilleGenerator,
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
};

export function getGenerator(contentType: ContentType): Generator {
  const gen = REGISTRY[contentType];
  if (!gen) {
    throw new Error(`No generator registered for ContentType '${contentType}'`);
  }
  return gen;
}

export { landingVilleGenerator } from "./landing-ville";
export { LANDING_VILLE_BY_VERTICAL_REGISTRY, resolveLandingVilleVertical } from "./landing-ville";

// Sprint v7 Phase 5 commit 1 — 5 generators verticaux exposés en exports
// nommés. Utilisables directement (tests, ad-hoc Session 6) sans passer par
// le dispatcher `landingVilleGenerator`.
export { landingVilleByVerticalInterventionsGenerator } from "./landing-ville-by-vertical-interventions";
export { landingVilleByVerticalAuditsGenerator } from "./landing-ville-by-vertical-audits";
export { landingVilleByVerticalImplementationsGenerator } from "./landing-ville-by-vertical-implementations";
export { landingVilleByVerticalUnAUnGenerator } from "./landing-ville-by-vertical-un-a-un";
export { landingVilleByVerticalSitesWebIaGenerator } from "./landing-ville-by-vertical-sites-web-ia";

export {
  LANDING_VILLE_VERTICAL_SLUGS,
  DOCTRINE_INTOUCHABLE,
  runLandingVilleByVerticalPipeline,
} from "./landing-ville-shared";
export type { LandingVilleVerticalSlug, VerticalConfig } from "./landing-ville-shared";

export type { Generator, GeneratorOutput, GeneratorBaseInput } from "./types";

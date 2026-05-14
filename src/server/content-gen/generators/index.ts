/**
 * Content Generator — Registry des 9 generators (Sprint 2 AGT-C).
 *
 * Resolve : `ContentType` → `Generator` correspondant.
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
};

export function getGenerator(contentType: ContentType): Generator {
  const gen = REGISTRY[contentType];
  if (!gen) {
    throw new Error(`No generator registered for ContentType '${contentType}'`);
  }
  return gen;
}

export { landingVilleGenerator } from "./landing-ville";
export type { Generator, GeneratorOutput, GeneratorBaseInput } from "./types";

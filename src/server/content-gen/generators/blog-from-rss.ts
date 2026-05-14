/**
 * Generator — blog from RSS NewsArticle (Sprint 2/5 AGT-C).
 *
 * V1 = squelette. Sub-prompt complet : prompts/blog-article.md variant rss.
 * Particularités : Schema NewsArticle (pas Article), citation source obligatoire,
 * tier_2_noindex_follow auto-publish si score ≥ 60.
 */

import { landingVilleGenerator } from "./landing-ville";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";

export const blogFromRssGenerator: Generator = {
  contentType: "blog_from_rss",
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    const result = await landingVilleGenerator.generate({ ...input, contentType: "blog_from_rss" });
    return result;
  },
};

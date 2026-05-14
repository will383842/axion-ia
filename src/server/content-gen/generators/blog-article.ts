/**
 * Generator — blog article générique (Sprint 2 AGT-C).
 *
 * V1 = squelette appliquant landing-ville pattern adapté blog.
 * Sub-prompt complet : prompts/blog-article.md megapack.
 */

import { landingVilleGenerator } from "./landing-ville";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";

export const blogArticleGenerator: Generator = {
  contentType: "blog_article",
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    // V1 minimal : delegue le pipeline a landing-ville en patchant contentType.
    // V1.5 (Sprint 2 Day 3) : sub-prompt blog-article.md megapack + variants.
    const result = await landingVilleGenerator.generate({ ...input, contentType: "blog_article" });
    return result;
  },
};

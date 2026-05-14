/**
 * Generator — blog depuis titre manuel (Sprint 2 AGT-C).
 *
 * V1 = squelette. Source simple : Will fournit le titre, le generator produit
 * directement le contenu.
 */

import { landingVilleGenerator } from "./landing-ville";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";

export const blogFromTitleGenerator: Generator = {
  contentType: "blog_from_title",
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    const result = await landingVilleGenerator.generate({
      ...input,
      contentType: "blog_from_title",
    });
    return result;
  },
};

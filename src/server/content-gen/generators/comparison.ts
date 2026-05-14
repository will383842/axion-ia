/**
 * Generator — comparatif (outils-ia / service-axion / alternative-saas / build-vs-buy).
 *
 * V1 = squelette. Sub-prompt : prompts/comparatif.md megapack.
 * Particularité : <table> obligatoire (intent commercial_investigation alignement).
 */

import { landingVilleGenerator } from "./landing-ville";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";

export const comparisonGenerator: Generator = {
  contentType: "comparison",
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    const result = await landingVilleGenerator.generate({ ...input, contentType: "comparison" });
    return result;
  },
};

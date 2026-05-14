/**
 * Generator — FAQ standalone page dédiée (Sprint 2 AGT-C).
 *
 * V1 = squelette. Sub-prompt : prompts/faq-standalone.md megapack.
 * Particularité : page dédiée + DB FAQ table row.
 */

import { landingVilleGenerator } from "./landing-ville";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";

export const faqStandaloneGenerator: Generator = {
  contentType: "faq_standalone",
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    const result = await landingVilleGenerator.generate({
      ...input,
      contentType: "faq_standalone",
    });
    return result;
  },
};

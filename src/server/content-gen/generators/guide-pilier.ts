/**
 * Generator — guide pilier long-form 2000-5000 mots (Sprint 2 AGT-C).
 *
 * V1 = squelette. Sub-prompt : prompts/guide-pilier.md megapack.
 * Particularités :
 * - 2 étapes : outline 8-15 sections → STOP & ASK Will → body complet
 * - HowTo JSON-LD obligatoire
 * - Word count ≥ 2000 mots
 */

import { landingVilleGenerator } from "./landing-ville";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";

export const guidePilierGenerator: Generator = {
  contentType: "guide_pilier",
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    const result = await landingVilleGenerator.generate({ ...input, contentType: "guide_pilier" });
    return result;
  },
};

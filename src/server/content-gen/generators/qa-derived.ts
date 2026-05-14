/**
 * Generator — Q/R dérivée post-process (Sprint 2 AGT-C).
 *
 * V1 = squelette. Pipeline (§ 29 master prompt v1.7) :
 * 1. Parse FAQ embed depuis sortie LLM article parent
 * 2. Enrichit contexte : 3 phrases auto + 4-6 Q/R similaires (cosine)
 * 3. ≥ 300 mots anti-thin HCU
 * 4. Émet QAPage JSON-LD + Speakable
 *
 * Pas d'appel LLM nouveau (utilise FAQ déjà générée).
 */

import { landingVilleGenerator } from "./landing-ville";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";

export const qaDerivedGenerator: Generator = {
  contentType: "qa_derived",
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    const result = await landingVilleGenerator.generate({ ...input, contentType: "qa_derived" });
    return result;
  },
};

/**
 * Generator — blog depuis liste de mots-clés (Sprint 2 AGT-C).
 *
 * V1 = squelette. STOP & ASK Will obligatoire avant generation
 * (cf. Q5 master prompt § 20 — outline + format + word count proposés).
 */

import { landingVilleGenerator } from "./landing-ville";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";

export const blogFromKeywordsGenerator: Generator = {
  contentType: "blog_from_keywords",
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    const result = await landingVilleGenerator.generate({
      ...input,
      contentType: "blog_from_keywords",
    });
    return result;
  },
};

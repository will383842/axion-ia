// src/content/keywords/validate.ts
// Validation programmatique des KeywordSeed
import type { KeywordSeed, KeywordValidationResult } from "./types";

export function validateKeywordSeed(seed: KeywordSeed): KeywordValidationResult {
  const errors: string[] = [];

  if (!seed.keyword || seed.keyword.length < 10)
    errors.push(`keyword trop court (${seed.keyword?.length ?? 0} chars < 10)`);

  if (!seed.urlCible.startsWith("/fr/"))
    errors.push(`urlCible doit commencer par /fr/ — actuel: ${seed.urlCible}`);

  if (seed.niveau === 1 && seed.priorite === 1)
    errors.push("niveau=1 + priorite=1 interdit (HEAD ne peut être attaqué maintenant)");

  if (seed.injection.h1 && seed.injection.h1.toLowerCase() === seed.keyword.toLowerCase())
    errors.push("H1 = keyword brut interdit (règle R5)");

  if (seed.injection.metaTitle && seed.injection.metaTitle.length > 60)
    errors.push(
      `metaTitle trop long: ${seed.injection.metaTitle.length} chars > 60 (valeur: "${seed.injection.metaTitle}")`,
    );

  if (seed.injection.metaDescription && seed.injection.metaDescription.length > 155)
    errors.push(
      `metaDescription trop longue: ${seed.injection.metaDescription.length} chars > 155`,
    );

  if (
    seed.variables?.chiffre &&
    isNaN(Number(seed.variables.chiffre.replace("-", "").replace(",", ".")))
  )
    errors.push(`variables.chiffre invalide: "${seed.variables.chiffre}"`);

  if (seed.intent === "aeo" && seed.keyword && !seed.keyword.trim().endsWith("?"))
    errors.push("keyword AEO doit se terminer par '?'");

  return { valid: errors.length === 0, errors };
}

export function validateAllSeeds(seeds: readonly KeywordSeed[]): {
  total: number;
  valid: number;
  invalid: number;
  errors: Array<{ keyword: string; errors: readonly string[] }>;
} {
  const results = seeds.map((seed) => ({
    keyword: seed.keyword,
    result: validateKeywordSeed(seed),
  }));

  const invalid = results.filter((r) => !r.result.valid);

  return {
    total: seeds.length,
    valid: results.filter((r) => r.result.valid).length,
    invalid: invalid.length,
    errors: invalid.map((r) => ({ keyword: r.keyword, errors: r.result.errors })),
  };
}

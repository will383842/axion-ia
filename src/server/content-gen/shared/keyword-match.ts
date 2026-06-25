/**
 * Matching keyword robuste pour les gates de génération (H1 / metaTitle).
 *
 * Problème résolu : les gates exigeaient le mot-clé principal en SOUS-CHAÎNE
 * CONTIGUË (`text.includes(keyword)`). Pour un mot-clé long dérivé d'un titre
 * (ex. « Audit Intelligence Artificielle à Grenoble », 43 car.), c'est
 * incompatible avec un metaTitle SEO de 50-60 car., d'autant que les modèles
 * abrègent « Intelligence Artificielle » → « IA ». Résultat : le gate échouait
 * à chaque passe → la boucle qualité s'épuisait avant l'enforcement de longueur
 * → contenu court bloqué en `needs_review`.
 *
 * Solution : canonicalisation (minuscule, sans accents, « intelligence
 * artificielle » ⇄ « ia ») + présence de TOUS les tokens significatifs
 * (ordre-indépendant, hors connecteurs). « Audit IA à Grenoble » valide alors
 * le mot-clé « Audit Intelligence Artificielle à Grenoble ».
 */

const STOPWORDS = new Set([
  "a",
  "à",
  "de",
  "du",
  "des",
  "le",
  "la",
  "les",
  "l",
  "en",
  "et",
  "pour",
  "sur",
  "au",
  "aux",
  "un",
  "une",
  "d",
  "the",
  "of",
  "for",
  "in",
]);

/**
 * Canonicalise une chaîne pour le matching keyword : minuscule, accents retirés,
 * « intelligence artificielle » → « ia », ponctuation → espaces.
 */
export function canonicalizeForKeywordMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/intelligence artificielle/g, "ia")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokens significatifs (mots de plus d'1 lettre, hors connecteurs) après canonicalisation. */
export function significantKeywordTokens(keyword: string): string[] {
  return canonicalizeForKeywordMatch(keyword)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * `true` si TOUS les tokens significatifs du mot-clé sont présents dans `text`
 * (après canonicalisation IA + accents). Robuste aux mots-clés longs et à
 * l'abréviation « IA », là où `includes()` contigu échoue.
 */
export function keywordPresentInText(keyword: string, text: string): boolean {
  const tokens = significantKeywordTokens(keyword);
  if (tokens.length === 0) return true;
  const hay = canonicalizeForKeywordMatch(text);
  return tokens.every((t) => hay.includes(t));
}

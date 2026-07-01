/**
 * Content Generator — Parse JSON LLM output safe (centralisé Sprint v7 audit 2026-05-24).
 *
 * Strip markdown code fences (```json ... ```) que GPT-4o ajoute parfois,
 * puis JSON.parse. Évite le bug runtime "Unexpected token '`'" qui frappait
 * 25% des Phase 8 v7 single-shot.
 */

export function parseLlmJson<T = unknown>(raw: string): T {
  const cleaned = stripMarkdownFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    // Fallback (2026-07-01) : le LLM a entouré le JSON de prose
    // (« Voici le plan : {…} ») que le strip de fences ne retire pas — fréquent
    // sur le fallback Anthropic (pas de JSON mode). On extrait le premier bloc
    // {…} / […] et on retente. Si aucun bloc, on remonte l'erreur d'origine.
    const block = extractFirstJsonBlock(cleaned);
    if (block !== null) {
      return JSON.parse(block) as T;
    }
    throw err;
  }
}

/**
 * Extrait le premier bloc JSON équilibré (objet `{…}` ou tableau `[…]`) d'une
 * chaîne pouvant contenir de la prose autour. Retourne `null` si aucun délimiteur
 * ouvrant n'est présent.
 */
export function extractFirstJsonBlock(s: string): string | null {
  const firstObj = s.indexOf("{");
  const firstArr = s.indexOf("[");
  if (firstObj === -1 && firstArr === -1) return null;

  const useObject = firstArr === -1 || (firstObj !== -1 && firstObj < firstArr);
  const start = useObject ? firstObj : firstArr;
  const close = useObject ? "}" : "]";
  const end = s.lastIndexOf(close);
  if (end <= start) return null;

  return s.slice(start, end + 1);
}

export function parseLlmJsonSafe<T = unknown>(raw: string): T | null {
  try {
    return parseLlmJson<T>(raw);
  } catch {
    return null;
  }
}

export function stripMarkdownFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json|JSON)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

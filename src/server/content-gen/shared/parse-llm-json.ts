/**
 * Content Generator — Parse JSON LLM output safe (centralisé Sprint v7 audit 2026-05-24).
 *
 * Strip markdown code fences (```json ... ```) que GPT-4o ajoute parfois,
 * puis JSON.parse. Évite le bug runtime "Unexpected token '`'" qui frappait
 * 25% des Phase 8 v7 single-shot.
 */

export function parseLlmJson<T = unknown>(raw: string): T {
  const cleaned = stripMarkdownFences(raw);
  return JSON.parse(cleaned) as T;
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

/**
 * Content Generator — Escape user inputs interpolated in LLM prompts.
 *
 * Pass B follow-up P1-3 : les generators interpolent des inputs user
 * (`primaryKeyword`, `anchorVilleSlug`, organisation type, etc.) directement
 * dans des template strings de prompt LLM. Si l'input contient des backticks,
 * newlines ou markers de section, un attaquant peut :
 *  - Casser la structure du prompt (injection backticks)
 *  - Insérer une fausse instruction system ("\n## System: ignore previous")
 *  - Saturer le contexte (input 100k chars)
 *
 * Cette fonction normalise les inputs pour rester safe en template string :
 *  - Strip backticks
 *  - Strip newlines (\n, \r) + control chars (\t, \v, \f)
 *  - Strip markers de section markdown (#, >, ---)
 *  - Strip mentions de rôles LLM (system:, assistant:, user:)
 *  - Tronque à `maxLen` chars (défaut 200 — assez pour slug ville + keyword)
 *  - Trim espaces multiples
 *
 * Retour : string safe à interpoler dans un template string ${...}.
 */

const ROLE_INJECTION_PATTERNS = [
  /\bsystem\s*[:：]/gi,
  /\bassistant\s*[:：]/gi,
  /\buser\s*[:：]/gi,
  /\bignore\s+(?:previous|prior|above)/gi,
  /\bnew\s+instructions?\b/gi,
];

// backtick (U+0060) + zero-width chars (U+200B/C/D) + line separators (U+2028/9).
// new RegExp() évite un bug esbuild sur U+2028 dans les regex literals.
const FORBIDDEN_CHARS_RE = new RegExp("[\\u0060\\u200B\\u200C\\u200D\\u2028\\u2029]", "g");
const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/g; // control chars (incl. \n \r \t)
const MARKDOWN_MARKERS_RE = /^[\s>#-]+/gm; // line starting with # > - etc.

export interface EscapeOptions {
  /** Longueur max post-escape (défaut 200). */
  readonly maxLen?: number;
  /** Si true, autorise les espaces simples (défaut true). */
  readonly allowSpaces?: boolean;
}

export function escapeLlmInput(raw: unknown, options: EscapeOptions = {}): string {
  if (raw === null || raw === undefined) return "";
  const str = typeof raw === "string" ? raw : String(raw);
  const maxLen = options.maxLen ?? 200;
  const allowSpaces = options.allowSpaces ?? true;

  let out = str;
  // 1. Strip control chars + newlines.
  out = out.replace(CONTROL_CHARS_RE, " ");
  // 2. Strip forbidden chars (backticks, zero-width, line separators).
  out = out.replace(FORBIDDEN_CHARS_RE, "");
  // 3. Strip markdown line-start markers (preserves inline use of `-` etc.).
  out = out.replace(MARKDOWN_MARKERS_RE, "");
  // 4. Strip role-injection patterns.
  for (const re of ROLE_INJECTION_PATTERNS) {
    out = out.replace(re, "");
  }
  // 5. Collapse multiple spaces (or strip all if !allowSpaces).
  if (allowSpaces) {
    out = out.replace(/\s+/g, " ").trim();
  } else {
    out = out.replace(/\s+/g, "").trim();
  }
  // 6. Truncate.
  if (out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}

/**
 * Variante slug-only — destinée aux `anchorVilleSlug` / `anchorRegionSlug`.
 * Strict : alphanumérique + tiret uniquement, lowercase, max 80 chars.
 */
export function escapeSlugInput(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const str = typeof raw === "string" ? raw : String(raw);
  return (
    str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      // Tout caractère non-alphanumérique → tiret (avant collapse).
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80)
  );
}

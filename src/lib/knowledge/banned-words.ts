/**
 * KB V4 — Runtime gate banned words pour `publish.ts`.
 *
 * Helper pure exposé. Pendant import depuis `scripts/check-knowledge-banned-words.ts`
 * éviterait un cycle (script Node Prisma → src → ...), donc on duplique le pattern
 * ici pour usage server action.
 *
 * Doctrine `axionia-core` 2026-05-06 + §18 décision 7 prompt V4.
 */

const BANNED_PATTERN =
  /\b(?:[Ff]ormation|[Ff]ormations|[Ff]ormer\b|[Ff]ormateur|[Ff]ormatrice|[Ff]ormateurs|[Ff]ormatrices)\b(?!.*(?:transform|inform|conform|reform|déform|défor))/i;

export interface BannedWordCheck {
  readonly valid: boolean;
  readonly fieldViolations: ReadonlyArray<{ field: string; snippet: string }>;
}

/**
 * Vérifie tous les champs concernés d'une translation.
 * Retourne `valid: true` si aucun mot banni.
 */
export function checkTranslationBannedWords(input: {
  readonly title?: string | null;
  readonly excerpt?: string | null;
  readonly body?: string | null;
  readonly bodyText?: string | null;
  readonly metaTitle?: string | null;
  readonly metaDescription?: string | null;
}): BannedWordCheck {
  const fields: Array<[string, string | null | undefined]> = [
    ["title", input.title],
    ["excerpt", input.excerpt],
    ["body", input.bodyText ?? input.body],
    ["metaTitle", input.metaTitle],
    ["metaDescription", input.metaDescription],
  ];

  const violations: { field: string; snippet: string }[] = [];
  for (const [field, value] of fields) {
    if (value && BANNED_PATTERN.test(value)) {
      violations.push({ field, snippet: value.slice(0, 100) });
    }
  }

  return { valid: violations.length === 0, fieldViolations: violations };
}

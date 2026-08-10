/**
 * KB V4 — Runtime gate banned words pour `publish.ts`.
 *
 * Helper pure exposé. Pendant import depuis `scripts/check-knowledge-banned-words.ts`
 * éviterait un cycle (script Node Prisma → src → ...), donc on duplique le pattern
 * ici pour usage server action.
 *
 * Doctrine `axionia-core` 2026-05-06 + §18 décision 7 prompt V4.
 */

// Le mot « formation » n'est PLUS banni (décision Will, 2026-08-10).
//
// Le bannissement datait d'une époque où Axion-IA ne pouvait pas se présenter
// comme organisme de formation. Ce n'est plus le cas : le site vend 21 formations
// au catalogue, l'onglet « Formations IA » est dans la navigation principale, les
// URL `/formations/*` sont indexées, et la divulgation OF est active. Interdire le
// mot dans la base de connaissance revenait à interdire au corpus de nommer l'offre
// que le site vend par ailleurs.
//
// ⚠️ Ce que cela ne change PAS : la protection Qualiopi. Elle n'a jamais reposé sur
// ce filtre — la garde primaire est le drapeau `isQualiopiPublicDisclosureEnabled()`
// (cf. `src/server/qualiopi/config/flag.ts`), qui reste en place. Le filtre de mots
// n'en était qu'un filet secondaire, et un filet poreux (regex).
//
// La liste est donc VIDE. Le mécanisme est conservé : il reste le point d'entrée
// si un mot devait être proscrit un jour (une marque tierce, un terme juridique
// mal employé). Y ajouter une entrée suffit à le réactiver — mais ne jamais y
// remettre « formation ».
const BANNED_PATTERNS: ReadonlyArray<RegExp> = [];

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
    if (value && BANNED_PATTERNS.some((re) => re.test(value))) {
      violations.push({ field, snippet: value.slice(0, 100) });
    }
  }

  return { valid: violations.length === 0, fieldViolations: violations };
}

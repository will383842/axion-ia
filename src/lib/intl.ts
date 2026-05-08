// SSOT helpers Intl.* — Sprint cert 14.x (2026-05-08).
// Centralise toute formatation locale-aware (nombres, dates, devises, listes,
// pluralisation, collation accent-aware) pour éviter duplication.
// Avant ce fichier : 5 implémentations dupliquées (pricing.ts, RoiSimulator,
// Price, MediaCoverage, PressReleases) + 11 toLocaleString() directs.
//
// Doctrine SSOT « code = vérité » : tout nouveau usage Intl doit passer par
// ces helpers. Locale typée via `@/i18n/routing` (FR canonical, EN miroir,
// ES/IT/DE V3-ready via mapping).

import type { Locale } from "@/i18n/routing";

// Mapping locale next-intl → BCP 47 tag pour Intl.* APIs.
// Ajouter ES/IT/DE ici lors de l'extension V3 (routing.ts piloté).
const BCP47: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-US",
};

const tagFor = (locale: Locale): string => BCP47[locale];

// =============================================================================
// Nombres
// =============================================================================

/**
 * Formatte un nombre avec séparateurs locaux. Default : 0 décimales.
 * Ex. fmtNumber(1234567, "fr") → "1 234 567"
 *     fmtNumber(1234567, "en") → "1,234,567"
 */
export function fmtNumber(n: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(tagFor(locale), { maximumFractionDigits: 0, ...options }).format(n);
}

/**
 * Spécialisé pour les populations de villes/régions (toujours entier, séparé).
 * Remplace les 11 `population.toLocaleString(isFr ? "fr-FR" : "en-US")` du repo.
 */
export function fmtPopulation(n: number, locale: Locale): string {
  return fmtNumber(n, locale);
}

// =============================================================================
// Devises
// =============================================================================

/**
 * Formatte un montant en EUR HT. Default : 0 décimales (cohérent doctrine
 * pricing.ts qui n'utilise jamais de centimes pour les tarifs publics).
 * Ex. fmtCurrency(490, "fr") → "490 €"
 *     fmtCurrency(490, "en") → "€490"
 */
export function fmtCurrency(
  amount: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(tagFor(locale), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
    ...options,
  }).format(amount);
}

// =============================================================================
// Dates
// =============================================================================

/**
 * Formatte une date courte locale-aware. Default : day numeric + month long + year numeric.
 * Ex. fmtDate(new Date("2026-05-08"), "fr") → "8 mai 2026"
 *     fmtDate(new Date("2026-05-08"), "en") → "May 8, 2026"
 */
export function fmtDate(
  date: Date | string | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat(tagFor(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  }).format(d);
}

// =============================================================================
// Listes
// =============================================================================

/**
 * Formatte une liste avec connecteurs locaux (Intl.ListFormat ES2021).
 * Ex. fmtList(["A","B","C"], "fr") → "A, B et C"
 *     fmtList(["A","B","C"], "en") → "A, B, and C"
 *
 * Pour le type "disjunction" (ou) : fmtList(arr, locale, { type: "disjunction" }).
 */
export function fmtList(
  items: ReadonlyArray<string>,
  locale: Locale,
  options?: Intl.ListFormatOptions,
): string {
  return new Intl.ListFormat(tagFor(locale), {
    type: "conjunction",
    style: "long",
    ...options,
  }).format(items);
}

// =============================================================================
// Pluralisation
// =============================================================================

/**
 * Catégorie plurielle locale (zero/one/two/few/many/other). Utile quand
 * `t("key", { count })` ICU n'est pas suffisant (ex. messages fragmentés).
 * Ex. pluralRule(1, "fr") → "one" · pluralRule(2, "fr") → "other"
 */
export function pluralRule(n: number, locale: Locale): Intl.LDMLPluralRule {
  return new Intl.PluralRules(tagFor(locale)).select(n);
}

// =============================================================================
// Collation (sorting accent-aware)
// =============================================================================

/**
 * Comparator pour `.sort()` accent-aware. Corrige les bugs `"Évry" > "Eze"`
 * (lexical default casse les accents en FR). À utiliser pour villes / régions /
 * tags / blog posts.
 *
 * Usage : `array.sort(localeCompare("fr"))`.
 */
export function localeCompare(
  locale: Locale,
  options?: Intl.CollatorOptions,
): (a: string, b: string) => number {
  const collator = new Intl.Collator(tagFor(locale), {
    sensitivity: "base",
    numeric: true,
    ...options,
  });
  return (a, b) => collator.compare(a, b);
}

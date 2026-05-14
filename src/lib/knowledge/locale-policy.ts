/**
 * KB V4 — Politique locale FR-only V1.
 *
 * §18 décision 3 prompt master : FR uniquement V1. Architecture multilingue
 * préservée (Locale enum, KnowledgeTranslation par locale), EN activable V2.
 *
 * Cette politique sert :
 * - Factory ingest API (skip EN translations en V1)
 * - Sitemap-knowledge (skip EN entries en V1)
 * - Pages publiques EN (404 sur entries factory V1)
 *
 * Override via env var `KB_LOCALE` :
 * - `fr_only` (default V1) : seules FR translations sont publiées
 * - `fr_en` : FR + EN parity (V2+ ou tests)
 */

import type { Locale } from "../../../prisma/generated/client";

export type KbLocalePolicy = "fr_only" | "fr_en";

export function getKbLocalePolicy(): KbLocalePolicy {
  const env = process.env.KB_LOCALE;
  return env === "fr_en" ? "fr_en" : "fr_only";
}

/**
 * Liste les locales actives selon la politique V4.
 */
export function getActiveLocales(): readonly Locale[] {
  return getKbLocalePolicy() === "fr_en" ? ["fr", "en"] : ["fr"];
}

/**
 * Filtre les translations selon la politique V4.
 */
export function filterTranslationsByPolicy<T extends { locale: Locale }>(
  translations: readonly T[],
): readonly T[] {
  const active = getActiveLocales();
  return translations.filter((t) => active.includes(t.locale));
}

export function isLocaleActive(locale: Locale): boolean {
  return getActiveLocales().includes(locale);
}

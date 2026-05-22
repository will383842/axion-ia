// Wrapper SSOT V-10 — délègue à src/lib/slug.ts (consolidation 2026-05-22).
// API conservée pour rétro-compat services image-bank.

import { slugify, isValidSlug } from "@/lib/slug";
import { SLUG_MAX_LENGTH, type ImageBankLocale } from "../constants";

/**
 * Force un slug en ASCII safe (lowercase, tirets, ≤ SLUG_MAX_LENGTH).
 * Le second argument `_locale` est ignoré (notre impl est locale-agnostic via
 * normalize NFD), mais conservé pour compatibilité avec l'API attendue par les
 * services.
 */
export function ensureAsciiSlug(input: string, _locale?: ImageBankLocale): string {
  return slugify(input, { maxLen: SLUG_MAX_LENGTH, fallback: "image" });
}

/** Valide qu'un slug est ASCII safe (utiliser dans les Zod refinements). */
export function isAsciiSlug(slug: string): boolean {
  return isValidSlug(slug, { maxLen: SLUG_MAX_LENGTH });
}

// Force ASCII pour les slugs (les slugs Unicode cassent les URL dans les vieux
// clients mail/Slack et les paths Windows utilisés en dev). Pas de dep externe
// `slugify` : impl inline alignée sur `src/lib/geo.ts:90` du repo.

import { SLUG_MAX_LENGTH, type ImageBankLocale } from "../constants";

/**
 * Force un slug en ASCII safe (lowercase, tirets, ≤ SLUG_MAX_LENGTH).
 * Le second argument `_locale` est ignoré (notre impl est locale-agnostic via
 * normalize NFD), mais conservé pour compatibilité avec l'API attendue par les
 * services.
 */
export function ensureAsciiSlug(input: string, _locale?: ImageBankLocale): string {
  const ascii = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii.slice(0, SLUG_MAX_LENGTH) || "image";
}

/** Valide qu'un slug est ASCII safe (utiliser dans les Zod refinements). */
export function isAsciiSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,99}$/.test(slug);
}

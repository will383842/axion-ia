// Helper Zod pour parser le champ `locale` envoye par les forms.
// Sprint 15 fix Fork 2 W5-2 : sans validation, un POST `locale=es` faisait
// un cast TS abusif puis Postgres rejetait l'INSERT (enum Locale fr|en).

import { z } from "zod";

/** Zod schema reutilisable, fallback safe sur 'fr' (CLAUDE.md §3 canonical). */
export const localeSchema = z.enum(["fr", "en"]).default("fr");

/**
 * Parse une valeur formData.get('locale'). Toujours retourne 'fr' | 'en',
 * jamais throw. Convertit FormDataEntryValue en string + valide enum.
 */
export function parseLocale(raw: FormDataEntryValue | string | null | undefined): "fr" | "en" {
  if (typeof raw !== "string" || raw.length === 0) return "fr";
  const parsed = localeSchema.safeParse(raw);
  return parsed.success ? parsed.data : "fr";
}

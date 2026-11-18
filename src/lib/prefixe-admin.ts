// Lecture UNIQUE du préfixe d'adresse de la console. Aucun import : ce fichier est
// chargé par le proxy et par la configuration d'authentification (runtime Edge).
//
// Refus par défaut : en production, sans variable `ADMIN_URL_PREFIX` (absente ou
// vide), il n'y a PAS de préfixe — on rend `null`, jamais une valeur de repli. Hors
// production, la valeur publique de développement sert de repli.

/** Valeur de repli de développement (publique, jamais utilisée en production). */
const PREFIXE_DEV_PAR_DEFAUT = "admin-dev-x7k2n9";

/** Segment rendu quand il n'y a pas de préfixe : ne correspond à aucune page. */
export const SEGMENT_CONSOLE_FERMEE = "console-fermee";

/**
 * Préfixe d'administration attendu, ou `null` si on doit tout refuser
 * (production sans variable d'environnement).
 */
export function prefixeAdminAttendu(): string | null {
  const brut = process.env["ADMIN_URL_PREFIX"];
  if (brut !== undefined && brut !== "") return brut;
  if (process.env["NODE_ENV"] === "production") return null;
  return PREFIXE_DEV_PAR_DEFAUT;
}

/** Segment à construire dans une adresse : le préfixe, ou la sentinelle si la console est fermée. */
export function segmentConsole(): string {
  return prefixeAdminAttendu() ?? SEGMENT_CONSOLE_FERMEE;
}

/**
 * Expression régulière « adresse de console » (`/fr|en/<préfixe>/…`), ou `null` si la
 * console est fermée : l'appelant traite alors toute adresse comme hors console.
 */
export function regexConsole(suffixe = "(?:/|$)"): RegExp | null {
  const prefixe = prefixeAdminAttendu();
  if (prefixe === null) return null;
  const echappe = prefixe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^/(fr|en)/${echappe}${suffixe}`);
}

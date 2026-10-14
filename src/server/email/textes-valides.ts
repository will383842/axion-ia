/**
 * Registre générique « texte validé par Will » (FAC-1, ADR 0066 (f)).
 *
 * Une ligne de `settings` par gabarit — et par VARIANTE quand un gabarit est
 * partagé (par exemple l'accusé de candidature : la variante d'un nouveau
 * public se valide à part, l'ancien texte continue de partir tant qu'elle ne
 * l'est pas). Clé `textes_valides.<gabarit>` ou `textes_valides.<gabarit>#<variante>`,
 * valeur `{ valide: true }`.
 *
 * 🔴 DÉFAUT = NON VALIDÉ. Ligne absente, illisible, ou portant autre chose que
 * `valide: true` exactement : le texte n'est pas validé. Une variante validée ne
 * vaut pas pour le gabarit, ni l'inverse.
 *
 * Écrit par la seule action `validerTexteEmailAction` (super-admin) ; ces clés
 * sont protégées de l'éditeur générique des réglages. Module pur (le worker
 * peut l'importer) ; la lecture en base est `lireTextesValides`.
 *
 * Prêt, non branché : aucun envoi existant ne le consulte aujourd'hui.
 */

export const PREFIXE_TEXTES_VALIDES = "textes_valides.";

const NOM = /^[a-z0-9][a-z0-9-]{0,99}$/;

export type RegistreTextesValides = ReadonlySet<string>;

export function cleTexteValide(gabarit: string, variante?: string): string {
  if (!NOM.test(gabarit)) throw new Error(`Nom de gabarit invalide : ${gabarit}`);
  if (variante !== undefined && !NOM.test(variante)) {
    throw new Error(`Nom de variante invalide : ${variante}`);
  }
  return `${PREFIXE_TEXTES_VALIDES}${gabarit}${variante !== undefined ? `#${variante}` : ""}`;
}

export function estNomValide(x: unknown): x is string {
  return typeof x === "string" && NOM.test(x);
}

/** `true` seulement pour `{ valide: true }`. */
export function lireValidation(brut: unknown): boolean {
  return (
    brut !== null &&
    typeof brut === "object" &&
    !Array.isArray(brut) &&
    (brut as Record<string, unknown>).valide === true
  );
}

/** Lot 8A — l'empreinte portée par une validation (`{ valide: true, empreinte }`), ou `null`. */
export function lireEmpreinte(brut: unknown): string | null {
  if (brut === null || typeof brut !== "object" || Array.isArray(brut)) return null;
  const e = (brut as Record<string, unknown>).empreinte;
  return typeof e === "string" && /^[0-9a-f]{64}$/.test(e) ? e : null;
}

/** Le registre à partir des lignes `settings` lues (n'importe quel ordre). */
export function textesValidesDepuisLignes(
  lignes: ReadonlyArray<{ key: string; value: unknown }>,
): RegistreTextesValides {
  const valides = new Set<string>();
  for (const l of lignes) {
    if (l.key.startsWith(PREFIXE_TEXTES_VALIDES) && lireValidation(l.value)) valides.add(l.key);
  }
  return valides;
}

export function estTexteValide(
  registre: RegistreTextesValides,
  gabarit: string,
  variante?: string,
): boolean {
  if (!estNomValide(gabarit) || (variante !== undefined && !estNomValide(variante))) return false;
  return registre.has(cleTexteValide(gabarit, variante));
}

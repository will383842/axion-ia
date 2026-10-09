/**
 * Offre « Formateur IA freelance » et passerelle depuis les offres salariées.
 *
 * Demande Will 2026-10-09 : sur les deux offres de formateur salarié, un encadré
 * invite les formateurs indépendants vers l'offre freelance, que l'on privilégie.
 * L'offre elle-même vit en base (console › Offres d'emploi) ; ce module ne fait
 * que nommer les slugs, pour que la page et son test les partagent.
 *
 * Module PUR (aucun import serveur).
 */

export const SLUG_OFFRE_FORMATEUR_FREELANCE = "formateur-ia-freelance";

/** Les offres de formateur SALARIÉ qui portent l'encadré vers l'offre freelance. */
export const SLUGS_OFFRES_FORMATEUR_SALARIE: readonly string[] = [
  "formateur-ia-itinerant",
  "formateur-ia-sedentaire",
];

export function porteEncadreFreelance(slug: string): boolean {
  return SLUGS_OFFRES_FORMATEUR_SALARIE.includes(slug);
}

/** Ce qu'une candidature dit de son poste — offre éventuelle et intitulé figé. */
export interface IndicesPosteCandidature {
  offerSlug: string | null | undefined;
  offerTitleSnap: string | null | undefined;
  employmentType: string | null | undefined;
  secondaryEmploymentType: string | null | undefined;
}

/** Le poste est celui d'un formateur ou d'une formatrice (slug ou intitulé figé). */
const RE_FORMATEUR = /\bformat(eur|rice)s?\b/i;
/** L'intitulé dit l'exercice indépendant. Sans `\b` initial : « é » n'est pas un mot pour `\b`. */
const RE_INDEPENDANT = /freelance|ind[ée]pendante?s?\b/i;

/**
 * Candidature de formateur FREELANCE (U2/U6, chantier « formateurs freelance »).
 *
 * Vrai si l'un des trois indices le dit :
 *   1. l'offre est l'offre freelance (`formateur-ia-freelance`), quel que soit
 *      le type de contrat saisi sur elle ;
 *   2. l'intitulé figé nomme un formateur ET l'exercice indépendant
 *      (« Formateur IA indépendant », « Formatrice freelance ») — c'est le seul
 *      indice d'une candidature spontanée, et il survit à la suppression de
 *      l'offre ;
 *   3. une offre de formateur en `CONTRACTOR` (type principal ou second).
 *
 * 🔑 Règle UNIQUE : la fiche formateur (U6) et tout autre lot qui doit
 * distinguer le freelance la lisent ici, jamais une copie.
 */
export function estCandidatureFormateurFreelance(c: IndicesPosteCandidature): boolean {
  if (c.offerSlug === SLUG_OFFRE_FORMATEUR_FREELANCE) return true;
  const titre = c.offerTitleSnap ?? "";
  const formateur =
    RE_FORMATEUR.test(titre) || (c.offerSlug != null && /^format(eur|rice)\b/.test(c.offerSlug));
  if (!formateur) return false;
  if (RE_INDEPENDANT.test(titre)) return true;
  return c.employmentType === "CONTRACTOR" || c.secondaryEmploymentType === "CONTRACTOR";
}

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

// Échafaudage U6 (premier commit, tests rouges) : la règle arrive au commit suivant.
export function estCandidatureFormateurFreelance(_c: IndicesPosteCandidature): boolean {
  return false;
}

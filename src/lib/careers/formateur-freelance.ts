/**
 * Offre « Formateur IA freelance » et passerelle depuis les offres salariées.
 *
 * Demande Will 2026-10-09 : sur les deux offres de formateur salarié, un encadré
 * invite les formateurs indépendants vers l'offre freelance, que l'on privilégie.
 * L'offre elle-même vit en base (console › Offres d'emploi) ; ce module nomme
 * les slugs, pour que la page et son test les partagent, et porte le prédicat
 * `estCandidatureFormateurFreelance` (lot U2).
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

/**
 * Mots qui, ensemble, disent « formateur indépendant » dans un intitulé.
 * Exportés pour que les filtres SQL (`reponse-poste-pourvu.ts`) écrivent la
 * même règle que le prédicat : ILIKE ne replie pas les accents, d'où les deux
 * graphies d'« indépendant ».
 */
export const MOTS_FORMATEUR = ["formateur", "formatrice"] as const;
export const MOTS_FREELANCE = ["freelance", "indépendant", "independant"] as const;

/** Type schema.org d'une offre de sous-traitance. */
export const EMPLOI_CONTRACTOR = "CONTRACTOR";

type OffreLue = {
  readonly slug?: string | null;
  readonly titleFr?: string | null;
  readonly employmentType?: string | null;
  readonly secondaryEmploymentType?: string | null;
};
type CandidatureLue = {
  readonly offerTitleSnap?: string | null;
  readonly offer?: OffreLue | null;
};

function plie(v: string | null | undefined): string {
  return (v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const contientUn = (texte: string, mots: readonly string[]) =>
  mots.some((m) => texte.includes(plie(m)));

/**
 * LE prédicat « candidature de formateur FREELANCE » (lot U2, 2026-10-09) —
 * reçoit une candidature, une offre ou un simple intitulé. Vrai si :
 *  · l'offre est `formateur-ia-freelance` ;
 *  · un intitulé (figé sur la candidature, ou celui de l'offre) ou le slug dit
 *    « formateur|formatrice » ET « freelance|indépendant » — candidature
 *    spontanée, copie de l'offre ;
 *  · l'offre est une offre de formateur déclarée CONTRACTOR.
 * « Formateur IA en entreprise (itinérant) » (salarié) et « travail
 * indépendant » (sans le mot formateur) restent dehors.
 */
export function estCandidatureFormateurFreelance(
  entree: string | CandidatureLue | OffreLue | null | undefined,
): boolean {
  if (!entree) return false;
  if (typeof entree === "string") {
    const t = plie(entree);
    return contientUn(t, MOTS_FORMATEUR) && contientUn(t, MOTS_FREELANCE);
  }
  const offre: OffreLue | null | undefined =
    "offerTitleSnap" in entree || "offer" in entree
      ? (entree as CandidatureLue).offer
      : (entree as OffreLue);
  if (offre?.slug === SLUG_OFFRE_FORMATEUR_FREELANCE) return true;
  const textes = [
    (entree as CandidatureLue).offerTitleSnap,
    offre?.titleFr,
    offre?.slug?.replace(/-/g, " "),
  ].map(plie);
  const formateur = textes.some((t) => contientUn(t, MOTS_FORMATEUR));
  if (!formateur) return false;
  if (textes.some((t) => contientUn(t, MOTS_FORMATEUR) && contientUn(t, MOTS_FREELANCE))) {
    return true;
  }
  return (
    offre?.employmentType === EMPLOI_CONTRACTOR ||
    offre?.secondaryEmploymentType === EMPLOI_CONTRACTOR
  );
}

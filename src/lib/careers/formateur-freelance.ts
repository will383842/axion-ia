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

// ─── Lot L0g — la NATURE de l'offre (`JobOffer.natureCollaboration`) ──────────
//
// « Freelance » ou « salarié » se lit sur l'offre, choisi dans la console, et
// plus dans son slug ni dans son type schema.org (chaîne libre, faite pour
// Google). Livré ÉTEINT : `natureLue` vient de l'interrupteur
// `formateurs.nature_offre` ; faux = le prédicat d'aujourd'hui, au résultat près.

export type NatureCollaborationOffre = "salarie" | "freelance";

type OffreAvecNature = OffreLue & {
  readonly natureCollaboration?: NatureCollaborationOffre | null | undefined;
};

/** Une offre de FORMATEUR (slug ou intitulé), sans rien dire du statut. */
function estOffreDeFormateur(offre: OffreLue): boolean {
  return [offre.titleFr, offre.slug?.replace(/-/g, " ")]
    .map(plie)
    .some((t) => contientUn(t, MOTS_FORMATEUR));
}

/**
 * LE point de décision « offre de formateur freelance ».
 *
 * Allumé : la colonne ET une offre de formateur. Colonne non lue (sélection
 * Prisma sans elle, ou fenêtre où le code neuf tourne sur l'ancienne base) :
 * le prédicat d'aujourd'hui, jamais « salarié » par défaut.
 *
 * ⚠️ Écart voulu : le filtre de la réponse automatique (`critereEligible`)
 * écarte, lui, TOUTE offre freelance, de formateur ou non — une mission n'est
 * jamais « pourvue ». Ce prédicat-ci ne parle que des formateurs.
 */
export function estOffreFormateurFreelance(
  offre: OffreAvecNature,
  options: { readonly natureLue: boolean },
): boolean {
  if (!options.natureLue || offre.natureCollaboration == null) {
    return estCandidatureFormateurFreelance(offre);
  }
  return offre.natureCollaboration === "freelance" && estOffreDeFormateur(offre);
}

/**
 * La nature que le remplissage du schéma n° 1 aurait posée
 * (`SQL_REMPLIR_NATURE_OFFRES`) : le prédicat appliqué à l'offre.
 */
export function natureCollaborationDeduite(offre: OffreLue): NatureCollaborationOffre {
  return estCandidatureFormateurFreelance(offre) ? "freelance" : "salarie";
}

const declareContractor = (o: OffreLue) =>
  o.employmentType === EMPLOI_CONTRACTOR || o.secondaryEmploymentType === EMPLOI_CONTRACTOR;

/**
 * La nature à écrire quand la console enregistre une offre.
 *
 * Éteint : la nature déduite (le choix d'un formulaire forgé est ignoré), sans
 * jamais redescendre de « freelance » à « salarié » — la colonne n'est lue par
 * rien tant que c'est éteint, mais elle doit être juste le jour de l'allumage.
 *
 * Allumé : le choix est exigé ; « freelance » exige le type CONTRACTOR (Google
 * doit voir la même chose que nos règles) ; une offre freelance qui a déjà des
 * candidatures ne repasse pas en salarié (leurs candidats sont des
 * indépendants).
 */
export function natureAEnregistrer(e: {
  readonly natureLue: boolean;
  readonly offre: OffreLue;
  readonly actuelle: NatureCollaborationOffre | null;
  readonly demandee?: NatureCollaborationOffre | null | undefined;
  readonly aDesCandidatures?: boolean | undefined;
}): { ok: true; nature: NatureCollaborationOffre } | { ok: false; error: string } {
  if (!e.natureLue) {
    const deduite = natureCollaborationDeduite(e.offre);
    return { ok: true, nature: e.actuelle === "freelance" ? "freelance" : deduite };
  }
  if (e.demandee !== "freelance" && e.demandee !== "salarie") {
    return { ok: false, error: "Choisissez la nature de la collaboration : freelance ou salarié." };
  }
  if (e.demandee === "freelance" && !declareContractor(e.offre)) {
    return {
      ok: false,
      error:
        "Une offre freelance se déclare aussi « Prestataire / freelance » dans le type de contrat (Google), en premier ou en second type.",
    };
  }
  if (e.actuelle === "freelance" && e.demandee === "salarie" && e.aDesCandidatures) {
    return {
      ok: false,
      error:
        "Cette offre freelance a déjà des candidatures : elle ne peut pas repasser en salarié. Dupliquez-la plutôt.",
    };
  }
  return { ok: true, nature: e.demandee };
}

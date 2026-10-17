// Les vraies étapes d'une candidature d'INTERVENANT (formateur), et la mention
// Qualiopi qui les accompagne — lot L14 du chantier « levée des non-conformités »
// (NC9 ind. 21, NC13 ind. 27).
//
// 🔴 Pourquoi ce module existe. Les textes des offres promettaient ce que
// l'organisme ne fait pas : « en doublon avec un formateur expérimenté »,
// « accompagné·e par l'équipe », « CV optionnel ». Un auditeur compare ces
// promesses à la pratique. La pratique, elle, est écrite ici UNE fois, et chaque
// surface (page d'offre, FAQ, accusé de réception) la lit d'ici : un seul texte,
// donc un seul endroit à relire.
//
// ⚠️ Lexique. La mention dit « l'obtention de la certification Qualiopi » — on
// n'écrit JAMAIS « certifié » : tant que la certification n'est pas obtenue,
// l'écrire serait une fausse déclaration (verrouillé par le test voisin).
//
// Module PUR : aucune dépendance serveur, importable par le client comme par l'e-mail.

import { estOffreDeFormateur } from "./formateur-freelance";

export type Langue = "fr" | "en";

export interface EtapeIntervenant {
  readonly id: string;
  readonly fr: string;
  readonly en: string;
}

/**
 * Les étapes, dans l'ordre où le candidat les traverse. Ni délai ni promesse
 * d'issue : seules des étapes que l'organisme réalise réellement.
 */
export const ETAPES_INTERVENANT: readonly EtapeIntervenant[] = [
  {
    id: "candidature",
    fr: "Votre candidature en ligne.",
    en: "Your online application.",
  },
  {
    id: "entretien",
    fr: "Un entretien, noté sur une grille identique pour tous les candidats.",
    en: "An interview, scored on the same grid for every candidate.",
  },
  {
    id: "mise-en-situation",
    fr: "Une mise en situation d'animation, également notée.",
    en: "A teaching simulation, also scored.",
  },
  {
    id: "pieces",
    fr: "La vérification de vos pièces : SIRET, déclaration d'activité et CV de moins de 24 mois.",
    en: "Checking your documents: SIRET number, declaration of activity and a CV under 24 months old.",
  },
  {
    id: "formation-methode",
    fr: "Une formation obligatoire à la méthode Axion-IA, avant toute première mission.",
    en: "Mandatory training in the Axion-IA method, before any first assignment.",
  },
  {
    id: "observation",
    fr: "L'observation de votre première mission.",
    en: "Observation of your first assignment.",
  },
  {
    id: "evaluation",
    fr: "Une évaluation après chaque mission.",
    en: "An evaluation after every assignment.",
  },
] as const;

/** Variante salariée : pas de SIRET ni de déclaration d'activité à vérifier. */
const PIECES_SALARIE: EtapeIntervenant = {
  id: "pieces",
  fr: "La vérification de vos pièces, dont un CV de moins de 24 mois.",
  en: "Checking your documents, including a CV under 24 months old.",
};

export function etapesIntervenant(opts?: {
  readonly freelance?: boolean;
}): readonly EtapeIntervenant[] {
  if (opts?.freelance === false) {
    return ETAPES_INTERVENANT.map((e) => (e.id === "pieces" ? PIECES_SALARIE : e));
  }
  return ETAPES_INTERVENANT;
}

/** La mention Qualiopi — jamais « certifié ». */
export const MENTION_AUCUNE_MISSION_AVANT_QUALIOPI = {
  fr: "Aucune mission ne sera confiée avant l'obtention de la certification Qualiopi de l'organisme.",
  en: "No assignment will be given before the organisation obtains its Qualiopi certification.",
} as const;

/** Chapeau des étapes. */
export const TITRE_ETAPES_INTERVENANT = {
  fr: "Les étapes, de la candidature à la première mission",
  en: "The steps, from application to first assignment",
} as const;

/**
 * Phrase de FAQ / de page : les étapes en une ligne, puis la mention.
 *
 * La mention parle d'une certification « à obtenir » : une fois le certificat
 * délivré (`certificationObtenue`), elle ne dit plus rien de vrai et disparaît.
 */
export function phraseEtapesIntervenant(
  langue: Langue,
  opts?: { readonly freelance?: boolean; readonly certificationObtenue?: boolean },
): string {
  const etapes = etapesIntervenant(opts)
    .map((e, i) => `${i + 1}. ${e[langue]}`)
    .join(" ");
  return opts?.certificationObtenue === true
    ? etapes
    : `${etapes} ${MENTION_AUCUNE_MISSION_AVANT_QUALIOPI[langue]}`;
}

/**
 * Cette offre est-elle une offre d'INTERVENANT (formateur), freelance ou salariée ?
 * Même lecture que le reste du module carrières : intitulé ou slug.
 */
export function estOffreIntervenant(
  offre:
    | {
        readonly slug?: string | null;
        readonly titleFr?: string | null;
        readonly employmentType?: string | null;
        readonly secondaryEmploymentType?: string | null;
      }
    | null
    | undefined,
): boolean {
  return offre ? estOffreDeFormateur(offre) : false;
}

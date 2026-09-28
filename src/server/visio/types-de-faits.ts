/**
 * Types de faits — SOURCE UNIQUE (chantier visio, ADR 0053 ;
 * `compte-rendu-et-extraction.md` §2.3, amendée par le plan §3.3 d).
 *
 * Pour chaque valeur de l'énumération Prisma `FaitType`, cette table dit :
 *   · la rubrique du compte rendu où le fait se range ;
 *   · sa cardinalité (`unique` : une valeur courante par périmètre, clé
 *     forcée à « global » ; `multiple` : une liste) ;
 *   · les portées admises et la portée par défaut ;
 *   · qui peut l'avoir dit (le client ; Williams, seul ou seulement confirmé
 *     par le client dans les 90 secondes) ;
 *   · les certitudes admises (`deduit` n'est permis que pour trois types) ;
 *   · s'il se SUIT (engagement tenu, question répondue…) ;
 *   · s'il se valide UN PAR UN (exclu du bouton « Valider tous »).
 *
 * Tout ce qui en dépend en est DÉRIVÉ, jamais recopié : le CHECK
 * `faits_suivi_types_suivables` de la migration (produit par
 * `prisma/objets-sql-bruts.ts`), et plus tard le schéma JSON envoyé à l'IA,
 * les consignes et l'écran. Deux gardes le tiennent :
 *   · `src/server/visio/__tests__/le-check-du-suivi-suit-la-constante-des-types.spec.ts`
 *   · la même spec vérifie que les clés couvrent EXACTEMENT l'énumération.
 *
 * Module PUR : aucun import d'exécution.
 */

import type { FaitCertitude, FaitType } from "../../../prisma/generated/client";

/** Qui peut avoir prononcé la phrase qui prouve le fait. */
export interface LocuteursAdmis {
  /** Une phrase de la piste client suffit. */
  readonly client: boolean;
  /**
   * Williams : `jamais` ; `avec_confirmation` = sa phrase ET une seconde preuve
   * sur la piste client dans les 90 s (« donc vous êtes douze ? » / « oui,
   * douze ») ; `oui` = sa phrase suffit (ses propres engagements, ses prix).
   */
  readonly axion: "jamais" | "avec_confirmation" | "oui";
}

export type PorteeRangee = "entreprise" | "projet";

export interface MetaTypeDeFait {
  /** Rubrique du compte rendu (§2.2 du gabarit), ou « divers ». */
  readonly rubrique: number | "divers";
  readonly cardinalite: "unique" | "multiple";
  readonly porteesAdmises: readonly PorteeRangee[];
  readonly porteeParDefaut: PorteeRangee;
  readonly locuteurs: LocuteursAdmis;
  readonly certitudesAdmises: readonly FaitCertitude[];
  /** Le fait appelle un suivi (`FaitSuivi`) : tenu, répondu, levé… */
  readonly suivable: boolean;
  /** Exclu de « Valider tous » : Will le valide un par un. */
  readonly valideUnParUn: boolean;
}

// Certitudes de base. `rapporte_par_williams` couvre la dictée et la note
// manuelle : c'est Williams qui rapporte, quel que soit le type.
const DIT = ["dit_explicitement", "rapporte_par_williams"] as const;
const DIT_OU_CONFIRME = [
  "dit_explicitement",
  "confirme_sur_reformulation",
  "rapporte_par_williams",
] as const;
const DIT_CONFIRME_OU_DEDUIT = [
  "dit_explicitement",
  "confirme_sur_reformulation",
  "deduit",
  "rapporte_par_williams",
] as const;

const CLIENT_SEUL: LocuteursAdmis = { client: true, axion: "jamais" };
const CLIENT_OU_CONFIRME: LocuteursAdmis = { client: true, axion: "avec_confirmation" };
const AXION_SEUL: LocuteursAdmis = { client: false, axion: "oui" };
const LES_DEUX: LocuteursAdmis = { client: true, axion: "oui" };

const ENTREPRISE = ["entreprise"] as const;
const PROJET = ["projet"] as const;
const LES_DEUX_PORTEES = ["entreprise", "projet"] as const;

/**
 * La table. `satisfies Record<FaitType, …>` : un type ajouté à l'énumération
 * sans ligne ici ne compile pas.
 */
export const TYPES_DE_FAITS = {
  info_societe: {
    rubrique: 1,
    cardinalite: "multiple",
    porteesAdmises: ENTREPRISE,
    porteeParDefaut: "entreprise",
    locuteurs: CLIENT_OU_CONFIRME,
    certitudesAdmises: DIT_CONFIRME_OU_DEDUIT,
    suivable: false,
    valideUnParUn: false,
  },
  activite: {
    rubrique: 1,
    cardinalite: "unique",
    porteesAdmises: ENTREPRISE,
    porteeParDefaut: "entreprise",
    locuteurs: CLIENT_OU_CONFIRME,
    certitudesAdmises: DIT_CONFIRME_OU_DEDUIT,
    suivable: false,
    valideUnParUn: false,
  },
  effectif: {
    rubrique: 1,
    cardinalite: "unique",
    porteesAdmises: ENTREPRISE,
    porteeParDefaut: "entreprise",
    locuteurs: CLIENT_OU_CONFIRME,
    certitudesAdmises: DIT_OU_CONFIRME,
    suivable: false,
    valideUnParUn: false,
  },
  outil_utilise: {
    rubrique: 1,
    cardinalite: "multiple",
    porteesAdmises: ENTREPRISE,
    porteeParDefaut: "entreprise",
    locuteurs: CLIENT_OU_CONFIRME,
    certitudesAdmises: DIT_OU_CONFIRME,
    suivable: false,
    valideUnParUn: false,
  },
  niveau_ia: {
    rubrique: 1,
    cardinalite: "unique",
    porteesAdmises: LES_DEUX_PORTEES,
    porteeParDefaut: "entreprise",
    locuteurs: CLIENT_OU_CONFIRME,
    certitudesAdmises: DIT_CONFIRME_OU_DEDUIT,
    suivable: false,
    valideUnParUn: false,
  },
  decideur: {
    rubrique: 2,
    cardinalite: "unique",
    porteesAdmises: PROJET,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_SEUL,
    certitudesAdmises: DIT_OU_CONFIRME,
    suivable: false,
    valideUnParUn: true,
  },
  processus_decision: {
    rubrique: 2,
    cardinalite: "multiple",
    porteesAdmises: PROJET,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_SEUL,
    certitudesAdmises: DIT,
    suivable: false,
    valideUnParUn: false,
  },
  mise_en_relation: {
    rubrique: 2,
    cardinalite: "multiple",
    porteesAdmises: LES_DEUX_PORTEES,
    porteeParDefaut: "entreprise",
    locuteurs: CLIENT_SEUL,
    certitudesAdmises: DIT,
    suivable: false,
    // Il nomme un tiers qui recommande : jamais validé en lot, et rien n'est
    // envoyé à Axion Partners.
    valideUnParUn: true,
  },
  probleme: {
    rubrique: 3,
    cardinalite: "multiple",
    porteesAdmises: PROJET,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_SEUL,
    certitudesAdmises: DIT_OU_CONFIRME,
    suivable: false,
    valideUnParUn: false,
  },
  besoin: {
    rubrique: 4,
    cardinalite: "multiple",
    porteesAdmises: PROJET,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_SEUL,
    certitudesAdmises: DIT_OU_CONFIRME,
    suivable: false,
    valideUnParUn: false,
  },
  objectif: {
    rubrique: 4,
    cardinalite: "multiple",
    porteesAdmises: PROJET,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_SEUL,
    certitudesAdmises: DIT,
    suivable: false,
    valideUnParUn: false,
  },
  public_cible: {
    rubrique: 5,
    cardinalite: "multiple",
    porteesAdmises: PROJET,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_OU_CONFIRME,
    certitudesAdmises: DIT_OU_CONFIRME,
    suivable: false,
    valideUnParUn: false,
  },
  nb_participants: {
    rubrique: 5,
    cardinalite: "unique",
    porteesAdmises: PROJET,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_OU_CONFIRME,
    certitudesAdmises: DIT_OU_CONFIRME,
    suivable: false,
    valideUnParUn: false,
  },
  modalite_souhaitee: {
    rubrique: 5,
    cardinalite: "multiple",
    porteesAdmises: PROJET,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_OU_CONFIRME,
    certitudesAdmises: DIT_OU_CONFIRME,
    suivable: false,
    valideUnParUn: false,
  },
  lieu_intervention: {
    rubrique: 5,
    cardinalite: "unique",
    porteesAdmises: PROJET,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_OU_CONFIRME,
    certitudesAdmises: DIT_OU_CONFIRME,
    suivable: false,
    valideUnParUn: false,
  },
  contrainte: {
    rubrique: 5,
    cardinalite: "multiple",
    porteesAdmises: LES_DEUX_PORTEES,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_SEUL,
    certitudesAdmises: DIT,
    suivable: false,
    valideUnParUn: false,
  },
  budget: {
    rubrique: 6,
    cardinalite: "unique",
    porteesAdmises: PROJET,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_SEUL,
    certitudesAdmises: DIT_OU_CONFIRME,
    suivable: false,
    valideUnParUn: true,
  },
  financement: {
    rubrique: 6,
    cardinalite: "unique",
    porteesAdmises: PROJET,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_OU_CONFIRME,
    certitudesAdmises: DIT_OU_CONFIRME,
    suivable: false,
    valideUnParUn: false,
  },
  echeance: {
    rubrique: 7,
    cardinalite: "unique",
    porteesAdmises: PROJET,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_OU_CONFIRME,
    certitudesAdmises: DIT_OU_CONFIRME,
    suivable: false,
    valideUnParUn: false,
  },
  objection: {
    rubrique: 8,
    cardinalite: "multiple",
    porteesAdmises: LES_DEUX_PORTEES,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_SEUL,
    certitudesAdmises: DIT,
    suivable: true,
    valideUnParUn: false,
  },
  concurrent: {
    rubrique: 8,
    cardinalite: "multiple",
    porteesAdmises: PROJET,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_SEUL,
    certitudesAdmises: DIT,
    suivable: false,
    valideUnParUn: false,
  },
  engagement_axion: {
    rubrique: 9,
    cardinalite: "multiple",
    porteesAdmises: LES_DEUX_PORTEES,
    porteeParDefaut: "projet",
    locuteurs: AXION_SEUL,
    certitudesAdmises: DIT,
    suivable: true,
    valideUnParUn: false,
  },
  engagement_client: {
    rubrique: 9,
    cardinalite: "multiple",
    porteesAdmises: LES_DEUX_PORTEES,
    porteeParDefaut: "projet",
    locuteurs: CLIENT_SEUL,
    certitudesAdmises: DIT,
    suivable: true,
    valideUnParUn: false,
  },
  prix_annonce_axion: {
    rubrique: 9,
    cardinalite: "multiple",
    porteesAdmises: PROJET,
    porteeParDefaut: "projet",
    locuteurs: AXION_SEUL,
    certitudesAdmises: DIT,
    suivable: false,
    valideUnParUn: false,
  },
  offre_envisagee: {
    rubrique: 10,
    cardinalite: "multiple",
    porteesAdmises: PROJET,
    porteeParDefaut: "projet",
    locuteurs: LES_DEUX,
    certitudesAdmises: DIT,
    suivable: false,
    valideUnParUn: false,
  },
  question_ouverte: {
    rubrique: 11,
    cardinalite: "multiple",
    porteesAdmises: LES_DEUX_PORTEES,
    porteeParDefaut: "projet",
    locuteurs: LES_DEUX,
    certitudesAdmises: DIT,
    suivable: true,
    valideUnParUn: false,
  },
  question_client_repondue: {
    rubrique: 11,
    cardinalite: "multiple",
    porteesAdmises: LES_DEUX_PORTEES,
    porteeParDefaut: "projet",
    locuteurs: LES_DEUX,
    certitudesAdmises: DIT,
    suivable: false,
    valideUnParUn: false,
  },
  prochaine_etape: {
    rubrique: 13,
    cardinalite: "unique",
    porteesAdmises: LES_DEUX_PORTEES,
    porteeParDefaut: "projet",
    locuteurs: LES_DEUX,
    certitudesAdmises: DIT,
    suivable: true,
    valideUnParUn: false,
  },
  autre: {
    rubrique: "divers",
    cardinalite: "multiple",
    porteesAdmises: ENTREPRISE,
    porteeParDefaut: "entreprise",
    locuteurs: LES_DEUX,
    certitudesAdmises: DIT,
    suivable: false,
    valideUnParUn: false,
  },
} as const satisfies Record<FaitType, MetaTypeDeFait>;

/** Les types qui se suivent — dérivé, dans l'ordre de la table. */
export const TYPES_SUIVABLES: readonly FaitType[] = (
  Object.keys(TYPES_DE_FAITS) as FaitType[]
).filter((t) => TYPES_DE_FAITS[t].suivable);

/** Les types exclus de « Valider tous » — dérivé. */
export const TYPES_VALIDES_UN_PAR_UN: readonly FaitType[] = (
  Object.keys(TYPES_DE_FAITS) as FaitType[]
).filter((t) => TYPES_DE_FAITS[t].valideUnParUn);

/** Les types pour lesquels une déduction est permise — dérivé. */
export const TYPES_DEDUCTIBLES: readonly FaitType[] = (
  Object.keys(TYPES_DE_FAITS) as FaitType[]
).filter((t) => (TYPES_DE_FAITS[t].certitudesAdmises as readonly string[]).includes("deduit"));

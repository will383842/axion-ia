/**
 * Qualiopi — Référentiel OPCO (module PUR, Lot 5).
 *
 * Liste canonique des 11 OPCO agréés + libellés d'affichage + garde de type.
 * Aucun import Prisma/next : importable par seeds, tests, UI et workers.
 *
 * ⚠️ Les identifiants DOIVENT rester identiques à l'enum Prisma `Opco` et aux
 * valeurs émises par `inferOpcoFromNaf` (naf-opco.ts). Les 5 premiers
 * (atlas, akto, opco2i, constructys, opcommerce) sont déjà en base via
 * `Client.opcoIdentifie` — ne PAS les renommer.
 */

/** Les 11 OPCO agréés (2026). Ordre d'affichage. */
export const OPCO_IDS = [
  "atlas",
  "opco_ep",
  "akto",
  "opco2i",
  "mobilites",
  "afdas",
  "uniformation",
  "ocapiat",
  "constructys",
  "opcommerce",
  "opco_sante",
] as const;

export type OpcoId = (typeof OPCO_IDS)[number];

/** Libellés d'affichage FR (SERP/console). */
export const OPCO_LABELS: Record<OpcoId, string> = {
  atlas: "Atlas",
  opco_ep: "OPCO EP",
  akto: "Akto",
  opco2i: "OPCO 2i",
  mobilites: "OPCO Mobilités",
  afdas: "Afdas",
  uniformation: "Uniformation",
  ocapiat: "Ocapiat",
  constructys: "Constructys",
  opcommerce: "OPCOMMERCE",
  opco_sante: "OPCO Santé",
};

/** Garde de type : vrai si la chaîne est un identifiant OPCO connu. */
export function isOpcoId(value: string | null | undefined): value is OpcoId {
  return value != null && (OPCO_IDS as readonly string[]).includes(value);
}

/** Libellé d'affichage ; renvoie la chaîne brute si l'OPCO est inconnu. */
export function opcoLabel(id: string | null | undefined): string {
  return isOpcoId(id) ? OPCO_LABELS[id] : (id ?? "—");
}

/** Les deux champs OPCO d'un client : typé (A1) et ancien texte libre. */
export interface OpcoClient {
  opco?: string | null;
  opcoIdentifie?: string | null;
}

/**
 * L'OPCO d'un client — UNE règle pour toutes les lectures : l'OPCO typé
 * d'abord ; à défaut, l'ancien texte libre s'il est un identifiant connu.
 *
 * 🔴 Lot A7a : la console porte DEUX champs (`opco` typé, vide sur les fiches
 * antérieures au 2026-10-03 ; `opcoIdentifie`, écrit par l'inférence). Lire l'un
 * sans l'autre rend une brique aveugle sur la moitié des clients : toute lecture
 * passe par ici (garde `tests/unit/ci/un-seul-opco-par-client.spec.ts`).
 */
export function opcoDuClient(client: OpcoClient | null | undefined): OpcoId | null {
  if (isOpcoId(client?.opco)) return client.opco;
  // `trim()` : une saisie « atlas » entourée d'espaces reste reconnue (relecture A7a).
  const libre = client?.opcoIdentifie?.trim();
  return isOpcoId(libre) ? libre : null;
}

/** Nom affiché, même règle ; un texte libre non reconnu est repris tel quel. */
export function nomOpcoDuClient(client: OpcoClient | null | undefined): string {
  const id = opcoDuClient(client);
  if (id) return OPCO_LABELS[id];
  const libre = client?.opcoIdentifie?.trim();
  return libre ? libre : "OPCO (à préciser)";
}

/**
 * Ce que la fiche dit de son OPCO, même règle : l'identifiant reconnu, sinon le
 * texte libre tel quel (« Mon OPCO »), sinon `null`. Sert de clé de
 * regroupement et à savoir si un OPCO est renseigné du tout, y compris quand il
 * n'est pas (encore) l'un des 11.
 */
export function referenceOpcoDuClient(client: OpcoClient | null | undefined): string | null {
  const id = opcoDuClient(client);
  if (id) return id;
  const libre = client?.opcoIdentifie?.trim();
  return libre ? libre : null;
}

/**
 * Un barème est « périmé » si son relevé portail (`releveLe`) date de plus de
 * `moisValidite` mois par rapport à `now`. Un barème sans `releveLe` est traité
 * comme périmé (relevé jamais horodaté → non fiable pour un auditeur).
 *
 * Module pur : réutilisé par l'alerte `bareme_opco_perime` et par le badge UI.
 */
export function estBaremePerime(
  releveLe: Date | null | undefined,
  moisValidite: number,
  now: Date = new Date(),
): boolean {
  if (releveLe == null) return true;
  const seuil = new Date(now);
  // Soustraction de mois avec CLAMP du jour au dernier jour du mois cible : évite
  // le débordement JS (`31 mars` − 1 mois → `31 février` → `3 mars`), qui fausserait
  // le seuil de quelques jours en fin de mois.
  const jour = seuil.getDate();
  seuil.setDate(1);
  seuil.setMonth(seuil.getMonth() - moisValidite);
  const dernierJour = new Date(seuil.getFullYear(), seuil.getMonth() + 1, 0).getDate();
  seuil.setDate(Math.min(jour, dernierJour));
  return releveLe.getTime() < seuil.getTime();
}

// ---------------------------------------------------------------------------
// Fiches OPCO sourcées (Lot A2)
// ---------------------------------------------------------------------------

/**
 * Un fait relevé sur une source publique. `valeur === null` = non trouvé ou non
 * confirmé : on n'invente rien. `aVerifier` signale un fait à reconfirmer par
 * un humain (source non ouverte, ou page qui ne confirme pas le relevé).
 */
export type Fait<T> = {
  valeur: T | null;
  source: string | null;
  /** Date du relevé, AAAA-MM-JJ. */
  releveLe: string;
  aVerifier?: boolean;
};

/**
 * Qui dépose la demande de prise en charge, tel que constaté sur la source
 * (INT-T64-A) : l'organisme de formation mandaté par l'entreprise, ou
 * l'entreprise depuis son compte adhérent sur le portail de l'OPCO.
 *
 * Un ENUM à deux valeurs, jamais un booléen. Il vit ici et pas en base : aucune
 * table ne porte l'OPCO comme entité (l'enum Prisma `Opco` n'est qu'une clé), et
 * la valeur est un fait sourcé de `OPCO_FICHES`, pas une saisie. L'absence de
 * relevé est `valeur: null` (« non constaté »), pas une troisième valeur.
 */
export const MODES_DE_DEPOT = ["of_mandate", "compte_adherent"] as const;

export type ModeDeDepot = (typeof MODES_DE_DEPOT)[number];

/** Garde de type : vrai si la valeur est l'un des deux modes de dépôt. */
export function isModeDeDepot(value: unknown): value is ModeDeDepot {
  return typeof value === "string" && (MODES_DE_DEPOT as readonly string[]).includes(value);
}

export type OpcoFiche = {
  portailEntrepriseUrl: Fait<string>;
  portailOfUrl: Fait<string>;
  /** Jours minimum entre le dépôt et le début de la formation. */
  delaiDepotJours: Fait<number>;
  /** Jours maximum après la fin de la formation pour facturer. */
  delaiFacturationJours: Fait<number>;
  /** Date limite de dépôt pour l'exercice 2026, AAAA-MM-JJ. */
  dateLimiteDepot2026: Fait<string>;
  opcoHorsChampTva: Fait<boolean>;
  modeDeDepotConstate: Fait<ModeDeDepot>;
};

const RELEVE = "2026-10-03";

const SRC_TVA = "https://www.akto.fr/content/uploads/2025/12/CPcommunOpcos_TVA.pdf";
const SRC_ATLAS = "https://www.opco-atlas.fr/conditions-generales.html";
const SRC_OPCOEP_CG =
  "https://www.opcoep.fr/ressources/centre-ressources/juridique/conditions-generales-gestion-controle-opcoep.pdf";
const SRC_AKTO_DEPOT = "https://www.akto.fr/entreprise/financer-une-formation/deposer-demande";
const SRC_CONSTRUCTYS_CG =
  "https://www.constructys.fr/wp-content/uploads/Conditions-generales-Constructys.pdf";
const SRC_CONSTRUCTYS =
  "https://www.constructys.fr/financer-vos-projets-de-formation/modalites-demandes-de-prise-charge/conditions-de-prise-en-charge-2/";
const SRC_OPCOMMERCE = "https://www.lopcommerce.com/media/bsbnjydz/conditons-generales-gestion.pdf";
const SRC_MOBILITES =
  "https://www.opcomobilites.fr/actualites/detail/calendrier-de-prise-en-charge-des-actions-de-formation-rappels-importants";
const SRC_OPCO2I_CHARTE =
  "https://www.opco2i.fr/wp-content/uploads/2026/04/opco2i-charte-qualite-et-politique-de-controle-juin-2026.pdf";
const SRC_OCAPIAT_BOOST =
  "https://www.ocapiat.fr/wp-content/uploads/fiche-de-presentation-BOOST-COMPETENCES-OCAPIAT.pdf";

function confirme<T>(valeur: T, source: string): Fait<T> {
  return { valeur, source, releveLe: RELEVE };
}

function inconnu<T>(): Fait<T> {
  return { valeur: null, source: null, releveLe: RELEVE, aVerifier: true };
}

/** Communiqué commun des 11 OPCO du 22/12/2025 : seuls Opco Santé et Uniformation restent hors champ. */
function tva(horsChamp: boolean): Fait<boolean> {
  return confirme(horsChamp, SRC_TVA);
}

function ficheVide(horsChampTva: boolean): OpcoFiche {
  return {
    portailEntrepriseUrl: inconnu(),
    portailOfUrl: inconnu(),
    delaiDepotJours: inconnu(),
    delaiFacturationJours: inconnu(),
    dateLimiteDepot2026: inconnu(),
    opcoHorsChampTva: tva(horsChampTva),
    modeDeDepotConstate: inconnu(),
  };
}

/**
 * Référentiel des règles de dépôt et de facturation des 11 OPCO, relevé le
 * 2026-10-03. Les règles varient par branche et par dispositif : un fait
 * renseigné est la règle générale de la source citée, pas une garantie pour
 * un dossier donné.
 *
 * `modeDeDepotConstate` (INT-T64-A) : Atlas, OPCO 2i, Akto et Constructys sont
 * constatés (Akto et Constructys lus le 2026-10-04 depuis le poste de b0, la
 * session cloud n'ayant pas accès aux sites des OPCO). Les sept autres restent
 * « non constatés » : page non lue, ou règle écrite qui laisse les deux circuits
 * ouverts (OPCO EP : « par une entreprise ou un prestataire de formation »).
 * Rien n'est deviné. ⚠️ `compte_adherent` déclenche l'envoi
 * automatique du dossier à l'entreprise (suivi-entreprise/planning.ts) : ne le
 * poser que sur une page de l'OPCO lue et citée.
 */
export const OPCO_FICHES: Record<OpcoId, OpcoFiche> = {
  atlas: {
    ...ficheVide(false),
    // « Demande de prise en charge dans son espace myAtlas Entreprise » (CG du 04/02/2026).
    modeDeDepotConstate: confirme("compte_adherent", SRC_ATLAS),
    // « Émettre des factures libellées à Atlas […] dans un délai maximum de 3 mois à compter de
    // la date de fin de la formation sous peine de rejet automatique » (CG, relu le 2026-10-04).
    delaiFacturationJours: confirme(90, SRC_ATLAS),
    // « Transmettre le dossier […] avant le début de la formation en passant par myAtlas ».
    delaiDepotJours: confirme(1, SRC_ATLAS),
    // Pièces complémentaires « dans la limite du 31 décembre de l'année N », sinon refus.
    dateLimiteDepot2026: confirme("2026-12-31", SRC_ATLAS),
  },
  opco_ep: {
    ...ficheVide(false),
    // « Au plus tard dans les 30 jours suivant la fin de l'action » (CG 2026).
    delaiFacturationJours: confirme(30, SRC_OPCOEP_CG),
    // « Au moins un mois avant la date de début de l'action de formation, si l'entreprise
    // souhaite une garantie de réponse […] avant le départ en formation » (CG 2026).
    delaiDepotJours: confirme(30, SRC_OPCOEP_CG),
  },
  akto: {
    ...ficheVide(false),
    // « Le dossier est à déposer via votre espace en ligne : MonEspace » (page « Déposer une
    // demande » de l'espace Entreprise, lue le 2026-10-04).
    modeDeDepotConstate: confirme("compte_adherent", SRC_AKTO_DEPOT),
  },
  opco2i: {
    ...ficheVide(false),
    // « L'entreprise bénéficiaire complète le formulaire de prise en charge dématérialisé sur
    // le portail de service Mon compte 2i » (charte juin 2026).
    modeDeDepotConstate: confirme("compte_adherent", SRC_OPCO2I_CHARTE),
    // Justificatifs « dans un délai de quatre mois à compter de la fin de réalisation de
    // l'action », sinon aucun paiement n'est dû (charte juin 2026).
    delaiFacturationJours: confirme(120, SRC_OPCO2I_CHARTE),
  },
  mobilites: {
    ...ficheVide(false),
    // 15/01/2027 par exception pour les formations débutant entre le 15 et le 31/12/2026.
    dateLimiteDepot2026: confirme("2026-12-31", SRC_MOBILITES),
  },
  afdas: ficheVide(false),
  uniformation: ficheVide(true),
  ocapiat: {
    ...ficheVide(false),
    // Dispositif « Boost Compétences » (< 50 salariés) : au plus tard le 1er jour de la formation.
    delaiDepotJours: confirme(0, SRC_OCAPIAT_BOOST),
  },
  constructys: {
    ...ficheVide(false),
    // Obligation de l'entreprise adhérente : « Transmettre de façon dématérialisée le dossier de
    // demande de prise en charge […] avant le début de la formation via son compte adhérent »
    // (conditions générales, lues le 2026-10-04).
    modeDeDepotConstate: confirme("compte_adherent", SRC_CONSTRUCTYS_CG),
    // Dossier complet 15 jours calendaires avant le début, sinon refus.
    delaiDepotJours: confirme(15, SRC_CONSTRUCTYS),
  },
  opcommerce: {
    ...ficheVide(false),
    portailEntrepriseUrl: confirme("https://entreprise.lopcommerce.com/forconet/", SRC_OPCOMMERCE),
    // Demandes déposées jusqu'au 30/11/2026 inclus pour un début en 2026.
    dateLimiteDepot2026: confirme("2026-11-30", SRC_OPCOMMERCE),
  },
  opco_sante: ficheVide(true),
};

const JOUR_MS = 24 * 60 * 60 * 1000;

function decaleDeJours(date: Date, jours: number): Date {
  return new Date(date.getTime() + jours * JOUR_MS);
}

/** Date limite de dépôt pour une session : début − délai, ou null si le délai est inconnu. */
export function dateLimiteDepotPourSession(opco: OpcoId, debutSession: Date): Date | null {
  const delai = OPCO_FICHES[opco].delaiDepotJours.valeur;
  return delai === null ? null : decaleDeJours(debutSession, -delai);
}

/** Date limite de facturation : fin + délai, ou null si le délai est inconnu. */
export function dateLimiteFacturation(opco: OpcoId, finSession: Date): Date | null {
  const delai = OPCO_FICHES[opco].delaiFacturationJours.valeur;
  return delai === null ? null : decaleDeJours(finSession, delai);
}

export type FaitAVerifier = {
  opco: OpcoId;
  libelle: string;
  champ: keyof OpcoFiche;
  valeur: unknown;
  source: string | null;
  releveLe: string;
};

/** Champs marqués « à vérifier », dans l'ordre d'affichage des OPCO. */
export function faitsAVerifier(): FaitAVerifier[] {
  return OPCO_IDS.flatMap((opco) =>
    (Object.entries(OPCO_FICHES[opco]) as [keyof OpcoFiche, Fait<unknown>][])
      .filter(([, fait]) => fait.aVerifier === true)
      .map(([champ, fait]) => ({
        opco,
        libelle: OPCO_LABELS[opco],
        champ,
        valeur: fait.valeur,
        source: fait.source,
        releveLe: fait.releveLe,
      })),
  );
}

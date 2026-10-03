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

/** Qui dépose la demande de prise en charge, tel que constaté sur la source. */
export type ModeDeDepot = "compte_adherent" | "of_mandate";

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
const SRC_CONSTRUCTYS =
  "https://www.constructys.fr/financer-vos-projets-de-formation/modalites-demandes-de-prise-charge/conditions-de-prise-en-charge-2/";
const SRC_OPCOMMERCE = "https://www.lopcommerce.com/media/bsbnjydz/conditons-generales-gestion.pdf";
const SRC_MOBILITES =
  "https://www.opcomobilites.fr/actualites/detail/calendrier-de-prise-en-charge-des-actions-de-formation-rappels-importants";
const SRC_OCAPIAT_BOOST =
  "https://www.ocapiat.fr/wp-content/uploads/fiche-de-presentation-BOOST-COMPETENCES-OCAPIAT.pdf";

function confirme<T>(valeur: T, source: string): Fait<T> {
  return { valeur, source, releveLe: RELEVE };
}

/** Relevé du chantier gardé tel quel mais non reconfirmé sur la page source. */
function aReconfirmer<T>(valeur: T, source: string): Fait<T> {
  return { valeur, source, releveLe: RELEVE, aVerifier: true };
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
 */
export const OPCO_FICHES: Record<OpcoId, OpcoFiche> = {
  atlas: {
    ...ficheVide(false),
    // « Demande de prise en charge dans son espace myAtlas Entreprise » (CG du 04/02/2026).
    modeDeDepotConstate: confirme("compte_adherent", SRC_ATLAS),
    // « Au plus tard 3 mois après la fin » : relevé du chantier, non retrouvé dans l'extrait consulté.
    delaiFacturationJours: aReconfirmer(90, SRC_ATLAS),
  },
  opco_ep: {
    ...ficheVide(false),
    // « Au plus tard dans les 30 jours suivant la fin de l'action » (CG 2026).
    delaiFacturationJours: confirme(30, SRC_OPCOEP_CG),
  },
  akto: ficheVide(false),
  opco2i: ficheVide(false),
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

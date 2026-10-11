/**
 * Pièces à renouveler d'un formateur indépendant — règles PURES (lot L13,
 * ADR 0066 ; plan 08 §12.3 séquence S6 bis, §12.4 écrans F-13/F-14).
 *
 * 🔑 Rien n'est recréé :
 * - la pièce retenue et la durée de vie du CV viennent de
 *   `trainers/conformite.ts` ; l'échéance de l'attestation de vigilance et la
 *   marque d'archive, de la garde d'activation (`gardes.ts`, lot S1) — la
 *   pièce « valable » ici est celle que la garde accepte ;
 * - le calendrier des rappels est une `RegleCampagne` du moteur commun
 *   (`lib/relances/campagne.ts`) : ce module ne décide d'aucun envoi, il rend
 *   l'état que la campagne lira (CAMP-3) ;
 * - aucun e-mail ici : les gabarits F40, F41 et F57 attendent leurs textes
 *   validés et l'adaptateur d'envoi.
 *
 * Sans import serveur : sûr pour le worker.
 */

import {
  FENETRE_ENVOI_PAR_DEFAUT,
  cleEnvoi,
  type EtatCampagne,
  type RegleCampagne,
} from "@/lib/relances/campagne";
import {
  CONFORMITE_DEFAUTS,
  addMonths,
  trouverValide,
  type ConformiteConfig,
  type DocumentConformite,
  type TrainerDocumentTypeValue,
} from "@/server/qualiopi/trainers/conformite";

import { echeanceCalculee, estPieceArchivee } from "./gardes";

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Une pièce telle que lue en base (le strict nécessaire). */
export interface PieceLue extends DocumentConformite {
  readonly id: string;
  readonly createdAt: Date;
  /** Pièce archivée (remplacée) : ignorée. */
  readonly archiveAt: Date | null;
  readonly rejetMotif: string | null;
  /** Date de la décision (validation ou refus), si connue. */
  readonly valideAt: Date | null;
}

/** Les pièces suivies pour un indépendant, et si leur absence bloque une mission. */
export const PIECES_SUIVIES: ReadonlyArray<{
  readonly type: TrainerDocumentTypeValue;
  /** La RC pro est relancée mais ne bloque jamais (plan 08 §12.3, S6 bis). */
  readonly bloquante: boolean;
}> = [
  { type: "attestation_vigilance_urssaf", bloquante: true },
  { type: "assurance_rc_pro", bloquante: false },
  { type: "cv", bloquante: false },
];

/** Délai avant l'échéance où la pièce passe « à renouveler » (J-30). */
export const PREAVIS_RENOUVELLEMENT_JOURS = 30;

export type EtatPiece =
  | { readonly etat: "valable"; readonly echeance: Date | null }
  | { readonly etat: "a_renouveler"; readonly echeance: Date }
  | { readonly etat: "echue"; readonly echeance: Date }
  | { readonly etat: "en_verification" }
  | { readonly etat: "a_renvoyer"; readonly motif: string | null }
  | { readonly etat: "absente" };

/** Échéance d'une pièce VALIDE, selon son type. `null` : n'expire pas. */
export function echeancePiece(
  doc: DocumentConformite,
  config: ConformiteConfig = CONFORMITE_DEFAUTS,
): Date | null {
  switch (doc.type) {
    case "attestation_vigilance_urssaf": {
      // Même lecture que `pieceGardeeProbante` : la PLUS PROCHE entre l'échéance
      // calculée (émission + 6 mois) et celle saisie ; sans date d'émission,
      // rien n'est prouvé (échue).
      const calculee = echeanceCalculee("attestation_vigilance_urssaf", doc.dateEmission);
      if (calculee === null) return new Date(0);
      return doc.dateExpiration && doc.dateExpiration < calculee ? doc.dateExpiration : calculee;
    }
    case "cv":
      return doc.dateEmission ? addMonths(doc.dateEmission, config.cvValiditeMois) : null;
    default:
      return doc.dateExpiration;
  }
}

/** Les pièces du type, hors archivées (colonne du schéma n° 1 ou marque du lot S1). */
const actives = (docs: ReadonlyArray<PieceLue>, type: TrainerDocumentTypeValue) =>
  docs.filter((d) => d.type === type && d.archiveAt === null && !estPieceArchivee(d.rejetMotif));

/**
 * L'état d'UN type de pièce. Ordre : une pièce déposée en attente SUSPEND tout
 * (« reçue, en vérification ») ; sinon la pièce valide retenue et son
 * échéance ; sinon la dernière refusée ; sinon absente.
 */
export function etatPiece(
  documents: ReadonlyArray<PieceLue>,
  type: TrainerDocumentTypeValue,
  maintenant: Date,
  config: ConformiteConfig = CONFORMITE_DEFAUTS,
): EtatPiece {
  const docs = actives(documents, type);
  if (docs.some((d) => d.statutValidation === "en_attente")) return { etat: "en_verification" };

  // `trouverValide` écarte les pièces dont la `dateExpiration` est passée ; on
  // cherche donc aussi la plus récente valide pour dire « échue le … ».
  const valide =
    trouverValide([...docs], type, maintenant) ??
    docs
      .filter((d) => d.statutValidation === "valide")
      .sort((a, b) => (b.dateEmission?.getTime() ?? 0) - (a.dateEmission?.getTime() ?? 0))[0] ??
    null;
  if (valide) {
    const echeance = echeancePiece(valide, config);
    if (echeance === null) return { etat: "valable", echeance: null };
    if (echeance <= maintenant) return { etat: "echue", echeance };
    if (echeance.getTime() - maintenant.getTime() <= PREAVIS_RENOUVELLEMENT_JOURS * JOUR_MS) {
      return { etat: "a_renouveler", echeance };
    }
    return { etat: "valable", echeance };
  }
  const refusee = docs
    .filter((d) => d.statutValidation === "rejete")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return refusee ? { etat: "a_renvoyer", motif: refusee.rejetMotif } : { etat: "absente" };
}

const DATE_FR = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

/** Le libellé montré au formateur et à la console (écrans F-13/F-14). */
export function libelleEtatPiece(e: EtatPiece): string {
  switch (e.etat) {
    case "valable":
      return e.echeance ? `Valable jusqu'au ${DATE_FR.format(e.echeance)}` : "Valable";
    case "a_renouveler":
      return `À renouveler avant le ${DATE_FR.format(e.echeance)}`;
    case "echue":
      return `Échue le ${DATE_FR.format(e.echeance)}`;
    case "en_verification":
      return "Reçue, en vérification";
    case "a_renvoyer":
      return e.motif ? `À renvoyer : ${e.motif}` : "À renvoyer";
    case "absente":
      return "À fournir";
  }
}

/** Un état qui demande un geste du formateur. */
export function demandeUnGeste(e: EtatPiece): boolean {
  return (
    e.etat === "a_renouveler" ||
    e.etat === "echue" ||
    e.etat === "a_renvoyer" ||
    e.etat === "absente"
  );
}

/**
 * Le dossier est-il BLOQUÉ (plus aucune mission proposable) ? Seules les
 * pièces bloquantes comptent ; une pièce en vérification ne débloque pas.
 */
export function dossierBloque(
  documents: ReadonlyArray<PieceLue>,
  maintenant: Date,
  config: ConformiteConfig = CONFORMITE_DEFAUTS,
): boolean {
  return PIECES_SUIVIES.filter((p) => p.bloquante).some((p) => {
    const e = etatPiece(documents, p.type, maintenant, config);
    return (
      e.etat === "echue" ||
      e.etat === "absente" ||
      e.etat === "a_renvoyer" ||
      e.etat === "en_verification"
    );
  });
}

/**
 * F57 « Votre dossier est à jour » : un épisode de blocage se LÈVE quand le
 * dossier était bloqué avant la décision et ne l'est plus après. Un seul
 * message par épisode (clé `fi-a-jour-<trainer>-<épisode>`).
 */
export function blocageLeve(avant: boolean, apres: boolean): boolean {
  return avant && !apres;
}

// ── Séquence S6 bis : rappels avant l'échéance (F41) ─────────────────────

export type EtapePiece = "j30" | "j15" | "j0";

/** J-30, J-15, J0 avant l'échéance ; 3 au plus ; rien après l'échéance. */
export const REGLE_PIECE_A_RENOUVELER: RegleCampagne<EtapePiece> = {
  etapes: [
    { id: "j30", delaiMs: 0 },
    { id: "j15", delaiMs: 15 * JOUR_MS },
    { id: "j0", delaiMs: 30 * JOUR_MS },
  ],
  ecartMinMs: 7 * JOUR_MS,
  // Origine = J-30 : le dernier rappel tombe le jour de l'échéance ; un jour
  // de grâce pour un passage manqué, puis plus rien.
  silenceApresMs: 31 * JOUR_MS,
  max: 3,
  unParJour: true,
  fenetre: FENETRE_ENVOI_PAR_DEFAUT,
};

/** Une pièce refusée : un seul rappel, à J+7 du refus. */
export const REGLE_PIECE_REFUSEE: RegleCampagne<"j7"> = {
  etapes: [{ id: "j7", delaiMs: 7 * JOUR_MS }],
  ecartMinMs: 7 * JOUR_MS,
  silenceApresMs: 14 * JOUR_MS,
  max: 1,
  unParJour: true,
  fenetre: FENETRE_ENVOI_PAR_DEFAUT,
};

/** Pause après une réponse humaine, en classe B (plan 08 §12.3). */
export const PAUSE_REPONSE_HUMAINE_MS = 72 * 60 * 60 * 1000;

/** Les faits lus pour une personne (hors pièces). */
export interface FaitsPersonne {
  readonly efface: boolean;
  readonly opposition: boolean;
  readonly adresseMorte: boolean;
  /** Fin de collaboration ou décès. */
  readonly close: boolean;
  readonly derniereReponseHumaine: Date | null;
  readonly derniereRelancePersonne: Date | null;
}

/**
 * L'état de campagne d'une pièce (S6 bis), ou `null` si aucune campagne ne
 * s'applique (pièce valable loin de l'échéance, en vérification, absente).
 * Une pièce en vérification SUSPEND (`actionFaite`), une réponse humaine met
 * en PAUSE 72 h.
 */
export function etatCampagnePiece(
  e: EtatPiece,
  documents: ReadonlyArray<PieceLue>,
  type: TrainerDocumentTypeValue,
  faits: FaitsPersonne,
  envois: readonly Date[],
  maintenant: Date,
): { regle: "a_renouveler" | "refusee"; etat: EtatCampagne; echeance: Date | null } | null {
  const pause =
    faits.derniereReponseHumaine !== null &&
    maintenant.getTime() - faits.derniereReponseHumaine.getTime() < PAUSE_REPONSE_HUMAINE_MS;
  const commun = {
    efface: faits.efface,
    opposition: faits.opposition,
    adresseMorte: faits.adresseMorte,
    close: faits.close,
    reponseHumaine: pause,
    envois,
    derniereRelancePersonne: faits.derniereRelancePersonne,
  };
  if (e.etat === "a_renouveler" || e.etat === "echue") {
    return {
      regle: "a_renouveler",
      echeance: e.echeance,
      etat: {
        ...commun,
        actionFaite: false,
        origine: new Date(e.echeance.getTime() - PREAVIS_RENOUVELLEMENT_JOURS * JOUR_MS),
      },
    };
  }
  if (e.etat === "a_renvoyer") {
    const refusee = actives(documents, type)
      .filter((d) => d.statutValidation === "rejete")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]!;
    return {
      regle: "refusee",
      echeance: null,
      etat: { ...commun, actionFaite: false, origine: refusee.valideAt ?? refusee.createdAt },
    };
  }
  return null;
}

/** `fi-piece-<étape>-<trainer>-<type>-<AAAAMMJJ>` : ni adresse, ni `:`. */
export function clePiece(
  trainerId: string,
  type: string,
  echeance: Date | null,
  etape: string,
): string {
  const jour = echeance ? echeance.toISOString().slice(0, 10).replace(/-/g, "") : "refus";
  return cleEnvoi("fi-piece", `${trainerId}-${type}-${jour}`, etape);
}

/**
 * Formateurs indépendants — garde d'ACTIVATION (lot S1, ADR 0066 étape 8).
 *
 * ⚠️ VERSION PROVISOIRE. La garde de mission complète de l'ADR 0066 (d) —
 * contrat-cadre contresigné dans la version en vigueur, contrôle registre relu
 * il y a un mois au plus — arrive avec ses lots. Celle-ci ferme la porte qui
 * était grande ouverte : un `sous_traitant` passait actif d'un clic, sans
 * qu'aucune pièce soit regardée.
 *
 * 🔴 UNE GARDE QUI ÉCHOUE RESTE FERMÉE (ADR 0066 (f)). Donnée absente, date
 * illisible, statut inconnu, exception : la réponse est « non activable », avec
 * la liste de ce qui manque. Jamais « faute de mieux ».
 *
 * Module PUR : aucune lecture en base. L'écrivain unique (`activation.ts`) lit
 * la fiche et ses pièces, puis demande le verdict ici.
 *
 * Salariés et dirigeants : HORS PÉRIMÈTRE (ADR 0066 (a)). La garde répond
 * « activable » sans rien examiner — leur comportement est inchangé.
 */

import { SEUIL_VIGILANCE_LIBELLE } from "@/lib/vigilance";
import {
  addMonths,
  type DocumentConformite,
  type TrainerStatutValue,
} from "@/server/qualiopi/trainers/conformite";

import { vigilanceExigible } from "./vigilance-seuil";

/** Validité de l'attestation de vigilance URSSAF (art. L.8222-1, D.8222-5). */
export const VIGILANCE_VALIDITE_MOIS = 6;

/**
 * Validité retenue pour l'avis de situation SIRENE (ou l'extrait Kbis).
 *
 * ⚠️ Valeur PROVISOIRE, à confirmer : le texte n'en fixe pas ; « moins de trois
 * mois » est l'usage des donneurs d'ordre. Elle sert à CALCULER l'échéance de
 * la pièce, pour qu'aucune date saisie à la main ne la fasse vivre à jamais.
 */
export const AVIS_SIRENE_VALIDITE_MOIS = 3;

/** Pièces que la garde lit, avec leur durée de validité calculée. */
export const VALIDITE_PIECES_GARDEES = {
  attestation_vigilance_urssaf: VIGILANCE_VALIDITE_MOIS,
  kbis_avis_sirene: AVIS_SIRENE_VALIDITE_MOIS,
} as const;

export type TypePieceGardee = keyof typeof VALIDITE_PIECES_GARDEES;

export const TYPES_PIECES_GARDEES: ReadonlyArray<TypePieceGardee> = Object.keys(
  VALIDITE_PIECES_GARDEES,
) as TypePieceGardee[];

export function estPieceGardee(type: string): type is TypePieceGardee {
  return Object.prototype.hasOwnProperty.call(VALIDITE_PIECES_GARDEES, type);
}

/**
 * Échéance CALCULÉE d'une pièce gardée : date d'émission + sa durée de
 * validité. `null` si la date d'émission manque — une pièce qu'on ne peut pas
 * dater ne prouve rien.
 */
export function echeanceCalculee(type: TypePieceGardee, dateEmission: Date | null): Date | null {
  if (dateEmission === null || Number.isNaN(dateEmission.getTime())) return null;
  return addMonths(dateEmission, VALIDITE_PIECES_GARDEES[type]);
}

/**
 * Une pièce gardée est-elle probante à `maintenant` ?
 *
 * Validée par un humain, émise (pas dans le futur), et non échue — l'échéance
 * retenue est la PLUS PROCHE entre celle saisie et celle calculée : une date
 * libre (« valable jusqu'en 2099 ») ne prolonge jamais une attestation.
 */
export function pieceGardeeProbante(
  piece: DocumentConformite,
  type: TypePieceGardee,
  maintenant: Date,
): boolean {
  if (piece.type !== type || piece.statutValidation !== "valide") return false;
  const emission = piece.dateEmission;
  if (emission === null || Number.isNaN(emission.getTime())) return false;
  if (emission.getTime() > maintenant.getTime()) return false;
  const calculee = echeanceCalculee(type, emission);
  if (calculee === null || calculee.getTime() <= maintenant.getTime()) return false;
  const saisie = piece.dateExpiration;
  if (saisie !== null && (Number.isNaN(saisie.getTime()) || saisie <= maintenant)) return false;
  return true;
}

/**
 * Marque d'une pièce ARCHIVÉE. `TrainerDocument` n'a ni `deletedAt` ni
 * `archivedAt`, et le lot S1 ne migre pas le schéma : l'archive est portée par
 * le statut `rejete` (aucun lecteur de conformité ne retient une pièce
 * rejetée) et un motif qui commence par cette marque. Une pièce archivée ne se
 * re-valide pas.
 */
export const MARQUE_ARCHIVE = "[archivée]";

export function estPieceArchivee(rejetMotif: string | null | undefined): boolean {
  return typeof rejetMotif === "string" && rejetMotif.startsWith(MARQUE_ARCHIVE);
}

/** Un contrat de sous-traitance GÉNÉRÉ (`DocumentGenere`), tel que la garde le lit. */
export interface ContratSousTraitanceLu {
  readonly statutSignature: string;
  readonly annuleeAt: Date | null;
}

/** Ce que la garde examine — rien de plus. */
export interface FormateurPourActivation {
  readonly statut: TrainerStatutValue | string;
  readonly sousTraitantVerifieAt: Date | null;
  readonly sousTraitantNda: string | null;
  /**
   * Date SAISIE à la main sur la fiche. ⚠️ Lot C4 : la garde d'activation ne la lit
   * plus — elle ne prouve aucune signature (voir `contratsSousTraitance`).
   */
  readonly sousTraitantContratSigneAt: Date | null;
  /**
   * Lot C4 — contrats de sous-traitance générés pour ce formateur. Absent : non lus,
   * donc garde FERMÉE (« contrat non signé »).
   */
  readonly contratsSousTraitance?: ReadonlyArray<ContratSousTraitanceLu>;
  /** Lot C4 — date de fin de collaboration close, ou `null`. */
  readonly finCollaborationAt: Date | null;
  /** Pièces du formateur (la garde filtre elle-même les validées). */
  readonly pieces: ReadonlyArray<DocumentConformite>;
  /**
   * Étape 3 du C4 — cumul des honoraires HT (lot G1). Absent ou illisible : l'attestation
   * URSSAF reste exigée (garde fermée).
   */
  readonly cumulHonorairesHtCents?: number | null;
  /**
   * Étape 3 du C4 — formateur rattaché à un ORGANISME sous-traitant : l'extrait Kbis
   * (ou l'avis SIRENE) reste exigé, comme l'art. 18.3 du contrat-cadre le prévoit.
   */
  readonly organismeSousTraitantId?: string | null;
}

export type VerdictActivation =
  | { readonly activable: true }
  | { readonly activable: false; readonly manques: ReadonlyArray<string> };

export const MANQUES = {
  statutInconnu: "Statut du formateur inconnu : activation impossible.",
  finCollaboration:
    "La collaboration avec ce formateur est terminée : sa fiche ne peut pas être réactivée.",
  controleRegistre: "Le contrôle du sous-traitant (registre public) n'a pas été effectué.",
  nda: "Le numéro de déclaration d'activité n'est pas renseigné.",
  contrat: "Le contrat-cadre de sous-traitance n'est pas signé.",
  vigilance:
    "L'attestation de vigilance URSSAF validée manque, ou a plus de " +
    `${VIGILANCE_VALIDITE_MOIS} mois : elle est exigée à partir de ${SEUIL_VIGILANCE_LIBELLE} HT d'honoraires.`,
  sirene:
    "L'avis de situation SIRENE (ou l'extrait Kbis) validé manque, ou a plus de " +
    `${AVIS_SIRENE_VALIDITE_MOIS} mois.`,
  erreur: "Le contrôle des pièces n'a pas pu aboutir : activation refusée par prudence.",
} as const;

function dateValideEtPassee(d: Date | null, maintenant: Date): boolean {
  return d !== null && !Number.isNaN(d.getTime()) && d.getTime() <= maintenant.getTime();
}

/**
 * Lot C4 — un contrat de sous-traitance RÉELLEMENT signé : statut `signee` (toutes les
 * parties ont signé), non annulé. Toute version : la version en vigueur est l'affaire
 * de la règle complète.
 */
export function contratSousTraitanceSigne(
  contrats: ReadonlyArray<ContratSousTraitanceLu> | undefined,
): boolean {
  return (contrats ?? []).some((c) => c.statutSignature === "signee" && c.annuleeAt === null);
}

/**
 * Un formateur peut-il être ACTIVÉ ?
 *
 * Un `sous_traitant` ne l'est que si TOUT est réuni : collaboration non terminée,
 * contrôle registre posé, numéro de déclaration d'activité non vide, contrat de
 * sous-traitance réellement signé (pièce générée `signee`, non annulée), et — au seuil
 * de vigilance seulement — attestation URSSAF validée et non périmée. Les manques sont
 * rendus en clair, dans l'ordre, pour l'écran.
 *
 * Étape 3 du C4 (décision de Will) : alignée sur la porte de contresignature, qui
 * n'exige l'attestation qu'au seuil (`vigilanceExigible`) et ne demande plus d'avis
 * SIRENE / Kbis — l'entreprise active est prouvée par le registre public relu à la
 * contresignature. `MANQUES.sirene` ne sort plus que pour un formateur rattaché à un
 * ORGANISME sous-traitant, que l'art. 18.3 du contrat-cadre tient au Kbis.
 */
export function peutActiverFormateurIndependant(
  formateur: FormateurPourActivation,
  maintenant: Date = new Date(),
): VerdictActivation {
  try {
    if (formateur.statut === "salarie" || formateur.statut === "dirigeant") {
      return { activable: true };
    }
    if (formateur.statut !== "sous_traitant") {
      return { activable: false, manques: [MANQUES.statutInconnu] };
    }

    // Lot C4 — une fin de collaboration close ne se rouvre pas par une réactivation.
    if (formateur.finCollaborationAt !== null && formateur.finCollaborationAt !== undefined) {
      return { activable: false, manques: [MANQUES.finCollaboration] };
    }
    const manques: string[] = [];
    if (!dateValideEtPassee(formateur.sousTraitantVerifieAt, maintenant)) {
      manques.push(MANQUES.controleRegistre);
    }
    if ((formateur.sousTraitantNda ?? "").trim() === "") manques.push(MANQUES.nda);
    // Lot C4 — la pièce signée, jamais la date saisie à la main.
    if (!contratSousTraitanceSigne(formateur.contratsSousTraitance)) manques.push(MANQUES.contrat);
    const pieces = formateur.pieces ?? [];
    if (
      vigilanceExigible(formateur.cumulHonorairesHtCents) &&
      !pieces.some((p) => pieceGardeeProbante(p, "attestation_vigilance_urssaf", maintenant))
    ) {
      manques.push(MANQUES.vigilance);
    }
    if (
      typeof formateur.organismeSousTraitantId === "string" &&
      !pieces.some((p) => pieceGardeeProbante(p, "kbis_avis_sirene", maintenant))
    ) {
      manques.push(MANQUES.sirene);
    }
    return manques.length === 0 ? { activable: true } : { activable: false, manques };
  } catch {
    return { activable: false, manques: [MANQUES.erreur] };
  }
}

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

import {
  addMonths,
  type DocumentConformite,
  type TrainerStatutValue,
} from "@/server/qualiopi/trainers/conformite";

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

/** Ce que la garde examine — rien de plus. */
export interface FormateurPourActivation {
  readonly statut: TrainerStatutValue | string;
  readonly sousTraitantVerifieAt: Date | null;
  readonly sousTraitantNda: string | null;
  readonly sousTraitantContratSigneAt: Date | null;
  /** Pièces du formateur (la garde filtre elle-même les validées). */
  readonly pieces: ReadonlyArray<DocumentConformite>;
}

export type VerdictActivation =
  | { readonly activable: true }
  | { readonly activable: false; readonly manques: ReadonlyArray<string> };

export const MANQUES = {
  statutInconnu: "Statut du formateur inconnu : activation impossible.",
  controleRegistre: "Le contrôle du sous-traitant (registre public) n'a pas été effectué.",
  nda: "Le numéro de déclaration d'activité n'est pas renseigné.",
  contrat: "Le contrat-cadre de sous-traitance n'est pas signé.",
  vigilance:
    "L'attestation de vigilance URSSAF validée manque, ou a plus de " +
    `${VIGILANCE_VALIDITE_MOIS} mois.`,
  sirene:
    "L'avis de situation SIRENE (ou l'extrait Kbis) validé manque, ou a plus de " +
    `${AVIS_SIRENE_VALIDITE_MOIS} mois.`,
  erreur: "Le contrôle des pièces n'a pas pu aboutir : activation refusée par prudence.",
} as const;

function dateValideEtPassee(d: Date | null, maintenant: Date): boolean {
  return d !== null && !Number.isNaN(d.getTime()) && d.getTime() <= maintenant.getTime();
}

/**
 * Un formateur peut-il être ACTIVÉ ?
 *
 * Un `sous_traitant` ne l'est que si TOUT est réuni : contrôle registre posé,
 * numéro de déclaration d'activité non vide, contrat-cadre signé, attestation
 * de vigilance URSSAF et avis SIRENE validés et non périmés. Les manques sont
 * rendus en clair, dans l'ordre, pour l'écran.
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

    const manques: string[] = [];
    if (!dateValideEtPassee(formateur.sousTraitantVerifieAt, maintenant)) {
      manques.push(MANQUES.controleRegistre);
    }
    if ((formateur.sousTraitantNda ?? "").trim() === "") manques.push(MANQUES.nda);
    if (!dateValideEtPassee(formateur.sousTraitantContratSigneAt, maintenant)) {
      manques.push(MANQUES.contrat);
    }
    const pieces = formateur.pieces ?? [];
    if (!pieces.some((p) => pieceGardeeProbante(p, "attestation_vigilance_urssaf", maintenant))) {
      manques.push(MANQUES.vigilance);
    }
    if (!pieces.some((p) => pieceGardeeProbante(p, "kbis_avis_sirene", maintenant))) {
      manques.push(MANQUES.sirene);
    }
    return manques.length === 0 ? { activable: true } : { activable: false, manques };
  } catch {
    return { activable: false, manques: [MANQUES.erreur] };
  }
}

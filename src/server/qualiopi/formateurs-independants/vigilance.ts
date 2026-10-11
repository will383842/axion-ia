/**
 * Formateurs indépendants — VALIDATION de l'attestation de vigilance URSSAF et
 * sa PREUVE (lot L4b, ADR 0066 (d) 4, art. L.8222-1 et D.8222-5).
 *
 * Le formateur ne saisit que le CODE de vérification de son attestation
 * (`TrainerDocument.numeroPiece`). Un administrateur le contrôle sur urssaf.fr,
 * coche « authenticité vérifiée », et la validation inscrit une ligne
 * `PreuveVigilance` en AJOUT SEUL (triggers `preuves_vigilance_ajout_seul` /
 * `…_pas_de_truncate`, `socle-objets-sql.ts`) : une vérification ne se corrige
 * pas, on en inscrit une nouvelle.
 *
 * Module PUR pour les règles ; l'écriture vit dans l'action
 * `server/actions/qualiopi/formateurs-vigilance.ts`.
 */

import { estSuperAdmin } from "@/server/auth/habilitations";

import { echeanceCalculee, estPieceArchivee } from "./gardes";

/**
 * Traces de journal qui disent QUI a mis la pièce au dossier : la saisie
 * console (`adminUserId` = l'administrateur), le dépôt du formateur depuis son
 * dossier en ligne (`adminUserId` nul).
 */
export const ACTIONS_CREATION_PIECE = [
  "qualiopi.trainer_document.create",
  "qualiopi.trainer_document.depot_formateur",
] as const;

/** Code de vérification comparé sans espaces, tirets ni casse. */
export function normaliserCodeVigilance(brut: string | null | undefined): string {
  return typeof brut === "string" ? brut.replace(/[\s-]/g, "").toUpperCase() : "";
}

/** Un code URSSAF : lettres et chiffres, 6 à 60 signes. */
export function codeVigilanceBienForme(code: string): boolean {
  return /^[A-Z0-9]{6,60}$/.test(code);
}

export type MotifRefusVigilance =
  | "introuvable"
  | "type"
  | "archivee"
  | "hors_perimetre"
  | "deja_traitee"
  | "sans_emission"
  | "emission_future"
  | "code_different"
  | "quatre_yeux";

export const MESSAGES_REFUS_VIGILANCE: Readonly<Record<MotifRefusVigilance, string>> = {
  introuvable: "Pièce introuvable.",
  type: "Cette pièce n'est pas une attestation de vigilance URSSAF.",
  archivee: "Cette pièce est archivée : elle ne peut plus être validée.",
  hors_perimetre: "La validation par code URSSAF concerne les formateurs indépendants seulement.",
  deja_traitee:
    "Cette attestation a déjà été vérifiée. Pour une nouvelle vérification, ajoutez la nouvelle attestation.",
  sans_emission:
    "La date d'émission de l'attestation manque : son échéance en dépend. Complétez la pièce avant de la valider.",
  emission_future: "La date d'émission de l'attestation est dans le futur.",
  code_different:
    "Le code saisi ne correspond pas à celui transmis avec l'attestation. Vérifiez-le sur urssaf.fr.",
  quatre_yeux:
    "Validation refusée : une attestation de vigilance est validée par une autre personne que celle qui l'a enregistrée.",
};

export interface PiecePourVigilance {
  readonly type: string;
  readonly numeroPiece: string | null;
  readonly dateEmission: Date | null;
  readonly statutValidation: string;
  readonly rejetMotif: string | null;
  readonly archiveAt: Date | null;
  readonly statutFormateur: string;
}

/**
 * Trace de création lue au journal : `null` = aucune trace (auteur inconnu,
 * garde FERMÉE), sinon l'administrateur auteur, `null` pour un dépôt du
 * formateur lui-même.
 */
export type TraceCreation = { readonly action: string; readonly adminUserId: string | null } | null;

/** Seul un DÉPÔT DU FORMATEUR peut porter un auteur nul. */
export const ACTION_DEPOT_FORMATEUR = ACTIONS_CREATION_PIECE[1];

/**
 * La pièce peut-elle recevoir une vérification de ce code par cette personne ?
 * Rend le motif du refus, ou `null` si la validation peut s'écrire.
 */
export function refusVigilance(
  piece: PiecePourVigilance | null,
  code: string,
  validateur: { readonly userId: string; readonly role: string },
  trace: TraceCreation,
  maintenant: Date,
): MotifRefusVigilance | null {
  if (piece === null) return "introuvable";
  if (piece.type !== "attestation_vigilance_urssaf") return "type";
  if (piece.archiveAt !== null || estPieceArchivee(piece.rejetMotif)) return "archivee";
  if (piece.statutFormateur !== "sous_traitant") return "hors_perimetre";
  if (piece.statutValidation !== "en_attente") return "deja_traitee";
  if (piece.dateEmission === null || Number.isNaN(piece.dateEmission.getTime())) {
    return "sans_emission";
  }
  if (piece.dateEmission.getTime() > maintenant.getTime()) return "emission_future";
  const donne = normaliserCodeVigilance(piece.numeroPiece);
  if (donne !== "" && donne !== code) return "code_different";
  // QUATRE YEUX (lot S1) : celui qui a saisi la pièce ne la valide pas lui-même.
  // Sans trace, l'auteur est réputé être le validateur — garde FERMÉE.
  if (!estSuperAdmin(validateur.role)) {
    if (trace === null || trace.adminUserId === validateur.userId) return "quatre_yeux";
    // Une saisie console dont l'auteur a disparu (`onDelete: SetNull`) n'est
    // pas un dépôt du formateur : auteur inconnu, garde FERMÉE.
    if (trace.adminUserId === null && trace.action !== ACTION_DEPOT_FORMATEUR) {
      return "quatre_yeux";
    }
  }
  return null;
}

/** Fin de validité de la preuve : émission + 6 mois (`VIGILANCE_VALIDITE_MOIS`). */
export function finValiditeVigilance(dateEmission: Date): Date | null {
  return echeanceCalculee("attestation_vigilance_urssaf", dateEmission);
}

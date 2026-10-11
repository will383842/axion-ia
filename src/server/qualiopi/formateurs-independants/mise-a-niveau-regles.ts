/**
 * Formateurs indépendants — RÈGLES de la mise à niveau des actifs (lot L9b, 08 §8.10,
 * W5 §5).
 *
 * Les indépendants déjà actifs avant le contrôle ne sont JAMAIS désactivés. L'écran les
 * liste avec les onze éléments à reprendre, la liste est FIGÉE (`miseANiveauListeeAt`),
 * puis chacun reçoit son dossier prérempli. Le délai de grâce court 30 jours à partir de
 * l'ENVOI (pas de la liste) : pendant ce temps la garde de mission avertit sans refuser.
 *
 * Module PUR.
 */

import type { DocumentConformite } from "@/server/qualiopi/trainers/conformite";

import { etatControle } from "./controle-regles";
import {
  contratContresigne,
  cvProbant,
  vigilanceProuvee,
  type FaitsActivationComplete,
} from "./garde-activation-complete";

/** Délai de grâce après l'envoi du dossier de mise à niveau (décision D-W2). */
export const DELAI_GRACE_MISE_A_NIVEAU_JOURS = 30;

const JOUR_MS = 86_400_000;

/** Les onze éléments, dans l'ordre de W5 §5. */
export const ELEMENTS_MISE_A_NIVEAU = [
  { cle: "contrat", libelle: "Contrat-cadre v3 signé et contresigné" },
  { cle: "controle", libelle: "Contrôle du registre de moins de 30 jours, non rouge" },
  { cle: "nda_liste", libelle: "Numéro de déclaration vu sur la liste publique" },
  { cle: "piece_nda", libelle: "Pièce « déclaration d'activité » validée" },
  { cle: "piece_kbis", libelle: "Pièce « avis de situation » validée" },
  { cle: "vigilance", libelle: "Attestation URSSAF de moins de 6 mois, vérifiée" },
  { cle: "cv", libelle: "CV validé, de moins de 24 mois" },
  { cle: "tva", libelle: "Régime de TVA" },
  { cle: "siret", libelle: "SIRET" },
  { cle: "iban", libelle: "IBAN" },
  { cle: "declarations", libelle: "Déclarations du dossier" },
] as const;

export type CleElement = (typeof ELEMENTS_MISE_A_NIVEAU)[number]["cle"];

export interface FaitsMiseANiveau extends FaitsActivationComplete {
  readonly actif: boolean;
  readonly estFormateur: boolean;
  readonly organismeSousTraitantId: string | null;
  /** Pièces `nda_sous_traitant` et `kbis_avis_sirene`. */
  readonly piecesAdministratives: ReadonlyArray<DocumentConformite>;
}

/** Concerné par la mise à niveau : indépendant ACTIF en nom propre, sans contrat v3 en vigueur. */
export function concerneParMiseANiveau(f: FaitsMiseANiveau): boolean {
  return (
    f.statut === "sous_traitant" &&
    f.actif &&
    f.estFormateur &&
    f.organismeSousTraitantId === null &&
    f.finCollaborationAt === null &&
    !contratContresigne(f.contrats)
  );
}

function pieceValidee(pieces: ReadonlyArray<DocumentConformite>, type: string): boolean {
  return pieces.some((p) => p.type === type && p.statutValidation === "valide");
}

/** Chaque élément : présent (vrai) ou à reprendre (faux). Garde fermée : erreur = à reprendre. */
export function elementsMiseANiveau(
  f: FaitsMiseANiveau,
  maintenant: Date,
): Readonly<Record<CleElement, boolean>> {
  const sur = (fn: () => boolean): boolean => {
    try {
      return fn();
    } catch {
      return false;
    }
  };
  return {
    contrat: sur(() => contratContresigne(f.contrats)),
    controle: sur(() => etatControle(f.controles, maintenant).probant),
    nda_liste: sur(
      () => f.ndaVerifieListeAt instanceof Date && !Number.isNaN(f.ndaVerifieListeAt.getTime()),
    ),
    piece_nda: sur(() => pieceValidee(f.piecesAdministratives, "nda_sous_traitant")),
    piece_kbis: sur(() => pieceValidee(f.piecesAdministratives, "kbis_avis_sirene")),
    vigilance: sur(() => vigilanceProuvee(f.pieces, f.preuvesVigilance, maintenant)),
    cv: sur(() => cvProbant(f.pieces, maintenant)),
    tva: (f.regimeTvaHonoraires ?? "") !== "",
    siret: /^\d{14}$/.test((f.siret ?? "").replace(/\s+/g, "")),
    iban: f.ibanPresent,
    declarations: (f.declarationsVersion ?? "").trim() !== "",
  };
}

/** Fin du délai de grâce, ou `null` tant que rien n'est parti. */
export function finDelaiGrace(premierEnvoi: Date | null): Date | null {
  if (premierEnvoi === null || Number.isNaN(premierEnvoi.getTime())) return null;
  return new Date(premierEnvoi.getTime() + DELAI_GRACE_MISE_A_NIVEAU_JOURS * JOUR_MS);
}

/**
 * Le dossier de mise à niveau peut-il partir ? Il faut une liste FIGÉE (la fiche y est),
 * et un dossier qui n'est pas déjà en cours de vérification : on n'efface jamais un
 * dossier envoyé par le formateur.
 */
export type RefusEnvoiMiseANiveau = "pas_concerne" | "liste_non_figee" | "dossier_a_verifier";

export function refusEnvoiMiseANiveau(
  f: FaitsMiseANiveau & {
    readonly miseANiveauListeeAt: Date | null;
    readonly dossierStatut: string | null;
  },
): RefusEnvoiMiseANiveau | null {
  if (!concerneParMiseANiveau(f)) return "pas_concerne";
  if (f.miseANiveauListeeAt === null) return "liste_non_figee";
  if (f.dossierStatut === "a_verifier") return "dossier_a_verifier";
  return null;
}

export const MESSAGES_REFUS_MISE_A_NIVEAU: Readonly<Record<RefusEnvoiMiseANiveau, string>> = {
  pas_concerne:
    "Ce formateur n'est pas concerné : il faut un indépendant actif, en nom propre, sans contrat-cadre v3 en vigueur.",
  liste_non_figee: "Figez d'abord la liste des formateurs à mettre à niveau.",
  dossier_a_verifier:
    "Son dossier vient d'être envoyé et attend votre vérification : rien n'est renvoyé.",
};

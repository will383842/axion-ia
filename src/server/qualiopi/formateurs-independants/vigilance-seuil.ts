/**
 * Formateurs indépendants — LA règle « attestation de vigilance URSSAF requise pour ce
 * formateur à cette date » (lot G1, décision du 12/10). Module PUR.
 *
 * Comme pour les apporteurs d'affaires (`features/apporteurs-reseau/regles.ts`,
 * `etatVigilance`), et avec LES MÊMES nombres (`lib/vigilance.ts`) :
 *   - sous l'APPROCHE (4 000 €) : rien n'est demandé, rien n'attend ;
 *   - à l'APPROCHE : on DEMANDE l'attestation (e-mail au formateur, alerte interne) ;
 *   - au SEUIL (5 000 €) : elle est EXIGÉE — le virement d'une mission attend tant
 *     qu'aucune attestation vérifiée n'est valable à la date de la mission, et le
 *     renouvellement tous les 6 mois s'applique.
 *
 * Le cumul est celui des HONORAIRES HT du formateur avec l'organisme : ses relevés
 * facturés (validés, facture reçue, payés — la mission en cours de paiement en fait
 * partie), avoirs déduits, sans borne de période. Un relevé brouillon, à valider ou
 * annulé ne compte pas.
 *
 * ⚠️ Différence assumée avec les apporteurs : leur cumul est apprécié TTC par prudence
 * (analyse du 09/10, art. 6.2 de LEUR contrat). Celui des formateurs est HT, comme le
 * seuil légal et comme la décision du 12/10 le demande.
 *
 * 🔴 Garde FERMÉE : un cumul illisible (`null`, `undefined`, non fini) vaut « seuil
 * atteint » — l'attestation reste exigée, exactement comme avant ce lot.
 */

import {
  APPROCHE_VIGILANCE_CENTS,
  SEUIL_VIGILANCE_CENTS,
  etatSeuilVigilance,
} from "@/lib/vigilance";

/** Statuts d'un relevé d'honoraires qui comptent dans le cumul (déjà facturé ou en paiement). */
export const STATUTS_RELEVE_CUMUL = ["valide", "facture_recue", "paye"] as const;

const COMPTE: ReadonlySet<string> = new Set(STATUTS_RELEVE_CUMUL);

/** Cumul HT des relevés qui comptent. Un montant illisible est ignoré. */
export function cumulDesReleves(
  releves: ReadonlyArray<{ readonly statut: string; readonly totalHtCents: number }>,
): number {
  return releves.reduce(
    (total, r) =>
      COMPTE.has(r.statut) && Number.isFinite(r.totalHtCents) ? total + r.totalHtCents : total,
    0,
  );
}

export type PhaseVigilance = "sous_le_seuil" | "approche" | "seuil_atteint";

function lisible(c: number | null | undefined): c is number {
  return typeof c === "number" && Number.isFinite(c);
}

/** Où en est ce formateur par rapport au seuil ? Illisible = seuil atteint. */
export function phaseVigilanceFormateur(cumulHtCents: number | null | undefined): PhaseVigilance {
  if (!lisible(cumulHtCents) || cumulHtCents >= SEUIL_VIGILANCE_CENTS) return "seuil_atteint";
  return cumulHtCents >= APPROCHE_VIGILANCE_CENTS ? "approche" : "sous_le_seuil";
}

/** L'attestation est-elle EXIGÉE (activation, contresignature, mission, virement) ? */
export function vigilanceExigible(cumulHtCents: number | null | undefined): boolean {
  return phaseVigilanceFormateur(cumulHtCents) === "seuil_atteint";
}

/**
 * Faut-il demander l'attestation, et ce qui doit être payé attend-il ? La même fonction
 * que les apporteurs, sur le cumul HT du formateur.
 */
export function etatVigilanceFormateur(e: {
  readonly cumulHtCents: number | null | undefined;
  readonly attestationValide: boolean;
}): {
  phase: PhaseVigilance;
  exigible: boolean;
  demander: boolean;
  attendre: boolean;
} {
  const phase = phaseVigilanceFormateur(e.cumulHtCents);
  // Illisible : traité comme pile au seuil (garde fermée).
  const cumul = lisible(e.cumulHtCents) ? e.cumulHtCents : SEUIL_VIGILANCE_CENTS;
  const s = etatSeuilVigilance({
    cumulCents: cumul,
    nouvelleCents: 0,
    piecesValides: e.attestationValide,
  });
  return { phase, exigible: phase === "seuil_atteint", ...s };
}

// Les libellés vivent avec les nombres (`lib/vigilance.ts`) : le dossier en ligne les lit
// sans importer le domaine Qualiopi (cloisonnement).
export { LIBELLE_ATTESTATION_PLUS_TARD, SEUIL_VIGILANCE_LIBELLE } from "@/lib/vigilance";

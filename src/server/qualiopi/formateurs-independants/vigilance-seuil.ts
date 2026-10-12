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
 * partie), avoirs déduits UNE fois, sans borne de période. Un relevé brouillon, à valider
 * ou annulé ne compte pas ; un trop-perçu imputé n'est pas déduit une seconde fois
 * (`cumulDesReleves`).
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

/** Un relevé tel que le cumul le lit : son statut, son total, et de quoi éviter les doubles. */
export interface ReleveCumul {
  readonly statut: string;
  readonly totalHtCents: number;
  /** Si ce relevé est un AVOIR : la pièce qu'il corrige (son statut). */
  readonly avoirDe?: { readonly statut: string } | null;
  /** Lignes d'imputation de trop-perçu (négatives, non annulées) portées par ce relevé. */
  readonly imputations?: ReadonlyArray<{ readonly montantHtCents: number }>;
}

/**
 * Cumul HT des relevés qui comptent — chaque somme UNE fois (correctif de la relecture G1).
 *
 *   - un AVOIR ne compte que si la pièce qu'il corrige compte encore : l'avoir TOTAL d'une
 *     pièce non payée accompagne son passage en `annule`, qui l'a déjà sortie du cumul ;
 *     le déduire en plus retirait deux fois la pièce ;
 *   - une ligne d'IMPUTATION de trop-perçu (décision 89) est un remboursement, pas une
 *     baisse d'honoraires : l'avoir partiel a déjà déduit le trop-perçu. Elle est donc
 *     rajoutée au total du relevé qui la porte.
 *
 * 🔴 Le cumul déclenche une obligation légale : dans le doute il SUR-estime. Une valeur
 * illisible n'abaisse jamais le cumul.
 */
export function cumulDesReleves(releves: ReadonlyArray<ReleveCumul>): number {
  let total = 0;
  for (const r of releves) {
    if (!COMPTE.has(r.statut) || !Number.isFinite(r.totalHtCents)) continue;
    if (r.avoirDe && !COMPTE.has(r.avoirDe.statut)) continue;
    const rendu = (r.imputations ?? []).reduce(
      (s, l) =>
        Number.isFinite(l.montantHtCents) && l.montantHtCents < 0 ? s - l.montantHtCents : s,
      0,
    );
    total += r.totalHtCents + rendu;
  }
  return total;
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

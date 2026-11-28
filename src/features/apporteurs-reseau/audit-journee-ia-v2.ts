import { grilleDeLaCommande } from "./regles";

/**
 * AUDIT EN LECTURE SEULE (point 17, #2464) : quelles commissions Journée IA ont déjà été posées
 * pour un apporteur en grille v2 (contrat 2.6 ou antérieur), où la Journée IA est hors grille
 * (annexe 1, A1.7) ? Will décide d'une éventuelle reprise (art. 4.5).
 *
 * Module pur : aucun accès base, aucune écriture. La sortie ne porte ni nom, ni e-mail, ni SIREN :
 * seulement l'identifiant de la ligne, son statut, son montant et le numéro d'autofacture.
 */
export type CommissionAuditee = {
  id: string;
  statut: string;
  montantCents: number | null;
  autofactureNumero: string | null;
  palier: string | null;
  parrainage: boolean;
  creeAt: Date;
  presentation: { recueAt: Date } | null;
  apporteur: { signatureApporteur: unknown };
};

export type LigneAudit = {
  id: string;
  statut: string;
  montantCents: number | null;
  autofactureNumero: string | null;
};

export const PALIER_AUDITE = "journee-ia";

export function auditerJourneeIaGrilleV2(lues: readonly CommissionAuditee[]): LigneAudit[] {
  return lues
    .filter((c) => c.palier === PALIER_AUDITE && !c.parrainage)
    .filter(
      (c) =>
        grilleDeLaCommande({
          signature: c.apporteur.signatureApporteur,
          declareeAt: c.presentation?.recueAt ?? c.creeAt,
          commandeSigneeAt: c.creeAt,
          avenant28EffetAt: null,
        }) === "v2",
    )
    .map((c) => ({
      id: c.id,
      statut: c.statut,
      montantCents: c.montantCents,
      autofactureNumero: c.autofactureNumero,
    }));
}

export function formaterAudit(lignes: readonly LigneAudit[]): string {
  if (lignes.length === 0) return "Aucune commission Journée IA posée pour une grille v2.";
  return [
    `${lignes.length} commission(s) Journée IA posée(s) pour une grille v2 :`,
    "identifiant\tstatut\tmontant_centimes\tautofacture",
    ...lignes.map(
      (l) => `${l.id}\t${l.statut}\t${l.montantCents ?? "-"}\t${l.autofactureNumero ?? "-"}`,
    ),
  ].join("\n");
}

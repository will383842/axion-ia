/**
 * Qualiopi — une facture est-elle encore VIVANTE ? Module PUR.
 *
 * Vivante = elle réclame encore quelque chose, ou s'apprête à le faire : ni
 * annulée, ni entièrement rectifiée par ses avoirs non annulés. Un BROUILLON est
 * vivant — il est déjà « la facture de cette prestation », à émettre.
 *
 * 🔑 Une seule définition, lue par trois consommateurs qui doivent répondre la
 * même chose (2026-09-15, relecture A09 de la PR 1097) :
 *   - le point d'émission (`facture-formation-emission.ts`), qui refuse une
 *     seconde facture vivante pour la même prestation — bouton ET automate ;
 *   - la décision de l'automate (`facture-auto-regles.ts`) ;
 *   - l'alerte `session_realisee_non_facturee`, qui ne voyait pas qu'une facture
 *     entièrement annulée par avoir laisse la session NON facturée.
 */

export interface FactureVivanteInput {
  statut: string;
  /** HT de la facture d'origine (positif). Absent = inconnu. */
  montantHtCents?: number | null;
  /** Avoirs émis sur cette facture (montants négatifs en base). Absent = aucun. */
  avoirs?: ReadonlyArray<{ statut: string; montantHtCents: number }> | null;
}

export function factureVivante(f: FactureVivanteInput): boolean {
  if (f.statut === "annulee") return false;
  const avoirs = (f.avoirs ?? []).filter((a) => a.statut !== "annulee");
  // ⚠️ Sans avoir, rien à comparer : un appelant qui ne sélectionne ni les
  // avoirs ni le montant garde le comportement « émise = vivante ».
  if (avoirs.length === 0) return true;
  const rectifie = avoirs.reduce((somme, a) => somme + Math.abs(a.montantHtCents), 0);
  return typeof f.montantHtCents === "number" ? rectifie < f.montantHtCents : true;
}

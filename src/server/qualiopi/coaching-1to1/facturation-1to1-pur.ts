/**
 * Facturation 1-to-1 — partie PURE (aucun import runtime lourd : testable sans
 * DB, sans react-pdf, sans next-auth). Consommée par `facturation-1to1.ts`.
 * Même découpage que `financements/facture-libre-pur.ts`.
 */

import type { LigneFacture } from "@/server/qualiopi/documents/templates/facture";

/**
 * Lignes de la facture 1-to-1 : forfait unique au montant du contrat.
 *
 * ⚠️ PAS `computeForfait` (financements/opco-calcul) : sa désignation dit
 * « Formation professionnelle » — une mention fausse sur une prestation de
 * conseil (2026-08-10, décision Will : le 1-to-1 est du conseil hors Qualiopi).
 */
export function lignesFacture1to1(montantHtCents: number): LigneFacture[] {
  return [
    {
      designation: "Accompagnement individuel (1-to-1) — forfait",
      quantite: 1,
      prixUnitaireHtCents: montantHtCents,
    },
  ];
}

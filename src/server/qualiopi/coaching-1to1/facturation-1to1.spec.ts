/**
 * Tests — facturation 1-to-1 (conseil) : la TVA n'est JAMAIS exonérée.
 *
 * 2026-08-10 (décision Will) : le 1-to-1 est une prestation de CONSEIL hors
 * Qualiopi. L'exonération 261-4-4° CGI ne couvre que la formation
 * professionnelle continue — l'ancien générateur allait de la config
 * `regime_tva` à `computeTotauxFacture` sans filtre d'activité, et sortait des
 * factures de conseil exonérées. Ce spec verrouille la composition RÉELLE du
 * générateur : `lignesFacture1to1` → `normaliserLignesPourActivite("un_a_un")`
 * → `computeTotauxFacture` (via le module pur, comme `facture-libre.spec`).
 */

import { describe, it, expect } from "vitest";
import { computeTotauxFacture, TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";
import { normaliserLignesPourActivite } from "@/server/qualiopi/financements/facture-libre-pur";
import { lignesFacture1to1 } from "./facturation-1to1-pur";

describe("facture 1-to-1 — TVA", () => {
  it("🔴 en régime exoneration_261, la facture 1-to-1 porte une TVA > 0", () => {
    // C'est LE verrou : l'activité `un_a_un` est HORS champ de l'exonération
    // formation — ses lignes sont taxées au taux standard.
    const lignes = normaliserLignesPourActivite(
      lignesFacture1to1(100_000),
      "un_a_un",
      "exoneration_261",
      TAUX_TVA_STANDARD,
    );
    const totaux = computeTotauxFacture(lignes, "exoneration_261", TAUX_TVA_STANDARD);
    expect(totaux.totalHtCents).toBe(100_000);
    expect(totaux.totalTvaCents).toBeGreaterThan(0);
    expect(totaux.totalTvaCents).toBe(20_000);
    expect(totaux.totalTtcCents).toBe(120_000);
  });

  it("en régime assujetti, taux standard comme toute prestation", () => {
    const lignes = normaliserLignesPourActivite(
      lignesFacture1to1(100_000),
      "un_a_un",
      "assujetti",
      TAUX_TVA_STANDARD,
    );
    const totaux = computeTotauxFacture(lignes, "assujetti", TAUX_TVA_STANDARD);
    expect(totaux.totalTvaCents).toBe(20_000);
  });

  it("la désignation ne prétend pas être de la formation professionnelle", () => {
    // `computeForfait` (opco-calcul) libelle « Formation professionnelle » —
    // une mention fausse sur du conseil, d'où la ligne dédiée.
    const [ligne] = lignesFacture1to1(50_000);
    expect(ligne!.designation).not.toMatch(/formation/i);
  });
});

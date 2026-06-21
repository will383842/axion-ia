/**
 * Tests — module TVA pur (tva.ts).
 *
 * Couvre les 3 régimes, le taux par ligne (factures mixtes formation/conseil),
 * la ventilation HT/TVA/TTC et les mentions légales.
 */

import { describe, it, expect } from "vitest";
import {
  tauxTvaLigne,
  computeTotauxFacture,
  mentionTva,
  mentionTvaKey,
  isRegimeTva,
  REGIME_TVA_DEFAUT,
  type LigneFacturable,
} from "./tva";
import { LEGAL_MENTIONS } from "./legal-mentions";

describe("REGIME_TVA_DEFAUT", () => {
  it("est assujetti (jamais omettre une TVA due par défaut)", () => {
    expect(REGIME_TVA_DEFAUT).toBe("assujetti");
  });
});

describe("isRegimeTva", () => {
  it("valide les régimes connus et rejette le reste", () => {
    expect(isRegimeTva("assujetti")).toBe(true);
    expect(isRegimeTva("exoneration_261")).toBe(true);
    expect(isRegimeTva("franchise_293b")).toBe(true);
    expect(isRegimeTva("autre")).toBe(false);
    expect(isRegimeTva(undefined)).toBe(false);
  });
});

describe("tauxTvaLigne", () => {
  it("assujetti → 20 % par défaut", () => {
    expect(tauxTvaLigne("assujetti", {})).toBe(20);
  });
  it("exonération / franchise → 0 %", () => {
    expect(tauxTvaLigne("exoneration_261", {})).toBe(0);
    expect(tauxTvaLigne("franchise_293b", {})).toBe(0);
  });
  it("l'override de ligne prime sur le régime (facture mixte)", () => {
    // Ligne de conseil à 20 % même sous exonération formation.
    expect(tauxTvaLigne("exoneration_261", { tauxTvaPercent: 20 })).toBe(20);
    // Ligne de formation forcée à 0 % sous régime assujetti.
    expect(tauxTvaLigne("assujetti", { tauxTvaPercent: 0 })).toBe(0);
  });
});

describe("computeTotauxFacture", () => {
  const ligne = (prixCents: number, qte = 1, taux?: number): LigneFacturable => ({
    quantite: qte,
    prixUnitaireHtCents: prixCents,
    ...(taux !== undefined ? { tauxTvaPercent: taux } : {}),
  });

  it("assujetti : 1 000,00 € HT → 200,00 € TVA → 1 200,00 € TTC", () => {
    const t = computeTotauxFacture([ligne(100000)], "assujetti");
    expect(t.totalHtCents).toBe(100000);
    expect(t.totalTvaCents).toBe(20000);
    expect(t.totalTtcCents).toBe(120000);
    expect(t.ventilation).toEqual([
      { tauxPercent: 20, baseHtCents: 100000, montantTvaCents: 20000 },
    ]);
  });

  it("exonération : TVA nulle, TTC = HT", () => {
    const t = computeTotauxFacture([ligne(280000)], "exoneration_261");
    expect(t.totalHtCents).toBe(280000);
    expect(t.totalTvaCents).toBe(0);
    expect(t.totalTtcCents).toBe(280000);
    expect(t.ventilation).toEqual([{ tauxPercent: 0, baseHtCents: 280000, montantTvaCents: 0 }]);
  });

  it("facture MIXTE : formation 0 % + conseil 20 % → 2 lignes de ventilation", () => {
    const t = computeTotauxFacture(
      [ligne(200000, 1, 0), ligne(100000, 1, 20)],
      "exoneration_261",
    );
    expect(t.totalHtCents).toBe(300000);
    // 0 % sur 2000 € + 20 % sur 1000 € = 200 € de TVA
    expect(t.totalTvaCents).toBe(20000);
    expect(t.totalTtcCents).toBe(320000);
    expect(t.ventilation).toEqual([
      { tauxPercent: 0, baseHtCents: 200000, montantTvaCents: 0 },
      { tauxPercent: 20, baseHtCents: 100000, montantTvaCents: 20000 },
    ]);
  });

  it("agrège les bases de même taux et arrondit au centime", () => {
    // 2 lignes à 20 % : base 333 + 333 = 666 ; TVA = round(666*0.2)=133
    const t = computeTotauxFacture([ligne(333), ligne(333)], "assujetti");
    expect(t.ventilation).toHaveLength(1);
    expect(t.ventilation[0]).toEqual({ tauxPercent: 20, baseHtCents: 666, montantTvaCents: 133 });
  });
});

describe("mentionTva / mentionTvaKey", () => {
  it("assujetti → aucune mention d'exonération", () => {
    expect(mentionTvaKey("assujetti")).toBeNull();
    expect(mentionTva("assujetti")).toBeNull();
  });
  it("exonération → mention 261-4-4°", () => {
    expect(mentionTvaKey("exoneration_261")).toBe("factureExonerationTva");
    expect(mentionTva("exoneration_261")).toBe(LEGAL_MENTIONS.factureExonerationTva);
  });
  it("franchise → mention 293 B", () => {
    expect(mentionTvaKey("franchise_293b")).toBe("factureFranchiseTva");
    expect(mentionTva("franchise_293b")).toBe(LEGAL_MENTIONS.factureFranchiseTva);
    expect(LEGAL_MENTIONS.factureFranchiseTva).toContain("293 B");
  });
});

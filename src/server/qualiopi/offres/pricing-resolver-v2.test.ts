/**
 * Croisement offres catalogue V2 ✕ resolver ✕ matrice prix.
 * Chaque formation du catalogue résout un prix « À partir de … » via le resolver
 * (gamme + durée → FORMATION_PRICE_MATRIX). Garantit que le seed offres-v2 (qui
 * dérive du même catalogue) aura toujours un prix résoluble en admin/fiche.
 */

import { describe, it, expect } from "vitest";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import { formatAmount, getFormationEntryPrice } from "@/content/pricing";
import {
  resolveOffrePrice,
  resolveOffrePriceLabel,
  resolveOffrePriceLabelV2,
  verifyOffreCoherence,
} from "@/server/qualiopi/offres/pricing-resolver";

describe("resolver V2 — prix catalogue dérivé de la matrice", () => {
  it("chaque formation résout « À partir de X € HT » via gamme+durée", () => {
    for (const f of FORMATIONS_V2) {
      const entry = getFormationEntryPrice(f.gamme, f.duree);
      expect(entry, `${f.id}`).toBeGreaterThan(0);
      const label = resolveOffrePriceLabelV2(f.gamme, f.duree, "fr");
      expect(label, f.id).toBe(`À partir de ${formatAmount(entry!, "fr")}`);
      // formatAmount inclut déjà « € HT » → jamais de double suffixe « HT HT ».
      expect(label, f.id).not.toContain("HT HT");
    }
  });

  it("resolveOffrePrice route les offres V2 (tierId null) vers la matrice", () => {
    for (const f of FORMATIONS_V2) {
      const viaOffre = resolveOffrePrice(
        { tierId: null, gamme: f.gamme, dureeCode: f.duree },
        "fr",
      );
      expect(viaOffre, f.id).toBe(resolveOffrePriceLabelV2(f.gamme, f.duree, "fr"));
    }
  });

  it("resolveOffrePrice route les offres legacy (gamme null) vers tierId/pricing.ts", () => {
    const legacy = resolveOffrePrice(
      { tierId: "intervention-essentielle", gamme: null, dureeCode: null },
      "fr",
    );
    expect(legacy).not.toBe("Tarif indisponible");
    expect(legacy.length).toBeGreaterThan(0);
  });

  it("tierId null + gamme null = Sur devis (pas de crash)", () => {
    expect(resolveOffrePriceLabel(null, "fr")).toBe("Sur devis");
    expect(resolveOffrePrice({ tierId: null, gamme: null, dureeCode: null }, "fr")).toBe(
      "Sur devis",
    );
  });

  it("gamme/durée inconnus = Sur devis", () => {
    expect(resolveOffrePriceLabelV2("inexistant", "9j", "fr")).toBe("Sur devis");
  });

  it("tarifType sur_devis PRIME sur la matrice (offre AXION)", () => {
    for (const f of FORMATIONS_V2) {
      const label = resolveOffrePrice(
        { tierId: null, gamme: f.gamme, dureeCode: f.duree, tarifType: "sur_devis" },
        "fr",
      );
      expect(label, f.id).toBe("Sur devis");
    }
    expect(
      resolveOffrePrice(
        { tierId: null, gamme: "ia-standard", dureeCode: "1j", tarifType: "sur_devis" },
        "en",
      ),
    ).toBe("On quote");
  });

  it("verifyOffreCoherence : sur_devis = cohérent sans exigence matrice", () => {
    expect(
      verifyOffreCoherence({
        tierId: null,
        tarifType: "sur_devis",
        gamme: "ia-standard",
        dureeCode: "1j",
      }).ok,
    ).toBe(true);
  });
});

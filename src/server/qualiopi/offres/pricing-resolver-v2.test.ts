/**
 * Croisement offres catalogue ✕ resolver ✕ matrice prix (refonte 2026-07-19).
 * Chaque formation catégorisée résout un prix FIXE via le resolver — la colonne
 * DB `OffreSite.gamme` porte la CATÉGORIE (« generale » | « metier » |
 * « secteur ») + `dureeCode` → FORMATION_PRICE_MATRIX. Garantit que le seed
 * offres-v2 (qui dérive du même catalogue) aura toujours un prix résoluble en
 * admin/fiche. Les offres archivées (anciennes gammes « ia-standard »…) ne
 * résolvent plus → « Sur devis ».
 */

import { describe, it, expect } from "vitest";
import { getFormationsV2, getSeminairesV2 } from "@/content/formations/catalog-v2";
import { formatAmount, getFormationEntryPrice } from "@/content/pricing";
import {
  resolveOffrePrice,
  resolveOffrePriceLabel,
  resolveOffrePriceLabelV2,
  verifyOffreCoherence,
} from "@/server/qualiopi/offres/pricing-resolver";

describe("resolver — prix catalogue dérivé de la matrice (catégorie + durée)", () => {
  it("chaque formation catégorisée résout son prix fixe « X € HT »", () => {
    for (const f of getFormationsV2()) {
      const entry = getFormationEntryPrice(f.categorie!, f.duree);
      expect(entry, `${f.id}`).toBeGreaterThan(0);
      const label = resolveOffrePriceLabelV2(f.categorie!, f.duree, "fr");
      expect(label, f.id).toBe(formatAmount(entry!, "fr"));
      // formatAmount inclut déjà « € HT » → jamais de double suffixe « HT HT ».
      expect(label, f.id).not.toContain("HT HT");
    }
  });

  it("resolveOffrePrice route les offres catalogue (tierId null) vers la matrice", () => {
    for (const f of getFormationsV2()) {
      const viaOffre = resolveOffrePrice(
        { tierId: null, gamme: f.categorie!, dureeCode: f.duree },
        "fr",
      );
      expect(viaOffre, f.id).toBe(resolveOffrePriceLabelV2(f.categorie!, f.duree, "fr"));
    }
  });

  it("les anciennes gammes (offres archivées) ne résolvent plus → Sur devis", () => {
    expect(resolveOffrePriceLabelV2("ia-standard", "1j", "fr")).toBe("Sur devis");
    expect(resolveOffrePriceLabelV2("claude", "2j", "fr")).toBe("Sur devis");
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

  it("catégorie/durée inconnues = Sur devis", () => {
    expect(resolveOffrePriceLabelV2("inexistant", "9j", "fr")).toBe("Sur devis");
  });

  it("tarifType sur_devis PRIME sur la matrice (séminaire)", () => {
    for (const s of getSeminairesV2()) {
      const label = resolveOffrePrice(
        { tierId: null, gamme: "seminaire", dureeCode: s.duree, tarifType: "sur_devis" },
        "fr",
      );
      expect(label, s.id).toBe("Sur devis");
    }
    expect(
      resolveOffrePrice(
        { tierId: null, gamme: "generale", dureeCode: "1j", tarifType: "sur_devis" },
        "en",
      ),
    ).toBe("On quote");
  });

  it("verifyOffreCoherence : catégorie+durée résolubles = cohérent ; sur_devis toujours cohérent", () => {
    for (const f of getFormationsV2()) {
      expect(
        verifyOffreCoherence({
          tierId: null,
          tarifType: "fixe",
          gamme: f.categorie!,
          dureeCode: f.duree,
        }).ok,
        f.id,
      ).toBe(true);
    }
    expect(
      verifyOffreCoherence({
        tierId: null,
        tarifType: "sur_devis",
        gamme: "seminaire",
        dureeCode: "1j",
      }).ok,
    ).toBe(true);
  });
});

// @vitest-environment node
/**
 * ⛔ LE CATALOGUE DU CIRCUIT LIT LES RÈGLES DU SITE, JAMAIS UNE COPIE.
 *
 * `catalogue-ia.ts` recopiait `deriveTarifType` (`typeTarifDuTier`) et les
 * deux règles avaient déjà divergé : un palier « à partir de » (`isFromPrice`)
 * était « fixe » pour les offres et « à partir de » pour le circuit. La règle
 * est corrigée À LA SOURCE (`pricing-resolver.ts`) et le circuit la lit. De
 * même, l'effectif était tiré d'une PHRASE d'affichage (`noteDevisFr`, coupée
 * sur « — ») — qui vaut « Aucun prix ferme dérivable (… » pour une offre sans
 * prix ferme. Il vient désormais de sa source (`resolveOffreEffectifFr`).
 *
 * Mutations qui rougissent : retirer la ligne `isFromPrice` de
 * `deriveTarifType` ; revenir à `noteDevisFr.split` dans le catalogue.
 * Contre-témoin : un palier à prix ferme reste « fixe ».
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/qualiopi/offres/offres", () => ({ listOffres: async () => [] }));

import {
  deriveTarifType,
  findPricingTier,
  resolveOffreEffectifFr,
} from "@/server/qualiopi/offres/pricing-resolver";
import { chargerCatalogue } from "../catalogue-ia";

describe("le catalogue du circuit lit les règles du site", () => {
  it("un prix plancher (`isFromPrice`) est « à partir de », jamais « fixe »", () => {
    const ferme = findPricingTier("intervention-4h")!;
    expect(deriveTarifType(ferme)).toBe("fixe");
    expect(deriveTarifType({ ...ferme, isFromPrice: true })).toBe("a_partir_de");
  });

  it("le circuit lit la même règle que les offres, palier par palier", async () => {
    const catalogue = await chargerCatalogue();
    const paliers = catalogue.entrees.filter((e) => e.ref.startsWith("TIER:"));
    expect(paliers.length).toBeGreaterThan(5);
    for (const e of paliers) {
      expect(e.typeTarif, e.ref).toBe(deriveTarifType(findPricingTier(e.ref.slice(5))!));
    }
  });

  it("l'effectif vient de sa source, jamais d'une phrase d'affichage", () => {
    expect(
      resolveOffreEffectifFr({ tierId: "intervention-4h", gamme: null, dureeCode: null }),
    ).toBe(findPricingTier("intervention-4h")!.groupSizeFr ?? null);
    const src = readFileSync(path.resolve(__dirname, "../catalogue-ia.ts"), "utf8");
    expect(src).not.toMatch(/noteDevisFr/);
    expect(src).not.toMatch(/function typeTarifDuTier/);
  });

  it("contre-témoin : un palier à prix ferme reste « fixe »", async () => {
    const catalogue = await chargerCatalogue();
    const fixes = catalogue.entrees.filter((x) => x.typeTarif === "fixe");
    for (const e of fixes) {
      const tier = findPricingTier(e.ref.replace(/^TIER:/, ""));
      expect(tier?.isFromPrice ?? false, e.ref).toBe(false);
    }
  });
});

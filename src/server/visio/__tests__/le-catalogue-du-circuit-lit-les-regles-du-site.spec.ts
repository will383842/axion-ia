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
 * Même règle pour les offres `OFF:` : le type vient de la COLONNE
 * `tarifType` (la valeur enregistrée), jamais redérivé du prix — une offre de
 * matrice enregistrée « à partir de » n'est jamais chiffrée par C4.
 * Mutation qui rougit : redériver le type depuis `prixHtEur`.
 * Contre-témoin : un palier à prix ferme reste « fixe ».
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const offres = vi.hoisted(() => ({ liste: [] as unknown[] }));
vi.mock("@/server/qualiopi/offres/offres", () => ({ listOffres: async () => offres.liste }));

/** Une offre du site telle que `listOffres` la rend (champs lus par le catalogue). */
function offre(
  code: string,
  tarifType: "fixe" | "a_partir_de" | "sur_devis",
  prixHtEur: number | null,
) {
  return {
    offre: {
      code,
      titreFr: `Offre ${code}`,
      categorie: "formation",
      dureeHeuresMin: 7,
      dureeHeuresMax: 7,
      tarifType,
      tierId: null,
      gamme: null,
      dureeCode: null,
    },
    prixHtEur,
  };
}

import {
  deriveTarifType,
  findPricingTier,
  resolveOffreEffectifFr,
} from "@/server/qualiopi/offres/pricing-resolver";
import { chargerCatalogue, chiffrerEbauche } from "../catalogue-ia";

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
  it("une offre enregistrée « à partir de » le reste, même avec un prix : C4 ne la chiffre pas", async () => {
    offres.liste = [
      offre("MATRICE", "a_partir_de", 1200),
      offre("FERME", "fixe", 900),
      offre("SANSPRIX", "fixe", null),
      offre("DEVIS", "sur_devis", null),
    ];
    try {
      const catalogue = await chargerCatalogue();
      const type = (ref: string) => catalogue.entrees.find((e) => e.ref === ref)?.typeTarif;
      expect(type("OFF:MATRICE")).toBe("a_partir_de");
      expect(type("OFF:FERME")).toBe("fixe");
      expect(type("OFF:SANSPRIX")).toBe("a_partir_de");
      expect(type("OFF:DEVIS")).toBe("sur_devis");
      const c = chiffrerEbauche(
        [
          { ref_catalogue: "OFF:MATRICE", quantite: 1, unite: "session" },
          { ref_catalogue: "OFF:FERME", quantite: 2, unite: "session" },
        ],
        catalogue,
      );
      expect(c.lignes.map((l) => l.totalHtCents)).toEqual([null, 180_000]);
    } finally {
      offres.liste = [];
    }
  });
});

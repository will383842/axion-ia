import { describe, it, expect } from "vitest";
import {
  campaignNafPrefixes,
  nafMatchesPrefixes,
  cellsFromStockRefs,
  decideCellOutcome,
  type StockRefRow,
} from "./campaign-expansion";

describe("campaignNafPrefixes", () => {
  it("union des préfixes secteurs + codes NAF explicites", () => {
    const p = campaignNafPrefixes({
      departements: ["38"],
      secteurs: ["btp"],
      nafCodes: ["62.01Z"],
      tailles: ["PME"],
    });
    expect(p).toEqual(expect.arrayContaining(["41", "42", "43", "6201"]));
  });
});

describe("nafMatchesPrefixes", () => {
  it("match par préfixe chiffres", () => {
    expect(nafMatchesPrefixes("41.20A", ["41", "42"])).toBe(true);
    expect(nafMatchesPrefixes("86.10Z", ["41", "42"])).toBe(false);
  });
});

describe("cellsFromStockRefs", () => {
  const refs: StockRefRow[] = [
    { departement: "38", naf: "41.20A", taille: "PME", stockAttendu: 12 },
    { departement: "38", naf: "86.10Z", taille: "PME", stockAttendu: 8 }, // hors secteur BTP
    { departement: "38", naf: "43.99Z", taille: "GE", stockAttendu: 2 }, // hors taille
    { departement: "69", naf: "41.20A", taille: "PME", stockAttendu: 5 }, // hors dép
    { departement: "38", naf: "42.11Z", taille: "PME", stockAttendu: 0 }, // vide
  ];
  it("ne garde que dép ∈, taille ∈, préfixe secteur, attendu>0", () => {
    const cells = cellsFromStockRefs(
      { departements: ["38"], secteurs: ["btp"], nafCodes: [], tailles: ["PME"] },
      refs,
    );
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({
      departement: "38",
      naf: "41.20A",
      taille: "PME",
      secteur: "btp",
      region: "84",
      attendu: 12,
    });
  });
  it("sans secteurs ni nafCodes → tous les dép×taille peuplés (pas de filtre NAF)", () => {
    const cells = cellsFromStockRefs(
      { departements: ["38"], secteurs: [], nafCodes: [], tailles: ["PME"] },
      refs,
    );
    // 41.20A et 86.10Z (PME, dép 38, attendu>0) — pas 42.11Z (attendu 0)
    expect(cells.map((c) => c.naf).sort()).toEqual(["41.20A", "86.10Z"]);
  });
});

describe("decideCellOutcome", () => {
  it("collecte ≥ attendu → fait", () => {
    expect(decideCellOutcome(12, 12)).toBe("fait");
    expect(decideCellOutcome(13, 12)).toBe("fait");
  });
  it("collecte < attendu → erreur (jamais fait sur cellule tronquée)", () => {
    expect(decideCellOutcome(11, 12)).toBe("erreur");
  });
  it("tolérance : accepte un léger déficit (cessations concurrentes)", () => {
    expect(decideCellOutcome(95, 100, 0.05)).toBe("fait"); // seuil 95
    expect(decideCellOutcome(94, 100, 0.05)).toBe("erreur");
  });
});

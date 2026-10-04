/**
 * Tests — bareme-opco-branche.ts (lot A4) : choix du barème par branche (IDCC)
 * et par tranche d'effectif. Module PUR : aucune base, aucun mock.
 */

import { describe, it, expect } from "vitest";
import {
  choisirBaremeBranche,
  effectifDuClient,
  horsFondsLegaux,
  idccValide,
  tranchesCandidates,
  trancheEffectifDe,
} from "./bareme-opco-branche";

type Ligne = { id: string; idcc: string | null; trancheEffectif: string; dateEffet: Date };

const l = (id: string, idcc: string | null, tranche: string, dateEffet = "2026-01-01"): Ligne => ({
  id,
  idcc,
  trancheEffectif: tranche,
  dateEffet: new Date(dateEffet),
});

describe("trancheEffectifDe", () => {
  it("< 11 → moins_11 ; 11 à 49 → de_11_a_49", () => {
    expect(trancheEffectifDe(0)).toBe("moins_11");
    expect(trancheEffectifDe(10)).toBe("moins_11");
    expect(trancheEffectifDe(11)).toBe("de_11_a_49");
    expect(trancheEffectifDe(49)).toBe("de_11_a_49");
  });
  it("effectif inconnu ou ≥ 50 → aucune tranche exacte", () => {
    expect(trancheEffectifDe(undefined)).toBeNull();
    expect(trancheEffectifDe(null)).toBeNull();
    expect(trancheEffectifDe(50)).toBeNull();
  });
  it("tranches candidates : effectif inconnu → `tous` seulement", () => {
    expect(tranchesCandidates(undefined)).toEqual(["tous"]);
    expect(tranchesCandidates(30)).toEqual(["de_11_a_49", "tous"]);
  });
});

describe("horsFondsLegaux (art. L6332-17 C. trav.)", () => {
  it("vrai à partir de 50 salariés, faux sinon ou si l'effectif est inconnu", () => {
    expect(horsFondsLegaux(50)).toBe(true);
    expect(horsFondsLegaux(49)).toBe(false);
    expect(horsFondsLegaux(undefined)).toBe(false);
  });
});

describe("idccValide", () => {
  it("ne garde qu'un IDCC d'exactement 4 chiffres", () => {
    expect(idccValide("1516")).toBe("1516");
    expect(idccValide(" 1516 ")).toBe("1516");
    expect(idccValide("516")).toBeNull();
    expect(idccValide("IDCC 1516")).toBeNull();
    expect(idccValide("15160")).toBeNull();
    expect(idccValide(null)).toBeNull();
  });
});

describe("effectifDuClient", () => {
  it("lit `effectif` s'il existe et est un entier positif, sans exiger le champ", () => {
    expect(effectifDuClient({ effectif: 12 })).toBe(12);
    expect(effectifDuClient({})).toBeUndefined();
    expect(effectifDuClient({ effectif: null })).toBeUndefined();
    expect(effectifDuClient({ effectif: -1 })).toBeUndefined();
    expect(effectifDuClient(null)).toBeUndefined();
  });
});

describe("choisirBaremeBranche — ordre de priorité", () => {
  const lignes = [
    l("opco-tous", null, "tous"),
    l("opco-11-49", null, "de_11_a_49"),
    l("idcc-tous", "1516", "tous"),
    l("idcc-11-49", "1516", "de_11_a_49"),
  ];

  it("barème de branche + tranche exacte en premier", () => {
    expect(choisirBaremeBranche(lignes, { idcc: "1516", effectif: 20 })?.id).toBe("idcc-11-49");
  });
  it("barème de branche prioritaire sur barème OPCO (même avec tranche exacte côté OPCO)", () => {
    const sansTrancheBranche = lignes.filter((x) => x.id !== "idcc-11-49");
    expect(choisirBaremeBranche(sansTrancheBranche, { idcc: "1516", effectif: 20 })?.id).toBe(
      "idcc-tous",
    );
  });
  it("sans barème de branche : tranche 11-49 de l'OPCO appliquée", () => {
    expect(choisirBaremeBranche(lignes, { idcc: "9999", effectif: 20 })?.id).toBe("opco-11-49");
  });
  it("effectif inconnu → seulement les barèmes `tous`", () => {
    expect(choisirBaremeBranche(lignes, { idcc: "1516" })?.id).toBe("idcc-tous");
    expect(choisirBaremeBranche(lignes, {})?.id).toBe("opco-tous");
    expect(choisirBaremeBranche([l("x", null, "moins_11")], {})).toBeNull();
  });
  it("à priorité égale, la date d'effet la plus récente gagne", () => {
    const deux = [l("ancien", null, "tous", "2025-01-01"), l("recent", null, "tous", "2026-06-01")];
    expect(choisirBaremeBranche(deux, {})?.id).toBe("recent");
  });
  it("aucune ligne applicable → null", () => {
    expect(choisirBaremeBranche([], { idcc: "1516", effectif: 5 })).toBeNull();
  });
});

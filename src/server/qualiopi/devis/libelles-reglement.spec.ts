import { describe, expect, it } from "vitest";
import { libelleReglementDevis, libellesReglementDevis } from "./libelles-reglement";

// Tables d'origine, copiées de `origin/main` avant la PR B6b-1.
const ORIGINE_LISTE = {
  direct: "Direct",
  opco: "OPCO",
  cpf: "CPF",
  france_travail: "France Travail",
};
const ORIGINE_FICHE = {
  direct: "Direct (entreprise)",
  opco: "OPCO",
  cpf: "CPF / EDOF",
  france_travail: "France Travail",
};

describe("libellesReglementDevis — avec certification : table d'origine à l'identique", () => {
  it("liste", () => expect(libellesReglementDevis(true, "liste")).toEqual(ORIGINE_LISTE));
  it("fiche", () => expect(libellesReglementDevis(true, "fiche")).toEqual(ORIGINE_FICHE));
});

describe("libellesReglementDevis — sans certification", () => {
  for (const variante of ["liste", "fiche"] as const) {
    it(`${variante} : modes connus neutres, aucun mot interdit`, () => {
      const t = libellesReglementDevis(false, variante);
      expect(t.direct).toBe("Règlement direct");
      for (const m of ["opco", "cpf", "france_travail"]) {
        expect(t[m]).toBe("Règlement par un tiers (ancien devis)");
      }
      for (const v of Object.values(t)) {
        expect(v).not.toMatch(/opco|cpf|france travail|financ|qualiopi/i);
      }
    });
    it(`${variante} : la table ne contient que les modes connus`, () => {
      expect(Object.keys(libellesReglementDevis(false, variante)).sort()).toEqual([
        "cpf",
        "direct",
        "france_travail",
        "opco",
      ]);
    });
  }
});

describe("libelleReglementDevis — mode inconnu", () => {
  it("sans certification : « Autre mode de règlement », jamais la valeur brute", () => {
    for (const v of ["liste", "fiche"] as const) {
      expect(libelleReglementDevis("opco_special_cpf", false, v)).toBe("Autre mode de règlement");
    }
  });
  it("avec certification : repli actuel (valeur brute)", () => {
    expect(libelleReglementDevis("zzz", true, "liste")).toBe("zzz");
  });
  it("mode connu : libellé de la table", () => {
    expect(libelleReglementDevis("cpf", true, "liste")).toBe("CPF");
    expect(libelleReglementDevis("cpf", false, "fiche")).toBe(
      "Règlement par un tiers (ancien devis)",
    );
  });
});

import { describe, expect, it } from "vitest";
import { filtrerInterdits, verdictRequete } from "../interdits";

const VILLE = ["gren", "oble"].join("");

describe("verdictRequete", () => {
  it("exclut la requête qui contient la ville interdite, casse et accents indifférents", () => {
    expect(verdictRequete(`formation ia ${VILLE}`).exclue).toBe(true);
    expect(verdictRequete(`FORMATION IA ${VILLE.toUpperCase()}`).raisons).toContain("grenoble");
    expect(verdictRequete("formation ia lyon").exclue).toBe(false);
  });

  it("exclut un mot interdit de publication", () => {
    const v = verdictRequete("formation ia qualiopi");
    expect(v.exclue).toBe(true);
    expect(v.raisons).toContain("qualiopi");
  });

  it("garde une requête ordinaire", () => {
    expect(verdictRequete("formation ia pour les pme")).toEqual({ exclue: false, raisons: [] });
  });

  it("requête vide : non exclue", () => {
    expect(verdictRequete("")).toEqual({ exclue: false, raisons: [] });
  });
});

describe("filtrerInterdits", () => {
  it("sépare retenues et exclues sans rien supprimer des mesures", () => {
    const entree = [
      { requete: "formation ia pme", impressions: 10 },
      { requete: `ia ${VILLE}`, impressions: 7 },
    ];
    const r = filtrerInterdits(entree);
    expect(r.retenues).toEqual([entree[0]]);
    expect(r.exclues).toEqual([{ ligne: entree[1], raisons: ["grenoble"] }]);
  });
});

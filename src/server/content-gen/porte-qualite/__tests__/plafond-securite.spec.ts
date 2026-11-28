import { describe, expect, it, vi } from "vitest";
import {
  PLAFOND_SECURITE_PAR_DEFAUT,
  calculerPlafondSecurite,
  reglagePlafondDepuisConfig,
} from "../plafond-securite";
import { appliquerPointFinal, DRAPEAU_POINT_FINAL } from "../point-final";
import { corpsValide, REPONSE_DIRECTE } from "./fixtures";

const R = reglagePlafondDepuisConfig(null);

describe("plafond de sécurité = minimum de toutes les limites", () => {
  it("défaut bas, et la rampe existante ne le relève jamais", () => {
    expect(R.plafondJour).toBe(PLAFOND_SECURITE_PAR_DEFAUT);
    expect(calculerPlafondSecurite(R, [150, 300, 1000])).toEqual({ plafond: 3, limitant: "porte" });
  });
  it("un plafond existant plus bas l'emporte", () => {
    expect(
      calculerPlafondSecurite(reglagePlafondDepuisConfig({ plafondJour: 50 }), [20, null, 0]),
    ).toEqual({
      plafond: 20,
      limitant: "existant",
    });
  });
  it("capacité de relecture et coût (budget / coût par contenu)", () => {
    const base = { plafondJour: 50 };
    expect(
      calculerPlafondSecurite(
        reglagePlafondDepuisConfig({ ...base, capaciteRelectureJour: 4 }),
        [],
      ),
    ).toEqual({
      plafond: 4,
      limitant: "relecture",
    });
    expect(
      calculerPlafondSecurite(
        reglagePlafondDepuisConfig({ ...base, budgetJourUsd: 10, coutParContenuUsd: 3 }),
        [],
      ),
    ).toEqual({ plafond: 3, limitant: "cout" });
  });
  it("le plafond de la porte peut être 0 (pause) et une valeur illisible ne le relève pas", () => {
    expect(
      calculerPlafondSecurite(reglagePlafondDepuisConfig({ plafondJour: 0 }), []).plafond,
    ).toBe(0);
    for (const v of ["99", -1, NaN, Infinity, null]) {
      expect(reglagePlafondDepuisConfig({ plafondJour: v }).plafondJour).toBe(
        PLAFOND_SECURITE_PAR_DEFAUT,
      );
    }
  });
});

describe("B17 branché sur le plafond (point final)", () => {
  const sortie = {
    title: "t",
    bodyHtml: corpsValide(),
    directAnswer: REPONSE_DIRECTE,
  };
  const env = { [DRAPEAU_POINT_FINAL]: "true" };
  const mk = (publie: number, plafond: number | null) => ({
    lireConfig: vi.fn(async () => null),
    ecrireVerdict: vi.fn(async () => undefined),
    maintenant: () => new Date("2026-11-28T10:00:00Z"),
    journal: vi.fn(),
    plafond: { plafondSecurite: async () => plafond, compterPublies: async () => publie },
  });
  it("plafond atteint : report sans verdict ; en dessous : la porte décide", async () => {
    const d = mk(3, 3);
    expect(
      (await appliquerPointFinal({ jobId: "j", contentType: "blog_article", sortie }, d, env))
        .action,
    ).toBe("reporter");
    expect(d.ecrireVerdict).not.toHaveBeenCalled();
    const d2 = mk(2, 3);
    expect(
      (await appliquerPointFinal({ jobId: "j", contentType: "blog_article", sortie }, d2, env))
        .action,
    ).not.toBe("reporter");
  });
  it("lecture du plafond en panne : report", async () => {
    const d = mk(0, 3);
    d.plafond.plafondSecurite = async () => Promise.reject(new Error("db"));
    expect(
      (await appliquerPointFinal({ jobId: "j", contentType: "blog_article", sortie }, d, env))
        .action,
    ).toBe("reporter");
  });
  it("drapeau éteint : le plafond n'est jamais lu", async () => {
    const d = mk(99, 1);
    const spy = vi.spyOn(d.plafond, "plafondSecurite");
    expect(
      (await appliquerPointFinal({ jobId: "j", contentType: "blog_article", sortie }, d, {}))
        .action,
    ).toBe("inerte");
    expect(spy).not.toHaveBeenCalled();
  });
});

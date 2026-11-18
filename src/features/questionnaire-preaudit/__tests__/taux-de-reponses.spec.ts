import { describe, expect, it } from "vitest";

import { estRempliePourLaPage, squeletteDuHtml, tauxDeReponses } from "../squelette";
import { HTML_SYNTHETIQUE } from "./squelette.fixture";

const sq = squeletteDuHtml(HTML_SYNTHETIQUE);

describe("estRempliePourLaPage", () => {
  it("un {id} seul n'est pas rempli", () => {
    expect(estRempliePourLaPage([{ id: "abc123abc123" }])).toBe(false);
    expect(estRempliePourLaPage([{ id: "abc", prenom: "A" }])).toBe(true);
    expect(estRempliePourLaPage({ _x: "y" })).toBe(false);
    expect(estRempliePourLaPage("  ")).toBe(false);
    expect(estRempliePourLaPage(0)).toBe(true);
  });
});

describe("tauxDeReponses", () => {
  it("100 % quand tout l'essentiel est rempli, le reste compte en plus", () => {
    const t = tauxDeReponses({ a_nom: "x", m_1: "y", m_2: "y", t_1: "y", a_plus: "z" }, sq, "main");
    expect(t).toMatchObject({ essentiellesRemplies: 4, essentiellesTotal: 4, pourcentage: 100 });
    expect(t.reponsesEnPlus).toBe(1);
    expect(t.estimation).toBe(true); // 2 éléments non analysables
  });
  it("pourcentage partiel", () => {
    expect(tauxDeReponses({ b_1: "x", m_1: "x" }, sq, "emp").pourcentage).toBe(50);
    expect(tauxDeReponses({ b_1: "x", m_1: "x" }, sq, "emp").estimation).toBe(false);
  });
  it("plafonne à 99 tant qu'il en manque une", () => {
    const fake = {
      parcours: {
        ...sq!.parcours,
        emp: {
          ...sq!.parcours.emp,
          essentielles: new Set(Array.from({ length: 300 }, (_, i) => `q${i}`)),
        },
      },
      niveauxConnus: true,
    };
    const vals = Object.fromEntries(Array.from({ length: 299 }, (_, i) => [`q${i}`, "x"]));
    expect(tauxDeReponses(vals, fake, "emp").pourcentage).toBe(99);
  });
  it("champ prérempli (pre) non compté", () => {
    const t = tauxDeReponses({ b_1: "x", m_1: "y" }, sq, "emp", new Set(["b_1"]));
    expect(t.essentiellesRemplies).toBe(1);
  });
  it("conditionnelle remplie : des deux côtés", () => {
    const t = tauxDeReponses({ a_nom: "x", m_1: "y", a_cond: "z" }, sq, "main");
    expect(t).toMatchObject({ essentiellesRemplies: 3, essentiellesTotal: 5 });
  });
  it("squelette null : pas de pourcentage", () => {
    expect(tauxDeReponses({ a: "x" }, null, "main").pourcentage).toBeNull();
  });
  it("clés _ ignorées", () => {
    expect(tauxDeReponses({ _a_nom: "x" }, sq, "main").essentiellesRemplies).toBe(0);
  });
});

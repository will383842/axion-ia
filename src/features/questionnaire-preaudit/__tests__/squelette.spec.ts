import { describe, expect, it } from "vitest";

import { elementsDeNiveau1, finDuBloc, squeletteDuHtml } from "../squelette";
import { HTML_SYNTHETIQUE } from "./squelette.fixture";

describe("lecteur de blocs", () => {
  it("saute chaînes, commentaires et regex", () => {
    const s = `[ "a]", '}', /[\\]]/, // fin ]\n /* ] */ x ]`;
    expect(finDuBloc(s, 0)).toBe(s.length - 1);
  });
  it("découpe aux virgules de profondeur 0", () => {
    expect(elementsDeNiveau1(`a(1,2), "x,y", [3,4], /,/.test(z)`)).toEqual([
      "a(1,2)",
      '"x,y"',
      "[3,4]",
      "/,/.test(z)",
    ]);
  });
});

describe("squeletteDuHtml", () => {
  const sq = squeletteDuHtml(HTML_SYNTHETIQUE);
  it("lit le fichier synthétique", () => {
    expect(sq).not.toBeNull();
    expect(sq!.niveauxConnus).toBe(true);
  });
  it("dirigeant : sections only main, assistants, ternaire MODE", () => {
    const p = sq!.parcours.main;
    expect([...p.essentielles].sort()).toEqual(["a_nom", "m_1", "m_2", "t_1"]);
    expect([...p.essentiellesConditionnelles]).toEqual(["a_cond"]);
    for (const id of [
      "c_un",
      "s_un",
      "a_mode_main",
      "a_court",
      "a_plus",
      "equipe",
      "a_modele",
      "m_2",
    ]) {
      expect(p.toutes.has(id)).toBe(true);
    }
    expect(p.toutes.has("a_mode_autre")).toBe(false);
    expect(p.toutes.has("a_pour_emp")).toBe(false);
    expect(p.toutes.has("c_titre")).toBe(false);
    expect(p.toutes.has("c_deleg")).toBe(false);
    expect(p.toutes.has("z_envoi")).toBe(false);
    expect(p.toutes.has("prenom")).toBe(false);
    expect(p.toutes.has("b_1")).toBe(false);
  });
  it("assistant à paramètres et id non littéral : non analysables", () => {
    expect(sq!.parcours.main.nonAnalysables).toBe(2);
    expect(sq!.parcours.emp.nonAnalysables).toBe(0);
  });
  it("collaborateur : niveau 1, conditionnelle à part", () => {
    const p = sq!.parcours.emp;
    expect([...p.essentielles].sort()).toEqual(["b_1", "m_1", "m_2", "t_1"]);
    expect(p.essentiellesConditionnelles.size).toBe(0);
    expect(p.toutes.has("b_2")).toBe(true);
    expect(p.toutes.has("b_it")).toBe(false);
    expect(p.toutes.has("u_1")).toBe(false);
  });
  it("référent : sections it:true et only it", () => {
    const p = sq!.parcours.it;
    expect(p.essentielles.has("t_1")).toBe(true);
    expect(p.essentielles.has("t_3")).toBe(true);
    expect(p.essentielles.has("u_1")).toBe(true);
    expect(p.essentielles.has("b_it")).toBe(false);
    expect(p.essentiellesConditionnelles.has("t_2")).toBe(true);
    expect(p.toutes.has("a_nom")).toBe(false);
  });
  it("SECTIONS absent : null", () => {
    expect(squeletteDuHtml("<html><body>rien</body></html>")).toBeNull();
  });
  it("sans LVL1 : niveaux inconnus", () => {
    const sans = HTML_SYNTHETIQUE.replace(/const LVL1[^\n]*\n/, "");
    expect(squeletteDuHtml(sans)!.niveauxConnus).toBe(false);
  });
});

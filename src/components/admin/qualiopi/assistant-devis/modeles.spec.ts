import { describe, expect, it } from "vitest";

import {
  MODELES_ACTIVITE,
  MODELES_ECHEANCIER,
  MODELES_PHASES,
  phasesDepuisModele,
} from "./modeles";

const INTERDITS = [/grenoble/i, /aucun gain garanti/i, /capital social/i, /\bWill\b(?!iams)/];
const tousTextes = (): string[] =>
  JSON.stringify([MODELES_ACTIVITE, MODELES_PHASES, MODELES_ECHEANCIER]).split('"');

describe("modèles prêts à l'emploi", () => {
  it("aucun modèle ne porte de montant : tout prix vaut une chaîne vide", () => {
    for (const m of MODELES_ACTIVITE) {
      expect(m.lignes.length).toBeGreaterThan(0);
      for (const l of m.lignes) expect(l.prixEur).toBe("");
    }
  });

  it("propose les cinq activités du moteur, une fois chacune", () => {
    expect(MODELES_ACTIVITE.map((m) => m.activite).sort()).toEqual(
      ["audit", "formation", "implementation", "site_web", "un_a_un"].sort(),
    );
  });

  it("chaque modèle de phases totalise 100 %", () => {
    expect(Object.keys(MODELES_PHASES).sort()).toEqual(["complet", "composer", "court"]);
    for (const m of Object.values(MODELES_PHASES)) {
      expect(m.phases.reduce((s, p) => s + p.pourcentage, 0)).toBe(100);
    }
    expect(MODELES_PHASES.complet.phases).toHaveLength(6);
    expect(MODELES_PHASES.court.phases).toHaveLength(3);
  });

  it("modèles d'échéancier : 100 %, 50/50, 30/30/solde, composer", () => {
    const pct = (k: keyof typeof MODELES_ECHEANCIER) =>
      MODELES_ECHEANCIER[k].phases.map((p) => p.pourcentage);
    expect(pct("cent")).toEqual([100]);
    expect(pct("moitie")).toEqual([50, 50]);
    expect(pct("trente_trente_solde")).toEqual([30, 30, 40]);
    expect(pct("composer")).toEqual([100]);
    for (const m of Object.values(MODELES_ECHEANCIER)) {
      expect(m.phases.reduce((s, p) => s + p.pourcentage, 0)).toBe(100);
    }
  });

  it("phasesDepuisModele produit des phases à ids uniques, pourcentages en chaînes", () => {
    let n = 0;
    const phases = phasesDepuisModele(MODELES_PHASES.complet, () => `p-${++n}`);
    expect(new Set(phases.map((p) => p.id)).size).toBe(6);
    expect(phases.map((p) => p.pourcentage)).toEqual(["20", "20", "20", "15", "15", "10"]);
    expect(phases.every((p) => typeof p.delaiSemaines === "string")).toBe(true);
  });

  it("aucun texte ne contient de mot interdit", () => {
    for (const t of tousTextes()) for (const re of INTERDITS) expect(t).not.toMatch(re);
  });
});

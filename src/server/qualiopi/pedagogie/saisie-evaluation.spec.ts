import { describe, expect, it } from "vitest";
import { OBSERVATION_MIN, validerSaisieEvaluation } from "./saisie-evaluation";

const OBJECTIFS = ["Rédiger un prompt", "Vérifier une réponse"];
const obs = "Maîtrise constatée en atelier.";

describe("validerSaisieEvaluation", () => {
  it("accepte une note et une observation par objectif", () => {
    const r = validerSaisieEvaluation({
      objectifs: OBJECTIFS,
      notes: [3, 2],
      observations: [obs, "  À consolider sur les sources.  "],
    });
    expect(r).toEqual({
      ok: true,
      competences: [
        {
          libelle: "Rédiger un prompt",
          note: 3,
          observations: obs,
          objectifRef: "Rédiger un prompt",
        },
        {
          libelle: "Vérifier une réponse",
          note: 2,
          observations: "À consolider sur les sources.",
          objectifRef: "Vérifier une réponse",
        },
      ],
    });
  });

  it("refuse une observation absente ou trop courte : la grille doit dire POURQUOI", () => {
    for (const o of ["", "   ", "x".repeat(OBSERVATION_MIN - 1)]) {
      const r = validerSaisieEvaluation({
        objectifs: OBJECTIFS,
        notes: [3, 3],
        observations: [obs, o],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erreurs[0]).toMatch(/Vérifier une réponse/);
    }
  });

  it("refuse une note manquante ou hors 1-3, sans l'inventer", () => {
    for (const n of [[3], [3, 4], [3, 0], [3, 2.5], [3, Number.NaN]]) {
      expect(
        validerSaisieEvaluation({ objectifs: OBJECTIFS, notes: n, observations: [obs, obs] }).ok,
      ).toBe(false);
    }
  });

  it("refuse une formation sans objectif (rien à évaluer)", () => {
    expect(validerSaisieEvaluation({ objectifs: [], notes: [], observations: [] }).ok).toBe(false);
  });

  it("signale TOUTES les erreurs d'un coup", () => {
    const r = validerSaisieEvaluation({ objectifs: OBJECTIFS, notes: [], observations: [] });
    expect(!r.ok && r.erreurs.length).toBe(4);
  });

  it("borne la recommandation facultative", () => {
    const r = validerSaisieEvaluation({
      objectifs: ["A"],
      notes: [3],
      observations: [obs],
      recommandations: "  Poursuivre.  ",
    });
    expect(r.ok && r.recommandations).toBe("Poursuivre.");
    expect(
      validerSaisieEvaluation({
        objectifs: ["A"],
        notes: [3],
        observations: [obs],
        recommandations: "x".repeat(2001),
      }).ok,
    ).toBe(false);
  });
});

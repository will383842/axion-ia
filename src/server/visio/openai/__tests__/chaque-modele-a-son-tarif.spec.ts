/**
 * CHAQUE MODÈLE A SON TARIF (ADR 0055 §1.4).
 *
 * Un modèle ajouté à `MODELES_VISIO` sans tarif serait tracé à 0 $ — donc
 * invisible sous le plafond partagé avec content-gen. Et un modèle inconnu
 * LÈVE (jamais 0 $ en silence).
 */

import { describe, expect, it } from "vitest";

import { MODELES_VISIO } from "../modeles";
import { coutUsd, TARIFS_OPENAI_VISIO, tarifDe } from "../tarifs";

describe("chaque modèle a son tarif", () => {
  it("un tarif non nul pour chaque modèle du circuit", () => {
    for (const m of MODELES_VISIO) {
      expect(TARIFS_OPENAI_VISIO[m], m).toBeDefined();
      expect(TARIFS_OPENAI_VISIO[m].entreeParMillion).toBeGreaterThan(0);
      expect(TARIFS_OPENAI_VISIO[m].sortieParMillion).toBeGreaterThan(0);
    }
  });

  it("le calcul suit le tarif (cache compris) et la durée quand l'API ne rend pas de jetons", () => {
    // gpt-6-sol : 800 hors cache × 2 $ + 200 en cache × 0,20 $ + 300 × 10 $, par million.
    expect(
      coutUsd("gpt-6-sol", {
        jetonsEntree: 1000,
        jetonsEntreeEnCache: 200,
        jetonsSortie: 300,
        secondesAudio: null,
      }),
    ).toBeCloseTo((800 * 2 + 200 * 0.2 + 300 * 10) / 1_000_000, 10);
    expect(
      coutUsd("gpt-4o-transcribe-diarize", {
        jetonsEntree: 0,
        jetonsEntreeEnCache: 0,
        jetonsSortie: 0,
        secondesAudio: 180,
      }),
    ).toBeCloseTo(0.018, 6);
  });

  it("un modèle servi avec un suffixe de version garde son tarif ; un inconnu lève", () => {
    expect(tarifDe("gpt-6-sol-2026-09-01")).toBe(TARIFS_OPENAI_VISIO["gpt-6-sol"]);
    expect(() => tarifDe("gpt-inconnu")).toThrow(/aucun tarif/);
  });
});

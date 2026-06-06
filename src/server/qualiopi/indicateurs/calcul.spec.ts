/**
 * Tests — calcul.ts (T10 — AGENT A).
 *
 * Module PUR : aucun mock nécessaire.
 */

import { describe, it, expect } from "vitest";
import {
  computeTauxSatisfaction,
  computeTauxReussite,
  computeTauxCompletion,
  computeDelaiAccesMoyen,
} from "./calcul";

// ─────────────────────────────────────────────────────────────────────────────
// computeTauxSatisfaction
// ─────────────────────────────────────────────────────────────────────────────

describe("computeTauxSatisfaction", () => {
  it("retourne 0 et fiable=false si tableau vide", () => {
    const result = computeTauxSatisfaction([]);
    expect(result).toEqual({ tauxPct: 0, nb: 0, fiable: false });
  });

  it("calcule 100 % pour des notes toutes à 5", () => {
    const notes = [5, 5, 5, 5, 5];
    const result = computeTauxSatisfaction(notes);
    expect(result.tauxPct).toBe(100);
    expect(result.nb).toBe(5);
    expect(result.fiable).toBe(true);
  });

  it("calcule 60 % pour des notes toutes à 3", () => {
    const notes = [3, 3, 3, 3, 3];
    const result = computeTauxSatisfaction(notes);
    expect(result.tauxPct).toBe(60);
    expect(result.fiable).toBe(true);
  });

  it("calcule 20 % pour des notes toutes à 1", () => {
    const notes = [1, 1, 1, 1, 1];
    const result = computeTauxSatisfaction(notes);
    expect(result.tauxPct).toBe(20);
  });

  it("arrondit à 1 décimale", () => {
    // moyenne = (4+5)/2 = 4.5 → 4.5/5*100 = 90.0
    const result = computeTauxSatisfaction([4, 5]);
    expect(result.tauxPct).toBe(90);
  });

  it("arrondit correctement un résultat non entier", () => {
    // moyenne = (4+4+5)/3 = 4.333... → 4.333.../5*100 = 86.66... → 86.7
    const result = computeTauxSatisfaction([4, 4, 5]);
    expect(result.tauxPct).toBe(86.7);
  });

  it("marque fiable=false si nb < 5", () => {
    const result = computeTauxSatisfaction([5, 5, 5, 5]);
    expect(result.fiable).toBe(false);
    expect(result.nb).toBe(4);
  });

  it("marque fiable=true si nb >= 5", () => {
    const result = computeTauxSatisfaction([5, 5, 5, 5, 5]);
    expect(result.fiable).toBe(true);
  });

  it("retourne le bon nb", () => {
    const notes = [3, 4, 5, 5, 4, 3];
    const result = computeTauxSatisfaction(notes);
    expect(result.nb).toBe(6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeTauxReussite
// ─────────────────────────────────────────────────────────────────────────────

describe("computeTauxReussite", () => {
  it("retourne 0 et fiable=false si tableau vide", () => {
    const result = computeTauxReussite([]);
    expect(result).toEqual({ tauxPct: 0, nb: 0, nbValides: 0, fiable: false });
  });

  it("calcule 100 % si tous acquis", () => {
    const niveaux: Array<"acquis"> = ["acquis", "acquis", "acquis", "acquis", "acquis"];
    const result = computeTauxReussite(niveaux);
    expect(result.tauxPct).toBe(100);
    expect(result.nbValides).toBe(5);
    expect(result.fiable).toBe(true);
  });

  it("calcule 0 % si tous non_acquis", () => {
    const niveaux: Array<"non_acquis"> = [
      "non_acquis",
      "non_acquis",
      "non_acquis",
      "non_acquis",
      "non_acquis",
    ];
    const result = computeTauxReussite(niveaux);
    expect(result.tauxPct).toBe(0);
    expect(result.nbValides).toBe(0);
  });

  it("ne compte pas partiellement_acquis comme réussite", () => {
    const niveaux: Array<"non_acquis" | "partiellement_acquis" | "acquis"> = [
      "partiellement_acquis",
      "partiellement_acquis",
      "acquis",
      "acquis",
      "non_acquis",
    ];
    const result = computeTauxReussite(niveaux);
    expect(result.nbValides).toBe(2);
    expect(result.tauxPct).toBe(40);
  });

  it("arrondit à 1 décimale", () => {
    // 1 acquis / 3 = 33.33... → 33.3
    const niveaux: Array<"non_acquis" | "partiellement_acquis" | "acquis"> = [
      "acquis",
      "non_acquis",
      "non_acquis",
    ];
    const result = computeTauxReussite(niveaux);
    expect(result.tauxPct).toBe(33.3);
  });

  it("marque fiable=false si nb < 5", () => {
    const niveaux: Array<"acquis"> = ["acquis", "acquis", "acquis", "acquis"];
    const result = computeTauxReussite(niveaux);
    expect(result.fiable).toBe(false);
  });

  it("marque fiable=true si nb >= 5", () => {
    const niveaux: Array<"acquis"> = ["acquis", "acquis", "acquis", "acquis", "acquis"];
    const result = computeTauxReussite(niveaux);
    expect(result.fiable).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeTauxCompletion
// ─────────────────────────────────────────────────────────────────────────────

describe("computeTauxCompletion", () => {
  it("retourne 0 et fiable=false si tableau vide", () => {
    const result = computeTauxCompletion([], 80);
    expect(result).toEqual({ tauxPct: 0, nb: 0, fiable: false });
  });

  it("calcule 100 % si tous >= seuil", () => {
    const taux = [80, 90, 100, 85, 80];
    const result = computeTauxCompletion(taux, 80);
    expect(result.tauxPct).toBe(100);
    expect(result.nb).toBe(5);
    expect(result.fiable).toBe(true);
  });

  it("calcule 0 % si tous < seuil", () => {
    const taux = [70, 60, 50, 79, 40];
    const result = computeTauxCompletion(taux, 80);
    expect(result.tauxPct).toBe(0);
  });

  it("respecte la limite stricte (>= seuil, pas >)", () => {
    // exactement au seuil = complet
    const result = computeTauxCompletion([80, 79], 80);
    expect(result.tauxPct).toBe(50);
  });

  it("traite null comme < seuil (absent)", () => {
    const taux = [null, 90, null, 85, 80];
    const result = computeTauxCompletion(taux, 80);
    // 3 sur 5 >= 80
    expect(result.tauxPct).toBe(60);
  });

  it("marque fiable=false si nb < 5", () => {
    const result = computeTauxCompletion([80, 90, 85, 95], 80);
    expect(result.fiable).toBe(false);
  });

  it("arrondit à 1 décimale", () => {
    // 2/3 = 66.66... → 66.7
    const result = computeTauxCompletion([80, 80, 79], 80);
    expect(result.tauxPct).toBe(66.7);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeDelaiAccesMoyen
// ─────────────────────────────────────────────────────────────────────────────

describe("computeDelaiAccesMoyen", () => {
  it("retourne 0 jours et nb=0 si tableau vide", () => {
    const result = computeDelaiAccesMoyen([]);
    expect(result).toEqual({ jours: 0, nb: 0 });
  });

  it("calcule 1 jour pour une paire avec 1 jour d'écart", () => {
    const dateDebut = new Date("2026-06-11T00:00:00.000Z");
    const createdAt = new Date("2026-06-10T00:00:00.000Z");
    const result = computeDelaiAccesMoyen([{ dateDebut, createdAt }]);
    expect(result.jours).toBe(1);
    expect(result.nb).toBe(1);
  });

  it("calcule la moyenne sur plusieurs paires", () => {
    // 1 jour et 3 jours → moyenne = 2 jours
    const base = new Date("2026-06-10T00:00:00.000Z");
    const j1 = new Date("2026-06-11T00:00:00.000Z");
    const j3 = new Date("2026-06-13T00:00:00.000Z");
    const result = computeDelaiAccesMoyen([
      { dateDebut: j1, createdAt: base },
      { dateDebut: j3, createdAt: base },
    ]);
    expect(result.jours).toBe(2);
    expect(result.nb).toBe(2);
  });

  it("arrondit à 1 décimale", () => {
    // 1 jour + 2 jours = 3 jours / 2 = 1.5 → 1.5
    const base = new Date("2026-06-10T00:00:00.000Z");
    const j1 = new Date("2026-06-11T00:00:00.000Z");
    const j2 = new Date("2026-06-12T00:00:00.000Z");
    const result = computeDelaiAccesMoyen([
      { dateDebut: j1, createdAt: base },
      { dateDebut: j2, createdAt: base },
    ]);
    expect(result.jours).toBe(1.5);
  });

  it("gère les délais en heures (fraction de jour)", () => {
    // 12h = 0.5 jour
    const createdAt = new Date("2026-06-10T00:00:00.000Z");
    const dateDebut = new Date("2026-06-10T12:00:00.000Z");
    const result = computeDelaiAccesMoyen([{ dateDebut, createdAt }]);
    expect(result.jours).toBe(0.5);
  });
});

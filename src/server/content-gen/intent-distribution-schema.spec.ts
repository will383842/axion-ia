/**
 * Le module déclarait l'alias `commercial` ↔ `commercial_investigation` et
 * affirmait qu'il était « résolu dans l'orchestrateur ». Il ne l'était nulle
 * part : la clé passait la validation puis se perdait, et la part commerciale
 * de la répartition valait zéro en génération. Aucun test ne couvrait ce
 * module — d'où la dérive silencieuse.
 *
 * Ces cas sont écrits à partir de la configuration RÉELLE de production, lue
 * le 2026-08-03.
 */
import { describe, it, expect, vi } from "vitest";
import { validateIntentDistribution, toPourcentages } from "./intent-distribution-schema";

/** La ligne effectivement stockée en production. */
const CONFIG_PROD = {
  local: 0.1,
  navigational: 0.1,
  informational: 0.4,
  transactional: 0.15,
  commercial_investigation: 0.25,
};

const muet = (): void => {};

describe("validateIntentDistribution", () => {
  it("replie commercial_investigation sur l'alias que lisent les consommateurs", () => {
    const r = validateIntentDistribution(CONFIG_PROD, muet);
    expect(r["commercial"]).toBe(0.25);
    expect(r["commercial_investigation"]).toBeUndefined();
  });

  it("additionne les deux écritures de la part commerciale plutôt que d'en perdre une", () => {
    const r = validateIntentDistribution({ commercial: 10, commercial_investigation: 15 }, muet);
    expect(r["commercial"]).toBe(25);
  });

  it("conserve les autres parts inchangées", () => {
    const r = validateIntentDistribution(CONFIG_PROD, muet);
    expect(r).toEqual({
      local: 0.1,
      navigational: 0.1,
      informational: 0.4,
      transactional: 0.15,
      commercial: 0.25,
    });
  });

  it("ignore une clé inconnue en la signalant, sans jamais lever", () => {
    const warn = vi.fn();
    const r = validateIntentDistribution({ informational: 50, commercia: 50 }, warn);
    expect(r).toEqual({ informational: 50 });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("renvoie un objet vide sur une entrée qui n'est pas un objet", () => {
    expect(validateIntentDistribution(null, muet)).toEqual({});
    expect(validateIntentDistribution([1, 2], muet)).toEqual({});
    expect(validateIntentDistribution("50", muet)).toEqual({});
  });
});

describe("toPourcentages", () => {
  it("ramène les fractions de production à une somme de 100", () => {
    const pct = toPourcentages(validateIntentDistribution(CONFIG_PROD, muet));
    expect(Object.values(pct).reduce((s, v) => s + v, 0)).toBeCloseTo(100, 5);
    expect(pct["informational"]).toBe(40);
    expect(pct["commercial"]).toBe(25);
  });

  it("laisse inchangée une répartition déjà en pourcentages", () => {
    const pct = toPourcentages({
      informational: 50,
      commercial: 25,
      local: 15,
      transactional: 5,
      navigational: 5,
    });
    expect(pct["informational"]).toBe(50);
    expect(pct["navigational"]).toBe(5);
  });

  it("renvoie un objet vide plutôt qu'un NaN quand la somme est nulle", () => {
    expect(toPourcentages({})).toEqual({});
    expect(toPourcentages({ informational: 0, commercial: 0 })).toEqual({});
  });
});

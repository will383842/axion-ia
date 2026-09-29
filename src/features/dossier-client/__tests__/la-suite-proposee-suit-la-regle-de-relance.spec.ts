// @vitest-environment node
/**
 * La suite proposée par défaut sur « Après l'appel » suit la règle de
 * relance (décision B11, sur recommandation) : « Relance » dans
 * `RELANCE_PAR_DEFAUT_JOURS_OUVRES` jours ouvrés, week-end sauté, jour de
 * Paris. Une suite sans date ne se fait jamais.
 */

import { describe, expect, it } from "vitest";

import { RELANCE_PAR_DEFAUT_JOURS_OUVRES } from "../seuils";
import { jourOuvreApres, suiteParDefaut } from "../suite-proposee";

describe("la suite proposée suit la règle de relance", () => {
  it("un lundi : le lundi suivant (5 jours ouvrés)", () => {
    expect(RELANCE_PAR_DEFAUT_JOURS_OUVRES).toBe(5);
    expect(suiteParDefaut(new Date("2026-10-05T12:00:00Z"))).toEqual({
      suite: "relance",
      suiteLe: "2026-10-12",
    });
  });

  it("un jeudi : le jeudi suivant, le week-end sauté", () => {
    expect(jourOuvreApres(new Date("2026-10-08T12:00:00Z"), 5)).toBe("2026-10-15");
  });

  it("zéro jour : le jour même", () => {
    expect(jourOuvreApres(new Date("2026-10-08T12:00:00Z"), 0)).toBe("2026-10-08");
  });
});

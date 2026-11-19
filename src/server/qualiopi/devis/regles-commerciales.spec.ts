import { describe, it, expect } from "vitest";
import {
  refusReglesFormules,
  MSG_FORMULES_PARTICULIER,
  MSG_INDEMNITE_SORTIE,
} from "./regles-commerciales";

const abo = (taux: number) => ({ abonnement: { indemniteSortieTauxBps: taux } }) as never;

describe("refusReglesFormules", () => {
  it("refuse un particulier (D6), même avec indemnité à zéro", () => {
    expect(refusReglesFormules(abo(0), "particulier")).toBe(MSG_FORMULES_PARTICULIER);
  });
  it("refuse un taux d'indemnité non nul (D4)", () => {
    expect(refusReglesFormules(abo(5000), "entreprise")).toBe(MSG_INDEMNITE_SORTIE);
  });
  it("accepte un taux à zéro", () => {
    expect(refusReglesFormules(abo(0), "entreprise")).toBeNull();
  });
  it("accepte une offre sans abonnement", () => {
    expect(refusReglesFormules({ abonnement: undefined }, "entreprise")).toBeNull();
  });
  it("le message particulier passe avant celui de l'indemnité", () => {
    expect(refusReglesFormules(abo(5000), "particulier")).toBe(MSG_FORMULES_PARTICULIER);
  });
});

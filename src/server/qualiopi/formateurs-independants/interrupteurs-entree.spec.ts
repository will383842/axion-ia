/**
 * Lot L0g — registre des interrupteurs de l'ENTRÉE des formateurs freelance.
 * Ligne absente ou illisible = coupé, c'est-à-dire le comportement d'avant.
 */

import { describe, expect, it } from "vitest";

import {
  CLES_INTERRUPTEURS,
  CLES_INTERRUPTEURS_ENTREE,
  cleSettingEntree,
  estCleProtegee,
  etatsEntreeDepuisLignes,
  etatsEntreeParDefaut,
} from "./interrupteurs";

describe("interrupteurs de l'entrée", () => {
  it("l'interrupteur est absent par défaut, protégé, hors de la liste des seize", () => {
    expect(etatsEntreeParDefaut().nature_offre).toBe(false);
    expect(etatsEntreeDepuisLignes([]).nature_offre).toBe(false);
    expect(
      etatsEntreeDepuisLignes([{ key: "formateurs.nature_offre", value: { actif: "true" } }])
        .nature_offre,
    ).toBe(false);
    expect(
      etatsEntreeDepuisLignes([{ key: "formateurs.nature_offre", value: { actif: true } }])
        .nature_offre,
    ).toBe(true);
    expect(cleSettingEntree("nature_offre")).toBe("formateurs.nature_offre");
    for (const c of CLES_INTERRUPTEURS_ENTREE) {
      expect(estCleProtegee(cleSettingEntree(c))).toBe(true);
      expect((CLES_INTERRUPTEURS as readonly string[]).includes(c)).toBe(false);
    }
  });
});

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

  it("L0c-1 — le formulaire du formateur indépendant, coupé par défaut", () => {
    expect(CLES_INTERRUPTEURS_ENTREE).toContain("formulaire_freelance");
    expect(cleSettingEntree("formulaire_freelance")).toBe("formateurs.formulaire_freelance");
    expect(etatsEntreeParDefaut().formulaire_freelance).toBe(false);
  });

  it("L0h — le groupe de menu « Formateurs freelance », coupé par défaut", () => {
    expect(cleSettingEntree("menu_freelance")).toBe("formateurs.menu_freelance");
    expect(etatsEntreeParDefaut().menu_freelance).toBe(false);
  });

  it("L0c-2 — les modèles « formateur » du composeur, coupés par défaut", () => {
    expect(cleSettingEntree("modeles_composeur")).toBe("formateurs.modeles_composeur");
    expect(etatsEntreeParDefaut().modeles_composeur).toBe(false);
  });

  it("L0c-3 — l'ajout d'un candidat formateur en console, coupé par défaut", () => {
    expect(cleSettingEntree("ajout_console")).toBe("formateurs.ajout_console");
    expect(etatsEntreeParDefaut().ajout_console).toBe(false);
  });
});

describe("F-CAL-2 — le suivi de l'échange formateur", () => {
  it("coupé par défaut, protégé, et ne s'allume qu'avec l'échange ouvert et les textes validés", async () => {
    const { prealablesManquantsEntree, etatsParDefaut } = await import("./interrupteurs");
    expect(cleSettingEntree("suivi_echange")).toBe("formateurs.suivi_echange");
    expect(etatsEntreeParDefaut().suivi_echange).toBe(false);
    expect(etatsEntreeDepuisLignes([]).suivi_echange).toBe(false);
    expect(prealablesManquantsEntree("suivi_echange", true, etatsParDefaut())).toHaveLength(2);
    expect(
      prealablesManquantsEntree("suivi_echange", true, {
        ...etatsParDefaut(),
        echange_ouvert: true,
        textes_valides: true,
      }),
    ).toEqual([]);
    expect(prealablesManquantsEntree("suivi_echange", false, etatsParDefaut())).toEqual([]);
  });
});

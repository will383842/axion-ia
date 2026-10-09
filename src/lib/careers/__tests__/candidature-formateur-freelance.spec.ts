// U6 — chantier « formateurs freelance » : quelle fiche formateur naît d'une
// candidature, et quand on REFUSE de deviner.
//
// 🔴 Avant : `statutFormateurDepuisOffre` rendait `salarie` par défaut. Une
// candidature spontanée « Formateur IA indépendant », ou une offre de formateur
// freelance mal typée FULL_TIME, créait donc une fiche de SALARIÉ — et un
// sous-traitant enregistré comme salarié fausse le BPF et la lettre de mission.
//
// Ordre de la règle :
//   1. candidature de formateur FREELANCE → `sous_traitant` ;
//   2. offre salariée EXPLICITE → `salarie` ;
//   3. tout le reste → `null` : l'administrateur choisit, on ne devine pas.

import { describe, expect, it } from "vitest";

import { estCandidatureFormateurFreelance } from "../formateur-freelance";
import { statutFormateurDepuisOffre } from "../fiche-formateur";

const sansOffre = { offerSlug: null, employmentType: null, secondaryEmploymentType: null };

describe("estCandidatureFormateurFreelance", () => {
  it("reconnaît l'offre freelance à son slug, quel que soit son type de contrat", () => {
    expect(
      estCandidatureFormateurFreelance({
        offerSlug: "formateur-ia-freelance",
        offerTitleSnap: "Formateur IA (F/H)",
        employmentType: "FULL_TIME",
        secondaryEmploymentType: null,
      }),
    ).toBe(true);
  });

  it("reconnaît une spontanée « Formateur IA indépendant » à son intitulé", () => {
    expect(
      estCandidatureFormateurFreelance({
        ...sansOffre,
        offerTitleSnap: "Formateur IA indépendant",
      }),
    ).toBe(true);
    expect(
      estCandidatureFormateurFreelance({ ...sansOffre, offerTitleSnap: "Formatrice freelance" }),
    ).toBe(true);
  });

  it("reconnaît une offre de formateur en CONTRACTOR", () => {
    expect(
      estCandidatureFormateurFreelance({
        offerSlug: "formateur-ia-itinerant",
        offerTitleSnap: "Formateur IA",
        employmentType: "CONTRACTOR",
        secondaryEmploymentType: null,
      }),
    ).toBe(true);
  });

  it("ne prend pas un freelance qui n'est pas formateur, ni un formateur salarié", () => {
    expect(
      estCandidatureFormateurFreelance({ ...sansOffre, offerTitleSnap: "Monteur vidéo freelance" }),
    ).toBe(false);
    expect(
      estCandidatureFormateurFreelance({
        offerSlug: "formateur-ia-sedentaire",
        offerTitleSnap: "Formateur IA (F/H)",
        employmentType: "FULL_TIME",
        secondaryEmploymentType: null,
      }),
    ).toBe(false);
  });
});

describe("statutFormateurDepuisOffre — jamais `salarie` par défaut", () => {
  it("spontanée « Formateur IA indépendant » → sous_traitant", () => {
    expect(
      statutFormateurDepuisOffre({ ...sansOffre, offerTitleSnap: "Formateur IA indépendant" }),
    ).toBe("sous_traitant");
  });

  it("offre FULL_TIME étiquetée freelance → sous_traitant", () => {
    expect(
      statutFormateurDepuisOffre({
        offerSlug: "formateur-ia-freelance",
        offerTitleSnap: "Formateur IA freelance (F/H)",
        employmentType: "FULL_TIME",
        secondaryEmploymentType: null,
      }),
    ).toBe("sous_traitant");
  });

  it("offre salariée explicite → salarie", () => {
    for (const type of ["FULL_TIME", "PART_TIME"]) {
      expect(
        statutFormateurDepuisOffre({
          offerSlug: "formateur-ia-sedentaire",
          offerTitleSnap: "Formateur IA (F/H)",
          employmentType: type,
          secondaryEmploymentType: null,
        }),
      ).toBe("salarie");
    }
  });

  it("spontanée sans indice, offre supprimée, type inconnu → null (refus de deviner)", () => {
    expect(statutFormateurDepuisOffre({ ...sansOffre, offerTitleSnap: "Formateur IA" })).toBeNull();
    expect(
      statutFormateurDepuisOffre({
        offerSlug: "formateur-ia-itinerant",
        offerTitleSnap: "Formateur IA",
        employmentType: "VALEUR_INCONNUE",
        secondaryEmploymentType: null,
      }),
    ).toBeNull();
  });
});

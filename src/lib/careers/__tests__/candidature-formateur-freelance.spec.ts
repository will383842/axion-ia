import { describe, it, expect } from "vitest";
import * as module from "../formateur-freelance";
import { statutFormateurDepuisOffre } from "../fiche-formateur";

/**
 * LOT U2 — le prédicat UNIQUE « est-ce une candidature de formateur FREELANCE ? »
 *
 * Lu par la réponse automatique « poste pourvu » et par l'alerte de dormance :
 * une mission de sous-traitance n'est jamais « pourvue », et une candidature
 * spontanée de formateur indépendant doit être reconnue comme celle qui arrive
 * par l'offre `formateur-ia-freelance` (ou par une copie de cette offre).
 */
// Lu par le nom, pour que ce fichier compile avant que le prédicat n'existe
// (premier commit du lot : tests rouges sur `main`).
const estFreelance = (module as Record<string, unknown>)["estCandidatureFormateurFreelance"] as
  ((c: unknown) => boolean) | undefined;

function verdict(c: unknown): boolean {
  expect(typeof estFreelance).toBe("function");
  return estFreelance!(c);
}

describe("estCandidatureFormateurFreelance — table des intitulés", () => {
  it.each([
    ["Candidature spontanée — Formateur IA indépendant", true],
    ["Formatrice freelance", true],
    ["Candidature spontanée — Formateur IA independant (F/H)", true],
    ["Formateur IA freelance — missions en entreprise", true],
    ["Formateur IA en entreprise (itinérant)", false],
    ["Formateur IA sédentaire (F/H)", false],
    ["Candidature spontanée — travail indépendant", false],
    ["Monteur vidéo freelance", false],
    ["Commercial", false],
    ["Formateur commercial", false],
  ])("« %s » → %s", (intitule, attendu) => {
    expect(verdict(intitule)).toBe(attendu);
    // Même verdict quand l'intitulé arrive par la candidature elle-même.
    expect(verdict({ offerTitleSnap: intitule, offer: null })).toBe(attendu);
  });
});

describe("estCandidatureFormateurFreelance — par l'offre", () => {
  it("l'offre `formateur-ia-freelance`, même si l'intitulé figé ne le dit pas", () => {
    expect(
      verdict({
        offerTitleSnap: "Formateur IA",
        offer: {
          slug: "formateur-ia-freelance",
          titleFr: "Formateur IA",
          employmentType: "FULL_TIME",
        },
      }),
    ).toBe(true);
  });

  it("une COPIE de l'offre freelance (slug dérivé, même intitulé)", () => {
    expect(
      verdict({
        offerTitleSnap: "Formateur IA freelance",
        offer: {
          slug: "formateur-ia-freelance-copie",
          titleFr: "Formateur IA freelance",
          employmentType: "CONTRACTOR",
        },
      }),
    ).toBe(true);
  });

  it("une offre de formateur en CONTRACTOR, même sans le mot « freelance »", () => {
    expect(
      verdict({
        offerTitleSnap: "Formateur IA — missions en région",
        offer: {
          slug: "formateur-ia-missions",
          titleFr: "Formateur IA — missions en région",
          employmentType: "CONTRACTOR",
        },
      }),
    ).toBe(true);
  });

  it("CONTRACTOR qui n'est PAS une offre de formateur : non", () => {
    expect(
      verdict({
        offerTitleSnap: "Monteur vidéo",
        offer: {
          slug: "monteur-video-freelance-distance",
          titleFr: "Monteur vidéo",
          employmentType: "CONTRACTOR",
        },
      }),
    ).toBe(false);
  });

  it("les offres de formateur SALARIÉ : non", () => {
    for (const slug of module.SLUGS_OFFRES_FORMATEUR_SALARIE) {
      expect(
        verdict({
          offerTitleSnap: "Formateur IA en entreprise (itinérant)",
          offer: {
            slug,
            titleFr: "Formateur IA en entreprise (itinérant)",
            employmentType: "FULL_TIME",
          },
        }),
      ).toBe(false);
    }
  });

  it("entrée vide ou incomplète : non, sans lever", () => {
    expect(verdict("")).toBe(false);
    expect(verdict({})).toBe(false);
    expect(verdict({ offerTitleSnap: null, offer: { slug: null } })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// U6 — chantier « formateurs freelance » : quelle fiche formateur naît d'une
// candidature, et quand on REFUSE de deviner. Cas de la PR #1393, réécrits
// dans la forme du prédicat U2 (offre IMBRIQUÉE sous `offer`).
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
// ─────────────────────────────────────────────────────────────────────────────

describe("estCandidatureFormateurFreelance — cas de la fiche formateur (U6)", () => {
  it("reconnaît l'offre freelance à son slug, quel que soit son type de contrat", () => {
    expect(
      verdict({
        offerTitleSnap: "Formateur IA (F/H)",
        offer: { slug: "formateur-ia-freelance", employmentType: "FULL_TIME" },
      }),
    ).toBe(true);
  });

  it("reconnaît une spontanée « Formateur IA indépendant » à son intitulé", () => {
    expect(verdict({ offerTitleSnap: "Formateur IA indépendant", offer: null })).toBe(true);
    expect(verdict({ offerTitleSnap: "Formatrice freelance", offer: null })).toBe(true);
  });

  it("reconnaît une offre de formateur en CONTRACTOR", () => {
    expect(
      verdict({
        offerTitleSnap: "Formateur IA",
        offer: { slug: "formateur-ia-itinerant", employmentType: "CONTRACTOR" },
      }),
    ).toBe(true);
  });

  it("ne prend pas un freelance qui n'est pas formateur, ni un formateur salarié", () => {
    expect(verdict({ offerTitleSnap: "Monteur vidéo freelance", offer: null })).toBe(false);
    expect(
      verdict({
        offerTitleSnap: "Formateur IA (F/H)",
        offer: { slug: "formateur-ia-sedentaire", employmentType: "FULL_TIME" },
      }),
    ).toBe(false);
  });
});

describe("statutFormateurDepuisOffre — jamais `salarie` par défaut", () => {
  it("spontanée « Formateur IA indépendant » → sous_traitant", () => {
    expect(
      statutFormateurDepuisOffre({ offerTitleSnap: "Formateur IA indépendant", offer: null }),
    ).toBe("sous_traitant");
  });

  it("offre FULL_TIME étiquetée freelance → sous_traitant", () => {
    expect(
      statutFormateurDepuisOffre({
        offerTitleSnap: "Formateur IA freelance (F/H)",
        offer: { slug: "formateur-ia-freelance", employmentType: "FULL_TIME" },
      }),
    ).toBe("sous_traitant");
  });

  it("offre de formateur CONTRACTOR sans le mot « freelance » → sous_traitant", () => {
    // Le cas qui se perdait EN SILENCE avec l'ancienne entrée plate : ni le
    // slug ni le CONTRACTOR n'étaient lus, seul l'intitulé comptait.
    expect(
      statutFormateurDepuisOffre({
        offerTitleSnap: "Formateur IA — missions en région",
        offer: { slug: "formateur-ia-missions", employmentType: "CONTRACTOR" },
      }),
    ).toBe("sous_traitant");
  });

  it("offre salariée explicite → salarie", () => {
    for (const type of ["FULL_TIME", "PART_TIME"]) {
      expect(
        statutFormateurDepuisOffre({
          offerTitleSnap: "Formateur IA (F/H)",
          offer: { slug: "formateur-ia-sedentaire", employmentType: type },
        }),
      ).toBe("salarie");
    }
  });

  it("spontanée sans indice, offre supprimée, type inconnu → null (refus de deviner)", () => {
    expect(statutFormateurDepuisOffre({ offerTitleSnap: "Formateur IA", offer: null })).toBeNull();
    expect(
      statutFormateurDepuisOffre({
        offerTitleSnap: "Formateur IA",
        offer: { slug: "formateur-ia-itinerant", employmentType: "VALEUR_INCONNUE" },
      }),
    ).toBeNull();
  });
});

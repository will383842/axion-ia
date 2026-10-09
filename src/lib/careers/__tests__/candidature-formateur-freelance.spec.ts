import { describe, it, expect } from "vitest";
import * as module from "../formateur-freelance";

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

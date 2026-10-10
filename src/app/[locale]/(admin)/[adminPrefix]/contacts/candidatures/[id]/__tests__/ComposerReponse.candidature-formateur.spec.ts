// U3 — chantier « formateurs freelance » : le composeur d'une candidature de
// FORMATEUR n'insère jamais le lien de l'échange APPORTEUR.
//
// Un formateur (freelance ou salarié) qui reçoit « Réserver un échange » tombe
// sur la page de l'échange apporteur d'affaires : ce n'est pas son parcours.
// Rien d'autre n'est inséré à la place pour l'instant — le lien formateur
// viendra avec son propre agenda.

import { describe, expect, it } from "vitest";

import { liensInsertionComposeur } from "@/lib/imprimes/liens-email";
import { estCandidatureFormateur } from "@/lib/careers/fiche-formateur";

const CALENDLY_APPORTEUR = "https://calendly.com/axion-ia/echange-apporteur";

describe("composeur d'une candidature de formateur", () => {
  it("contre-témoin : hors formateur, le lien d'échange est proposé", () => {
    expect(
      liensInsertionComposeur(CALENDLY_APPORTEUR).some((l) => l.id === "calendly-echange"),
    ).toBe(true);
  });

  it("candidature de formateur : AUCUN lien d'échange apporteur", () => {
    const liens = liensInsertionComposeur(CALENDLY_APPORTEUR, { candidatureFormateur: true });
    expect(liens.some((l) => l.id === "calendly-echange")).toBe(false);
    expect(liens.some((l) => l.url.includes("apporteur"))).toBe(false);
  });

  it("freelance comme salarié sont des candidatures de formateur", () => {
    expect(
      estCandidatureFormateur({ offerTitleSnap: "Formateur IA indépendant", offer: null }),
    ).toBe(true);
    expect(
      estCandidatureFormateur({
        offerTitleSnap: "Formateur IA (F/H)",
        offer: {
          slug: "formateur-ia-sedentaire",
          employmentType: "FULL_TIME",
          secondaryEmploymentType: null,
        },
      }),
    ).toBe(true);
    expect(
      estCandidatureFormateur({
        offerTitleSnap: "Commercial IA",
        offer: {
          slug: "commercial-ia",
          employmentType: "FULL_TIME",
          secondaryEmploymentType: null,
        },
      }),
    ).toBe(false);
  });
});

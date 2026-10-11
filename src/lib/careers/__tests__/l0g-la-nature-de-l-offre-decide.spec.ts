/**
 * Lot L0g — « freelance » ou « salarié » se lit sur l'OFFRE
 * (`JobOffer.natureCollaboration`, posée par le schéma n° 1), et plus dans son
 * slug ni dans son type schema.org.
 *
 * Livré ÉTEINT : interrupteur `formateurs.nature_offre` absent = le prédicat
 * d'aujourd'hui, au résultat près, et le filtre « poste pourvu » d'aujourd'hui,
 * à l'octet près.
 */

import { describe, expect, it } from "vitest";

import {
  estCandidatureFormateurFreelance,
  estOffreFormateurFreelance,
  natureAEnregistrer,
  natureCollaborationDeduite,
} from "../formateur-freelance";
import { critereEligible } from "@/server/careers/reponse-poste-pourvu";

const MAINTENANT = new Date("2026-10-11T08:00:00Z");

const OFFRES = [
  {
    slug: "formateur-ia-freelance",
    titleFr: "Formateur IA freelance",
    employmentType: "CONTRACTOR",
  },
  {
    slug: "formateur-ia-itinerant",
    titleFr: "Formateur IA en entreprise (itinérant)",
    employmentType: "FULL_TIME",
  },
  {
    slug: "formateur-ia-freelance-copie",
    titleFr: "Formateur IA freelance (copie)",
    employmentType: "CONTRACTOR",
  },
  {
    slug: "formateur-lyon",
    titleFr: "Formateur IA Lyon",
    employmentType: "FULL_TIME",
    secondaryEmploymentType: "CONTRACTOR",
  },
  { slug: "monteur-video", titleFr: "Monteur vidéo", employmentType: "CONTRACTOR" },
  { slug: "commercial", titleFr: "Commercial terrain", employmentType: "FULL_TIME" },
] as const;

describe("L0g — interrupteur éteint : rien ne change", () => {
  it("le prédicat de l'offre rend exactement le prédicat d'aujourd'hui", () => {
    for (const o of OFFRES) {
      for (const nature of ["freelance", "salarie", undefined] as const) {
        expect(
          estOffreFormateurFreelance({ ...o, natureCollaboration: nature }, { natureLue: false }),
          `${o.slug} / ${nature}`,
        ).toBe(estCandidatureFormateurFreelance(o));
      }
    }
  });

  it("le filtre « poste pourvu » est identique à l'octet près", () => {
    expect(JSON.stringify(critereEligible(MAINTENANT, ["x"], { natureOffreLue: false }))).toBe(
      JSON.stringify(critereEligible(MAINTENANT, ["x"])),
    );
  });
});

describe("L0g — interrupteur allumé : la colonne décide", () => {
  it("offre de formateur étiquetée freelance → vrai, même sans CONTRACTOR ni mot « freelance »", () => {
    expect(
      estOffreFormateurFreelance(
        {
          slug: "formateur-ia-lyon",
          titleFr: "Formateur IA Lyon",
          employmentType: "FULL_TIME",
          natureCollaboration: "freelance",
        },
        { natureLue: true },
      ),
    ).toBe(true);
  });

  it("offre étiquetée salarié → faux, même déclarée CONTRACTOR", () => {
    expect(
      estOffreFormateurFreelance(
        {
          slug: "formateur-lyon",
          titleFr: "Formateur IA Lyon",
          employmentType: "CONTRACTOR",
          natureCollaboration: "salarie",
        },
        { natureLue: true },
      ),
    ).toBe(false);
  });

  it("une offre freelance qui n'est pas de formateur n'est pas une offre de formateur freelance", () => {
    expect(
      estOffreFormateurFreelance(
        { slug: "monteur-video", titleFr: "Monteur vidéo", natureCollaboration: "freelance" },
        { natureLue: true },
      ),
    ).toBe(false);
  });

  it("colonne non lue (fenêtre où le worker neuf tourne sur l'ancienne base) → le prédicat d'aujourd'hui", () => {
    for (const o of OFFRES) {
      expect(estOffreFormateurFreelance(o, { natureLue: true })).toBe(
        estCandidatureFormateurFreelance(o),
      );
    }
  });

  it("« poste pourvu » exclut toute candidature à une offre freelance", () => {
    const w = critereEligible(MAINTENANT, [], { natureOffreLue: true });
    expect(JSON.stringify(w)).toContain('"natureCollaboration":{"not":"freelance"}');
    // Une spontanée (sans offre) reste soumise aux règles d'intitulé d'aujourd'hui.
    expect(JSON.stringify(w)).toContain('{"offer":null}');
  });
});

describe("L0g — ce que la console enregistre", () => {
  it("la nature déduite reprend la règle du remplissage du schéma n° 1", () => {
    for (const o of OFFRES) {
      expect(natureCollaborationDeduite(o)).toBe(
        estCandidatureFormateurFreelance(o) ? "freelance" : "salarie",
      );
    }
  });

  it("éteint : nature déduite, jamais de retour de « freelance » à « salarié »", () => {
    const offre = { slug: "formateur-x", titleFr: "Formateur IA", employmentType: "FULL_TIME" };
    expect(natureAEnregistrer({ natureLue: false, offre, actuelle: null })).toEqual({
      ok: true,
      nature: "salarie",
    });
    expect(natureAEnregistrer({ natureLue: false, offre, actuelle: "freelance" })).toEqual({
      ok: true,
      nature: "freelance",
    });
    // Le choix envoyé par un formulaire forgé est ignoré tant que c'est éteint.
    expect(
      natureAEnregistrer({ natureLue: false, offre, actuelle: null, demandee: "freelance" }),
    ).toEqual({ ok: true, nature: "salarie" });
  });

  it("allumé : le choix est exigé, et « freelance » exige CONTRACTOR", () => {
    const offre = { slug: "formateur-x", titleFr: "Formateur IA", employmentType: "FULL_TIME" };
    expect(natureAEnregistrer({ natureLue: true, offre, actuelle: null }).ok).toBe(false);
    expect(
      natureAEnregistrer({ natureLue: true, offre, actuelle: null, demandee: "freelance" }).ok,
    ).toBe(false);
    expect(
      natureAEnregistrer({
        natureLue: true,
        offre: { ...offre, secondaryEmploymentType: "CONTRACTOR" },
        actuelle: null,
        demandee: "freelance",
      }),
    ).toEqual({ ok: true, nature: "freelance" });
    expect(
      natureAEnregistrer({ natureLue: true, offre, actuelle: "salarie", demandee: "salarie" }),
    ).toEqual({ ok: true, nature: "salarie" });
  });

  it("allumé : une offre freelance qui a des candidatures ne repasse pas en salarié", () => {
    const offre = { slug: "formateur-x", titleFr: "Formateur IA", employmentType: "FULL_TIME" };
    const r = natureAEnregistrer({
      natureLue: true,
      offre,
      actuelle: "freelance",
      demandee: "salarie",
      aDesCandidatures: true,
    });
    expect(r.ok).toBe(false);
    expect(
      natureAEnregistrer({
        natureLue: true,
        offre,
        actuelle: "freelance",
        demandee: "salarie",
        aDesCandidatures: false,
      }),
    ).toEqual({ ok: true, nature: "salarie" });
  });
});

// @vitest-environment node
/**
 * Lot L0c-1 — candidature de formateur indépendant : formulaire en 4 blocs,
 * accusé F0 « mission », données Google sans salaire.
 *
 * Livré ÉTEINT : interrupteur `formateurs.formulaire_freelance` absent = le
 * formulaire, l'accusé et les données Google d'aujourd'hui, à l'octet près.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import {
  decisionsDuDepot,
  lireChampsFormateurFreelance,
  modeFormateurFreelance,
} from "../formulaire-formateur-freelance";
import { buildJobPostingJsonLd } from "@/lib/seo/job-posting";
import { renderEmailTemplate } from "@/lib/email/templates";
import type { JobOffer } from "../../../../prisma/generated/client";

beforeAll(() => {
  process.env["AUTH_SECRET"] ??= "secret-de-test-suffisamment-long-0123456789";
});

const OFFRE_FREELANCE = {
  slug: "formateur-ia-freelance",
  titleFr: "Formateur IA freelance",
  employmentType: "CONTRACTOR",
  natureCollaboration: "freelance" as const,
};

function champs(over: Record<string, string> = {}) {
  const base: Record<string, string> = {
    codePostal: "69100",
    siret: "",
    numeroDeclaration: "84691234569",
    formations: "IA générative pour les équipes commerciales",
    ...over,
  };
  return (k: string) => (k in base ? base[k]! : null);
}

describe("L0c-1 — l'interrupteur", () => {
  it("éteint, aucune offre ne passe en mode formateur freelance", () => {
    expect(
      modeFormateurFreelance({ formulaireAllume: false, natureLue: true, offre: OFFRE_FREELANCE }),
    ).toBe(false);
  });

  it("allumé, seule une offre de formateur freelance y passe", () => {
    expect(
      modeFormateurFreelance({ formulaireAllume: true, natureLue: false, offre: OFFRE_FREELANCE }),
    ).toBe(true);
    expect(
      modeFormateurFreelance({
        formulaireAllume: true,
        natureLue: false,
        offre: {
          slug: "formateur-ia-itinerant",
          titleFr: "Formateur IA (itinérant)",
          employmentType: "FULL_TIME",
        },
      }),
    ).toBe(false);
    expect(modeFormateurFreelance({ formulaireAllume: true, natureLue: false, offre: null })).toBe(
      false,
    );
  });
});

describe("L0c-1 — les champs du formulaire", () => {
  it("une saisie complète donne les réponses lisibles en console", () => {
    const r = lireChampsFormateurFreelance(
      champs({ siret: "732 829 320 00074", interviews: "on" }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.codePostal).toBe("69100");
    expect(r.formations).toBe("IA générative pour les équipes commerciales");
    expect(r.reponses).toEqual({
      "Code postal": "69100",
      "Numéro SIRET": "73282932000074",
      "Numéro de déclaration d'activité": "84691234569",
      "Interviews filmées": "D'accord pour qu'on me les propose",
    });
  });

  it("un SIRET mal saisi dit quoi faire", () => {
    const r = lireChampsFormateurFreelance(champs({ siret: "123 456 789 0001" }));
    expect(r).toEqual({
      ok: false,
      error: "Ce numéro SIRET n'est pas valide : vérifiez les 14 chiffres.",
    });
  });

  it("pas encore de numéro de déclaration : c'est dit, et accepté", () => {
    const r = lireChampsFormateurFreelance(
      champs({ numeroDeclaration: "", pasEncoreDeNumero: "on" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reponses["Numéro de déclaration d'activité"]).toBe("Pas encore de numéro");
  });

  it("ni numéro ni « pas encore » : refusé ; numéro de 11 chiffres exigé", () => {
    expect(lireChampsFormateurFreelance(champs({ numeroDeclaration: "" })).ok).toBe(false);
    expect(lireChampsFormateurFreelance(champs({ numeroDeclaration: "1234" })).ok).toBe(false);
  });

  it("code postal de 5 chiffres et formations exigés", () => {
    expect(lireChampsFormateurFreelance(champs({ codePostal: "Lyon" })).ok).toBe(false);
    expect(lireChampsFormateurFreelance(champs({ formations: "  " })).ok).toBe(false);
  });

  it("aucun message n'emploie le lexique interdit", () => {
    const messages = [
      lireChampsFormateurFreelance(champs({ siret: "1" })),
      lireChampsFormateurFreelance(champs({ numeroDeclaration: "" })),
      lireChampsFormateurFreelance(champs({ codePostal: "" })),
      lireChampsFormateurFreelance(champs({ formations: "" })),
    ].map((r) => (r.ok ? "" : r.error));
    for (const m of messages) {
      expect(m).not.toMatch(
        /poste|entretien|recrutement|salaire|rémunération|obligatoire|vous devez/i,
      );
    }
  });
});

function offreBase(over: Partial<JobOffer> = {}): JobOffer {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "formateur-ia-freelance",
    status: "published",
    category: "conseil",
    titleFr: "Formateur IA freelance",
    titleEn: "Freelance AI trainer",
    summaryFr: "Résumé",
    summaryEn: "Summary",
    bodyFr: "<p>Mission</p>",
    bodyJsonFr: null,
    bodyTextFr: "Mission",
    bodyEn: "<p>Mission</p>",
    bodyJsonEn: null,
    bodyTextEn: "Mission",
    employmentType: "FULL_TIME",
    secondaryEmploymentType: "CONTRACTOR",
    workMode: "on_site",
    city: "Lyon",
    region: null,
    country: "FR",
    applicantCountries: [],
    salaryMin: 300,
    salaryMax: 400,
    salaryPeriod: "DAY",
    salaryCurrency: "EUR",
    salaryVisible: true,
    isCommission: false,
    requiresDriverLicense: false,
    requiresVehicle: false,
    screeningQuestions: null,
    contractLabel: null,
    startDate: null,
    applicationDeadline: null,
    remoteDaysPerWeek: null,
    perks: null,
    teamName: null,
    managerName: null,
    heroImagePath: null,
    metaTitle: null,
    metaDescription: null,
    indexationTier: "tier_1_indexable",
    ogImagePath: null,
    datePosted: new Date("2026-06-01T00:00:00.000Z"),
    validThrough: null,
    publishedAt: new Date("2026-06-01T00:00:00.000Z"),
    filledAt: null,
    displayOrder: 0,
    viewCount: 0,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...over,
  } as JobOffer;
}

describe("L0c-1 — données Google d'une offre freelance", () => {
  it("éteint : identiques à aujourd'hui (fourchette affichée → baseSalary)", () => {
    const o = offreBase();
    expect(buildJobPostingJsonLd(o, "fr", { formateurFreelance: false })).toEqual(
      buildJobPostingJsonLd(o, "fr"),
    );
    expect(buildJobPostingJsonLd(o, "fr")!.baseSalary).toBeDefined();
  });

  it("allumé : CONTRACTOR seul, aucun baseSalary", () => {
    const j = buildJobPostingJsonLd(offreBase(), "fr", { formateurFreelance: true })!;
    expect(j.employmentType).toBe("CONTRACTOR");
    expect(j.baseSalary).toBeUndefined();
    expect(JSON.stringify(j)).not.toMatch(/salaire|rémunération/i);
  });
});

const annee = (s: string) => s.replace(/20\d\d/g, "AAAA");

describe("L0c-1 — accusé F0", () => {
  it("sans la variante « mission » : identique à l'octet près à l'accusé d'avant", async () => {
    const avant = JSON.parse(
      readFileSync(join(__dirname, "fixtures", "candidature-recue-avant-l0c.json"), "utf8"),
    ) as { subject: string; html: string; text: string };
    const apres = await renderEmailTemplate("candidature-recue", "fr", {
      contactName: "Marie Dupont",
      offerTitle: "Formateur IA freelance",
    });
    expect(apres.subject).toBe(avant.subject);
    expect(annee(apres.html)).toBe(annee(avant.html));
    expect(annee(apres.text)).toBe(annee(avant.text));
  });

  it("variante « mission » : le texte F0 validé, sans « poste »", async () => {
    const r = await renderEmailTemplate("candidature-recue", "fr", {
      contactName: "Marie",
      offerTitle: "Formateur IA freelance",
      mission: true,
    });
    expect(r.subject).toBe("Votre candidature de formateur indépendant est bien arrivée");
    expect(r.text).toContain(
      "Votre candidature à la mission de formateur IA indépendant est bien arrivée.",
    );
    expect(r.text).toContain(
      "Si votre profil correspond, nous vous proposerons un échange de 20 minutes en visio pour faire connaissance, sans engagement.",
    );
    expect(r.text).not.toMatch(/\bposte\b|entretien|recrutement|salaire/i);
  });
});

describe("L0c-1 — le dépôt", () => {
  const base = { textesValides: true, natureLue: false, offre: OFFRE_FREELANCE };
  it("éteint, ancien formulaire : rien de neuf", () => {
    expect(decisionsDuDepot({ ...base, formulaireEnvoye: null, formulaireAllume: false })).toEqual({
      modeFormateur: false,
      accuseMission: false,
      figerNature: false,
    });
  });
  it("éteint, nouveau formulaire (cache ou champ forgé) : validé, mais ni F0 ni nature figée", () => {
    expect(
      decisionsDuDepot({
        ...base,
        formulaireEnvoye: "formateur-freelance",
        formulaireAllume: false,
      }),
    ).toEqual({ modeFormateur: true, accuseMission: false, figerNature: false });
  });
  it("allumé : F0 seulement avec les textes validés", () => {
    const d = { ...base, formulaireEnvoye: "formateur-freelance", formulaireAllume: true };
    expect(decisionsDuDepot(d)).toEqual({
      modeFormateur: true,
      accuseMission: true,
      figerNature: true,
    });
    expect(decisionsDuDepot({ ...d, textesValides: false }).accuseMission).toBe(false);
  });
  it("le champ ne force jamais le mode sur une autre offre", () => {
    expect(
      decisionsDuDepot({
        ...base,
        formulaireEnvoye: "formateur-freelance",
        formulaireAllume: true,
        offre: { slug: "monteur-video", titleFr: "Monteur vidéo", employmentType: "CONTRACTOR" },
      }).modeFormateur,
    ).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { buildJobPostingJsonLd } from "../job-posting";
import type { JobOffer } from "../../../../prisma/generated/client";

function makeOffer(over: Partial<JobOffer> = {}): JobOffer {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "dev-fullstack-lyon",
    status: "published",
    category: "developpement",
    titleFr: "Développeur Fullstack",
    titleEn: "Fullstack Developer",
    summaryFr: "Résumé fr",
    summaryEn: "Summary en",
    bodyFr: "<p>Mission</p>",
    bodyJsonFr: null,
    bodyTextFr: "Mission",
    bodyEn: "<p>Mission</p>",
    bodyJsonEn: null,
    bodyTextEn: "Mission",
    employmentType: "FULL_TIME",
    secondaryEmploymentType: null,
    workMode: "on_site",
    city: "Lyon",
    region: "Auvergne-Rhône-Alpes",
    country: "FR",
    applicantCountries: [],
    salaryMin: 40000,
    salaryMax: 55000,
    salaryPeriod: "YEAR",
    salaryCurrency: "EUR",
    salaryVisible: true,
    isCommission: false,
    requiresDriverLicense: false,
    requiresVehicle: false,
    screeningQuestions: null,
    contractLabel: "CDI",
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

describe("buildJobPostingJsonLd", () => {
  it("employmentType : scalaire seul, TABLEAU quand un second type est déclaré", () => {
    expect(buildJobPostingJsonLd(makeOffer())!.employmentType).toBe("FULL_TIME");
    const dual = buildJobPostingJsonLd(makeOffer({ secondaryEmploymentType: "CONTRACTOR" }))!;
    expect(dual.employmentType).toEqual(["FULL_TIME", "CONTRACTOR"]);
  });

  it("émet les champs requis pour une offre publiée", () => {
    const j = buildJobPostingJsonLd(makeOffer());
    expect(j).not.toBeNull();
    expect(j!["@type"]).toBe("JobPosting");
    expect(j!.title).toBe("Développeur Fullstack");
    expect(String(j!.datePosted)).toContain("2026-06-01");
    // Pas de date de fin automatique : validThrough omis tant que l'admin ne l'a pas fixé.
    expect(j!.validThrough).toBeUndefined();
    expect(j!.hiringOrganization).toBeTruthy();
    expect((j!.hiringOrganization as Record<string, unknown>)["@id"]).toContain("#organization");
    expect(j!.image).toBeTruthy();
    // url = page de l'annonce, pas le formulaire /postuler.
    expect(String(j!.url)).toContain("/carrieres/dev-fullstack-lyon");
    expect(String(j!.url)).not.toContain("/postuler");
    expect(j!.directApply).toBe(true);
  });

  it("émet validThrough UNIQUEMENT si fixé par l'admin (jamais de +1 an auto)", () => {
    expect(buildJobPostingJsonLd(makeOffer())!.validThrough).toBeUndefined();
    const avec = buildJobPostingJsonLd(
      makeOffer({ validThrough: new Date("2027-12-31T00:00:00.000Z") }),
    )!;
    expect(String(avec.validThrough)).toContain("2027-12-31");
  });

  it("hybride → Place + TELECOMMUTE (les deux)", () => {
    const j = buildJobPostingJsonLd(makeOffer({ workMode: "hybrid" }))!;
    expect(j.jobLocation).toBeTruthy();
    expect(j.jobLocationType).toBe("TELECOMMUTE");
  });

  it("retourne null si brouillon / pourvue / noindex / expirée", () => {
    expect(buildJobPostingJsonLd(makeOffer({ status: "draft" }))).toBeNull();
    expect(buildJobPostingJsonLd(makeOffer({ filledAt: new Date() }))).toBeNull();
    expect(
      buildJobPostingJsonLd(makeOffer({ indexationTier: "tier_2_noindex_follow" })),
    ).toBeNull();
    expect(
      buildJobPostingJsonLd(makeOffer({ validThrough: new Date("2020-01-01T00:00:00.000Z") })),
    ).toBeNull();
  });

  it("utilise baseSalary si visible + non commission", () => {
    const j = buildJobPostingJsonLd(makeOffer())!;
    expect(j.baseSalary).toBeTruthy();
    expect(j.incentiveCompensation).toBeUndefined();
  });

  it("utilise incentiveCompensation si commission (pas de baseSalary)", () => {
    const j = buildJobPostingJsonLd(makeOffer({ isCommission: true }))!;
    expect(j.baseSalary).toBeUndefined();
    expect(j.incentiveCompensation).toBeTruthy();
  });

  it("omet baseSalary si salaire masqué", () => {
    const j = buildJobPostingJsonLd(makeOffer({ salaryVisible: false }))!;
    expect(j.baseSalary).toBeUndefined();
  });

  it("remote → TELECOMMUTE", () => {
    const j = buildJobPostingJsonLd(makeOffer({ workMode: "remote", city: null }))!;
    expect(j.jobLocationType).toBe("TELECOMMUTE");
    expect(j.applicantLocationRequirements).toBeTruthy();
  });

  it("sur-site → Place avec PostalAddress", () => {
    const j = buildJobPostingJsonLd(makeOffer())!;
    expect(j.jobLocation).toBeTruthy();
  });

  it("remote sans pays déclarés → France seule (comportement historique)", () => {
    const j = buildJobPostingJsonLd(makeOffer({ workMode: "remote", city: null }))!;
    expect(j.applicantLocationRequirements).toEqual({ "@type": "Country", name: "France" });
  });

  it("remote multi-pays → un nœud Country par pays, avec le code ISO", () => {
    const j = buildJobPostingJsonLd(
      makeOffer({ workMode: "remote", city: null, applicantCountries: ["FR", "BE", "MA", "SN"] }),
    )!;
    expect(j.applicantLocationRequirements).toEqual([
      { "@type": "Country", name: "France", identifier: "FR" },
      { "@type": "Country", name: "Belgique", identifier: "BE" },
      { "@type": "Country", name: "Maroc", identifier: "MA" },
      { "@type": "Country", name: "Sénégal", identifier: "SN" },
    ]);
  });

  it("un seul pays déclaré → objet, pas tableau (schema.org accepte les deux)", () => {
    const j = buildJobPostingJsonLd(
      makeOffer({ workMode: "remote", city: null, applicantCountries: ["MA"] }),
    )!;
    expect(j.applicantLocationRequirements).toEqual({
      "@type": "Country",
      name: "Maroc",
      identifier: "MA",
    });
  });

  it("hybride multi-pays → les pays déclarés remplacent le France en dur", () => {
    const j = buildJobPostingJsonLd(
      makeOffer({ workMode: "hybrid", applicantCountries: ["FR", "BE"] }),
    )!;
    expect(j.jobLocationType).toBe("TELECOMMUTE");
    expect(j.applicantLocationRequirements).toEqual([
      { "@type": "Country", name: "France", identifier: "FR" },
      { "@type": "Country", name: "Belgique", identifier: "BE" },
    ]);
  });

  it("codes en minuscules / doublons / vides → normalisés sans casser le JSON-LD", () => {
    const j = buildJobPostingJsonLd(
      makeOffer({
        workMode: "remote",
        city: null,
        applicantCountries: [" fr ", "FR", "be", "", "XYZ"],
      }),
    )!;
    expect(j.applicantLocationRequirements).toEqual([
      { "@type": "Country", name: "France", identifier: "FR" },
      { "@type": "Country", name: "Belgique", identifier: "BE" },
    ]);
  });
});

import { describe, it, expect } from "vitest";
import { buildJobPostingJsonLd } from "../job-posting";
import type { JobOffer } from "../../../../prisma/generated/client";

function makeOffer(over: Partial<JobOffer> = {}): JobOffer {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "dev-fullstack-lyon",
    status: "published",
    category: "tech",
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
    workMode: "on_site",
    city: "Lyon",
    region: "Auvergne-Rhône-Alpes",
    country: "FR",
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
  it("émet les champs requis pour une offre publiée", () => {
    const j = buildJobPostingJsonLd(makeOffer());
    expect(j).not.toBeNull();
    expect(j!["@type"]).toBe("JobPosting");
    expect(j!.title).toBe("Développeur Fullstack");
    expect(String(j!.datePosted)).toContain("2026-06-01");
    expect(String(j!.validThrough)).toContain("2027-06-01");
    expect(j!.hiringOrganization).toBeTruthy();
    expect(j!.directApply).toBe(true);
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
});

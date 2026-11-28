import { beforeEach, describe, expect, it, vi } from "vitest";

const { resoudre } = vi.hoisted(() => ({ resoudre: vi.fn() }));
vi.mock("@/lib/equipe/collaborateurs", () => ({ resoudreFicheEquipe: resoudre }));
vi.mock("next-intl", () => ({
  hasLocale: (locales: readonly string[], l: string) => locales.includes(l),
}));
vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("@/i18n/routing", () => ({ routing: { locales: ["fr", "en"], pathnames: {} } }));
vi.mock("@/components/equipe/ProfilCollaborateur", () => ({ ProfilCollaborateur: () => null }));
vi.mock("@/components/marketing/JsonLd", () => ({ JsonLd: () => null }));
vi.mock("@/components/marketing/JsonLdGraph", () => ({ JsonLdGraph: () => null }));
vi.mock("@/components/nav/Breadcrumbs", () => ({ Breadcrumbs: () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/seo", () => ({
  SITE_URL: "https://axion-ia.com",
  buildProductMetadata: vi.fn(async (o: { path: string }) => ({
    alternates: { canonical: `https://axion-ia.com/fr${o.path}` },
    robots: { index: true, follow: true },
  })),
}));

import { generateMetadata } from "../page";

const D = new Date("2026-11-01T10:00:00Z");
const params = (slug: string) => Promise.resolve({ locale: "fr", slug });

function membre(sur: Record<string, unknown> = {}) {
  return {
    slug: "camille",
    category: "developpeur",
    firstName: "Camille",
    organizationName: null,
    jobTitle: "Développeuse",
    headline: "Camille développe des outils sur mesure pour les TPE.",
    bioMd: "x".repeat(320),
    skills: ["a", "b", "c"],
    languages: ["Anglais"],
    categoryAnswers: null,
    questionnaireVersion: null,
    linkedinUrl: null,
    websiteUrl: null,
    citySlug: null,
    departmentCode: null,
    locationLabel: null,
    latitude: null,
    longitude: null,
    showOnMap: false,
    photoKind: "reelle",
    photoUrl256: "/api/equipe/photo/j/256",
    photoUrl1024: "/api/equipe/photo/j/1024",
    photoAlt: null,
    photoConsentAt: D,
    linkedinConsentAt: null,
    publishedAt: D,
    updatedAt: D,
    ...sur,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("generateMetadata /equipe/[slug]", () => {
  it("williams : jamais la base", async () => {
    await generateMetadata({ params: params("williams") });
    expect(resoudre).not.toHaveBeenCalled();
  });

  it("fiche indexable : robots index, canonical sur le slug", async () => {
    resoudre.mockResolvedValue({ type: "membre", membre: membre() });
    const m = await generateMetadata({ params: params("camille") });
    expect(m.robots).toEqual({ index: true, follow: true });
    expect(m.alternates?.canonical).toBe("https://axion-ia.com/fr/equipe/camille");
  });

  it("fiche sans consentement photo : noindex, follow", async () => {
    resoudre.mockResolvedValue({ type: "membre", membre: membre({ photoConsentAt: null }) });
    const m = await generateMetadata({ params: params("camille") });
    expect(m.robots).toEqual({ index: false, follow: true });
  });

  it("introuvable : noindex, nofollow", async () => {
    resoudre.mockResolvedValue(null);
    const m = await generateMetadata({ params: params("zzz") });
    expect(m.robots).toBe("noindex, nofollow");
  });
});

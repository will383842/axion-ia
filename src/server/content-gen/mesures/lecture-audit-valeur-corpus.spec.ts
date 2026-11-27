/**
 * Fiche C2b — la lecture du corpus : pages villes lues depuis les DONNÉES DU SITE (comme le
 * sitemap, pas la table `City`) et pages noindex exclues du signal « sans impressions ».
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { articleTranslation: { findMany: (a: unknown) => findManyMock(a) } },
}));
vi.mock("@/server/content-gen/seo/gsc-client", () => ({ gscSearchAnalytics: vi.fn() }));

import { getIndexableVillesCore, isVilleIndexable } from "@/content/villes/core";
import { chargerPagesCorpus } from "./lecture-audit-valeur-corpus";

function trad(slug: string, tier: string) {
  return {
    slug,
    title: slug,
    body: "<h2>Un</h2><p>texte</p>",
    bodyText: "texte",
    article: {
      id: `a-${slug}`,
      isNews: false,
      templateVariant: null,
      qualityScore: 80,
      publishedAt: new Date("2026-01-01T00:00:00Z"),
      indexationTier: tier,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.DATABASE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://axion-ia.com";
});

describe("chargerPagesCorpus", () => {
  it("pages villes : exactement les villes indexables du site, mêmes adresses que le sitemap", async () => {
    findManyMock.mockResolvedValue([]);
    const pages = await chargerPagesCorpus();
    const attendues = getIndexableVillesCore().filter((v) => isVilleIndexable(v.slug));
    expect(attendues.length).toBeGreaterThan(0);
    expect(pages.filter((p) => p.type === "page-ville")).toHaveLength(attendues.length);
    for (const v of attendues) {
      const p = pages.find((x) => x.id === v.slug);
      expect(p?.url).toBe(`https://axion-ia.com/fr/implantations/${v.region}/${v.slug}`);
    }
  });

  it("un article noindex est marqué non indexable (pas de « sans impressions »)", async () => {
    findManyMock.mockResolvedValue([
      trad("indexe", "tier_1_indexable"),
      trad("noindex", "tier_2_noindex_follow"),
    ]);
    const pages = await chargerPagesCorpus();
    expect(pages.find((p) => p.id === "a-indexe")?.indexable).toBe(true);
    expect(pages.find((p) => p.id === "a-noindex")?.indexable).toBe(false);
  });

  it("stub.invalid : rien, sans toucher la base", async () => {
    process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
    expect(await chargerPagesCorpus()).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

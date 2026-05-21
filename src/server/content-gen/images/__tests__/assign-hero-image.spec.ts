/**
 * B.6 P0-4 — Tests assign-hero-image.ts
 *
 * Couvre :
 * 1. Selection par module : vertical 'audits' → ImageAsset.module='audit'.
 * 2. Filtres durs : isActive=true + isAiGenerated=false + deletedAt=null.
 * 3. Score : module match (+10), targetCity match (+5), keyword overlap (+3).
 * 4. Best wins : top scored asset retourne.
 * 5. Empty candidates → null.
 * 6. DB throws → null silent (build SSG safe).
 * 7. Score 0 → null (pas de match meaningful).
 * 8. Doctrine 0 IA : aucun asset avec isAiGenerated=true ne peut etre retourne.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    imageAsset: {
      findMany: (args: unknown) => findManyMock(args),
    },
  },
}));

import { assignHeroImage, __testInternals } from "../assign-hero-image";

function makeAsset(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: overrides.id ?? "asset-1",
    filePath: "/image-bank/asset-1/hd.webp",
    thumbnailPath: "/image-bank/asset-1/thumb.webp",
    avifPath: "/image-bank/asset-1/hd.avif",
    width: 1920,
    height: 1080,
    slug: "asset-1-slug",
    keywordsPrimary: null,
    module: null,
    targetCity: null,
    targetRegion: null,
    targetSector: null,
    isFeatured: false,
    translations: [{ alt: "Alt text FR", title: "Titre FR" }],
    ...overrides,
  };
}

beforeEach(() => {
  findManyMock.mockReset();
});

describe("assignHeroImage — selection", () => {
  it("returns null when no candidates", async () => {
    findManyMock.mockResolvedValueOnce([]);
    const result = await assignHeroImage({ vertical: "audits", primaryKeyword: "audit IA" });
    expect(result).toBeNull();
  });

  it("filters DB query with isActive + isAiGenerated=false + deletedAt=null", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await assignHeroImage({ vertical: "audits", primaryKeyword: "audit IA" });
    const callArgs = findManyMock.mock.calls[0]?.[0] as { where?: Record<string, unknown> };
    expect(callArgs.where).toMatchObject({
      isActive: true,
      isAiGenerated: false,
      deletedAt: null,
      module: "audit",
    });
  });

  it("returns null when DB throws (build SSG safe)", async () => {
    findManyMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await assignHeroImage({ vertical: "audits", primaryKeyword: "audit IA" });
    expect(result).toBeNull();
  });
});

describe("assignHeroImage — scoring", () => {
  it("picks asset with module match (+10) over generic", async () => {
    findManyMock.mockResolvedValueOnce([
      makeAsset({ id: "no-module", module: null }),
      makeAsset({ id: "match-audit", module: "audit" }),
    ]);
    const result = await assignHeroImage({
      vertical: "audits",
      primaryKeyword: "audit IA",
    });
    expect(result?.assetId).toBe("match-audit");
  });

  it("boosts city match (+5)", async () => {
    findManyMock.mockResolvedValueOnce([
      makeAsset({ id: "no-city", module: "audit", targetCity: null }),
      makeAsset({ id: "match-city", module: "audit", targetCity: "paris" }),
    ]);
    const result = await assignHeroImage({
      vertical: "audits",
      primaryKeyword: "audit IA",
      anchorVilleSlug: "paris",
    });
    expect(result?.assetId).toBe("match-city");
  });

  it("boosts keyword overlap (+3)", async () => {
    findManyMock.mockResolvedValueOnce([
      makeAsset({ id: "no-kw", module: "audit", keywordsPrimary: "voiture autonome" }),
      makeAsset({ id: "match-kw", module: "audit", keywordsPrimary: "conformite RGPD" }),
    ]);
    const result = await assignHeroImage({
      vertical: "audits",
      primaryKeyword: "audit RGPD",
    });
    expect(result?.assetId).toBe("match-kw");
  });

  it("returns null when no asset has positive score (module mismatch + no city/keyword)", async () => {
    findManyMock.mockResolvedValueOnce([
      makeAsset({ id: "neutral", module: null, targetCity: null, keywordsPrimary: null }),
    ]);
    // Pas de keyword passe (pour eviter le +3) + pas de match module → score = 0.
    const result = await assignHeroImage({ vertical: "audits" });
    expect(result).toBeNull();
  });

  it("uses translation alt FR when available", async () => {
    findManyMock.mockResolvedValueOnce([
      makeAsset({
        id: "with-alt",
        module: "audit",
        translations: [{ alt: "Photo audit IA dans bureau", title: "Audit IA" }],
      }),
    ]);
    const result = await assignHeroImage({
      vertical: "audits",
      primaryKeyword: "audit IA",
    });
    expect(result?.alt).toBe("Photo audit IA dans bureau");
  });

  it("falls back to title when alt is missing", async () => {
    findManyMock.mockResolvedValueOnce([
      makeAsset({
        id: "no-alt",
        module: "audit",
        translations: [{ alt: null, title: "Titre image audit" }],
      }),
    ]);
    const result = await assignHeroImage({
      vertical: "audits",
      primaryKeyword: "audit IA",
    });
    expect(result?.alt).toBe("Titre image audit");
  });

  it("falls back to slug when alt and title are missing", async () => {
    findManyMock.mockResolvedValueOnce([
      makeAsset({
        id: "no-trans",
        module: "audit",
        slug: "audit-pme-bureau",
        translations: [],
      }),
    ]);
    const result = await assignHeroImage({
      vertical: "audits",
      primaryKeyword: "audit IA",
    });
    expect(result?.alt).toBe("audit pme bureau");
  });
});

describe("VERTICAL_TO_IMAGE_MODULE mapping", () => {
  it("maps ServiceSector values to KeywordModule slugs", () => {
    const m = __testInternals.VERTICAL_TO_IMAGE_MODULE;
    expect(m.audits).toBe("audit");
    expect(m.interventions_formations).toBe("interventions-formations");
    expect(m.implementations).toBe("implementation");
    expect(m.un_a_un).toBe("coaching-1-to-1");
    expect(m.sites_web_augmentes).toBe("codage-developpement");
  });
});

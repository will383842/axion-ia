/**
 * Tests select-hero-image.ts — Unsplash primaire (Option A 2026-06-16) + fallback
 * image-bank.
 *
 * Couvre :
 * 1. Pas de clé Unsplash → fallback image-bank.
 * 2. Clé + Unsplash OK → source 'unsplash' avec attribution photographe.
 * 3. Clé mais Unsplash throw → fallback image-bank (jamais throw).
 * 4. Clé mais 0 source (Unsplash throw + bank null) → null.
 * 5. buildUnsplashQuery : retire le slug ville + 'pme'/'tpe'.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const generateMock = vi.fn<(...args: unknown[]) => Promise<{ output: string }>>();
const assignHeroImageMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock("../../providers/unsplash", () => ({
  unsplashProvider: { generate: (req: unknown) => generateMock(req) },
}));
vi.mock("../assign-hero-image", () => ({
  assignHeroImage: (input: unknown) => assignHeroImageMock(input),
}));

import { selectHeroImage, __testInternals } from "../select-hero-image";

const BANK_HIT = {
  assetId: "asset-1",
  filePath: "/image-bank/asset-1/hd.webp",
  thumbnailPath: null,
  avifPath: null,
  width: 1920,
  height: 1080,
  alt: "Atelier IA",
  slug: "atelier-ia",
};

function unsplashOutput(): string {
  return JSON.stringify({
    photoId: "abc123",
    width: 1920,
    height: 1080,
    alt: "Bureau lumineux",
    downloadUrl: "https://images.unsplash.com/photo-abc123?dl",
    hotlinkUrl: "https://images.unsplash.com/photo-abc123",
    attribution: {
      source: "unsplash",
      photoId: "abc123",
      photographer: "Jane Doe",
      photographerUrl: "https://unsplash.com/@jane?utm_source=axion-ia&utm_medium=referral",
      photoUrl: "https://unsplash.com/photos/abc123",
      photoCredit: "Photo de Jane Doe sur Unsplash",
      downloadTriggeredAt: "2026-06-16T00:00:00.000Z",
    },
  });
}

const ORIGINAL_KEY = process.env.UNSPLASH_ACCESS_KEY;

beforeEach(() => {
  generateMock.mockReset();
  assignHeroImageMock.mockReset();
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
  else process.env.UNSPLASH_ACCESS_KEY = ORIGINAL_KEY;
});

describe("selectHeroImage — Unsplash primaire + fallback bank", () => {
  it("sans clé Unsplash → fallback image-bank", async () => {
    delete process.env.UNSPLASH_ACCESS_KEY;
    assignHeroImageMock.mockResolvedValue(BANK_HIT);
    const res = await selectHeroImage({
      jobId: "job-1",
      contentType: "blog_article",
      vertical: "audits",
      primaryKeyword: "audit IA",
    });
    expect(generateMock).not.toHaveBeenCalled();
    expect(res?.source).toBe("image-bank");
    expect(res?.url).toBe(BANK_HIT.filePath);
    expect(res?.photographerName).toBeNull();
  });

  it("avec clé + Unsplash OK → source unsplash + attribution", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "test-key";
    generateMock.mockResolvedValue({ output: unsplashOutput() });
    const res = await selectHeroImage({
      jobId: "job-1",
      contentType: "blog_article",
      vertical: "audits",
      primaryKeyword: "audit IA",
    });
    expect(res?.source).toBe("unsplash");
    expect(res?.url).toBe("https://images.unsplash.com/photo-abc123");
    expect(res?.photographerName).toBe("Jane Doe");
    expect(res?.photographerUrl).toContain("unsplash.com/@jane");
    expect(assignHeroImageMock).not.toHaveBeenCalled();
  });

  it("avec clé mais Unsplash throw → fallback image-bank", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "test-key";
    generateMock.mockRejectedValue(new Error("rate limited"));
    assignHeroImageMock.mockResolvedValue(BANK_HIT);
    const res = await selectHeroImage({
      jobId: "job-1",
      contentType: "blog_article",
      primaryKeyword: "audit IA",
    });
    expect(res?.source).toBe("image-bank");
  });

  it("Unsplash throw + bank null → null", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "test-key";
    generateMock.mockRejectedValue(new Error("down"));
    assignHeroImageMock.mockResolvedValue(null);
    const res = await selectHeroImage({
      jobId: "job-1",
      contentType: "blog_article",
      primaryKeyword: "audit IA",
    });
    expect(res).toBeNull();
  });
});

describe("buildUnsplashQuery — nettoyage requête", () => {
  it("retire le slug ville et pme/tpe", () => {
    const q = __testInternals.buildUnsplashQuery({
      jobId: "j",
      contentType: "blog_article",
      primaryKeyword: "formation intelligence artificielle grenoble pme",
      anchorVilleSlug: "grenoble",
    });
    expect(q).toBe("formation intelligence artificielle");
  });

  it("mot-clé vide → null", () => {
    const q = __testInternals.buildUnsplashQuery({
      jobId: "j",
      contentType: "blog_article",
      primaryKeyword: "   ",
    });
    expect(q).toBeNull();
  });
});

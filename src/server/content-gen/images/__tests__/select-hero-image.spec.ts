/**
 * Tests select-hero-image.ts — Unsplash primaire (Option A 2026-06-16).
 *
 * MAJ 2026-06-21 : doctrine « Unsplash uniquement » → le fallback image-bank est
 * désactivé par défaut, réactivable via `HERO_IMAGE_BANK_FALLBACK=true`.
 *
 * Couvre :
 * 1. Pas de clé Unsplash + fallback OFF (défaut) → null (jamais image-bank).
 * 2. Pas de clé Unsplash + fallback ON → image-bank.
 * 3. Clé + Unsplash OK → source 'unsplash' avec attribution photographe.
 * 4. Clé mais Unsplash throw + fallback OFF → null (bank jamais appelé).
 * 5. Clé mais Unsplash throw + fallback ON → image-bank.
 * 6. Fallback ON + Unsplash throw + bank null → null.
 * 7. buildUnsplashQuery : retire le slug ville + 'pme'/'tpe'.
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
const ORIGINAL_FALLBACK = process.env.HERO_IMAGE_BANK_FALLBACK;

beforeEach(() => {
  generateMock.mockReset();
  assignHeroImageMock.mockReset();
  // Défaut « Unsplash uniquement » : fallback OFF sauf opt-in explicite par test.
  delete process.env.HERO_IMAGE_BANK_FALLBACK;
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
  else process.env.UNSPLASH_ACCESS_KEY = ORIGINAL_KEY;
  if (ORIGINAL_FALLBACK === undefined) delete process.env.HERO_IMAGE_BANK_FALLBACK;
  else process.env.HERO_IMAGE_BANK_FALLBACK = ORIGINAL_FALLBACK;
});

describe("selectHeroImage — Unsplash uniquement (fallback bank opt-in)", () => {
  it("sans clé Unsplash + fallback OFF (défaut) → null, bank jamais appelé", async () => {
    delete process.env.UNSPLASH_ACCESS_KEY;
    const res = await selectHeroImage({
      jobId: "job-1",
      contentType: "blog_article",
      vertical: "audits",
      primaryKeyword: "audit IA",
    });
    expect(generateMock).not.toHaveBeenCalled();
    expect(assignHeroImageMock).not.toHaveBeenCalled();
    expect(res).toBeNull();
  });

  it("sans clé Unsplash + fallback ON → image-bank", async () => {
    delete process.env.UNSPLASH_ACCESS_KEY;
    process.env.HERO_IMAGE_BANK_FALLBACK = "true";
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

  it("cascade : 1ère requête 0 résultat → fallback élargi trouve une photo (Will 2026-06-24)", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "test-key";
    // 1er appel (requête spécifique) : aucune photo exploitable (hotlinkUrl vide) ;
    // 2e appel (requête élargie / générique) : photo valide → source unsplash.
    generateMock
      .mockResolvedValueOnce({ output: JSON.stringify({ hotlinkUrl: "", attribution: null }) })
      .mockResolvedValueOnce({ output: unsplashOutput() });
    const res = await selectHeroImage({
      jobId: "job-1",
      contentType: "blog_article",
      // Titre long avec région → la requête brute échoue, l'élargissement sauve.
      primaryKeyword: "optimiser agence web auvergne rhone alpes grace intelligence",
    });
    expect(generateMock).toHaveBeenCalledTimes(2);
    expect(res?.source).toBe("unsplash");
    expect(assignHeroImageMock).not.toHaveBeenCalled();
  });

  it("avec clé mais Unsplash throw + fallback OFF → null, bank jamais appelé", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "test-key";
    generateMock.mockRejectedValue(new Error("rate limited"));
    const res = await selectHeroImage({
      jobId: "job-1",
      contentType: "blog_article",
      primaryKeyword: "audit IA",
    });
    expect(assignHeroImageMock).not.toHaveBeenCalled();
    expect(res).toBeNull();
  });

  it("avec clé mais Unsplash throw + fallback ON → image-bank", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "test-key";
    process.env.HERO_IMAGE_BANK_FALLBACK = "true";
    generateMock.mockRejectedValue(new Error("rate limited"));
    assignHeroImageMock.mockResolvedValue(BANK_HIT);
    const res = await selectHeroImage({
      jobId: "job-1",
      contentType: "blog_article",
      primaryKeyword: "audit IA",
    });
    expect(res?.source).toBe("image-bank");
  });

  it("fallback ON + Unsplash throw + bank null → null", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "test-key";
    process.env.HERO_IMAGE_BANK_FALLBACK = "true";
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

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildArticleUrl, buildArticlePath } from "../url-builder";

describe("buildArticleUrl", () => {
  let originalSiteUrl: string | undefined;

  beforeEach(() => {
    originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  });

  it("builds blog URL for default locale fr", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://axion-ia.com";
    expect(buildArticleUrl({ slug: "my-post", isNews: false })).toBe(
      "https://axion-ia.com/fr/blog/my-post",
    );
  });

  it("builds actualites URL when isNews=true", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://axion-ia.com";
    expect(buildArticleUrl({ slug: "news-item", isNews: true })).toBe(
      "https://axion-ia.com/fr/actualites/news-item",
    );
  });

  it("uses fallback prod URL when NEXT_PUBLIC_SITE_URL absent", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(buildArticleUrl({ slug: "test", isNews: false })).toBe(
      "https://axion-ia.com/fr/blog/test",
    );
  });

  it("strips trailing slash from SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://axion-ia.com/";
    expect(buildArticleUrl({ slug: "test", isNews: false })).toBe(
      "https://axion-ia.com/fr/blog/test",
    );
  });

  it("respects custom locale", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://axion-ia.com";
    expect(buildArticleUrl({ slug: "test", isNews: false, locale: "en" })).toBe(
      "https://axion-ia.com/en/blog/test",
    );
  });

  // ── Fix 2026-08-15 (D8 audit e2e) — alignement sur resolveArticleRoute ─────
  // Symptôme corrigé : un guide (slug `guide-*`) était pingé/revalidé sous
  // /fr/blog/guide-… qui répond 308 vers /fr/guides/… → la vraie URL n'était
  // jamais revalidée et les métriques GSC du tier-lifecycle restaient nulles.

  it("D8 : slug guide-* → segment /guides (plus jamais /blog qui 308)", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://axion-ia.com";
    expect(buildArticleUrl({ slug: "guide-audit-ia-pme", isNews: false })).toBe(
      "https://axion-ia.com/fr/guides/guide-audit-ia-pme",
    );
  });

  it("D8 : slug guide_* (underscore) → segment /guides", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://axion-ia.com";
    expect(buildArticleUrl({ slug: "guide_implementation-ia", isNews: false })).toBe(
      "https://axion-ia.com/fr/guides/guide_implementation-ia",
    );
  });

  it("D8 : templateVariant contenant « guide » → segment /guides même sans préfixe slug", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://axion-ia.com";
    expect(
      buildArticleUrl({
        slug: "audit-ia-cabinet-conseil",
        isNews: false,
        templateVariant: "template-guide-v2",
      }),
    ).toBe("https://axion-ia.com/fr/guides/audit-ia-cabinet-conseil");
  });

  it("D8 : isNews prime sur la détection guide (miroir resolveArticleRoute)", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://axion-ia.com";
    expect(buildArticleUrl({ slug: "guide-actualite-ia", isNews: true })).toBe(
      "https://axion-ia.com/fr/actualites/guide-actualite-ia",
    );
  });

  it("D8 : templateVariant null/absent → comportement historique /blog inchangé", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://axion-ia.com";
    expect(
      buildArticleUrl({ slug: "automatisation-rpa-pme", isNews: false, templateVariant: null }),
    ).toBe("https://axion-ia.com/fr/blog/automatisation-rpa-pme");
  });
});

describe("buildArticlePath (Fix 2026-08-15 D8 — path relatif pour revalidateContent)", () => {
  it("retourne le chemin relatif canonique (blog)", () => {
    expect(buildArticlePath({ slug: "my-post", isNews: false })).toBe("/fr/blog/my-post");
  });

  it("retourne le chemin relatif canonique (guide)", () => {
    expect(buildArticlePath({ slug: "guide-audit-ia", isNews: false })).toBe(
      "/fr/guides/guide-audit-ia",
    );
  });

  it("retourne le chemin relatif canonique (actualités)", () => {
    expect(buildArticlePath({ slug: "news-item", isNews: true })).toBe("/fr/actualites/news-item");
  });
});

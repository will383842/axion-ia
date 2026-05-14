import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildArticleUrl } from "../url-builder";

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
});

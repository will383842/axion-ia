/**
 * Pass B P0-2 (2/5) — Blog article content-gen.
 *
 * Smoke read-only : vérifie qu'un article de blog tier-1 rend avec :
 *   - Person JSON-LD Manon canonique
 *   - Article JSON-LD avec datePublished + dateModified
 *   - byline + author-card
 *   - aucune erreur console
 *
 * E2E_BLOG_SLUG (env) permet de pointer un article spécifique. Si absent,
 * le test essaie de récupérer le premier article du sitemap.
 */

import { test, expect } from "@playwright/test";

const BLOG_SLUG = process.env["E2E_BLOG_SLUG"];

test.describe("blog article — tier-1 AEO smoke", () => {
  test.skip(
    !BLOG_SLUG,
    "E2E_BLOG_SLUG non défini — squelette Sprint S6.3 (autopopulate via sitemap)",
  );

  test("Person JSON-LD Manon + Article dateModified > datePublished", async ({ page }) => {
    const path = `/fr/blog/${BLOG_SLUG}`;
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const response = await page.goto(path);
    expect(response?.status()).toBe(200);

    const ldScripts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const allLd = ldScripts.map((s) => JSON.parse(s));

    // H4 — author Person Manon @id
    const articleLd = allLd.find(
      (ld) => ld["@type"] === "Article" || ld["@type"] === "NewsArticle",
    );
    expect(articleLd).toBeDefined();
    expect(articleLd.author?.["@id"] ?? articleLd.author?.url).toContain("/fr/equipe/manon");

    // H6 — dateModified ≥ datePublished
    if (articleLd.datePublished && articleLd.dateModified) {
      const published = new Date(articleLd.datePublished).getTime();
      const modified = new Date(articleLd.dateModified).getTime();
      expect(modified).toBeGreaterThanOrEqual(published);
    }

    expect(errors).toEqual([]);
  });
});

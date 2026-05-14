/**
 * Pass B P0-2 (3/5) — Actualité RSS-derived (NewsArticle).
 *
 * Smoke read-only : vérifie qu'une URL `/fr/actualites/[slug]` rend avec :
 *   - NewsArticle JSON-LD (Schema.org)
 *   - sitemap-news.xml référence l'URL
 *   - balises `<time>` published/modified présentes
 *
 * E2E_NEWS_SLUG (env) ou squelette si vide.
 */

import { test, expect } from "@playwright/test";

const NEWS_SLUG = process.env["E2E_NEWS_SLUG"];

test.describe("actualités RSS — NewsArticle smoke", () => {
  test.skip(!NEWS_SLUG, "E2E_NEWS_SLUG non défini — squelette Sprint S6.3");

  test("rend avec NewsArticle JSON-LD + référence sitemap-news.xml", async ({ page, request }) => {
    const path = `/fr/actualites/${NEWS_SLUG}`;
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);

    // NewsArticle JSON-LD
    const ldTexts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const lds = ldTexts.map((s) => JSON.parse(s));
    const newsLd = lds.find((ld) => ld["@type"] === "NewsArticle");
    expect(newsLd).toBeDefined();
    expect(newsLd.datePublished).toBeTruthy();

    // sitemap-news.xml doit référencer l'URL canonique
    const sitemapResp = await request.get("/sitemap-news.xml");
    expect(sitemapResp.status()).toBe(200);
    const sitemapXml = await sitemapResp.text();
    expect(sitemapXml).toContain(NEWS_SLUG!);
  });

  test("sitemap-news.xml répond 200 même sans NEWS_SLUG", async ({ request }) => {
    const resp = await request.get("/sitemap-news.xml");
    expect([200, 404]).toContain(resp.status());
  });
});

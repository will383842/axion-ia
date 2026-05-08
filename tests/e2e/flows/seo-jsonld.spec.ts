// E2E flow — SEO/AEO JSON-LD rendu (Sprint 21 / M10).
// Verifie que les pages strategiques exposent du Schema.org valide
// pour Google + LLM citations (Perplexity/SGE/Claude/Bing Copilot).

import { test, expect } from "@playwright/test";

interface JsonLdNode {
  "@type"?: string | string[];
  "@context"?: string;
  [key: string]: unknown;
}

async function getJsonLd(page: import("@playwright/test").Page): Promise<JsonLdNode[]> {
  return page.$$eval('script[type="application/ld+json"]', (nodes) =>
    nodes
      .map((n) => {
        try {
          return JSON.parse(n.textContent ?? "");
        } catch {
          return null;
        }
      })
      .filter(Boolean),
  );
}

test.describe("SEO/AEO JSON-LD", () => {
  test("home FR has Organization + WebSite schema", async ({ page }) => {
    await page.goto("/fr");
    const jsonLd = await getJsonLd(page);
    const types = jsonLd
      .map((n) => (Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]]))
      .flat()
      .filter(Boolean);
    expect(types).toContain("Organization");
    expect(types).toContain("WebSite");
  });

  test("FAQ page exposes FAQPage schema", async ({ page }) => {
    await page.goto("/fr/faq");
    const jsonLd = await getJsonLd(page);
    const hasFaqPage = jsonLd.some((n) => {
      const t = Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]];
      return t.includes("FAQPage");
    });
    expect(hasFaqPage).toBe(true);
  });

  test("intervention essentielle page has Service or Product schema", async ({ page }) => {
    await page.goto("/fr/interventions/essentielle");
    const jsonLd = await getJsonLd(page);
    const types = jsonLd
      .map((n) => (Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]]))
      .flat()
      .filter(Boolean) as string[];
    expect(types.some((t) => ["Service", "Product"].includes(t))).toBe(true);
  });

  test("blog post slug has Article schema", async ({ page }) => {
    // On visite le listing puis on suit le 1er lien article
    await page.goto("/fr/blog");
    const firstArticleLink = page.locator('a[href*="/fr/blog/"][href$=""]').first();
    if ((await firstArticleLink.count()) === 0) {
      test.skip(true, "Aucun article blog publie");
    }
    const href = await firstArticleLink.getAttribute("href");
    if (!href) return;
    await page.goto(href);
    const jsonLd = await getJsonLd(page);
    const types = jsonLd
      .map((n) => (Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]]))
      .flat()
      .filter(Boolean) as string[];
    expect(types).toContain("Article");
  });
});

// E2E flow — SEO/AEO JSON-LD rendu (Sprint 21 / M10).
// Verifie que les pages strategiques exposent du Schema.org valide
// pour Google + LLM citations (Perplexity/SGE/Claude/Bing Copilot).

import { test, expect } from "@playwright/test";

interface JsonLdNode {
  "@type"?: string | string[];
  "@context"?: string;
  [key: string]: unknown;
}

/**
 * 🔴 2026-08-21 — CE LECTEUR NE DESCENDAIT PAS DANS `@graph`.
 *
 * Il rendait les objets RACINE de chaque bloc `application/ld+json`. Or le site
 * émet un `@graph` unique : la racine porte `@context` et `@graph`, et son
 * `@type` est `undefined`. Le test cherchait donc `Organization` et `WebSite`
 * dans une liste de `undefined`, et échouait — alors que les deux types sont
 * bel et bien présents en production (vérifié).
 *
 * 🔑 Un lecteur qui ne comprend pas la forme du document ne mesure rien. Il
 * échouait ici, ce qui est le cas heureux ; s'il avait cherché l'ABSENCE d'un
 * type, il aurait passé au vert sur n'importe quoi.
 */
async function getJsonLd(page: import("@playwright/test").Page): Promise<JsonLdNode[]> {
  return page.$$eval('script[type="application/ld+json"]', (nodes) =>
    nodes
      .map((n) => {
        try {
          return JSON.parse(n.textContent ?? "") as unknown;
        } catch {
          return null;
        }
      })
      .filter((v): v is Record<string, unknown> => v !== null && typeof v === "object")
      .flatMap((racine) => {
        const graphe = (racine as { "@graph"?: unknown })["@graph"];
        // Un `@graph` remplace la racine ; sans graphe, la racine EST le nœud.
        return Array.isArray(graphe) ? (graphe as Record<string, unknown>[]) : [racine];
      }),
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
    // 🔴 2026-08-22 — CE TEST N'A JAMAIS RIEN VÉRIFIÉ.
    //
    // Le sélecteur portait `[href$=""]`. Ce n'est pas un no-op : en CSS, une
    // valeur VIDE dans `^=`, `$=` ou `*=` ne représente RIEN, et le sélecteur
    // ne matche jamais. Mesuré en Chromium réel avec le Playwright du dépôt :
    // 0 élément avec `[href$=""]`, 29 sans.
    //
    // Le locator rendait donc toujours 0, la ligne `test.skip(true, "Aucun
    // article blog publié")` s'exécutait à CHAQUE passage, et le contrôle du
    // schéma Article n'a jamais tourné — alors que /fr/blog porte 28 articles.
    //
    // 🔑 Un test qui se saute pour une raison FAUSSE est pire qu'un test
    // absent : son « skipped » se lit comme une information sur le produit.
    //
    // Les trois `:not()` viennent du HTML de production : le 1er lien
    // `/fr/blog/` du document est le flux `feed.xml`, suivi de six
    // `/fr/blog/categorie/*` ; le 1er vrai article n'arrive qu'après. Et
    // `/fr/blog/page/2` existe (pagination).
    const firstArticleLink = page
      .locator("main")
      .locator(
        'a[href^="/fr/blog/"]:not([href*="/categorie"]):not([href*="/page/"]):not([href$=".xml"])',
      )
      .first();
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

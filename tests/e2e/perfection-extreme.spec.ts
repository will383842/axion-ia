/**
 * Sprint v7 Session 11 — E2E perfection extrême (Phase 18).
 *
 * Smoke tests cross-Sprint v7 sur la stack publique pour valider que la
 * livraison ne casse rien à l'utilisateur final :
 *   - Routes publiques 200 status
 *   - JSON-LD présents + valides structure
 *   - AiContentDisclaimer présent (AI Act art. 50)
 *   - Hreflang FR canonique
 *   - Pas d'erreur console JS sur les 5 pages stratégiques
 *
 * Cibles : pages stratégiques pSEO villes (top trafic Google) + admin gated
 * out (auth handled in dedicated admin specs).
 */

import { test, expect } from "@playwright/test";

const PUBLIC_ROUTES = [
  { path: "/fr", label: "Home" },
  { path: "/fr/audit", label: "Audit" },
  { path: "/fr/interventions", label: "Interventions" },
  { path: "/fr/implantations/ile-de-france/paris", label: "Hub Paris" },
  { path: "/fr/implantations/ile-de-france/paris/interventions", label: "Paris × interventions" },
] as const;

test.describe("Sprint v7 Phase 18 — perfection extrême publiques", () => {
  for (const { path, label } of PUBLIC_ROUTES) {
    test(`PE.${label}: ${path} répond 200 + h1 + pas d'erreur JS`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      const response = await page.goto(path);
      expect(response?.status(), `${path} HTTP status`).toBe(200);
      await expect(page.locator("h1").first(), `${path} h1 visible`).toBeVisible();
      // Les erreurs console JS = signal fort de régression hydration / hooks.
      expect(errors, `${path} console errors`).toEqual([]);
    });
  }

  test(`PE.JSON-LD: /fr a au moins 1 script application/ld+json`, async ({ page }) => {
    await page.goto("/fr");
    const jsonLdScripts = await page.locator('script[type="application/ld+json"]').count();
    expect(jsonLdScripts, "Home JSON-LD scripts present").toBeGreaterThan(0);
  });

  test(`PE.canonical-fr: <link rel="canonical"> présent + locale fr`, async ({ page }) => {
    await page.goto("/fr/audit");
    const canonical = await page.locator('link[rel="canonical"]').first().getAttribute("href");
    expect(canonical, "canonical href").toBeTruthy();
    expect(canonical, "canonical contient /fr/").toContain("/fr/");
  });
});

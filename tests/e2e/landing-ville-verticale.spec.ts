/**
 * Sprint v7 Phase 7 — E2E baseline route publique `/implantations/[region]/[ville]/[verticale]`.
 *
 * 3 smoke tests :
 *   E1. La route répond 200 pour une ville pilote (Paris) × les 5 verticales
 *   E2. Le breadcrumb affiche la hiérarchie complète (implantations > region > ville > verticale)
 *   E3. Verticale inconnue → 404 (notFound() côté server)
 *
 * ⚠️ Ces tests ne supposent PAS qu'un Article DB existe pour la combinaison
 * testée — la page tombe en stub minimal noindex si absent (cf. Phase 5 commit 2).
 * Ce qui est testé : la route répond, le rendu HTML est correct, pas de
 * console errors, breadcrumb présent.
 *
 * Pas d'admin auth requis (route publique).
 */

import { test, expect } from "@playwright/test";

// Ville pilote : Paris (top 1 population, fait partie du generateStaticParams top 100).
const PILOT_REGION = "ile-de-france";
const PILOT_VILLE = "paris";
const VERTICALES = [
  "interventions",
  "audits",
  "implementations",
  "un-a-un",
  "sites-web-ia",
] as const;

test.describe("Landing ville × verticale — route publique (Phase 5 commit 2)", () => {
  for (const verticale of VERTICALES) {
    test(`E1.${verticale}: /fr/implantations/${PILOT_REGION}/${PILOT_VILLE}/${verticale} répond 200`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      const response = await page.goto(
        `/fr/implantations/${PILOT_REGION}/${PILOT_VILLE}/${verticale}`,
      );
      expect(response?.status()).toBe(200);
      // h1 présent (que ce soit le stub ou le rendu complet)
      await expect(page.locator("h1").first()).toBeVisible();
      // Pas d'erreur JS console (signal régression rendering)
      expect(errors).toEqual([]);
    });
  }

  test(`E2: breadcrumb complet affiche implantations > region > ville > verticale`, async ({
    page,
  }) => {
    await page.goto(`/fr/implantations/${PILOT_REGION}/${PILOT_VILLE}/interventions`);
    // Le breadcrumb contient les 4 niveaux. La verticale est rendue avec son label FR.
    await expect(page.locator("nav").filter({ hasText: "Implantations" }).first()).toBeVisible();
    await expect(page.locator("nav").filter({ hasText: "Paris" }).first()).toBeVisible();
    await expect(
      page
        .locator("nav")
        .filter({ hasText: /Interventions/i })
        .first(),
    ).toBeVisible();
  });

  test(`E3: verticale invalide → 404`, async ({ page }) => {
    const response = await page.goto(
      `/fr/implantations/${PILOT_REGION}/${PILOT_VILLE}/unknown-vertical`,
    );
    expect(response?.status()).toBe(404);
  });
});

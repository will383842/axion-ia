/**
 * Pass B P0-2 (1/5) — Landing ville content-gen.
 *
 * Smoke read-only : vérifie qu'une landing ville publiée (tier-1) rend sans
 * erreur console, expose les balises SEO obligatoires § 9.7 (canonical,
 * og:image, JSON-LD Article/LocalBusiness), et que le breadcrumb est
 * sémantique.
 *
 * Ne couvre PAS (V1) : la génération depuis l'admin (nécessite auth +
 * provider keys). Cf. tests/integration/ pour le pipeline build.
 *
 * Critère de skip : si E2E_LANDING_SLUG n'est pas défini, on cible
 * `/fr/implantations/ile-de-france/paris` (slug pilote Paris validé Will).
 */

import { test, expect } from "@playwright/test";

const LANDING_PATH = process.env["E2E_LANDING_SLUG"] ?? "/fr/implantations/ile-de-france/paris";

test.describe("landing ville — tier-1 SEO smoke", () => {
  test("rend sans erreur console + JSON-LD Article|LocalBusiness présent", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const response = await page.goto(LANDING_PATH);
    expect(response?.status()).toBeLessThan(400);

    // Titre non vide (checklist § 9.7 A1)
    await expect(page).toHaveTitle(/.+/);

    // Canonical absolu (checklist A3)
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute("href", /^https:\/\/axion-ia\.com\//);

    // JSON-LD blocs (checklist H1+H2)
    const ldBlocks = page.locator('script[type="application/ld+json"]');
    const count = await ldBlocks.count();
    expect(count).toBeGreaterThanOrEqual(2);

    expect(errors).toEqual([]);
  });

  test("h1 unique + hreflang fr-FR + x-default", async ({ page }) => {
    await page.goto(LANDING_PATH);

    // E1 — H1 unique
    const h1s = page.locator("h1");
    await expect(h1s).toHaveCount(1);

    // A8 — hreflang
    //
    // 🔴 2026-08-21 — CETTE ASSERTION DÉCRIVAIT UN SITE BILINGUE.
    //
    // Elle exigeait `hreflang="fr-FR"` ET `x-default`. Mesuré en production sur
    // cette page même : **aucune** balise `hreflang`, et c'est cohérent — le
    // locale EN est éteint depuis le 2026-05-16, et le hreflang ne sert qu'à
    // relier des variantes de langue. `routing.ts` a coupé l'en-tête HTTP pour
    // la même raison (GEO-005) : on annonçait un alternate vers une redirection.
    //
    // Doublement périmée, d'ailleurs : le code régional `fr-FR` n'a jamais été
    // celui qu'émet le site, qui utilise `fr`.
    const enActif = process.env["EN_LOCALE_ENABLED"] === "true";
    const hreflangs = page.locator('link[rel="alternate"][hreflang]');
    if (enActif) {
      await expect(
        page.locator('link[rel="alternate"][hreflang="en"]'),
        "EN réactivé : la variante EN doit être déclarée sur les pages ville",
      ).toHaveCount(1);
    } else {
      await expect(
        hreflangs,
        "EN est éteint : aucune balise hreflang ne doit être déclarée — en annoncer " +
          "une pointerait le moteur vers une redirection",
      ).toHaveCount(0);
    }
  });
});

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
    // cette page même : la page déclare `fr` et `x-default`, un de chaque, et
    // AUCUN `en` — le locale EN est éteint depuis le 2026-05-16, et annoncer un
    // alternate vers une redirection est le signal contradictoire que
    // `routing.ts` a supprimé de l'en-tête HTTP pour la même raison (GEO-005).
    //
    // L'assertion d'origine visait `hreflang="fr-FR"`. Le site n'a jamais émis
    // de code régional : il émet `fr`. Elle échouait donc sur un code de langue,
    // pas sur un défaut.
    const enActif = process.env["EN_LOCALE_ENABLED"] === "true";
    // 🔴 L'assertion d'origine visait `hreflang="fr-FR"`. Le site n'a jamais
    // émis de code régional : il émet `fr`. Mesuré sur cette page même, en
    // production : `fr` et `x-default`, un de chaque, et aucun `en`.
    await expect(
      page.locator('link[rel="alternate"][hreflang="fr"]'),
      "la page ville doit déclarer sa propre variante FR",
    ).toHaveCount(1);
    await expect(
      page.locator('link[rel="alternate"][hreflang="x-default"]'),
      "la page ville doit déclarer un x-default",
    ).toHaveCount(1);
    await expect(
      page.locator('link[rel="alternate"][hreflang="en"]'),
      enActif
        ? "EN réactivé : la variante EN doit être déclarée sur les pages ville"
        : "EN est éteint : aucun alternate `en` ne doit être déclaré",
    ).toHaveCount(enActif ? 1 : 0);
  });
});

// E2E flow — bascule langue FR↔EN (Sprint 21 / M10).
//
// 🔴 2026-08-21 — CE FICHIER DÉCRIVAIT UN SÉLECTEUR DE LANGUE QUI N'EXISTE PLUS.
//
// Le locale EN est éteint depuis le 2026-05-16 : `src/proxy.ts` redirige tout
// `/en/*` en 301 vers l'équivalent FR, et le hreflang HTML est gaté par
// `isEnLocaleDisabled()`. Trois des quatre tests exigeaient donc l'inverse du
// contrat voulu — un `hreflang="en"` présent, une page EN qui rend, un slug
// `/interventions/essentielle` qui existe encore alors que le module a été
// renommé en `/formations`.
//
// Personne ne l'a vu pendant trois mois : la suite ne tournait pas, le calcul du
// delta de bundle détruisant le build avant Playwright.
//
// On ne SUPPRIME pas ces tests — ce serait perdre la garde sur la redirection,
// qui porte tout le link juice des URLs EN déjà indexées, et perdre la
// couverture du jour où EN reviendra. On assère le contrat RÉEL, et la branche
// `enActif` rétablit l'ancien dès que le drapeau est posé.

import { test, expect } from "@playwright/test";

/** Le drapeau qui décide, côté serveur comme ici. */
const enActif = (): boolean => process.env["EN_LOCALE_ENABLED"] === "true";

test.describe("Locale EN — état du basculement FR ↔ EN", () => {
  test("la page d'accueil FR déclare un hreflang EN si et seulement si EN est actif", async ({
    page,
  }) => {
    await page.goto("/fr");
    const hreflangEn = page.locator('link[rel="alternate"][hreflang="en"]');

    if (enActif()) {
      await expect(hreflangEn, "EN réactivé : la variante EN doit être déclarée").toHaveCount(1);
      expect(await hreflangEn.getAttribute("href")).toContain("/en");
      return;
    }

    // 🔑 Annoncer un alternate EN alors que `/en/*` redirige, c'est envoyer
    // Google sur une redirection depuis 100 % des pages. C'est exactement le
    // signal contradictoire que GEO-005 a supprimé de l'en-tête HTTP.
    await expect(hreflangEn, "EN est éteint : aucun hreflang EN ne doit être déclaré").toHaveCount(
      0,
    );
  });

  test("/en redirige en permanence vers /fr tant que EN est éteint", async ({ request }) => {
    const reponse = await request.get("/en", { maxRedirects: 0 });

    if (enActif()) {
      expect(reponse.status(), "EN réactivé : /en doit rendre une page").toBe(200);
      return;
    }

    expect(
      [301, 308],
      `/en doit être redirigé en PERMANENCE vers FR — reçu ${reponse.status()}. ` +
        "Un 307 serait recrawlé indéfiniment ; un 200 signifierait que EN a été " +
        "réactivé sans mettre cette spec à jour.",
    ).toContain(reponse.status());
    expect(reponse.headers()["location"] ?? "").toMatch(/\/fr(\/|$|\?)/);
  });

  test("un slug EN atteint sa canonique FR par une chaîne permanente", async ({ request }) => {
    // 🔴 L'ancienne version visait `/fr/interventions/essentielle`. Mesuré en
    // production : cette page rend **308 vers `/fr/formations`** — le module a
    // été renommé. Un test qui vise l'ancien nom échoue sur un renommage, pas
    // sur un défaut.
    let courante = "/en/interventions/essential";
    const sauts: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const etape = await request.get(courante, { maxRedirects: 0 });
      if (etape.status() < 300 || etape.status() >= 400) break;
      expect(
        [301, 308],
        `${courante} doit rediriger en permanence — reçu ${etape.status()}`,
      ).toContain(etape.status());
      const brut = etape.headers()["location"] ?? "";
      courante = brut.startsWith("http") ? new URL(brut).pathname : (brut.split("?")[0] ?? "");
      sauts.push(`${etape.status()} → ${courante}`);
    }

    expect(sauts.length, `chaîne trop longue : ${sauts.join(" · ")}`).toBeLessThanOrEqual(3);
    expect(courante, `doit finir en FR — chaîne : ${sauts.join(" · ")}`).toMatch(/^\/fr(\/|$)/);
    const finale = await request.get(courante, { maxRedirects: 0 });
    expect(finale.status(), `${courante} (fin de chaîne) doit rendre 200`).toBe(200);
  });

  test("aucun sélecteur de langue n'est rendu tant que EN est éteint", async ({ page }) => {
    // Contre-témoin de l'ensemble : si un jour le sélecteur revient sans que le
    // drapeau soit posé, ce test le dit — plutôt que de laisser un visiteur
    // cliquer sur une langue qui le renverra d'où il vient.
    await page.goto("/fr");
    const bascule = page.locator('[data-testid="locale-switcher"]');
    if (enActif()) {
      await expect(bascule, "EN réactivé : le sélecteur doit revenir").toHaveCount(1);
      return;
    }
    await expect(bascule, "EN éteint : aucun sélecteur ne doit être rendu").toHaveCount(0);
  });
});

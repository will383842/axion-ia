import { test, expect } from "@playwright/test";

test.describe("i18n + layout", () => {
  test("/ redirects to /fr (default locale)", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.url()).toMatch(/\/fr$/);
  });

  test("no public locale switcher (EN disabled, FR-only UI)", async ({ page }) => {
    // EN désactivé (2026-05-16, cf. AGENTS.md) — le LocaleSwitcher FR/EN a été
    // retiré du footer public car EN ne s'affiche plus nulle part (301 → FR).
    // On vérifie qu'aucun toggle de langue n'est rendu.
    await page.goto("/fr");
    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.locator('[data-testid="locale-switcher"]')).toHaveCount(0);
  });

  // 🔴 2026-08-21 — CE TEST DÉCRIVAIT LE MONDE D'AVANT L'EXTINCTION D'EN.
  //
  // Il exigeait `hreflang` fr, en ET x-default. Mesuré en production : la page
  // d'accueil n'en porte AUCUN — et c'est cohérent. Le hreflang sert à relier
  // des variantes de langue ; sur un site devenu monolingue il n'a plus d'objet,
  // et `routing.ts` a coupé l'en-tête HTTP pour la même raison (GEO-005) : on
  // annonçait à Google un alternate `en` pointant sur une redirection.
  //
  // Le fichier contenait déjà, deux tests plus haut, une assertion qui SAIT
  // qu'EN est éteint. Deux tests voisins, deux mondes — c'est ainsi qu'une suite
  // se met à mentir par morceaux.
  //
  // On garde la couverture du jour où EN reviendra : la branche `enActif`
  // rétablit l'exigence d'origine.
  test("hreflang cohérent avec l'état du locale EN", async ({ page }) => {
    const enActif = process.env["EN_LOCALE_ENABLED"] === "true";
    await page.goto("/fr");
    const fr = await page.locator('link[rel="alternate"][hreflang="fr"]').count();
    const en = await page.locator('link[rel="alternate"][hreflang="en"]').count();
    const xDefault = await page.locator('link[rel="alternate"][hreflang="x-default"]').count();

    if (enActif) {
      expect(fr, "EN réactivé : la variante FR doit être déclarée").toBeGreaterThan(0);
      expect(en, "EN réactivé : la variante EN doit être déclarée").toBeGreaterThan(0);
      expect(xDefault, "EN réactivé : x-default doit être déclaré").toBeGreaterThan(0);
      return;
    }

    // 🔴 RECTIFICATION, LE JOUR MÊME. Un premier jet exigeait ZÉRO balise, sur
    // la foi d'un `grep hreflang` en minuscules contre la production. Or React
    // rend l'attribut en camelCase — `hrefLang` — et le grep ne voyait rien.
    // Remesuré sans casse : la page porte bien DEUX alternates, `fr` et
    // `x-default`, et aucun `en`. Exactement ce que rend la CI.
    //
    // 🔑 Une mesure qui ne trouve rien doit d'abord faire douter de la mesure.
    // C'est la quatrième fois de la journée qu'une lecture trop pressée a failli
    // produire un faux constat.
    expect(
      { fr, en, xDefault },
      "EN est éteint : la page doit déclarer sa propre variante FR et un " +
        "x-default, mais AUCUN alternate `en` — en annoncer un pointerait Google " +
        "vers une redirection, le signal contradictoire que GEO-005 a supprimé " +
        "de l'en-tête HTTP pour la même raison",
    ).toEqual({ fr: 1, en: 0, xDefault: 1 });
  });

  test("skip-to-content is the first focusable element", async ({ page }) => {
    await page.goto("/fr");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.textContent ?? "");
    expect(focused).toContain("Aller au contenu");
  });

  test("404 not-found is localized", async ({ page }) => {
    const fr = await page.goto("/fr/inexistant-route");
    expect(fr?.status()).toBe(404);
    await expect(page.locator("h1")).toContainText("introuvable");

    // 🔴 EN est éteint : `/en/missing-route` ne rend pas un 404 anglais, il est
    // redirigé en 301 vers `/fr/missing-route`, qui rend le 404 FRANÇAIS. C'est
    // le contrat voulu — une URL EN indexée doit transmettre son link juice à la
    // canonique FR, y compris quand elle n'existe pas.
    const enVersFr = await page.request.get("/en/missing-route", { maxRedirects: 0 });
    expect(
      enVersFr.status(),
      "une URL EN inexistante doit être redirigée en permanence, pas rendue en 404 anglais",
    ).toBe(301);
    expect(enVersFr.headers()["location"] ?? "").toContain("/fr/missing-route");

    const enSuivi = await page.goto("/en/missing-route");
    expect(enSuivi?.status(), "la destination FR doit bien rendre un 404").toBe(404);
    await expect(page.locator("h1")).toContainText("introuvable");
  });
});

test.describe("SEO endpoints", () => {
  test("sitemap.xml has hreflang alternates", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('hreflang="fr"');
    expect(body).toContain('hreflang="en"');
    expect(body).toContain('hreflang="x-default"');
  });

  test("robots.txt references the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("Sitemap:");
    expect(body).toContain("/sitemap.xml");
  });

  test("llms.txt is served as plain text", async ({ request }) => {
    const res = await request.get("/llms.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");
    const body = await res.text();
    expect(body).toContain("Axion-IA");
    expect(body).toContain("Modules");
  });
});

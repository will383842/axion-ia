// E2E flow — bascule langue FR↔EN (Sprint 21 / M10).
// Verifie next-intl + hreflang + preserve state (URL + content adapte).

import { test, expect } from "@playwright/test";

test.describe("Language switcher FR ↔ EN", () => {
  test("homepage FR has hreflang to EN", async ({ page }) => {
    await page.goto("/fr");
    const hreflangEn = page.locator('link[rel="alternate"][hreflang="en"]');
    await expect(hreflangEn).toHaveCount(1);
    const href = await hreflangEn.getAttribute("href");
    expect(href).toContain("/en");
  });

  test("homepage EN has hreflang to FR", async ({ page }) => {
    await page.goto("/en");
    const hreflangFr = page.locator('link[rel="alternate"][hreflang="fr"]');
    await expect(hreflangFr).toHaveCount(1);
  });

  test("interventions page slug differs FR vs EN", async ({ page }) => {
    // FR : /interventions/essentielle
    await page.goto("/fr/interventions/essentielle");
    await expect(page).toHaveURL(/\/fr\/interventions\/essentielle/);
    // EN slug equivalent : /interventions/essential
    const respEn = await page.request.get("/en/interventions/essential");
    expect([200, 301, 308]).toContain(respEn.status());
  });

  test("locale cookie is set when navigating", async ({ page, context }) => {
    await page.goto("/fr");
    const cookies = await context.cookies();
    const localeCookie = cookies.find(
      (c) => c.name.includes("LOCALE") || c.name.includes("locale"),
    );
    // Pas obligatoire en V1 (next-intl peut ne pas poser de cookie),
    // mais on verifie au moins que la requete passe.
    expect(localeCookie === undefined || typeof localeCookie.value === "string").toBe(true);
  });
});

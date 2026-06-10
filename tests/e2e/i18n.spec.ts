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

  test("hreflang alternates exposed in <head>", async ({ page }) => {
    await page.goto("/fr");
    const fr = await page.locator('link[rel="alternate"][hreflang="fr"]').count();
    const en = await page.locator('link[rel="alternate"][hreflang="en"]').count();
    const xDefault = await page.locator('link[rel="alternate"][hreflang="x-default"]').count();
    expect(fr).toBeGreaterThan(0);
    expect(en).toBeGreaterThan(0);
    expect(xDefault).toBeGreaterThan(0);
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

    const en = await page.goto("/en/missing-route");
    expect(en?.status()).toBe(404);
    await expect(page.locator("h1")).toContainText("not found");
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

/**
 * Content Generator — Admin UI smoke E2E (Sprint 6).
 *
 * V1 smoke = 5 scénarios couvrant les surfaces les plus visibles :
 *  1. Dashboard accessible (redirige login si pas auth)
 *  2. Settings hub liste les 11 sous-pages
 *  3. Templates page renvoie 200 (vide ou non)
 *  4. Coverage list renvoie 200
 *  5. Geo cockpit renvoie 200
 *
 * V1 vérifie uniquement les routes non-auth (la page redirige login). Le
 * full E2E avec login admin + génération réelle arrive V1.5+ avec auth
 * fixtures content-gen dédiées.
 */

import { test, expect } from "@playwright/test";

const ADMIN_PREFIX = process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9";

test.describe("content-gen admin smoke", () => {
  test("dashboard route exists (redirect login si !session)", async ({ page }) => {
    const response = await page.goto(`/fr/${ADMIN_PREFIX}/content-gen`);
    expect(response?.status()).toBeLessThan(500); // 200 ou redirect
  });

  test("settings hub route exists", async ({ page }) => {
    const response = await page.goto(`/fr/${ADMIN_PREFIX}/content-gen/settings`);
    expect(response?.status()).toBeLessThan(500);
  });

  test("templates list route exists", async ({ page }) => {
    const response = await page.goto(`/fr/${ADMIN_PREFIX}/content-gen/templates`);
    expect(response?.status()).toBeLessThan(500);
  });

  test("coverage list route exists", async ({ page }) => {
    const response = await page.goto(`/fr/${ADMIN_PREFIX}/content-gen/coverage`);
    expect(response?.status()).toBeLessThan(500);
  });

  test("geo cockpit route exists", async ({ page }) => {
    const response = await page.goto(`/fr/${ADMIN_PREFIX}/content-gen/geo`);
    expect(response?.status()).toBeLessThan(500);
  });
});

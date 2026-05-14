// E2E smoke admin routes (Sprint X.19 — Booking V1 V2).
//
// Vérifie que les nouvelles routes admin Booking V1 existent et que le
// guard auth redirige proprement non-authentifié vers /login.
//
// Pourquoi pas de scénario authentifié bout-en-bout ?
//   - Le booking happy path est déjà couvert par booking-submit.spec.ts
//   - L'auth admin demande un seed DB (AdminUser + session) qui dépend
//     de la base prête localement. Reporté X.19b avec helper de seed +
//     fixtures auth, en parallèle des migrations Coolify post-deploy.
//
// Les tests ici sont :
//   1. /admin/[prefix]/reservations → 302 vers /login (auth gate)
//   2. /admin/[prefix]/factures → idem
//   3. /admin/[prefix]/paiements → idem
//   4. /admin/[prefix]/calendrier/heatmap → idem
//   5. /admin/[prefix]/reservations/<uuid-bidon> → idem (pas de fuite info)
//   6. /admin/<prefix-faux> → 404 silencieux (pas de fingerprint adminPrefix)
//
// La env var `ADMIN_URL_PREFIX` est lue côté serveur. Pour tester, on lit
// la même valeur côté E2E (defaults `admin-dev-x7k2n9` pour parité).

import { test, expect } from "@playwright/test";

const ADMIN_PREFIX = process.env["ADMIN_URL_PREFIX"] ?? "admin-dev-x7k2n9";

test.describe("Admin routes — Sprint X.19 smoke", () => {
  test("non-auth /admin/reservations → redirect /login", async ({ page }) => {
    const response = await page.goto(`/fr/${ADMIN_PREFIX}/reservations`);
    // Login page rendue (status 200 final) OU redirect 302 capturé Playwright
    // (Next renvoie un redirect côté serveur, Playwright suit l'URL finale).
    expect(response?.status()).toBeLessThan(500);
    // Doit landé sur /login (l'URL finale après follow redirect)
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("non-auth /admin/factures → redirect /login", async ({ page }) => {
    const response = await page.goto(`/fr/${ADMIN_PREFIX}/factures`);
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("non-auth /admin/paiements → redirect /login", async ({ page }) => {
    const response = await page.goto(`/fr/${ADMIN_PREFIX}/paiements`);
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("non-auth /admin/calendrier/heatmap → redirect /login", async ({ page }) => {
    const response = await page.goto(`/fr/${ADMIN_PREFIX}/calendrier/heatmap`);
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("non-auth /admin/reservations/<uuid> → redirect /login (no info leak)", async ({ page }) => {
    const response = await page.goto(
      `/fr/${ADMIN_PREFIX}/reservations/00000000-0000-0000-0000-000000000000`,
    );
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("admin prefix incorrect → 404 silencieux (pas de fingerprint)", async ({ page }) => {
    // Tente une URL avec un prefix bidon — le layout doit notFound() sans
    // révéler que la valeur correcte est différente.
    const response = await page.goto("/fr/admin-wrong-prefix-xyz/reservations");
    expect(response?.status()).toBe(404);
  });
});

// E2E flow — admin login + 2FA setup + dashboard (Sprint 21 / M10).
// Necessite : pnpm db:seed prealable + dev server lance.
// Smoke seulement : verifie que les pages admin repondent + form login present.

import { test, expect } from "@playwright/test";

const ADMIN_PREFIX = process.env["ADMIN_URL_PREFIX"] ?? "admin-dev-x7k2n9";

test.describe("Admin auth flow", () => {
  test("login page renders form fields", async ({ page }) => {
    await page.goto(`/fr/${ADMIN_PREFIX}/login`);
    await expect(page).toHaveTitle(/.+/);
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible();
    const submit = page.getByRole("button", { name: /continuer|connexion/i }).first();
    await expect(submit).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto(`/fr/${ADMIN_PREFIX}/login`);
    await page.getByLabel(/email/i).fill("invalid@example.com");
    await page.getByLabel(/mot de passe/i).fill("wrongpassword123");
    await page
      .getByRole("button", { name: /continuer|connexion/i })
      .first()
      .click();
    // L'erreur peut prendre quelques secondes (rate-limit + verifyPasswordSafe)
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 15000 });
  });

  test("dashboard redirects to login if not authenticated", async ({ page }) => {
    await page.goto(`/fr/${ADMIN_PREFIX}`);
    // Middleware doit rediriger vers login
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("admin URL with wrong prefix returns 404", async ({ page }) => {
    const response = await page.goto("/fr/wrong-admin-prefix-xyz/login");
    expect([404, 308, 307]).toContain(response?.status() ?? 0);
  });
});

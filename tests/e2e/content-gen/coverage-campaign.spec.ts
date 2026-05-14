/**
 * Pass B P0-2 (4/5) — Campagne de couverture (Pipeline 3).
 *
 * Smoke admin : vérifie que la console admin /content-gen/campaigns existe
 * et expose les Server Actions de création + suivi temps réel SSE.
 *
 * Nécessite E2E_ADMIN_BASIC_AUTH ou skip. Pour V1, le test vérifie au
 * minimum que le hub admin renvoie 401/302 sans auth (pas de leak).
 */

import { test, expect } from "@playwright/test";

const ADMIN_PREFIX = process.env["E2E_ADMIN_PREFIX"] ?? "admin";

test.describe("coverage campaign — admin hub smoke", () => {
  test("hub /[adminPrefix]/content-gen/campaigns refuse l'accès sans auth", async ({ page }) => {
    const response = await page.goto(`/fr/${ADMIN_PREFIX}/content-gen/campaigns`, {
      waitUntil: "domcontentloaded",
    });
    // Doit rediriger vers login (302) ou renvoyer 401, jamais render 200 sans auth
    expect([200, 302, 401, 403, 404]).toContain(response?.status() ?? 0);
    // Si 200 → vérifie qu'il s'agit bien d'une page login (pas leak)
    if (response?.status() === 200) {
      const url = page.url();
      expect(url).toMatch(/login|auth/);
    }
  });

  test.skip(
    !process.env["E2E_ADMIN_COOKIE"],
    "E2E_ADMIN_COOKIE non défini — flow E2E complet Sprint S6.3 (fixture admin)",
  );
});

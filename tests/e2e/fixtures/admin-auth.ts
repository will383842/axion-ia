// Playwright fixture — login admin via UI (Sprint D — Booking V1).
//
// Helper réutilisable pour authentifier un test E2E en tant qu'admin.
//
// Pré-requis :
//   - Dev server lancé (`pnpm dev`)
//   - DB seed avec AdminUser existant (ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD set)
//   - 2FA désactivé pour l'admin de test (ou test E2E adapté pour saisir TOTP)
//
// Usage :
//   import { test, expect } from "@playwright/test";
//   import { loginAsAdmin } from "../fixtures/admin-auth";
//   test("scénario admin", async ({ page }) => {
//     await loginAsAdmin(page);
//     await page.goto(`/fr/${ADMIN_PREFIX}/reservations`);
//     // ...
//   });

import type { Page } from "@playwright/test";

export const ADMIN_PREFIX = process.env["ADMIN_URL_PREFIX"] ?? "admin-dev-x7k2n9";
export const ADMIN_EMAIL = process.env["ADMIN_SEED_EMAIL"] ?? "admin@axion-ia.local";
export const ADMIN_PASSWORD = process.env["ADMIN_SEED_PASSWORD"] ?? "ChangeMe!2026Axion";

export interface LoginOptions {
  /** Override email pour ce login précis. */
  email?: string;
  /** Override password. */
  password?: string;
  /** Skip la vérification dashboard (utile si le test attend une redirection ailleurs). */
  skipDashboardCheck?: boolean;
}

/**
 * Authentifie un admin via UI et attend que le dashboard soit chargé.
 *
 * Throws si le login échoue (mauvais credentials, 2FA actif, rate-limit, etc.).
 * Le test appelant peut catch pour skip si la DB n'est pas seedée localement.
 */
export async function loginAsAdmin(page: Page, opts: LoginOptions = {}): Promise<void> {
  const email = opts.email ?? ADMIN_EMAIL;
  const password = opts.password ?? ADMIN_PASSWORD;

  await page.goto(`/fr/${ADMIN_PREFIX}/login`);
  // 🔴 Ciblage par identifiant, et non par libellé.
  //
  // `getByLabel(/mot de passe/i)` résolvait DEUX éléments : le champ, et le
  // bouton afficher/masquer dont l'`aria-label` vaut « Afficher le mot de
  // passe ». En mode strict, Playwright refuse d'agir sur un locator ambigu —
  // donc `loginAsAdmin` ne pouvait PAS aboutir, et tout test qui l'appelle
  // se sautait en silence. Le formulaire est correct ; c'était le sélecteur.
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page
    .getByRole("button", { name: /continuer|connexion/i })
    .first()
    .click();

  if (opts.skipDashboardCheck) return;

  // Le login peut rediriger vers :
  //   - / (dashboard) si pas de 2FA configuré
  //   - /2fa si 2FA requis
  //   - rester sur /login avec erreur si credentials invalides
  await page.waitForURL(
    (url) => {
      // 🔴 Le préfixe de langue est FACULTATIF dans l’URL d’arrivée.
      //
      // Ce prédicat n’acceptait que `/fr/${ADMIN_PREFIX}`. Or l’application
      // atterrit sur `/${ADMIN_PREFIX}` — sans `/fr`. La vérification
      // échouait donc TOUJOURS, `loginAsAdmin` levait, et tout test qui
      // l’appelle se sautait en silence : une couverture qui n’en était pas
      // une, et qui ne rougissait jamais.
      const pathname = new URL(url).pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "");
      return (
        pathname === `/${ADMIN_PREFIX}` ||
        pathname === `/${ADMIN_PREFIX}/` ||
        pathname.startsWith(`/${ADMIN_PREFIX}/2fa`)
      );
    },
    { timeout: 15_000 },
  );
}

/**
 * Vérifie si le login est faisable en local — utile pour skip un test si
 * la DB n'est pas seedée (CI ou dev sans seed).
 *
 * Retourne true si le compte admin existe et accepte le password env var.
 */
export async function isAdminLoginConfigured(page: Page): Promise<boolean> {
  try {
    await loginAsAdmin(page);
    return true;
  } catch {
    return false;
  }
}

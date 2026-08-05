/**
 * E2E — wizard « Nouvelle vente » (plan 2026-08-05, stratégie de test §1a).
 *
 * Parcours réel dans le navigateur : connexion admin → création d'un client
 * neuf → choix d'une offre et d'une formation publiée → création du devis
 * (brouillon) → checklist du dossier à l'étape 4. Tourne aussi sous le projet
 * `mobile-chrome` (playwright.config.ts) — le wizard est utilisé au téléphone.
 *
 * ## Limites assumées
 *
 * La signature du devis appartient au CLIENT (canal maison, lien e-mail) : un
 * e2e ne peut pas la produire sans fixture de signature dédiée. Le parcours
 * s'arrête donc au devis créé + checklist rendue ; la machine à états complète
 * (devis signé → session → certificats/facture, ~1 573 combinaisons) est
 * verrouillée par `src/server/qualiopi/vente/checklist-exhaustif.spec.ts`.
 *
 * Pré-requis : dev server + DB seedée (ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD,
 * 2FA off) et AU MOINS une offre active + une formation publiée. Si non seedé
 * → test.skip explicite (pas un fail), même politique que admin-booking-flow.
 */

import { test, expect } from "@playwright/test";
import { ADMIN_PREFIX, loginAsAdmin } from "../fixtures/admin-auth";

test.describe("Wizard nouvelle vente — client → devis → checklist", () => {
  test("le parcours crée le client, le devis, et rend la checklist", async ({ page }) => {
    try {
      await loginAsAdmin(page);
    } catch {
      test.skip(true, "DB non seedée (ADMIN_SEED_EMAIL/PASSWORD) — e2e local uniquement");
      return;
    }

    await page.goto(`/fr/${ADMIN_PREFIX}/qualiopi/vente/new`);
    await expect(page.getByRole("heading", { name: /Étape 1 — Pour quel client/ })).toBeVisible();

    // ── Étape 1 — nouveau client (nom unique : le CRM de dev accumule) ──────
    await page.getByRole("radio", { name: "Nouveau client" }).check();
    const raisonSociale = `E2E VENTE ${Date.now()}`;
    await page.getByLabel("Raison sociale *").fill(raisonSociale);
    await page.getByRole("button", { name: "Créer le client" }).click();
    await expect(page.getByText(/créé — passez à l'étape suivante/)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Suivant" }).click();

    // ── Étape 2 — offre + formation publiée ─────────────────────────────────
    await expect(page.getByRole("heading", { name: /Étape 2 — Quelle formation/ })).toBeVisible();
    const selectOffre = page.getByLabel("Offre du catalogue");
    const nbOffres = await selectOffre.locator("option").count();
    if (nbOffres < 2) {
      test.skip(true, "Aucune offre active en base de dev — seed incomplet");
      return;
    }
    await selectOffre.selectOption({ index: 1 });

    const selectFormation = page.getByLabel("Formation publiée");
    const nbFormations = await selectFormation.locator("option").count();
    if (nbFormations < 2) {
      test.skip(true, "Aucune formation publiée en base de dev — seed incomplet");
      return;
    }
    await selectFormation.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Suivant" }).click();

    // ── Étape 3 — devis brouillon ───────────────────────────────────────────
    await expect(page.getByRole("heading", { name: /Étape 3 — Devis/ })).toBeVisible();
    await page.getByLabel("Montant HT (€)").fill("1900");
    await page.getByRole("button", { name: "Créer le devis (brouillon)" }).click();
    // Le numéro séquentiel prouve que l'action serveur a réellement écrit.
    await expect(page.getByText(/Devis AXI-DEV-\d{4}-\d+/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Suivant" }).click();

    // ── Étape 4 — checklist du dossier ──────────────────────────────────────
    await expect(page.getByRole("heading", { name: /Étape 4 — Checklist/ })).toBeVisible();
    // Le devis existe (lien vers sa fiche) ; la session reste à faire — la
    // checklist DOIT montrer les deux, pas seulement ce qui est fait.
    await expect(page.getByRole("link", { name: "Devis" })).toBeVisible();
    await expect(page.getByText("Session de formation")).toBeVisible();
  });
});

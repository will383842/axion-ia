// E2E flow — routes de l'ancien module Booking (mort) → redirections 308.
//
// Réécrit le 2026-08-01 (audit UX phase 2) : les pages Réservations / Devis /
// Factures / Paiements / Échéanciers / Calendrier / Options du module Booking
// (flux public éteint, tables orphelines) redirigent désormais vers les
// modules réels (planning, pipeline dossiers, devis Qualiopi, hub
// facturation, plans récurrents). Ce spec vérifie que chaque ancienne URL
// atterrit authentifiée sur sa cible — plus aucun heading Booking n'existe.
//
// Pré-requis : DB seed AdminUser (ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD env),
// 2FA désactivé. Si non seedé → test.skip explicite (pas un fail).

import { test, expect } from "@playwright/test";
import { ADMIN_PREFIX, loginAsAdmin, baseSemeeAttendue } from "../fixtures/admin-auth";

test.describe("Legacy booking — redirections vers les modules réels", () => {
  // Budget explicite : cette suite ouvre une session admin (Argon2id, quatre
  // workers concurrents en CI). Le défaut de 30 s de `playwright.config.ts`
  // ne suffit pas — cf. `tests/unit/e2e-harness/budget-des-specs-admin.spec.ts`,
  // qui a trouvé cette suite en même temps que `vente-parcours`.
  // 🔴 2026-08-22 — UN DÉLAI PLUS LONG QUE SON BUDGET NE PEUT JAMAIS EXPIRER.
  //
  // Famille de défauts symétrique de celle corrigée la veille. Un `timeout:`
  // soigneusement choisi, avec un message qui nomme la cause, est INATTEIGNABLE
  // si le budget du test qui l'englobe est plus court : c'est le budget qui
  // rend le verdict, et son message ne nomme rien.
  //
  // 🔑 Règle : le budget d'une suite doit être STRICTEMENT supérieur au plus
  // grand délai qui vit dedans — helpers importés compris. Verrouillé par
  // `tests/unit/e2e-harness/delai-interne-sous-le-budget.spec.ts`.
  //
  // Ici : 180 s était ÉGAL au délai de `loginAsAdmin` hors CI (180 000).
  test.describe.configure({ timeout: 300_000 });

  const cases = [
    { from: "calendrier", to: "/planning" },
    { from: "calendrier/heatmap", to: "/planning" },
    { from: "calendrier/reschedule", to: "/planning" },
    { from: "reservations", to: "/qualiopi/dossiers" },
    { from: "options", to: "/qualiopi/dossiers" },
    { from: "devis", to: "/qualiopi/devis" },
    { from: "factures", to: "/qualiopi/facturation" },
    { from: "paiements", to: "/qualiopi/facturation" },
    { from: "echeanciers", to: "/qualiopi/facturation/plans" },
  ];

  test("chaque ancienne URL booking atterrit sur son module réel", async ({ page }) => {
    try {
      await loginAsAdmin(page);
    } catch (e) {
      // En CI la base est semée : un échec ici est un défaut, pas une dispense.
      if (baseSemeeAttendue()) throw e;
      test.skip(true, `connexion admin impossible en local : ${String(e).slice(0, 300)}`);
      return;
    }

    for (const c of cases) {
      await page.goto(`/fr/${ADMIN_PREFIX}/${c.from}`);
      await page.waitForURL(`**/fr/${ADMIN_PREFIX}${c.to}**`, { timeout: 10_000 });
      expect(page.url()).toContain(`/fr/${ADMIN_PREFIX}${c.to}`);
    }
  });

  test("sans session, une ancienne URL booking renvoie vers /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`/fr/${ADMIN_PREFIX}/reservations`);
    await page.waitForURL(`**/fr/${ADMIN_PREFIX}/login**`, { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });
});

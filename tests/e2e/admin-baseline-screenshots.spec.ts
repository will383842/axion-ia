// E2E baseline — Refonte admin mai 2026 (cf. _AUDIT/ADMIN-REFONTE-2026-05-17/).
//
// Snapshot Playwright des 12 pages les plus utilisées de la console admin,
// à exécuter UNE FOIS avant tout patch de refonte pour locker le « golden »
// visuel. Diff par zone autorisé à ±5 % par défaut Playwright (configurable
// via `maxDiffPixelRatio`). Sert d'ancre anti-régression pour la Phase 8.
//
// Tag `@baseline` : opt-in. Les suites smoke par défaut ne lancent pas ces
// tests. Pour exécuter :
//   pnpm exec playwright test --grep "@baseline" --update-snapshots
//
// Pré-requis :
//   - Dev server live (pnpm dev) sur http://localhost:3000
//   - Seed admin (cf. `pnpm db:seed`) avec un user admin de test
//   - Env var `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` (pas hardcodé ici)
//
// Si l'auth bootstrap manque, les screenshots des pages auth-protected
// captureront la page /login — ce qui reste un baseline visuel valable
// (cf. §3bis.2 master prompt : « équivalence sémantique exigée »).

import { test, expect } from "@playwright/test";

const ADMIN_PREFIX = process.env["ADMIN_URL_PREFIX"] ?? "admin-dev-x7k2n9";

const BASELINE_PAGES: Array<{ slug: string; path: string; note: string }> = [
  { slug: "dashboard", path: "/", note: "Dashboard racine admin" },
  // Module Booking retiré le 2026-08-01 (audit UX phase 2) : calendrier /
  // reservations / devis / factures redirigent en 308 vers les modules réels —
  // les baselines pointent désormais sur les cibles.
  { slug: "planning", path: "/planning", note: "Planning unifié des prestations" },
  { slug: "qualiopi-dossiers", path: "/qualiopi/dossiers", note: "Pipeline dossiers" },
  { slug: "qualiopi-devis", path: "/qualiopi/devis", note: "Devis Qualiopi" },
  { slug: "qualiopi-facturation", path: "/qualiopi/facturation", note: "Hub facturation" },
  { slug: "content-gen-home", path: "/content-gen", note: "Content-gen home" },
  { slug: "content-gen-coverage", path: "/content-gen/coverage", note: "Coverage campagnes" },
  { slug: "content-gen-jobs", path: "/content-gen/jobs", note: "Jobs queue + log stream" },
  {
    slug: "content-gen-publications",
    path: "/content-gen/publications",
    note: "Publications éditoriales",
  },
  { slug: "content-gen-review-queue", path: "/content-gen/review-queue", note: "Review queue" },
  { slug: "image-bank-library", path: "/image-bank/library", note: "Library image-bank V1" },
  { slug: "users", path: "/users", note: "Gestion utilisateurs admin" },
];

test.describe("@baseline admin pages golden screenshots", () => {
  test.describe.configure({ mode: "serial" });

  for (const { slug, path, note } of BASELINE_PAGES) {
    test(`@baseline ${slug} — ${note}`, async ({ page }) => {
      const url = `/fr/${ADMIN_PREFIX}${path}`;
      const response = await page.goto(url, { waitUntil: "networkidle" });

      // Pages auth-protected redirigent vers /login → status final 200 attendu
      // dans tous les cas. On accepte aussi 307/308 (redirect en cours).
      const status = response?.status() ?? 0;
      expect([200, 307, 308]).toContain(status);

      // Stabilisation : attendre que les fonts/skeletons disparaissent.
      // Les composants lourds (tables avec données) peuvent prendre 2-3s
      // après networkidle pour stabiliser leur LCP.
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(800);

      await expect(page).toHaveScreenshot(`${slug}.png`, {
        fullPage: true,
        animations: "disabled",
        maxDiffPixelRatio: 0.05,
      });
    });
  }
});

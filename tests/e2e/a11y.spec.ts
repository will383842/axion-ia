// E2E a11y — patch D5 cert 2026-05-08 + P1-19 audit E2E NAV+CTA 2026-05-15.
// Comble le critère B2 + D5 « 0 violation Axe-core sur 15 pages stratégiques »
// + résout l'anti-pattern « pnpm a11y:audit matche 0 test » (silent failure
// flagué audit D5).
//
// Tag `@a11y` consommé par `pnpm a11y:audit` (=`playwright test --grep @a11y`).
// P1-19 (2026-05-15) : extension de 5 à 15 pages stratégiques (Top 80/20).
//
// Standard : WCAG 2.2 AA + RGAA 4.1. Threshold 0 violation `serious|critical`.
// Les `minor`/`moderate` sont permises mais loggées en console (signal review).

import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

const STRATEGIC_PATHS = [
  // Tier 1 — conversion + landings
  { path: "/fr", label: "home FR" },
  { path: "/fr/audit", label: "audit" },
  { path: "/fr/interventions", label: "interventions" },
  { path: "/fr/implementation", label: "implementation" },
  { path: "/fr/appel", label: "appel" },
  // Tier 2 — content marketing + AEO/GEO (P1-19 extension 2026-05-15)
  { path: "/fr/cas-concrets", label: "cas-concrets" },
  { path: "/fr/methodologie", label: "methodologie" },
  { path: "/fr/comparaisons", label: "comparaisons" },
  { path: "/fr/stack-ia", label: "stack-ia" },
  { path: "/fr/guide-ia", label: "guide-ia" },
  // Tier 3 — pSEO + KB + support
  { path: "/fr/implantations", label: "implantations" },
  { path: "/fr/implantations/ile-de-france/paris", label: "implantations-paris" },
  { path: "/fr/connaissances", label: "connaissances" },
  { path: "/fr/faq", label: "faq" },
  { path: "/fr/contact", label: "contact" },
] as const;

test.describe("a11y WCAG 2.2 AA @a11y", () => {
  // 90 s au lieu des 30 s de playwright.config.ts : contre la PROD, une page
  // charge Plausible, le chatbot, Turnstile et parfois Calendly. Le défaut était
  // calibré pour un serveur local. Un timeout produit un rouge qu'on met des
  // heures à distinguer d'une vraie violation — et un rouge qu'on n'arrive pas à
  // qualifier finit ignoré. C'est comme ça qu'un gate meurt.
  test.describe.configure({ timeout: 90_000 });

  for (const { path, label } of STRATEGIC_PATHS) {
    test(`${label} (${path}) — 0 serious/critical violations @a11y`, async ({ page }) => {
      // 🔴 Audit certification 2026-07-26 (X5) — CANARI OBLIGATOIRE.
      // Sans lui, ce gate peut virer au FAUX VERT : si Cloudflare sert une
      // interstitielle (challenge, rate-limit) ou si l'origine renvoie une page
      // d'erreur, axe analyse CE document-là — presque sans violation — et le job
      // déclare la prod conforme, artefact horodaté à l'appui. Ce serait
      // exactement le défaut qu'on corrige : un contrôle qui mesure autre chose
      // que ce qu'il prétend mesurer. Un gate doit d'abord prouver QU'IL EST SUR
      // LA BONNE PAGE.
      const response = await page.goto(path);
      const status = response?.status() ?? 0;
      expect(status, `Aucune réponse HTTP exploitable sur ${path}`).toBeGreaterThanOrEqual(200);
      expect(status, `Statut HTTP inattendu sur ${path}`).toBeLessThan(400);
      // `header[data-tone]` n'existe que sur le header public
      // (src/components/nav/Header.tsx:116) : une interstitielle répond 200 mais
      // ne le porte pas.
      await expect(page.locator("header[data-tone]")).toBeVisible();
      // Wait for hydration + lazy components mount (Calendly iframe on /appel).
      // `networkidle` reste utile (Calendly sur /appel, chatbot, Plausible) : sans
      // lui, axe mesure une page pas encore stabilisée et SOUS-ESTIME les
      // violations. Mais sur la prod il ne se produit pas toujours — Plausible et
      // le chatbot maintiennent du trafic — et le rendre bloquant fabriquerait un
      // rouge intermittent. On l'attend au mieux et on TRACE quand il n'arrive
      // pas : les deux modes d'échec (rouge flaky / vert sous-estimé) sont réels,
      // celui qu'on choisit doit au moins laisser une trace dans le rapport.
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {
        console.warn(`[a11y] ${path} — networkidle non atteint en 15 s`);
      });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();

      const blockers = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );

      if (blockers.length > 0) {
        console.error(
          `[a11y] ${path} — ${blockers.length} blocking violations:`,
          blockers.map((v) => ({ id: v.id, impact: v.impact, help: v.help })),
        );
      }

      expect(blockers, `Expected 0 serious/critical a11y violations on ${path}`).toEqual([]);

      // Log moderate/minor pour signal review (pas un fail).
      const minor = results.violations.filter(
        (v) => v.impact === "moderate" || v.impact === "minor",
      );
      if (minor.length > 0) {
        console.warn(
          `[a11y] ${path} — ${minor.length} minor/moderate violations (review):`,
          minor.map((v) => ({ id: v.id, impact: v.impact })),
        );
      }
    });
  }
});

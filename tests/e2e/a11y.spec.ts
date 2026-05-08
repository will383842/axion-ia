// E2E a11y — patch D5 cert 2026-05-08.
// Comble le critère B2 + D5 « 0 violation Axe-core sur 15 pages stratégiques »
// + résout l'anti-pattern « pnpm a11y:audit matche 0 test » (silent failure
// flagué audit D5).
//
// Tag `@a11y` consommé par `pnpm a11y:audit` (=`playwright test --grep @a11y`).
// Couvre 5 pages stratégiques pour V1 (≤ 30 sec runtime) :
//   - / (home FR)
//   - /audit
//   - /interventions
//   - /implementation
//   - /reserver
// Sprint 17 : étendre Top 15 (cas-concrets, methodologie, comparaisons,
// implantations/paris, etc.).
//
// Standard : WCAG 2.2 AA + RGAA 4.1. Threshold 0 violation `serious|critical`.
// Les `minor`/`moderate` sont permises mais loggées en console (signal review).

import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

const STRATEGIC_PATHS = [
  { path: "/fr", label: "home FR" },
  { path: "/fr/audit", label: "audit" },
  { path: "/fr/interventions", label: "interventions" },
  { path: "/fr/implementation", label: "implementation" },
  { path: "/fr/reserver", label: "reserver" },
] as const;

test.describe("a11y WCAG 2.2 AA @a11y", () => {
  for (const { path, label } of STRATEGIC_PATHS) {
    test(`${label} (${path}) — 0 serious/critical violations @a11y`, async ({ page }) => {
      await page.goto(path);
      // Wait for hydration + lazy components mount (BookingCalendar on /reserver).
      await page.waitForLoadState("networkidle");

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

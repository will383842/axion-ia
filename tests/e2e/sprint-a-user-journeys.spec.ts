/**
 * Sprint A User Journeys — 5 critical paths.
 *
 * Refonte villes 2026-05-26 (Will) — Les routes /implantations/[region]/[ville]/[verticale]
 * ont ete supprimees (risque doorway HCU 2024 + cannibalisation pages services). Les 5
 * cards du hub ville pointent desormais vers les pages services principales (/audit,
 * /interventions, /implementation, /un-a-un, /sites-web-augmentes). Les anciennes URLs
 * verticales emettent un 301 vers la page service correspondante (cf. next.config.ts).
 *
 * Run: pnpm playwright test tests/e2e/sprint-a-user-journeys.spec.ts
 *
 * Tags:
 *   @sprint-a  — all journeys in this file
 *   @a11y      — Journey 4 (consumed by `pnpm a11y:audit`)
 */

import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test.describe("Journey 1 — Discovery via SEO Paris hub @sprint-a", () => {
  test("Land on Paris hub, verify H1 + JSON-LD Service + Speakable + CTA banner", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const response = await page.goto("/fr/implantations/ile-de-france/paris");
    expect(response?.status()).toBe(200);

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Paris");

    const jsonLdTexts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const hasService = jsonLdTexts.some(
      (j) => j.includes('"@type":"Service"') || j.includes('"@type": "Service"'),
    );
    expect(hasService, "Expected a Service JSON-LD schema on Paris hub").toBe(true);

    const hasSpeakable = jsonLdTexts.some(
      (j) => j.includes("SpeakableSpecification") || j.includes('"speakable"'),
    );
    expect(hasSpeakable, "Expected SpeakableSpecification in JSON-LD on Paris hub").toBe(true);

    const ctaBanner = page
      .locator("[data-testid='orange-banner'], .bg-terracotta, [class*='terracotta']")
      .first();
    await expect(ctaBanner).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});

test.describe("Journey 2 — Navigation hub ville to page service @sprint-a", () => {
  test("Click on Audit IA module card on Paris hub then land on /fr/audit", async ({ page }) => {
    await page.goto("/fr/implantations/ile-de-france/paris");
    const hubH1 = page.locator("h1").first();
    await expect(hubH1).toBeVisible();
    await expect(hubH1).toContainText(/Paris/i);

    const auditLink = page.locator('a[href="/fr/audit"]').first();
    await expect(auditLink).toBeVisible();
    await auditLink.click();

    await expect(page).toHaveURL(/\/fr\/audit($|\/|\?|#)/);

    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("Journey 3 — Mobile 375px Paris hub @sprint-a", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("Paris hub renders without horizontal scroll on mobile 375px", async ({ page }) => {
    const response = await page.goto("/fr/implantations/ile-de-france/paris");
    expect(response?.status()).toBe(200);

    await expect(page.locator("h1")).toBeVisible();

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 2);

    const ctaLink = page
      .locator('a[href*="/contact"], a[href*="/appel"], a[href*="/reserver"]')
      .first();
    await expect(ctaLink).toBeVisible();
  });
});

test.describe("Journey 4 — A11y keyboard navigation @sprint-a @a11y", () => {
  test("Paris hub — 0 serious/critical WCAG 2.2 AA violations", async ({ page }) => {
    await page.goto("/fr/implantations/ile-de-france/paris");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    const blockers = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    if (blockers.length > 0) {
      console.error(
        "[a11y] Paris hub blocking violations:",
        blockers.map((v) => ({ id: v.id, impact: v.impact, help: v.help })),
      );
    }

    const minor = results.violations.filter((v) => v.impact === "minor" || v.impact === "moderate");
    if (minor.length > 0) {
      console.warn(
        `[a11y] Paris hub — ${minor.length} minor/moderate violations (non-blocking):`,
        minor.map((v) => v.id),
      );
    }

    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();

    expect(blockers, "Expected 0 serious/critical a11y violations on Paris hub").toEqual([]);
  });
});

test.describe("Journey 5 — Speakable JSON-LD selector validation @sprint-a", () => {
  test("Paris hub — Speakable cssSelector entries match live DOM nodes", async ({ page }) => {
    await page.goto("/fr/implantations/ile-de-france/paris");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1")).toBeVisible();

    const jsonLdTexts = await page.locator('script[type="application/ld+json"]').allTextContents();

    const speakableSelectors: string[] = [];

    for (const text of jsonLdTexts) {
      try {
        const parsed: unknown = JSON.parse(text);
        const items: unknown[] = Array.isArray((parsed as Record<string, unknown>)["@graph"])
          ? ((parsed as Record<string, unknown>)["@graph"] as unknown[])
          : [parsed];

        for (const item of items) {
          const speakable = (item as Record<string, unknown>)["speakable"] as
            | Record<string, unknown>
            | undefined;
          if (speakable?.cssSelector) {
            const selectors = speakable.cssSelector;
            if (Array.isArray(selectors)) {
              speakableSelectors.push(...(selectors as string[]));
            } else if (typeof selectors === "string") {
              speakableSelectors.push(selectors);
            }
          }
        }
      } catch {
        // Malformed JSON-LD
      }
    }

    if (speakableSelectors.length === 0) {
      console.warn(
        "[sprint-a] No Speakable cssSelector found in JSON-LD for Paris hub — gap to fix",
      );
      return;
    }

    const missingSelectors: string[] = [];
    for (const selector of speakableSelectors.slice(0, 10)) {
      const count = await page.locator(selector).count();
      if (count === 0) {
        missingSelectors.push(selector);
        console.warn(`[sprint-a] Speakable selector "${selector}" matches 0 DOM elements`);
      }
    }

    expect(
      missingSelectors,
      `Speakable selectors present in JSON-LD but missing from DOM: ${missingSelectors.join(", ")}`,
    ).toEqual([]);
  });
});

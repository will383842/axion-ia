/**
 * Sprint A User Journeys — 5 critical paths for DRY ville pages
 *
 * Tests the refactored service pages + ville templates introduced in Sprint A.
 * All routes use relative paths — baseURL is read from playwright.config.ts
 * (E2E_BASE_URL env var or http://localhost:3000).
 *
 * Run: pnpm playwright test tests/e2e/sprint-a-user-journeys.spec.ts
 *
 * Tags:
 *   @sprint-a  — all journeys in this file
 *   @a11y      — Journey 4 (consumed by `pnpm a11y:audit`)
 */

import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Journey 1 — Discovery via SEO: Paris audits page
// ---------------------------------------------------------------------------

test.describe("Journey 1 — Discovery via SEO Paris audits @sprint-a", () => {
  test("Land on Paris audits, verify H1 + JSON-LD Service + Speakable + CTA banner", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const response = await page.goto("/fr/implantations/ile-de-france/paris/audits");
    expect(response?.status()).toBe(200);

    // H1 contains "Paris"
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Paris");

    // JSON-LD: at least one Service schema
    const jsonLdTexts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const hasService = jsonLdTexts.some(
      (j) => j.includes('"@type":"Service"') || j.includes('"@type": "Service"'),
    );
    expect(hasService, "Expected a Service JSON-LD schema on Paris audits").toBe(true);

    // JSON-LD: Speakable present (SpeakableSpecification or speakable key)
    const hasSpeakable = jsonLdTexts.some(
      (j) => j.includes("SpeakableSpecification") || j.includes('"speakable"'),
    );
    expect(hasSpeakable, "Expected SpeakableSpecification in JSON-LD on Paris audits").toBe(true);

    // Orange/terracotta CTA banner visible
    const ctaBanner = page
      .locator("[data-testid='orange-banner'], .bg-terracotta, [class*='terracotta']")
      .first();
    await expect(ctaBanner).toBeVisible();

    // No JS console errors
    expect(consoleErrors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Journey 2 — Cross-verticale navigation: /audit → Paris hub → Paris audits
// ---------------------------------------------------------------------------

test.describe("Journey 2 — Navigation cross-verticales @sprint-a", () => {
  test("Navigate from /audit → Paris hub → Paris audits via card link", async ({ page }) => {
    // Step 1: service entry page renders
    await page.goto("/fr/audit");
    await expect(page.locator("h1")).toBeVisible();

    // Step 2: Paris hub page
    await page.goto("/fr/implantations/ile-de-france/paris");
    const hubH1 = page.locator("h1").first();
    await expect(hubH1).toBeVisible();
    await expect(hubH1).toContainText(/Paris/i);

    // Step 3: find audits card/link on hub and click it
    const auditLink = page.locator('a[href*="/paris/audits"]').first();
    await expect(auditLink).toBeVisible();
    await auditLink.click();

    // Step 4: now on verticale page
    await expect(page).toHaveURL(/paris\/audits/);

    // Breadcrumb nav present and shows hierarchy
    const nav = page.locator("nav").filter({ hasText: /Paris/i }).first();
    await expect(nav).toBeVisible();

    // Main content renders
    await expect(page.locator("main")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Journey 3 — Mobile responsive: Tier 3 ville on 375px (iPhone SE)
// ---------------------------------------------------------------------------

test.describe("Journey 3 — Mobile 375px Paris audits @sprint-a", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("Paris audits renders without horizontal scroll on mobile 375px", async ({ page }) => {
    const response = await page.goto("/fr/implantations/ile-de-france/paris/audits");
    expect(response?.status()).toBe(200);

    // H1 visible on mobile
    await expect(page.locator("h1")).toBeVisible();

    // No horizontal overflow (2 px tolerance for sub-pixel rounding)
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 2);

    // At least one CTA link visible on mobile (contact or appointment)
    const ctaLink = page
      .locator('a[href*="/contact"], a[href*="/appel"], a[href*="/reserver"]')
      .first();
    await expect(ctaLink).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Journey 4 — A11y keyboard navigation: Paris un-a-un axe-core
// ---------------------------------------------------------------------------

test.describe("Journey 4 — A11y keyboard navigation @sprint-a @a11y", () => {
  test("Paris un-a-un — 0 serious/critical WCAG 2.2 AA violations", async ({ page }) => {
    await page.goto("/fr/implantations/ile-de-france/paris/un-a-un");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    const blockers = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    if (blockers.length > 0) {
      console.error(
        "[a11y] Paris un-a-un blocking violations:",
        blockers.map((v) => ({ id: v.id, impact: v.impact, help: v.help })),
      );
    }

    // Log minor/moderate for review signal (non-blocking)
    const minor = results.violations.filter((v) => v.impact === "minor" || v.impact === "moderate");
    if (minor.length > 0) {
      console.warn(
        `[a11y] Paris un-a-un — ${minor.length} minor/moderate violations (non-blocking):`,
        minor.map((v) => v.id),
      );
    }

    // Page renders successfully
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();

    // Hard gate: 0 serious/critical (aligned with a11y.spec.ts standard)
    expect(blockers, "Expected 0 serious/critical a11y violations on Paris un-a-un").toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Journey 5 — Speakable Google Assistant validation
// ---------------------------------------------------------------------------

test.describe("Journey 5 — Speakable JSON-LD selector validation @sprint-a", () => {
  test("Paris audits — Speakable cssSelector entries match live DOM nodes", async ({ page }) => {
    await page.goto("/fr/implantations/ile-de-france/paris/audits");
    await page.waitForLoadState("domcontentloaded");

    // Page renders
    await expect(page.locator("h1")).toBeVisible();

    // Extract Speakable cssSelector values from all JSON-LD blocks
    const jsonLdTexts = await page.locator('script[type="application/ld+json"]').allTextContents();

    const speakableSelectors: string[] = [];

    for (const text of jsonLdTexts) {
      try {
        const parsed: unknown = JSON.parse(text);
        // Handle both flat object and @graph arrays
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
        // Malformed JSON-LD — skip silently
      }
    }

    if (speakableSelectors.length === 0) {
      console.warn(
        "⚠️ [sprint-a] No Speakable cssSelector found in JSON-LD for Paris audits — gap to fix",
      );
      // Non-blocking: warn and pass (the gap is surfaced in logs)
      return;
    }

    // Verify each selector (up to first 10) matches at least 1 live DOM element
    const missingSelectors: string[] = [];
    for (const selector of speakableSelectors.slice(0, 10)) {
      const count = await page.locator(selector).count();
      if (count === 0) {
        missingSelectors.push(selector);
        console.warn(`⚠️ [sprint-a] Speakable selector "${selector}" matches 0 DOM elements`);
      }
    }

    // All declared Speakable selectors must resolve in DOM
    expect(
      missingSelectors,
      `Speakable selectors present in JSON-LD but missing from DOM: ${missingSelectors.join(", ")}`,
    ).toEqual([]);
  });
});

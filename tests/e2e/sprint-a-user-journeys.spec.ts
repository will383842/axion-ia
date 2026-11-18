/**
 * Sprint A User Journeys — 5 critical paths.
 *
 * 2026-11-11 — les pages villes sont centrées sur La Journée IA (plus de cartes
 * « 5 services ») : les parcours 1 et 2 vérifient le CTA diagnostic et le lien vers
 * /fr/journee-ia.
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

    // 2026-11-11 — refonte « La Journée IA ville par ville » : le bandeau orange
    // « Nous contacter » (OrangeContactBanner) a disparu avec la vente des 5 services.
    // L'appel à l'action de la page est désormais le diagnostic gratuit, en bas de page,
    // avec un emplacement `depuis=` explicite. On vise l'ancre réelle, bornée au contenu.
    const ctaFinal = page.locator('main [data-cta-tracking="ville_cta_final_diagnostic"]');
    await expect(
      ctaFinal,
      "aucun appel à l'action « diagnostic gratuit » en bas du contenu de la page Paris — " +
        "le visiteur arrive au bout de la page sans moyen d'agir",
    ).toBeVisible();
    await expect(ctaFinal).toHaveAttribute(
      "href",
      /\/appel\?rdv=diagnostic&depuis=ville-paris-bas/,
    );

    expect(consoleErrors).toEqual([]);
  });
});

test.describe("Journey 2 — Navigation page ville vers la Journée IA @sprint-a", () => {
  test("Click on the Journée IA link in the Paris page content then land on /fr/journee-ia", async ({
    page,
  }) => {
    await page.goto("/fr/implantations/ile-de-france/paris");
    const hubH1 = page.locator("h1").first();
    await expect(hubH1).toBeVisible();
    await expect(hubH1).toContainText(/Journée IA à Paris/i);

    // 2026-11-11 — la page ville ne vend plus « 5 services » : son maillage interne
    // principal mène à la Journée IA. On borne au contenu (`main`) pour ne pas cliquer
    // l'entrée du menu ou du pied de page (cf. l'historique du `.first()` sur le header).
    const lienJourneeIa = page
      .locator("main")
      .locator('[data-cta-tracking="ville_en_bref_journee_ia"]');
    await expect(
      lienJourneeIa,
      "aucun lien vers la Journée IA dans le « En bref » de la page Paris — le maillage " +
        "interne ville → offre est ce que ce parcours mesure",
    ).toBeVisible();
    await lienJourneeIa.click();

    await expect(page).toHaveURL(/\/fr\/journee-ia($|\/|\?|#)/);

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

    // 🔴 2026-08-21 — MÊME DÉFAUT QUE LE PARCOURS 2, UN CRAN PLUS BAS.
    //
    // `.first()` prenait le CTA du header — masqué à 375 px, où la navigation
    // est dans le tiroir. Playwright résolvait l'élément treize fois et le
    // déclarait `hidden`. Le test prétend vérifier qu'un visiteur mobile a un
    // moyen de contact À PORTÉE ; il mesurait la présence d'un lien invisible.
    //
    // 🔑 Un prédicat recopié diverge : les deux parcours portaient la même
    // faute, et corriger l'un sans balayer l'autre l'aurait laissée dormir.
    const ctaLink = page.locator("main").locator('a[href*="/contact"], a[href*="/appel"]').first();
    await expect(
      ctaLink,
      "aucun lien de contact atteignable dans le contenu à 375 px — le visiteur " +
        "mobile n'a aucun moyen d'agir sans ouvrir le tiroir de navigation",
    ).toBeVisible();
  });
});

test.describe("Journey 4 — A11y keyboard navigation @sprint-a @a11y", () => {
  test("Paris hub — 0 serious/critical WCAG 2.2 AA violations", async ({ page }) => {
    await page.goto("/fr/implantations/ile-de-france/paris");
    // Délai explicite : sans lui, l'attente hérite du budget du test et le
    // consomme en entier avant de rendre un message qui ne nomme rien. La page
    // reste analysable même si le réseau ne se tait pas (cf. parcours 6).
    await page
      .waitForLoadState("networkidle", { timeout: 20_000 })
      .catch(() => console.warn("[sprint-a] hub Paris — networkidle non atteint en 20 s"));

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
            Record<string, unknown> | undefined;
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

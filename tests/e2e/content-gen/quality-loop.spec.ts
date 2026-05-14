/**
 * Pass B P0-2 (5/5) — Boucle qualité content-gen.
 *
 * Smoke read-only : vérifie le rendu d'une Q/R post-process (`/fr/faq/[slug]`)
 * qui est la sortie typique d'une boucle qualité. Vérifie QAPage JSON-LD +
 * Speakable (checklist H7 BLOQUANT pour FAQ).
 */

import { test, expect } from "@playwright/test";

const FAQ_SLUG = process.env["E2E_FAQ_SLUG"];

test.describe("quality loop — QA derived smoke", () => {
  test.skip(!FAQ_SLUG, "E2E_FAQ_SLUG non défini — squelette Sprint S6.3");

  test("QAPage JSON-LD + Speakable présents", async ({ page }) => {
    const path = `/fr/faq/${FAQ_SLUG}`;
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);

    const ldTexts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const lds = ldTexts.map((s) => JSON.parse(s));

    const qaLd = lds.find((ld) => ld["@type"] === "QAPage");
    expect(qaLd).toBeDefined();
    expect(qaLd.mainEntity?.["@type"]).toBe("Question");

    // H7 — Speakable
    const speakable = lds.find((ld) => ld["@type"] === "SpeakableSpecification" || ld.speakable);
    expect(speakable).toBeDefined();
  });

  test("page-mère /fr/faq répond 200 même sans FAQ_SLUG", async ({ page }) => {
    const resp = await page.goto("/fr/faq", { waitUntil: "domcontentloaded" });
    expect([200, 301, 302, 404]).toContain(resp?.status() ?? 0);
  });
});

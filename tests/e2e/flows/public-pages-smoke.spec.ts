// E2E flow — smoke test pages publiques 8 URLs strategiques × 2 langues
// (Sprint 21 / M10). Verifie 200 + title + pas de console error.

import { test, expect } from "@playwright/test";

const STRATEGIC_PAGES = [
  // [path, expected title fragment]
  ["/fr", /Axion-IA|cabinet IA/i],
  ["/en", /Axion-IA|operational AI/i],
  ["/fr/interventions", /intervention/i],
  ["/en/interventions", /session|intervention/i],
  ["/fr/interventions/essentielle", /essentielle/i],
  ["/en/interventions/essential", /essential/i],
  ["/fr/audit", /audit/i],
  ["/en/audit", /audit/i],
  ["/fr/implementation", /implémentation|implementation/i],
  ["/en/implementation", /implementation/i],
  ["/fr/cas-concrets", /cas concrets|case studies/i],
  ["/en/case-studies", /case stud/i],
  ["/fr/blog", /blog/i],
  ["/en/blog", /blog/i],
  ["/fr/contact", /contact/i],
  ["/en/contact", /contact/i],
] as const;

test.describe("Public pages smoke (16 URLs strategiques)", () => {
  for (const [path, titlePattern] of STRATEGIC_PAGES) {
    test(`${path} renders 200 + valid title + no console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          // Filtre les warnings et erreurs externes (Cloudflare Turnstile, etc.)
          if (
            !text.includes("Warning:") &&
            !text.includes("DevTools") &&
            !text.includes("turnstile") &&
            !text.includes("Failed to fetch")
          ) {
            errors.push(text);
          }
        }
      });
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);
      await expect(page).toHaveTitle(titlePattern);
      expect(errors).toEqual([]);
    });
  }
});

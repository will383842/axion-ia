/**
 * SEO du catalogue V2 — garde-fous par formation (issus de l'audit SEO).
 * Pour CHAQUE formation :
 *  - metaTitleFr ≤ 65 caractères (SERP),
 *  - metaDescriptionFr ≤ 160 caractères (SERP),
 *  - h1Fr ≠ accrocheFr (le H1 porte un bénéfice distinct de l'accroche),
 *  - faqs.length ≥ 3 (longue traîne / FAQPage).
 */

import { describe, it, expect } from "vitest";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";

describe("catalogue V2 — SEO par formation", () => {
  it("metaTitleFr ≤ 65 caractères pour chaque formation", () => {
    for (const f of FORMATIONS_V2) {
      expect(f.metaTitleFr.length, `${f.id}: "${f.metaTitleFr}"`).toBeLessThanOrEqual(65);
    }
  });

  it("metaDescriptionFr ≤ 160 caractères pour chaque formation", () => {
    for (const f of FORMATIONS_V2) {
      expect(f.metaDescriptionFr.length, `${f.id}: "${f.metaDescriptionFr}"`).toBeLessThanOrEqual(
        160,
      );
    }
  });

  it("h1Fr ≠ accrocheFr pour chaque formation", () => {
    for (const f of FORMATIONS_V2) {
      expect(f.h1Fr, f.id).not.toBe(f.accrocheFr);
    }
  });

  it("au moins 3 FAQ par formation (longue traîne / FAQPage)", () => {
    for (const f of FORMATIONS_V2) {
      expect(f.faqs.length, f.id).toBeGreaterThanOrEqual(3);
    }
  });
});

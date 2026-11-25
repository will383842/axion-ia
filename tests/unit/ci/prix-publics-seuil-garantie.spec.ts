import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MULTIPLE_GARANTIE,
  SEUIL_DEVIS_DEDUCTION_EUR,
  seuilGarantieEur,
} from "@/content/journee-ia-commun";
import { JOURNEE_IA_TIER, formatAmount } from "@/content/pricing";

/**
 * Garde R7 (tests/e2e/prix-publics.spec.ts) : l'exception du 25/11/2026 écrit « 4 470 € » et
 * « au moins 5 000 € HT » en littéral. Ce test les relie aux constantes de contenu.
 */
describe("exception R7 : seuils de la garantie et de la déduction", () => {
  const source = readFileSync(resolve(process.cwd(), "tests/e2e/prix-publics.spec.ts"), "utf8");

  it("3 × 1 490 = 4 470, et le littéral de l'exception est le seuil de la garantie", () => {
    expect(MULTIPLE_GARANTIE).toBe(3);
    expect(seuilGarantieEur()).toBe(3 * 1490);
    expect(seuilGarantieEur()).toBe(MULTIPLE_GARANTIE * JOURNEE_IA_TIER.priceFlat);
    const litteral = formatAmount(seuilGarantieEur(), "fr").replace(/\s/g, " ");
    expect(litteral).toBe("4 470 €");
    expect(source).toContain(`(?<![\\d.,])${litteral}/g`);
  });

  it("le littéral de la condition de déduction suit SEUIL_DEVIS_DEDUCTION_EUR", () => {
    expect(SEUIL_DEVIS_DEDUCTION_EUR).toBe(5000);
    expect(source).toContain("intégration d(?:’|'|&#x27;|&#39;|\\\\+u2019)au moins 5 000 € HT/g");
  });
});

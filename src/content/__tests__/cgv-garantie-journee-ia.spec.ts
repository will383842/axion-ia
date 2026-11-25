/**
 * La garantie de remboursement de la Journée IA entre dans les CGV (alinéa 47.10).
 * Aucun montant n'est tapé : le seuil se calcule depuis `pricing.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getLegal } from "@/content/legal";
import { JOURNEE_IA_TIER } from "@/content/pricing";
import { MULTIPLE_GARANTIE, seuilGarantieEur } from "@/content/journee-ia-commun";

const milliers = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const sections = getLegal("conditions-generales").fr.sections;
const corps = (n: number) => sections.find((s) => s.title.includes(`Article ${n}. `))?.body ?? "";

describe("CGV : garantie de la Journée IA (art. 47.10)", () => {
  it("l'article 47 porte l'alinéa 47.10, les gains identifiés et le seuil calculé", () => {
    const a47 = corps(47);
    expect(a47).toContain("47.10 Garantie de remboursement de la Journée IA");
    expect(a47).toContain("gains identifiés");
    expect(a47).toContain(`${milliers(seuilGarantieEur())} euros HT`);
    expect(a47).toContain(`${MULTIPLE_GARANTIE} fois le prix HT`);
  });

  it("l'article 47 ne contient aucun terme interdit ni l'ancien délai de 90 jours", () => {
    const a47 = corps(47);
    expect(a47).not.toMatch(/Grenoble|gain garanti|validés par vous|sans discussion/i);
    expect(a47).not.toContain("90 jours");
  });

  it("les articles 16.2 et 48.3 renvoient à l'article 47.10", () => {
    expect(corps(16)).toContain("article 47.10");
    expect(corps(48)).toContain("article 47.10");
  });

  it("le seuil suit le prix : multiple × priceFlat, pas une valeur tapée", () => {
    expect(seuilGarantieEur()).toBe(MULTIPLE_GARANTIE * JOURNEE_IA_TIER.priceFlat!);
  });

  it("le source de legal.ts ne tape aucun montant de la journée", () => {
    const source = readFileSync(join(process.cwd(), "src/content/legal.ts"), "utf8");
    expect(source).not.toMatch(/4[\s\u00a0\u202f]?470/);
    expect(source).not.toMatch(/1[\s\u00a0\u202f]?490/);
  });
});

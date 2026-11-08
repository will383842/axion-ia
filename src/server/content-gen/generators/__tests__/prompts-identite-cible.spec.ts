/**
 * Lot R6 (extension du directeur, 08/11/2026) : les prompts des générateurs
 * déclarent la plume IA et ne visent plus les ETI ni les grandes entreprises.
 * Détection au niveau du code source, comme prompts-positionnement.spec.ts.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve(__dirname, "..");
const FICHIERS = readdirSync(DIR).filter((f) => f.endsWith(".ts"));
const lire = (f: string) => readFileSync(resolve(DIR, f), "utf8");

describe("generators/ : Manon est une plume IA déclarée", () => {
  it("trouve des générateurs à balayer", () => {
    expect(FICHIERS.length).toBeGreaterThan(10);
  });

  it.each(FICHIERS)("%s ne dit jamais « experte IA chez Axion-IA »", (f) => {
    expect(lire(f)).not.toMatch(/experte IA chez Axion-IA/i);
  });

  it.each(FICHIERS.filter((f) => /Tu es Manon/.test(lire(f))))(
    "%s déclare la plume IA quand il présente Manon",
    (f) => {
      expect(lire(f)).toMatch(/Tu es Manon, (?:la )?plume IA d'Axion-IA/);
    },
  );
});

describe("generators/ : cible PME, pas ETI ni grandes entreprises", () => {
  it("blog-article ne vise ni « PME/ETI » ni « ETI/GE »", () => {
    const s = lire("blog-article.ts");
    expect(s).not.toContain("PME/ETI");
    expect(s).not.toContain("ETI/GE");
  });

  it("ville-hub-copy n'a plus de persona ETI ni grandes entreprises", () => {
    const s = lire("ville-hub-copy.ts");
    expect(s).not.toMatch(/\*\*ETI\*\*/);
    expect(s).not.toMatch(/\*\*Grandes entreprises\*\*/);
  });
});

describe("generators/ : la taille d'audience passe par taillePourPrompt", () => {
  it.each([
    "blog-article.ts",
    "blog-from-keywords.ts",
    "blog-from-title.ts",
    "blog-from-rss.ts",
    "comparison.ts",
    "faq-standalone.ts",
  ])("%s ne transmet pas la taille brute au prompt", (f) => {
    const s = lire(f);
    expect(s).toContain("taillePourPrompt(input.targetAudienceSize");
    expect(s).not.toMatch(/escapeLlmInput\(input\.targetAudienceSize/);
  });

  it("v7-phase8-generators n'a plus de double parenthèse dans l'ouverture", () => {
    expect(lire("v7-phase8-generators.ts")).not.toContain("l'équipe) (société française)");
  });
});

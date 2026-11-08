import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Les cartes de formats (formations et interventions) colorent par jetons de la
 * palette définitive : aucune valeur hexadécimale en dur, aucune exception
 * « hex-ok », et plus de blanc pur (`text-white`) sur le bouton.
 */
const FICHIERS = [
  "src/components/formations/FormationFormatCard.tsx",
  "src/components/sections/InterventionFormatCard.tsx",
];

describe.each(FICHIERS)("%s", (fichier) => {
  const source = readFileSync(resolve(process.cwd(), fichier), "utf8");

  it("ne contient aucun hexadécimal", () => {
    expect(source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  it("n'utilise aucune couleur arbitraire ni exception hex-ok", () => {
    expect(source).not.toMatch(/-\[#/);
    expect(source).not.toContain("hex-ok");
  });

  it("n'utilise pas text-white", () => {
    expect(source).not.toContain("text-white");
  });

  it("garde l'accent claude, passé aux jetons terracotta", () => {
    const bloc = source.slice(source.indexOf("claude: {"));
    expect(bloc).toContain("bg-terracotta");
    expect(bloc).toContain("text-terracotta-deep");
  });
});

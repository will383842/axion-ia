import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COULEURS_MARQUE } from "@/lib/brand/couleurs-marque";

/**
 * V4-01 — jetons « sans risque » (tableau A de la proposition globals.css).
 * Valeurs cibles de la palette définitive ; le bleu et le jaune (tableau B) ne sont PAS traités ici.
 * Parité : `globals.css` (@theme) et `COULEURS_MARQUE` portent les mêmes hex.
 */
const TABLEAU_A: Record<string, string> = {
  bg: "#faf9f5",
  sand: "#e8e6dc",
  "sand-deep": "#e8e6dc",
  ink: "#141413",
  "mocha-fg": "#faf9f5",
  fg: "#141413",
  "gray-800": "#141413",
  border: "#e8e6dc",
  "border-strong": "#b0aea5",
  "border-hover": "#b0aea5",
  "gray-300": "#b0aea5",
  sage: "#5e7050",
  "accent-green": "#5e7050",
  "accent-red": "#b8341c",
  // inchangés mais figés
  paper: "#ffffff",
  terracotta: "#b23f16",
  "primary-fg": "#ffffff",
  success: "#5e7050",
  error: "#b8341c",
};

const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const valeurCss = (jeton: string) =>
  css.match(new RegExp(`--color-${jeton}\\s*:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();

describe("V4-01 tableau A : globals.css", () => {
  it.each(Object.entries(TABLEAU_A))("--color-%s = %s", (jeton, hex) => {
    expect(valeurCss(jeton)).toBe(hex);
  });

  it("les ombres n'utilisent plus rgba(42, 37, 32)", () => {
    expect(css).not.toMatch(/rgba\(\s*42\s*,\s*37\s*,\s*32/);
    expect(css).toMatch(/--shadow-card:[^;]*rgba\(20, 20, 19/);
  });
});

describe("V4-01 tableau A : COULEURS_MARQUE (miroir)", () => {
  const miroir = COULEURS_MARQUE as Record<string, string>;
  it.each(Object.entries(TABLEAU_A).filter(([j]) => j in COULEURS_MARQUE))(
    "%s = %s",
    (jeton, hex) => {
      expect(miroir[jeton]?.toLowerCase()).toBe(hex);
    },
  );

  it("chaque jeton du miroir a la même valeur que globals.css", () => {
    for (const [jeton, hex] of Object.entries(miroir)) {
      expect(valeurCss(jeton), jeton).toBe(hex.toLowerCase());
    }
  });
});

// @vitest-environment node
/**
 * Verrou — poids des pages (audit du site réel, 2026-11-11).
 *
 * `global-error.tsx` et `not-found.tsx` (racine) importaient `globals.css` : ~260 Ko
 * de Tailwind recopiés dans le flux RSC de CHAQUE page du site. La compression Brotli
 * masque l'écart, d'où ce verrou : ces deux frontières n'importent que
 * `erreur-racine.css` (CSS pur, sans `@import "tailwindcss"`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP = join(__dirname, "..", "..", "..", "src", "app");

describe.each(["global-error.tsx", "not-found.tsx"])("%s", (fichier) => {
  const source = readFileSync(join(APP, fichier), "utf8");
  const importsCss = source.match(/^\s*import\s+["'][^"']+\.css["'];?/gm) ?? [];

  it("n'importe pas globals.css", () => {
    expect(importsCss.join("\n")).not.toContain("globals.css");
  });

  it("importe erreur-racine.css", () => {
    expect(importsCss.join("\n")).toContain("erreur-racine.css");
  });
});

describe("erreur-racine.css", () => {
  it("est du CSS pur, sans Tailwind", () => {
    const css = readFileSync(join(APP, "erreur-racine.css"), "utf8");
    expect(css).not.toMatch(/@import\s+["']tailwindcss/);
    expect(css).not.toMatch(/@apply|@theme|@layer/);
  });
});

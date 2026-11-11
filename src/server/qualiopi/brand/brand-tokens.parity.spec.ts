import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COULEURS_MARQUE } from "@/lib/brand/couleurs-marque";
import { QUALIOPI_BRAND_FONTS } from "./brand-tokens";

/**
 * Garde-fou de parité : `COULEURS_MARQUE` (miroir vivant, V8-P0) DOIT refléter
 * exactement `@theme` de globals.css. (`QUALIOPI_BRAND_COLORS` est gelé : cf. le test de gel.) Si un token diverge → échec ici, ce qui
 * force à propager le changement de charte aux deux endroits.
 */
function readGlobalsCss(): string {
  return readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
}

describe("brand-tokens ↔ globals.css parité couleurs", () => {
  const css = readGlobalsCss();

  it.each(Object.entries(COULEURS_MARQUE))("--color-%s correspond à globals.css", (token, hex) => {
    const re = new RegExp(`--color-${token}\\s*:\\s*(#[0-9a-fA-F]{3,8})`);
    const found = css.match(re)?.[1];
    expect(found, `token --color-${token} introuvable dans globals.css`).toBeDefined();
    expect(found!.toLowerCase()).toBe(hex.toLowerCase());
  });
});

describe("brand-tokens polices", () => {
  const css = readGlobalsCss();
  // Charte 2027 : Manrope seule sur le site. `QUALIOPI_BRAND_FONTS` (serif/mono des PDF Qualiopi)
  // n'est PAS aligné ici : décision de Williams en attente (ESCALADE) — la parité ne porte que sur `sans`.
  it("la famille sans (Manrope) est référencée dans globals.css", () => {
    expect(css.toLowerCase()).toContain(QUALIOPI_BRAND_FONTS.sans.toLowerCase());
  });

  it("globals.css (commentaires retirés) ne déclare plus Fraunces ni Inconsolata dans une variable --font-*", () => {
    const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const declarations = sansCommentaires.match(/--font-[a-z0-9-]+\s*:[^;]*;/gi) ?? [];
    expect(declarations.length).toBeGreaterThan(0);
    for (const d of declarations) expect(d).not.toMatch(/fraunces|inconsolata/i);
  });
});

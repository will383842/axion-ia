import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { QUALIOPI_BRAND_COLORS, QUALIOPI_BRAND_FONTS } from "./brand-tokens";

/**
 * Garde-fou de parité : `brand-tokens.ts` (SSOT PDF/email) DOIT refléter
 * exactement `@theme` de globals.css. Si un token diverge → échec ici, ce qui
 * force à propager le changement de charte aux deux endroits.
 */
function readGlobalsCss(): string {
  return readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
}

describe("brand-tokens ↔ globals.css parité couleurs", () => {
  const css = readGlobalsCss();

  it.each(Object.entries(QUALIOPI_BRAND_COLORS))(
    "--color-%s correspond à globals.css",
    (token, hex) => {
      const re = new RegExp(`--color-${token}\\s*:\\s*(#[0-9a-fA-F]{3,8})`);
      const found = css.match(re)?.[1];
      expect(found, `token --color-${token} introuvable dans globals.css`).toBeDefined();
      expect(found!.toLowerCase()).toBe(hex.toLowerCase());
    },
  );
});

describe("brand-tokens polices", () => {
  const css = readGlobalsCss();
  it.each(Object.entries(QUALIOPI_BRAND_FONTS))(
    "la famille %s (%s) est référencée dans globals.css",
    (_role, family) => {
      // Fraunces/Manrope/Inconsolata apparaissent via --font-<famille> dans @theme.
      expect(css.toLowerCase()).toContain(family.toLowerCase());
    },
  );
});

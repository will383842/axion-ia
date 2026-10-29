// Garde du CLS mobile (run 40848411969) : les faces « Manrope Fallback » et « Fraunces Fallback »
// doivent citer une police locale que Linux et Android possèdent. Chrome n'accepte qu'un nom exact
// pour local() (pas de substitution fontconfig) : avec « Arial » ou « Times New Roman » seuls, la face
// échoue en silence sur le runner Lighthouse et le héros reflue au chargement des vraies polices.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function blocsDeRepli(famille: string): string[] {
  const motif = new RegExp(String.raw`@font-face\s*\{[^}]*font-family:\s*"${famille}"[^}]*\}`, "g");
  return css.match(motif) ?? [];
}

describe("replis métriques des polices : noms Liberation présents", () => {
  it("Manrope Fallback : 2 faces, chacune cite une Liberation Sans", () => {
    const blocs = blocsDeRepli("Manrope Fallback");
    expect(blocs).toHaveLength(2);
    for (const b of blocs) expect(b).toMatch(/src:[^;]*local\("Liberation Sans/);
  });

  it("Fraunces Fallback : 6 faces, chacune cite une Liberation Serif", () => {
    const blocs = blocsDeRepli("Fraunces Fallback");
    expect(blocs).toHaveLength(6);
    for (const b of blocs) expect(b).toMatch(/src:[^;]*local\("Liberation Serif/);
  });

  it("chaque face garde aussi le nom PostScript d'Arial ou de Times New Roman (macOS, Windows)", () => {
    const blocs = [...blocsDeRepli("Manrope Fallback"), ...blocsDeRepli("Fraunces Fallback")];
    for (const b of blocs)
      expect(b).toMatch(/local\("(ArialMT|Arial-BoldMT|TimesNewRomanPS[A-Za-z-]*)"\)/);
  });
});

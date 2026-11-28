import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  join(process.cwd(), "src/features/apporteurs-reseau/facturation.ts"),
  "utf8",
);

/** Le commentaire JSDoc qui précède immédiatement la déclaration `async function <nom>(`. */
function docDe(nom: string): string {
  const i = src.indexOf(`async function ${nom}(`);
  expect(i).toBeGreaterThan(0);
  const avant = src.slice(0, i).trimEnd();
  return avant.endsWith("*/") ? avant.slice(avant.lastIndexOf("/**")) : "";
}

describe("facturation.ts : chaque commentaire documente sa fonction (#2469, relecture n°8)", () => {
  it("la fiche incomplète est documentée sur mettreEnAttenteSiIncomplet", () => {
    expect(docDe("mettreEnAttenteSiIncomplet")).toContain("Fiche de l'apporteur incomplète");
  });
  it("signalerMandatNonSigne ne porte pas le commentaire d'une autre fonction", () => {
    const d = docDe("signalerMandatNonSigne");
    expect(d).toContain("mandat");
    expect(d).not.toContain("Fiche de l'apporteur incomplète");
  });
});

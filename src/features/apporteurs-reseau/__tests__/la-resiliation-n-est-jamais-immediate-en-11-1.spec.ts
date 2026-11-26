// Verrou de source (lot L1b) : seule la prise d'effet écrit « resilie », et seul le passage
// quotidien ou la branche « effet immédiat » (11.2, 12.5) de `notifierResiliation` l'appelle.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "src");

function sources(d: string, out: string[] = []): string[] {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) {
      if (f !== "node_modules" && f !== "generated") sources(p, out);
    } else if (/\.(ts|tsx)$/.test(f) && !/\.spec\./.test(f)) out.push(p);
  }
  return out;
}

describe("la résiliation n'est jamais immédiate en 11.1", () => {
  const fichiers = sources(RACINE).map((p) => ({
    rel: relative(RACINE, p).replace(/\\/g, "/"),
    texte: readFileSync(p, "utf8"),
  }));

  it("executerResiliation n'est appelée que par resiliation.ts (immédiat) et le passage quotidien", () => {
    const appelants = fichiers
      .filter(
        (f) =>
          /\bexecuterResiliation(sEchues)?\b/.test(f.texte) &&
          f.rel !== "features/apporteurs-reseau/resiliation.ts",
      )
      .map((f) => f.rel);
    expect(appelants).toEqual(["features/apporteurs-reseau/passage-quotidien.ts"]);
  });

  it("l'action de la console ne résilie pas directement", () => {
    const f = fichiers.find((x) => x.rel === "features/apporteurs-reseau/actions-commissions.ts")!;
    expect(f.texte).not.toMatch(/\bresilierApporteur\b|\bexecuterResiliation\b/);
    expect(f.texte).toContain("notifierResiliation");
  });

  it("aucun code n'écrit le statut « resilie » hors de la prise d'effet", () => {
    const fautifs = fichiers
      .filter((f) => /statut:\s*"resilie"/.test(f.texte) && /apporteurReseau\.update/.test(f.texte))
      .map((f) => f.rel)
      .filter((r) => r !== "features/apporteurs-reseau/resiliation.ts");
    expect(fautifs).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// PR B (#2464) : les contrats contresignés à venir vivent sous `contrats-signes/apporteurs/`,
// pour qu'une règle de verrou R2 par préfixe (10 ans) les couvre.
describe("clé R2 du contrat contresigné", () => {
  const src = readFileSync(join(__dirname, "..", "verification.ts"), "utf8");

  it("la clé écrite commence par contrats-signes/apporteurs/", () => {
    expect(src).toContain('PREFIXE_CONTRATS_SIGNES = "contrats-signes/apporteurs"');
    expect(src).toMatch(
      /const cle = `\$\{PREFIXE_CONTRATS_SIGNES\}\/\$\{apporteurId\}\/contrat-v2-signe-/,
    );
    expect(src).not.toMatch(/const cle = `apporteurs\/\$\{apporteurId\}\/contrat-v2-signe-/);
  });
});

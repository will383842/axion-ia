import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Le passage quotidien tourne dans le WORKER (tsx, hors Next) : un `import "server-only"`
// dans un module qu'il atteint ferait planter le worker au premier passage.
const ATTEINTS_PAR_LE_WORKER = [
  "passage-quotidien.ts",
  "commissions.ts",
  "envois.ts",
  "regles.ts",
  "jeton.ts",
  "autofacture-donnees.ts",
  "commandes.ts",
  "alerte-vigilance.ts",
  "signaler.ts",
  "rebonds.ts",
];

describe("modules atteints par le worker des apporteurs", () => {
  it.each(ATTEINTS_PAR_LE_WORKER)("%s n'importe pas server-only", (fichier) => {
    const source = readFileSync(join(__dirname, "..", fichier), "utf-8");
    expect(source).not.toMatch(/^\s*import\s+["']server-only["']/m);
  });
});

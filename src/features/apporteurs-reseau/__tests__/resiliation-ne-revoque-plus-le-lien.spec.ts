import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// PR K (2464) : la prise d'effet d'une résiliation n'incrémente plus `versionLien`.
// (Le comportement est aussi vérifié dans resiliation.spec.ts ; ici, le verrou de source.)
const src = readFileSync(join(__dirname, "..", "resiliation.ts"), "utf8");

describe("la résiliation ne révoque plus le lien", () => {
  it("aucune incrémentation de versionLien dans resiliation.ts", () => {
    expect(src).not.toMatch(/versionLien\s*:\s*\{\s*increment/);
  });
});

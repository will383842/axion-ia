import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEINTE_NUANCE } from "../teintes-activite";

describe("teintes de la chronologie", () => {
  it("n'interpole aucune classe (Tailwind v4 ne génère que les noms écrits en entier)", () => {
    const source = readFileSync(join(__dirname, "..", "teintes-activite.ts"), "utf8");
    expect(source).not.toContain("${");
  });
  it("donne une couleur à chaque nuance, y compris gris et ambre", () => {
    for (const classes of Object.values(TEINTE_NUANCE)) {
      expect(classes).toMatch(/border-\[color:var\(--color-admin-bloc-[a-z]+-border\)\]/);
    }
    expect(TEINTE_NUANCE.neutre).toContain("bloc-gris-border");
    expect(TEINTE_NUANCE.argent).toContain("bloc-ambre-border");
  });
});

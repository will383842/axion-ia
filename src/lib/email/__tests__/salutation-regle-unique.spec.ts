import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Une seule règle de salutation du payload : la fonction commune (`@/lib/email/salutation`) et
 * celle du domaine des devis (`salutation-payload.ts`) doivent avoir le MÊME corps. Lecture en
 * texte : ce test n'importe pas le domaine qualiopi (isolation).
 */
function corps(fichier: string): string {
  const src = readFileSync(join(process.cwd(), fichier), "utf8");
  const debut = src.indexOf("export function salutationPourPayload");
  expect(debut).toBeGreaterThan(-1);
  const ouvre = src.indexOf("{\n  if (e.clientNom", debut);
  expect(ouvre).toBeGreaterThan(-1);
  const fin = src.indexOf("\n}\n", ouvre);
  return src
    .slice(ouvre, fin)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("//"))
    .join("\n");
}

describe("salutationPourPayload : règle unique", () => {
  it("le corps est identique dans les deux fichiers", () => {
    expect(corps("src/lib/email/salutation.ts")).toBe(
      corps("src/server/qualiopi/crm/salutation-payload.ts"),
    );
  });
});

// La note du point après l'appel est RESTITUÉE à l'export (art. 15) —
// 2026-09-27.
//
// La première version la lisait en base (`select: { suivi }`) sans jamais la
// rendre : exactement le défaut que ce fichier avait déjà corrigé le
// 2026-08-31 pour `notes`. Ce test exige les DEUX moitiés.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/api/gdpr-export/route.ts"), "utf8");

describe("export RGPD — le point après l'appel", () => {
  it("est lu en base, note comprise", () => {
    expect(source).toMatch(/suivi:\s*\{\s*select:\s*\{[^}]*note:\s*true/);
  });

  it("est rendu dans chaque rendez-vous, note comprise", () => {
    const rendu = source.slice(source.indexOf("rendezVous: rendezVous.map("));
    expect(rendu).toContain("pointApresAppel:");
    expect(rendu).toMatch(/note:\s*r\.suivi\.note/);
  });
});

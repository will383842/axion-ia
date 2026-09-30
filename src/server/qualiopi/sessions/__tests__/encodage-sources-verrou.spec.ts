/**
 * ADR 0060 — AUCUN TEXTE MAL ENCODÉ DANS LES MODULES DU VERROU.
 *
 * La première version de la PR #1245 avait posé 41 commentaires
 * « ADR 0060 â€” Ã©criture VERROU : refusÃ©e » : de l'UTF-8 relu en
 * Windows-1252 puis réécrit. Un commentaire illisible se recopie, et le même
 * accident, dans une chaîne, partirait à l'écran ou dans le dossier d'audit.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RACINES = [
  join(process.cwd(), "src", "server", "actions", "qualiopi"),
  join(process.cwd(), "src", "server", "qualiopi", "sessions"),
  join(process.cwd(), "src", "server", "qualiopi", "conformite"),
];

/** Séquences typiques d'un UTF-8 relu en Windows-1252 (é → Ã©, — → â€”, etc.). */
const MOJIBAKE = /Ã[ -¿]|â€[\u0080-ÿ‘-„™œš]?|Â[ -¿]/;

function fichiers(dossier: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) out.push(...fichiers(chemin));
    else if (/\.tsx?$/.test(nom)) out.push(chemin);
  }
  return out;
}

describe("encodage des sources du verrou de dossier", () => {
  it("aucune ligne mal encodée (UTF-8 relu en Windows-1252)", () => {
    const fautives: string[] = [];
    for (const racine of RACINES) {
      for (const chemin of fichiers(racine)) {
        if (chemin.endsWith("encodage-sources-verrou.spec.ts")) continue;
        readFileSync(chemin, "utf-8")
          .split("\n")
          .forEach((ligne, i) => {
            if (MOJIBAKE.test(ligne)) {
              fautives.push(`${relative(process.cwd(), chemin)}:${i + 1}: ${ligne.trim()}`);
            }
          });
      }
    }
    expect(fautives).toEqual([]);
  });

  it("contre-témoin : la ligne fautive de la première version est détectée", () => {
    expect(MOJIBAKE.test("// ADR 0060 â€” Ã©criture VERROU : refusÃ©e sur un dossier clos.")).toBe(
      true,
    );
    expect(MOJIBAKE.test("// ADR 0060 — écriture VERROU : refusée sur un dossier clos.")).toBe(
      false,
    );
  });
});

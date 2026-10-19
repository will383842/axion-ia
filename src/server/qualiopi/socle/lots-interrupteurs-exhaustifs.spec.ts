/**
 * La liste des lots de l'écran « Interrupteurs Qualiopi » est écrite à la main :
 * ce test la compare au code. Un lot qui a une clé `qualiopi.<lot>.actif` (constante
 * `LOT_*` ou clé littérale) mais pas de ligne dans l'écran ne pourrait jamais être
 * allumé depuis la console : on refuse qu'il passe inaperçu.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LOTS_INTERRUPTEURS } from "./lots-interrupteurs";

const RACINES = ["src/server/qualiopi", "src/server/actions/qualiopi"];
/** Clés de test du socle, et les chantiers qui ont leur propre écran. */
const IGNORES = new Set(["l03"]);

function fichiersSource(dir: string): string[] {
  return readdirSync(dir).flatMap((nom) => {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) return nom === "__tests__" ? [] : fichiersSource(chemin);
    return /\.tsx?$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

function lotsDuCode(): Map<string, string> {
  const lots = new Map<string, string>();
  for (const racine of RACINES) {
    for (const f of fichiersSource(racine)) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/\bLOT_[A-Z0-9_]+\s*(?::\s*string\s*)?=\s*"([a-z0-9_]+)"/g)) {
        lots.set(m[1]!, f);
      }
      for (const m of src.matchAll(/qualiopi\.([a-z0-9_]+)\.actif/g)) lots.set(m[1]!, f);
    }
  }
  for (const l of IGNORES) lots.delete(l);
  return lots;
}

describe("lots d'interrupteurs : l'écran couvre le code", () => {
  it("chaque lot `qualiopi.<lot>.actif` du code a sa ligne dans l'écran", () => {
    const dansEcran = new Set(LOTS_INTERRUPTEURS.map((l) => l.lot));
    const manquants = [...lotsDuCode()].filter(([lot]) => !dansEcran.has(lot));
    expect(
      manquants,
      "Lot(s) du code absent(s) de l'écran « Interrupteurs Qualiopi » : " +
        manquants.map(([lot, f]) => `« ${lot} » (${f})`).join(", ") +
        ". Pour l'ajouter : une entrée { lot, libelle, description } dans LOTS_INTERRUPTEURS " +
        "(src/server/qualiopi/socle/lots-interrupteurs.ts), en français ; " +
        "si le lot n'agit pas sur de vrais clients, ajouter aussi `confirmationActif`.",
    ).toEqual([]);
  });

  it("le balayage trouve bien les lots connus (le test ne tourne pas à vide)", () => {
    const code = lotsDuCode();
    expect(code.size).toBeGreaterThanOrEqual(12);
    expect(code.has("veille")).toBe(true);
    expect([...code.keys()].some((l) => l.startsWith("formateurs"))).toBe(false);
  });

  it("seul le lot « essai » porte un texte de confirmation propre", () => {
    const propres = LOTS_INTERRUPTEURS.filter((l) => l.confirmationActif).map((l) => l.lot);
    expect(propres).toEqual(["essai"]);
  });
});

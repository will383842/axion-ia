// V8-E2 — aucun hex hors palette définitive dans le code des e-mails (src/lib/email/**).
// Palette : ivoire, gris chaud, noir, terracotta, orange et gris (sur noir), gris secondaire, blanc de la carte, erreur.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const PALETTE = new Set([
  "#FAF9F5",
  "#E8E6DC",
  "#141413",
  "#B23F16",
  "#D97757",
  "#B0AEA5",
  "#5E5D59",
  "#FFFFFF",
  "#B8341C",
]);

const RACINE = join(process.cwd(), "src/lib/email");

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return nom === "__tests__" ? [] : fichiers(chemin);
    return /\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

describe("e-mails — aucun hex hors palette", () => {
  it("chaque hex de src/lib/email/** appartient à la palette définitive", () => {
    const hors: string[] = [];
    for (const f of fichiers(RACINE)) {
      const texte = readFileSync(f, "utf8");
      for (const m of texte.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-zA-Z])/g)) {
        const hex = m[0].toUpperCase();
        const long =
          hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
        if (!PALETTE.has(long)) hors.push(`${relative(RACINE, f)} : ${m[0]}`);
      }
    }
    expect(hors).toEqual([]);
  });
});

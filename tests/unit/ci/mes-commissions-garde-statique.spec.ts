// « Mes commissions » : la page de l'espace apporteur LIT, ne décide pas. Aucun fichier (hors
// tests) sous l'espace n'importe la base, ni les fonctions de calcul ou d'attribution.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = "src/app/apporteur/dossier/[id]/[jeton]";
const INTERDITS = [
  "@/lib/prisma",
  "lireCommissions",
  "lireFicheApporteur",
  "calculerCommission",
  "commandesSoldees",
  "presentationPourEtablissement",
  "attributaireDeLaCommande",
  "lireVirementsAFaire",
];

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? fichiers(p) : [p];
  });
}

describe("mes-commissions : garde statique (T7)", () => {
  const cibles = fichiers(RACINE).filter(
    (f) =>
      /\.(ts|tsx)$/.test(f) &&
      !/\.(spec|test)\./.test(f) &&
      (f.includes("/mes-commissions/") || f.includes("/factures/")),
  );
  it("des fichiers à garder existent", () => expect(cibles.length).toBeGreaterThanOrEqual(3));
  it.each(cibles)("%s n'importe aucun module de calcul ni la base", (f) => {
    const src = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const m of INTERDITS) expect(src, m).not.toContain(m);
  });
});

describe("mes-commissions : lecture serveur", () => {
  const src = readFileSync("src/features/apporteurs-reseau/espace-commissions.ts", "utf8");
  it("n'appelle aucune fonction de calcul ni d'attribution", () => {
    for (const m of INTERDITS.filter((x) => x !== "@/lib/prisma")) expect(src).not.toContain(m);
  });
  it("ne propage jamais une ligne entière (colonnes énumérées)", () => {
    expect(src).not.toMatch(/include:\s*\{/);
  });
});

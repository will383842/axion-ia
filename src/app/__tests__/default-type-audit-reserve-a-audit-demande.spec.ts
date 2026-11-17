/**
 * `defaultType="audit"` coche « Audit IA » d'office dans le formulaire unifié.
 * Seule la page /audit/demande y a droit : sur /demande-devis, une demande de
 * formation ou de devis recevait l'accusé d'audit. Verrou de source.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const ADMISE = "src/app/[locale]/audit/demande/page.tsx";

function fichiersTsx(dossier: string): string[] {
  const sortie: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "node_modules" || nom === "__tests__") continue;
      sortie.push(...fichiersTsx(chemin));
    } else if (nom.endsWith(".tsx")) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

describe('defaultType="audit" réservé à /audit/demande', () => {
  it("n'apparaît que dans la page de demande d'audit", () => {
    const motif = /defaultType=(?:"audit"|\{\s*"audit"\s*\})/;
    const trouves = [
      ...fichiersTsx(join(RACINE, "src", "app")),
      ...fichiersTsx(join(RACINE, "src", "components")),
    ]
      .filter((f) => motif.test(readFileSync(f, "utf8")))
      .map((f) => relative(RACINE, f).split(sep).join("/"));
    expect(trouves).toEqual([ADMISE]);
  });

  it('/demande-devis pose defaultType="devis"', () => {
    const src = readFileSync(join(RACINE, "src/app/[locale]/demande-devis/page.tsx"), "utf8");
    expect(src).toContain('defaultType="devis"');
  });
});

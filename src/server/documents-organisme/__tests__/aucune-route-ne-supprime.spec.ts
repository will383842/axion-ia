/**
 * CHANTIER QNC, L13 — AUCUNE ROUTE NE SUPPRIME un document de l'organisme
 * quand l'archivage est allumé.
 *
 * Analyse statique des points d'entrée de la rubrique Société et du hub
 * Documents (Server Actions et gestionnaires de route) :
 *   - toute action exportée qui contient un geste destructeur (`.delete(`,
 *     `.deleteMany(`, `deleteConsoleDocFile(`, `deleteFromR2(`) doit lire
 *     l'interrupteur AVANT ce geste — c'est le chemin « éteint, comme avant » ;
 *   - le retrait et les notes ne contiennent AUCUN geste destructeur ;
 *   - aucun gestionnaire de route n'exporte `DELETE` ni ne détruit.
 * Les tests de comportement (`archivage-l13.spec.ts`) prouvent que la lecture
 * de l'interrupteur mène bien au refus ; celui-ci, qu'aucune porte nouvelle
 * n'échappe à la règle.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();
const ACTIONS = [
  "src/server/actions/societe-documents/documents.actions.ts",
  "src/server/actions/console-documents/documents.actions.ts",
  "src/server/actions/intervention-documents/documents.actions.ts",
];
const SANS_DESTRUCTION = [
  "src/server/actions/documents-organisme/retrait.actions.ts",
  "src/server/actions/qualiopi/notes-pieces.ts",
];
const ROUTES = [
  "src/app/[locale]/(admin)/[adminPrefix]/societe",
  "src/app/[locale]/(admin)/[adminPrefix]/documents-interventions",
];

const DESTRUCTION = /\.\s*delete(?:Many)?\s*\(|\bdeleteConsoleDocFile\s*\(|\bdeleteFromR2\s*\(/;
const CONTROLE = /\barchivageDocumentsOrganismeActif\s*\(/;

/** Code sans commentaires : un commentaire qui cite `delete(` n'est pas un geste. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function actionsExportees(source: string): Array<{ nom: string; corps: string }> {
  const debuts = [...source.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)];
  return debuts.map((m, i) => ({
    nom: m[1] as string,
    corps: source.slice(m.index ?? 0, debuts[i + 1]?.index ?? source.length),
  }));
}

function routes(dossier: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) out.push(...routes(chemin));
    else if (nom === "route.ts") out.push(chemin);
  }
  return out;
}

/** La règle, isolée pour le contre-témoin. */
export function actionsFautives(source: string): string[] {
  return actionsExportees(code(source))
    .filter(({ corps }) => {
      const d = corps.search(DESTRUCTION);
      if (d < 0) return false;
      const c = corps.search(CONTROLE);
      return c < 0 || c > d;
    })
    .map((a) => a.nom);
}

describe("aucune route ne supprime un document de l'organisme (archivage allumé)", () => {
  it.each(ACTIONS)("%s : chaque geste destructeur est précédé de l'interrupteur", (f) => {
    const source = readFileSync(join(RACINE, f), "utf-8");
    expect(actionsExportees(source).length, "témoin : le fichier a des actions").toBeGreaterThan(0);
    expect(actionsFautives(source)).toEqual([]);
  });

  it.each(SANS_DESTRUCTION)("%s ne contient aucun geste destructeur", (f) => {
    expect(code(readFileSync(join(RACINE, f), "utf-8"))).not.toMatch(DESTRUCTION);
  });

  it("aucun gestionnaire de route de ces rubriques n'exporte DELETE ni ne détruit", () => {
    const fichiers = ROUTES.flatMap((d) => routes(join(RACINE, d)));
    expect(
      fichiers.length,
      "témoin : les routes de téléchargement sont vues",
    ).toBeGreaterThanOrEqual(2);
    for (const f of fichiers) {
      const source = code(readFileSync(f, "utf-8"));
      expect(source, f).not.toMatch(/export\s+(?:async\s+function|const)\s+DELETE\b/);
      expect(source, f).not.toMatch(DESTRUCTION);
    }
  });

  it("contre-témoin : une suppression ajoutée sans interrupteur est vue", () => {
    const faux = `"use server";
export async function nouvelleAction() {
  await prisma.societeDocument.delete({ where: { id } });
}
export async function bonneAction() {
  if (await archivageDocumentsOrganismeActif()) return refus;
  await prisma.societeDocument.delete({ where: { id } });
}
export async function controleTropTard() {
  await deleteConsoleDocFile(p);
  if (await archivageDocumentsOrganismeActif()) return refus;
}`;
    expect(actionsFautives(faux)).toEqual(["nouvelleAction", "controleTropTard"]);
  });
});

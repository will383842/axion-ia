/**
 * ⛔ LA TABLE `alertes_visio` RESTE VIDE (chantier visio ; anti-doublon A3,
 * audit du 29/09).
 *
 * La PR 2 a posé `AlerteVisio`. L'audit anti-doublon a tranché : pas de table
 * ni de service d'alerte parallèle, les alertes du circuit passent par
 * `AlerteSysteme` + `creerOuDedup` avec des codes `visio.*` du catalogue. La
 * table reste en base (aucune migration destructive), VIDE, et abandonnée
 * (ADR 0053, amendement du 29/09). Cette garde refuse tout code de `src/` qui
 * l'écrirait ou la lirait.
 *
 * Mutation qui rougit : remettre `db.alerteVisio.upsert(...)` dans
 * `balayage-enregistreur.ts` → 1er cas.
 * Contre-témoin : les codes `visio.*` levés par le balayage sont TOUS au
 * catalogue (sinon : sans guichet, ouverts pour toujours).
 * Angle mort : un accès par `$queryRaw` sur `alertes_visio` ne se voit pas ici.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { ALERTE_CATALOGUE } from "@/server/qualiopi/alertes/catalogue";
import { CODES_ALERTES_VISIO } from "@/server/visio/alertes";

const RACINE = process.cwd();

function sources(dir: string, acc: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (nom === "node_modules" || nom === "generated") continue;
    if (statSync(chemin).isDirectory()) sources(chemin, acc);
    else if (/\.tsx?$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) acc.push(chemin);
  }
  return acc;
}

describe("⛔ la table alertes_visio reste vide", () => {
  it("aucun code de src/ ne touche au modèle AlerteVisio", () => {
    const fautifs = sources(join(RACINE, "src"))
      .filter((f) => /\.alerteVisio\b/.test(readFileSync(f, "utf8")))
      .map((f) => relative(RACINE, f).split(sep).join("/"));
    expect(fautifs, "utiliser AlerteSysteme + creerOuDedup (codes visio.*)").toEqual([]);
  });

  it("contre-témoin : chaque code visio.* levé est au catalogue", () => {
    for (const code of Object.values(CODES_ALERTES_VISIO)) {
      expect(code.startsWith("visio."), code).toBe(true);
      expect(ALERTE_CATALOGUE[code], `« ${code} » absent du catalogue`).toBeDefined();
      expect(ALERTE_CATALOGUE[code]?.resolutionAuto).toBe(false);
    }
  });
});

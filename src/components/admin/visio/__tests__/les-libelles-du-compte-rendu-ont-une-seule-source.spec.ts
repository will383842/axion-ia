/**
 * ⛔ LES LIBELLÉS DU COMPTE RENDU ONT UNE SEULE SOURCE (`libelles.ts`).
 *
 * La vue du compte rendu recopiait des libellés à côté de
 * `src/features/dossier-client/libelles.ts` : un `LIBELLE_RUBRIQUE` homonyme
 * (autres intitulés, sans la rubrique 12), un `euros()` recopié deux fois avec
 * deux formats, et des tables en `Record<string, string>` dont le repli
 * (`?? f.motifRejet`) montrait un nom d'énumération à Will. Les tables vivent
 * désormais dans `libelles.ts`, en `satisfies Record<Énumération, string>` :
 * une valeur ajoutée à l'énumération sans libellé ne compile pas.
 *
 * Mutations qui rougissent : redéclarer une table `Record<string, string>`
 * dans un composant du compte rendu ; recopier `euros()` ; réexporter un
 * `LIBELLE_RUBRIQUE`. Contre-témoin : chaque motif de rejet a son libellé.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LIBELLE_MOTIF_REJET } from "@/features/dossier-client/libelles";

const racine = process.cwd();
const lire = (p: string) => readFileSync(path.resolve(racine, p), "utf8");
const composants = readdirSync(path.resolve(racine, "src/components/admin/visio"))
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => `src/components/admin/visio/${f}`);

describe("les libellés du compte rendu ont une seule source", () => {
  it("aucun composant du compte rendu ne porte sa propre table de libellés", () => {
    for (const f of composants) {
      const src = lire(f);
      expect(src, f).not.toMatch(/Readonly<Record<string, string>>/);
      expect(src, f).not.toMatch(/export const LIBELLE_RUBRIQUE/);
      expect(src, f).not.toMatch(/\?\? f\.motifRejet/);
    }
  });

  it("un seul `euros()` : celui de libelles.ts", () => {
    for (const f of [...composants, "src/server/visio/depot-donnees.ts"]) {
      expect(lire(f), f).not.toMatch(/function euros\(/);
    }
    expect(lire("src/features/dossier-client/libelles.ts")).toMatch(/export function euros\(/);
  });

  it("contre-témoin : chaque motif de rejet a une phrase en français", () => {
    for (const [motif, libelle] of Object.entries(LIBELLE_MOTIF_REJET)) {
      expect(libelle, motif).not.toBe(motif);
      expect(libelle.length, motif).toBeGreaterThan(4);
    }
  });
});

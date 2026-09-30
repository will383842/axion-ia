/**
 * ⛔ LES ÉTATS « ENREGISTREMENT ACTIF » NE SONT ÉCRITS QU'UNE FOIS
 * (chantier visio ; ADR 0054).
 *
 * `ETATS_ENREGISTREMENT_ACTIFS` (src/server/visio/etats.ts) dit ce qu'est un
 * enregistrement « en vie ». Une copie de la liste ailleurs dans le code
 * (retrait de l'accord, clôture…) ne suivrait pas un état ajouté à la
 * constante : le retrait passerait en « abandonné » un enregistrement encore
 * en cours, ou la clôture l'oublierait.
 *
 * Mutation qui rougit : réécrire `notIn: ["accord_en_attente", "en_cours",
 * "interrompu"]` dans `src/lib/rgpd-erase.ts` au lieu d'importer la constante.
 * Angle mort : une copie qui change l'ordre ou n'en garde que deux états
 * n'est pas lue ; le motif cherche les trois états côte à côte, dans l'ordre.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { ETATS_ENREGISTREMENT_ACTIFS } from "../../../src/server/visio/etats";

const RACINE = join(__dirname, "..", "..", "..");
const SOURCE = "src/server/visio/etats.ts";

function fichiers(dossier: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "__tests__" || nom === "node_modules") continue;
      out.push(...fichiers(chemin));
    } else if (/\.tsx?$/.test(nom)) out.push(chemin);
  }
  return out;
}

const MOTIF = new RegExp(
  ETATS_ENREGISTREMENT_ACTIFS.map((e) => `["']${e}["']`).join(String.raw`\s*,\s*`),
);

describe("les états « enregistrement actif » ne sont écrits qu'une fois", () => {
  it("le motif reconnaît bien une copie (témoin)", () => {
    expect(MOTIF.test(`notIn: ["accord_en_attente", "en_cours", "interrompu"]`)).toBe(true);
  });

  it("aucun fichier de src/ hors etats.ts ne recopie la liste", () => {
    const copies = fichiers(join(RACINE, "src"))
      .map((f) => relative(RACINE, f).split(sep).join("/"))
      .filter((f) => f !== SOURCE)
      .filter((f) => MOTIF.test(readFileSync(join(RACINE, f), "utf8")));
    expect(copies).toEqual([]);
  });
});

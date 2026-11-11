/**
 * Les textes de ville n'affichent aucun montant « 990 ».
 *
 * La Journée IA à 1 490 € HT est le seul prix affiché par Axion-IA. Onze
 * fichiers `src/content/villes/copy/*.ts` portaient, dans leurs variantes
 * anglaises (non servies tant que `EN_LOCALE_ENABLED` est éteint), un ancien
 * tarif d'entrée de coaching « From €990 excl. VAT ». Ces fichiers passent
 * AVANT la base (`resolve-with-copy.ts`) : le jour où l'anglais est rallumé,
 * le montant s'afficherait tel quel. Il est remplacé par « Price on request »,
 * sans montant.
 *
 * Nettoyé par `scripts/villes/retirer-prix-990.mjs`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "src", "content", "villes", "copy");

/** `types.ts` décrit le modèle de données, pas un texte de ville. */
const FICHIERS = readdirSync(DOSSIER)
  .filter((nom) => nom.endsWith(".ts") && nom !== "types.ts")
  .sort();

function violations(motif: RegExp): string[] {
  const trouves: string[] = [];
  for (const nom of FICHIERS) {
    readFileSync(join(DOSSIER, nom), "utf8")
      .split("\n")
      .forEach((ligne, i) => {
        if (motif.test(ligne)) trouves.push(`${nom}:${i + 1}`);
      });
  }
  return trouves;
}

describe("villes · aucun montant 990", () => {
  it("le dossier est bien lu (garde contre un test vide)", () => {
    expect(FICHIERS.length).toBeGreaterThan(2000);
  });

  it("aucun « €990 » ni « 990 € » ni « 990 EUR »", () => {
    expect(violations(/€\s*990\b|\b990\s*(€|EUR\b|euros?\b)/i)).toEqual([]);
  });

  it("aucun « From €… excl. VAT » chiffré dans les coachings", () => {
    expect(violations(/\bfrom €\s*\d[\d,.]*\s*excl/i)).toEqual([]);
  });
});

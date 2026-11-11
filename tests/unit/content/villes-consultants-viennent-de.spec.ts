/**
 * Cliquet : « Nos consultants viennent de X (20 min). » ne peut que reculer.
 *
 * Axion-IA n'a ni bureau ni consultant basé localement : elle intervient
 * partout en France, sur place ou à distance. Faire « venir » les consultants
 * d'une ville voisine en N minutes affirme une base qui n'existe pas. Les
 * fichiers `src/content/villes/copy/*.ts` passent AVANT la base
 * (`resolve-with-copy.ts`), donc la phrase s'affiche telle quelle.
 *
 * La famille compte 1 147 lignes dans 831 fichiers au 2026-11-11 : trop pour
 * une PR. Elle est retirée PAR LOTS (`scripts/villes/retirer-consultants-viennent-de.mjs`).
 * Ce test refuse donc deux choses :
 *   · que le total dépasse le PLAFOND (à abaisser à chaque lot, jamais à relever) ;
 *   · qu'un fichier déjà nettoyé (liste alphabétique jusqu'à DERNIER_NETTOYE)
 *     contienne de nouveau la phrase.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "src", "content", "villes", "copy");

/** Lignes fautives restantes. Lot 1 : 1 147 → 957. */
const PLAFOND = 957;

/** Tout fichier dont le nom est ≤ celui-ci (ordre alphabétique) est propre. */
const DERNIER_NETTOYE = "caussade.ts";

const PHRASE =
  /(^|["“] ?|[.!?] )Nos consultants (?:seniors )?(?:viennent (?:de|depuis)|se déplacent[^."]{0,40}depuis|interviennent depuis)[^."]*\.(?= |"|$)/u;

const FICHIERS = readdirSync(DOSSIER)
  .filter((nom) => nom.endsWith(".ts") && nom !== "types.ts")
  .sort();

function fautives(nom: string): string[] {
  return readFileSync(join(DOSSIER, nom), "utf8")
    .split("\n")
    .flatMap((ligne, i) => (PHRASE.test(ligne) ? [`${nom}:${i + 1}`] : []));
}

const TOUTES = FICHIERS.flatMap(fautives);

describe("villes · « Nos consultants viennent de X » recule", () => {
  it("le dossier est bien lu (garde contre un test vide)", () => {
    expect(FICHIERS.length).toBeGreaterThan(2000);
  });

  it("le motif reconnaît bien la phrase (garde contre un motif mort)", () => {
    expect(PHRASE.test('a: "Nos consultants viennent de Lyon (20 min).",')).toBe(true);
    expect(PHRASE.test('a: "Ok. Nos consultants se déplacent en 15 min depuis Toulouse."')).toBe(
      true,
    );
    expect(PHRASE.test('a: "Nous intervenons partout en France, sur place ou à distance."')).toBe(
      false,
    );
  });

  it(`au plus ${PLAFOND} lignes fautives (cliquet)`, () => {
    expect(TOUTES.length).toBeLessThanOrEqual(PLAFOND);
  });

  it(`aucune phrase dans les fichiers déjà nettoyés (≤ ${DERNIER_NETTOYE})`, () => {
    expect(TOUTES.filter((ref) => (ref.split(":")[0] ?? "") <= DERNIER_NETTOYE)).toEqual([]);
  });
});

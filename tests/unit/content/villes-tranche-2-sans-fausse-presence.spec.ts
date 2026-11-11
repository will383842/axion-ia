/**
 * Cliquet · tranche 2 sur 3 des textes de ville (gentilly.ts → paris.ts) :
 * plus de fausse présence locale (« Nos consultants rejoignent / couvrent /
 * interviennent à X depuis Y », « Depuis <Ville> (n min). », « depuis nos
 * bureaux », « bureaux proches de ») ni de tarif « From €NNN excl. VAT ».
 *
 * Axion-IA n'a ni bureau ni consultant basé localement : elle intervient
 * partout en France, sur place ou à distance. Les fichiers
 * `src/content/villes/copy/*.ts` passent AVANT la base : la phrase s'affiche
 * telle quelle. Lot nettoyé par `scripts/villes/retirer-fausse-presence-tranche.mjs`.
 *
 * Le test refuse :
 *   · qu'un fichier déjà nettoyé (≤ DERNIER_NETTOYE) contienne de nouveau le motif ;
 *   · que le total restant de la tranche dépasse le PLAFOND (à abaisser à
 *     chaque lot, jamais à relever).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "src", "content", "villes", "copy");

/** Lignes fautives restantes dans la tranche 2. Lot 2 : 508 → 118. */
const PLAFOND = 118;

/** Tout fichier de la tranche dont le nom est ≤ celui-ci (ordre alphabétique) est propre. */
const DERNIER_NETTOYE = "mimizan.ts";

const TOUS = readdirSync(DOSSIER)
  .filter((nom) => nom.endsWith(".ts") && nom !== "types.ts")
  .sort();
const N = TOUS.length;
const TRANCHE = TOUS.slice(Math.floor(N / 3), Math.floor((2 * N) / 3));

const PHRASE_GENERIQUE = /(?<=^|["“] ?|[.!?] )([^."]*\.)(?= |"|$)/gu;

function phraseFautive(phrase: string): boolean {
  if (/^Nos (?:consultants|équipes|experts)\b/u.test(phrase)) {
    return /viennent (?:de|depuis)|depuis [A-ZÉ]|rejoignent|sont basés|couvrent/u.test(phrase);
  }
  if (/^Depuis [A-ZÉ][^()]{0,40}\(/u.test(phrase)) return true;
  return /depuis nos bureaux|bureaux proches de/u.test(phrase);
}

function ligneFautive(ligne: string): boolean {
  if (/From €\d+ excl\. VAT/iu.test(ligne)) return true;
  return (ligne.match(PHRASE_GENERIQUE) ?? []).some(phraseFautive);
}

function fautives(nom: string): string[] {
  return readFileSync(join(DOSSIER, nom), "utf8")
    .split("\n")
    .flatMap((ligne, i) => (ligneFautive(ligne) ? [`${nom}:${i + 1}`] : []));
}

const TOUTES = TRANCHE.flatMap(fautives);

describe("villes · tranche 2/3 sans fausse présence locale", () => {
  it("la tranche est bien lue (garde contre un test vide)", () => {
    expect(TRANCHE.length).toBeGreaterThan(700);
    expect(TRANCHE[0]).toBe("gentilly.ts");
  });

  it("le motif reconnaît les phrases visées (garde contre un motif mort)", () => {
    expect(ligneFautive('a: "Nos consultants rejoignent Rennes en 1h25 depuis Paris (TGV)."')).toBe(
      true,
    );
    expect(
      ligneFautive('a: "Nos consultants interviennent à Houplines depuis Lille (25 min)."'),
    ).toBe(true);
    expect(ligneFautive('a: "Ok. Depuis Bordeaux (50 min). Tarifs publics."')).toBe(true);
    expect(ligneFautive('a: "Nous intervenons partout en France, sur place ou à distance."')).toBe(
      false,
    );
    expect(ligneFautive('price: "From €990 excl. VAT"')).toBe(true);
  });

  it(`au plus ${PLAFOND} lignes fautives dans la tranche (cliquet)`, () => {
    expect(TOUTES.length).toBeLessThanOrEqual(PLAFOND);
  });

  it(`aucune phrase fautive dans les fichiers déjà nettoyés (≤ ${DERNIER_NETTOYE})`, () => {
    expect(TOUTES.filter((ref) => (ref.split(":")[0] ?? "") <= DERNIER_NETTOYE)).toEqual([]);
  });
});

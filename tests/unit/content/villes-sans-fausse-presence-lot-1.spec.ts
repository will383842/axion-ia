/**
 * Cliquet · tranche 1 sur 3 des textes de ville (abbeville → gerardmer, premier
 * tiers alphabétique) : plus de fausse présence locale.
 *
 * Axion-IA n'a ni bureau ni consultant basé localement : elle intervient
 * partout en France, sur place ou à distance. Ce test échoue si, dans la
 * tranche, reviennent « Nos consultants/équipes/experts viennent de /
 * interviennent … depuis / rejoignent / couvrent … depuis / sont basés »,
 * la phrase autonome « Depuis <Ville> (n min). », « depuis nos bureaux »,
 * « bureaux proches de », le mot « Grenoble » ou un « From €NNN ».
 * Les tranches 2 et 3 ne sont pas verrouillées ici.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "src", "content", "villes", "copy");

const TOUS = readdirSync(DOSSIER)
  .filter((n) => n.endsWith(".ts") && n !== "types.ts" && !n.startsWith("_"))
  .sort();
const TRANCHE = TOUS.slice(0, Math.floor(TOUS.length / 3));

const SUJET = "Nos (?:consultants|équipes|experts)(?: seniors)? ";
const VERBE =
  '(?:viennent (?:de|depuis)|se déplacent[^."]{0,40}depuis|interviennent (?:à [^."]{0,40} )?depuis|rejoignent|couvrent[^."]{0,80}depuis|sont basés?)';

const MOTIFS: ReadonlyArray<readonly [string, RegExp]> = [
  ["présence consultants", new RegExp(`(^ *|["“] ?|[.!?] )${SUJET}${VERBE}`, "u")],
  [
    "Depuis <Ville> (n min).",
    /(^ *|["“] ?|[.!?] )Depuis [A-ZÉ][^."()]{1,40}\(\d+ ?(?:h ?\d*|min)[^."()]*\)\./u,
  ],
  ["depuis nos bureaux", /depuis nos bureaux|bureaux proches de/iu],
  ["Grenoble", /Grenoble/u],
  ["From €", /From €\s?\d/u],
];

function trouves(motif: RegExp): string[] {
  return TRANCHE.flatMap((nom) =>
    readFileSync(join(DOSSIER, nom), "utf8")
      .split("\n")
      .flatMap((l, i) => (motif.test(l) ? [`${nom}:${i + 1}`] : [])),
  );
}

describe("villes · tranche 1/3 sans fausse présence", () => {
  it("la tranche est bien lue (garde contre un test vide)", () => {
    expect(TRANCHE.length).toBeGreaterThan(700);
    expect(TRANCHE[0]).toBe("abbeville.ts");
  });

  it("les motifs reconnaissent bien les phrases fautives (garde contre un motif mort)", () => {
    const m = (i: number) => MOTIFS[i]![1];
    expect(m(0).test('a: "Nos consultants interviennent à Anzin depuis Lille (50 min)."')).toBe(
      true,
    );
    expect(m(0).test('a: "Ok. Nos consultants rejoignent Avon en 40 min."')).toBe(true);
    expect(m(1).test('a: "En visio. Depuis Bordeaux (50 min). Fin."')).toBe(true);
    expect(m(0).test('a: "Nous intervenons partout en France, sur place ou à distance."')).toBe(
      false,
    );
  });

  for (const [nom, motif] of MOTIFS) {
    it(`aucune occurrence : ${nom}`, () => {
      expect(trouves(motif)).toEqual([]);
    });
  }
});

/**
 * Cliquet · lot 3 sur 3 des textes de ville (dernier tiers par ordre de nom,
 * `parthenay.ts` et suivants) : plus de fausse présence locale.
 *
 * Axion-IA n'a ni bureau ni consultant basé localement : elle intervient
 * partout en France, sur place ou à distance. Ce test refuse, dans ce tiers :
 *   · « Nos consultants/équipes/experts … depuis X / viennent de X / sont basés » ;
 *   · « interviennent / rejoignent / couvrent … depuis X » ;
 *   · la phrase autonome « Depuis <Ville> (n min). » ;
 *   · « depuis nos bureaux », « bureaux proches de », « Grenoble » ;
 *   · « From €NNN excl. VAT ».
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "src", "content", "villes", "copy");
const PREMIER = "parthenay.ts";

const FICHIERS = readdirSync(DOSSIER)
  .filter((nom) => nom.endsWith(".ts"))
  .sort();
const TIERS = FICHIERS.filter((nom) => nom >= PREMIER);

const MOTIFS: ReadonlyArray<readonly [string, RegExp]> = [
  [
    "équipe « depuis / viennent de / basés »",
    /\b[Nn]os (?:consultants|équipes|experts)\b[^."]*?(?:\bdepuis\b|\bviennent de\b|\bsont basés\b)/u,
  ],
  [
    "interviennent / rejoignent / couvrent … depuis",
    /\b(?:interviennent|rejoignent|couvrent)\b[^."]* depuis [A-ZÉ]/u,
  ],
  [
    "phrase « Depuis <Ville> (n min). »",
    /(?:^|["“.!?] ?)Depuis [A-ZÉ][^."(]{1,40} \(\d+ ?(?:min|h)/u,
  ],
  ["bureaux", /depuis nos bureaux|bureaux proches de/u],
  ["Grenoble", /Grenoble/u],
  ["prix affiché", /From €\d+ excl\. VAT/u],
];

function fautives(motif: RegExp): string[] {
  return TIERS.flatMap((nom) =>
    readFileSync(join(DOSSIER, nom), "utf8")
      .split("\n")
      .flatMap((ligne, i) => (motif.test(ligne) ? [`${nom}:${i + 1}`] : [])),
  );
}

describe("villes · lot 3 sans fausse présence locale", () => {
  it("le tiers est bien lu (garde contre un test vide)", () => {
    expect(TIERS.length).toBeGreaterThan(600);
  });

  it("les motifs reconnaissent bien les phrases (garde contre un motif mort)", () => {
    expect(MOTIFS[0]![1].test('a: "Nos consultants viennent de Lyon (20 min)."')).toBe(true);
    expect(MOTIFS[1]![1].test("Nos consultants interviennent à X depuis Lille (15 min).")).toBe(
      true,
    );
    expect(MOTIFS[2]![1].test('a: "Depuis Annecy (20 min). Ok"')).toBe(true);
    expect(MOTIFS[0]![1].test("Nous intervenons partout en France, sur place ou à distance.")).toBe(
      false,
    );
  });

  for (const [nom, motif] of MOTIFS) {
    it(`aucun « ${nom} »`, () => {
      expect(fautives(motif)).toEqual([]);
    });
  }
});

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
 *   · « From €NNN excl. VAT » ;
 *   · A : la réponse « Consultants depuis <Ville> (n min). » ;
 *   · B : la question « Comment se passe/déroule une mission … depuis <Ville> ? » ;
 *   · C : « depuis Paris » / « depuis le littoral » (insensible à la casse).
 *
 * Le tiers est borné par NOM de fichier (de `parthenay.ts` à la fin), jamais par
 * un tiers du nombre de fichiers : l'ajout d'une ville ailleurs ne le déplace pas.
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
  ["A · « Consultants depuis <Ville> »", /\b[Cc]onsultants depuis\b/u],
  [
    "B · « Comment se passe/déroule une mission … depuis <Ville> »",
    /Comment se (?:passe|déroule) une mission (?:à [^"?]+? )?depuis /u,
  ],
  ["C · « depuis Paris » / « depuis le littoral »", /\b[Dd]epuis (?:Paris|le littoral)/u],
];

/** Un exemple fautif par motif : un motif qui ne reconnaît plus rien est mort. */
const EXEMPLES_FAUTIFS: ReadonlyArray<readonly [number, string]> = [
  [0, "Nos consultants viennent de Lyon (20 min)."],
  [1, "Nos consultants interviennent à X depuis Lille (15 min)."],
  [2, 'a: "Depuis Annecy (20 min). Ok"'],
  [3, "Intervention depuis nos bureaux de la ville."],
  [4, "Grenoble"],
  [5, "From €990 excl. VAT"],
  [6, "Oui, Axion-IA intervient à X. Consultants depuis Lyon (1h)."],
  [6, "Oui, nous intervenons à X, consultants depuis Lyon (1h)."],
  [7, "Comment se passe une mission depuis Paris ?"],
  [7, "Comment se déroule une mission à Plouay depuis Lorient ?"],
  [7, "Comment se passe une mission depuis Lyon ou Valence ?"],
  [8, "Depuis Paris, nous rejoignons Pessac via la gare."],
  [8, "Nos consultants rejoignent le site depuis Paris-Montparnasse."],
  [8, "Déplacement arrière-pays inclus depuis le littoral azuréen."],
  [8, "environ 10 km depuis Paris"],
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

  it("chaque motif reconnaît au moins un exemple fautif (garde « motif mort » par motif)", () => {
    for (const [i] of MOTIFS.entries()) {
      expect(
        EXEMPLES_FAUTIFS.some(([k, texte]) => k === i && MOTIFS[i]![1].test(texte)),
        MOTIFS[i]![0],
      ).toBe(true);
    }
    for (const [k, texte] of EXEMPLES_FAUTIFS) {
      expect(MOTIFS[k]![1].test(texte), `${MOTIFS[k]![0]} ← ${texte}`).toBe(true);
    }
  });

  for (const [nom, motif] of MOTIFS) {
    it(`aucun « ${nom} »`, () => {
      expect(fautives(motif)).toEqual([]);
    });
  }
});

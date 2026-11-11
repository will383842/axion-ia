/**
 * Cliquet · lot 1 sur 3 des textes de ville (abbeville.ts → gennevilliers.ts,
 * gentilly.ts exclue) : plus de fausse présence locale.
 *
 * Les bornes sont des NOMS de fichier, pas un tiers du nombre de fichiers :
 * ajouter ou retirer une ville ne déplace pas la frontière, et aucun fichier
 * n'est couvert par deux lots (le lot 2 commence à gentilly.ts).
 *
 * Axion-IA n'a ni bureau ni consultant basé localement : elle intervient
 * partout en France, sur place ou à distance. Ce test échoue si reviennent :
 *   · « Nos consultants/équipes/experts … viennent de / depuis / rejoignent /
 *     sont basés » ; « Depuis <Ville> (n min). » ; « depuis nos bureaux » ;
 *   · A · « Consultants depuis <Ville> … » (sans « Nos ») ;
 *   · B · la question « Comment se passe/déroule une mission … depuis <Ville> ? » ;
 *   · C · « Depuis Paris, nous rejoignons … », « rejoignent le site depuis
 *     Paris-Montparnasse », « environ N km depuis Paris », « se déplace(nt)
 *     depuis Paris en N minutes » ;
 *   · le mot « Grenoble » ou un « From €NNN ».
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "src", "content", "villes", "copy");

/** Lot 1 : [DEBUT, FIN_EXCLUE[ par nom de fichier. FIN_EXCLUE = début du lot 2. */
const DEBUT = "abbeville.ts";
const FIN_EXCLUE = "gentilly.ts";

const TRANCHE = readdirSync(DOSSIER)
  .filter((n) => n.endsWith(".ts") && n !== "types.ts" && !n.startsWith("_"))
  .sort()
  .filter((n) => n >= DEBUT && n < FIN_EXCLUE);

const SUJET = "[Nn]os (?:consultants|équipes|experts)(?: IA)?(?: seniors)? ";
const VERBE =
  "(?:viennent (?:de|depuis|via)|rejoignent|sont basés?|[^.\"]{0,100}\\bdepuis (?:[A-ZÉ]|la gare|le centre|l['’]))";

const MOTIFS: ReadonlyArray<readonly [string, RegExp]> = [
  ["présence consultants", new RegExp(`(^ *|["“] ?|[.!?] |Oui, )${SUJET}${VERBE}`, "u")],
  [
    "Depuis <Ville> (n min).",
    /(^ *|["“] ?|[.!?] )[Dd]epuis [A-ZÉ][^."()]{1,40}\(\d+ ?(?:h ?\d*|min)[^."()]*\)\./u,
  ],
  ["depuis nos bureaux", /depuis nos bureaux|bureaux proches de/iu],
  ["Grenoble", /Grenoble/u],
  ["From €", /From €\s?\d/u],
  ["A · Consultants depuis <Ville>", /(^ *|["“] ?|[.!?] )[Cc]onsultants depuis /u],
  ["B · mission … depuis <Ville>", /Comment se (?:passe|déroule) une mission[^"?]*[Dd]epuis /u],
  ["C · Depuis Paris, nous rejoignons", /[Dd]epuis [A-ZÉ][^."(),]{1,40}, nous rejoignons/u],
  ["C · rejoignent le site depuis", /rejoignent le site depuis/iu],
  ["C · environ N km depuis Paris", /environ \d+ ?km depuis Paris/iu],
  [
    "C · se déplace depuis Paris en N min",
    /se déplace(?:nt)? [^."]{0,40}depuis Paris en \d+ ?min/iu,
  ],
];

function trouves(motif: RegExp): string[] {
  return TRANCHE.flatMap((nom) =>
    readFileSync(join(DOSSIER, nom), "utf8")
      .split("\n")
      .flatMap((l, i) => (motif.test(l) ? [`${nom}:${i + 1}`] : [])),
  );
}

/** Une phrase fautive par motif (même ordre que MOTIFS) : garde contre un motif mort. */
const FAUTIVES: readonly string[] = [
  'a: "Ok. Nos consultants rejoignent Avon en 40 min."',
  'a: "En visio. Depuis Bordeaux (50 min). Fin."',
  'a: "Équipe depuis nos bureaux de Lyon."',
  'a: "Basés à Grenoble."',
  'a: "From €990 par mois."',
  'a: "Oui. Consultants depuis Poitiers (1h10) ou La Rochelle (1h)."',
  'q: "Comment se passe une mission depuis Paris ?"',
  'a: "Depuis Paris, nous rejoignons Cergy en RER A."',
  'a: "La gare dessert Nantes ; nos consultants rejoignent le site depuis Paris-Montparnasse."',
  'a: "Pour la mise en route — environ 10 km depuis Paris via T1."',
  'a: "Notre équipe se déplace depuis Paris en 25 minutes via le RER B."',
];

describe("villes · lot 1/3 sans fausse présence", () => {
  it("le lot est bien lu, par noms de fichier (garde contre un test vide)", () => {
    expect(TRANCHE.length).toBeGreaterThan(700);
    expect(TRANCHE[0]).toBe("abbeville.ts");
    expect(TRANCHE).not.toContain("gentilly.ts");
    expect(TRANCHE).not.toContain("parmain.ts");
  });

  it("chaque motif reconnaît sa phrase fautive (garde contre un motif mort)", () => {
    expect(FAUTIVES).toHaveLength(MOTIFS.length);
    MOTIFS.forEach(([nom, motif], i) => {
      expect(motif.test(FAUTIVES[i]!), nom).toBe(true);
    });
    expect(
      MOTIFS[0]![1].test('a: "Oui, nos consultants se déplacent à Beynes depuis Paris."'),
    ).toBe(true);
    expect(
      MOTIFS[0]![1].test('a: "Nous intervenons partout en France, sur place ou à distance."'),
    ).toBe(false);
  });

  for (const [nom, motif] of MOTIFS) {
    it(`aucune occurrence : ${nom}`, () => {
      expect(trouves(motif)).toEqual([]);
    });
  }
});

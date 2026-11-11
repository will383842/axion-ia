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
 * Passe finale : D (règle générale) et E (questions) remplacent les motifs ponctuels.
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
  [
    "D · règle générale « équipe/mission/… depuis <Ville> »",
    /(?:se déplac|déplacements?|interventions?|consultants?|équipe|experts?|Williams|[Nn]ous|accès rapide|missions?)[^."?]{0,80}depuis (?!le |la |les |l'|son |sa |votre |vos )[A-ZÉ]/u,
  ],
  [
    "E · question « Comment se passe/déroule une mission/intervention … depuis »",
    /Comment se (?:passe|déroule) une (?:mission|intervention)[^"?]* depuis /u,
  ],
  [
    "F · anglais « consultants/we … from Paris/<Ville> »",
    /(?:consultants|experts|[Ww]e|Williams)\b[^."]{0,80}\bfrom (?:Paris|[A-Z])/u,
  ],
  ["G · anglais « Travel (costs) from <Ville> »", /[Tt]ravel(?: costs)? (?:is )?from [A-Z]/u],
  ["H · « basé à Paris »", /basée?s? à Paris/u],
  ["I · « venir (directement) de <Ville> »", /venir (?:directement )?de [A-ZÉ]/u],
  ["J · « sont à N min de »", /sont à \d+ ?min d/u],
  [
    "K · consultants/Williams + trajet depuis Paris",
    /(?:consultants|Williams)[^."]{0,120}\(?(?:Paris \d|\d+ ?h ?\d* (?:de )?Paris|de Paris)/u,
  ],
  [
    "D2 · « depuis l'axe / l'aéroport »",
    /(?:Williams|[Nn]ous|consultants)[^.]{0,60}depuis l'(?:axe|aéroport)/u,
  ],
];

/**
 * Liste blanche étroite : faux positifs de la règle D qui décrivent le CLIENT, pas l'équipe.
 *   · « Vos équipes pilotent l'outil en autonomie depuis <Ville> » : équipes du client ;
 *   · « accès direct depuis Roissy-CDG » : accès du lieu pour le client (Villepinte).
 */
const LISTE_BLANCHE =
  /autonomie depuis|accès direct depuis Roissy|communes — from Madrillet|platforms, from RAG|experts from European|descended from Troyes|acceptance, from Parilly/u;

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
  [9, "Williams se déplace sur site depuis Nice ou Antibes."],
  [9, "Nous nous déplaçons depuis Salon-de-Provence vers Aix."],
  [9, "Couverture complète et accès rapide depuis Nice (30 min)."],
  [10, "Comment se déroule une intervention depuis Nantes ?"],
  [10, "Comment se passe une mission en Corse depuis le continent ?"],
  [17, "Nous nous déplaçons depuis l'axe Saint-Étienne–Lyon."],
  [17, "Williams se déplace sur site depuis l'aéroport de Nice."],
  [11, "Our consultants come from Paris every week."],
  [11, "We work from Lyon with you."],
  [12, "Travel is from Paris via RER C."],
  [12, "Travel costs from Paris listed separately."],
  [13, "(souvent moins, étant basé à Paris)"],
  [14, "permet à nos consultants de venir directement de Paris en 2h40"],
  [15, "Nos consultants sont à 5 min d'Avignon centre"],
  [16, "nos consultants y interviennent, à ~45 min de Paris"],
  [16, "Williams rejoint Rochefort en 3h30 de Paris"],
];

/** La liste blanche s'applique à la portion trouvée, pas à toute la ligne. */
function trouve(motif: RegExp, ligne: string): boolean {
  const m = motif.exec(ligne);
  return m !== null && !LISTE_BLANCHE.test(ligne.slice(m.index, m.index + m[0].length + 20));
}

function fautives(motif: RegExp): string[] {
  return TIERS.flatMap((nom) =>
    readFileSync(join(DOSSIER, nom), "utf8")
      .split("\n")
      .flatMap((ligne, i) => (trouve(motif, ligne) ? [`${nom}:${i + 1}`] : [])),
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

  it("la liste blanche ne masque que le client (une ligne saine, une ligne fautive)", () => {
    const sain = "Vos équipes pilotent l'outil en autonomie depuis Lille, sans verrou.";
    expect(MOTIFS[9]![1].test(sain)).toBe(true);
    expect(LISTE_BLANCHE.test(sain)).toBe(true);
    expect(LISTE_BLANCHE.test("Nos consultants se déplacent depuis Lille.")).toBe(false);
    expect(MOTIFS[9]![1].test("Nous intervenons partout en France, sur place ou à distance.")).toBe(
      false,
    );
  });

  for (const [nom, motif] of MOTIFS) {
    it(`aucun « ${nom} »`, () => {
      expect(fautives(motif)).toEqual([]);
    });
  }
});

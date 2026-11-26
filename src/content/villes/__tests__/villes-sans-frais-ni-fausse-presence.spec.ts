/**
 * Pages villes : aucun prix ni frais de déplacement (ils ne figurent que dans les
 * CGV), aucune fausse présence locale, aucun « Grenoble » hors de la page de Grenoble.
 * Lit les sources servies (copy, fiches locales, journee-ia-locale) ; commentaires ignorés.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "src", "content", "villes");
const SOURCES: ReadonlyArray<string> = [
  ...readdirSync(join(RACINE, "copy"))
    .filter((n) => n.endsWith(".ts") && n !== "types.ts" && !n.startsWith("_"))
    .map((n) => `copy/${n}`),
  ...readdirSync(join(RACINE, "fiches-locales"))
    .filter((n) => n.endsWith(".ts") && n !== "index.ts" && n !== "types.ts")
    .map((n) => `fiches-locales/${n}`),
  "journee-ia-locale.ts",
].sort();

const estCommentaire = (l: string) => /^\s*(\/\/|\/?\*)/.test(l);
const LIGNES = new Map(
  SOURCES.map((f) => [f, readFileSync(join(RACINE, f), "utf8").split("\n")] as const),
);

function fautes(motif: RegExp, exclure: (f: string) => boolean = () => false): string[] {
  const re = new RegExp(motif.source, motif.flags.replace("g", ""));
  const out: string[] = [];
  for (const [f, lignes] of LIGNES) {
    if (exclure(f)) continue;
    lignes.forEach((l, i) => {
      if (!estCommentaire(l) && re.test(l)) out.push(`${f}:${i + 1}`);
    });
  }
  return out;
}

const FRAIS: ReadonlyArray<readonly [string, RegExp]> = [
  [
    "déplacement inclus",
    /[Dd]éplacements?(?: sur site)?(?: est| sont)? (?:inclus|compris|offerts?|gratuits?)/u,
  ],
  ["compris dans la prestation", /déplacement[^".]{0,80}compris dans la prestation/u],
  [
    "frais de déplacement",
    /frais (?:de déplacement|de trajet|de route|de transport|kilométriques?|d['’]hébergement|de logement|de repas)|défraiement|indemnités? kilométriques?/iu,
  ],
  ["en sus", /\ben sus\b/u],
  [
    "supplément / surcoût géographique",
    /(?:supplément|surcoût) (?:géographique|de zone|de déplacement)/iu,
  ],
  [
    "tarif identique partout",
    /(?:tarifs?|grille|prix)[^".]{0,30}(?:identiques?|le même|les mêmes)[^".]{0,40}(?:partout|ailleurs|quel que soit)/iu,
  ],
  ["au même tarif", /au même tarif/u],
  [
    "hébergement local",
    /(?<!d['’]|fibre, )h[ée]bergement (?:local|possible)|multi-jours[^".]{0,20}h[ée]bergement/iu,
  ],
  [
    "surfacturation / majoration",
    /surfacturation g[ée]ographique|majoration sp[ée]cifique|co[uû]ts? logistiques?/iu,
  ],
  [
    "identiques selon la zone",
    /\bet identiques\b|identiques? (?:à|sur|en|quelle que soit|dans)\b[^".]{0,40}(?:commune|zone|ville|Gap|[Cc]ouronne|intra-muros|agglo)|identique quelle que soit/iu,
  ],
  [
    "prix + déplacement",
    /\{\{price:[^}]+\}\}[^".]{0,80}(?<!en )[Dd]éplacement(?! sur site)|(?<!en )[Dd]éplacement(?! sur site)[^".]{0,80}\{\{price:/u,
  ],
];

const PRESENCE: ReadonlyArray<readonly [string, RegExp]> = [
  [
    "consultants viennent de <Ville>",
    /[Nn]os consultants (?:seniors )?(?:viennent (?:de|depuis|d['’])|se déplacent[^."]{0,60}depuis|interviennent[^."]{0,40}depuis|rejoignent|arrivent (?:depuis|en \d))|(?:^|[ "(.])Consultants depuis [A-ZÉ]|Nous arrivons[^."]{0,30}depuis|consultants hors région/u,
  ],
  ["Williams depuis <Ville>", /Williams[^".]{0,60}depuis [A-ZÉ]/u],
  [
    "déplacement depuis <Ville>",
    /[Dd]éplacements? (?:rapide |direct |simple )?depuis (?!notre)[A-ZÉ]/u,
  ],
  ["notre base locale", /depuis notre base (?!nationale)|notre base [a-zé]+ise\b/u],
  ["lieux Axion-IA", /ateliers Axion-IA à|nos points de cadrage/u],
  [
    "basé à",
    /(?:Axion-IA|[Nn]ous|[Nn]otre (?:équipe|cabinet)|[Nn]os (?:consultants|équipes|experts)|Williams|étant)(?:(?!entreprises|clients|PME|ETI|groupe|commerces|structures)[^".]){0,40}\b(?:basée?s?|installée?s?|implantée?s?) (?:à|au|aux|sur|dans|en) (?!France)/u,
  ],
];

describe("villes · ni frais de déplacement, ni fausse présence, ni Grenoble", () => {
  it("les sources sont lues (garde contre un test vide)", () => {
    expect(SOURCES.filter((f) => f.startsWith("copy/")).length).toBeGreaterThan(2000);
  });

  it("les motifs sont vivants et épargnent les phrases justes", () => {
    expect(FRAIS[0]![1].test("Déplacement inclus dans l'agglo.")).toBe(true);
    expect(FRAIS[7]![1].test("Pour les multi-jours, hébergement local possible.")).toBe(true);
    expect(PRESENCE[0]![1].test("Nos consultants viennent de Lyon (20 min).")).toBe(true);
    const justes = [
      "Nous n’avons pas de bureau à Brest : nous venons dans votre entreprise.",
      "Nous intervenons partout en France, sur place ou à distance.",
      "Déplacement sur site ou sessions en visio.",
      "Cabinet IA francophone basé en France.",
    ].join(" ");
    for (const [, m] of [...FRAIS, ...PRESENCE]) expect(m.test(justes), String(m)).toBe(false);
  });

  for (const [nom, motif] of FRAIS)
    it(`aucune mention de frais ou de prix du déplacement : ${nom}`, () =>
      expect(fautes(motif)).toEqual([]));

  for (const [nom, motif] of PRESENCE)
    it(`aucune fausse présence locale : ${nom}`, () => expect(fautes(motif)).toEqual([]));

  it("« Grenoble » n'apparaît que sur la page de Grenoble", () => {
    expect(fautes(/Grenoble/u, (f) => f === "copy/grenoble.ts")).toEqual([]);
  });
});

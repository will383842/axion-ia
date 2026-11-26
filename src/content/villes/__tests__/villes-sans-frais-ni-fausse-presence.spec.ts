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
    "délai de déplacement après un prix",
    /\}\}[^"]{0,40}\. (?:Déplacement|Intervention)[^."]{0,40}sous \d+ jours/u,
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
  ["notre base locale", /depuis notre base|notre base [a-zé]+ise\b/u],
  [
    "origine des consultants",
    /(?<!et )[Cc]onsultants? (?:venant )?(?:de|depuis) [A-ZÉ]|se deplacent|(?:[Cc]onsultants?|[Ee]xperts?|Williams)[^."?]{0,100}(?:depuis|venant de) [A-ZÉ]|couvrez-vous depuis|couvertes par Axion-IA depuis|se déplace-t-il[^?]*depuis|visio depuis [A-ZÉ]|[Oo]n se déplace sur site depuis|arrivent (?:via|par|le matin|en une)|base nationale|logistique mission multi-jours/u,
  ],
  [
    "trajet de l'équipe (consultants via, accèdent, accessibles…)",
    /(?:[Nn]os consultants|[Nn]os intervenants|[Nn]otre équipe|[Nn]os équipes|[Cc]onsultants)(?:(?!\.\s)[^"]){0,80}\b(?:via|accèdent|accedent|accessibles?|arrivent (?:via|par|facilement|directement|en gare|en \d)|se déplacent (?:via|par|depuis)|viennent (?:via|par|depuis)|sont à [A-ZÉ][^".]{0,30} en \d|depuis|par la route)\b/u,
  ],
  [
    "trajet « nous … via la gare / l'autoroute »",
    /\b[Nn]ous (?:venons|nous déplaçons|couvrons|intervenons|rejoignons)[^".]{0,80}\bvia (?:le |la |l['’]|les |une? )?(?:gare|RER|tram|route|RN|A\d|N\d|autoroute|aéroport|TER|Transilien)|déplacements? via\b/u,
  ],
  ["nous rejoignons", /nous rejoignons/iu],
  ["Depuis <Ville>, nous", /\b[Dd]epuis [A-ZÉ][^".]{1,80}, nous\b/u],
  ["fragment Depuis <Ville> (N min)", /(?:^|[.!?"] )Depuis [A-ZÉ][^".]{1,40}\(\d[^)]*\)/u],
  ["Couvrez-vous … depuis", /couvrez-vous[^"?]{0,60}depuis/iu],
  ["consultants depuis", /consultants? depuis/iu],
  [
    "trajet gare/autoroute des consultants",
    /consultants?[^".]{0,60}(?:via|par) (?:la |l['’])?(?:gare|autoroute|aéroport|tramway|N\d|A\d)/iu,
  ],
  [
    "question de FAQ qui suppose une base ailleurs",
    /\bq: "[^"]*(?:intervention depuis [A-ZÉ]|accéder à [^"?]* depuis|accédez-vous|[Êê]tes-vous accessibles|[Cc]omment (?:se rendre|[A-ZÉ][^"?]* est-elle desservie)|[Cc]ouvrez-vous[^"?]* depuis|couvertes depuis|[Ii]ntervenez-vous [^"?]* depuis [A-ZÉ])/u,
  ],
  [
    "question sur le déplacement ou l'accès de l'équipe",
    /\bq: "[^"]*(?:[Cc]omment (?:se déplace|Axion-IA se déplace|Williams se déplace)|[Cc]omment [^"?]* est-elle accessible|[Pp]our vos consultants|distance entre)/u,
  ],
  [
    "trajet de l'équipe en train, avion ou RER",
    /(?:Williams|[Nn]os consultants|[Nn]otre équipe)[^."]{0,60}(?:prenn?ent|prend) (?:le |l['’])?(?:TGV|train|avion|RER)|(?:se déplace|[Dd]éplacement)[^."]{0,60}\b(?:via|par le (?:train|RER|TGV)|grâce au|en \d)/u,
  ],
  ["aux mêmes tarifs", /aux m[êe]mes tarifs/iu],
  ["phrase cassée par une suppression (« ,, » ou « , . »)", /,\s*,|,\s*\.|\s,/u],
  [
    "transport après « se déplace / kick-off / intervenons / intervient »",
    /(?:se déplac\w*|[Kk]ick-off|[Nn]ous intervenons|intervient|interviennent|déplacements?)[^."]{0,120}\b(?:RER|TGV|TER|gare|métro|autoroute|aéroport|A\d{1,3}|RN ?\d+|tram\w*|Transilien|périphérique|rocade)\b/u,
  ],
  ["Williams se déplace", /Williams se déplace/u],
  [
    "Proximité / proche d'un transport (phrase isolée)",
    /(?:^|[.!?"] )(?:À )?(?:[Pp]roximité|[Pp]roche)[^.]{0,60}\b(?:TGV|aéroport|gare|RER|autoroute|A\d{1,3})\b/u,
  ],
  [
    "question d'accès ou de trajet",
    /\bq: "[^"]*(?:[Cc]omment (?:venir|rejoindre|accéder|arriver)|[Tt]emps de trajet|[Cc]ombien de temps[^"?]* (?:pour venir|de trajet)|[Ee]st-il facile (?:de|d['’])(?:accéder|venir|rejoindre)|[Aa]ccès (?:à|depuis)|[Aa]ccessibilit|[Cc]omment se passe[^"?]* déplacement|[Cc]omment [^"?]* gère-t-elle les déplacements|vos déplacements|bien desservie|[Cc]omment rejoindre|[Cc]omment venez-vous|se déplacent?-(?:il|ils|elle)s?)/u,
  ],
  ["lieux Axion-IA", /ateliers Axion-IA à|nos points de cadrage/u],
  [
    "basé à",
    /(?:Axion-IA|[Nn]ous|[Nn]otre (?:équipe|cabinet)|[Nn]os (?:consultants|équipes|experts)|Williams|étant)(?:(?!entreprises|clients|PME|ETI|groupe|commerces|structures)[^".]){0,40}\b(?:basée?s?|installée?s?|implantée?s?) (?:à|au|aux|sur|dans|en) (?!France)/u,
  ],
];

/** Contenu métier : une phrase qui promet un livrable décrit la ville, pas un trajet de l'équipe. */
const PROTEGE =
  /accompagn|nous déployons|on (?:livre|développe|construit)|nous livrons|nous développons/u;

/** Réponses de FAQ (`a:`) : aucune phrase de trajet, de desserte ni de durée d'accès. */
const TRAJET_FAQ: ReadonlyArray<readonly [string, RegExp]> = [
  [
    "accès / desserte par un moyen de transport",
    /\b(?:[Aa]ccès|accessible|[Dd]esserte|desservi\w*)\b[^.]*\b(?:via|par|depuis|direct\w*|rapide|RER|TGV|TER|gare|tram\w*|métro|A\d{1,3}|autoroute|aéroport)\b/u,
  ],
  [
    "moyen de transport + durée, ou « nous permet / facilite »",
    /\b(?:RER|TGV|TER|gare|aéroport|tram\w*|métro|autoroute|A\d{1,3}|RN ?\d+)\b[^.]*(?:(?<![\p{L}\d])à \d+ ?(?:min|h)|\(\d+ ?(?:min|h)|nous permet|permettent|facilit)/u,
  ],
  [
    "durée d'accès",
    /^(?!.*(?:devis|séance|livrable|atelier|sous \d|24 ?(?:à|-) ?48|\b4 ?h(?:eures?)?\b|audit sur place)).*(?:(?<![\p{L}\d])(?:à|est à|sont à|en) \d+ ?(?:min\b|minutes|km)|(?<![\p{L}\d])(?:à|est à|sont à) \d+ ?h\d*\b|\(\d+ ?(?:min|h\d*)[^)]*\))/u,
  ],
  [
    "gare ou aéroport cité seul",
    /^(?:Gare|Aéroport|Proche (?:de l['’])?(?:aéroport|gare)|Proximité (?:directe )?(?:de l['’])?(?:aéroport|gare|Roissy|Orly))\b/u,
  ],
  ["rejoindre depuis", /(?:rejoindre|venues?|venir)[^.]*depuis [A-ZÉ]/u],
];

function fautesFaq(motif: RegExp): string[] {
  const out: string[] = [];
  for (const [f, lignes] of LIGNES) {
    if (!f.startsWith("copy/")) continue;
    lignes.forEach((l, i) => {
      const m = /^\s*a: "(.*)",?$/u.exec(l);
      if (
        m &&
        !/\b(?:Yes|We |Our |The |Axion-IA's)\b/u.test(m[1]!) &&
        m[1]!.split(/(?<=[.!?])\s+(?=[A-ZÉÀ«"])/u).some((p) => !PROTEGE.test(p) && motif.test(p))
      )
        out.push(`${f}:${i + 1}`);
    });
  }
  return out;
}

/** Échoue en listant TOUTES les fautes (fichier:ligne), sans troncature du diff. */
function vide(fautesTrouvees: string[]): void {
  if (fautesTrouvees.length > 0)
    throw new Error(`${fautesTrouvees.length} faute(s) :\n${fautesTrouvees.join("\n")}`);
}

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
    it(`aucune mention de frais ou de prix du déplacement : ${nom}`, () => vide(fautes(motif)));

  for (const [nom, motif] of PRESENCE)
    it(`aucune fausse présence locale : ${nom}`, () => vide(fautes(motif)));

  for (const [nom, motif] of TRAJET_FAQ)
    it(`réponses de FAQ sans trajet ni durée d'accès : ${nom}`, () => vide(fautesFaq(motif)));

  it("les réponses « devis » gardent leur délai (« 24 à 48 h ») : jamais moins que sur main", () => {
    const motif = /^\s*a: ".*24 ?(?:à|-) ?48/u;
    let n = 0;
    for (const [f, lignes] of LIGNES)
      if (f.startsWith("copy/")) n += lignes.filter((l) => motif.test(l)).length;
    expect(n).toBeGreaterThanOrEqual(712);
  });

  it("« Grenoble » n'apparaît que sur la page de Grenoble", () => {
    expect(fautes(/Grenoble/u, (f) => f === "copy/grenoble.ts")).toEqual([]);
  });
});

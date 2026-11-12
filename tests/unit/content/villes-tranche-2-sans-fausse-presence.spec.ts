/**
 * Cliquet · lot 2 sur 3 des textes de ville (`gerardmer.ts` → `parmain.ts`) :
 * plus de fausse présence locale.
 *
 * Axion-IA n'a ni bureau ni consultant basé localement : elle intervient
 * partout en France, sur place ou à distance. Les fichiers
 * `src/content/villes/copy/*.ts` passent AVANT la base : la phrase s'affiche
 * telle quelle.
 *
 * MÉTHODE (passe exhaustive du 2026-11-11). Cinq relectures ont trouvé, à
 * chaque fois, une forme nouvelle de la même faute entre les motifs d'une
 * liste qui s'allongeait. On ne rallonge plus la liste :
 *
 *  1. une RÈGLE LARGE, insensible à la casse, volontairement trop large ;
 *  2. une LISTE BLANCHE EXACTE : chaque ligne du lot qu'elle attrape doit
 *     avoir été JUGÉE à la main et déclarée LÉGITIME dans l'inventaire
 *     `docs/_AUDIT/villes-lot-2-inventaire-presence-2026-11-11.csv`
 *     (fichier + extrait exact, pas une regex) ;
 *  3. un PLAFOND de 0 : toute occurrence nouvelle, quelle que soit sa forme,
 *     fait rougir le test tant que personne ne l'a jugée.
 *
 * Le périmètre est borné PAR NOM de fichier : le lot 1 s'arrête à
 * `gentilly.ts`, le lot 3 commence à `parthenay.ts` ; ni chevauchement ni trou.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "src", "content", "villes", "copy");
const INVENTAIRE = join(
  process.cwd(),
  "docs",
  "_AUDIT",
  "villes-lot-2-inventaire-presence-2026-11-11.csv",
);

/** Premier fichier du lot 2 (le lot 1 finit à gentilly.ts). */
const PREMIER = "gerardmer.ts";
/** Premier fichier du lot 3 (exclu du lot 2). */
const SUIVANT = "parthenay.ts";

const TRANCHE = readdirSync(DOSSIER)
  .filter((nom) => nom.endsWith(".ts") && nom !== "types.ts" && !nom.startsWith("_"))
  .sort()
  .filter((nom) => nom >= PREMIER && nom < SUIVANT);

const TEXTES = new Map(TRANCHE.map((nom) => [nom, readFileSync(join(DOSSIER, nom), "utf8")]));

/**
 * (a) Règle large. Tout texte qui place l'équipe, un consultant, Williams ou
 * Axion-IA « depuis » un lieu, « à N min » d'une ville, « based in », « from
 * <Ville> … our consultants », ou qui parle de « vos locaux ».
 */
const REGLE_LARGE =
  /(?:d[ée]plac|consultants?|[ée]quipe|experts?|williams|axion|nous|on|acc[èe]s|couverture|couvr|visio|build|missions?|interventions?)[^."?]{0,160}depuis [A-ZÉ]|depuis [A-ZÉ][^,.]{0,60},\s*(?:on|nous)|sont? [àa] \d+ ?min(?:utes)? d|visio depuis [A-ZÉ]|vos locaux|based in|\bfrom (?:Paris|[A-Z][a-z]+)\b[^."]{0,40}(?:consultants?|we |our )/giu;

interface Regle {
  nom: string;
  motif: RegExp;
  /** Ne s'applique qu'aux lignes qui satisfont ce filtre (facultatif). */
  ligne?: RegExp;
  /** Tolérance zéro : aucune liste blanche, une occurrence est toujours fautive. */
  sansListeBlanche?: boolean;
  /** Lignes qui DOIVENT être reconnues (garde contre un motif mort). */
  fautives: readonly string[];
  /** Lignes voisines qui ne doivent PAS l'être. */
  saines: readonly string[];
}

const REGLES: readonly Regle[] = [
  {
    nom: "règle large (a)",
    motif: REGLE_LARGE,
    fautives: [
      "Nos experts IA se déplacent depuis Paris en 30 min.",
      "Démos hebdomadaires en visio depuis Oyonnax.",
      "Greffe IA sur l'existant ou build IA-native depuis le quartier du Fort.",
      "Depuis Lyon, nous couvrons tout le département.",
      "Nos consultants sont à 10 min de Nîmes centre.",
      "Atelier pratique dans vos locaux.",
      "Our consultants are based in Paris.",
      "From Paris our consultants travel to your site.",
    ],
    saines: [
      "Nous intervenons partout en France, sur place ou à distance.",
      "Lucé est à 5 min de Chartres.",
      "We work anywhere in France, on site or remotely.",
    ],
  },
  {
    nom: "« viennent d'… »",
    motif: /viennent d['’]/gu,
    fautives: ["Nos consultants viennent d'Aix-en-Provence, à 50 minutes."],
    saines: ["Les tarifs viennent de pricing.ts."],
  },
  {
    nom: "« Nos consultants sont à … »",
    motif: /[Nn]os (?:consultants|experts|équipes)(?: IA)? sont à (?:\d|[A-ZÉ])/gu,
    fautives: [
      "Nos consultants sont à 5 min de Brest centre.",
      "Nos consultants sont à Nantes en 12 min via le périphérique sud.",
    ],
    saines: ["Nos consultants sont disponibles sous 5 jours ouvrés."],
  },
  {
    nom: "« notre base »",
    motif: /notre base\b/gu,
    fautives: ["Accessibles depuis notre base nantaise."],
    saines: ["Connecté à nos bases documentaires."],
  },
  {
    nom: "« X-based » sur une ligne équipe",
    motif: /\b[A-Z][a-z]+-based\b/gu,
    ligne: /consultants?|team|\bwe\b/iu,
    fautives: ["Our consultants are Paris-based and travel across the city."],
    saines: ["Coaching of pilot profiles at a major Gard-based group."],
  },
  {
    nom: "« proximité de <Ville> permet/facilite »",
    motif:
      /(?:notre |la |our )?proximit[éy] (?:avec |de |du |to )[^."]{0,60}(?:facilit|permet|allow|makes)/giu,
    sansListeBlanche: true,
    fautives: [
      "La proximité de Lille permet un premier rendez-vous rapide sur site.",
      "Notre proximité avec Paris (16 km, RER D direct) facilite un cadrage rapide.",
      "Proximity to Lille allows a quick first on-site meeting.",
      "Our proximity to Paris makes a fast on-site scoping easy.",
    ],
    saines: [
      "Nous planifions un premier rendez-vous sur site, suivi d'un audit.",
      "Commerce de proximité & grande distribution",
      "Gonesse bénéficie d'une position stratégique à proximité immédiate de l'aéroport.",
    ],
  },
  {
    nom: "« Williams se déplace en/via/par … » ou frais kilométriques",
    motif: /Williams se déplace (?:en|via|par) |frais kilométriques/gu,
    sansListeBlanche: true,
    fautives: [
      "Williams se déplace en métro ligne 12 ou en RER C.",
      "Pas de frais kilométriques additionnels sur l'Île-de-France.",
      "Williams se déplace via l'A87.",
    ],
    saines: [
      "Williams se déplace sur site.",
      "Williams se déplace dans vos locaux pour cartographier vos processus.",
    ],
  },
  {
    // Relecture 7 : la desserte ou la position de la commune présentée comme
    // facilitant les déplacements de l'équipe, ou le trajet de l'équipe en
    // transport en commun. Tolérance zéro.
    nom: "« facilite nos déplacements » · accès/trajet de l'équipe",
    motif:
      /(?:facilit|rend)[^."]{0,20} (?:nos|les) (?:déplacements|interventions)|déplacements de nos consultants|accès direct (?:par les |métro)|Accès direct métro|rend l'accès rapide|accès s'effectue|Williams prend le |arrivent en une station|trajet est court|itérations à distance via|zone d'intervention principale|primary intervention zone|make on-site work easy|easily reached via|reachable (?:by|via) the/giu,
    sansListeBlanche: true,
    fautives: [
      "La gare RER E facilite nos interventions sur site.",
      "Ce qui facilite nos déplacements sur site dans toute la métropole.",
      "Cette desserte facilite les déplacements de nos consultants.",
      "Kick-off sur site, accès direct métro M4/M13.",
      "La desserte par les lignes 5 et 7 du métro et le RER E rend l'accès rapide.",
      "Williams prend le RER E pour intervenir sur site.",
      "Kick-off en présentiel, itérations à distance via le RER D.",
      "The kick-off takes place on site, easily reached via metro line 7.",
    ],
    saines: [
      "Nous intervenons partout en France, sur place ou à distance.",
      "Kick-off en présentiel à Laon, itérations à distance.",
      "Commune desservie par la ligne 7 du métro et le RER C.",
    ],
  },
  {
    nom: "« accédez-vous »",
    motif: /accédez-vous/gu,
    fautives: ["Comment accédez-vous au Pellerin pour vos interventions ?"],
    saines: ["Comment se déroule une intervention au Pellerin ?"],
  },
];

interface Ligne {
  fichier: string;
  ligne: number;
  extrait: string;
  verdict: "FAUTIF" | "LEGITIME";
  motif: string;
}

/** Lecture du CSV `;` à champs entre guillemets (guillemet doublé = guillemet). */
function lireInventaire(): Ligne[] {
  const brut = readFileSync(INVENTAIRE, "utf8");
  const enregistrements: string[][] = [];
  let champ = "";
  let ligne: string[] = [];
  let entre = false;
  for (let i = 0; i < brut.length; i++) {
    const c = brut[i];
    if (entre) {
      if (c === '"' && brut[i + 1] === '"') {
        champ += '"';
        i++;
      } else if (c === '"') entre = false;
      else champ += c;
    } else if (c === '"') entre = true;
    else if (c === ";") {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n") {
      ligne.push(champ);
      enregistrements.push(ligne);
      ligne = [];
      champ = "";
    } else champ += c;
  }
  const [entete, ...corps] = enregistrements;
  expect(entete).toEqual(["fichier", "ligne", "extrait", "verdict", "motif"]);
  return corps.map(([fichier = "", n = "", extrait = "", verdict = "", motif = ""]) => ({
    fichier,
    ligne: Number(n),
    extrait,
    verdict: verdict as Ligne["verdict"],
    motif,
  }));
}

const INVENTAIRE_LIGNES = lireInventaire();

/** Liste blanche EXACTE : extraits jugés LÉGITIMES, par fichier. */
const LISTE_BLANCHE = new Map<string, string[]>();
for (const l of INVENTAIRE_LIGNES) {
  if (l.verdict !== "LEGITIME") continue;
  LISTE_BLANCHE.set(l.fichier, [...(LISTE_BLANCHE.get(l.fichier) ?? []), l.extrait]);
}

function occurrences(regle: Regle): { ou: string; texte: string; blanchie: boolean }[] {
  const trouvees: { ou: string; texte: string; blanchie: boolean }[] = [];
  for (const [nom, texte] of TEXTES) {
    const blanche = regle.sansListeBlanche ? [] : (LISTE_BLANCHE.get(nom) ?? []);
    texte.split("\n").forEach((ligne, i) => {
      if (regle.ligne && !regle.ligne.test(ligne)) return;
      for (const m of ligne.matchAll(regle.motif)) {
        const blanchie = blanche.some((e) => ligne.startsWith(e, m.index));
        trouvees.push({ ou: `${nom}:${i + 1}`, texte: m[0].slice(0, 120), blanchie });
      }
    });
  }
  return trouvees;
}

describe("villes · lot 2/3 sans fausse présence locale", () => {
  it("le lot est borné par nom, sans chevauchement avec les lots 1 et 3", () => {
    expect(TRANCHE.length).toBeGreaterThan(600);
    expect(TRANCHE[0] && TRANCHE[0] >= PREMIER).toBe(true);
    expect(TRANCHE.at(-1)).toBe("parmain.ts");
    expect(TRANCHE).not.toContain("gentilly.ts");
    expect(TRANCHE).not.toContain(SUIVANT);
    expect(TRANCHE).not.toContain("types.ts");
    expect(TRANCHE.some((nom) => nom.startsWith("_"))).toBe(false);
  });

  for (const regle of REGLES) {
    const reconnue = (s: string) =>
      (!regle.ligne || regle.ligne.test(s)) && [...s.matchAll(regle.motif)].length > 0;

    it(`motif vivant · ${regle.nom}`, () => {
      for (const fautive of regle.fautives) expect(reconnue(fautive), fautive).toBe(true);
      for (const saine of regle.saines) expect(reconnue(saine), saine).toBe(false);
    });

    it(`plafond 0 hors liste blanche · ${regle.nom}`, () => {
      const nonJugees = occurrences(regle)
        .filter((o) => !o.blanchie)
        .map((o) => `${o.ou} · ${o.texte}`);
      expect(nonJugees).toEqual([]);
    });
  }

  describe("inventaire jugé ligne par ligne (CSV)", () => {
    it("chaque ligne de l'inventaire porte un verdict et un motif, dans le lot", () => {
      expect(INVENTAIRE_LIGNES.length).toBeGreaterThan(2000);
      for (const l of INVENTAIRE_LIGNES) {
        expect(TEXTES.has(l.fichier), l.fichier).toBe(true);
        expect(["FAUTIF", "LEGITIME"]).toContain(l.verdict);
        expect(l.motif.length, `${l.fichier}:${l.ligne}`).toBeGreaterThan(0);
        expect(l.extrait.length, `${l.fichier}:${l.ligne}`).toBeGreaterThan(0);
        expect(l.extrait.length).toBeLessThanOrEqual(120);
      }
    });

    it("anti-dérive : chaque extrait LÉGITIME existe encore tel quel dans son fichier", () => {
      const absents = INVENTAIRE_LIGNES.filter(
        (l) => l.verdict === "LEGITIME" && !TEXTES.get(l.fichier)?.includes(l.extrait),
      ).map((l) => `${l.fichier}:${l.ligne}`);
      expect(absents).toEqual([]);
    });

    it("aucun extrait FAUTIF n'est revenu dans son fichier", () => {
      const revenus = INVENTAIRE_LIGNES.filter(
        (l) => l.verdict === "FAUTIF" && TEXTES.get(l.fichier)?.includes(l.extrait),
      ).map((l) => `${l.fichier}:${l.ligne}`);
      expect(revenus).toEqual([]);
    });

    it("les cas connus de la relecture 5 sont inventoriés FAUTIF", () => {
      const fautifs = new Set(
        INVENTAIRE_LIGNES.filter((l) => l.verdict === "FAUTIF").map(
          (l) => `${l.fichier}:${l.ligne}`,
        ),
      );
      for (const cas of [
        "malakoff.ts:248",
        "nantes.ts:1045",
        "paris.ts:183",
        "manosque.ts:233",
        "oraison.ts:52",
        "laudun-l-ardoise.ts:52",
        "le-lion-d-angers.ts:68",
        "loire-authion.ts:68",
        "mauges-sur-loire.ts:68",
        "le-relecq-kerhuon.ts:52",
        "les-angles.ts:52",
        "les-clayes-sous-bois.ts:52",
        "les-sorinieres.ts:52",
        "marguerittes.ts:52",
        "milhaud.ts:52",
        "mougins.ts:52",
        "le-pellerin.ts:67",
        "le-pecq.ts:67",
        "le-pecq.ts:68",
        "le-vesinet.ts:67",
        "le-vesinet.ts:68",
        "les-ulis.ts:249",
      ]) {
        expect(fautifs.has(cas), cas).toBe(true);
      }
    });
  });
});

/**
 * Une réponse « communes proches » garde sa liste. Liste FIGÉE (autonome en
 * CI : aucune dépendance à `origin/main`) des réponses dont la liste a été
 * restaurée ou réécrite pendant le nettoyage du lot.
 */
const COMMUNES_ATTENDUES: readonly (readonly [string, readonly string[]])[] = [
  [
    "ivry-sur-seine.ts",
    ["Paris", "Charenton-le-Pont", "Alfortville", "Vitry-sur-Seine", "Villejuif"],
  ],
  ["lingolsheim.ts", ["Strasbourg", "Illkirch-Graffenstaden", "Ostwald", "Eckbolsheim"]],
  ["lagnieu.ts", ["Ambérieu-en-Bugey", "Belley", "Saint-Vulbas"]],
  ["les-mureaux.ts", ["Verneuil-sur-Seine", "Meulan-en-Yvelines", "Aubergenville"]],
  ["le-plessis-robinson.ts", ["Clamart", "Châtenay-Malabry", "Sceaux", "Antony"]],
  ["meudon.ts", ["Boulogne-Billancourt", "Sèvres", "Clamart", "Issy-les-Moulineaux", "Vélizy"]],
  ["marcq-en-bar-ul.ts", ["Lille", "Roubaix", "Tourcoing", "Villeneuve-d'Ascq"]],
  ["malakoff.ts", ["Vanves", "Montrouge", "Châtillon", "Clamart", "Bagneux"]],
  ["le-bouscat.ts", ["Bordeaux", "Bruges", "Eysines"]],
  ["meaux.ts", ["Chambry", "Crégy-lès-Meaux", "Trilport", "Villenoy"]],
  ["le-cannet.ts", ["Cannes", "Mougins", "Vallauris", "Mandelieu-la-Napoule"]],
  ["lievin.ts", ["Lens", "Avion", "Angres", "Bully-les-Mines", "Grenay"]],
  ["mont-de-marsan.ts", ["Saint-Pierre-du-Mont", "Saint-Avit", "Bretagne-de-Marsan"]],
  ["laval.ts", ["Changé", "Saint-Berthevin", "Bonchamp-lès-Laval", "Entrammes"]],
];

describe("villes · lot 2/3 · une réponse « communes proches » garde sa liste", () => {
  it("les fichiers figés sont bien dans le lot", () => {
    for (const [nom] of COMMUNES_ATTENDUES) expect(TEXTES.has(nom), nom).toBe(true);
  });

  for (const [nom, communes] of COMMUNES_ATTENDUES) {
    it(`${nom} : une réponse cite encore toutes ses communes voisines`, () => {
      const reponses = (TEXTES.get(nom) ?? "").split("\n").filter((l) => /^\s*a:\s*"/.test(l));
      expect(
        reponses.some((r) => communes.every((c) => r.includes(c))),
        communes.join(", "),
      ).toBe(true);
    });
  }
});

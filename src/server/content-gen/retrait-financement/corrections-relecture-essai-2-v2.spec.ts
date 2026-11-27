/**
 * Remarques non bloquantes 1, 2 et 3 de `geo/relectures/RELECTURE-CORRECTIFS-ESSAI-2-v2.md`
 * (axion-plans-prive, 20/11/2026), à traiter AVANT d'écrire la première entrée `admis` :
 *  1. le lexique dur porte aussi les formes écrites en toutes lettres (et le pluriel « plans de
 *     développement des compétences », dans les deux listes) ;
 *  2. le rapport imprime les PHRASES conservées, pas seulement les termes admis ;
 *  3. une entrée `admis` change l'empreinte du plan (`PLAN_SHA`).
 * Chaque test rougit si la correction qu'il vise est retirée.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  type LigneTraduction,
  type Overrides,
  type Proposition,
  appliquerOverrides,
  empreinte,
  empreintePlan,
  proposerTraduction,
} from "./plan";
import { INTERDITS_PUBLICS, LEXIQUE_DUR, normaliserPourPorte2, termesRefuses } from "./porte2";
import { construireRapport } from "./rapport";

const ID = "00000000-0000-4000-8000-0000000000c1";
const CLE = `article_translation:${ID}`;

const traduction = (surcharge: Partial<LigneTraduction> = {}): LigneTraduction => ({
  id: ID,
  locale: "fr",
  title: "Formation IA",
  excerpt: null,
  body: "<p>Bonjour.</p>",
  bodyJson: null,
  bodyText: "Bonjour.",
  metaTitle: null,
  metaDescription: null,
  ogImageAlt: null,
  ...surcharge,
});

function jouer(ligne: LigneTraduction, overrides: Overrides) {
  const p = proposerTraduction(ligne);
  if (!p) throw new Error("proposition attendue");
  return {
    avant: p,
    ...appliquerOverrides(p, ligne as unknown as Record<string, unknown>, overrides),
  };
}

const SERVICES = "Un atelier conçu pour les services financiers et les équipes RH.";

// ───────────────────────────── remarque 1 : formes en toutes lettres ─────────────────────────────

/** Phrases-sondes de la relecture (tableau « Cas où une vraie mention de financement peut rester »). */
const FORMES: Array<[forme: string, phrase: string]> = [
  ["OPCA", "Votre OPCA accompagne ces parcours."],
  ["opérateurs de compétences", "Les opérateurs de compétences accompagnent ces parcours."],
  [
    "compte personnel de formation",
    "Utilisez votre compte personnel de formation pour cet atelier.",
  ],
  ["mon compte formation", "Retrouvez cet atelier sur Mon Compte Formation."],
  ["Pôle emploi", "Parlez-en à votre conseiller Pôle emploi."],
  ["personal training account", "Use your personal training account for this workshop."],
  [
    "plans de développement des compétences",
    "Ces ateliers entrent dans les plans de développement des compétences.",
  ],
];

describe("remarque 1 — le lexique dur porte les formes en toutes lettres", () => {
  it.each(FORMES)(
    "« %s » : une entrée `admis` dont la VALEUR la contient est refusée (lexique dur)",
    (forme, phrase) => {
      const ligne = traduction({ excerpt: phrase });
      const r = jouer(ligne, {
        [CLE]: {
          excerpt: { origine: empreinte(phrase), valeur: phrase, admis: termesRefuses(phrase) },
        },
      });
      expect(r.ignores).toHaveLength(1);
      // « Mon Compte Formation » : le MOTEUR vise déjà la phrase (condition 2), le refus tombe avant le
      // lexique dur. Pour cette forme, le lexique dur est prouvé par le test « LISTE » ci-dessous.
      expect(r.ignores[0]).toContain(
        forme === "mon compte formation"
          ? "conservation sur décision refusée (un ambigu du moteur reste sur ce champ"
          : "conservation sur décision refusée (mot du lexique dur",
      );
      expect(r.proposition.ambigus).toEqual(r.avant.ambigus);
      expect(r.proposition.conservesSurDecision).toBeUndefined();
    },
  );

  it.each(FORMES)(
    "« %s » : une entrée `admis` dont la LISTE la contient est refusée, même si la valeur ne la contient pas",
    (forme) => {
      const ligne = traduction({ excerpt: SERVICES });
      const r = jouer(ligne, {
        [CLE]: {
          excerpt: { origine: empreinte(SERVICES), valeur: SERVICES, admis: ["financiers", forme] },
        },
      });
      expect(r.ignores).toHaveLength(1);
      expect(r.ignores[0]).toContain("mot du lexique dur");
      expect(r.proposition.ambigus).toHaveLength(1);
      expect(r.proposition.conservesSurDecision).toBeUndefined();
    },
  );

  it.each([
    "Opérateur de compétences",
    "operateurs de competences",
    "opérateurs-de-compétences",
    "compte-personnel-de-formation",
    "Compte Personnel de Formation",
    "MonCompteFormation",
    "mon-compte-formation",
    "pôle emploi",
    "Pole emploi",
    "Pôle-emploi",
    "Personal Training Account",
    "opca",
    "OPCAs",
    "OPCOs",
    "Pôle\nemploi",
    "personal\ntraining\naccount",
    "Plans de Développement des Compétences",
    "plans de developpement des competences",
    "plan de développement des compétences",
  ])("variante « %s » reconnue par le lexique dur", (variante) => {
    expect(LEXIQUE_DUR.test(normaliserPourPorte2(`Voir ${variante} ici.`))).toBe(true);
  });

  it("OPCAs : refusé par la porte 2 (INTERDITS_PUBLICS) comme OPCA, OPCO, OPCOs et O.P.C.O.", () => {
    for (const forme of ["OPCO", "OPCOs", "OPCA", "OPCAs", "O.P.C.O."])
      expect([forme, INTERDITS_PUBLICS.test(normaliserPourPorte2(`Voir ${forme} ici.`))]).toEqual([
        forme,
        true,
      ]);
  });

  it("une entrée `admis` dont la valeur BRUTE (href) contient un mot du lexique dur est refusée", () => {
    // « FNE » n'est dans le lexique dur que seul (le moteur ne vise que « FNE-Formation ») : seul le
    // contrôle de la valeur brute l'attrape, le texte visible (« voir ») est innocent.
    const valeur = `${SERVICES} <a href="https://exemple.fr/fne/x">voir</a>`;
    const r = jouer(traduction({ excerpt: valeur }), {
      [CLE]: { excerpt: { origine: empreinte(valeur), valeur, admis: ["financiers"] } },
    });
    expect(r.ignores).toHaveLength(1);
    expect(r.ignores[0]).toContain("mot du lexique dur");
    expect(r.proposition.conservesSurDecision).toBeUndefined();
  });

  it("href vers moncompteformation.gouv.fr : refusé aussi (le moteur vise déjà l'attribut)", () => {
    const valeur = `${SERVICES} <a href="https://www.moncompteformation.gouv.fr/x">voir</a>`;
    const r = jouer(traduction({ excerpt: valeur }), {
      [CLE]: { excerpt: { origine: empreinte(valeur), valeur, admis: ["financiers"] } },
    });
    expect(r.ignores).toHaveLength(1);
    expect(r.proposition.conservesSurDecision).toBeUndefined();
  });

  it("le pluriel « plans de développement des compétences » est refusé par la porte 2 (INTERDITS_PUBLICS)", () => {
    const phrase = "Ces ateliers entrent dans les plans de développement des compétences.";
    expect(INTERDITS_PUBLICS.test(normaliserPourPorte2(phrase))).toBe(true);
    expect(termesRefuses(phrase)).toEqual(["plans de développement des compétences"]);
    // Le singulier reste refusé, cité tel quel.
    expect(termesRefuses("À inscrire au plan de développement des compétences.")).toEqual([
      "plan de développement des compétences",
    ]);
  });

  it("le lexique dur ne s'étend pas aux faux positifs que la voie 2 doit pouvoir garder", () => {
    for (const t of [SERVICES, "Un emploi du temps chargé.", "Le compte rendu de la formation."])
      expect(LEXIQUE_DUR.test(normaliserPourPorte2(t))).toBe(false);
  });
});

// ───────────────────────────── remarque 2 : les phrases conservées dans le rapport ─────────────────────────────

const PHRASE_1 = "Un atelier conçu pour les services financiers et les équipes RH.";
const PHRASE_2 = "Les directions s'appuient sur des outils financiers partagés.";
/** Plus de 160 caractères : l'ambigu du filet coupe sa citation à 160. */
const PHRASE_LONGUE =
  "Dans les grandes organisations, les équipes qui préparent les clôtures mensuelles, les rapprochements et les tableaux de bord travaillent avec des outils financiers anciens, rarement reliés entre eux.";

describe("remarque 2 — le rapport imprime les phrases conservées, une par ligne", () => {
  it("un seul terme admis couvre DEUX phrases du champ : les deux sont imprimées sous la ligne", () => {
    const valeur = `${PHRASE_1} Une phrase sans rapport. ${PHRASE_2}`;
    const r = jouer(traduction({ excerpt: valeur }), {
      [CLE]: { excerpt: { origine: empreinte(valeur), valeur, admis: ["financiers"] } },
    });
    expect(r.ignores).toEqual([]);
    expect(r.proposition.ambigus).toEqual([]);
    expect(r.proposition.phrasesConservees).toEqual({
      excerpt: [
        `mention restante (porte 2 : financiers) : « ${PHRASE_1} »`,
        `mention restante (porte 2 : financiers) : « ${PHRASE_2} »`,
      ],
    });
    const lignes = construireRapport("dry-run", [r.proposition], r.ignores, "sha").split("\n");
    const i = lignes.indexOf(`- \`${CLE}\` · excerpt : termes admis : financiers`);
    expect(i).toBeGreaterThan(-1);
    expect(lignes.slice(i + 1, i + 3)).toEqual([
      `  - phrase conservée — mention restante (porte 2 : financiers) : « ${PHRASE_1} »`,
      `  - phrase conservée — mention restante (porte 2 : financiers) : « ${PHRASE_2} »`,
    ]);
    // La phrase sans terme refusé n'est pas listée.
    expect(lignes.filter((l) => l.includes("phrase conservée"))).toHaveLength(2);
  });

  it("une phrase de plus de 160 caractères est imprimée EN ENTIER, pas coupée comme dans l'ambigu", () => {
    expect(PHRASE_LONGUE.length).toBeGreaterThan(160);
    const r = jouer(traduction({ excerpt: PHRASE_LONGUE }), {
      [CLE]: {
        excerpt: {
          origine: empreinte(PHRASE_LONGUE),
          valeur: PHRASE_LONGUE,
          admis: ["financiers"],
        },
      },
    });
    expect(r.ignores).toEqual([]);
    expect(r.avant.ambigus[0]).not.toContain(PHRASE_LONGUE);
    const rapport = construireRapport("dry-run", [r.proposition], r.ignores, "sha");
    expect(rapport).toContain(
      `  - phrase conservée — mention restante (porte 2 : financiers) : « ${PHRASE_LONGUE} »`,
    );
  });

  it("deux champs conservés : chaque phrase est sous la ligne de SON champ", () => {
    const ligne = traduction({ excerpt: PHRASE_1, metaDescription: PHRASE_2 });
    const r = jouer(ligne, {
      [CLE]: {
        excerpt: { origine: empreinte(PHRASE_1), valeur: PHRASE_1, admis: ["financiers"] },
        metaDescription: { origine: empreinte(PHRASE_2), valeur: PHRASE_2, admis: ["financiers"] },
      },
    });
    expect(r.ignores).toEqual([]);
    const lignes = construireRapport("dry-run", [r.proposition], r.ignores, "sha").split("\n");
    const sous = (champ: string): string | undefined =>
      lignes[lignes.indexOf(`- \`${CLE}\` · ${champ} : termes admis : financiers`) + 1];
    expect(sous("excerpt")).toContain(PHRASE_1);
    expect(sous("metaDescription")).toContain(PHRASE_2);
  });

  it("une conservation refusée ne laisse aucune phrase conservée", () => {
    const valeur = "Votre OPCO connaît les services financiers.";
    const r = jouer(traduction({ excerpt: valeur }), {
      [CLE]: { excerpt: { origine: empreinte(valeur), valeur, admis: termesRefuses(valeur) } },
    });
    expect(r.ignores).toHaveLength(1);
    expect(r.proposition.phrasesConservees).toBeUndefined();
    expect(construireRapport("dry-run", [r.proposition], r.ignores, "sha")).not.toContain(
      "phrase conservée",
    );
  });
});

// ───────────────────────────── remarque 3 : `admis` change PLAN_SHA ─────────────────────────────

/** Formule de `main` avant cette PR (`plan.ts`, PR #2235) : (clé, valeurs après) triés, rien d'autre. */
function empreintePlanDeMain(propositions: readonly Proposition[]): string {
  const stable = [...propositions]
    .filter((p) => Object.keys(p.apres).length > 0)
    .sort((a, b) => a.cle.localeCompare(b.cle))
    .map((p) => [p.cle, p.apres]);
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

const prop = (cle: string, apres: Record<string, unknown>, plus = {}): Proposition => ({
  cle,
  table: "article_translation",
  id: cle.slice(cle.indexOf(":") + 1),
  avant: {},
  apres,
  ambigus: [],
  conserves: [],
  ...plus,
});

const PLAN: Proposition[] = [
  prop("article_translation:b", { title: "T" }),
  prop("article_translation:a", { excerpt: "E", body: "<p>x</p>" }),
  prop("article_translation:c", {}),
];

describe("remarque 3 — une entrée `admis` change l'empreinte du plan", () => {
  it("sans `admis`, l'empreinte est celle de main, à l'octet près (valeurs calculées sur main)", () => {
    expect(empreintePlan(PLAN)).toBe(
      "9e4b4a735ec57c70967af716b36a182026462a7a6234b4cfbacbc2b78d1c9be3",
    );
    expect(empreintePlan([])).toBe(
      "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    );
    expect(empreintePlan(PLAN)).toBe(empreintePlanDeMain(PLAN));
    // Un champ `conservesSurDecision` vide ne compte pas comme une conservation.
    expect(
      empreintePlan([...PLAN, prop("article_translation:d", {}, { conservesSurDecision: {} })]),
    ).toBe(empreintePlanDeMain(PLAN));
  });

  it("sans `admis`, un plan réel (moteur + override ordinaire) garde l'empreinte de main", () => {
    const ligne = traduction({
      excerpt: "Formation finançable par votre OPCO.",
      metaDescription: SERVICES,
    });
    const p = proposerTraduction(ligne);
    expect(p).not.toBeNull();
    expect(empreintePlan([p!])).toBe(empreintePlanDeMain([p!]));
  });

  it("avec une entrée `admis`, l'empreinte diffère de celle du même plan sans elle", () => {
    const ligne = traduction({ excerpt: SERVICES });
    const sans = jouer(ligne, {});
    const avec = jouer(ligne, {
      [CLE]: { excerpt: { origine: empreinte(SERVICES), valeur: SERVICES, admis: ["financiers"] } },
    });
    expect(avec.ignores).toEqual([]);
    expect(avec.proposition.apres).toEqual({});
    expect(empreintePlan([...PLAN, sans.proposition])).toBe(empreintePlanDeMain(PLAN));
    expect(empreintePlan([...PLAN, avec.proposition])).not.toBe(
      empreintePlan([...PLAN, sans.proposition]),
    );
    // Seule, sans aucune écriture : l'empreinte n'est plus celle du plan vide.
    expect(empreintePlan([avec.proposition])).not.toBe(empreintePlan([]));
  });

  it("l'empreinte dépend de la clé, du champ et des termes admis", () => {
    const e = (cle: string, c: Record<string, string[]>): string =>
      empreintePlan([...PLAN, prop(cle, {}, { conservesSurDecision: c })]);
    const base = e("article_translation:z", { excerpt: ["financiers"] });
    expect(e("article_translation:y", { excerpt: ["financiers"] })).not.toBe(base);
    expect(e("article_translation:z", { metaDescription: ["financiers"] })).not.toBe(base);
    expect(e("article_translation:z", { excerpt: ["financières"] })).not.toBe(base);
    expect(e("article_translation:z", { excerpt: ["financiers", "financier"] })).not.toBe(base);
    // Une conservation sur un contenu que le plan réécrit par ailleurs compte aussi.
    expect(
      empreintePlan([
        PLAN[0]!,
        { ...PLAN[1]!, conservesSurDecision: { title: ["financiers"] } },
        PLAN[2]!,
      ]),
    ).not.toBe(empreintePlan(PLAN));
  });

  it("l'ordre des entrées est sans effet (contenus, champs, termes)", () => {
    const a = prop(
      "article_translation:y",
      {},
      { conservesSurDecision: { excerpt: ["financiers"] } },
    );
    const b = prop(
      "article_translation:z",
      {},
      { conservesSurDecision: { excerpt: ["financiers", "financier"], title: ["financières"] } },
    );
    const bInverse = prop(
      "article_translation:z",
      {},
      { conservesSurDecision: { title: ["financières"], excerpt: ["financier", "financiers"] } },
    );
    const ref = empreintePlan([...PLAN, a, b]);
    expect(empreintePlan([b, a, ...PLAN])).toBe(ref);
    expect(empreintePlan([bInverse, ...[...PLAN].reverse(), a])).toBe(ref);
  });

  it("l'ordre des entrées du fichier d'overrides est sans effet", () => {
    const ligne = traduction({ excerpt: PHRASE_1, metaDescription: PHRASE_2 });
    const e1 = { origine: empreinte(PHRASE_1), valeur: PHRASE_1, admis: ["financiers"] };
    const e2 = { origine: empreinte(PHRASE_2), valeur: PHRASE_2, admis: ["financiers"] };
    const r1 = jouer(ligne, { [CLE]: { excerpt: e1, metaDescription: e2 } });
    const r2 = jouer(ligne, { [CLE]: { metaDescription: e2, excerpt: e1 } });
    expect(r1.ignores).toEqual([]);
    expect(Object.keys(r1.proposition.conservesSurDecision ?? {})).not.toEqual(
      Object.keys(r2.proposition.conservesSurDecision ?? {}),
    );
    expect(empreintePlan([r1.proposition])).toBe(empreintePlan([r2.proposition]));
  });
});

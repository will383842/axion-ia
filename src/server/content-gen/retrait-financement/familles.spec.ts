/**
 * PR B — générateur d'overrides par famille. Chaque fixture reprend un VRAI passage du rapport de
 * l'essai à blanc du 20/11/2026 (`geo/retrait/dry-run-2026-11-20/rapport.md`, axion-plans-prive) :
 * mêmes identifiants, mêmes textes (analyse `ANALYSE-DRY-RUN-RETRAIT-2026-11-20.md`).
 */
import { describe, expect, it } from "vitest";
import {
  type CasAmbigu,
  classerAmbigus,
  genererOverrides,
  lireRapport,
  refusReplacement,
  rendreALaMain,
  rendreLotAgent,
  rendreOverridesAuto,
} from "./familles";
import { appliquerOverrides, empreinte, type Overrides, type Proposition } from "./plan";
import { PHRASE_EN, PHRASE_FR, QUESTION_EN, QUESTION_FR } from "./phrases-standard";

/** Rend un bloc au format exact du rapport (`construireRapport`). */
function bloc(cle: string, champ: string, message: string, lignes: string[]): string {
  return (
    `- identifiant \`${cle}\` · champ \`${champ}\` : ${message}\n  - texte complet du passage :\n` +
    lignes.map((l) => `    > ${l}`).join("\n") +
    "\n"
  );
}
const rapport = (...blocs: string[]): CasAmbigu[] =>
  lireRapport(
    "# Retrait des mentions de financement — dry-run\n\n## Cas ambigus (à trancher dans `retrait-financement-overrides.json`)\n\n⛔ 856 ambigu(s) non couvert(s)\n\n" +
      blocs.join("\n") +
      "\n## « prise en charge » conservées (hors financement)\n\n## Hors périmètre (listés, non traités)\n- x\n",
  );
const FIN = "FAQ à relire (question de financement, réponse mêlée à un autre sujet)";
const ETR = "FAQ à relire (question étrangère au financement)";
const NP = "forme non prouvée (hors « A, B et X. », parenthèse, phrase entière)";

// ── F1 : FAQ de financement dont toutes les phrases sont visées ─────────────────────────────
const Q1 = "Comment financer ma formation en prompt engineering ?";
const R1 =
  "Vous pouvez utiliser votre Compte Personnel de Formation (CPF) ou bénéficier de l'Aide Individuelle à la Formation (AIF) de France Travail.";
const Q1b = "Quels financements sont disponibles pour un audit IA ?";
const R1b =
  "Les entreprises peuvent explorer des financements via les OPCO, France Travail (AIF) et le plan de développement des compétences de l'entreprise pour soutenir leur audit IA.";
const fixtureF1 = () =>
  rapport(
    bloc("article:40fde4bb-2aed-4955-8085-6640c5cfdb13", "faqJson", `${FIN} : « ${Q1} »`, [Q1]),
    bloc("faq:4787d956-5967-4111-a7e7-c3b5057cab8a", "answerFr", `${FIN} : « ${Q1} »`, [R1]),
    bloc("faq:4787d956-5967-4111-a7e7-c3b5057cab8a", "answerEn", `${FIN} : « ${Q1} »`, [R1]),
    bloc("faq:65119f21-4d83-4c28-a352-cac2cb0fa73b", "answerFr", `${FIN} : « ${Q1b} »`, [R1b]),
    bloc("faq:65119f21-4d83-4c28-a352-cac2cb0fa73b", "answerEn", `${FIN} : « ${Q1b} »`, [R1b]),
  );

// ── F2 : FAQ de financement, réponse mêlée ───────────────────────────────────────────────────
const Q2 = "Une formation IA peut-elle être financée par un OPCO ou le CPF ?";
const R2 =
  "Oui, sous conditions. Les formations dispensées par des organismes référencés auprès de France Compétences peuvent être prises en charge via le CPF (Compte Personnel de Formation) ou via les OPCO (opérateurs de compétences sectoriels). La CCI Le Mans Sarthe peut vous orienter vers les dispositifs adaptés à votre taille et votre convention collective. Il est recommandé de vérifier l'éligibilité avant de démarrer toute démarche.";
const fixtureF2 = () =>
  rapport(
    bloc("faq:0cf66f68-ab75-4782-b9c2-e7880a11195b", "answerFr", `${FIN} : « ${Q2} »`, [R2]),
    bloc("faq:0cf66f68-ab75-4782-b9c2-e7880a11195b", "answerEn", `${FIN} : « ${Q2} »`, [R2]),
    bloc("article:b1d1be62-3c1b-4b93-8cf4-9ff7b2df5170", "faqJson", `${FIN} : « ${Q2} »`, [Q2]),
  );

// ── F3 : question étrangère au financement, phrase « forme non prouvée » ────────────────────
const Q3 = "Quelle est la différence entre un atelier IA et une formation IA certifiante ?";
const R3 =
  "Une formation certifiante est encadrée par France Compétences, implique un programme défini, une évaluation et peut être financée via les OPCO. Un atelier IA est un format opérationnel non certifiant, plus court et plus agile. Il vise à produire une compétence immédiatement applicable au poste de travail, sans démarche administrative préalable. Les deux formats sont complémentaires : l'atelier précède souvent un parcours plus long.";
const P3 =
  "Une formation certifiante est encadrée par France Compétences, implique un programme défini, une évaluation et peut être financée via les OPCO.";
const fixtureF3 = () =>
  rapport(
    bloc("faq:0d80ab5d-3714-4fc8-bd2c-585e5300276a", "answerFr", `${NP} : « ${P3} »`, [R3]),
    bloc("faq:0d80ab5d-3714-4fc8-bd2c-585e5300276a", "answerFr", `${ETR} : « ${Q3} »`, [R3]),
  );

// ── F4 : sections de titre « financement » ───────────────────────────────────────────────────
const T4 = "La formation IA est-elle éligible à des financements ?";
const S4 =
  "Oui, elle peut être financée par les OPCO, France Travail (AIF) et le plan de développement des compétences de l'entreprise.";
const MSG4 = (t: string) => `section « ${t} » : financement mêlé à un autre sujet, à relire`;
const fixtureF4 = () =>
  rapport(
    bloc("article_translation:b5efbe69-5863-40f7-b447-144c026e4253", "body", MSG4(T4), [
      "Formation IA : le guide",
      "Une introduction sans rapport avec le sujet traité ici.",
      T4,
      S4,
      "Comment démarrer ?",
      "Commencez par un Diagnostic IA de 45 minutes.",
    ]),
  );
const TM = "Financement et éligibilité OPCO";
const fixtureF4Mele = () =>
  rapport(
    bloc("article_translation:1b1f79fe-3495-4725-98d8-d1c571dde0f9", "body", MSG4(TM), [
      "Formation IA Boulogne-Billancourt : accompagner vos équipes pas à pas",
      TM,
      "Les formations professionnelles sont encadrées par France Compétences, l'organisme public qui régule la qualité et le financement de la formation professionnelle en France. Selon votre statut et votre OPCO de rattachement, une partie ou la totalité de la formation peut être prise en charge. Nous vous guidons dans ces démarches administratives.",
      "Scénario concret : une agence de communication à Boulogne-Billancourt",
      "Une agence de communication de dix personnes a formé l'ensemble de ses équipes en deux journées.",
    ]),
  );

// ── F5/F6 : phrase « forme non prouvée » dans / hors d'une section ───────────────────────────
const P6 =
  "Des financements peuvent être disponibles via les OPCO ou le plan de développement des compétences de l'entreprise.";
const fixtureF6 = () =>
  rapport(
    bloc("article_translation:88beba14-4918-410c-8e53-f0fdee09be27", "body", `${NP} : « ${P6} »`, [
      "Séminaire IA pour dirigeants : objectifs",
      "Tarifs et inscription",
      "Les tarifs du séminaire sont disponibles sur demande. Contactez-nous pour plus de détails.",
      `Pour connaître les tarifs, veuillez consulter notre page Tarifs. ${P6}`,
      "Sources",
    ]),
  );
const P5 =
  "Renseignez-vous auprès de votre OPCO avant de vous engager sur un financement pour une formation IA non certifiante.";
// Format RÉEL du rapport : le cas « section » imprime l'article, le cas « phrase » le seul paragraphe.
const fixtureF5 = () =>
  rapport(
    bloc("article_translation:1b1f79fe-3495-4725-98d8-d1c571dde0f9", "body", MSG4(TM), [
      TM,
      "Selon votre statut et votre OPCO de rattachement, la formation peut être prise en charge. Nous vous guidons dans ces démarches administratives.",
      P5,
      "Scénario concret",
    ]),
    bloc(
      "article_translation:1b1f79fe-3495-4725-98d8-d1c571dde0f9",
      "body",
      `phrase mixte sans coupure propre : « ${P5} »`,
      [P5],
    ),
  );

// ── F7 : cas durs ────────────────────────────────────────────────────────────────────────────
const fixtureF7 = () =>
  rapport(
    bloc(
      "article_translation:603759e3-7ca5-475c-8c64-fd4d899466e5",
      "body",
      "tableau : ligne mêlant financement et autre contenu, à relire : « Financement OPCO ⚠️ Non ✅ partiel ✅ Oui ⚠️ Variable ✅ Oui »",
      ["Financement OPCO ⚠️ Non ✅ partiel ✅ Oui ⚠️ Variable ✅ Oui"],
    ),
    bloc(
      "article:84c12833-cb60-45bd-8b31-7f89cbbf8b63",
      "directAnswer",
      `${NP} : « La formation intelligence artificielle en entreprise à Grenoble dure en moyenne 3 à 5 jours (21 à 35 heures), peut être financée via les OPCO et le CPF, et s'ad »`,
      [
        "La formation intelligence artificielle en entreprise à Grenoble dure en moyenne 3 à 5 jours (21 à 35 heures), peut être financée via les OPCO et le CPF, et s'adapte à votre secteur.",
      ],
    ),
    bloc(
      "article_translation:a1032a62-94bb-4e67-a70e-e934c9571605",
      "body",
      "verrou : réécriture annulée, mots non financiers retirés (viables, alleger, formations) : « Qu'est-ce que la formation IA à Bagnolet ? La formation IA à Bagnolet vise à doter les entreprises locales des compétenc »",
      ["Qu'est-ce que la formation IA à Bagnolet ?"],
    ),
  );

const famillesDe = (cas: CasAmbigu[]) =>
  classerAmbigus(cas).map((c) => `${c.cas.cle}.${c.cas.champ}=${c.famille}`);

describe("lireRapport", () => {
  it("lit identifiant, champ, message et texte complet de chaque bloc", () => {
    const cas = fixtureF1();
    expect(cas).toHaveLength(5);
    expect(cas[1]).toMatchObject({
      cle: "faq:4787d956-5967-4111-a7e7-c3b5057cab8a",
      table: "faq",
      id: "4787d956-5967-4111-a7e7-c3b5057cab8a",
      champ: "answerFr",
      passage: R1,
    });
    expect(cas[1]!.message).toContain(Q1);
  });
  it("ignore ce qui précède et suit la section des cas ambigus", () => {
    expect(rapport()).toHaveLength(0);
  });
});

describe("classement — les 7 familles", () => {
  it("F1 : FAQ de financement dont toutes les phrases sont visées (fille + élément faqJson du parent)", () => {
    expect(famillesDe(fixtureF1())).toEqual([
      "article:40fde4bb-2aed-4955-8085-6640c5cfdb13.faqJson=F1",
      "faq:4787d956-5967-4111-a7e7-c3b5057cab8a.answerFr=F1",
      "faq:4787d956-5967-4111-a7e7-c3b5057cab8a.answerEn=F1",
      "faq:65119f21-4d83-4c28-a352-cac2cb0fa73b.answerFr=F1",
      "faq:65119f21-4d83-4c28-a352-cac2cb0fa73b.answerEn=F1",
    ]);
  });
  it("F2 : FAQ de financement à réponse mêlée (une phrase non visée)", () => {
    expect(famillesDe(fixtureF2())).toEqual([
      "faq:0cf66f68-ab75-4782-b9c2-e7880a11195b.answerFr=F2",
      "faq:0cf66f68-ab75-4782-b9c2-e7880a11195b.answerEn=F2",
      "article:b1d1be62-3c1b-4b93-8cf4-9ff7b2df5170.faqJson=F2",
    ]);
  });
  it("F3 : question étrangère au financement, réponse avec phrase « forme non prouvée »", () => {
    expect(famillesDe(fixtureF3())).toEqual([
      "faq:0d80ab5d-3714-4fc8-bd2c-585e5300276a.answerFr=F3",
      "faq:0d80ab5d-3714-4fc8-bd2c-585e5300276a.answerFr=F3",
    ]);
  });
  it("F4 : section titrée sur le financement", () => {
    expect(famillesDe(fixtureF4())).toEqual([
      "article_translation:b5efbe69-5863-40f7-b447-144c026e4253.body=F4",
    ]);
    expect(famillesDe(fixtureF4Mele())).toEqual([
      "article_translation:1b1f79fe-3495-4725-98d8-d1c571dde0f9.body=F4",
    ]);
  });
  it("F5 : phrase dans une section F4 du même contenu ; F6 : phrase hors section", () => {
    expect(famillesDe(fixtureF5())).toEqual([
      "article_translation:1b1f79fe-3495-4725-98d8-d1c571dde0f9.body=F4",
      "article_translation:1b1f79fe-3495-4725-98d8-d1c571dde0f9.body=F5",
    ]);
    expect(famillesDe(fixtureF6())).toEqual([
      "article_translation:88beba14-4918-410c-8e53-f0fdee09be27.body=F6",
    ]);
  });
  it("F7 : tableau, champ court (directAnswer), verrou", () => {
    expect(famillesDe(fixtureF7())).toEqual([
      "article_translation:603759e3-7ca5-475c-8c64-fd4d899466e5.body=F7",
      "article:84c12833-cb60-45bd-8b31-7f89cbbf8b63.directAnswer=F7",
      "article_translation:a1032a62-94bb-4e67-a70e-e934c9571605.body=F7",
    ]);
  });
  it("faqJson dont la question n'a pas de FAQ fille connue : jamais F1 (on ne devine pas)", () => {
    const cas = rapport(
      bloc("article:b1d1be62-3c1b-4b93-8cf4-9ff7b2df5170", "faqJson", `${FIN} : « ${Q1} »`, [Q1]),
    );
    expect(famillesDe(cas)).toEqual(["article:b1d1be62-3c1b-4b93-8cf4-9ff7b2df5170.faqJson=F2"]);
  });
});

describe("F1 — Q/R standard dans les trois stockages", () => {
  const s = genererOverrides(fixtureF1());
  it("la FAQ fille reçoit question ET réponse standard, FR et EN (answerEn suit answerFr)", () => {
    const f = s.auto.filter((e) => e.contenu === "faq:4787d956-5967-4111-a7e7-c3b5057cab8a");
    expect(f.map((e) => `${e.champ}→${e.remplacement}`).sort()).toEqual(
      [
        `answerEn→${PHRASE_EN}`,
        `answerFr→${PHRASE_FR}`,
        `questionEn→${QUESTION_EN}`,
        `questionFr→${QUESTION_FR}`,
      ].sort(),
    );
    expect(f.every((e) => e.famille === "F1" && e.portee === "champ-entier")).toBe(true);
    expect(f.find((e) => e.champ === "answerFr")!.origine).toBe(R1);
    expect(f.find((e) => e.champ === "questionFr")!.origine).toBe(Q1);
  });
  it("l'élément faqJson du parent reçoit la MÊME Q/R, avec la réponse d'origine de la fille", () => {
    const e = s.auto.find((x) => x.contenu === "article:40fde4bb-2aed-4955-8085-6640c5cfdb13")!;
    expect(e).toMatchObject({
      champ: "faqJson",
      portee: "element-faqJson",
      origine: Q1,
      remplacement: QUESTION_FR,
      reponseOrigine: R1,
      reponseRemplacement: PHRASE_FR,
    });
  });
  it("chaque entrée porte sa raison, sa famille et les mots non financiers perdus", () => {
    for (const e of s.auto) {
      expect(e.raison.length).toBeGreaterThan(10);
      expect(e.pertesAcceptees).toBeInstanceOf(Array);
    }
    const r = s.auto.find(
      (x) => x.champ === "answerFr" && x.contenu.endsWith("4787d956-5967-4111-a7e7-c3b5057cab8a"),
    )!;
    expect(r.pertesAcceptees).toEqual(expect.arrayContaining(["utiliser", "beneficier"]));
  });
  it("n'invente rien : F2 et F3 ne produisent AUCUNE proposition", () => {
    const g = genererOverrides([...fixtureF2(), ...fixtureF3()]);
    expect(g.auto).toEqual([]);
    expect(g.agent.map((c) => c.famille).sort()).toEqual(["F2", "F2", "F2", "F3", "F3"]);
  });
});

describe("F4 — section 100 % financement", () => {
  it("le titre et la section jusqu'au titre suivant deviennent la phrase standard", () => {
    const s = genererOverrides(fixtureF4());
    expect(s.auto).toHaveLength(1);
    expect(s.auto[0]).toMatchObject({
      contenu: "article_translation:b5efbe69-5863-40f7-b447-144c026e4253",
      champ: "body",
      famille: "F4",
      portee: "zone",
      origine: `${T4}\n${S4}`,
      remplacement: PHRASE_FR,
      zoneEstimee: true,
    });
    expect(s.auto[0]!.consignes.join(" ")).toMatch(/sommaire|ancre/i);
    expect(s.auto[0]!.pertesAcceptees).toEqual(expect.any(Array));
  });
  it("section mêlée (phrase non financière) : lot de l'agent, aucune proposition", () => {
    const s = genererOverrides(fixtureF4Mele());
    expect(s.auto).toEqual([]);
    expect(s.agent.map((c) => c.famille)).toEqual(["F4"]);
  });
  it("une phrase F5 d'une section F4 n'a pas de ligne propre (elle disparaît avec la section)", () => {
    const s = genererOverrides(fixtureF5());
    expect(s.agent.map((c) => c.famille)).toEqual(["F4"]);
    expect(s.aLaMain).toEqual([]);
  });
});

describe("F6 et F7", () => {
  it("F6 : lot de l'agent, avec le passage d'origine et sans proposition", () => {
    const s = genererOverrides(fixtureF6());
    expect(s.auto).toEqual([]);
    expect(s.agent).toHaveLength(1);
    const l = JSON.parse(rendreLotAgent(s).trim().split("\n")[0]!);
    expect(l).toMatchObject({
      cle: "article_translation:88beba14-4918-410c-8e53-f0fdee09be27",
      champ: "body",
      famille: "F6",
    });
    expect(l.passage).toContain(P6);
    expect(l.apres).toBeUndefined();
    expect(l.remplacement).toBeUndefined();
  });
  it("F7 : liste « à la main », sans proposition inventée", () => {
    const s = genererOverrides(fixtureF7());
    expect(s.auto).toEqual([]);
    expect(s.agent).toEqual([]);
    expect(s.aLaMain.map((c) => c.famille)).toEqual(["F7", "F7", "F7"]);
    const md = rendreALaMain(s);
    expect(md).toContain("article:84c12833-cb60-45bd-8b31-7f89cbbf8b63");
    expect(md).toContain("directAnswer");
    expect(md).toContain("Financement OPCO");
    expect(md).not.toContain(PHRASE_FR);
  });
});

describe("porte des interdits — remplacements", () => {
  it("les phrases standard (inchangées) passent", () => {
    for (const t of [PHRASE_FR, PHRASE_EN, QUESTION_FR, QUESTION_EN])
      expect(refusReplacement(t)).toBeNull();
  });
  it.each([
    "Qualiopi",
    "OPCO",
    "Opérateurs de Compétences",
    "CPF",
    "France Travail",
    "financement",
    "prise en charge",
    "prises en charge",
    "Grenoble",
    "appel de cadrage",
    "Aucun gain garanti",
  ])("refuse « %s »", (mot) => {
    expect(refusReplacement(`Voir ${mot} ici.`)).not.toBeNull();
  });
  it("tous les remplacements générés passent la porte, ET la porte existante de plan.ts (appliquerOverrides)", () => {
    const s = genererOverrides([...fixtureF1(), ...fixtureF4()]);
    expect(s.auto.length).toBeGreaterThan(0);
    for (const e of s.auto) {
      expect(refusReplacement(e.remplacement)).toBeNull();
      if (e.reponseRemplacement) expect(refusReplacement(e.reponseRemplacement)).toBeNull();
    }
    // Les entrées « champ entier » (FAQ filles) sont rejouées dans le vrai `appliquerOverrides`.
    for (const e of s.auto.filter((x) => x.portee === "champ-entier")) {
      const p: Proposition = {
        cle: e.contenu,
        table: "faq",
        id: e.contenu.split(":")[1]!,
        avant: { [e.champ]: e.origine },
        apres: {},
        ambigus: [`${e.contenu}.${e.champ} : FAQ à relire`],
        conserves: [],
      };
      const o: Overrides = {
        [e.contenu]: {
          [e.champ]: {
            origine: empreinte(e.origine),
            valeur: e.remplacement,
            pertesAcceptees: e.pertesAcceptees,
          },
        },
      };
      const r = appliquerOverrides(p, { [e.champ]: e.origine }, o);
      expect(r.ignores).toEqual([]);
      expect(r.proposition.apres[e.champ]).toBe(e.remplacement);
    }
  });
  it("sans pertesAcceptees, la porte « mots perdus » refuserait (preuve que la liste est nécessaire)", () => {
    const s = genererOverrides(fixtureF1());
    const e = s.auto.find((x) => x.champ === "answerFr")!;
    expect(e.pertesAcceptees.length).toBeGreaterThan(0);
  });
});

describe("déterminisme et sorties", () => {
  it("deux passes sur le même rapport donnent des sorties identiques octet pour octet", () => {
    const a = genererOverrides([...fixtureF1(), ...fixtureF4(), ...fixtureF6(), ...fixtureF7()]);
    const b = genererOverrides([...fixtureF7(), ...fixtureF6(), ...fixtureF4(), ...fixtureF1()]);
    expect(rendreOverridesAuto(a)).toBe(rendreOverridesAuto(b));
    expect(rendreLotAgent(a)).toBe(rendreLotAgent(b));
    expect(rendreALaMain(a)).toBe(rendreALaMain(b));
  });
  it("overrides-auto.json : un objet par champ, tous les attributs demandés, aucune sortie sans origine", () => {
    const j = JSON.parse(rendreOverridesAuto(genererOverrides(fixtureF1())));
    expect(Array.isArray(j.overrides)).toBe(true);
    for (const e of j.overrides) {
      for (const k of ["contenu", "champ", "origine", "remplacement", "famille", "raison"])
        expect(typeof e[k]).toBe("string");
      expect(e.origine.length).toBeGreaterThan(0);
    }
  });
  it("une même (contenu, champ, passage) n'apparaît qu'une fois", () => {
    const s = genererOverrides([...fixtureF1(), ...fixtureF1()]);
    const cles = s.auto.map((e) => `${e.contenu}|${e.champ}|${e.origine}`);
    expect(new Set(cles).size).toBe(cles.length);
  });
});

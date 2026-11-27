/**
 * Corrections de l'audit Opus (6e passe, `AUDIT-PR-2170-passe6.md`) : le principe « formes
 * prouvées » tient sur TOUS les chemins (puces HTML/JSON, énumérations dont l'élément est un vrai
 * service, phrases mixtes dans un corps), les overrides sales sont ignorés, un avantage ambigu
 * n'est jamais supprimé en silence. Chaque test échouait avant la correction.
 */
import { describe, expect, it } from "vitest";
import {
  appliquerOverrides,
  empreinte,
  proposerOffre,
  reecrirePerks,
  type Proposition,
} from "./plan";
import {
  capterRegles,
  classer,
  motsNonRetirables,
  reecrireFaq,
  reecrireHtml,
  reecrireJson,
  reecrireTexte,
  type Langue,
  type Resultat,
} from "./regles";

const ambiguStrict = (r: Resultat<unknown>, origine: unknown) => {
  expect(classer(r)).toBe("ambigu");
  expect(r.modifie).toBe(false);
  expect(r.valeur).toEqual(origine);
};

// ───────────────── 2.1 puces ─────────────────

describe("2.1 puce visée : jamais retirée sans analyse", () => {
  const strong =
    "<ul><li>Audit.</li><li><strong>Formation sur mesure de 3 jours</strong> et accompagnement, finançable par votre OPCO</li><li>Suivi.</li></ul>";

  it("puce avec balise en ligne et service réel → ambiguë (HTML)", () => {
    ambiguStrict(reecrireHtml(strong, "fr"), strong);
  });

  it("même contenu en JSON Tiptap → même verdict que le HTML", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Audit." }] }],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      marks: [{ type: "bold" }],
                      text: "Formation sur mesure de 3 jours",
                    },
                    { type: "text", text: " et accompagnement, finançable par votre OPCO" },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Suivi." }] }],
            },
          ],
        },
      ],
    };
    ambiguStrict(reecrireJson(doc, "fr"), doc);
  });

  it("puce sans balise « Formation de deux jours éligible au CPF. » → ambiguë, la puce reste", () => {
    const html =
      "<ul><li>Audit.</li><li>Formation de deux jours éligible au CPF.</li><li>Suivi.</li></ul>";
    ambiguStrict(reecrireHtml(html, "fr"), html);
  });

  it("puce PURE (sujet = financement) : toujours retirée", () => {
    const r = reecrireHtml(
      "<ul><li>Audit.</li><li>Le financement OPCO est possible.</li><li>Suivi.</li></ul>",
      "fr",
    );
    expect(r.ambigus).toEqual([]);
    expect(r.valeur).toBe("<ul><li>Audit.</li><li>Suivi.</li></ul>");
  });

  it("point 8 : puce seulement ambiguë → modifie=false, message non dupliqué", () => {
    const html =
      "<ul><li>Audit.</li><li>Formation de deux jours éligible au CPF.</li><li>Suivi.</li></ul>";
    const r = reecrireHtml(html, "fr");
    expect(r.modifie).toBe(false);
    expect(new Set(r.ambigus).size).toBe(r.ambigus.length);
  });
});

// ───────────────── 2.2 énumérations ─────────────────

describe("2.2 énumération : un service réel qualifié par une mention n'est jamais retiré", () => {
  it.each([
    "Nous proposons audit, formation éligible au CPF et suivi.",
    "Nous proposons audit, conseil, formation et accompagnement certifié Qualiopi.",
    "Vous recevez audit, formation, accompagnement Qualiopi et suivi.",
  ])("%s", (entree) => {
    ambiguStrict(reecrireTexte(entree, "fr"), entree);
  });

  it("élément dont le premier mot plein est un mot de financement : toujours retiré", () => {
    const r = reecrireTexte("Nous proposons audit, le financement OPCO et suivi.", "fr");
    expect(r.ambigus).toEqual([]);
    expect(r.valeur).toBe("Nous proposons audit et suivi.");
  });
});

// ───────────────── 2.3 corps d'article ─────────────────

describe("2.3 corps : une phrase visée non pure est ambiguë, avec ou sans voisines", () => {
  it.each([
    "Les dirigeants apprécient cette formation finançable via le CPF.",
    "Notre formation de trois jours sur l'IA générative est finançable par votre OPCO.",
  ])("%s", (p) => {
    for (const html of [
      `<p>${p}</p>`,
      `<p>Atelier pratique. ${p}</p>`,
      `<p>Atelier pratique. ${p} Suivi inclus.</p>`,
    ])
      ambiguStrict(reecrireHtml(html, "fr"), html);
  });

  it("phrase PURE avec voisines : toujours retirée", () => {
    const r = reecrireHtml("<p>Atelier pratique. Le financement OPCO est possible.</p>", "fr");
    expect(r.ambigus).toEqual([]);
    expect(r.valeur).toBe("<p>Atelier pratique.</p>");
  });
});

// ───────────────── 5 override sale ─────────────────

describe("5. une valeur d'override qui contient encore une mention est ignorée et signalée", () => {
  const prop = (): Proposition => ({
    cle: "article_translation:t1",
    table: "article_translation",
    id: "t1",
    avant: { body: "<p>Texte ambigu OPCO, formation et suivi.</p>" },
    apres: {},
    ambigus: ["article_translation:t1.body : forme non prouvée"],
    conserves: [],
  });
  const avecValeur = (valeur: unknown, champ = "body", pertesAcceptees?: string[]) => {
    const p = prop();
    const original = p.avant.body;
    return appliquerOverrides(
      p,
      { [champ]: original },
      {
        [p.cle]: {
          [champ]: {
            origine: empreinte(original),
            valeur,
            ...(pertesAcceptees ? { pertesAcceptees } : {}),
          },
        },
      },
    );
  };

  it("valeur sale → ignorée, signalée, ambigu conservé, rien dans `apres`", () => {
    const o = avecValeur("<p>Nous proposons formation financée par votre OPCO.</p>");
    expect(o.ignores.join()).toMatch(/mention|propre/i);
    expect(o.proposition.apres.body).toBeUndefined();
    expect(o.proposition.ambigus).toHaveLength(1);
    expect(o.proposition.surcharges ?? []).toEqual([]);
  });

  it("valeur propre → appliquée", () => {
    const o = avecValeur("<p>Nous proposons formation et suivi.</p>", "body", ["texte", "ambigu"]);
    expect(o.ignores).toEqual([]);
    expect(o.proposition.apres.body).toBe("<p>Nous proposons formation et suivi.</p>");
    expect(o.proposition.ambigus).toHaveLength(0);
  });
});

// ───────────────── 6 avantages ─────────────────

describe("6. un avantage ambigu n'est jamais supprimé en silence", () => {
  const perks = [
    { labelFr: "Mutuelle", labelEn: "Health" },
    { labelFr: "Formation éligible au CPF", labelEn: "CPF-eligible training" },
  ];

  it("reecrirePerks garde la valeur d'origine et rend l'ambigu", () => {
    const r = reecrirePerks(perks) as { valeur: unknown; modifie: boolean; ambigus?: string[] };
    expect(r.valeur).toEqual(perks);
    expect(r.modifie).toBe(false);
    expect((r.ambigus ?? []).length).toBeGreaterThan(0);
  });

  it("proposerOffre remonte l'ambigu au rapport, champ perks", () => {
    const p = proposerOffre({
      id: "o1",
      slug: "office-manager",
      status: "published",
      titleFr: "Office manager",
      titleEn: "Office manager",
      summaryFr: "Vous tenez la maison.",
      summaryEn: "You run the office.",
      bodyFr: "<p>Vous tenez la maison.</p>",
      bodyEn: "<p>You run the office.</p>",
      bodyJsonFr: null,
      bodyJsonEn: null,
      bodyTextFr: "Vous tenez la maison.",
      bodyTextEn: "You run the office.",
      metaTitle: null,
      metaDescription: null,
      perks,
    })!;
    expect(p.ambigus.some((a) => a.includes("perks"))).toBe(true);
    expect(p.apres.perks).toBeUndefined();
  });
});

// ───────────────── 4 propriété sur les 4 points d'entrée ─────────────────

const PHRASES: Array<[string, Langue]> = [
  ["We offer audit, training, OPCO funding and follow-up.", "en"],
  ["We offer audit, OPCO funding, training and coaching.", "en"],
  ["Our team provides audit or OPCO funding.", "en"],
  ["You get coaching, CPF funding and a final report.", "en"],
  ["We run audits, handle CPF files and send weekly reports.", "en"],
  ["Training, coaching and CPF funding are available for all teams.", "en"],
  ["Nous proposons audit, formation, financement OPCO et suivi.", "fr"],
  ["Nous proposons audit, financement OPCO, formation et suivi.", "fr"],
  ["Nous proposons audit, formation et financement OPCO.", "fr"],
  ["Nous proposons audit, formation, financement OPCO et suivi, puis un bilan.", "fr"],
  ["Nous proposons audit, formation, financement OPCO ou France Travail et suivi.", "fr"],
  ["Nous proposons audit, formation ainsi que financement OPCO et suivi.", "fr"],
  ["Nous proposons l'audit, la formation, le financement OPCO et le suivi.", "fr"],
  ["Nos 4 offres : audit, formation, financement OPCO et suivi.", "fr"],
  ["Les 3 piliers sont audit, financement OPCO et suivi.", "fr"],
  ["Nos audits Qualiopi sont réalisés sur site.", "fr"],
  ["La formation dure 3 jours (financement OPCO possible) et s'adapte à vous.", "fr"],
  ["Audit, financement OPCO ou suivi.", "fr"],
  [
    "La formation se déroule chez vous, elle est finançable par un OPCO, et un rapport est remis.",
    "fr",
  ],
  ["Nous réalisons un audit et un financement OPCO sont possibles.", "fr"],
  ["Des aides comme BPI France, les fonds de votre OPCO ou France Num existent.", "fr"],
  ["Vous gérez les dossiers CPF, la facturation et les relances clients.", "fr"],
  ["Le suivi, la prise en charge OPCO et le bilan final sont inclus.", "fr"],
  ["Formation courte, financement OPCO, accompagnement personnalisé et bilan.", "fr"],
  ["Notre équipe réalise l'audit, la mise en place et le financement OPCO.", "fr"],
  ["Offres : audit, formation, financement OPCO, suivi.", "fr"],
  ["Nous proposons audit, formation, financement OPCO, financement CPF et suivi.", "fr"],
  ["Prenez rendez-vous, nous étudions votre financement OPCO et nous vous rappelons.", "fr"],
  // phrases des points 2.1 à 2.3
  ["Nous proposons audit, formation éligible au CPF et suivi.", "fr"],
  ["Nous proposons audit, conseil, formation et accompagnement certifié Qualiopi.", "fr"],
  ["Vous recevez audit, formation, accompagnement Qualiopi et suivi.", "fr"],
  ["Formation de deux jours éligible au CPF.", "fr"],
  ["Les dirigeants apprécient cette formation finançable via le CPF.", "fr"],
  ["Notre formation de trois jours sur l'IA générative est finançable par votre OPCO.", "fr"],
  ["Formation sur mesure de 3 jours et accompagnement, finançable par votre OPCO", "fr"],
  // phrases de la passe 7 (points A, A4, B)
  ["Formation OPCO de deux jours sur ChatGPT.", "fr"],
  ["Atelier ChatGPT financé par l'OPCO.", "fr"],
  ["Audit puis financement OPCO.", "fr"],
  ["Diagnostic et financement OPCO.", "fr"],
  ["Formation éligible CPF.", "fr"],
  ["Ateliers (OPCO) sur ChatGPT.", "fr"],
  ["Nous proposons un accompagnement complet (audit, formation et financement OPCO).", "fr"],
  ["Nos ateliers (formation certifiée Qualiopi) durent deux jours.", "fr"],
  ["OPCO, CPF : nous détaillons ici les trois piliers de notre méthode.", "fr"],
  ["Prise en charge OPCO : comptez 3 jours de formation intra-entreprise.", "fr"],
  ["Les financements OPCO couvrent notre audit — un diagnostic de 2 jours de vos processus.", "fr"],
  ["Financement OPCO possible pour l'atelier ChatGPT de Lyon.", "fr"],
  ["OPCO funding covers our two-day ChatGPT workshop in Lyon.", "en"],
];

const doc = (texte: string) => ({
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Atelier pratique." }] },
    { type: "paragraph", content: [{ type: "text", text: texte }] },
    { type: "paragraph", content: [{ type: "text", text: "Suivi inclus." }] },
  ],
});
const texteJson = (n: unknown): string => {
  const x = n as { text?: string; content?: unknown[] };
  if (typeof x.text === "string") return x.text;
  return (x.content ?? []).map(texteJson).join(" ");
};
const htmlTexte = (h: string) => h.replace(/<[^>]+>/g, " ");

describe("4. propriété : les 4 points d'entrée donnent le même verdict, et le fragment perdu est financier", () => {
  it.each(PHRASES)("%s", (phrase, langue) => {
    const voisines = (x: string) => `Atelier pratique. ${x} Suivi inclus.`;
    const { valeur: entrees, regles } = capterRegles(() => ({
      p: reecrireHtml(`<p>${voisines(phrase)}</p>`, langue),
      li: reecrireHtml(`<ul><li>Audit.</li><li>${phrase}</li><li>Suivi.</li></ul>`, langue),
      liBalise: reecrireHtml(
        `<ul><li>Audit.</li><li><strong>${phrase.split(" ")[0]}</strong> ${phrase.split(" ").slice(1).join(" ")}</li><li>Suivi.</li></ul>`,
        langue,
      ),
      json: reecrireJson(doc(phrase), langue),
    }));
    const nombresCorriges = regles.some((x) => x.startsWith("décompte corrigé"));
    const verdicts = Object.fromEntries(
      Object.entries(entrees).map(([k, r]) => [k, classer(r as Resultat<unknown>)]),
    );
    // Texte seul : même verdict que les autres hors cas « champ entièrement visé » (phrase pure,
    // qu'un champ court ne peut pas vider seul).
    const t = reecrireTexte(phrase, langue);
    const pur = t.ambigus.some((a) => a.startsWith("champ entièrement visé"));
    const attendu = verdicts.p;
    // Mêmes verdicts sur <p>, <li> et JSON. La puce à balise en ligne n'est jamais plus audacieuse :
    // elle est identique, ou ambiguë (aucune coupure dans un HTML à balises : la forme n'est pas prouvée).
    for (const k of ["li", "json"] as const) expect([k, verdicts[k]]).toEqual([k, attendu]);
    expect(["ambigu", attendu]).toContain(verdicts.liBalise);
    // Texte seul (champ court, langue de la phrase) : ambigu si les autres le sont.
    if (attendu === "ambigu") expect(classer(t)).toBe("ambigu");
    else if (!pur && attendu === "a-reecrire") expect(classer(t)).toBe("a-reecrire");
    if (attendu === "ambigu") {
      expect(entrees.p.valeur).toBe(`<p>${voisines(phrase)}</p>`);
      return;
    }
    // Réécrit : VERROU — tous les mots perdus appartiennent à LEXIQUE_RETIRABLE (mots de financement,
    // mots-outils, mots des phrases standard), sur les points d'entrée texte, <p>, <li> et JSON.
    const sorties: Array<[string, string, string]> = [
      ["p", voisines(phrase), htmlTexte(entrees.p.valeur as string)],
      ["li", `Audit. ${phrase} Suivi.`, htmlTexte(entrees.li.valeur as string)],
      ["json", texteJson(doc(phrase)), texteJson(entrees.json.valeur)],
    ];
    if (t.modifie) sorties.push(["texte", phrase, t.valeur]);
    for (const [k, entree, sortie] of sorties)
      expect([k, motsNonRetirables(entree, sortie, nombresCorriges)]).toEqual([k, []]);
  });

  it("FAQ : la réponse suit la même règle que le corps", () => {
    const f = reecrireFaq(
      {
        question: "Que comprend l'offre ?",
        reponse: "<p>Nous proposons audit, formation éligible au CPF et suivi.</p>",
      },
      "fr",
    );
    expect(classer(f)).toBe("ambigu");
  });
});

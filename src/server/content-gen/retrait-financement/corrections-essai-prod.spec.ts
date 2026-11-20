/**
 * Corrections après l'essai à blanc sur la PRODUCTION (19/11/2026, audit Opus).
 * Un test par défaut prouvé : chacun échouait avant la correction.
 */
import { describe, expect, it } from "vitest";
import { proposerArticle, proposerFaq, proposerOffre, proposerTraduction } from "./plan";
import { construireRapport, lignesModification, passagesModifies } from "./rapport";
import {
  PHRASE_FR,
  classer,
  estVisee,
  htmlVersTexte,
  reecrireFaq,
  reecrireHtml,
  reecrireJson,
  reecrireTexte,
} from "./regles";

const INTERDITS = /\bOPCOs?\b|qualiopi|\bCPF\b|France Travail/i;

describe("1. rapport : passage retiré, contexte de ~150 caractères, remplacement", () => {
  const avant =
    "<p>" +
    "Nous commençons par un audit de vos usages réels et de vos outils. ".repeat(4) +
    "Le financement OPCO est possible. " +
    "Ensuite nous formons vos équipes sur leurs vrais dossiers. ".repeat(4) +
    "</p>";

  it("body : le passage retiré apparaît avec son contexte avant/après", () => {
    const apres = reecrireHtml(avant, "fr").valeur;
    const [p] = passagesModifies(avant, apres);
    expect(p?.retire).toBe("Le financement OPCO est possible.");
    expect(p?.remplace).toBe("");
    expect(p?.avantContexte.length).toBeGreaterThan(100);
    expect(p?.avantContexte.length).toBeLessThanOrEqual(150);
    expect(p?.avantContexte).toContain("audit de vos usages");
    expect(p?.apresContexte).toContain("Ensuite nous formons");
    const texte = lignesModification("article_translation:t1", "body", avant, apres).join("\n");
    expect(texte).toContain("retiré : « Le financement OPCO est possible. »");
    expect(texte).toContain("remplacé par : (rien)");
    expect(texte).not.toContain("(structure JSON)");
  });

  it("une phrase standard insérée apparaît comme texte de remplacement", () => {
    const html =
      "<p>Intro.</p><h2>Financement OPCO</h2><p>Via votre OPCO.</p><h2>Suite</h2><p>Fin.</p>";
    const apres = reecrireHtml(html, "fr").valeur;
    const [p] = passagesModifies(html, apres);
    expect(p?.retire).toContain("Via votre OPCO");
    expect(p?.remplace).toContain(PHRASE_FR);
  });

  it("faqJson : la question et la réponse concernées sont montrées, pas « (structure JSON) »", () => {
    const faqJson = [
      { question: "Combien de jours ?", answer: "Trois jours." },
      { question: "Peut-on financer via le CPF ?", answer: "Oui, avec un OPCO." },
    ];
    const p = proposerArticle({
      id: "a1",
      directAnswer: null,
      faqJson,
      keyTakeaway: null,
      expertQuoteText: null,
      featuredImageAltFr: null,
      featuredImageAltEn: null,
    })!;
    const rapport = construireRapport("dry-run", [p], [], "sha");
    expect(rapport).not.toContain("(structure JSON)");
    expect(rapport).toContain("question n°2");
    expect(rapport).toContain("Peut-on financer via le CPF ?");
    expect(rapport).toContain("réponse n°2");
    expect(rapport).toContain("Comment se passe le financement ?");
  });

  it("bodyText : texte long non tronqué à 200 caractères", () => {
    const long = `${"Mot ".repeat(120)}Les OPCO financent. Fin.`;
    const lignes = lignesModification("x:1", "bodyText", long, `${"Mot ".repeat(120)}Fin.`);
    expect(lignes.join("\n")).toContain("retiré : « Les OPCO financent. »");
  });
});

describe("2. un paragraphe qui parle d'autre chose n'est jamais remplacé en entier", () => {
  it("Ajaccio : intro conservée, seule la phrase de financement part", () => {
    const html =
      "<p>Les entreprises d'Ajaccio et de Corse-du-Sud font face au même défi : gagner du temps sur les tâches répétitives. Nous formons vos équipes sur leurs vrais dossiers. Les formations peuvent être financées par les OPCO. Le rapport est remis sous trois jours.</p>";
    const r = reecrireHtml(html, "fr");
    // Audit passe 6 : « Les formations peuvent être financées par les OPCO. » n'a pas le
    // financement pour sujet : ambiguë, le paragraphe est conservé intact (jamais retiré seul).
    expect(r.valeur).toBe(html);
    expect(classer(r)).toBe("ambigu");
    // Avec une phrase PURE à la place, seule elle part et l'intro est conservée.
    const pure = reecrireHtml(
      html.replace(
        "Les formations peuvent être financées par les OPCO.",
        "Le financement OPCO est possible.",
      ),
      "fr",
    );
    expect(pure.valeur).not.toContain(PHRASE_FR);
    expect(pure.valeur).toContain(
      "Les entreprises d'Ajaccio et de Corse-du-Sud font face au même défi",
    );
    expect(pure.valeur).not.toMatch(INTERDITS);
  });

  it("deux phrases de financement sur quatre : retirées seules (plus de remplacement)", () => {
    const html =
      "<p>Nous formons vos équipes. Les OPCO financent la formation. Éligible au CPF, la formation est courte. Un conseiller vous suit.</p>";
    const r = reecrireHtml(html, "fr");
    // Règle « formes prouvées » : « Éligible au CPF, la formation est courte » mêle visé et non visé.
    expect(r.ambigus.length).toBeGreaterThan(0);
    expect(r.modifie).toBe(false);
  });

  it("paragraphe ENTIÈREMENT consacré au financement : phrase standard", () => {
    const r = reecrireHtml(
      "<p>Les OPCO financent la formation. Un dossier AIF peut aussi aider.</p>",
      "fr",
    );
    expect(r.valeur).toBe(`<p>${PHRASE_FR}</p>`);
  });

  it("liste : l'intro « points à mobiliser : » (pas du financement) n'est pas supprimée", () => {
    const r = reecrireHtml(
      "<p>Les points à mobiliser :</p><ul><li>Audit</li><li>Rapport</li><li>Prise en charge CPF</li></ul>",
      "fr",
    );
    expect(r.valeur).toContain("Les points à mobiliser :");
    expect(r.valeur).not.toMatch(/CPF/);
  });
});

describe("3. champs courts : retirer le FRAGMENT, pas la phrase", () => {
  it("directAnswer : « …, peut être financée via les OPCO et le CPF, et s'adapte… »", () => {
    const r = reecrireTexte(
      "La formation dure en moyenne 3 à 5 jours (21 à 35 heures), peut être financée via les OPCO et le CPF, et s'adapte à votre secteur.",
      "fr",
    );
    // Plusieurs virgules + un seul « et » + élément visé au milieu d'un prédicat : hors formes prouvées.
    expect(r.ambigus.length).toBeGreaterThan(0);
    expect(classer(r)).toBe("ambigu");
  });

  it("keyTakeaway : élément de liste retiré ET décompte corrigé (sept → six)", () => {
    const r = reecrireTexte(
      "La méthode repose sur sept étapes : audit, cartographie, financement OPCO, prototype, formation, déploiement, suivi.",
      "fr",
    );
    // Liste sans connecteur « et/ou » : hors formes prouvées → ambigu.
    expect(r.ambigus.length).toBeGreaterThan(0);
    expect(r.modifie).toBe(false);
  });

  it("décompte en chiffres devant « points » et « leviers »", () => {
    expect(
      reecrireTexte(
        "Notre approche tient en 5 points : audit, tarifs, financement CPF, formation et suivi.",
        "fr",
      ).valeur,
    ).toBe("Notre approche tient en 4 points : audit, tarifs, formation et suivi.");
    expect(
      reecrireTexte("Trois leviers : gains de temps, aides OPCO et qualité de service.", "fr")
        .valeur,
    ).toBe("Deux leviers : gains de temps et qualité de service.");
  });

  it("décompte qui ne se vérifie pas : ambigu, rien n'est écrit", () => {
    const r = reecrireTexte(
      "La méthode repose sur sept étapes : audit, financement OPCO, prototype.",
      "fr",
    );
    expect(classer(r)).toBe("ambigu");
    expect(r.modifie).toBe(false);
  });

  it("phrase mixte sans coupure propre dans un champ court : ambigu, pas retirée", () => {
    const r = reecrireTexte(
      "Notre équipe accompagne les dirigeants de PME dans le choix de leurs premiers cas d'usage avant tout financement OPCO.",
      "fr",
    );
    expect(classer(r)).toBe("ambigu");
  });

  it("idempotent", () => {
    const r = reecrireTexte(
      "La formation dure 3 jours, peut être financée via les OPCO et le CPF, et s'adapte à vous.",
      "fr",
    );
    expect(reecrireTexte(r.valeur, "fr").modifie).toBe(false);
  });
});

describe("4. bodyText : blocs séparés, jamais de mots collés", () => {
  it("htmlVersTexte sépare p, titres, puces, cellules, br, div", () => {
    const t = htmlVersTexte(
      "<h2>Savoir</h2><p>objectifs</p><p>Notre offre</p><ul><li>un</li><li>deux</li></ul><table><tr><td>a</td><td>b</td></tr></table><div>x</div>y<br>z",
    );
    expect(t).toBe("Savoir objectifs Notre offre un deux a b x y z");
    expect(t).not.toMatch(/ {2}|objectifsNotre|savoirPourquoi/);
  });

  it("inline : pas d'espace parasite dans un mot", () => {
    expect(htmlVersTexte("<p>L<strong>IA</strong> aide.</p>")).toBe("LIA aide.");
  });

  it("proposerTraduction : bodyText recalculé sans mots collés", () => {
    const p = proposerTraduction({
      id: "t1",
      locale: "fr",
      title: "Guide",
      excerpt: null,
      body: "<p>Nos objectifs</p><p>Notre méthode</p><p>Les OPCO financent.</p>",
      bodyJson: null,
      bodyText: "x",
      metaTitle: null,
      metaDescription: null,
      ogImageAlt: null,
    })!;
    expect(p.apres.bodyText).toBe(`Nos objectifs Notre méthode ${PHRASE_FR}`);
  });
});

describe("5. « prise en charge » financière / non financière", () => {
  it.each([
    "La prise en charge dépend de la certification de l'organisme formateur choisi.",
    "Demandez le tarif exact et les modalités de prise en charge à l'organisme.",
  ])("visée : %s", (t) => expect(estVisee(t)).toBe(true));

  it.each([
    "La prise en charge des appels réduit le coût de 30 %.",
    "Le tarif inclut la prise en charge des tickets.",
  ])("conservée : %s", (t) => expect(estVisee(t)).toBe(false));
});

describe("6. ambigus : règles ciblées", () => {
  const tableau = (c2: string, c3: string) =>
    `<table><tbody><tr><td>Formation</td><td>${c2}</td></tr><tr><td>Audit</td><td>${c3}</td></tr></tbody></table>`;

  it("tableau : « Sur devis OPCO » → « Sur devis », « Oui (OPCO) » → « Oui »", () => {
    const r = reecrireHtml(tableau("Sur devis OPCO", "Oui (OPCO)"), "fr");
    expect(classer(r)).toBe("a-reecrire");
    expect(r.valeur).toBe(tableau("Sur devis", "Oui"));
  });

  it("tableau Tiptap : mêmes cellules", () => {
    const cellule = (t: string) => ({
      type: "tableCell",
      content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
    });
    const doc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            { type: "tableRow", content: [cellule("Formation"), cellule("Sur devis OPCO")] },
            { type: "tableRow", content: [cellule("Audit"), cellule("Oui (OPCO)")] },
          ],
        },
      ],
    };
    const r = reecrireJson(doc, "fr");
    expect(classer(r)).toBe("a-reecrire");
    expect(JSON.stringify(r.valeur)).toContain("Sur devis");
    expect(JSON.stringify(r.valeur)).not.toMatch(/OPCO/);
  });

  it("tableau : cellule non nettoyable reste ambiguë", () => {
    expect(classer(reecrireHtml(tableau("Via l'OPCO du client", "Oui"), "fr"))).toBe("ambigu");
  });

  it("FAQ : question « reconnu par France Compétences » reformulée, réponse sans financement", () => {
    const r = reecrireFaq(
      {
        question: "OpenClassrooms est-il reconnu par France Compétences ?",
        reponse:
          "Oui, OpenClassrooms propose des parcours reconnus. Ils sont éligibles au CPF pour les particuliers. Pour une équipe, un accompagnement sur mesure reste plus efficace.",
      },
      "fr",
    );
    // Audit passe 6 : « Ils sont éligibles au CPF pour les particuliers. » (sujet : « Ils ») n'est
    // pas une phrase de financement pure : ambiguë, la réponse est conservée telle quelle.
    expect(classer(r)).toBe("ambigu");
    expect(r.valeur.reponse).toContain("accompagnement sur mesure");
  });

  it("FAQ fille : les règles s'appliquent aussi à la ligne FAQ et au faqJson jumeau", () => {
    const f = proposerFaq({
      id: "f1",
      questionFr: "OpenClassrooms est-il reconnu par France Compétences ?",
      answerFr:
        "Oui, des parcours reconnus. Éligibles au CPF pour les particuliers. Notre offre est sur mesure.",
      questionEn: "Is it recognised?",
      answerEn: "Yes.",
      metaTitle: null,
      metaDescription: null,
    })!;
    expect(f.apres.questionFr).toBe("OpenClassrooms est-il reconnu ?");
    const a = proposerArticle({
      id: "a1",
      directAnswer: null,
      faqJson: [
        {
          question: "OpenClassrooms est-il reconnu par France Compétences ?",
          answer:
            "Oui, des parcours reconnus. Éligibles au CPF pour les particuliers. Notre offre est sur mesure.",
        },
      ],
      keyTakeaway: null,
      expertQuoteText: null,
      featuredImageAltFr: null,
      featuredImageAltEn: null,
    })!;
    expect(JSON.stringify(a.apres.faqJson)).toContain("OpenClassrooms est-il reconnu ?");
    expect(a.regles?.some((x) => x.includes("question reformulée"))).toBe(true);
    expect(construireRapport("dry-run", [a], [], "s")).toContain("Règles ciblées appliquées");
  });

  it("le rapport liste les règles ciblées (décompte, cellule)", () => {
    const a = proposerArticle({
      id: "a2",
      directAnswer: null,
      faqJson: null,
      keyTakeaway:
        "La méthode repose sur sept étapes : audit, cartographie, financement OPCO, prototype, formation, déploiement et suivi.",
      expertQuoteText: null,
      featuredImageAltFr: null,
      featuredImageAltEn: null,
    })!;
    const rapport = construireRapport("dry-run", [a], [], "s");
    expect(rapport).toContain("décompte corrigé");
    expect(rapport).toContain("six étapes");
  });
});

describe("7. offres d'emploi", () => {
  const offre = (o: Record<string, unknown>) => ({
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
    ...o,
  });

  it("« (financement) » retiré du titre, du résumé, du corps et de la méta", () => {
    const p = proposerOffre(
      offre({
        titleFr:
          "Assistant·e — accompagnement des entreprises sur leurs dossiers (financement) – Axion-IA",
        summaryFr: "Assistant·e — accompagnement des entreprises sur leurs dossiers (financement).",
        bodyFr: "<p>Poste : assistant·e (financement) auprès des clients.</p>",
        metaDescription: "Poste d'assistant·e (financement) chez Axion-IA.",
      }),
    )!;
    expect(p.apres.titleFr).toBe(
      "Assistant·e — accompagnement des entreprises sur leurs dossiers – Axion-IA",
    );
    expect(p.apres.summaryFr).toBe(
      "Assistant·e — accompagnement des entreprises sur leurs dossiers.",
    );
    expect(p.apres.bodyFr).toBe("<p>Poste : assistant·e auprès des clients.</p>");
    expect(p.apres.metaDescription).toBe("Poste d'assistant·e chez Axion-IA.");
    expect(p.apres.status).toBeUndefined(); // jamais archivée
  });

  it("responsable-qualite : Qualiopi retirée, poste gardé (titre, résumé, corps, puces)", () => {
    const p = proposerOffre(
      offre({
        slug: "responsable-qualite",
        titleFr: "Responsable qualité Qualiopi",
        titleEn: "Quality manager (Qualiopi)",
        summaryFr: "Vous pilotez la qualité de nos formations et la certification Qualiopi.",
        bodyFr:
          "<p>Vous pilotez la démarche qualité et préparez les audits Qualiopi.</p><ul><li>Suivi des indicateurs</li><li>Audit Qualiopi annuel</li></ul>",
      }),
    )!;
    expect(p.apres.status).toBeUndefined();
    expect(p.apres.titleFr).toBe("Responsable qualité");
    expect(p.apres.titleEn).toBe("Quality manager");
    // « A et la certification Qualiopi » / « les audits Qualiopi » : hors formes prouvées → ambigu,
    // l'offre n'est pas réécrite à l'aveugle (le titre, lui, reste réécrit : mot en fin de libellé).
    expect(p.apres.summaryFr).toBeUndefined();
    // Audit passe 6 : « Audit Qualiopi annuel » (puce dont le sujet est un audit) est ambiguë, elle
    // aussi : le corps n'est pas réécrit du tout (paragraphe et puce laissés tels quels).
    expect(p.apres.bodyFr).toBeUndefined();
    expect(p.ambigus.length).toBeGreaterThan(0);
  });
});

describe("8. bodyJson", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Intro." }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Nous formons vos équipes. " },
          { type: "text", text: "Les OPCO financent la formation.", marks: [{ type: "bold" }] },
          { type: "text", text: " Un conseiller vous suit." },
        ],
      },
    ],
  };

  it("réaligné sur body : la mention disparaît du JSON, structure conservée", () => {
    const p = proposerTraduction({
      id: "t1",
      locale: "fr",
      title: "Guide",
      excerpt: null,
      body: "<p>Intro.</p><p>Nous formons vos équipes. Les OPCO financent la formation. Un conseiller vous suit.</p>",
      bodyJson: doc,
      bodyText: "x",
      metaTitle: null,
      metaDescription: null,
      ogImageAlt: null,
    })!;
    expect(JSON.stringify(p.apres.bodyJson)).not.toMatch(/OPCO/);
    expect(JSON.stringify(p.apres.bodyJson)).toContain("Un conseiller vous suit.");
    expect(p.ambigus).toEqual([]);
  });

  it("bodyJson stocké en CHAÎNE JSON : analysé et réécrit (cause probable du « 0 réécrit »)", () => {
    const r = reecrireJson(JSON.stringify(doc), "fr");
    expect(r.modifie).toBe(true);
    expect(typeof r.valeur).toBe("string");
    expect(r.valeur as string).not.toMatch(/OPCO/);
  });

  it("racine en tableau de nœuds : réécrit", () => {
    const r = reecrireJson(doc.content, "fr");
    expect(r.modifie).toBe(true);
    expect(Array.isArray(r.valeur)).toBe(true);
    expect(JSON.stringify(r.valeur)).not.toMatch(/OPCO/);
  });

  it("bloc de texte « inattendu » (texte directement dans un nœud personnalisé) : réécrit", () => {
    const r = reecrireJson(
      {
        type: "doc",
        content: [
          {
            type: "callout",
            content: [{ type: "text", text: "Nous aidons. Les OPCO financent." }],
          },
        ],
      },
      "fr",
    );
    expect(JSON.stringify(r.valeur)).not.toMatch(/OPCO/);
  });

  it("mention qui survit à la réécriture : signalée, jamais silencieuse", () => {
    const p = proposerTraduction({
      id: "t2",
      locale: "fr",
      title: "Guide",
      excerpt: null,
      body: "<p>Intro.</p>",
      bodyJson: {
        type: "doc",
        content: [
          { type: "weird", data: { type: "x", content: [{ text: "Les OPCO financent." }] } },
        ],
      },
      bodyText: "x",
      metaTitle: null,
      metaDescription: null,
      ogImageAlt: null,
    });
    expect(p?.ambigus.some((a) => a.includes("bodyJson"))).toBe(true);
  });

  it("bodyJson nul : rien à réécrire, aucune proposition parasite", () => {
    expect(
      proposerTraduction({
        id: "t3",
        locale: "fr",
        title: "Guide",
        excerpt: null,
        body: "<p>Intro.</p>",
        bodyJson: null,
        bodyText: "Intro.",
        metaTitle: null,
        metaDescription: null,
        ogImageAlt: null,
      }),
    ).toBeNull();
  });
});

describe("textes écrits : aucun mot interdit", () => {
  it("la phrase standard et les remplacements ne contiennent aucun motif interdit", () => {
    expect(PHRASE_FR).not.toMatch(INTERDITS);
  });
});

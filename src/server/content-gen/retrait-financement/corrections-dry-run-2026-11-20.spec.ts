/**
 * Correctifs de l'essai à blanc du 20/11/2026 (anomalies A1 à A9).
 * Analyse : `geo/relectures/ANALYSE-DRY-RUN-RETRAIT-2026-11-20.md` (dépôt axion-plans-prive).
 * Chaque cas reprend un exemple RÉEL de `geo/retrait/dry-run-2026-11-20/rapport.md`.
 */
import { describe, expect, it } from "vitest";
import {
  INTERDITS_PUBLICS,
  appliquerOverrides,
  empreinte,
  gabaritOverrides,
  proposerFaq,
  proposerOffre,
  proposerTraduction,
  refuserSiAmbigus,
  reporterDansTexteBrut,
  resume,
  type Proposition,
} from "./plan";
import {
  PHRASE_EN,
  PHRASE_FR,
  QUESTION_EN,
  QUESTION_FR,
  classer,
  htmlVersTexte,
  reecrireHtml,
} from "./regles";
import { CONSIGNE_SANS_FINANCEMENT } from "./motifs-interdits-generateur";
import { construireRapport, lignesModification, passagesModifies } from "./rapport";

const traduction = (o: Partial<Parameters<typeof proposerTraduction>[0]> = {}) => ({
  id: "0368fdc3-3d39-42ac-b91f-b5b23b46385a",
  locale: "fr" as const,
  title: "Formation IA",
  excerpt: null,
  body: "<p>Texte.</p>",
  bodyJson: null,
  bodyText: "Texte.",
  metaTitle: null,
  metaDescription: null,
  ogImageAlt: null,
  ...o,
});

const propositionVide = (avant: Record<string, unknown>, ambigus: string[] = []): Proposition => ({
  cle: "article_translation:x",
  table: "article_translation",
  id: "x",
  avant,
  apres: {},
  ambigus,
  conserves: [],
});

describe("A2 — « (France Compétences) » est une source, pas du financement", () => {
  it("« 73 % des PME … (France Compétences). » reste INCHANGÉ", () => {
    const html =
      "<p>En France, 73 % des PME ont investi dans des formations IA en 2024 (France Compétences).</p>";
    const r = reecrireHtml(html, "fr");
    expect(r.modifie).toBe(false);
    expect(r.valeur).toBe(html);
    expect(r.ambigus).toEqual([]);
  });
  it("« d'une durée moyenne de 3 à 5 jours (France Compétences) » reste inchangé", () => {
    const html = "<p>Nos formations, d'une durée moyenne de 3 à 5 jours (France Compétences).</p>";
    expect(reecrireHtml(html, "fr").modifie).toBe(false);
  });
});

describe("A3 — pas de ponctuation orpheline après retrait d'un fragment", () => {
  it("« (UNESCO), (AFNOR), (OPCO). » → « (UNESCO), (AFNOR). » (jamais « , . »)", () => {
    const r = reecrireHtml("<p>Nos références : (UNESCO), (AFNOR), (OPCO).</p>", "fr");
    expect(r.modifie).toBe(true);
    expect(r.valeur).toBe("<p>Nos références : (UNESCO), (AFNOR).</p>");
    expect(r.valeur).not.toMatch(/,\s*\./);
  });
  it("énumération au milieu : pas de « , , » ni de « () »", () => {
    const r = reecrireHtml("<p>Partenaires : (UNESCO), (OPCO), (AFNOR) et d'autres.</p>", "fr");
    expect(r.valeur).toBe("<p>Partenaires : (UNESCO), (AFNOR) et d'autres.</p>");
    expect(r.valeur).not.toMatch(/,\s*,|\(\s*\)/);
  });
  it("P5 — virgule orpheline devant « et » / « ou »", () => {
    const r = reecrireHtml("<p>Organismes (CPF), (OPCO) et partenaires.</p>", "fr");
    expect(r.valeur).not.toMatch(/,\s+et/);
    expect(r.valeur).toBe("<p>Organismes et partenaires.</p>");
    const e = reecrireHtml("<p>Bodies (CPF), (OPCO) and partners.</p>", "en");
    expect(e.valeur).not.toMatch(/,\s+and/);
  });
  it("P5 — une virgule normale devant « et » est conservée si rien n'a été retiré", () => {
    const html = "<p>Des ateliers, et des cours.</p>";
    expect(reecrireHtml(html, "fr").valeur).toBe(html);
  });
});

describe("A4 — un fragment retiré ne masque pas une phrase France Travail", () => {
  it("« (AIF) de France Travail … frais pédagogiques » est AMBIGU, jamais propre", () => {
    const r = reecrireHtml(
      "<p>L'Aide Individuelle à la Formation (AIF) de France Travail peut couvrir tout ou partie des frais pédagogiques.</p>",
      "fr",
    );
    expect(r.ambigus.length).toBeGreaterThan(0);
    expect(classer(r)).toBe("ambigu");
    expect(r.modifie).toBe(false);
  });
  it("une phrase dont le seul fragment est « (OPCO) » reste réécrite sans ambigu", () => {
    const r = reecrireHtml("<p>Nous proposons des ateliers (OPCO) sur ChatGPT.</p>", "fr");
    expect(r.ambigus).toEqual([]);
    expect(r.valeur).toBe("<p>Nous proposons des ateliers sur ChatGPT.</p>");
  });
});

describe("A1 — htmlVersTexte ignore script, style, template, noscript", () => {
  it("le JSON-LD ne devient jamais du texte", () => {
    const html =
      '<p>Texte visible.</p><script type="application/ld+json">{"@context":"https://schema.org","@type":"QAPage"}</script><style>p{color:red}</style><template><p>modèle</p></template><noscript>sans js</noscript><p>Suite.</p>';
    const t = htmlVersTexte(html);
    expect(t).toBe("Texte visible. Suite.");
    expect(t).not.toMatch(/schema\.org|QAPage|color|modèle|sans js/);
  });
});

describe("A1 — bodyText : seuls les passages modifiés dans body sont reportés", () => {
  const body =
    "<p>Nous proposons des ateliers (OPCO) sur ChatGPT.</p>" +
    "<p>Une large part des équipes progresse nettement.</p>" +
    "<figure><figcaption>Photo de Marie sur Unsplash</figcaption></figure>";
  // bodyText périmé : pas de crédit photo, ancienne statistique, espace avant le point.
  const perime =
    "Nous proposons des ateliers (OPCO) sur ChatGPT . 68 % des équipes formées progressent (données Axion-IA, évaluations 2024-2025) .";

  it("proposerTraduction : le bodyText ne change QUE de « (OPCO) »", () => {
    const p = proposerTraduction(traduction({ body, bodyText: perime }));
    expect(p?.ambigus).toEqual([]);
    expect(p?.apres.bodyText).toBe(perime.replace("(OPCO) ", ""));
    expect(String(p?.apres.bodyText)).toContain("68 %");
    expect(String(p?.apres.bodyText)).not.toMatch(/Unsplash/);
  });
  it("body sans changement de texte : bodyText non touché, pas de modification", () => {
    const p = proposerTraduction(
      traduction({ body: "<p>Texte  propre.</p>", bodyText: "Texte propre ." }),
    );
    expect(p).toBeNull();
  });
  it("passage introuvable dans le bodyText : gardé tel quel + ambigu « à resynchroniser »", () => {
    const p = proposerTraduction(
      traduction({
        body: "<p>Nous proposons des ateliers (OPCO) sur ChatGPT.</p>",
        bodyText: "Autre texte sans rapport.",
      }),
    );
    expect(p?.apres.bodyText).toBeUndefined();
    expect(p?.ambigus.join("\n")).toMatch(/bodyText à resynchroniser/);
  });
  it("passage présent deux fois dans le bodyText : gardé + ambigu", () => {
    const p = proposerTraduction(
      traduction({
        body: "<p>Nous proposons des ateliers (OPCO) sur ChatGPT.</p>",
        bodyText:
          "Nous proposons des ateliers (OPCO) sur ChatGPT. Nous proposons des ateliers (OPCO) sur ChatGPT.",
      }),
    );
    expect(p?.apres.bodyText).toBeUndefined();
    expect(p?.ambigus.join("\n")).toMatch(/bodyText à resynchroniser/);
  });
  it("reporterDansTexteBrut : substitution simple, espaces tolérés", () => {
    expect(
      reporterDansTexteBrut(
        "Voir (OPCO)  et le reste .",
        "<p>Voir (OPCO) et le reste.</p>",
        "<p>Voir et le reste.</p>",
      ),
    ).toBe("Voir et le reste .");
    expect(reporterDansTexteBrut("Rien", "<p>A</p>", "<p>A</p>")).toBe("Rien");
    expect(reporterDansTexteBrut("Rien", "<p>A (OPCO)</p>", "<p>A</p>")).toBeNull();
  });
  // P4 : deux retraits proches ne doivent plus rendre `null` (long passage unique introuvable).
  it("P4 — deux retraits séparés par une balise en ligne dans un même bloc", () => {
    expect(
      reporterDansTexteBrut(
        "Ateliers (OPCO) sur ChatGPT . Puis modules (CPF) en ligne .",
        "<p>Ateliers (OPCO) sur <a href='/x'>ChatGPT</a>. Puis modules (CPF) en ligne.</p>",
        "<p>Ateliers sur <a href='/x'>ChatGPT</a>. Puis modules en ligne.</p>",
      ),
    ).toBe("Ateliers sur ChatGPT . Puis modules en ligne .");
  });
  it("P4 — deux blocs adjacents modifiés", () => {
    expect(
      reporterDansTexteBrut(
        "Premier (OPCO) bloc . Second (CPF) bloc .",
        "<p>Premier (OPCO) bloc.</p><p>Second (CPF) bloc.</p>",
        "<p>Premier bloc.</p><p>Second bloc.</p>",
      ),
    ).toBe("Premier bloc . Second bloc .");
  });
  it("P4 — un morceau introuvable reste null", () => {
    expect(
      reporterDansTexteBrut(
        "Premier (OPCO) bloc . Autre texte.",
        "<p>Premier (OPCO) bloc.</p><p>Second (CPF) bloc.</p>",
        "<p>Premier bloc.</p><p>Second bloc.</p>",
      ),
    ).toBeNull();
  });
  it("P3 — override de body dont le passage est introuvable : bodyText non écrit, ambigu, --apply refusé", () => {
    const body = "<p>Nous proposons des ateliers (OPCO) sur ChatGPT.</p>";
    const bodyText = "Autre texte sans rapport.";
    const r = appliquerOverrides(
      propositionVide({ body, bodyText }, ["article_translation:x.body : ambigu"]),
      { body, bodyText },
      {
        "article_translation:x": {
          body: {
            origine: empreinte(body),
            valeur: "<p>Nous proposons des ateliers sur ChatGPT.</p>",
          },
        },
      },
    );
    expect(r.proposition.apres.body).toBe("<p>Nous proposons des ateliers sur ChatGPT.</p>");
    expect("bodyText" in r.proposition.apres).toBe(false);
    expect(r.proposition.ambigus.join("\n")).toMatch(/bodyText à resynchroniser/);
    expect(() => refuserSiAmbigus([r.proposition], null)).toThrow(/REFUSÉ/);
  });
  it("P3 — offre : bodyTextEn périmé, seuls les passages modifiés sont reportés", () => {
    const p = proposerOffre({
      id: "o2",
      slug: "office-manager",
      status: "published",
      titleFr: "Office manager",
      titleEn: "Office manager",
      summaryFr: "Vous tenez la maison.",
      summaryEn: "You run the office.",
      bodyFr: "<p>Vous tenez la maison.</p>",
      bodyEn: "<p>You run the office (OPCO).</p><p>More.</p>",
      bodyJsonFr: null,
      bodyJsonEn: null,
      bodyTextFr: "Vous tenez la maison.",
      bodyTextEn: "You run the office (OPCO) . More . Added by hand.",
      metaTitle: null,
      metaDescription: null,
    });
    expect(p?.apres.bodyTextEn).toBe("You run the office . More . Added by hand.");
  });
  it("offre : même règle pour bodyTextFr", () => {
    const p = proposerOffre({
      id: "o1",
      slug: "office-manager",
      status: "published",
      titleFr: "Office manager",
      titleEn: "Office manager",
      summaryFr: "Vous tenez la maison.",
      summaryEn: "You run the office.",
      bodyFr: "<p>Vous tenez la maison (OPCO).</p><p>Suite.</p>",
      bodyEn: "<p>You run the office.</p>",
      bodyJsonFr: null,
      bodyJsonEn: null,
      bodyTextFr: "Vous tenez la maison (OPCO) . Suite . Mentions ajoutées à la main.",
      bodyTextEn: "You run the office.",
      metaTitle: null,
      metaDescription: null,
    });
    expect(p?.apres.bodyTextFr).toBe("Vous tenez la maison . Suite . Mentions ajoutées à la main.");
  });
});

describe("A4 (porte 2) — interdits publics : contrôle lexical strict des overrides", () => {
  const original = "Notre formation est suivie par des équipes de PME.";
  const surcharge = (champ: string, valeur: unknown) =>
    appliquerOverrides(
      propositionVide({ [champ]: original }, [`article_translation:x.${champ} : ambigu`]),
      { [champ]: original },
      { "article_translation:x": { [champ]: { origine: empreinte(original), valeur } } },
    );

  it("override contenant « France Travail » → ignoré", () => {
    const r = surcharge("excerpt", "Notre formation est suivie avec France Travail.");
    expect(r.proposition.apres.excerpt).toBeUndefined();
    expect(r.ignores.join("\n")).toMatch(/excerpt/);
  });
  it.each([
    "OPCO",
    "Qualiopi",
    "CPF",
    "Compte personnel de formation",
    "Pôle emploi",
    "AIF",
    "financement",
    "finançable",
    "subvention",
    "subrogation",
    "EDOF",
    "FNE-Formation",
    "Datadock",
  ])("« %s » est un interdit public", (mot) =>
    expect(INTERDITS_PUBLICS.test(`Notre formation ${mot} des équipes`)).toBe(true),
  );
  it("« prise en charge » au sens financier : interdit ; « prise en charge des appels » : permis", () => {
    expect(INTERDITS_PUBLICS.test("Une prise en charge totale par l'organisme")).toBe(true);
    expect(INTERDITS_PUBLICS.test("La prise en charge des appels est rapide.")).toBe(false);
  });
  // P2 : valeurs SANS marqueur que les règles de réécriture laissent passer (vérifié : acceptées
  // quand on retire le contrôle INTERDITS_PUBLICS de `valeurSale`) ; seule la porte 2 les refuse.
  it.each([
    "L'Aide Individuelle à la Formation de France Travail peut couvrir tout ou partie des frais pédagogiques.",
    "Renseignez-vous auprès de France Travail.",
    "Votre CPF peut aider.",
    "Contactez votre Pôle emploi.",
    "Frais remboursés par l'opérateur de compétences.",
    "Les Opérateurs de Compétences accompagnent les entreprises.",
    "Une prise en charge possible des frais pédagogiques.",
    "Les frais sont pris en charge par votre employeur.",
    "Les formations Axion-IA peuvent être prises en charge dans ce cadre.",
    "Le plafond de prise en charge est atteint.",
    "Les prises en charge varient selon le dossier.",
    "Votre employeur prend en charge les frais.",
  ])("override « %s » → ignoré par la porte 2 seule", (valeur) => {
    expect(INTERDITS_PUBLICS.test(valeur)).toBe(true);
    const r = surcharge("excerpt", valeur);
    expect(r.proposition.apres.excerpt).toBeUndefined();
    expect(r.ignores.join("\n")).toMatch(/interdit public/);
  });
  it.each([
    "La prise en charge des appels est rapide.",
    "Une prise en charge technique du projet.",
    "La prise en charge des demandes clients se fait en une heure.",
    "L'IA dans la finance progresse.",
    "Les banques et la finance adoptent l'IA.",
    "Le secteur financier recrute.",
  ])("« %s » n'est pas un interdit public", (valeur) => {
    expect(INTERDITS_PUBLICS.test(valeur)).toBe(false);
  });
  it("« L'IA dans la finance progresse. » est accepté comme override", () => {
    const r = surcharge("excerpt", "L'IA dans la finance progresse.");
    expect(r.ignores.join("\n")).not.toMatch(/interdit public/);
  });
  it("une valeur propre est acceptée", () => {
    const r = surcharge("excerpt", "Notre formation est suivie par des équipes de PME motivées.");
    expect(r.ignores).toEqual([]);
    expect(r.proposition.apres.excerpt).toBe(
      "Notre formation est suivie par des équipes de PME motivées.",
    );
  });
});

describe("A8 — les overrides passent par le verrou « aucun mot non financier perdu »", () => {
  const original = "Notre formation couvre le RNCP et la certification des compétences.";
  const propre = "Notre formation couvre la certification des compétences.";
  const appliquer = (pertesAcceptees?: string[]) =>
    appliquerOverrides(
      propositionVide({ excerpt: original }, ["article_translation:x.excerpt : ambigu"]),
      { excerpt: original },
      {
        "article_translation:x": {
          excerpt: {
            origine: empreinte(original),
            valeur: propre,
            ...(pertesAcceptees ? { pertesAcceptees } : {}),
          },
        },
      },
    );

  it("perd « RNCP » sans pertesAcceptees → ignoré", () => {
    const r = appliquer();
    expect(r.proposition.apres.excerpt).toBeUndefined();
    expect(r.ignores.join("\n")).toMatch(/rncp/i);
    expect(r.proposition.ambigus.length).toBe(1);
  });
  it("perd « RNCP » avec pertesAcceptees: ['rncp'] → accepté", () => {
    const r = appliquer(["rncp"]);
    expect(r.ignores).toEqual([]);
    expect(r.proposition.apres.excerpt).toBe(propre);
    expect(r.proposition.ambigus).toEqual([]);
  });
  it("la liste acceptée est insensible à la casse et aux accents", () => {
    expect(appliquer(["RNCP"]).proposition.apres.excerpt).toBe(propre);
  });
  it("une perte non listée reste refusée même si une autre est listée", () => {
    expect(appliquer(["autre"]).proposition.apres.excerpt).toBeUndefined();
  });
  it("rétrocompatible : un override qui ne perd que des mots du lexique n'a pas besoin de liste", () => {
    const o = "Nos ateliers sont ouverts aux équipes, avec OPCO.";
    const r = appliquerOverrides(
      propositionVide({ excerpt: o }, ["article_translation:x.excerpt : ambigu"]),
      { excerpt: o },
      {
        "article_translation:x": {
          excerpt: { origine: empreinte(o), valeur: "Nos ateliers sont ouverts aux équipes." },
        },
      },
    );
    expect(r.ignores).toEqual([]);
  });
});

describe("A1 (overrides) — le bodyText d'un body surchargé est reporté, pas recalculé", () => {
  it("override du body : seul le passage modifié est reporté dans le bodyText stocké", () => {
    const body = "<p>Intro.</p><p>Voir les OPCO pour un financement.</p>";
    const nouveau = "<p>Intro.</p><p>Voir notre devis.</p>";
    const bodyText = "Intro . Voir les OPCO pour un financement . Photo de X sur Unsplash";
    const r = appliquerOverrides(
      propositionVide({ body, bodyText }, ["article_translation:x.body : ambigu"]),
      { body, bodyText },
      {
        "article_translation:x": {
          body: { origine: empreinte(body), valeur: nouveau, pertesAcceptees: ["voir", "pour"] },
        },
      },
    );
    expect(r.ignores).toEqual([]);
    expect(r.proposition.apres.bodyText).toBe("Intro . Voir notre devis . Photo de X sur Unsplash");
  });
});

describe("A7 — gabarit FAQ : la question de financement est aussi proposée", () => {
  it("« Comment financer… » → questionFr et questionEn dans le gabarit", () => {
    const p = proposerFaq({
      id: "f1",
      questionFr: "Comment financer ma formation en prompt engineering ?",
      answerFr:
        "Vous pouvez utiliser votre Compte Personnel de Formation (CPF) ou bénéficier de l'Aide Individuelle à la Formation (AIF) de France Travail.",
      questionEn: "Comment financer ma formation en prompt engineering ?",
      answerEn:
        "Vous pouvez utiliser votre Compte Personnel de Formation (CPF) ou bénéficier de l'Aide Individuelle à la Formation (AIF) de France Travail.",
      metaTitle: null,
      metaDescription: null,
    });
    expect(p).not.toBeNull();
    const g = gabaritOverrides([p!]);
    const champs = Object.keys(g[p!.cle] ?? {});
    expect(champs).toEqual(
      expect.arrayContaining(["answerFr", "answerEn", "questionFr", "questionEn"]),
    );
    expect(g[p!.cle]!.questionFr!.origine).toBe(empreinte(p!.avant.questionFr));
  });
  it("question étrangère au financement : seule la réponse est proposée", () => {
    const p = proposerFaq({
      id: "f2",
      questionFr: "Quelle est la différence entre un atelier IA et une formation IA certifiante ?",
      answerFr:
        "Une formation certifiante est encadrée par France Compétences et peut être financée via les OPCO. Un atelier IA est un format opérationnel non certifiant.",
      questionEn: "What is the difference?",
      answerEn: "A certified course may be funded via OPCO. A workshop is hands-on.",
      metaTitle: null,
      metaDescription: null,
    });
    const g = gabaritOverrides(p ? [p] : []);
    const champs = Object.keys(g[p?.cle ?? ""] ?? {});
    expect(champs).not.toContain("questionFr");
  });
});

describe("A5 — phrase et question standard sans mot interdit (en ATTENTE de validation de Williams)", () => {
  it("valeurs proposées par l'analyse", () => {
    expect(PHRASE_FR).toBe(
      "Tarifs : devis ferme en forfait fixe, établi après un Diagnostic IA de 45 minutes.",
    );
    expect(QUESTION_FR).toBe("Comment obtenir un devis ?");
    expect(PHRASE_EN).toBe(
      "Pricing: a fixed quote, set after a free 45-minute AI Diagnostic call.",
    );
    expect(QUESTION_EN).toBe("How do I get a quote?");
  });
  it("aucune ne correspond à INTERDITS_PUBLICS", () => {
    for (const s of [PHRASE_FR, QUESTION_FR, PHRASE_EN, QUESTION_EN])
      expect(INTERDITS_PUBLICS.test(s)).toBe(false);
  });
  it("la consigne des générateurs reprend la même constante", () => {
    expect(CONSIGNE_SANS_FINANCEMENT).toContain(PHRASE_FR);
    expect(CONSIGNE_SANS_FINANCEMENT).not.toContain("solutions indiquées au premier échange");
  });
  it("la phrase standard est idempotente (non visée)", () => {
    const html = `<p>${PHRASE_FR}</p>`;
    expect(reecrireHtml(html, "fr").modifie).toBe(false);
  });
});

describe("A9 — rapport : faux signaux supprimés", () => {
  it("passage qui ne diffère que par des espaces : supprimé", () => {
    expect(
      passagesModifies("L'AI Act européen s'applique .", "L'AI Act européen s'applique."),
    ).toEqual([]);
    expect(
      lignesModification(
        "k",
        "bodyText",
        "L'AI Act européen s'applique .",
        "L'AI Act européen s'applique.",
      ),
    ).toEqual([]);
  });
  it("un vrai retrait reste affiché", () => {
    expect(passagesModifies("Voir (OPCO) ici.", "Voir ici.").length).toBe(1);
  });
  it("statut d'offre : « statut : publiée → archivée »", () => {
    const l = lignesModification("job_offer:a9a547df", "status", "published", "archived").join(
      "\n",
    );
    expect(l).toContain("statut : publiée → archivée");
    expect(l).not.toMatch(/retiré|remplacé par/);
  });
  it("resume : les ambigus avec réécriture partielle ne sont plus comptés deux fois", () => {
    const base = { table: "faq" as const, avant: {}, conserves: [] };
    const props: Proposition[] = [
      { ...base, cle: "faq:1", id: "1", apres: { answerFr: "x" }, ambigus: [] },
      { ...base, cle: "faq:2", id: "2", apres: {}, ambigus: ["faq:2.answerFr : a"] },
      { ...base, cle: "faq:3", id: "3", apres: { answerFr: "y" }, ambigus: ["faq:3.answerEn : b"] },
    ];
    expect(resume(props)).toEqual({ a_reecrire: 1, ambigus: 2, partiels: 1, total: 3 });
    expect(construireRapport("dry-run", props, [], "sha")).toContain(
      "à réécrire : 1 + 1 partiels · ambigus : 2",
    );
  });
  it("texteComplet : un ambigu de section n'imprime que la section", () => {
    const body =
      "<h2>Introduction</h2><p>Texte d'introduction sans rapport.</p>" +
      "<h2>Financement et éligibilité OPCO</h2><p>Les OPCO financent.</p><p>Mais le RNCP compte aussi.</p>" +
      "<h2>Conclusion</h2><p>Texte de conclusion sans rapport.</p>";
    const p = propositionVide({ body }, [
      "article_translation:x.body : section « Financement et éligibilité OPCO » : financement mêlé à un autre sujet, à relire",
    ]);
    const rapport = construireRapport("dry-run", [p], [], "sha");
    expect(rapport).toContain("Mais le RNCP compte aussi.");
    expect(rapport).not.toContain("Texte d'introduction sans rapport.");
    expect(rapport).not.toContain("Texte de conclusion sans rapport.");
  });
  it("overrides appliqués : colonne « pertes acceptées » dans le rapport", () => {
    const p: Proposition = {
      ...propositionVide({ excerpt: "a" }),
      apres: { excerpt: "b" },
      surcharges: ["excerpt"],
      pertes: { excerpt: ["rncp"] },
    };
    const rapport = construireRapport("dry-run", [p], [], "sha");
    expect(rapport).toContain("Pertes acceptées");
    expect(rapport).toMatch(/article_translation:x.*excerpt.*rncp/);
  });
});

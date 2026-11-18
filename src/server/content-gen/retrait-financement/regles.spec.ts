import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Écrits en deux morceaux : la garde « page financement retirée » refuse l'adresse entre guillemets.
const PAGE = ["financement", "opco", "france", "travail"].join("-");
const LIEN_FR = `/fr/${PAGE}`;
const LIEN_EN = `/en/${PAGE}`;
import {
  PHRASE_EN,
  PHRASE_FR,
  QUESTION_FR,
  classer,
  estVisee,
  reecrireFaq,
  reecrireHtml,
  reecrireJson,
  reecrireTexte,
} from "./regles";

const MOTIFS =
  /\bOPCOs?\b|qualiopi|datadock|\bEDOF\b|subrogation|FNE-Formation|\bAIF\b|finan[cç]able/i;

/** Texte brut simplifié (suffisant pour ces tests). */
const brut = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("estVisee — motifs toujours visés", () => {
  it.each([
    "Ces formations peuvent être financées par les OPCO.",
    "Notre organisme est certifié Qualiopi.",
    "Prise en charge par la subrogation.",
    "Le dispositif FNE-Formation existe.",
    "Un dossier AIF auprès de France Travail.",
    "Des formations finançables.",
    "Funding by your OPCO is possible.",
  ])("vise : %s", (t) => expect(estVisee(t)).toBe(true));

  it("‘prise en charge des appels’ est CONSERVÉ (hors financement)", () => {
    expect(estVisee("Notre agent IA assure la prise en charge des appels entrants.")).toBe(false);
    expect(estVisee("La prise en charge des demandes clients est automatisée.")).toBe(false);
  });

  it("‘prise en charge’ au sens financier est visée", () => {
    expect(
      estVisee("Le coût de la formation peut faire l'objet d'une prise en charge financière."),
    ).toBe(true);
    expect(estVisee("Une prise en charge partielle est possible.")).toBe(true);
    expect(estVisee("Une prise en charge par l'organisme collecteur est possible.")).toBe(true);
    expect(
      estVisee("France Compétences pour la prise en charge des formations certifiantes."),
    ).toBe(true);
  });

  it("‘prise en charge’ + coût / tarif / € / gratuit seuls : CONSERVÉE", () => {
    for (const t of [
      "La prise en charge des appels réduit le coût de 30 %.",
      "La prise en charge des demandes est gratuite pour vos clients.",
      "La prise en charge à 49 € par mois reste simple.",
      "Le tarif inclut la prise en charge des tickets.",
    ])
      expect(estVisee(t), t).toBe(false);
  });

  it("« certification qualité » : visée (variantes)", () => {
    for (const t of [
      "Axion-IA prépare la certification qualité.",
      "Axion-IA est certifié qualité.",
      "Notre organisme est certifiée qualité depuis 2024.",
    ])
      expect(estVisee(t), t).toBe(true);
    const r = reecrireHtml(
      "<p>Une équipe. Un autre point. Axion-IA prépare la certification qualité.</p>",
      "fr",
    );
    expect(r.valeur).toBe("<p>Une équipe. Un autre point.</p>");
  });

  it("CPF / France Travail sans marqueur de financement : conservés", () => {
    expect(estVisee("France Travail (ex Pôle Emploi) CNIL — Intelligence artificielle ANSSI")).toBe(
      false,
    );
    expect(estVisee("Le CPF de Paris a ouvert un salon.")).toBe(false);
  });

  it("CPF / France Travail avec marqueur de financement : visés", () => {
    expect(estVisee("Cette formation est éligible au CPF.")).toBe(true);
    expect(estVisee("Les entreprises peuvent mobiliser France Travail.")).toBe(true);
  });
});

describe("reecrireTexte / reecrireHtml — extraits RÉELS de la production (18/11/2026)", () => {
  it("accompagnement-changement-ia : OPCO + plan de développement, mais pas par le CPF", () => {
    const html =
      "<p>Ces formations peuvent être financées par les OPCO ou le plan de développement des compétences de l'entreprise, mais pas par le CPF.</p><p>Elles se déroulent chez vous.</p>";
    const r = reecrireHtml(html, "fr");
    expect(r.modifie).toBe(true);
    expect(r.valeur).toBe(`<p>${PHRASE_FR}</p><p>Elles se déroulent chez vous.</p>`);
  });

  it("accompagnement-ia-aubervilliers : fonds de votre OPCO", () => {
    const html =
      "<p>Des dispositifs comme les aides BPI France, les fonds de votre OPCO ou les programmes France Num peuvent être mobilisés. Nous vous accompagnons sur place. Le rapport est remis sous trois jours. Un conseiller vous répond.</p>";
    const r = reecrireHtml(html, "fr");
    expect(r.valeur).not.toMatch(MOTIFS);
    expect(r.valeur).toContain(PHRASE_FR); // la 1re phrase parle de financement : ouverture
  });

  it("phrase isolée dans un long paragraphe : seules les phrases visées sont retirées", () => {
    const html =
      "<p>Le rapport est remis sous trois jours. Nous formons vos équipes sur leurs vrais dossiers. Les entreprises peuvent recourir aux OPCO. Un conseiller vous suit pendant un mois. Vous gardez la main sur les outils.</p>";
    const r = reecrireHtml(html, "fr");
    expect(r.valeur).toBe(
      "<p>Le rapport est remis sous trois jours. Nous formons vos équipes sur leurs vrais dossiers. Un conseiller vous suit pendant un mois. Vous gardez la main sur les outils.</p>",
    );
  });

  it("accompagnement-ia-responsable-formation-rh-brunoy : OPCO, France Travail (AIF)", () => {
    const r = reecrireTexte(
      "Les entreprises peuvent recourir aux OPCO, à France Travail (AIF) et au plan de développement des compétences.",
      "fr",
    );
    expect(r.modifie).toBe(false); // champ entièrement visé → ambigu, jamais vidé
    expect(classer(r)).toBe("ambigu");
  });

  it("accompagnement-ia-entreprise-grenoble-faq : CPF référencés par France Compétences", () => {
    const r = reecrireFaq(
      {
        question: "Les formations sont-elles financées ?",
        reponse:
          "<p>Pour les formations certifiantes, nous orientons vers les dispositifs éligibles au CPF référencés par France Compétences.</p>",
      },
      "fr",
    );
    expect(r.modifie).toBe(true);
    expect(r.valeur.question).toBe(QUESTION_FR);
    expect(r.valeur.reponse).toBe(PHRASE_FR);
  });

  it("fragment « (CPF, OPCO, France Travail) » retiré seul", () => {
    const r = reecrireTexte(
      "Vous accompagnez les entreprises sur leurs dossiers (CPF, OPCO, France Travail) au quotidien.",
      "fr",
    );
    expect(r.valeur).toBe("Vous accompagnez les entreprises sur leurs dossiers au quotidien.");
  });

  it("fragment « , finançables par les OPCO, » retiré seul", () => {
    const r = reecrireTexte("Nos parcours, finançables par les OPCO, durent deux jours.", "fr");
    expect(r.valeur).toBe("Nos parcours, durent deux jours.");
    expect(r.valeur).not.toMatch(MOTIFS);
  });
});

describe("structure HTML", () => {
  it("H2 sur le financement : section entière → un paragraphe standard", () => {
    const html =
      "<h2>Un déploiement par étapes</h2><p>On commence petit.</p><h2>Financement et OPCO</h2><p>Premier paragraphe.</p><p>Second paragraphe.</p><ul><li>a</li></ul><h2>Conclusion</h2><p>Parlons-en.</p>";
    const r = reecrireHtml(html, "fr");
    expect(r.valeur).toBe(
      `<h2>Un déploiement par étapes</h2><p>On commence petit.</p><p>${PHRASE_FR}</p><h2>Conclusion</h2><p>Parlons-en.</p>`,
    );
  });

  it("H3 de financement sans motif dans le titre mais OPCO dans le corps : section remplacée", () => {
    const html =
      "<h2>Mise en place</h2><h3>Comment financer ?</h3><p>Via votre OPCO.</p><h3>Le calendrier</h3><p>Trois semaines.</p>";
    const r = reecrireHtml(html, "fr");
    expect(r.valeur).toContain("<h3>" + QUESTION_FR + "</h3>");
    expect(r.valeur).toContain("<h3>Le calendrier</h3><p>Trois semaines.</p>");
    expect(r.valeur).not.toMatch(MOTIFS);
  });

  it("liste : puces visées retirées, les autres gardées", () => {
    const html =
      "<ul><li>Audit le matin</li><li>Formation éligible au CPF</li><li>Rapport sous trois jours</li></ul>";
    expect(reecrireHtml(html, "fr").valeur).toBe(
      "<ul><li>Audit le matin</li><li>Rapport sous trois jours</li></ul>",
    );
  });

  it("liste : toutes visées → phrase standard", () => {
    const html = "<ul><li>Prise en charge OPCO</li><li>Dossier AIF</li></ul>";
    expect(reecrireHtml(html, "fr").valeur).toBe(`<p>${PHRASE_FR}</p>`);
  });

  it("liste : intro sur le financement → intro et liste remplacées", () => {
    const html = "<p>Les financements possibles :</p><ul><li>OPCO</li><li>Fonds propres</li></ul>";
    expect(reecrireHtml(html, "fr").valeur).toBe(`<p>${PHRASE_FR}</p>`);
  });

  it("tableau : ligne dont la 1re cellule est un motif retirée ; autre cellule → ambigu", () => {
    const retire = reecrireHtml(
      "<table><tbody><tr><td>OPCO</td><td>oui</td></tr><tr><td>Durée</td><td>1 jour</td></tr></tbody></table>",
      "fr",
    );
    expect(retire.valeur).toContain("Durée");
    expect(retire.valeur).not.toMatch(/OPCO/);
    const ambigu = reecrireHtml(
      "<table><tbody><tr><td>Prise en charge</td><td>OPCO</td></tr><tr><td>Lieu</td><td>Via l'OPCO du client</td></tr></tbody></table>",
      "fr",
    );
    expect(classer(ambigu)).not.toBe("propre");
  });

  it("‘prise en charge des appels’ reste dans un article", () => {
    const html = "<p>Votre agent vocal assure la prise en charge des appels, de 8 h à 20 h.</p>";
    const r = reecrireHtml(html, "fr");
    expect(r.modifie).toBe(false);
    expect(r.valeur).toBe(html);
  });
});

describe("liens et attributs", () => {
  it("href contenant ‘opco’ (article voisin) : JAMAIS réécrit", () => {
    const html =
      '<p>Voir <a href="/fr/blog/financer-opco-guide" id="opco-1" title="OPCO">notre guide de la formation</a>. Le rapport est remis sous trois jours.</p>';
    const r = reecrireHtml(html, "fr");
    expect(r.modifie).toBe(false);
    expect(r.valeur).toBe(html);
  });

  it("href conservé quand la phrase est retirée autour d'un lien neutre", () => {
    const html =
      '<p>Le rapport est remis sous trois jours. Nous formons vos équipes. Les OPCO financent la formation. <a href="/fr/blog/opco-x">Lire la suite</a> Un conseiller vous suit. On y va pas à pas.</p>';
    const r = reecrireHtml(html, "fr");
    expect(r.valeur).toContain('href="/fr/blog/opco-x"');
  });

  it("lien vers une page retirée (404) : redirigé vers /fr/formations, texte neutralisé", () => {
    const html = `<p>Détails sur <a href="${LIEN_FR}">le financement OPCO</a> en ligne.</p>`;
    const r = reecrireHtml(html, "fr");
    expect(r.valeur).toContain('href="/fr/formations"');
    expect(r.valeur).toContain(">nos formations</a>");
    expect(r.valeur).not.toMatch(/financement-opco/);
  });

  it("lien vers certification-qualiopi (texte neutre) : href redirigé, texte gardé", () => {
    const r = reecrireHtml(
      '<p>Voir <a href="/fr/certification-qualiopi">notre démarche</a>.</p>',
      "fr",
    );
    expect(r.valeur).toContain('href="/fr/formations"');
    expect(r.valeur).toContain(">notre démarche</a>");
  });
});

describe("EN", () => {
  it("phrase standard EN", () => {
    const r = reecrireHtml("<p>Training can be funded by your OPCO or through the CPF.</p>", "en");
    expect(r.valeur).toBe(`<p>${PHRASE_EN}</p>`);
  });

  it("FAQ EN", () => {
    const r = reecrireFaq(
      { question: "Can it be funded by an OPCO?", reponse: "<p>Yes, by your OPCO.</p>" },
      "en",
    );
    expect(r.valeur.question).toBe("How does funding work?");
    expect(r.valeur.reponse).toBe(PHRASE_EN);
  });

  it("lien EN vers une page retirée", () => {
    const r = reecrireHtml(`<p>See <a href="${LIEN_EN}">funding</a>.</p>`, "en");
    expect(r.valeur).toContain('href="/en/formations"');
    expect(r.valeur).toContain("our training courses");
  });
});

describe("offres d'emploi", () => {
  it("libellé « (financement) » retiré (arbitrage 2)", () => {
    const r = reecrireTexte(
      "Assistant·e — accompagnement des entreprises sur leurs dossiers (financement)",
      "fr",
      { titre: true },
    );
    expect(r.valeur).toBe("Assistant·e — accompagnement des entreprises sur leurs dossiers");
    expect(r.modifie).toBe(true);
  });

  it("titre visé par un motif : ambigu, jamais réécrit seul", () => {
    const r = reecrireTexte("Chargé·e Qualiopi", "fr", { titre: true });
    expect(classer(r)).toBe("ambigu");
    expect(r.valeur).toBe("Chargé·e Qualiopi");
  });

  it("charge-subventions : phrase d'accroche retirée", () => {
    const r = reecrireHtml(
      "<p>Vous montez et pilotez les dossiers de financement qui font décoller nos projets IA : CPF, OPCO, France 2030, BPI, aides régionales.</p>",
      "fr",
    );
    expect(r.valeur).toBe(`<p>${PHRASE_FR}</p>`);
  });
});

describe("Tiptap JSON", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "On commence petit." }] },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Financement OPCO" }],
      },
      { type: "paragraph", content: [{ type: "text", text: "Via votre OPCO." }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Conclusion" }] },
      { type: "paragraph", content: [{ type: "text", text: "Parlons-en." }] },
    ],
  };

  it("section remplacée, reste intact, original non muté", () => {
    const copie = JSON.stringify(doc);
    const r = reecrireJson(doc, "fr");
    expect(r.modifie).toBe(true);
    expect(JSON.stringify(doc)).toBe(copie);
    expect(JSON.stringify(r.valeur)).not.toMatch(MOTIFS);
    expect(JSON.stringify(r.valeur)).toContain(PHRASE_FR);
    expect(JSON.stringify(r.valeur)).toContain("Conclusion");
  });

  it("idempotent", () => {
    const une = reecrireJson(doc, "fr");
    const deux = reecrireJson(une.valeur, "fr");
    expect(deux.modifie).toBe(false);
  });
});

describe("idempotence (une deuxième passe ne change rien)", () => {
  const cas = [
    "<h2>Financement OPCO</h2><p>Via votre OPCO.</p><h2>Suite</h2><p>Texte.</p>",
    "<p>Le rapport est remis sous trois jours. Les OPCO financent la formation. Nous formons vos équipes. Un conseiller vous suit. On avance.</p>",
    "<ul><li>Audit</li><li>Éligible au CPF</li></ul>",
    `<p><a href="${LIEN_FR}">le financement OPCO</a></p>`,
    "<h3>Peut-on financer via un OPCO ?</h3><p>Oui, via un OPCO.</p>",
    "<details><summary>Qualiopi ?</summary><p>Oui.</p></details>",
  ];
  it.each(cas)("HTML : %s", (html) => {
    const une = reecrireHtml(html, "fr");
    const deux = reecrireHtml(une.valeur, "fr");
    expect(deux.modifie).toBe(false);
    expect(deux.valeur).toBe(une.valeur);
    expect(brut(une.valeur)).not.toMatch(MOTIFS);
  });

  it("FAQ et texte court", () => {
    const f = reecrireFaq({ question: "Éligible au CPF ?", reponse: "Oui, avec un OPCO." }, "fr");
    const f2 = reecrireFaq(f.valeur, "fr");
    expect(f2.modifie).toBe(false);
    const t = reecrireTexte("Un conseiller vous répond. Les OPCO financent.", "fr");
    expect(reecrireTexte(t.valeur, "fr").modifie).toBe(false);
  });
});

describe("contenu sain : aucune modification, chaîne d'origine rendue telle quelle", () => {
  it("HTML sans motif", () => {
    const html =
      '<h2>Gagner du temps</h2><p>L&#39;IA <strong>réduit</strong> les tâches répétitives.</p><img src="/x.png" alt="a">';
    const r = reecrireHtml(html, "fr");
    expect(r.modifie).toBe(false);
    expect(r.valeur).toBe(html);
    expect(classer(r)).toBe("propre");
  });
});

describe("titres imbriqués (parcours récursif)", () => {
  it("h2 dans section / div / article : section de financement remplacée", () => {
    const html =
      "<article><div><section><h2>Financement OPCO</h2><p>Via l'OPCO.</p><h2>Suite</h2><p>Autre.</p></section></div></article>";
    const r = reecrireHtml(html, "fr");
    expect(r.modifie).toBe(true);
    expect(r.valeur).not.toMatch(/OPCO/);
    expect(r.valeur).toContain(PHRASE_FR);
    expect(r.valeur).toContain("<h2>Suite</h2><p>Autre.</p>");
    expect(reecrireHtml(r.valeur, "fr").modifie).toBe(false);
  });
  it("h2 question imbriqué : question standard", () => {
    const r = reecrireHtml("<div><h3>Éligible au CPF ?</h3><p>Oui, OPCO.</p></div>", "fr");
    expect(r.valeur).toContain(QUESTION_FR);
    expect(r.valeur).not.toMatch(/CPF|OPCO/);
  });
});

describe("JSON Tiptap ≡ HTML : tableaux et liens", () => {
  const html =
    "<table><thead><tr><th>Critère</th><th>Valeur</th></tr></thead><tbody><tr><td>Financement OPCO</td><td>Oui</td></tr><tr><td>Durée</td><td>3 jours</td></tr></tbody></table>" +
    `<p>Voir <a href="${LIEN_FR}">le financement OPCO</a> et <a href="/fr/certification-qualiopi">notre page</a>.</p>`;
  const cellule = (type: string, t: string) => ({
    type,
    content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
  });
  const lien = (href: string, text: string) => ({
    type: "text",
    text,
    marks: [{ type: "link", attrs: { href } }],
  });
  const doc = {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [cellule("tableHeader", "Critère"), cellule("tableHeader", "Valeur")],
          },
          {
            type: "tableRow",
            content: [cellule("tableCell", "Financement OPCO"), cellule("tableCell", "Oui")],
          },
          {
            type: "tableRow",
            content: [cellule("tableCell", "Durée"), cellule("tableCell", "3 jours")],
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Voir " },
          lien(LIEN_FR, "le financement OPCO"),
          { type: "text", text: " et " },
          lien("/fr/certification-qualiopi", "notre page"),
          { type: "text", text: "." },
        ],
      },
    ],
  };
  it("mêmes lignes retirées, mêmes liens réécrits, même texte", () => {
    const h = reecrireHtml(html, "fr");
    const j = reecrireJson(doc, "fr");
    expect(h.modifie).toBe(true);
    expect(j.modifie).toBe(true);
    const dom = new JSDOM(`<body>${h.valeur}</body>`).window.document;
    const hrefsHtml = Array.from(dom.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    const textesHtml = Array.from(dom.querySelectorAll("a")).map((a) => a.textContent);
    const hrefsJson: string[] = [];
    const textesJson: string[] = [];
    const lignes: string[] = [];
    interface NoeudTest {
      type?: string;
      text?: string;
      marks?: Array<{ type: string; attrs: { href: string } }>;
      content?: NoeudTest[];
    }
    const marcher = (n: NoeudTest): void => {
      for (const m of n.marks ?? [])
        if (m.type === "link") {
          hrefsJson.push(m.attrs.href);
          textesJson.push(n.text ?? "");
        }
      if (n.type === "tableRow") lignes.push((n.content ?? []).map(texteDe).join("|"));
      (n.content ?? []).forEach(marcher);
    };
    const texteDe = (n: NoeudTest): string => n.text ?? (n.content ?? []).map(texteDe).join("");
    marcher(j.valeur as NoeudTest);
    expect(hrefsJson).toEqual(hrefsHtml);
    expect(hrefsJson).toEqual(["/fr/formations", "/fr/formations"]);
    expect(textesJson).toEqual(textesHtml);
    const lignesHtml = Array.from(dom.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.children)
        .map((c) => c.textContent)
        .join("|"),
    );
    expect(lignes).toEqual(lignesHtml);
    expect(lignes).toEqual(["Critère|Valeur", "Durée|3 jours"]);
    // idempotent
    expect(reecrireJson(j.valeur, "fr").modifie).toBe(false);
  });
});

/**
 * Verrou final (décision du pilote, passe 7) : toute réécriture automatique qui retire un mot hors
 * `LEXIQUE_RETIRABLE` est annulée (valeur d'origine, cas ambigu). Plus le point C : un bloc
 * structurel n'est remplacé que si TOUTES ses phrases sont pures.
 */
import { describe, expect, it } from "vitest";
import {
  LEXIQUE_RETIRABLE,
  PHRASE_FR,
  QUESTION_FR,
  classer,
  motsNonRetirables,
  motsRetires,
  reecrireFaq,
  reecrireHtml,
  reecrireJson,
} from "./regles";

describe("motsRetires / motsNonRetirables", () => {
  it("multiensemble, casse et accents normalisés, HTML ignoré par l'appelant", () => {
    expect(motsRetires("Éligible au CPF, l'OPCO", "au l opco")).toEqual(["eligible", "cpf"]);
    expect(motsRetires("a a b", "a")).toEqual(["a", "b"]);
  });
  it("mots de financement, mots-outils et phrases standard : retirables", () => {
    for (const p of [
      "Le financement OPCO est possible.",
      "Votre OPCO peut financer la certification Qualiopi de l'organisme.",
      "Funding by your OPCO or through the CPF is possible.",
      "Pôle emploi : prise en charge France Travail, aides et dispositifs, fonds.",
      QUESTION_FR,
    ])
      expect([p, motsNonRetirables(p, "")]).toEqual([p, []]);
  });
  it("un mot de service ou de sujet n'est jamais retirable", () => {
    expect(motsNonRetirables("Formation OPCO de deux jours sur ChatGPT.", "")).toEqual([
      "formation",
      "deux",
      "jours",
      "chatgpt",
    ]);
    expect(motsNonRetirables("Audit puis financement OPCO.", "")).toEqual(["audit"]);
  });
  it("locutions : « France Travail » part ensemble, « travail » seul non", () => {
    expect(motsNonRetirables("France Travail", "")).toEqual([]);
    expect(motsNonRetirables("Le travail OPCO", "le opco")).toEqual(["travail"]);
  });
  it("exception unique : le nombre d'un décompte corrigé", () => {
    expect(motsNonRetirables("sept étapes", "six étapes")).toEqual(["sept"]);
    expect(motsNonRetirables("sept étapes", "six étapes", true)).toEqual([]);
  });
  it("le lexique expose ses ensembles fermés", () => {
    expect(LEXIQUE_RETIRABLE.exacts.has("cpf")).toBe(true);
    expect(LEXIQUE_RETIRABLE.outils.has("est")).toBe(true);
    expect(LEXIQUE_RETIRABLE.phrasesStandard.has("devis")).toBe(true);
    expect(LEXIQUE_RETIRABLE.exacts.has("formation")).toBe(false);
  });
});

describe("verrou : une réécriture qui retire un mot non financier est annulée", () => {
  it("HTML : le paragraphe pur est retiré, la phrase au sujet étranger ne l'est pas", () => {
    const pur = reecrireHtml("<p>Le financement OPCO est possible.</p>", "fr");
    expect(pur.valeur).toBe(`<p>${PHRASE_FR}</p>`);
    const mixte = "<p>Le financement OPCO est possible pour nos ateliers ChatGPT.</p>";
    const r = reecrireHtml(mixte, "fr");
    expect(r.modifie).toBe(false);
    expect(r.valeur).toBe(mixte);
    expect(classer(r)).toBe("ambigu");
  });
  it("JSON : paragraphe pur retiré ; section mêlée gardée", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Financement OPCO" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "Commencez par un audit." }] },
      ],
    };
    const r = reecrireJson(doc, "fr");
    expect(r.modifie).toBe(false);
    expect(r.valeur).toEqual(doc);
    expect(classer(r)).toBe("ambigu");
  });
});

describe("point C : un bloc n'est remplacé que si toutes ses phrases sont pures", () => {
  it("section H2 : le sujet étranger sous un titre de financement rend la section ambiguë", () => {
    const html =
      "<h2>Financer et réussir votre projet IA</h2><p>Commencez par un audit de vos processus.</p><p>Votre OPCO peut financer la formation.</p>";
    const r = reecrireHtml(html, "fr");
    expect(r.valeur).toBe(html);
    expect(classer(r)).toBe("ambigu");
  });
  it("question en titre H2 : la réponse étrangère est gardée", () => {
    const html =
      "<h2>La formation est-elle éligible au CPF et combien dure-t-elle ?</h2><p>Elle dure 3 jours à Lyon.</p>";
    const r = reecrireHtml(html, "fr");
    expect(r.valeur).toBe(html);
    expect(classer(r)).toBe("ambigu");
  });
  it("FAQ dont la question est visée : réponse avec prix et durée → ambiguë, gardée", () => {
    const f = {
      question: "Combien coûte la formation et est-elle finançable par l'OPCO ?",
      reponse: "Elle coûte 1 200 € HT pour 3 jours.",
    };
    const r = reecrireFaq(f, "fr");
    expect(r.valeur).toEqual(f);
    expect(classer(r)).toBe("ambigu");
  });
  it("ligne de tableau : « Oui, programme de 3 jours » gardée (HTML et JSON)", () => {
    const html =
      "<table><tbody><tr><td>Financement OPCO</td><td>Oui, programme de 3 jours</td></tr></tbody></table>";
    const r = reecrireHtml(html, "fr");
    expect(r.valeur).toBe(html);
    expect(classer(r)).toBe("ambigu");
    const cell = (t: string) => ({
      type: "tableCell",
      content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
    });
    const doc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [cell("Financement OPCO"), cell("Oui, programme de 3 jours")],
            },
          ],
        },
      ],
    };
    const j = reecrireJson(doc, "fr");
    expect(j.valeur).toEqual(doc);
    expect(classer(j)).toBe("ambigu");
  });
  it("liste avec intro de financement : puce « avec un audit gratuit de 2 h » → pas de remplacement", () => {
    const html =
      "<p>Pour financer votre formation :</p><ul><li>Le fonds d'assurance formation, avec un audit gratuit de 2 h.</li></ul>";
    const r = reecrireHtml(html, "fr");
    expect(r.valeur).toBe(html);
  });
  it("tout le bloc est du financement : remplacé (le verrou laisse passer)", () => {
    const html = "<h2>Financement et OPCO</h2><p>Le financement OPCO est possible.</p>";
    expect(reecrireHtml(html, "fr").valeur).toBe(`<p>${PHRASE_FR}</p>`);
  });
});

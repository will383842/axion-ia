import { describe, expect, it } from "vitest";
import { controlerLisibiliteV2, lisibiliteV2Active, mesurerLisibiliteV2 } from "../lisibilite-v2";
import { evaluerBarrieresRelecture } from "../barrieres-publication";

const ON = { CONTENU_LISIBILITE_V2: "true" };

/** ~320 mots, phrases courtes, un encadré, un intertitre en question. */
const PHRASE_COURTE = "Votre équipe gagne du temps chaque semaine grâce à un outil simple.";
const BON = `<h2>Pourquoi automatiser ?</h2>${Array.from(
  { length: 6 },
  () => `<p>${Array.from({ length: 5 }, () => PHRASE_COURTE).join(" ")}</p>`,
).join(
  "",
)}<aside class="ax-encadre ax-retenir"><p class="ax-encadre-titre">À retenir</p><p>Commencez petit.</p></aside>`;

/** Phrases de 40 mots, sans encadré. */
const MOT = "important ";
const LONGUE = `${MOT.repeat(39)}fin.`;
const MAUVAIS = `<h2>Le sujet</h2><p>${Array.from({ length: 10 }, () => LONGUE).join(" ")}</p>`;

describe("interrupteur CONTENU_LISIBILITE_V2", () => {
  it("n'est actif que pour la valeur exacte « true »", () => {
    expect(lisibiliteV2Active({ CONTENU_LISIBILITE_V2: "true" })).toBe(true);
    for (const v of [undefined, "", "1", "TRUE", "True", "true ", "yes"]) {
      expect(lisibiliteV2Active({ CONTENU_LISIBILITE_V2: v })).toBe(false);
    }
  });
  it("éteint : aucun contrôle, même sur un texte pénible", () => {
    expect(controlerLisibiliteV2(MAUVAIS, {}, "blog_article")).toEqual([]);
  });
});

describe("mesurerLisibiliteV2", () => {
  it("compte phrases, intertitres en question et encadrés", () => {
    const m = mesurerLisibiliteV2(BON);
    expect(m.motsParPhrase).toBeLessThan(15);
    expect(m.partPhrasesLongues).toBe(0);
    expect(m.nombreIntertitres).toBe(1);
    expect(m.partIntertitresQuestions).toBe(1);
    expect(m.nombreEncadres).toBe(1);
  });
  it("texte vide : des zéros", () => {
    const m = mesurerLisibiliteV2("");
    expect(m.mots).toBe(0);
    expect(m.motsParPhrase).toBe(0);
    expect(m.nombreEncadres).toBe(0);
  });
});

describe("controlerLisibiliteV2", () => {
  it("un texte clair et balisé ne remonte rien", () => {
    expect(controlerLisibiliteV2(BON, ON, "blog_article")).toEqual([]);
  });
  it("signale phrases longues, paragraphes longs et absence d'encadré", () => {
    const codes = controlerLisibiliteV2(MAUVAIS, ON, "blog_article").map((p) => p.code);
    expect(codes).toContain("lisibilite-phrases-longues");
    expect(codes).toContain("lisibilite-paragraphes-longs");
    expect(codes).toContain("lisibilite-sans-encadre");
  });
  it("n'exige pas d'encadré d'un type court (FAQ) ni sans type connu", () => {
    const sansEncadre = BON.replace(/<aside[\s\S]*<\/aside>/, "");
    expect(controlerLisibiliteV2(sansEncadre, ON, "faq_standalone")).toEqual([]);
    expect(controlerLisibiliteV2(sansEncadre, ON)).toEqual([]);
    expect(controlerLisibiliteV2(sansEncadre, ON, "blog_article").map((p) => p.code)).toEqual([
      "lisibilite-sans-encadre",
    ]);
  });
  it("un texte trop court n'est pas jugé", () => {
    expect(controlerLisibiliteV2("<p>Court.</p>", ON, "blog_article")).toEqual([]);
  });
});

describe("barrière de relecture « lisibilite-v2 »", () => {
  const entree = (html: string) => ({
    contentType: "blog_article",
    output: {
      directAnswer: "Réponse.",
      bodyHtml: html,
      faq: [],
      wordCount: 900,
      kbEntryIds: ["a"],
      plannedH2Count: 1,
    },
    corpus: new Map<string, string>(),
    ancreVille: false,
  });
  const codes = (html: string) => evaluerBarrieresRelecture(entree(html)).map((b) => b.code);

  it("éteint : jamais de barrière lisibilite-v2", () => {
    delete process.env.CONTENU_LISIBILITE_V2;
    expect(codes(MAUVAIS)).not.toContain("lisibilite-v2");
  });
  it("allumé : un texte pénible part en relecture, un texte clair non", () => {
    process.env.CONTENU_LISIBILITE_V2 = "true";
    try {
      expect(codes(MAUVAIS)).toContain("lisibilite-v2");
      expect(codes(BON)).not.toContain("lisibilite-v2");
    } finally {
      delete process.env.CONTENU_LISIBILITE_V2;
    }
  });
});

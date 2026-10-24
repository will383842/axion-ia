/**
 * Tests — barrières de publication (lot L2) : relecture humaine, doctrine
 * rejouée à la publication, garde fact-check à trois états.
 */

import { describe, expect, it } from "vitest";
import {
  compterH2,
  controlerSurfacePublication,
  decisionGardeFactCheck,
  evaluerBarrieresRelecture,
  sortieDepuisJson,
  type EntreeBarrieres,
} from "../barrieres-publication";

const OPTS = { actualite: false, financementPublicAutorise: false };
const VIDE: ReadonlyMap<string, string> = new Map();

/** Les valeurs `undefined` explicites servent à simuler un champ absent. */
type Surcharge = {
  [K in keyof EntreeBarrieres["output"]]?: EntreeBarrieres["output"][K] | undefined;
};

function entree(surcharge: Surcharge = {}, type = "blog_article"): EntreeBarrieres {
  const output = {
    directAnswer: "Réponse directe saine sur un sujet précis de déploiement.",
    bodyHtml: "<h2>A</h2><p>a</p><h2>B</h2><p>b</p>",
    faq: [],
    wordCount: 1000,
    kbEntryIds: ["kb-1"],
    plannedH2Count: 2,
    ...surcharge,
  } as EntreeBarrieres["output"];
  return { contentType: type, corpus: VIDE, ancreVille: false, output };
}

const codes = (e: EntreeBarrieres): string[] => evaluerBarrieresRelecture(e).map((b) => b.code);

describe("evaluerBarrieresRelecture", () => {
  it("ne signale rien sur un article sain", () => {
    expect(codes(entree())).toEqual([]);
  });

  it("signale « Section indisponible » dans le corps", () => {
    expect(
      codes(
        entree({
          bodyHtml:
            "<h2>A</h2><p><em>Section indisponible — re-génération recommandée.</em></p><h2>B</h2>",
        }),
      ),
    ).toContain("section-indisponible");
  });

  it("signale des sections manquantes au plan, pas des sections en plus", () => {
    expect(codes(entree({ plannedH2Count: 3 }))).toContain("h2-hors-plan");
    expect(codes(entree({ plannedH2Count: 1 }))).not.toContain("h2-hors-plan");
    expect(codes(entree({ plannedH2Count: undefined }))).not.toContain("h2-hors-plan");
  });

  it("signale le soft-404 (moins de 350 mots)", () => {
    expect(codes(entree({ wordCount: 200 }, "blog_from_rss"))).toContain("soft-404");
    expect(codes(entree({ wordCount: 400 }, "blog_from_rss"))).not.toContain("soft-404");
  });

  it("le plancher de 850 mots ne concerne que les articles longs", () => {
    expect(codes(entree({ wordCount: 700 }))).toContain("moins-de-850-mots");
    expect(codes(entree({ wordCount: 700 }, "blog_from_rss"))).not.toContain("moins-de-850-mots");
    expect(codes(entree({ wordCount: 700 }, "faq_standalone"))).not.toContain("moins-de-850-mots");
    expect(codes(entree({ wordCount: 850 }))).not.toContain("moins-de-850-mots");
  });

  it("aucun fait de base : seulement un tableau vide, hors actualité et Observatoire", () => {
    expect(codes(entree({ kbEntryIds: [] }))).toContain("aucun-fait-de-base");
    expect(codes(entree({ kbEntryIds: undefined }))).not.toContain("aucun-fait-de-base");
    expect(codes(entree({ kbEntryIds: [] }, "blog_from_rss"))).not.toContain("aucun-fait-de-base");
    expect(codes(entree({ kbEntryIds: [] }, "barometer_insight"))).not.toContain(
      "aucun-fait-de-base",
    );
  });

  it("signale une accroche trop proche d'un article publié", () => {
    const texte =
      "Une entreprise du bâtiment perd chaque semaine plusieurs heures à relancer ses devis à la main, alors qu'un simple suivi automatisé suffit.";
    const e: EntreeBarrieres = {
      ...entree({ directAnswer: texte }),
      corpus: new Map([["deja-publie", `${texte} La suite diffère.`]]),
    };
    expect(codes(e)).toContain("accroche-trop-proche");
  });

  it("chaque barrière a un libellé en français", () => {
    const b = evaluerBarrieresRelecture(entree({ wordCount: 100, kbEntryIds: [] }));
    expect(b.length).toBeGreaterThanOrEqual(3);
    for (const x of b) expect(x.libelle.length).toBeGreaterThan(10);
  });
});

describe("compterH2", () => {
  it("compte les h2 ouvrants", () => {
    expect(compterH2("<h2>A</h2><h3>x</h3><H2 id='b'>B</H2>")).toBe(2);
  });
});

describe("doctrine rejouée à la publication", () => {
  const sain = {
    title: "Automatiser ses relances de devis",
    metaTitle: "Relances de devis automatisées",
    metaDescription: "Un exemple simple pour relancer ses devis.",
    slug: "relances-devis",
    directAnswer: "Un suivi automatisé réduit les oublis.",
    bodyHtml: "<p>Texte sain.</p>",
    bodyText: "Texte sain.",
    faq: [{ question: "Pourquoi ?", answer: "Pour gagner du temps." }],
    tags: ["devis"],
  };

  it("laisse passer une sortie saine", () => {
    expect(controlerSurfacePublication(sain, OPTS)).toEqual([]);
  });

  it("retient un métatitre « éligible CPF »", () => {
    const v = controlerSurfacePublication({ ...sain, metaTitle: "Formation éligible CPF" }, OPTS);
    expect(v.some((x) => x.code === "cpf" && x.champ === "metaTitre")).toBe(true);
  });

  it("lit la FAQ et tolère un JSON mal formé", () => {
    const v = controlerSurfacePublication(
      {
        ...sain,
        faq: [{ question: "Q ?", answer: "Cette formation est éligible au CPF." }, 42, null],
      },
      OPTS,
    );
    expect(v.some((x) => x.champ === "faq[0].reponse")).toBe(true);
    expect(() =>
      sortieDepuisJson({ title: 5, faq: "x", tags: [1, "a"], expertQuote: 3 }),
    ).not.toThrow();
  });
});

describe("decisionGardeFactCheck", () => {
  const base = { actif: true, articleExiste: false, seuil: 40 };
  it("un score vide veut dire non vérifié, jamais refusé", () => {
    expect(decisionGardeFactCheck({ ...base, score: null })).toBe("non-verifie");
    expect(decisionGardeFactCheck({ ...base, score: undefined })).toBe("non-verifie");
  });
  it("met en quarantaine sous le seuil, laisse passer au seuil", () => {
    expect(decisionGardeFactCheck({ ...base, score: 39 })).toBe("quarantaine");
    expect(decisionGardeFactCheck({ ...base, score: 40 })).toBe("passer");
    expect(decisionGardeFactCheck({ ...base, score: 0 })).toBe("quarantaine");
  });
  it("ne touche pas un article déjà publié ni une garde éteinte", () => {
    expect(decisionGardeFactCheck({ ...base, articleExiste: true, score: 10 })).toBe("passer");
    expect(decisionGardeFactCheck({ ...base, actif: false, score: 10 })).toBe("passer");
  });
});

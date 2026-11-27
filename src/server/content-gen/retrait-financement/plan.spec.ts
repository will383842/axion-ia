import { describe, expect, it } from "vitest";
import {
  SLUGS_OFFRES_ARCHIVEES,
  appliquerOverrides,
  champsARestaurer,
  empreinte,
  empreintePlan,
  proposerArticle,
  proposerFaq,
  proposerOffre,
  proposerTraduction,
  rapportRestauration,
  reecrirePerks,
} from "./plan";
import { PHRASE_EN, PHRASE_FR, QUESTION_FR } from "./regles";

const offre = (o: Partial<Parameters<typeof proposerOffre>[0]> = {}) => ({
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

describe("plan — offres d'emploi", () => {
  it("les 3 offres de financement sont ARCHIVÉES (statut), jamais supprimées ni réécrites", () => {
    for (const slug of SLUGS_OFFRES_ARCHIVEES) {
      const p = proposerOffre(
        offre({ slug, titleFr: "Assistant — OPCO", bodyFr: "<p>CPF, OPCO</p>" }),
      );
      expect(p?.apres).toEqual({ status: "archived" });
      expect(p?.avant.status).toBe("published");
    }
  });
  it("offre déjà archivée : rien à faire", () => {
    expect(proposerOffre(offre({ slug: "charge-subventions", status: "archived" }))).toBeNull();
  });
  it("libellé « (financement) » retiré ; bodyText recalculé", () => {
    const p = proposerOffre(
      offre({
        titleFr: "Assistant·e — dossiers (financement)",
        bodyFr: "<p>Mission. Les OPCO financent.</p><p>Suite.</p>",
      }),
    );
    expect(p?.apres.titleFr).toBe("Assistant·e — dossiers");
    expect(String(p?.apres.bodyFr)).not.toMatch(/OPCO/);
    expect(String(p?.apres.bodyTextFr)).not.toMatch(/OPCO/);
  });
  it("offre saine : aucune proposition", () => expect(proposerOffre(offre())).toBeNull());
});

describe("plan — blog", () => {
  const trad = {
    id: "t1",
    locale: "fr" as const,
    title: "Guide",
    excerpt: "Un extrait.",
    body: "<p>Intro.</p><h2>Financement OPCO</h2><p>Via l'OPCO.</p>",
    bodyJson: null,
    bodyText: "Intro. Financement OPCO Via l'OPCO.",
    metaTitle: null,
    metaDescription: "Éligible au CPF.",
    ogImageAlt: null,
  };
  it("traduction : body et bodyText réécrits, méta ambiguë ; avant = sauvegarde", () => {
    const p = proposerTraduction(trad)!;
    expect(p.cle).toBe("article_translation:t1");
    expect(Object.keys(p.apres).sort()).toEqual(["body", "bodyText"]);
    // méta entièrement visée : jamais vidée, signalée pour un humain
    expect(p.ambigus.some((a) => a.includes("metaDescription"))).toBe(true);
    expect(p.avant.body).toBe(trad.body);
    expect(String(p.apres.body)).toContain(PHRASE_FR);
  });
  it("article : faqJson réécrit question et réponse", () => {
    const p = proposerArticle({
      id: "a1",
      directAnswer: null,
      keyTakeaway: null,
      expertQuoteText: null,
      featuredImageAltFr: null,
      featuredImageAltEn: null,
      faqJson: [
        { question: "Éligible au CPF ?", answer: "Oui via un OPCO." },
        { question: "Quel délai ?", answer: "Trois jours." },
      ],
    })!;
    const f = p.apres.faqJson as Array<{ question: string; answer: string }>;
    expect(f[0]!.answer).toBe(PHRASE_FR);
    expect(f[1]).toEqual({ question: "Quel délai ?", answer: "Trois jours." });
  });
  it("FAQ fille FR et EN", () => {
    const p = proposerFaq({
      id: "f1",
      questionFr: "Financement OPCO ?",
      answerFr: "Oui.",
      questionEn: "Funded by an OPCO?",
      answerEn: "Yes, OPCO.",
      metaTitle: null,
      metaDescription: null,
    })!;
    expect(p.apres.questionFr).toBe(QUESTION_FR);
    expect(p.apres.answerEn).toBe(PHRASE_EN);
  });
});

describe("overrides et empreinte du plan", () => {
  const trad = {
    id: "t2",
    locale: "fr" as const,
    title: "Chargé Qualiopi",
    excerpt: null,
    body: "<p>Texte.</p>",
    bodyJson: null,
    bodyText: null,
    metaTitle: null,
    metaDescription: null,
    ogImageAlt: null,
  };
  it("titre ambigu : conservé ; override accepté seulement si l'empreinte d'origine correspond", () => {
    const p = proposerTraduction(trad)!;
    expect(p.ambigus.length).toBe(1);
    expect(p.apres).toEqual({});
    const ok = appliquerOverrides(p, trad, {
      [p.cle]: { title: { origine: empreinte(trad.title), valeur: "Chargé qualité" } },
    });
    expect(ok.proposition.apres).toEqual({ title: "Chargé qualité" });
    expect(ok.proposition.ambigus).toEqual([]);
    const ko = appliquerOverrides(p, trad, {
      [p.cle]: { title: { origine: empreinte("autre"), valeur: "X" } },
    });
    expect(ko.proposition.apres).toEqual({});
    expect(ko.ignores.length).toBe(1);
  });
  it("empreinte stable, sensible au contenu écrit", () => {
    const a = proposerFaq({
      id: "f",
      questionFr: "OPCO ?",
      answerFr: "OPCO",
      questionEn: "q",
      answerEn: "a",
      metaTitle: null,
      metaDescription: null,
    })!;
    expect(empreintePlan([a])).toBe(empreintePlan([a]));
    expect(empreintePlan([a])).not.toBe(
      empreintePlan([{ ...a, apres: { ...a.apres, answerFr: "autre" } }]),
    );
  });
});

describe("sauvegarde complète (oldValue) et restauration partielle", () => {
  it("traduction : avant porte TOUS les champs textuels d'origine, apres les seuls modifiés", () => {
    const t = {
      id: "t9",
      locale: "fr" as const,
      title: "Guide",
      excerpt: "Un extrait.",
      body: "<p>Intro.</p><h2>Financement OPCO</h2><p>Via l'OPCO.</p>",
      bodyJson: { type: "doc", content: [] },
      bodyText: "Intro. Financement OPCO Via l'OPCO.",
      metaTitle: "Meta",
      metaDescription: "Desc",
      ogImageAlt: null,
    };
    const p = proposerTraduction(t)!;
    expect(Object.keys(p.apres).sort()).toEqual(["body", "bodyText"]);
    for (const [k, v] of Object.entries(t)) {
      if (k === "id" || k === "locale") continue;
      expect(p.avant, k).toHaveProperty(k);
      expect(p.avant[k], k).toEqual(v);
    }
  });
  it("offre archivée : avant = statut + tous les champs textuels ; apres = statut seul", () => {
    const o = offre({
      slug: "charge-subventions",
      titleFr: "Chargé de subventions",
      bodyFr: "<p>CPF, OPCO</p>",
      bodyTextFr: "CPF, OPCO",
      perks: [{ labelFr: "a", labelEn: "b" }],
    });
    const p = proposerOffre(o)!;
    expect(p.apres).toEqual({ status: "archived" });
    expect(p.avant.status).toBe("published");
    for (const k of [
      "titleFr",
      "titleEn",
      "summaryFr",
      "bodyFr",
      "bodyEn",
      "bodyTextFr",
      "metaTitle",
      "perks",
    ])
      expect(p.avant, k).toHaveProperty(k);
    expect(p.avant.bodyFr).toBe("<p>CPF, OPCO</p>");
    expect(p.avant.perks).toEqual([{ labelFr: "a", labelEn: "b" }]);
  });
  it("FAQ et article : tous les champs d'origine gardés", () => {
    const f = proposerFaq({
      id: "f",
      questionFr: "OPCO ?",
      answerFr: "OPCO",
      questionEn: "Delay?",
      answerEn: "Three days.",
      metaTitle: "m",
      metaDescription: null,
    })!;
    expect(f.avant).toMatchObject({
      questionEn: "Delay?",
      answerEn: "Three days.",
      metaTitle: "m",
    });
    expect(f.avant).toHaveProperty("metaDescription", null);
  });
  it("champsARestaurer : seulement les clés écrites, valeurs d'origine", () => {
    expect(champsARestaurer({ a: 1, b: 2, c: 3 }, { a: 9 })).toEqual({ a: 1 });
    // ancienne sauvegarde (champs modifiés seulement) : même résultat
    expect(champsARestaurer({ a: 1 }, { a: 9 })).toEqual({ a: 1 });
  });
  it("rapport de restauration : sans contenu, avec restaurés et divergences", () => {
    const r = rapportRestauration({
      restaures: 1,
      lignes: ["faq:f : answerFr"],
      divergences: ["x : divergence"],
    });
    expect(r).toContain("Contenus restaurés : 1");
    expect(r).toContain("faq:f : answerFr");
    expect(r).toContain("x : divergence");
  });
});

describe("perks des offres", () => {
  it("un avantage de financement est retiré, les autres restent ; idempotent", () => {
    const perks = [
      { labelFr: "Mutuelle", labelEn: "Health" },
      { labelFr: "Financement par l'OPCO", labelEn: "OPCO funding" },
    ];
    const p = proposerOffre(offre({ perks }))!;
    expect(p.apres.perks).toEqual([{ labelFr: "Mutuelle", labelEn: "Health" }]);
    expect(p.avant.perks).toEqual(perks);
    expect(reecrirePerks(p.apres.perks).modifie).toBe(false);
  });
  it("perks propres : rien à faire", () => {
    expect(
      proposerOffre(offre({ perks: [{ labelFr: "Mutuelle", labelEn: "Health" }] })),
    ).toBeNull();
  });
});

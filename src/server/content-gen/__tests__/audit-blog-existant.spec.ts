/**
 * Audit de l'existant du blog (lot L10) : le classement est pur et se teste sans base.
 *
 * Les deux sens comptent : un article sain ne doit figurer nulle part (sinon la
 * page crie au loup et plus personne ne la lit), et chaque catégorie doit
 * attraper son cas (sinon l'audit est muet sur ce qu'il prétend lister).
 */

import { describe, it, expect } from "vitest";
import {
  auditerArticles,
  campagneDeTest,
  CATEGORIES_AUDIT,
  compterMots,
  peutRetirerDeGoogle,
  type CategorieAudit,
  type EntreeAudit,
} from "../audit-blog-existant";

function entree(id: string, surchargeur: Partial<EntreeAudit> = {}): EntreeAudit {
  return {
    id,
    slug: `article-${id}`,
    titre: `Article ${id}`,
    indexationTier: "tier_1_indexable",
    isNews: false,
    templateVariant: null,
    qualityScore: 80,
    campagneNom: null,
    expertNom: null,
    expertTexte: null,
    mots: 900,
    surface: { corps: "Un texte sain sur le déploiement de l'IA dans une PME." },
    ...surchargeur,
  };
}

const OPTS = { financementPublicAutorise: false } as const;

function ids(r: ReturnType<typeof auditerArticles>, c: CategorieAudit): string[] {
  return r[c].map((l) => l.id);
}

describe("auditerArticles", () => {
  it("ne range nulle part un article sain", () => {
    const r = auditerArticles([entree("sain")], OPTS);
    for (const c of CATEGORIES_AUDIT) expect(r[c.id]).toHaveLength(0);
  });

  it("garde toutes les catégories présentes, même vides", () => {
    const r = auditerArticles([], OPTS);
    for (const c of CATEGORIES_AUDIT) expect(r[c.id]).toEqual([]);
  });

  it("attrape Qualiopi dans le corps et le dit avec le champ", () => {
    const r = auditerArticles(
      [entree("q", { surface: { corps: "Notre organisme est certifié Qualiopi." } })],
      OPTS,
    );
    expect(ids(r, "doctrine-grave")).toEqual(["q"]);
    expect(r["doctrine-grave"][0]?.constats[0]).toMatchObject({ code: "qualiopi", champ: "corps" });
  });

  it("attrape un interdit qui n'est que dans le titre ou la méta", () => {
    const r = auditerArticles(
      [entree("t", { surface: { titre: "Formation éligible au CPF", corps: "Texte sain." } })],
      OPTS,
    );
    expect(ids(r, "doctrine-grave")).toEqual(["t"]);
  });

  it("range un faux cas client dans les faux cas, pas dans la doctrine grave", () => {
    const r = auditerArticles(
      [entree("c", { surface: { corps: "Un de nos clients a doublé ses devis." } })],
      OPTS,
    );
    expect(ids(r, "faux-cas-clients")).toEqual(["c"]);
    expect(ids(r, "doctrine-grave")).toEqual([]);
  });

  it("range un article dont l'adresse évoque un cas concret, même sans motif dans le texte", () => {
    const r = auditerArticles([entree("s", { slug: "cas-concret-menuiserie" })], OPTS);
    expect(ids(r, "faux-cas-clients")).toEqual(["s"]);
    expect(r["faux-cas-clients"][0]?.constats).toEqual([]);
  });

  it("liste les avis signés avec le nom, et seulement si le texte existe aussi", () => {
    const r = auditerArticles(
      [
        entree("a", { expertNom: " Marie Dupont ", expertTexte: "L'IA change tout." }),
        entree("b", { expertNom: "Paul Martin", expertTexte: null }),
        entree("c", { expertNom: null, expertTexte: "Sans signature." }),
      ],
      OPTS,
    );
    expect(ids(r, "avis-signes")).toEqual(["a"]);
    expect(r["avis-signes"][0]?.signataire).toBe("Marie Dupont");
  });

  it("liste les pages Grenoble, sans les confondre avec la doctrine grave", () => {
    const r = auditerArticles(
      [entree("g", { surface: { titre: "L'IA à Grenoble", corps: "Texte sain." } })],
      OPTS,
    );
    expect(ids(r, "grenoble")).toEqual(["g"]);
    expect(ids(r, "doctrine-grave")).toEqual([]);
  });

  it("range promesses et étiquettes ensemble", () => {
    const r = auditerArticles(
      [entree("p", { surface: { corps: "Satisfaction garantie." } })],
      OPTS,
    );
    expect(ids(r, "promesses-etiquettes")).toEqual(["p"]);
  });

  it("liste les articles de moins de 500 mots, sauf les actualités", () => {
    const r = auditerArticles(
      [
        entree("court", { mots: 120 }),
        entree("pile", { mots: 500 }),
        entree("news", { mots: 120, isNews: true }),
      ],
      OPTS,
    );
    expect(ids(r, "tres-courts")).toEqual(["court"]);
  });

  it("repère l'article d'une campagne de test, mais pas « latest »", () => {
    const r = auditerArticles(
      [
        entree("x", { campagneNom: "Campagne test Grenoble" }),
        entree("y", { campagneNom: "latest news" }),
        entree("z", { campagneNom: null }),
      ],
      OPTS,
    );
    expect(ids(r, "test-publie")).toEqual(["x"]);
  });

  it("ne forme un groupe de doublons qu'à partir de deux articles d'une même famille", () => {
    const r = auditerArticles(
      [
        entree("1", { slug: "formation-ia-lyon" }),
        entree("2", { slug: "formation-ia-paris" }),
        entree("3", { slug: "certification-ia-managers-seul" }),
      ],
      OPTS,
    );
    expect(ids(r, "doublons")).toEqual(["1", "2"]);
    expect(r.doublons[0]?.famille).toBe("formation-ia-");
  });

  it("cite OPCO seulement quand la divulgation publique n'est pas autorisée", () => {
    const e = entree("o", {
      surface: { corps: "Une prise en charge par votre OPCO est possible." },
    });
    expect(
      ids(auditerArticles([e], { financementPublicAutorise: false }), "doctrine-grave"),
    ).toEqual(["o"]);
    expect(
      ids(auditerArticles([e], { financementPublicAutorise: true }), "doctrine-grave"),
    ).toEqual([]);
  });

  it("garde au plus quatre constats par article", () => {
    const r = auditerArticles(
      [
        entree("m", {
          surface: {
            titre: "Qualiopi et CPF",
            metaTitre: "Qualiopi",
            metaDescription: "CPF et Qualiopi",
            reponseDirecte: "Qualiopi",
            pointCle: "CPF",
            corps: "Qualiopi, CPF, financée à 100 %, partenaire officiel.",
          },
        }),
      ],
      OPTS,
    );
    expect(r["doctrine-grave"][0]?.constats.length).toBeLessThanOrEqual(4);
  });

  it("trie par adresse", () => {
    const r = auditerArticles(
      [entree("b", { slug: "b", mots: 10 }), entree("a", { slug: "a", mots: 10 })],
      OPTS,
    );
    expect(ids(r, "tres-courts")).toEqual(["a", "b"]);
  });
});

describe("aides", () => {
  it("compte les mots sans les balises", () => {
    expect(compterMots("<p>Un deux</p><p>trois</p>")).toBe(3);
    expect(compterMots("")).toBe(0);
  });

  it("campagneDeTest veut le mot entier", () => {
    expect(campagneDeTest("Test blog")).toBe(true);
    expect(campagneDeTest("blog-test-2")).toBe(true);
    expect(campagneDeTest("contest")).toBe(false);
    expect(campagneDeTest(null)).toBe(false);
  });

  it("ne propose « retirer de Google » que pour un article encore indexé", () => {
    expect(peutRetirerDeGoogle({ indexationTier: "tier_1_indexable" })).toBe(true);
    expect(peutRetirerDeGoogle({ indexationTier: "tier_2_noindex_follow" })).toBe(false);
    expect(peutRetirerDeGoogle({ indexationTier: "tier_3_noindex_nofollow" })).toBe(false);
  });

  it("ne propose aucun bouton sur Grenoble ni sur les articles courts (décision de Will)", () => {
    const geste = (id: CategorieAudit) => CATEGORIES_AUDIT.find((c) => c.id === id)?.geste;
    expect(geste("grenoble")).toBe("liste-seule");
    expect(geste("tres-courts")).toBe("liste-seule");
    expect(geste("avis-signes")).toBe("liste-seule");
  });
});

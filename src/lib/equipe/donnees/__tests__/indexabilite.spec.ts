import { describe, expect, it } from "vitest";
import { evaluerIndexabilite, SEUIL_ELEMENTS_PROPRES, type MembreIndexable } from "../indexabilite";

const LONG = "x".repeat(300);

function membre(surcharge: Partial<MembreIndexable> = {}): MembreIndexable {
  return {
    category: "developpeur",
    questionnaireVersion: "v1",
    photoKind: "reelle",
    photoConsentAt: new Date("2026-11-01T10:00:00Z"),
    bioMd: null,
    skills: [],
    languages: [],
    categoryAnswers: null,
    linkedinUrl: null,
    linkedinConsentAt: null,
    websiteUrl: null,
    ...surcharge,
  };
}

describe("evaluerIndexabilite", () => {
  it("le seuil est de 3 éléments propres", () => {
    expect(SEUIL_ELEMENTS_PROPRES).toBe(3);
  });

  it("fiche vide : non indexable, tout ce qui manque est dit", () => {
    const r = evaluerIndexabilite(membre());
    expect(r.indexable).toBe(false);
    expect(r.elementsPropres).toBe(0);
    expect(r.manque.length).toBeGreaterThan(0);
  });

  it("trois éléments propres + vraie photo consentie : indexable", () => {
    const r = evaluerIndexabilite(
      membre({ bioMd: LONG, skills: ["a", "b", "c"], websiteUrl: "https://exemple.fr" }),
    );
    expect(r).toMatchObject({ indexable: true, elementsPropres: 3, manque: [] });
  });

  it("sans consentement photo, une photo « reelle » ne compte pas", () => {
    const r = evaluerIndexabilite(
      membre({
        photoConsentAt: null,
        bioMd: LONG,
        skills: ["a", "b", "c"],
        websiteUrl: "https://exemple.fr",
      }),
    );
    expect(r.indexable).toBe(false);
    expect(r.manque.join(" ")).toMatch(/photo/i);
  });

  it("un avatar, même avec consentement photo, n'indexe pas", () => {
    const r = evaluerIndexabilite(
      membre({
        photoKind: "avatar",
        bioMd: LONG,
        skills: ["a", "b", "c"],
        websiteUrl: "https://exemple.fr",
      }),
    );
    expect(r.indexable).toBe(false);
  });

  it("deux éléments seulement : non indexable, il en manque un", () => {
    const r = evaluerIndexabilite(membre({ bioMd: LONG, skills: ["a", "b", "c"] }));
    expect(r.indexable).toBe(false);
    expect(r.elementsPropres).toBe(2);
    expect(r.manque.join(" ")).toMatch(/1 élément/);
  });

  it("présentation de 299 caractères ou compétences vides : ne comptent pas", () => {
    const r = evaluerIndexabilite(membre({ bioMd: "x".repeat(299), skills: ["a", " ", "b"] }));
    expect(r.elementsPropres).toBe(0);
  });

  it("l'exemple concret exige une réponse de catégorie marquée « exemple » d'au moins 120 caractères", () => {
    const court = evaluerIndexabilite(
      membre({ categoryAnswers: { projet_fier: "x".repeat(119) } }),
    );
    const ok = evaluerIndexabilite(membre({ categoryAnswers: { projet_fier: "x".repeat(120) } }));
    expect(court.elementsPropres).toBe(0);
    expect(ok.elementsPropres).toBe(1);
    // une réponse non marquée « exemple » ne compte pas
    expect(
      evaluerIndexabilite(membre({ categoryAnswers: { construit: "x".repeat(500) } }))
        .elementsPropres,
    ).toBe(0);
  });

  it("le parcours ou les certifications comptent une seule fois, même s'ils sont deux", () => {
    const r = evaluerIndexabilite(
      membre({ categoryAnswers: { experiences: "x".repeat(40), diplomes: "y".repeat(40) } }),
    );
    expect(r.elementsPropres).toBe(1);
  });

  it("LinkedIn ne compte qu'avec le consentement LinkedIn ; un site personnel https compte sans", () => {
    const sans = evaluerIndexabilite(membre({ linkedinUrl: "https://www.linkedin.com/in/x" }));
    const avec = evaluerIndexabilite(
      membre({
        linkedinUrl: "https://www.linkedin.com/in/x",
        linkedinConsentAt: new Date("2026-11-01T10:00:00Z"),
      }),
    );
    const site = evaluerIndexabilite(membre({ websiteUrl: "https://exemple.fr" }));
    const siteHttp = evaluerIndexabilite(membre({ websiteUrl: "http://exemple.fr" }));
    expect([sans.elementsPropres, avec.elementsPropres, site.elementsPropres]).toEqual([0, 1, 1]);
    expect(siteHttp.elementsPropres).toBe(0);
  });

  it("une langue autre que le français compte ; le français seul, non", () => {
    expect(evaluerIndexabilite(membre({ languages: ["Français", "fr"] })).elementsPropres).toBe(0);
    expect(
      evaluerIndexabilite(membre({ languages: ["Français", "Anglais"] })).elementsPropres,
    ).toBe(1);
  });

  it("une catégorie ou une version inconnue ne plante pas et ne gagne aucun point de catégorie", () => {
    const r = evaluerIndexabilite(
      membre({
        category: "inconnue",
        questionnaireVersion: "v99",
        categoryAnswers: { projet_fier: "x".repeat(500) },
      }),
    );
    expect(r.elementsPropres).toBe(0);
  });

  it("réponses de catégorie mal formées (non objet, valeurs non texte) : ignorées", () => {
    expect(evaluerIndexabilite(membre({ categoryAnswers: "oups" })).elementsPropres).toBe(0);
    expect(evaluerIndexabilite(membre({ categoryAnswers: [1, 2] })).elementsPropres).toBe(0);
    expect(
      evaluerIndexabilite(membre({ categoryAnswers: { projet_fier: 42 } })).elementsPropres,
    ).toBe(0);
  });
});

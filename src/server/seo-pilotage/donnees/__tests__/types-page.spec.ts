import { describe, expect, it } from "vitest";
import {
  categorizeRoute,
  SECTION_TO_CATEGORY,
  type RouteCategory,
} from "@/server/site-explorer/categories";
import { TYPES_PAGE, type TypePage, typePageDepuisChemin } from "../types-page";

describe("typePageDepuisChemin", () => {
  it.each([
    ["/fr/blog/un-article", "article"],
    ["/fr/actualites/une-news", "actualite"],
    ["/fr/guides/un-guide", "guide"],
    ["/fr/faq/une-question", "faq"],
    ["/fr/centre-aide/une-aide", "faq"],
    ["/fr/implantations/auvergne-rhone-alpes/lyon", "ville"],
    ["/fr/audit/par-ville/lyon", "ville"],
    ["/fr/audit", "offre"],
    ["/fr/interventions/collectives/1-jour", "offre"],
    ["/fr/a-propos", "institutionnel"],
    ["/fr/mentions-legales", "institutionnel"],
    ["/fr/contact", "conversion"],
    ["/fr/demande-devis", "conversion"],
    ["/fr/galerie/une-image", "galerie"],
    ["/fr/page-inconnue", "autre"],
  ] as const)("%s → %s", (chemin, attendu) => {
    expect(typePageDepuisChemin(chemin)).toBe(attendu);
  });

  it("la home FR est une offre (vitrine), la racine aussi", () => {
    expect(typePageDepuisChemin("/fr")).toBe("offre");
    expect(typePageDepuisChemin("/")).toBe("offre");
  });

  it("accepte un chemin sans préfixe de langue", () => {
    expect(typePageDepuisChemin("/blog/un-article")).toBe("article");
  });

  it("ne confond pas un préfixe avec un segment plus long", () => {
    expect(typePageDepuisChemin("/fr/blogue/x")).toBe("autre");
    expect(typePageDepuisChemin("/fr/faqs")).toBe("autre");
  });

  it("ne rend que des valeurs déclarées", () => {
    for (const c of ["/fr/blog/x", "/fr/zzz", "/fr", "/fr/guides/x"]) {
      expect(TYPES_PAGE).toContain(typePageDepuisChemin(c));
    }
  });
});

// Garde-fou : la table ne doit jamais diverger de categories.ts (SSOT section → catégorie).
const COMPATIBLE: Record<RouteCategory, ReadonlyArray<TypePage>> = {
  commercial: ["offre"],
  villes: ["ville"],
  contenu: ["article", "actualite", "guide"],
  aide: ["faq"],
  legal: ["institutionnel"],
  conversion: ["conversion"],
  transversal: ["institutionnel"],
  galerie: ["galerie"],
  autre: ["autre"],
};

// Toute la table de categories.ts, plus une section inconnue. `presse` est « contenu » côté
// categories.ts mais institutionnelle ici (exception assumée).
const SECTIONS = [...Object.keys(SECTION_TO_CATEGORY), "section-inconnue"];

describe("types-page : cohérence avec site-explorer/categories.ts", () => {
  it.each(SECTIONS)("section « %s »", (section) => {
    const categorie = categorizeRoute(section, `/fr/${section}/[slug]`);
    const type = typePageDepuisChemin(`/fr/${section}/un-slug`);
    if (section === "presse") return expect(type).toBe("institutionnel");
    expect(COMPATIBLE[categorie]).toContain(type);
  });

  it("page ville×service : même verdict que categorizeRoute", () => {
    const categorie = categorizeRoute("audit", "/fr/audit/par-ville/[ville]");
    expect(COMPATIBLE[categorie]).toContain(typePageDepuisChemin("/fr/audit/par-ville/lyon"));
  });
});

describe("sections réelles absentes de categories.ts", () => {
  it.each([
    ["formations", "offre"],
    ["catalogue", "offre"],
    ["secteurs", "offre"],
    ["certification-qualiopi", "offre"],
    ["diagnostic", "offre"],
    ["simulateur", "offre"],
    ["prix-audit-ia", "offre"],
    ["journee-ia", "offre"],
    ["podcast", "article"],
    ["avis", "institutionnel"],
    ["carrieres", "institutionnel"],
  ] as const)("%s → %s", (section, attendu) => {
    expect(typePageDepuisChemin(`/fr/${section}`)).toBe(attendu);
  });

  it("par-ville dans un article de blog ne le range pas en ville", () => {
    expect(typePageDepuisChemin("/fr/blog/guide-par-ville")).toBe("article");
    expect(typePageDepuisChemin("/fr/blog/par-ville/x")).toBe("article");
  });
});

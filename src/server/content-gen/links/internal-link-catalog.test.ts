import { describe, it, expect, afterEach, beforeEach } from "vitest";
import {
  construireCatalogueDynamique,
  getCatalogue,
  getRelevantInternalLinks,
  injectInternalLinks,
} from "./internal-link-catalog";

const routes = ["/journee-ia", "/audit", "/blog/[slug]", "/audit/par-ville/[ville]", "/glossaire"];
const sources = {
  routes,
  villes: [{ slug: "lyon", nameFr: "Lyon" }],
  articles: [{ slug: "audit-cabinets-comptables", title: "Audit IA des cabinets comptables" }],
};

beforeEach(() => {
  delete process.env["CONTENT_EQUIPE_EDITORIALE"];
});

afterEach(() => {
  delete process.env["CONTENT_EQUIPE_EDITORIALE"];
});

describe("catalogue V2", () => {
  it("met la Journée IA en tête, puis villes et articles", () => {
    const c = construireCatalogueDynamique(sources);
    expect(c[0]!.url).toBe("/journee-ia");
    const urls = c.map((e) => e.url);
    expect(urls.indexOf("/audit/par-ville/lyon")).toBeLessThan(
      urls.indexOf("/blog/audit-cabinets-comptables"),
    );
  });
  it("écarte les URLs hors routage", () => {
    const c = construireCatalogueDynamique({ ...sources, routes: ["/journee-ia"] });
    expect(c.map((e) => e.url)).toEqual(["/journee-ia"]);
  });
  it("trouve la page ville et l'article proche", () => {
    const c = construireCatalogueDynamique(sources);
    expect(getRelevantInternalLinks(["lyon"], [], 5, c)[0]!.url).toBe("/audit/par-ville/lyon");
    expect(getRelevantInternalLinks(["cabinets comptables"], [], 5, c)[0]!.url).toBe(
      "/blog/audit-cabinets-comptables",
    );
  });
});

describe("garde-fous V2", () => {
  it("n'ajoute pas les pages utilitaires, ni un slug dangereux", () => {
    const c = construireCatalogueDynamique({
      ...sources,
      routes: [...routes, "/rgpd", "/design"],
      articles: [{ slug: 'x"><b', title: "Audit cabinets comptables" }],
    });
    const urls = c.map((e) => e.url);
    expect(urls).not.toContain("/rgpd");
    expect(urls).not.toContain("/design");
    expect(urls.some((u) => u.includes('"'))).toBe(false);
  });
  it("une ville homonyme d'un mot courant ne matche pas un sujet voisin", () => {
    const c = construireCatalogueDynamique({
      ...sources,
      villes: [{ slug: "sens", nameFr: "Sens" }],
    });
    expect(getRelevantInternalLinks(["sensibilisation"], [], 5, c)).toEqual([]);
  });
});

describe("interrupteur", () => {
  it("éteint : même sortie que le catalogue V1 sur un corpus qui produit des liens", () => {
    const corps = "<p>Un audit et une formation, avec un devis.</p>";
    const sortie = injectInternalLinks(corps, "audit formation devis");
    expect(sortie).toContain('href="/audit"');
    expect(sortie).not.toContain("/journee-ia");
  });
  it("éteint : catalogue statique, pas de lien Journée IA", () => {
    expect(getCatalogue().some((e) => e.url === "/journee-ia")).toBe(false);
    expect(injectInternalLinks("<p>Une journée IA à Lyon.</p>", "journée lyon")).toBe(
      "<p>Une journée IA à Lyon.</p>",
    );
  });
  it("allumé : la Journée IA est liée", () => {
    process.env["CONTENT_EQUIPE_EDITORIALE"] = "true";
    expect(getCatalogue()[0]!.url).toBe("/journee-ia");
    expect(injectInternalLinks("<p>Une journée IA utile.</p>", "journée")).toContain(
      'href="/journee-ia"',
    );
  });
});

import { describe, it, expect, afterEach } from "vitest";
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

describe("interrupteur", () => {
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

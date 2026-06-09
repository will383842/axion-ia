// Tests catégorisation des URLs — onglet « Toutes les URLs » (2026-06-08).

import { describe, it, expect } from "vitest";
import { categorizeRoute, ROUTE_CATEGORY_LABELS } from "../categories";

describe("categorizeRoute", () => {
  it("hub de service → commercial", () => {
    expect(categorizeRoute("audit", "/fr/audit")).toBe("commercial");
    expect(categorizeRoute("sites-web-augmentes", "/fr/sites-web-augmentes")).toBe("commercial");
  });

  it("page ville×service (par-ville) → villes (pas commercial)", () => {
    expect(categorizeRoute("audit", "/fr/audit/par-ville/[ville]")).toBe("villes");
    expect(categorizeRoute("implementation", "/fr/implementation/par-ville/lyon")).toBe("villes");
  });

  it("implantations → villes", () => {
    expect(categorizeRoute("implantations", "/fr/implantations/[region]/[ville]")).toBe("villes");
  });

  it("contenu éditorial", () => {
    expect(categorizeRoute("blog", "/fr/blog/[slug]")).toBe("contenu");
    expect(categorizeRoute("glossaire", "/fr/glossaire/[slug]")).toBe("contenu");
    expect(categorizeRoute("actualites", "/fr/actualites/[slug]")).toBe("contenu");
  });

  it("aide", () => {
    expect(categorizeRoute("faq", "/fr/faq/[slug]")).toBe("aide");
    expect(categorizeRoute("centre-aide", "/fr/centre-aide/[slug]")).toBe("aide");
  });

  it("conversion / formulaires", () => {
    expect(categorizeRoute("contact", "/fr/contact")).toBe("conversion");
    expect(categorizeRoute("demande-devis", "/fr/demande-devis")).toBe("conversion");
  });

  it("légal & footer", () => {
    expect(categorizeRoute("mentions-legales", "/fr/mentions-legales")).toBe("legal");
    expect(categorizeRoute("rgpd", "/fr/rgpd")).toBe("legal");
  });

  it("home → commercial", () => {
    expect(categorizeRoute(null, "/fr")).toBe("commercial");
  });

  it("section inconnue → autre", () => {
    expect(categorizeRoute("truc-inconnu", "/fr/truc-inconnu/x")).toBe("autre");
  });

  it("chaque catégorie a un libellé", () => {
    for (const cat of [
      "commercial",
      "villes",
      "contenu",
      "aide",
      "legal",
      "conversion",
      "transversal",
      "galerie",
      "autre",
    ] as const) {
      expect(ROUTE_CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });
});

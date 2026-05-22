/**
 * Tests structurels — types ExternalLink + filtres concurrent.
 */

import { describe, it, expect } from "vitest";
import { ALL_EXTERNAL_LINKS } from "./master";
import { isCompetitorDomain, COMPETITOR_DOMAINS, COMPETITOR_EXCEPTIONS } from "./types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

describe("ExternalLink types & invariants", () => {
  it("ALL_EXTERNAL_LINKS contient au moins 50 liens bootstrap", () => {
    expect(ALL_EXTERNAL_LINKS.length).toBeGreaterThanOrEqual(50);
  });

  it("Tous les IDs sont uniques", () => {
    const ids = new Set<string>();
    for (const link of ALL_EXTERNAL_LINKS) {
      expect(ids.has(link.id), `ID dupliqué : ${link.id}`).toBe(false);
      ids.add(link.id);
    }
  });

  it("Tous les liens ont une URL HTTPS valide", () => {
    for (const link of ALL_EXTERNAL_LINKS) {
      expect(link.url.startsWith("https://"), `URL non HTTPS : ${link.url}`).toBe(true);
      expect(() => new URL(link.url)).not.toThrow();
      expect(link.isHttps, `${link.id} isHttps doit être true pour URL HTTPS`).toBe(true);
    }
  });

  it("Tous les liens ont verifiedAt + lastCheckedAt valides + autorité 1-5", () => {
    for (const link of ALL_EXTERNAL_LINKS) {
      expect(link.verifiedAt).toMatch(ISO_DATE_RE);
      expect(() => new Date(link.lastCheckedAt)).not.toThrow();
      expect(link.authority).toBeGreaterThanOrEqual(1);
      expect(link.authority).toBeLessThanOrEqual(5);
    }
  });

  it("Liens isCompetitor=true sont auto-seeded uniquement (jamais bootstrap manuel)", () => {
    // Les concurrents potentiels viennent du seed Claude qui peut récupérer des URLs
    // borderline — la détection isCompetitorDomain() les marque pour les exclure du
    // sélecteur. Aucun lien curé manuellement (bootstrap) ne doit être un concurrent.
    for (const link of ALL_EXTERNAL_LINKS) {
      if (link.isCompetitor) {
        expect(
          link.id.startsWith("auto-") || link.notes?.includes("Auto-seeded"),
          `${link.id} (${link.url}) marqué isCompetitor mais pas du seed auto — bug bootstrap`,
        ).toBe(true);
      }
    }
  });
});

describe("isCompetitorDomain", () => {
  it("Détecte les domaines concurrents racine", () => {
    expect(isCompetitorDomain("axionai.fr")).toBe(true);
    expect(isCompetitorDomain("cegos.fr")).toBe(true);
    expect(isCompetitorDomain("openclassrooms.com")).toBe(true);
  });

  it("Détecte les sous-domaines concurrents", () => {
    expect(isCompetitorDomain("www.axionai.fr")).toBe(true);
    expect(isCompetitorDomain("formation.cegos.fr")).toBe(true);
  });

  it("Respecte les exceptions (Capgemini Research)", () => {
    expect(isCompetitorDomain("capgemini-research-institute.com")).toBe(false);
  });

  it("Laisse passer les domaines neutres", () => {
    expect(isCompetitorDomain("insee.fr")).toBe(false);
    expect(isCompetitorDomain("www.cnil.fr")).toBe(false);
    expect(isCompetitorDomain("schema.org")).toBe(false);
  });
});

describe("Catalogue invariants métier", () => {
  it("Couvre les 5 verticales", () => {
    const verticales = new Set<string>();
    for (const link of ALL_EXTERNAL_LINKS) {
      for (const v of link.verticales) verticales.add(v);
    }
    expect(verticales.has("audits")).toBe(true);
    expect(verticales.has("interventions_formations")).toBe(true);
    expect(verticales.has("un_a_un")).toBe(true);
    expect(verticales.has("implementations")).toBe(true);
    expect(verticales.has("sites_web_augmentes")).toBe(true);
  });

  it("Au moins 1 lien EU AI Act", () => {
    const aiAct = ALL_EXTERNAL_LINKS.filter((l) => l.topics.includes("ai-act"));
    expect(aiAct.length).toBeGreaterThanOrEqual(1);
  });

  it("COMPETITOR_DOMAINS contient les concurrents directs", () => {
    expect(COMPETITOR_DOMAINS).toContain("axionai.fr");
    expect(COMPETITOR_DOMAINS).toContain("cegos.fr");
    expect(COMPETITOR_DOMAINS).toContain("openclassrooms.com");
    expect(COMPETITOR_EXCEPTIONS).toContain("capgemini-research-institute.com");
  });
});

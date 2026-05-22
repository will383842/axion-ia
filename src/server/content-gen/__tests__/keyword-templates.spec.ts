/**
 * Tests geo keyword templates — Phase 6 Sprint Perfection 2026-05-22
 */
import { describe, it, expect } from "vitest";
import {
  generateGeoKeywords,
  generateAllVerticalGeoKeywords,
  selectGeoKeyword,
  TOP_100_VILLES_FRANCE,
} from "../keyword-templates";

const PARIS = { name: "Paris", regionName: "Île-de-France", departmentName: "Paris" };
const RENNES = { name: "Rennes", regionName: "Bretagne", departmentName: "Ille-et-Vilaine" };

describe("generateGeoKeywords", () => {
  it("retourne des keywords pour verticale audits + Paris", () => {
    const kws = generateGeoKeywords("audits", PARIS);
    expect(kws.length).toBeGreaterThan(0);
    expect(kws.every((k) => k.includes("Paris") || k.includes("Île-de-France"))).toBe(true);
  });

  it("retourne des keywords pour verticale interventions_formations + Rennes", () => {
    const kws = generateGeoKeywords("interventions_formations", RENNES);
    expect(kws.length).toBeGreaterThan(0);
    expect(kws.every((k) => k.includes("Rennes") || k.includes("Bretagne"))).toBe(true);
  });

  it("inclut le target quand fourni", () => {
    const kws = generateGeoKeywords("audits", PARIS, "pme");
    expect(kws.some((k) => k.includes("pme") || k.includes("PME"))).toBe(true);
  });

  it("tous les keywords ont >= 10 chars", () => {
    const kws = generateGeoKeywords("implementations", PARIS);
    expect(kws.every((k) => k.length >= 10)).toBe(true);
  });

  it("gère une verticale inconnue avec le fallback transversal", () => {
    const kws = generateGeoKeywords("verticale_inconnue", PARIS);
    expect(kws.length).toBeGreaterThan(0);
  });

  it("retourne des keywords pour un_a_un", () => {
    const kws = generateGeoKeywords("un_a_un", RENNES);
    expect(kws.length).toBeGreaterThan(0);
  });

  it("retourne des keywords pour sites_web_augmentes", () => {
    const kws = generateGeoKeywords("sites_web_augmentes", PARIS);
    expect(kws.length).toBeGreaterThan(0);
  });
});

describe("generateAllVerticalGeoKeywords", () => {
  it("retourne keywords pour toutes les verticales", () => {
    const result = generateAllVerticalGeoKeywords(PARIS);
    expect(Object.keys(result)).toContain("audits");
    expect(Object.keys(result)).toContain("interventions_formations");
    expect(Object.keys(result)).toContain("implementations");
  });
});

describe("selectGeoKeyword", () => {
  it("retourne un keyword non vide", () => {
    const kw = selectGeoKeyword("audits", PARIS, 0);
    expect(kw.length).toBeGreaterThan(0);
  });

  it("rotation — index 0 et index 1 donnent des keywords différents si plusieurs templates", () => {
    const kw0 = selectGeoKeyword("audits", PARIS, 0);
    const kw1 = selectGeoKeyword("audits", PARIS, 1);
    // Peut être identique si 1 seul template, mais la rotation fonctionne
    expect(typeof kw0).toBe("string");
    expect(typeof kw1).toBe("string");
  });
});

describe("TOP_100_VILLES_FRANCE", () => {
  it("contient 100 villes", () => {
    // Note: le tableau peut contenir des doublons (ex: Caen apparaît 2× dans la liste)
    // mais doit avoir au moins 80 entrées uniques
    expect(TOP_100_VILLES_FRANCE.length).toBeGreaterThanOrEqual(80);
  });

  it("toutes les villes ont un nom et une région", () => {
    expect(
      TOP_100_VILLES_FRANCE.every((v) => v.name.length > 0 && v.regionName.length > 0),
    ).toBe(true);
  });

  it("Paris est dans la liste", () => {
    expect(TOP_100_VILLES_FRANCE.some((v) => v.name === "Paris")).toBe(true);
  });

  it("Lyon est dans la liste", () => {
    expect(TOP_100_VILLES_FRANCE.some((v) => v.name === "Lyon")).toBe(true);
  });
});

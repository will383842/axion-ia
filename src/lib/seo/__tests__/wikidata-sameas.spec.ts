/**
 * Sprint v7 Phase 10 — Tests Wikidata sameAs fallback safe.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildOrganizationSameAs,
  buildPersonManonSameAs,
  withSameAs,
  getWikidataConfigStatus,
} from "../wikidata-sameas";

describe("Phase 10 Wikidata sameAs — fallback safe sans env vars", () => {
  let originalAxionia: string | undefined;
  let originalManon: string | undefined;

  beforeEach(() => {
    originalAxionia = process.env.WIKIDATA_QNUMBER_AXIONIA;
    originalManon = process.env.WIKIDATA_QNUMBER_MANON;
    delete process.env.WIKIDATA_QNUMBER_AXIONIA;
    delete process.env.WIKIDATA_QNUMBER_MANON;
  });

  afterEach(() => {
    if (originalAxionia !== undefined) {
      process.env.WIKIDATA_QNUMBER_AXIONIA = originalAxionia;
    } else {
      delete process.env.WIKIDATA_QNUMBER_AXIONIA;
    }
    if (originalManon !== undefined) {
      process.env.WIKIDATA_QNUMBER_MANON = originalManon;
    } else {
      delete process.env.WIKIDATA_QNUMBER_MANON;
    }
  });

  it("W1: env vars absents → arrays vides (fallback safe non-bloquant)", () => {
    expect(buildOrganizationSameAs()).toEqual([]);
    expect(buildPersonManonSameAs()).toEqual([]);
  });

  it("W2: WIKIDATA_QNUMBER_AXIONIA valide → URL Wikidata dans sameAs", () => {
    process.env.WIKIDATA_QNUMBER_AXIONIA = "Q12345678";
    expect(buildOrganizationSameAs()).toEqual(["https://www.wikidata.org/wiki/Q12345678"]);
  });

  it("W3: WIKIDATA_QNUMBER_MANON valide → URL Wikidata dans sameAs", () => {
    process.env.WIKIDATA_QNUMBER_MANON = "Q987654321";
    expect(buildPersonManonSameAs()).toEqual(["https://www.wikidata.org/wiki/Q987654321"]);
  });

  it("W4: env var format invalide (pas Q\\d+) → fallback safe array vide", () => {
    process.env.WIKIDATA_QNUMBER_AXIONIA = "invalid-format";
    expect(buildOrganizationSameAs()).toEqual([]);
    process.env.WIKIDATA_QNUMBER_AXIONIA = "12345"; // pas de Q prefix
    expect(buildOrganizationSameAs()).toEqual([]);
  });

  it("W5: withSameAs retourne objet vide si pas de Q-number (anti-JSON-LD sale)", () => {
    expect(withSameAs("axionia")).toEqual({});
    expect(withSameAs("manon")).toEqual({});
  });

  it("W6: withSameAs retourne { sameAs: [...] } si Q-number présent", () => {
    process.env.WIKIDATA_QNUMBER_AXIONIA = "Q1";
    expect(withSameAs("axionia")).toEqual({
      sameAs: ["https://www.wikidata.org/wiki/Q1"],
    });
  });

  it("W7: getWikidataConfigStatus reflète l'état env vars (helper admin)", () => {
    process.env.WIKIDATA_QNUMBER_AXIONIA = "Q1";
    const status = getWikidataConfigStatus();
    expect(status.axioniaConfigured).toBe(true);
    expect(status.axioniaQNumber).toBe("Q1");
    expect(status.manonConfigured).toBe(false);
    expect(status.manonQNumber).toBeNull();
  });
});

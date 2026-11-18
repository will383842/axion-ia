import { describe, expect, it } from "vitest";

import { CHIFFRES_PUBLICS } from "../chiffres-publics";

const DOMAINES_OFFICIELS = [
  "insee.fr",
  "ec.europa.eu",
  "digital-strategy.ec.europa.eu",
  "banque-france.fr",
  "bpifrance.fr",
  "bpifrance-lelab.fr",
  "francenum.gouv.fr",
  "entreprises.gouv.fr",
  "cnil.fr",
];

describe("CHIFFRES_PUBLICS", () => {
  it("contient au moins 30 chiffres", () => {
    expect(CHIFFRES_PUBLICS.length).toBeGreaterThanOrEqual(30);
  });

  it("a des identifiants uniques", () => {
    const ids = CHIFFRES_PUBLICS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(CHIFFRES_PUBLICS.map((c) => [c.id, c] as const))("%s : champs valides", (_id, c) => {
    const url = new URL(c.url);
    expect(url.protocol).toBe("https:");
    expect(
      DOMAINES_OFFICIELS.some((d) => url.hostname === d || url.hostname.endsWith("." + d)),
    ).toBe(true);
    expect(url.pathname).not.toBe("/");
    expect(url.pathname.length).toBeGreaterThan(1);
    expect(Number.isInteger(c.annee)).toBe(true);
    expect(c.annee).toBeLessThanOrEqual(2026);
    expect(c.consulteLe).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(c.consulteLe))).toBe(false);
    expect(c.valeur.trim()).not.toBe("");
    expect(c.perimetre.trim()).not.toBe("");
    expect(c.source.trim()).not.toBe("");
    expect(c.extrait.trim().split(/\s+/).length).toBeLessThanOrEqual(25);
    expect(c.citation.trim()).not.toBe("");
    expect(c.citation).toContain(c.valeur);
  });
});

import { describe, expect, it } from "vitest";
import {
  CHIFFRES_VERIFIES,
  REGLE_CHIFFRES_SOURCES,
  sectionChiffresVerifies,
  type ChiffreVerifie,
} from "../chiffres-verifies";

describe("chiffres-verifies", () => {
  it("chaque entrée a une source, une URL https et une date AAAA-MM-JJ", () => {
    for (const c of CHIFFRES_VERIFIES) {
      expect(c.source.length).toBeGreaterThan(0);
      expect(c.url.startsWith("https://")).toBe(true);
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("liste vide : aucune section ajoutée au prompt", () => {
    expect(sectionChiffresVerifies([])).toBe("");
  });

  it("liste non vide : la section cite valeur, source, date et URL", () => {
    const exemple: ChiffreVerifie = {
      valeur: "00 %",
      libelle: "Exemple de test.",
      source: "Source de test",
      url: "https://exemple.test/page",
      date: "2026-10-24",
    };
    const out = sectionChiffresVerifies([exemple]);
    expect(out).toContain("CHIFFRES VÉRIFIÉS");
    expect(out).toContain("00 %");
    expect(out).toContain("Source de test");
    expect(out).toContain("2026-10-24");
    expect(out).toContain("https://exemple.test/page");
  });

  it("la règle commune interdit l'exigence de statistiques et les chiffres inventés", () => {
    expect(REGLE_CHIFFRES_SOURCES).toContain("CHIFFRES VÉRIFIÉS");
    expect(REGLE_CHIFFRES_SOURCES).not.toMatch(/au moins 2 statistiques/i);
  });
});

import { describe, expect, it } from "vitest";
import {
  DOCUMENT_REGISTER_TYPES,
  ENTITY_REGISTER_TYPES,
  formatDocumentNumber,
  formatSeriesNumber,
  isValidDocumentNumber,
  NUMBERING_PREFIX,
  parseSequence,
  SERIES_WITHOUT_YEAR,
  seriesPrefix,
  type NumberingType,
} from "./formats";

describe("formatDocumentNumber", () => {
  it("formate un numéro standard zero-paddé", () => {
    expect(formatDocumentNumber("formation", 2026, 1)).toBe("AXI-FORM-2026-001");
    expect(formatDocumentNumber("facture", 2026, 42)).toBe("AXI-FACT-2026-042");
    expect(formatDocumentNumber("session", 2026, 7)).toBe("AXI-SESS-2026-007");
  });
  it("ne tronque pas au-delà de 999", () => {
    expect(formatDocumentNumber("facture", 2026, 1234)).toBe("AXI-FACT-2026-1234");
  });
  it("ajoute le suffixe -R0N pour les sessions récurrentes", () => {
    expect(formatDocumentNumber("session", 2026, 1, 1)).toBe("AXI-SESS-2026-001-R01");
    expect(formatDocumentNumber("session", 2026, 1, 12)).toBe("AXI-SESS-2026-001-R12");
  });
  it("couvre tous les types de préfixe déclarés", () => {
    // 🔴 Passe par `formatSeriesNumber` et non `formatDocumentNumber` : la série
    // `client` est sans millésime, et `formatDocumentNumber` refuse désormais de
    // lui inventer un `AXI-CLI-2026-001` qui n'existe nulle part en base.
    for (const type of Object.keys(NUMBERING_PREFIX) as NumberingType[]) {
      const annee = SERIES_WITHOUT_YEAR.has(type) ? null : 2026;
      const n = formatSeriesNumber(type, annee, 1);
      expect(n.startsWith(NUMBERING_PREFIX[type])).toBe(true);
      // 🔴 C'est LE test qui aurait attrapé la dérive `AXI-CLI-NNN` : tout numéro
      // qu'un allocateur peut produire doit satisfaire le validateur officiel.
      expect(isValidDocumentNumber(n)).toBe(true);
    }
  });

  it("refuse de millésimer une série qui n'a pas de millésime", () => {
    expect(() => formatDocumentNumber("client", 2026, 1)).toThrow();
    expect(formatSeriesNumber("client", null, 1)).toBe("AXI-CLI-001");
  });
  it("rejette les entrées invalides", () => {
    expect(() => formatDocumentNumber("formation", 1999, 1)).toThrow();
    expect(() => formatDocumentNumber("formation", 2026, 0)).toThrow();
    expect(() => formatDocumentNumber("formation", 2026, 1, 0)).toThrow();
  });
});

describe("isValidDocumentNumber", () => {
  it("accepte les numéros bien formés", () => {
    expect(isValidDocumentNumber("AXI-CERT-2026-001")).toBe(true);
    expect(isValidDocumentNumber("AXI-SESS-2026-001-R03")).toBe(true);
    expect(isValidDocumentNumber("AXI-DOC-2026-001")).toBe(true);
    expect(isValidDocumentNumber("AXI-COACH-2026-001")).toBe(true);
    // Format réellement en base pour les 2 clients de production.
    expect(isValidDocumentNumber("AXI-CLI-001")).toBe(true);
  });
  it("rejette les numéros mal formés", () => {
    expect(isValidDocumentNumber("AXI-XXX-2026-001")).toBe(false);
    expect(isValidDocumentNumber("FORM-2026-001")).toBe(false);
    expect(isValidDocumentNumber("AXI-FORM-2026-1")).toBe(false);
    // La série client n'a QU'UN format. Accepter les deux, ce serait recréer
    // l'ambiguïté que ce correctif supprime.
    expect(isValidDocumentNumber("AXI-CLI-2026-001")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Registres — les garde-fous qui rendent la régression V19 impossible
// ─────────────────────────────────────────────────────────────────────────────

describe("registres de numérotation", () => {
  it("l'intersection des deux registres est VIDE", () => {
    // Si ce test tombe, c'est qu'un type sert à la fois à identifier un objet
    // métier et un tirage PDF : le même numéro désignera deux choses.
    const entites = new Set<string>(ENTITY_REGISTER_TYPES);
    const intersection = DOCUMENT_REGISTER_TYPES.filter((t) => entites.has(t));
    expect(intersection).toEqual([]);
  });

  it("l'union des deux registres couvre exactement NUMBERING_PREFIX", () => {
    // Un type ne peut pas être ajouté sans être rattaché à un registre.
    const union = [...ENTITY_REGISTER_TYPES, ...DOCUMENT_REGISTER_TYPES].sort();
    expect(union).toEqual(Object.keys(NUMBERING_PREFIX).sort());
  });

  it("deux types ne partagent jamais le même préfixe littéral", () => {
    const prefixes = Object.values(NUMBERING_PREFIX);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});

describe("seriesPrefix / parseSequence", () => {
  it("seriesPrefix distingue les séries millésimées de la série client", () => {
    expect(seriesPrefix("facture", 2026)).toBe("AXI-FACT-2026-");
    expect(seriesPrefix("client", null)).toBe("AXI-CLI-");
    expect(seriesPrefix("client", 2026)).toBe("AXI-CLI-");
    expect(() => seriesPrefix("facture", null)).toThrow();
  });

  it("extrait le compteur, sans plafond à 3 chiffres", () => {
    expect(parseSequence("AXI-FACT-2026-007", "AXI-FACT-2026-")).toBe(7);
    expect(parseSequence("AXI-FACT-2026-1000", "AXI-FACT-2026-")).toBe(1000);
    expect(parseSequence("AXI-CLI-002", "AXI-CLI-")).toBe(2);
  });

  it("une occurrence récurrente ne crée pas d'entrée de série distincte", () => {
    expect(parseSequence("AXI-SESS-2026-001-R03", "AXI-SESS-2026-")).toBe(1);
  });

  it("exclut du dénominateur tout ce qui n'appartient pas à la série", () => {
    // Formes qui existent (fixtures, brouillons) ou qui pourraient exister
    // (reprise d'historique, millésimage accidentel de la série client) et qui
    // fausseraient le compteur.
    expect(parseSequence("AXI-FOR-DEMO-001", "AXI-FORM-2026-")).toBeNull();
    expect(parseSequence("AXI-DEV-2026-DEMO-001", "AXI-DEV-2026-")).toBeNull();
    expect(parseSequence("BROUILLON-9f3ac2b1e4d05a6c", "AXI-FACT-2026-")).toBeNull();
    expect(parseSequence("AXI-FACT-2026-0900-IMPORT", "AXI-FACT-2026-")).toBeNull();
    expect(parseSequence("AXI-CLI-2026-003", "AXI-CLI-")).toBeNull();
    expect(parseSequence("AXI-FACT-2026-001", "AXI-AVO-2026-")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { formatDocumentNumber, isValidDocumentNumber, NUMBERING_PREFIX } from "./formats";

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
    for (const type of Object.keys(NUMBERING_PREFIX) as (keyof typeof NUMBERING_PREFIX)[]) {
      const n = formatDocumentNumber(type, 2026, 1);
      expect(n.startsWith(NUMBERING_PREFIX[type])).toBe(true);
      expect(isValidDocumentNumber(n)).toBe(true);
    }
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
  });
  it("rejette les numéros mal formés", () => {
    expect(isValidDocumentNumber("AXI-XXX-2026-001")).toBe(false);
    expect(isValidDocumentNumber("FORM-2026-001")).toBe(false);
    expect(isValidDocumentNumber("AXI-FORM-2026-1")).toBe(false);
  });
});

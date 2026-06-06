/**
 * Tests unitaires — inferOpcoFromNaf.
 *
 * Module PUR : aucune dépendance DB / next. Importable directement par Vitest.
 */

import { describe, it, expect } from "vitest";
import { inferOpcoFromNaf, NAF_OPCO_MAP } from "./naf-opco";

describe("inferOpcoFromNaf", () => {
  it("retourne 'atlas' pour 6201Z (édition logiciel informatique)", () => {
    expect(inferOpcoFromNaf("6201Z")).toBe("atlas");
  });

  it("retourne 'atlas' pour 6202A (conseil en systèmes)", () => {
    expect(inferOpcoFromNaf("6202A")).toBe("atlas");
  });

  it("retourne 'atlas' pour 7022Z (conseil pour les affaires)", () => {
    expect(inferOpcoFromNaf("7022Z")).toBe("atlas");
  });

  it("retourne 'akto' pour 5510Z (hôtels)", () => {
    expect(inferOpcoFromNaf("5510Z")).toBe("akto");
  });

  it("retourne 'akto' pour 5610A (restauration traditionnelle)", () => {
    expect(inferOpcoFromNaf("5610A")).toBe("akto");
  });

  it("retourne 'akto' pour 5630Z (débits de boissons)", () => {
    expect(inferOpcoFromNaf("5630Z")).toBe("akto");
  });

  it("retourne 'opcommerce' pour 4711A (commerce de détail alimentaire)", () => {
    expect(inferOpcoFromNaf("4711A")).toBe("opcommerce");
  });

  it("retourne 'opcommerce' pour 4711B", () => {
    expect(inferOpcoFromNaf("4711B")).toBe("opcommerce");
  });

  it("retourne 'opco2i' pour 2562B (décolletage)", () => {
    expect(inferOpcoFromNaf("2562B")).toBe("opco2i");
  });

  it("retourne 'opco2i' pour 2599B (fabrication d'articles métalliques)", () => {
    expect(inferOpcoFromNaf("2599B")).toBe("opco2i");
  });

  it("retourne 'opco2i' pour 2849Z (fabrication de machines-outils)", () => {
    expect(inferOpcoFromNaf("2849Z")).toBe("opco2i");
  });

  it("retourne 'constructys' pour 4120A (construction maisons individuelles)", () => {
    expect(inferOpcoFromNaf("4120A")).toBe("constructys");
  });

  it("retourne 'constructys' pour 4321A (travaux d'installation électrique)", () => {
    expect(inferOpcoFromNaf("4321A")).toBe("constructys");
  });

  it("retourne 'constructys' pour 4322A (travaux plomberie)", () => {
    expect(inferOpcoFromNaf("4322A")).toBe("constructys");
  });

  it("retourne 'constructys' pour 4399C (travaux de maçonnerie générale)", () => {
    expect(inferOpcoFromNaf("4399C")).toBe("constructys");
  });

  it("retourne null pour un code inconnu", () => {
    expect(inferOpcoFromNaf("9999Z")).toBeNull();
  });

  it("retourne null pour null", () => {
    expect(inferOpcoFromNaf(null)).toBeNull();
  });

  it("retourne null pour undefined", () => {
    expect(inferOpcoFromNaf(undefined)).toBeNull();
  });

  it("retourne null pour une chaîne vide", () => {
    expect(inferOpcoFromNaf("")).toBeNull();
  });

  it("est insensible à la casse (minuscules)", () => {
    expect(inferOpcoFromNaf("6201z")).toBe("atlas");
  });

  it("tolère le format avec point (62.01Z)", () => {
    expect(inferOpcoFromNaf("62.01Z")).toBe("atlas");
  });

  it("exporte NAF_OPCO_MAP (testabilité)", () => {
    expect(typeof NAF_OPCO_MAP).toBe("object");
    expect(NAF_OPCO_MAP["6201Z"]).toBe("atlas");
  });
});

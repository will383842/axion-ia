/**
 * Tests unitaires — inferOpcoFromNaf.
 *
 * Module PUR : aucune dépendance DB / next. Importable directement par Vitest.
 */

import { describe, it, expect } from "vitest";
import {
  IDCC_OPCO_MAP,
  inferOpco,
  inferOpcoFromIdcc,
  inferOpcoFromNaf,
  NAF_OPCO_MAP,
} from "./naf-opco";
import { isOpcoId } from "@/server/qualiopi/financements/opco-referentiel";

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

  it("retourne 'akto' pour 8559A (formation continue d'adultes) — le trou F6", () => {
    expect(inferOpcoFromNaf("8559A")).toBe("akto");
  });

  it("tolère « 85.59A » et la casse minuscule", () => {
    expect(inferOpcoFromNaf("85.59A")).toBe("akto");
    expect(inferOpcoFromNaf("8559a")).toBe("akto");
  });

  it("tolère « 85.59.A » — régression du replace sans drapeau /g", () => {
    expect(inferOpcoFromNaf("85.59.A")).toBe("akto");
  });

  it("🔴 ne rattache PAS 8559B à akto (classe ambiguë, repli interdit)", () => {
    // « Autres enseignements » : langues, soutien scolaire, artistique, sportif.
    // Leur OPCO dépend de la branche (Afdas / Uniformation / OPCO EP).
    expect(inferOpcoFromNaf("8559B")).toBeNull();
  });

  it("🔴 ne résout PAS un NAF tronqué (« 85 », « 855 »)", () => {
    expect(inferOpcoFromNaf("85")).toBeNull();
    expect(inferOpcoFromNaf("855")).toBeNull();
  });

  it("laisse l'enseignement scolaire et supérieur à null", () => {
    expect(inferOpcoFromNaf("8510Z")).toBeNull();
    expect(inferOpcoFromNaf("8542Z")).toBeNull();
    expect(inferOpcoFromNaf("8560Z")).toBeNull();
  });
});

describe("inferOpcoFromIdcc", () => {
  it("retourne 'akto' pour l'IDCC 1516 (CCN des organismes de formation)", () => {
    expect(inferOpcoFromIdcc("1516")).toBe("akto");
  });

  it("normalise le zéro de tête et les espaces", () => {
    expect(inferOpcoFromIdcc("01516")).toBe("akto");
    expect(inferOpcoFromIdcc("1 516")).toBe("akto");
  });

  it("ne tronque PAS un code trop long", () => {
    expect(inferOpcoFromIdcc("11516")).toBeNull();
    expect(inferOpcoFromIdcc("123456")).toBeNull();
  });

  it("retourne null pour null, vide ou inconnu", () => {
    expect(inferOpcoFromIdcc(null)).toBeNull();
    expect(inferOpcoFromIdcc("")).toBeNull();
    expect(inferOpcoFromIdcc("9999")).toBeNull();
  });

  it("chaque entrée porte une source citable (veille légale, ind. 23/24)", () => {
    for (const entree of Object.values(IDCC_OPCO_MAP)) {
      expect(entree.source.length).toBeGreaterThan(20);
    }
  });
});

describe("inferOpco — IDCC prioritaire", () => {
  it("l'IDCC (autoritaire) l'emporte sur le NAF", () => {
    expect(inferOpco({ idcc: "1516", naf: "6201Z" })).toBe("akto");
  });

  it("le repli NAF est conservé quand l'IDCC est absent", () => {
    expect(inferOpco({ idcc: null, naf: "6201Z" })).toBe("atlas");
  });

  it("retourne null quand les deux sont absents", () => {
    expect(inferOpco({ idcc: null, naf: null })).toBeNull();
  });
});

describe("cohérence des maps avec le référentiel OPCO", () => {
  it("aucune valeur hors des 11 OPCO connus (anti-typo)", () => {
    // La colonne Client.opcoIdentifie est un VarChar(60) sans enum : un slug
    // erroné s'écrirait sans erreur et ne se verrait qu'à l'affichage.
    for (const v of Object.values(NAF_OPCO_MAP)) expect(isOpcoId(v)).toBe(true);
    for (const e of Object.values(IDCC_OPCO_MAP)) expect(isOpcoId(e.opco)).toBe(true);
  });
});

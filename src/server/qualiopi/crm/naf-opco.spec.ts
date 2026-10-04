/**
 * Tests unitaires — inferOpcoFromNaf.
 *
 * Module PUR : aucune dépendance DB / next. Importable directement par Vitest.
 */

import { describe, it, expect } from "vitest";
import {
  inferOpco,
  inferOpcoDepuisTable,
  inferOpcoFromNaf,
  NAF_OPCO_MAP,
  normaliserIdcc,
  opcosDeLIdcc,
  type LecteurIdccOpco,
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

/** Fausse table `idcc_opco` : couples (idcc, opco), comme la base. */
function table(couples: Array<[string, string]>): LecteurIdccOpco & { cles: string[] } {
  const cles: string[] = [];
  return {
    cles,
    idccOpco: {
      async findMany({ where }) {
        cles.push(where.idcc);
        return couples.filter(([i]) => i === where.idcc).map(([, opco]) => ({ opco }));
      },
    },
  };
}

describe("normaliserIdcc", () => {
  it("normalise le zéro de tête et les espaces", () => {
    expect(normaliserIdcc("1516")).toBe("1516");
    expect(normaliserIdcc("01516")).toBe("1516");
    expect(normaliserIdcc("1 516")).toBe("1516");
    expect(normaliserIdcc("16")).toBe("0016");
  });

  it("ne tronque PAS un code trop long, et rend null pour null ou vide", () => {
    expect(normaliserIdcc("11516")).toBeNull();
    expect(normaliserIdcc("123456")).toBeNull();
    expect(normaliserIdcc(null)).toBeNull();
    expect(normaliserIdcc("")).toBeNull();
  });
});

describe("opcosDeLIdcc — lecture de la table idcc_opco (INT-T60-A)", () => {
  it("rend les OPCO de la table pour l'IDCC normalisé", async () => {
    const t = table([
      ["1516", "akto"],
      ["1516", "opco2i"],
      ["1486", "atlas"],
    ]);
    expect(await opcosDeLIdcc("01516", t)).toEqual(["akto", "opco2i"]);
    expect(t.cles).toEqual(["1516"]);
    expect(await opcosDeLIdcc("1486", t)).toEqual(["atlas"]);
  });

  it("rend une liste vide si l'IDCC est inconnu, mal formé, ou la table vide", async () => {
    expect(await opcosDeLIdcc("9001", table([["1486", "atlas"]]))).toEqual([]);
    expect(await opcosDeLIdcc("11516", table([["1516", "akto"]]))).toEqual([]);
    expect(await opcosDeLIdcc(null, table([]))).toEqual([]);
    // Table vide (avant le premier import) : l'ancienne constante 1516 → AKTO
    // ne revient PAS par la bande.
    expect(await opcosDeLIdcc("1516", table([]))).toEqual([]);
  });

  it("une table illisible ne bloque rien : liste vide", async () => {
    const enPanne: LecteurIdccOpco = {
      idccOpco: {
        async findMany() {
          throw new Error('relation "idcc_opco" does not exist');
        },
      },
    };
    expect(await opcosDeLIdcc("1516", enPanne)).toEqual([]);
  });
});

describe("inferOpco — IDCC prioritaire, jamais de majorité", () => {
  it("un seul OPCO pour l'IDCC l'emporte sur le NAF", () => {
    expect(inferOpco({ opcosIdcc: ["akto"], naf: "6201Z" })).toBe("akto");
  });

  it("le repli NAF joue quand l'IDCC ne donne rien (inconnu ou table vide)", () => {
    expect(inferOpco({ opcosIdcc: [], naf: "6201Z" })).toBe("atlas");
    expect(inferOpco({ opcosIdcc: [], naf: "8559A" })).toBe("akto");
  });

  it("plusieurs OPCO : le NAF ne départage que s'il désigne l'un d'eux", () => {
    expect(inferOpco({ opcosIdcc: ["akto", "opco2i"], naf: "8559A" })).toBe("akto");
    expect(inferOpco({ opcosIdcc: ["akto", "opco2i"], naf: "6201Z" })).toBeNull();
    expect(inferOpco({ opcosIdcc: ["akto", "opco2i"], naf: null })).toBeNull();
  });

  it("retourne null quand rien n'est connu", () => {
    expect(inferOpco({ opcosIdcc: [], naf: null })).toBeNull();
  });

  it("inferOpcoDepuisTable lit la table puis infère", async () => {
    const t = table([["1516", "akto"]]);
    expect(await inferOpcoDepuisTable(t, { idcc: "1516", naf: "6201Z" })).toBe("akto");
    expect(await inferOpcoDepuisTable(table([]), { idcc: "1516", naf: "6201Z" })).toBe("atlas");
  });
});

describe("cohérence des maps avec le référentiel OPCO", () => {
  it("aucune valeur hors des 11 OPCO connus (anti-typo)", () => {
    // La colonne Client.opcoIdentifie est un VarChar(60) sans enum : un slug
    // erroné s'écrirait sans erreur et ne se verrait qu'à l'affichage.
    for (const v of Object.values(NAF_OPCO_MAP)) expect(isOpcoId(v)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import {
  planifierRemplacementProcedure,
  texteProcedureV2Redige,
  type PieceProcedure,
} from "./procedure-sous-traitance-v2";

const piece = (numero: string, surcharge: Partial<PieceProcedure> = {}): PieceProcedure => ({
  id: `id-${numero}`,
  numero,
  type: "procedure_sous_traitance",
  annuleeAt: null,
  ...surcharge,
});

describe("procédure de sous-traitance v2.0 — plan de remplacement", () => {
  it("la génération de la v2.0 est ÉTEINTE tant que son texte n'existe pas", () => {
    expect(texteProcedureV2Redige()).toBe(false);
  });

  it("remplace une pièce valable et désigne celle à annuler", () => {
    const plan = planifierRemplacementProcedure({
      numeroRemplacee: "AXI-DOC-2026-044",
      remplacee: piece("AXI-DOC-2026-044"),
      numeroAAnnuler: "AXI-DOC-2026-029",
      aAnnuler: piece("AXI-DOC-2026-029"),
    });
    expect(plan).toMatchObject({ ok: true });
    if (plan.ok) expect(plan.aAnnuler?.numero).toBe("AXI-DOC-2026-029");
  });

  it("l'annulation d'une seconde pièce est facultative", () => {
    const plan = planifierRemplacementProcedure({
      numeroRemplacee: "AXI-DOC-2026-044",
      remplacee: piece("AXI-DOC-2026-044"),
      numeroAAnnuler: undefined,
      aAnnuler: null,
    });
    expect(plan).toMatchObject({ ok: true, aAnnuler: null });
  });

  it.each([
    ["pièce remplacée introuvable", { remplacee: null }, /introuvable/],
    [
      "pièce remplacée d'un autre type",
      { remplacee: piece("X", { type: "convention" }) },
      /n'est pas une procédure/,
    ],
    [
      "pièce remplacée déjà annulée",
      { remplacee: piece("X", { annuleeAt: new Date() }) },
      /déjà annulée/,
    ],
    ["pièce à annuler introuvable", { aAnnuler: null }, /introuvable/],
    [
      "pièce à annuler d'un autre type",
      { aAnnuler: piece("Y", { type: "convention" }) },
      /n'est pas une procédure/,
    ],
    [
      "pièce à annuler déjà annulée",
      { aAnnuler: piece("Y", { annuleeAt: new Date() }) },
      /déjà annulée/,
    ],
    ["même pièce deux fois", { aAnnuler: piece("X") }, /différente/],
  ] as const)("refuse : %s", (_nom, surcharge, message) => {
    const plan = planifierRemplacementProcedure({
      numeroRemplacee: "X",
      remplacee: piece("X"),
      numeroAAnnuler: "Y",
      aAnnuler: piece("Y"),
      ...surcharge,
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toMatch(message);
  });
});

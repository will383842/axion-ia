/**
 * Qualiopi ind. 21 — finitions du 2026-10-18 : une mission annulée dont la suspension a été
 * levée reste visible dans la console (avec sa décision), et l'entretien se juge sur la
 * même mesure que le niveau affiché (la pire).
 */

import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  faits: {} as Record<string, unknown>,
  decisions: [] as Array<Record<string, unknown>>,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: {
      findUnique: async () => ({ id: "t1", nom: "N", prenom: "P", statut: "sous_traitant" }),
    },
    grilleSuiviFormateur: { findMany: async () => [] },
    decisionSuiviFormateur: { findMany: async () => h.decisions },
    trainingSession: { findMany: async () => [{ id: "s1", numero: "S-1", titreSession: "T" }] },
  },
}));
vi.mock("../lecture", () => ({
  suiviQualiteAllumeLe: async () => "2026-11-01",
  lireFaitsSuiviQualite: async () => h.faits,
}));
vi.mock("../reglages-lecture", async () => {
  const { REGLAGES_SUIVI_QUALITE } = await import("../reglages");
  return { lireReglagesSuiviQualite: async () => REGLAGES_SUIVI_QUALITE };
});

import { lireEcranSuiviQualite } from "../console";

const base = (decisions: Array<Record<string, unknown>>) => {
  h.decisions = [];
  h.faits = {
    externe: true,
    allumeLe: "2026-11-01",
    missions: [
      { sessionId: "s1", debut: "2026-11-05", fin: "2026-11-06", annulee: true, satisfaction: 2.5 },
    ],
    observations: [],
    evaluations: [],
    decisions,
    dateDecisionHabilitation: null,
    reevaluations: [],
  };
};

describe("console : mission annulée", () => {
  it("suspension maintenue : visible, annulee = true", async () => {
    base([]);
    const e = await lireEcranSuiviQualite("t1", new Date("2026-12-01T10:00:00Z"));
    expect(e?.missions).toHaveLength(1);
    expect(e?.missions[0]).toMatchObject({ annulee: true, suspensionLevee: false });
  });

  it("suspension levée : reste visible avec sa décision", async () => {
    base([{ sessionId: "s1", type: "levee_suspension", creeLe: new Date("2026-11-20T10:00:00Z") }]);
    const e = await lireEcranSuiviQualite("t1", new Date("2026-12-01T10:00:00Z"));
    expect(e?.missions).toHaveLength(1);
    expect(e?.missions[0]).toMatchObject({
      annulee: true,
      suspensionLevee: true,
      decisionPrise: true,
    });
  });
});

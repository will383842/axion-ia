/**
 * Vérification 1, défaut V1-C-2 — côté RELEVÉ MENSUEL.
 *
 * Une session à cheval sur la bascule dont la mission a été acceptée à prix figé est
 * payée par le PASSAGE (paiement par mission), au prix figé. Le relevé mensuel ne la
 * paie toujours pas — jamais par les deux moteurs — et ne l'annonce plus comme
 * « à régler à la main » (anomalie `conditions_figees_hors_mission`) : un paiement
 * manuel en plus du passage serait un double paiement.
 *
 * Une session ENTIÈREMENT avant la bascule, à prix figé, n'est payée par aucun
 * moteur automatique : l'anomalie reste (rien n'a changé pour elle).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTrainingFindMany = vi.fn();
const mockTrainerFindMany = vi.fn();
const mockRuleFindMany = vi.fn();
const mockMissionFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: (...a: unknown[]) => mockTrainingFindMany(...a) },
    coachingSession: { findMany: async () => [] },
    auditMission: { findMany: async () => [] },
    trainer: { findMany: (...a: unknown[]) => mockTrainerFindMany(...a) },
    trainerCompensationRule: { findMany: (...a: unknown[]) => mockRuleFindMany(...a) },
    // La bascule au 01/10/2037 (interrupteur `formateurs.passage_paiement`).
    setting: { findUnique: async () => ({ value: { date: "2037-10-01" } }) },
    revendicationPaiement: { findMany: async () => [] },
    missionFormateur: { findMany: (...a: unknown[]) => mockMissionFindMany(...a) },
    $transaction: vi.fn(),
  },
}));

import { runRemunerationMensuelle } from "./statements";

const SEPTEMBRE = { year: 2037, month: 9 } as const;

function session(jours: string[]): Record<string, unknown> {
  return {
    id: "s1",
    dateDebut: new Date(`${jours[0]}T07:00:00Z`),
    statut: "realisee",
    montantHtCents: 0,
    formation: { slug: "formation-ia", dureeHeures: 7 * jours.length },
    sessionFormateurs: [{ trainerId: "t1", heuresAnimees: null }],
    jours: jours.map((j) => ({ date: new Date(`${j}T00:00:00Z`) })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTrainerFindMany.mockResolvedValue([
    {
      id: "t1",
      statut: "sous_traitant",
      tarifJourneeHtCents: 35_000,
      regimeTvaHonoraires: "franchise_293b",
    },
  ]);
  mockRuleFindMany.mockResolvedValue([]);
  mockMissionFindMany.mockResolvedValue([
    { trainerId: "t1", sessionId: "s1", tarifHtCents: 35_000 },
  ]);
});

describe("V1-C-2 — le relevé mensuel et la session à cheval à prix figé", () => {
  it("à cheval (28/09, 29/09, 05/10) : rien n'est payé ici, et rien n'est annoncé « à la main »", async () => {
    mockTrainingFindMany.mockResolvedValue([session(["2037-09-28", "2037-09-29", "2037-10-05"])]);
    const r = await runRemunerationMensuelle(SEPTEMBRE, { dryRun: true });
    expect(r.lignesEcrites).toBe(0);
    expect(r.anomalies.some((a) => a.motif === "conditions_figees_hors_mission")).toBe(false);
  });

  it("entièrement avant la bascule : rien n'est payé ici, et l'anomalie reste", async () => {
    mockTrainingFindMany.mockResolvedValue([session(["2037-09-28", "2037-09-29"])]);
    const r = await runRemunerationMensuelle(SEPTEMBRE, { dryRun: true });
    expect(r.lignesEcrites).toBe(0);
    expect(r.anomalies).toContainEqual(
      expect.objectContaining({ motif: "conditions_figees_hors_mission", trainerId: "t1" }),
    );
  });
});

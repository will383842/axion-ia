/**
 * Correctif L11c (EXACTITUDE « lettre liée ailleurs ») — moteur des missions
 * allumé, un couple session/formateur dont l'accord est déjà donné ne reçoit
 * pas de seconde proposition : sinon une seconde mission naîtrait, et la lettre
 * pourrait être liée ailleurs que sur la mission acceptée. Coupé : comme avant.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION = "00000000-0000-4000-8000-000000000001";
const TRAINER = "00000000-0000-4000-8000-000000000011";

const h = vi.hoisted(() => ({
  moteur: { lettre_auto: false, lettre_v2: false },
  acceptee: null as { id: string } | null,
  create: vi.fn(async () => ({ id: "m-neuve" })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: vi.fn(async () => ({
        id: SESSION,
        numero: "AXI-SESS-TEST",
        titreSession: "IA pour managers",
        statut: "planifiee",
        dateDebut: new Date("2026-11-04T08:00:00Z"),
        dateFin: new Date("2026-11-05T16:00:00Z"),
        modalite: "presentiel",
        nbParticipantsPrevus: 8,
        lieuType: "sur_site",
        lieuIntitule: null,
        lieuAdresse: null,
        lieuCodePostal: "69003",
        lieuVille: "Lyon",
        lieuSalle: null,
        lieuVisioUrl: null,
      })),
    },
    trainer: {
      findUnique: vi.fn(async () => ({
        id: TRAINER,
        email: "f@example.test",
        prenom: "F",
        nom: "X",
        actif: true,
        statut: "sous_traitant",
      })),
    },
    enrollment: { count: vi.fn(async () => 3) },
    missionFormateur: { findFirst: vi.fn(async () => h.acceptee) },
    $transaction: vi.fn(async () => {
      h.create();
      throw new Error("arrêt du test après la décision");
    }),
  },
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: vi.fn(async (c: string) => c === "lettre_v2" && h.moteur.lettre_v2),
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-envoi", () => ({
  envoiAllume: vi.fn(async (c: string) => c === "lettre_auto" && h.moteur.lettre_auto),
}));
vi.mock("@/server/qualiopi/formateurs-independants/garde-mission-portes", () => ({
  controlerGardeMission: vi.fn(async () => ({ mode: "coupee", refus: [], avertissements: [] })),
}));
vi.mock("@/server/qualiopi/formateurs-independants/conditions-figees", () => ({
  lireConditionsFigees: vi.fn(async () => null),
}));

import { proposerMissionFormateur } from "../mission-formateur";

const NOW = new Date("2026-10-12T09:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  h.moteur = { lettre_auto: false, lettre_v2: false };
  h.acceptee = null;
});

describe("seconde proposition après un accord", () => {
  it("moteur allumé, accord déjà donné : aucune nouvelle mission", async () => {
    h.moteur = { lettre_auto: true, lettre_v2: true };
    h.acceptee = { id: "m-acceptee" };
    const r = await proposerMissionFormateur({ sessionId: SESSION, trainerId: TRAINER, now: NOW });
    expect(r).toMatchObject({
      proposee: false,
      raison: expect.stringContaining("accord déjà donné"),
    });
    expect(h.create).not.toHaveBeenCalled();
  });

  it("moteur coupé : exactement comme avant (la proposition se crée)", async () => {
    h.acceptee = { id: "m-acceptee" };
    await proposerMissionFormateur({ sessionId: SESSION, trainerId: TRAINER, now: NOW });
    expect(h.create).toHaveBeenCalled();
  });
});

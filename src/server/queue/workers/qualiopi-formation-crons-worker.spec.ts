/**
 * Tests — qualiopi-formation-crons-worker.ts (T17 CLUSTER 3).
 *
 * Couvre :
 *   - formationCronsHandler : dispatch par type (happy path + unknown type)
 *   - handleConvocationJ5   : convocation réglementaire J-5 (nouveau, off.9)
 *
 * Stratégie :
 *   - Mock @/lib/prisma pour éviter les appels DB réels.
 *   - Mock notifications-service pour vérifier les appels envoyerConvocation.
 *   - handleConvocationJ5 exporté via formationCronsHandler (pas directement).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findMany: vi.fn(),
    },
    enrollment: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/qualiopi/notifications/notifications-service", () => ({
  envoyerConvocation: vi.fn(),
  envoyerRappelJ7: vi.fn(),
  envoyerSatisfactionJ1: vi.fn(),
  envoyerSuiviJ30: vi.fn(),
}));

vi.mock("@/server/qualiopi/evaluations/attestation-service", () => ({
  genererAttestationPourEnrollment: vi.fn(),
}));

vi.mock("@/server/qualiopi/indicateurs/service", () => ({
  invalidateIndicateursCache: vi.fn(),
}));

vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  synchroniserAlertes: vi.fn().mockResolvedValue({ crees: 0, resolues: 0 }),
}));

vi.mock("@/server/qualiopi/formations/state-machine", () => ({
  assertSessionTransition: vi.fn(),
}));

vi.mock("@/server/qualiopi/formations/crons", () => ({
  decideSessionTransitions: vi.fn().mockReturnValue([]),
}));

vi.mock("@/server/qualiopi/formations/transition-helper", () => ({
  writeSessionTransition: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { envoyerConvocation } from "@/server/qualiopi/notifications/notifications-service";
import { decideSessionTransitions } from "@/server/qualiopi/formations/crons";
import { formationCronsHandler } from "./qualiopi-formation-crons-worker";

const mockPrisma = prisma as unknown as {
  trainingSession: { findMany: ReturnType<typeof vi.fn> };
  enrollment: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockEnvoyerConvocation = envoyerConvocation as ReturnType<typeof vi.fn>;
const mockDecide = decideSessionTransitions as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// Tests formationCronsHandler — dispatch
// ─────────────────────────────────────────────────────────────────────────────

describe("formationCronsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatche vers handleConvocationJ5 pour type convocation-j5", async () => {
    // Stub DB → aucune session planifiée dans la fenêtre J-5
    mockPrisma.trainingSession.findMany.mockResolvedValue([]);

    await expect(
      formationCronsHandler({
        type: "formation-crons.convocation-j5",
        tick: "2026-06-06T08:00:00Z",
      }),
    ).resolves.toBeUndefined();
  });

  it("ne throw pas sur un type inconnu (warn silencieux)", async () => {
    await expect(
      // @ts-expect-error — test d'un type non enregistré
      formationCronsHandler({ type: "formation-crons.unknown-type", tick: "2026-06-06T08:00:00Z" }),
    ).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests handleConvocationJ5 (via formationCronsHandler)
// ─────────────────────────────────────────────────────────────────────────────

describe("handleConvocationJ5 (via formationCronsHandler)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Environnement non-stub pour ces tests
    delete process.env["DATABASE_URL"];
  });

  it("skip si DATABASE_URL = stub.invalid (stub-aware)", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await formationCronsHandler({
        type: "formation-crons.convocation-j5",
        tick: "2026-06-06T08:00:00Z",
      });
      expect(mockPrisma.trainingSession.findMany).not.toHaveBeenCalled();
      expect(mockEnvoyerConvocation).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  it("ne fait rien si aucune session planifiée dans la fenêtre J-5", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([]);

    await formationCronsHandler({
      type: "formation-crons.convocation-j5",
      tick: "2026-06-06T08:00:00Z",
    });

    expect(mockEnvoyerConvocation).not.toHaveBeenCalled();
  });

  it("appelle envoyerConvocation pour chaque enrollment des sessions J-5", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      {
        id: "session-uuid-1",
        enrollments: [{ id: "enroll-uuid-1" }, { id: "enroll-uuid-2" }],
      },
      {
        id: "session-uuid-2",
        enrollments: [{ id: "enroll-uuid-3" }],
      },
    ]);
    mockEnvoyerConvocation.mockResolvedValue(undefined);

    await formationCronsHandler({
      type: "formation-crons.convocation-j5",
      tick: "2026-06-06T08:00:00Z",
    });

    expect(mockEnvoyerConvocation).toHaveBeenCalledTimes(3);
    expect(mockEnvoyerConvocation).toHaveBeenCalledWith("enroll-uuid-1");
    expect(mockEnvoyerConvocation).toHaveBeenCalledWith("enroll-uuid-2");
    expect(mockEnvoyerConvocation).toHaveBeenCalledWith("enroll-uuid-3");
  });

  it("continue en cas d'erreur sur un enrollment (fail-soft)", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      {
        id: "session-uuid-1",
        enrollments: [{ id: "enroll-ok-1" }, { id: "enroll-ko-1" }, { id: "enroll-ok-2" }],
      },
    ]);
    mockEnvoyerConvocation
      .mockResolvedValueOnce(undefined) // ok-1
      .mockRejectedValueOnce(new Error("Email service down")) // ko-1
      .mockResolvedValueOnce(undefined); // ok-2

    await expect(
      formationCronsHandler({
        type: "formation-crons.convocation-j5",
        tick: "2026-06-06T08:00:00Z",
      }),
    ).resolves.toBeUndefined();

    expect(mockEnvoyerConvocation).toHaveBeenCalledTimes(3);
  });

  it("scanne les sessions dans la fenêtre [J+4.5j, J+5.5j]", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([]);

    await formationCronsHandler({
      type: "formation-crons.convocation-j5",
      tick: "2026-06-06T08:00:00Z",
    });

    const rawCall = mockPrisma.trainingSession.findMany.mock.calls[0];
    expect(rawCall).toBeDefined();
    const callArgs = rawCall![0] as {
      where: {
        statut: string;
        dateDebut: { gte: Date; lte: Date };
      };
    };
    expect(callArgs.where.statut).toBe("planifiee");

    const now = new Date();
    const expectedStart = new Date(now.getTime() + 4.5 * 24 * 60 * 60 * 1000);
    const expectedEnd = new Date(now.getTime() + 5.5 * 24 * 60 * 60 * 1000);

    // Tolérance de 5 secondes pour le temps d'exécution du test
    const tolerance = 5000;
    expect(callArgs.where.dateDebut.gte.getTime()).toBeGreaterThan(
      expectedStart.getTime() - tolerance,
    );
    expect(callArgs.where.dateDebut.gte.getTime()).toBeLessThan(
      expectedStart.getTime() + tolerance,
    );
    expect(callArgs.where.dateDebut.lte.getTime()).toBeGreaterThan(
      expectedEnd.getTime() - tolerance,
    );
    expect(callArgs.where.dateDebut.lte.getTime()).toBeLessThan(expectedEnd.getTime() + tolerance);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests handleClotureAuto — garde émargement (conformité ind.12 / R.6313-3)
// ─────────────────────────────────────────────────────────────────────────────

describe("handleClotureAuto — garde émargement (audit E2E 2026-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["DATABASE_URL"];
  });

  const decision = { sessionId: "sess-1", from: "en_cours", to: "realisee" };

  it("IGNORE la clôture auto d'une session avec inscrits mais SANS émargement", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      { id: "sess-1", statut: "en_cours", dateDebut: new Date(), dateFin: new Date() },
    ]);
    mockDecide.mockReturnValue([decision]);
    // 1er count = total inscrits (2), 2e count = avec émargement (0) → skip
    mockPrisma.enrollment.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);

    await formationCronsHandler({
      type: "formation-crons.cloture-auto",
      tick: "2026-06-06T08:00:00Z",
    });

    // La transition NE doit PAS être appliquée → $transaction jamais appelé.
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("APPLIQUE la clôture auto si au moins un émargement est présent", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      { id: "sess-1", statut: "en_cours", dateDebut: new Date(), dateFin: new Date() },
    ]);
    mockDecide.mockReturnValue([decision]);
    // total = 2, avec émargement = 1 → applique
    mockPrisma.enrollment.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    mockPrisma.$transaction.mockResolvedValue(undefined);

    await formationCronsHandler({
      type: "formation-crons.cloture-auto",
      tick: "2026-06-06T08:00:00Z",
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });

  it("APPLIQUE la clôture auto d'une session SANS aucun inscrit (0 inscrit = pas de garde)", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      { id: "sess-1", statut: "en_cours", dateDebut: new Date(), dateFin: new Date() },
    ]);
    mockDecide.mockReturnValue([decision]);
    mockPrisma.enrollment.count.mockResolvedValueOnce(0);
    mockPrisma.$transaction.mockResolvedValue(undefined);

    await formationCronsHandler({
      type: "formation-crons.cloture-auto",
      tick: "2026-06-06T08:00:00Z",
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });
});

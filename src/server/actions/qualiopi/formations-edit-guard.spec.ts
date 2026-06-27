/**
 * Tests — gardes de conformité WS4 sur updateFormationAction /
 * setCertificationAction (lock session, reset validation, version historique).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: "f1" }),
    },
    trainingSession: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  requireAdminPublish: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/server/qualiopi/formations/certification-service", () => ({
  setCertification: vi.fn().mockResolvedValue({ id: "f1", cpfEligible: true }),
}));

import { prisma } from "@/lib/prisma";
import { updateFormationAction, setCertificationAction } from "./formations";

const mockPrisma = prisma as unknown as {
  formation: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  trainingSession: { count: ReturnType<typeof vi.fn> };
};

const FORMATION_ID = "f1234567-89ab-cdef-0123-456789abcdef";

function baseFormation(over: Record<string, unknown> = {}) {
  return {
    id: FORMATION_ID,
    slug: "ia-express",
    statutGeneration: "publie",
    validatedBy: null,
    versionProgramme: "1.0",
    versionHistorique: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.formation.update.mockResolvedValue({ id: FORMATION_ID });
  mockPrisma.trainingSession.count.mockResolvedValue(0);
});

describe("updateFormationAction — gardes WS4", () => {
  it("bloque l'édition si une session est en cours/réalisée", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(baseFormation());
    mockPrisma.trainingSession.count.mockResolvedValue(1);

    const res = await updateFormationAction({ id: FORMATION_ID, titre: "Nouveau titre" });
    expect("error" in res).toBe(true);
    expect(mockPrisma.formation.update).not.toHaveBeenCalled();
  });

  it("réinitialise la validation + rétrograde publie→assemble sur édition d'une formation validée", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(
      baseFormation({ validatedBy: "admin-0", statutGeneration: "publie" }),
    );

    const res = await updateFormationAction({ id: FORMATION_ID, titre: "Titre v2" });
    expect("data" in res).toBe(true);
    const data = mockPrisma.formation.update.mock.calls[0]![0].data;
    expect(data.validatedBy).toBeNull();
    expect(data.validatedAt).toBeNull();
    expect(data.statutGeneration).toBe("assemble");
    expect(data.versionProgramme).toBe("1.1");
    expect(data.titre).toBe("Titre v2");
    expect(Array.isArray(data.versionHistorique)).toBe(true);
    expect(data.versionHistorique[0].revalidationRequired).toBe(true);
  });

  it("n'invalide pas la validation si la formation n'était pas validée", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(
      baseFormation({ validatedBy: null, statutGeneration: "intention" }),
    );

    await updateFormationAction({ id: FORMATION_ID, titre: "x" });
    const data = mockPrisma.formation.update.mock.calls[0]![0].data;
    expect(data).not.toHaveProperty("validatedBy");
    expect(data).not.toHaveProperty("statutGeneration");
    expect(data.versionProgramme).toBe("1.1");
  });

  it("no-op (aucun champ) → pas d'écriture", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(baseFormation());
    const res = await updateFormationAction({ id: FORMATION_ID });
    expect("data" in res).toBe(true);
    expect(mockPrisma.formation.update).not.toHaveBeenCalled();
  });

  it("formation introuvable → erreur", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(null);
    const res = await updateFormationAction({ id: FORMATION_ID, titre: "x" });
    expect("error" in res).toBe(true);
  });
});

describe("setCertificationAction — gardes WS4", () => {
  it("bloque si une session est en cours/réalisée", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(baseFormation());
    mockPrisma.trainingSession.count.mockResolvedValue(1);

    const res = await setCertificationAction({
      formationId: FORMATION_ID,
      certificationType: "rncp",
    });
    expect("error" in res).toBe(true);
    expect(mockPrisma.formation.update).not.toHaveBeenCalled();
  });

  it("trace l'historique + invalide la validation d'une formation validée", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(
      baseFormation({ validatedBy: "admin-0", statutGeneration: "publie" }),
    );

    const res = await setCertificationAction({
      formationId: FORMATION_ID,
      certificationType: "rncp",
      codeRncp: "RNCP12345",
    });
    expect("data" in res).toBe(true);
    const data = mockPrisma.formation.update.mock.calls[0]![0].data;
    expect(data.validatedBy).toBeNull();
    expect(data.statutGeneration).toBe("assemble");
    expect(data.versionHistorique[0].action).toBe("certification");
    expect(data.versionHistorique[0].fields).toContain("certificationType");
  });
});

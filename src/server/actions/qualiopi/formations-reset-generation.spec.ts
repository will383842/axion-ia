/**
 * Tests — resetGenerationStatusAction (pilote qualité, plan parcours vente).
 *
 * 🔴 Défaut couvert : `publie` était un cul-de-sac — non relançable par
 * startGenerationAction, no-op côté worker, et « éditer pour dépublier » menait
 * à `assemble`, pas relançable non plus. Ces tests rougissent si l'action perd
 * une de ses gardes (sessions verrouillantes, archive, traçabilité).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    trainingSession: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  requireAdminPublish: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/server/qualiopi/formations/numbering", () => ({
  allocateFormationNumero: vi.fn(),
}));

vi.mock("@/server/qualiopi/numbering/retry", () => ({
  withNumberRetry: (fn: () => unknown) => fn(),
}));

import { prisma } from "@/lib/prisma";
import { resetGenerationStatusAction } from "./formations";

const mockPrisma = prisma as unknown as {
  formation: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  trainingSession: { count: ReturnType<typeof vi.fn> };
};

const ID = "f1234567-89ab-cdef-0123-456789abcdef";

function formationPubliee(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    slug: "ia-express",
    statut: "publie",
    statutGeneration: "publie",
    versionProgramme: "1.2",
    versionHistorique: [],
    aiGenerated: true,
    objectifsPedagogiques: [{ id: "obj-1", verbe: "Rédiger", description: "Rédiger un prompt" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.formation.update.mockResolvedValue({ id: ID });
  mockPrisma.trainingSession.count.mockResolvedValue(0);
});

describe("resetGenerationStatusAction", () => {
  it("publie → intention, validation effacée, version bumpée, historique tracé", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(formationPubliee());
    const res = await resetGenerationStatusAction(ID);
    expect("data" in res).toBe(true);
    const data = mockPrisma.formation.update.mock.calls[0]![0].data;
    expect(data.statutGeneration).toBe("intention");
    expect(data.validatedBy).toBeNull();
    expect(data.validatedAt).toBeNull();
    expect(data.versionProgramme).toBe("1.3");
    const historique = data.versionHistorique as Array<{ action: string }>;
    expect(historique.at(-1)?.action).toBe("reset_generation");
  });

  it("retourne l'avertissement de non-planifiabilité", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(formationPubliee());
    const res = await resetGenerationStatusAction(ID);
    if (!("data" in res)) throw new Error("attendu data");
    expect(res.data.avertissement).toContain("sélecteur");
  });

  it("REFUSE si une session est en cours ou réalisée (contenu figé)", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(formationPubliee());
    mockPrisma.trainingSession.count.mockResolvedValue(1);
    const res = await resetGenerationStatusAction(ID);
    expect("error" in res).toBe(true);
    expect(mockPrisma.formation.update).not.toHaveBeenCalled();
  });

  it("REFUSE une formation archivée (chemin prescrit : dupliquer)", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(
      formationPubliee({ statut: "archive", statutGeneration: "archive" }),
    );
    const res = await resetGenerationStatusAction(ID);
    expect("error" in res).toBe(true);
  });

  it("REFUSE un statut déjà relançable (intention) — pas de reset inutile", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(
      formationPubliee({ statutGeneration: "intention" }),
    );
    const res = await resetGenerationStatusAction(ID);
    expect("error" in res).toBe(true);
    expect(mockPrisma.formation.update).not.toHaveBeenCalled();
  });

  it("accepte aussi le cul-de-sac assemble", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(
      formationPubliee({ statutGeneration: "assemble" }),
    );
    const res = await resetGenerationStatusAction(ID);
    expect("data" in res).toBe(true);
  });

  it("REFUSE les statuts de mi-cycle (contenu_valide : un job peut être en vol)", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(
      formationPubliee({ statutGeneration: "contenu_valide" }),
    );
    const res = await resetGenerationStatusAction(ID);
    expect("error" in res).toBe(true);
    expect(mockPrisma.formation.update).not.toHaveBeenCalled();
  });

  it("purge les objectifs ÉCRITS PAR LA MACHINE (aiGenerated=true)", async () => {
    // Sans purge, la politique « seulement si vide » du worker empêcherait la
    // ré-extraction : attestations et grilles garderaient les objectifs v1.
    mockPrisma.formation.findUnique.mockResolvedValue(formationPubliee());
    await resetGenerationStatusAction(ID);
    const data = mockPrisma.formation.update.mock.calls[0]![0].data;
    expect(data.objectifsPedagogiques).toEqual([]);
  });

  it("ne purge JAMAIS une saisie humaine (aiGenerated=false)", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(formationPubliee({ aiGenerated: false }));
    await resetGenerationStatusAction(ID);
    const data = mockPrisma.formation.update.mock.calls[0]![0].data;
    expect(data).not.toHaveProperty("objectifsPedagogiques");
  });
});

/**
 * Tests — trainers.ts (R9 audit E2E 2026-06-06).
 *
 * - isTrainerHabilite : fonction pure (cœur du blocage d'assignation).
 * - listTrainers / getTrainer : stub-safe (mock prisma).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import { listTrainers, getTrainer, isTrainerHabilite } from "./trainers";

const FORMATION_ID = "11111111-1111-1111-1111-111111111111";

function makeTrainer(overrides: Record<string, unknown> = {}) {
  return {
    statut: "salarie" as const,
    formationsHabilitees: [FORMATION_ID],
    sousTraitantVerifieAt: null as Date | null,
    actif: true,
    ...overrides,
  };
}

describe("isTrainerHabilite", () => {
  it("ok si salarié actif habilité sur la formation", () => {
    expect(isTrainerHabilite(makeTrainer(), FORMATION_ID).ok).toBe(true);
  });

  it("refuse si formateur inactif", () => {
    const r = isTrainerHabilite(makeTrainer({ actif: false }), FORMATION_ID);
    expect(r.ok).toBe(false);
    expect(r.raison).toContain("inactif");
  });

  it("refuse si la formation n'est pas dans les habilitations", () => {
    const r = isTrainerHabilite(makeTrainer({ formationsHabilitees: [] }), FORMATION_ID);
    expect(r.ok).toBe(false);
    expect(r.raison).toContain("non habilité");
  });

  it("refuse un sous-traitant non vérifié même habilité", () => {
    const r = isTrainerHabilite(
      makeTrainer({ statut: "sous_traitant", sousTraitantVerifieAt: null }),
      FORMATION_ID,
    );
    expect(r.ok).toBe(false);
    expect(r.raison).toContain("Sous-traitant non vérifié");
  });

  it("ok pour un sous-traitant vérifié + habilité", () => {
    expect(
      isTrainerHabilite(
        makeTrainer({ statut: "sous_traitant", sousTraitantVerifieAt: new Date() }),
        FORMATION_ID,
      ).ok,
    ).toBe(true);
  });
});

describe("listTrainers / getTrainer (stub-safe)", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindUnique.mockReset();
  });

  it("listTrainers retourne les lignes", async () => {
    mockFindMany.mockResolvedValue([{ id: "t1" }]);
    expect(await listTrainers()).toHaveLength(1);
  });

  it("listTrainers retourne [] si la DB jette (stub build)", async () => {
    mockFindMany.mockRejectedValue(new Error("stub"));
    expect(await listTrainers()).toEqual([]);
  });

  it("listTrainers applique le filtre actifOnly", async () => {
    mockFindMany.mockResolvedValue([]);
    await listTrainers({ actifOnly: true, statut: "sous_traitant" });
    const arg = mockFindMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> };
    expect(arg.where).toMatchObject({ actif: true, statut: "sous_traitant" });
  });

  it("getTrainer retourne null si la DB jette", async () => {
    mockFindUnique.mockRejectedValue(new Error("stub"));
    expect(await getTrainer("x")).toBeNull();
  });
});

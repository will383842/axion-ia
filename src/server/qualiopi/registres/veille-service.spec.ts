/**
 * Tests — registres/veille-service.ts (T12 — AGENT A).
 *
 * Stratégie : mock @/lib/prisma.
 * Vérifie : CRUD veille, filtre par type, stub-aware.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    veille: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  creerVeille,
  updateVeille,
  supprimerVeille,
  getVeille,
  listVeille,
} from "./veille-service";

const mockPrisma = prisma as unknown as {
  veille: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeVeille(overrides: Record<string, unknown> = {}) {
  return {
    id: "veille-uuid-001",
    type: "legale" as const,
    source: "Legifrance",
    titre: "Mise à jour décret formation",
    contenu: "Nouveau décret publié au JO.",
    dateVeille: new Date("2026-06-01T00:00:00.000Z"),
    impact: null,
    actionDecidee: null,
    creeParId: null,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// creerVeille
// ─────────────────────────────────────────────────────────────────────────────

describe("creerVeille", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.veille.create.mockResolvedValue(makeVeille());
  });

  it("crée une entrée de veille avec les champs obligatoires", async () => {
    const result = await creerVeille({
      type: "legale",
      source: "Legifrance",
      titre: "Mise à jour décret formation",
      contenu: "Nouveau décret publié au JO.",
      dateVeille: new Date("2026-06-01T00:00:00.000Z"),
    });

    expect(mockPrisma.veille.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "legale",
          source: "Legifrance",
          titre: "Mise à jour décret formation",
        }),
      }),
    );
    expect(result.type).toBe("legale");
  });

  it("transmet impact et actionDecidee si fournis", async () => {
    await creerVeille({
      type: "pedagogique",
      source: "AFNOR",
      titre: "Nouvelle norme pédagogie",
      contenu: "Contenu de la norme.",
      dateVeille: new Date("2026-05-15T00:00:00.000Z"),
      impact: "Fort impact sur les évaluations",
      actionDecidee: "Révision des grilles de notation",
    });

    expect(mockPrisma.veille.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          impact: "Fort impact sur les évaluations",
          actionDecidee: "Révision des grilles de notation",
        }),
      }),
    );
  });

  it("lève en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(
        creerVeille({
          type: "legale",
          source: "Test",
          titre: "Test",
          contenu: "Test",
          dateVeille: new Date(),
        }),
      ).rejects.toThrow("stub.invalid");
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateVeille
// ─────────────────────────────────────────────────────────────────────────────

describe("updateVeille", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.veille.update.mockResolvedValue(makeVeille({ titre: "Titre mis à jour" }));
  });

  it("met à jour les champs fournis uniquement", async () => {
    const result = await updateVeille("veille-uuid-001", { titre: "Titre mis à jour" });

    expect(mockPrisma.veille.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "veille-uuid-001" },
        data: expect.objectContaining({ titre: "Titre mis à jour" }),
      }),
    );
    expect(result.titre).toBe("Titre mis à jour");
  });

  it("ne transmet pas les champs undefined", async () => {
    await updateVeille("veille-uuid-001", { titre: "Nouveau titre" });

    const callData = mockPrisma.veille.update.mock.calls[0]![0].data;
    expect("type" in callData).toBe(false);
    expect("source" in callData).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// supprimerVeille
// ─────────────────────────────────────────────────────────────────────────────

describe("supprimerVeille", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.veille.delete.mockResolvedValue(makeVeille());
  });

  it("supprime une entrée de veille", async () => {
    await supprimerVeille("veille-uuid-001");
    expect(mockPrisma.veille.delete).toHaveBeenCalledWith({ where: { id: "veille-uuid-001" } });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getVeille
// ─────────────────────────────────────────────────────────────────────────────

describe("getVeille", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.veille.findUnique.mockResolvedValue(makeVeille());
  });

  it("retourne une entrée de veille par id", async () => {
    const result = await getVeille("veille-uuid-001");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("veille-uuid-001");
  });

  it("retourne null en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await getVeille("veille-uuid-001");
      expect(result).toBeNull();
      expect(mockPrisma.veille.findUnique).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listVeille
// ─────────────────────────────────────────────────────────────────────────────

describe("listVeille", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.veille.findMany.mockResolvedValue([makeVeille(), makeVeille({ type: "metiers" })]);
  });

  it("retourne toutes les entrées sans filtre", async () => {
    const result = await listVeille();
    expect(result).toHaveLength(2);
  });

  it("filtre par type si fourni", async () => {
    mockPrisma.veille.findMany.mockResolvedValue([makeVeille({ type: "handicap" })]);
    const result = await listVeille({ type: "handicap" });

    expect(mockPrisma.veille.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "handicap" }),
      }),
    );
    expect(result).toHaveLength(1);
  });

  it("retourne [] en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await listVeille();
      expect(result).toEqual([]);
      expect(mockPrisma.veille.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

/**
 * Tests — registres/partenariats-service.ts (T12 — AGENT A).
 *
 * Stratégie : mock @/lib/prisma.
 * Vérifie : CRUD partenariats, filtre actif, stub-aware.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    partenariat: {
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
  creerPartenariat,
  updatePartenariat,
  supprimerPartenariat,
  getPartenariat,
  listPartenariats,
} from "./partenariats-service";

const mockPrisma = prisma as unknown as {
  partenariat: {
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

function makePartenariat(overrides: Record<string, unknown> = {}) {
  return {
    id: "part-uuid-001",
    nom: "ESAT Isère Porte de Romans",
    type: "handicap",
    objet: "Orientation et accompagnement des stagiaires en situation de handicap.",
    dateDebut: new Date("2026-01-01T00:00:00.000Z"),
    dateFin: null,
    actif: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// creerPartenariat
// ─────────────────────────────────────────────────────────────────────────────

describe("creerPartenariat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.partenariat.create.mockResolvedValue(makePartenariat());
  });

  it("crée un partenariat avec les champs obligatoires", async () => {
    const result = await creerPartenariat({
      nom: "ESAT Isère Porte de Romans",
      type: "handicap",
      objet: "Orientation et accompagnement des stagiaires en situation de handicap.",
      dateDebut: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(mockPrisma.partenariat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nom: "ESAT Isère Porte de Romans",
          type: "handicap",
          actif: true,
        }),
      }),
    );
    expect(result.nom).toBe("ESAT Isère Porte de Romans");
  });

  it("transmet dateFin si fournie", async () => {
    await creerPartenariat({
      nom: "Partenaire test",
      type: "sous-traitance",
      objet: "Prestation technique.",
      dateDebut: new Date("2026-01-01T00:00:00.000Z"),
      dateFin: new Date("2026-12-31T00:00:00.000Z"),
    });

    expect(mockPrisma.partenariat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dateFin: expect.any(Date),
        }),
      }),
    );
  });

  it("lève en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(
        creerPartenariat({
          nom: "Test",
          type: "test",
          objet: "Test",
          dateDebut: new Date(),
        }),
      ).rejects.toThrow("stub.invalid");
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updatePartenariat
// ─────────────────────────────────────────────────────────────────────────────

describe("updatePartenariat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.partenariat.update.mockResolvedValue(makePartenariat({ actif: false }));
  });

  it("met à jour les champs fournis uniquement", async () => {
    const result = await updatePartenariat("part-uuid-001", { actif: false });

    expect(mockPrisma.partenariat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "part-uuid-001" },
        data: expect.objectContaining({ actif: false }),
      }),
    );
    expect(result.actif).toBe(false);
  });

  it("ne transmet pas les champs undefined", async () => {
    await updatePartenariat("part-uuid-001", { nom: "Nouveau nom" });
    const callData = mockPrisma.partenariat.update.mock.calls[0]![0].data;
    expect("type" in callData).toBe(false);
    expect("objet" in callData).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// supprimerPartenariat
// ─────────────────────────────────────────────────────────────────────────────

describe("supprimerPartenariat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.partenariat.delete.mockResolvedValue(makePartenariat());
  });

  it("supprime un partenariat par id", async () => {
    await supprimerPartenariat("part-uuid-001");
    expect(mockPrisma.partenariat.delete).toHaveBeenCalledWith({ where: { id: "part-uuid-001" } });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPartenariat
// ─────────────────────────────────────────────────────────────────────────────

describe("getPartenariat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.partenariat.findUnique.mockResolvedValue(makePartenariat());
  });

  it("retourne un partenariat par id", async () => {
    const result = await getPartenariat("part-uuid-001");
    expect(result?.id).toBe("part-uuid-001");
  });

  it("retourne null en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await getPartenariat("part-uuid-001");
      expect(result).toBeNull();
      expect(mockPrisma.partenariat.findUnique).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listPartenariats
// ─────────────────────────────────────────────────────────────────────────────

describe("listPartenariats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.partenariat.findMany.mockResolvedValue([makePartenariat()]);
  });

  it("retourne tous les partenariats sans filtre", async () => {
    const result = await listPartenariats();
    expect(result).toHaveLength(1);
  });

  it("filtre par actif si fourni", async () => {
    await listPartenariats({ actif: true });
    expect(mockPrisma.partenariat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ actif: true }),
      }),
    );
  });

  it("retourne [] en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await listPartenariats();
      expect(result).toEqual([]);
      expect(mockPrisma.partenariat.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

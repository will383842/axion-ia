/**
 * Tests — moyens/moyens-service.ts (LOT 2 — off.17/18/19, doc A14).
 *
 * Stratégie : mock @/lib/prisma.
 * Vérifie : CRUD moyens, filtres liste, toggle actif, stub-aware.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    moyenPedagogique: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { creerMoyen, updateMoyen, setMoyenActif, getMoyen, listMoyens } from "./moyens-service";

const mockPrisma = prisma as unknown as {
  moyenPedagogique: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeMoyen(overrides: Record<string, unknown> = {}) {
  return {
    id: "moyen-uuid-001",
    categorie: "salle" as const,
    libelle: "Salle de formation Grenoble — 12 places",
    description: "Vidéoprojecteur, paperboard, wifi",
    localisation: "Grenoble",
    actif: true,
    dateVerification: new Date("2026-07-01T00:00:00.000Z"),
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// creerMoyen
// ─────────────────────────────────────────────────────────────────────────────

describe("creerMoyen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.moyenPedagogique.create.mockResolvedValue(makeMoyen());
  });

  it("crée un moyen avec les champs obligatoires", async () => {
    const result = await creerMoyen({
      categorie: "salle",
      libelle: "Salle de formation Grenoble — 12 places",
    });
    expect(result.id).toBe("moyen-uuid-001");
    expect(mockPrisma.moyenPedagogique.create).toHaveBeenCalledWith({
      data: {
        categorie: "salle",
        libelle: "Salle de formation Grenoble — 12 places",
      },
    });
  });

  it("transmet les champs optionnels fournis (spread conditionnel)", async () => {
    const dateVerification = new Date("2026-07-01T00:00:00.000Z");
    await creerMoyen({
      categorie: "plateforme",
      libelle: "LMS distanciel",
      description: "Plateforme de classes virtuelles",
      localisation: "https://exemple.invalid",
      dateVerification,
    });
    expect(mockPrisma.moyenPedagogique.create).toHaveBeenCalledWith({
      data: {
        categorie: "plateforme",
        libelle: "LMS distanciel",
        description: "Plateforme de classes virtuelles",
        localisation: "https://exemple.invalid",
        dateVerification,
      },
    });
  });

  it("refuse la mutation en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(creerMoyen({ categorie: "salle", libelle: "x" })).rejects.toThrow(
        /stub\.invalid/,
      );
      expect(mockPrisma.moyenPedagogique.create).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateMoyen
// ─────────────────────────────────────────────────────────────────────────────

describe("updateMoyen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.moyenPedagogique.update.mockResolvedValue(makeMoyen());
  });

  it("ne transmet que les champs fournis", async () => {
    await updateMoyen("moyen-uuid-001", { libelle: "Nouveau libellé" });
    expect(mockPrisma.moyenPedagogique.update).toHaveBeenCalledWith({
      where: { id: "moyen-uuid-001" },
      data: { libelle: "Nouveau libellé" },
    });
  });

  it("dateVerification: null efface la vérification", async () => {
    await updateMoyen("moyen-uuid-001", { dateVerification: null });
    expect(mockPrisma.moyenPedagogique.update).toHaveBeenCalledWith({
      where: { id: "moyen-uuid-001" },
      data: { dateVerification: null },
    });
  });

  it("refuse la mutation en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(updateMoyen("id", { libelle: "x" })).rejects.toThrow(/stub\.invalid/);
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setMoyenActif
// ─────────────────────────────────────────────────────────────────────────────

describe("setMoyenActif", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.moyenPedagogique.update.mockResolvedValue(makeMoyen({ actif: false }));
  });

  it("désactive un moyen (jamais de delete — inventaire tracé)", async () => {
    const result = await setMoyenActif("moyen-uuid-001", false);
    expect(result.actif).toBe(false);
    expect(mockPrisma.moyenPedagogique.update).toHaveBeenCalledWith({
      where: { id: "moyen-uuid-001" },
      data: { actif: false },
    });
  });

  it("refuse la mutation en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(setMoyenActif("id", true)).rejects.toThrow(/stub\.invalid/);
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getMoyen / listMoyens
// ─────────────────────────────────────────────────────────────────────────────

describe("getMoyen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne le moyen si trouvé", async () => {
    mockPrisma.moyenPedagogique.findUnique.mockResolvedValue(makeMoyen());
    const result = await getMoyen("moyen-uuid-001");
    expect(result?.id).toBe("moyen-uuid-001");
  });

  it("retourne null en mode stub.invalid (lecture safe)", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await getMoyen("id");
      expect(result).toBeNull();
      expect(mockPrisma.moyenPedagogique.findUnique).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

describe("listMoyens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.moyenPedagogique.findMany.mockResolvedValue([makeMoyen()]);
  });

  it("liste sans filtre (tri catégorie puis libellé)", async () => {
    const result = await listMoyens();
    expect(result).toHaveLength(1);
    expect(mockPrisma.moyenPedagogique.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ categorie: "asc" }, { libelle: "asc" }],
      skip: 0,
      take: 200,
    });
  });

  it("filtre par catégorie + actif", async () => {
    await listMoyens({ categorie: "materiel", actif: true, take: 10 });
    expect(mockPrisma.moyenPedagogique.findMany).toHaveBeenCalledWith({
      where: { categorie: "materiel", actif: true },
      orderBy: [{ categorie: "asc" }, { libelle: "asc" }],
      skip: 0,
      take: 10,
    });
  });

  it("retourne [] en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await listMoyens();
      expect(result).toEqual([]);
      expect(mockPrisma.moyenPedagogique.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

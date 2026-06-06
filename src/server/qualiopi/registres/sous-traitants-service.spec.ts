/**
 * Tests — registres/sous-traitants-service.ts (T12 — AGENT A).
 *
 * Stratégie : mock @/lib/prisma.
 * Vérifie : CRUD sous-traitants, verifierDataGouv, filtre actif, stub-aware.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    sousTraitant: {
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
  creerSousTraitant,
  updateSousTraitant,
  supprimerSousTraitant,
  getSousTraitant,
  listSousTraitants,
  verifierDataGouv,
} from "./sous-traitants-service";

const mockPrisma = prisma as unknown as {
  sousTraitant: {
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

function makeSousTraitant(overrides: Record<string, unknown> = {}) {
  return {
    id: "st-uuid-001",
    nom: "FormaTech SARL",
    siret: "12345678900011",
    nda: "11380000011",
    objetPrestation: "Animation modules Python avancé.",
    verifieDataGouvAt: null,
    contratSigneAt: null,
    actif: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// creerSousTraitant
// ─────────────────────────────────────────────────────────────────────────────

describe("creerSousTraitant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.sousTraitant.create.mockResolvedValue(makeSousTraitant());
  });

  it("crée un sous-traitant avec les champs obligatoires", async () => {
    const result = await creerSousTraitant({
      nom: "FormaTech SARL",
      objetPrestation: "Animation modules Python avancé.",
    });

    expect(mockPrisma.sousTraitant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nom: "FormaTech SARL",
          objetPrestation: "Animation modules Python avancé.",
          actif: true,
        }),
      }),
    );
    expect(result.nom).toBe("FormaTech SARL");
  });

  it("transmet siret, nda, contratSigneAt si fournis", async () => {
    await creerSousTraitant({
      nom: "FormaTech SARL",
      siret: "12345678900011",
      nda: "11380000011",
      objetPrestation: "Animation modules Python avancé.",
      contratSigneAt: new Date("2026-01-15T00:00:00.000Z"),
    });

    expect(mockPrisma.sousTraitant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          siret: "12345678900011",
          nda: "11380000011",
          contratSigneAt: expect.any(Date),
        }),
      }),
    );
  });

  it("lève en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(creerSousTraitant({ nom: "Test", objetPrestation: "Test" })).rejects.toThrow(
        "stub.invalid",
      );
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateSousTraitant
// ─────────────────────────────────────────────────────────────────────────────

describe("updateSousTraitant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.sousTraitant.update.mockResolvedValue(makeSousTraitant({ actif: false }));
  });

  it("met à jour les champs fournis uniquement", async () => {
    const result = await updateSousTraitant("st-uuid-001", { actif: false });

    expect(mockPrisma.sousTraitant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "st-uuid-001" },
        data: expect.objectContaining({ actif: false }),
      }),
    );
    expect(result.actif).toBe(false);
  });

  it("ne transmet pas les champs undefined", async () => {
    await updateSousTraitant("st-uuid-001", { nom: "Nouveau nom" });
    const callData = mockPrisma.sousTraitant.update.mock.calls[0]![0].data;
    expect("siret" in callData).toBe(false);
    expect("nda" in callData).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// supprimerSousTraitant
// ─────────────────────────────────────────────────────────────────────────────

describe("supprimerSousTraitant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.sousTraitant.delete.mockResolvedValue(makeSousTraitant());
  });

  it("supprime un sous-traitant par id", async () => {
    await supprimerSousTraitant("st-uuid-001");
    expect(mockPrisma.sousTraitant.delete).toHaveBeenCalledWith({ where: { id: "st-uuid-001" } });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getSousTraitant
// ─────────────────────────────────────────────────────────────────────────────

describe("getSousTraitant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.sousTraitant.findUnique.mockResolvedValue(makeSousTraitant());
  });

  it("retourne un sous-traitant par id", async () => {
    const result = await getSousTraitant("st-uuid-001");
    expect(result?.id).toBe("st-uuid-001");
  });

  it("retourne null en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await getSousTraitant("st-uuid-001");
      expect(result).toBeNull();
      expect(mockPrisma.sousTraitant.findUnique).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listSousTraitants
// ─────────────────────────────────────────────────────────────────────────────

describe("listSousTraitants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.sousTraitant.findMany.mockResolvedValue([makeSousTraitant()]);
  });

  it("retourne tous les sous-traitants sans filtre", async () => {
    const result = await listSousTraitants();
    expect(result).toHaveLength(1);
  });

  it("filtre par actif si fourni", async () => {
    await listSousTraitants({ actif: true });
    expect(mockPrisma.sousTraitant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ actif: true }),
      }),
    );
  });

  it("retourne [] en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await listSousTraitants();
      expect(result).toEqual([]);
      expect(mockPrisma.sousTraitant.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifierDataGouv
// ─────────────────────────────────────────────────────────────────────────────

describe("verifierDataGouv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.sousTraitant.update.mockResolvedValue(
      makeSousTraitant({ verifieDataGouvAt: new Date() }),
    );
  });

  it("met à jour verifieDataGouvAt avec la date fournie", async () => {
    const dateVerif = new Date("2026-06-06T12:00:00.000Z");
    const result = await verifierDataGouv("st-uuid-001", dateVerif);

    expect(mockPrisma.sousTraitant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "st-uuid-001" },
        data: expect.objectContaining({ verifieDataGouvAt: dateVerif }),
      }),
    );
    expect(result.verifieDataGouvAt).not.toBeNull();
  });

  it("utilise new Date() si aucune date fournie", async () => {
    const avant = Date.now();
    await verifierDataGouv("st-uuid-001");
    const apres = Date.now();

    const callData = mockPrisma.sousTraitant.update.mock.calls[0]![0].data;
    const dateTs = (callData.verifieDataGouvAt as Date).getTime();
    expect(dateTs).toBeGreaterThanOrEqual(avant);
    expect(dateTs).toBeLessThanOrEqual(apres);
  });

  it("lève en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(verifierDataGouv("st-uuid-001")).rejects.toThrow("stub.invalid");
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

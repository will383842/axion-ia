/**
 * Tests — appreciation-service.ts (T14 — AGENT A — off.30).
 *
 * Strategie : mock @/lib/prisma.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appreciation: {
      create: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { creerAppreciation, listAppreciations, statsAppreciations } from "./appreciation-service";

const mockPrisma = prisma as unknown as {
  appreciation: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// creerAppreciation
// ─────────────────────────────────────────────────────────────────────────────

describe("creerAppreciation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cree une appreciation stagiaire avec note et retourne id", async () => {
    mockPrisma.appreciation.create.mockResolvedValue({ id: "app-1" });

    const result = await creerAppreciation({
      source: "stagiaire",
      traineeId: "t-1",
      note: 4,
      commentaire: "Tres bien",
      dateAppreciation: new Date("2026-06-01"),
    });

    expect(result).toEqual({ id: "app-1" });
    expect(mockPrisma.appreciation.create).toHaveBeenCalledOnce();
  });

  it("cree une appreciation sans note (champ optionnel)", async () => {
    mockPrisma.appreciation.create.mockResolvedValue({ id: "app-2" });

    const result = await creerAppreciation({
      source: "entreprise",
      dateAppreciation: new Date("2026-06-01"),
    });

    expect(result).toEqual({ id: "app-2" });
    const call = mockPrisma.appreciation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect("note" in call.data).toBe(false);
  });

  it("leve si note = 0 (invalide)", async () => {
    await expect(
      creerAppreciation({
        source: "formateur",
        note: 0,
        dateAppreciation: new Date(),
      }),
    ).rejects.toThrow("note invalide");
  });

  it("leve si note = 6 (invalide)", async () => {
    await expect(
      creerAppreciation({
        source: "financeur",
        note: 6,
        dateAppreciation: new Date(),
      }),
    ).rejects.toThrow("note invalide");
  });

  it("accepte note = 1 (borne basse)", async () => {
    mockPrisma.appreciation.create.mockResolvedValue({ id: "app-3" });

    await expect(
      creerAppreciation({ source: "stagiaire", note: 1, dateAppreciation: new Date() }),
    ).resolves.toEqual({ id: "app-3" });
  });

  it("accepte note = 5 (borne haute)", async () => {
    mockPrisma.appreciation.create.mockResolvedValue({ id: "app-4" });

    await expect(
      creerAppreciation({ source: "stagiaire", note: 5, dateAppreciation: new Date() }),
    ).resolves.toEqual({ id: "app-4" });
  });

  it("leve si note decimale (non entier)", async () => {
    await expect(
      creerAppreciation({ source: "stagiaire", note: 3.5, dateAppreciation: new Date() }),
    ).rejects.toThrow("note invalide");
  });

  it("leve si stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(
        creerAppreciation({ source: "stagiaire", dateAppreciation: new Date() }),
      ).rejects.toThrow("stub DB");
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  it("n'inclut pas enrollmentId/traineeId/clientId si absents (exactOptionalPropertyTypes)", async () => {
    mockPrisma.appreciation.create.mockResolvedValue({ id: "app-5" });

    await creerAppreciation({
      source: "entreprise",
      dateAppreciation: new Date("2026-06-01"),
    });

    const call = mockPrisma.appreciation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect("enrollmentId" in call.data).toBe(false);
    expect("traineeId" in call.data).toBe(false);
    expect("clientId" in call.data).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listAppreciations
// ─────────────────────────────────────────────────────────────────────────────

describe("listAppreciations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.appreciation.findMany.mockResolvedValue([]);
  });

  it("retourne une liste vide par defaut", async () => {
    const result = await listAppreciations();
    expect(result).toEqual([]);
  });

  it("applique le filtre source si fourni", async () => {
    mockPrisma.appreciation.findMany.mockResolvedValue([
      {
        id: "a-1",
        source: "stagiaire",
        enrollmentId: null,
        traineeId: "t-1",
        clientId: null,
        note: 5,
        commentaire: null,
        dateAppreciation: new Date("2026-06-01"),
        createdAt: new Date("2026-06-01"),
      },
    ]);

    const result = await listAppreciations({ source: "stagiaire" });

    expect(result).toHaveLength(1);
    expect(result[0]!.source).toBe("stagiaire");

    const call = mockPrisma.appreciation.findMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    expect(call.where["source"]).toBe("stagiaire");
  });

  it("applique le filtre traineeId si fourni", async () => {
    mockPrisma.appreciation.findMany.mockResolvedValue([]);

    await listAppreciations({ traineeId: "t-filter" });

    const call = mockPrisma.appreciation.findMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    expect(call.where["traineeId"]).toBe("t-filter");
  });

  it("applique take si limit fourni", async () => {
    mockPrisma.appreciation.findMany.mockResolvedValue([]);

    await listAppreciations({ limit: 10 });

    const call = mockPrisma.appreciation.findMany.mock.calls[0]![0] as Record<string, unknown>;
    expect(call["take"]).toBe(10);
  });

  it("retourne [] en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await listAppreciations();
      expect(result).toEqual([]);
      expect(mockPrisma.appreciation.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// statsAppreciations
// ─────────────────────────────────────────────────────────────────────────────

describe("statsAppreciations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne global count + moyenne par source", async () => {
    mockPrisma.appreciation.aggregate.mockResolvedValue({
      _count: { _all: 10 },
      _avg: { note: 4.2 },
    });
    mockPrisma.appreciation.groupBy.mockResolvedValue([
      { source: "stagiaire", _count: { _all: 7 }, _avg: { note: 4.5 } },
      { source: "entreprise", _count: { _all: 3 }, _avg: { note: 3.7 } },
    ]);

    const stats = await statsAppreciations();

    expect(stats.global.count).toBe(10);
    expect(stats.global.moyenne).toBeCloseTo(4.2);
    expect(stats.parSource["stagiaire"].count).toBe(7);
    expect(stats.parSource["stagiaire"].moyenne).toBeCloseTo(4.5);
    expect(stats.parSource["entreprise"].count).toBe(3);
    // Sources sans donnees = count 0, moyenne null
    expect(stats.parSource["financeur"].count).toBe(0);
    expect(stats.parSource["financeur"].moyenne).toBeNull();
    expect(stats.parSource["formateur"].count).toBe(0);
    expect(stats.parSource["formateur"].moyenne).toBeNull();
  });

  it("retourne global moyenne=null si aucune note", async () => {
    mockPrisma.appreciation.aggregate.mockResolvedValue({
      _count: { _all: 5 },
      _avg: { note: null },
    });
    mockPrisma.appreciation.groupBy.mockResolvedValue([]);

    const stats = await statsAppreciations();

    expect(stats.global.count).toBe(5);
    expect(stats.global.moyenne).toBeNull();
  });

  it("retourne stats vides en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const stats = await statsAppreciations();
      expect(stats.global.count).toBe(0);
      expect(stats.global.moyenne).toBeNull();
      expect(mockPrisma.appreciation.aggregate).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

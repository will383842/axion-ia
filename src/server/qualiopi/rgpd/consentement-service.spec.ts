/**
 * Tests — consentement-service.ts (T15 AGENT C).
 *
 * Stratégie :
 *   - Mock @/lib/prisma.
 *   - Vérifie : enregistrerConsentement (nominal, flags partiels, stub-aware),
 *     consentementAJour (à jour, version différente, jamais consenti, stub).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainee: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { enregistrerConsentement, consentementAJour } from "./consentement-service";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mockPrisma = prisma as unknown as {
  trainee: {
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
};

const TRAINEE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const VERSION = "v2.0";

// ─────────────────────────────────────────────────────────────────────────────
// enregistrerConsentement
// ─────────────────────────────────────────────────────────────────────────────

describe("enregistrerConsentement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.trainee.update.mockResolvedValue({ id: TRAINEE_ID });
  });

  it("retourne traineeId, version et at (Date)", async () => {
    const result = await enregistrerConsentement(TRAINEE_ID, VERSION);

    expect(result.traineeId).toBe(TRAINEE_ID);
    expect(result.version).toBe(VERSION);
    expect(result.at).toBeInstanceOf(Date);
  });

  it("appelle prisma.trainee.update avec consentementVersion + consentementAt", async () => {
    await enregistrerConsentement(TRAINEE_ID, VERSION);

    expect(mockPrisma.trainee.update).toHaveBeenCalledOnce();
    const call = mockPrisma.trainee.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { consentementVersion: string; consentementAt: Date };
    };
    expect(call.where.id).toBe(TRAINEE_ID);
    expect(call.data.consentementVersion).toBe(VERSION);
    expect(call.data.consentementAt).toBeInstanceOf(Date);
  });

  it("inclut consentementFormation si flag formation fourni", async () => {
    await enregistrerConsentement(TRAINEE_ID, VERSION, { formation: true });

    const call = mockPrisma.trainee.update.mock.calls[0]?.[0] as {
      data: { consentementFormation?: boolean };
    };
    expect(call.data.consentementFormation).toBe(true);
  });

  it("inclut consentementEmail si flag email fourni", async () => {
    await enregistrerConsentement(TRAINEE_ID, VERSION, { email: false });

    const call = mockPrisma.trainee.update.mock.calls[0]?.[0] as {
      data: { consentementEmail?: boolean };
    };
    expect(call.data.consentementEmail).toBe(false);
  });

  it("n'inclut pas consentementFormation si flag absent (exactOptionalPropertyTypes)", async () => {
    await enregistrerConsentement(TRAINEE_ID, VERSION, { email: true });

    const call = mockPrisma.trainee.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect("consentementFormation" in call.data).toBe(false);
  });

  it("n'inclut pas les flags si flags=undefined", async () => {
    await enregistrerConsentement(TRAINEE_ID, VERSION);

    const call = mockPrisma.trainee.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect("consentementFormation" in call.data).toBe(false);
    expect("consentementEmail" in call.data).toBe(false);
  });

  it("lève si stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";

    await expect(enregistrerConsentement(TRAINEE_ID, VERSION)).rejects.toThrow("stub");

    process.env["DATABASE_URL"] = original;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// consentementAJour
// ─────────────────────────────────────────────────────────────────────────────

describe("consentementAJour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne true si version correspond et consentementAt non null", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue({
      consentementVersion: VERSION,
      consentementAt: new Date("2026-06-01T00:00:00Z"),
    });

    const result = await consentementAJour(TRAINEE_ID, VERSION);
    expect(result).toBe(true);
  });

  it("retourne false si version différente", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue({
      consentementVersion: "v1.0",
      consentementAt: new Date("2026-01-01T00:00:00Z"),
    });

    const result = await consentementAJour(TRAINEE_ID, VERSION);
    expect(result).toBe(false);
  });

  it("retourne false si consentementAt est null (jamais consenti)", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue({
      consentementVersion: VERSION,
      consentementAt: null,
    });

    const result = await consentementAJour(TRAINEE_ID, VERSION);
    expect(result).toBe(false);
  });

  it("retourne false si consentementVersion est null", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue({
      consentementVersion: null,
      consentementAt: new Date(),
    });

    const result = await consentementAJour(TRAINEE_ID, VERSION);
    expect(result).toBe(false);
  });

  it("retourne false si stagiaire introuvable", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue(null);

    const result = await consentementAJour(TRAINEE_ID, VERSION);
    expect(result).toBe(false);
  });

  it("retourne false si stub.invalid (pas de throw — lecture fail-soft)", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";

    const result = await consentementAJour(TRAINEE_ID, VERSION);
    expect(result).toBe(false);
    expect(mockPrisma.trainee.findUnique).not.toHaveBeenCalled();

    process.env["DATABASE_URL"] = original;
  });

  afterEach(() => {
    // Restaurer DATABASE_URL si un test l'a modifiée sans restaurer
    if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
      delete process.env["DATABASE_URL"];
    }
  });
});

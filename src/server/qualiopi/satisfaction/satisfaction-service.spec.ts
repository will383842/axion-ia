/**
 * Tests — satisfaction-service.ts (T10 — AGENT A).
 *
 * Stratégie : mock @/lib/prisma + @/server/qualiopi/documents/qr.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaire: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/qualiopi/documents/qr", () => ({
  makeQrToken: vi
    .fn()
    .mockReturnValue("tok-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"),
}));

import { prisma } from "@/lib/prisma";
import { makeQrToken } from "@/server/qualiopi/documents/qr";
import {
  creerQuestionnaire,
  soumettreReponses,
  listQuestionnairesSession,
} from "./satisfaction-service";

const mockPrisma = prisma as unknown as {
  questionnaire: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

const mockMakeQrToken = makeQrToken as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// creerQuestionnaire
// ─────────────────────────────────────────────────────────────────────────────

describe("creerQuestionnaire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMakeQrToken.mockReturnValue(
      "tok-nouveau-token-hexadecimal-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    );
  });

  it("crée un questionnaire si inexistant et retourne id+token", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(null);
    mockPrisma.questionnaire.create.mockResolvedValue({
      id: "q-uuid-1",
      token: "tok-nouveau-token-hexadecimal-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    });

    const result = await creerQuestionnaire({
      enrollmentId: "enroll-1",
      type: "satisfaction_chaud",
    });

    expect(result).toEqual({
      id: "q-uuid-1",
      token: "tok-nouveau-token-hexadecimal-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    });
    expect(mockPrisma.questionnaire.create).toHaveBeenCalledOnce();
  });

  it("retourne l'existant (idempotent) si déjà créé", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue({
      id: "q-existant",
      token: "tok-existant",
    });

    const result = await creerQuestionnaire({
      enrollmentId: "enroll-2",
      type: "satisfaction_froid",
    });

    expect(result).toEqual({ id: "q-existant", token: "tok-existant" });
    expect(mockPrisma.questionnaire.create).not.toHaveBeenCalled();
  });

  it("utilise makeQrToken pour générer le token", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(null);
    mockPrisma.questionnaire.create.mockResolvedValue({ id: "q-2", token: "tok-new" });

    await creerQuestionnaire({ enrollmentId: "enroll-3", type: "positionnement" });

    expect(mockMakeQrToken).toHaveBeenCalledOnce();
  });

  it("recherche par enrollmentId_type (contrainte unique)", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(null);
    mockPrisma.questionnaire.create.mockResolvedValue({ id: "q-3", token: "tok-3" });

    await creerQuestionnaire({ enrollmentId: "enroll-4", type: "satisfaction_chaud" });

    expect(mockPrisma.questionnaire.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          enrollmentId_type: {
            enrollmentId: "enroll-4",
            type: "satisfaction_chaud",
          },
        },
      }),
    );
  });

  it("lève si DATABASE_URL contient stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(
        creerQuestionnaire({ enrollmentId: "any", type: "positionnement" }),
      ).rejects.toThrow();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// soumettreReponses
// ─────────────────────────────────────────────────────────────────────────────

describe("soumettreReponses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne null si le token est inconnu", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue(null);

    const result = await soumettreReponses({
      token: "tok-inconnu",
      reponses: { q1: "oui" },
    });

    expect(result).toBeNull();
    expect(mockPrisma.questionnaire.update).not.toHaveBeenCalled();
  });

  it("met à jour reponses + noteGlobale + reponduAt", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue({ id: "q-uuid-1" });
    mockPrisma.questionnaire.update.mockResolvedValue({ id: "q-uuid-1" });

    const result = await soumettreReponses({
      token: "tok-valid",
      reponses: { satisfaction: "très bien" },
      noteGlobale: 5,
    });

    expect(result).toEqual({ id: "q-uuid-1" });
    const call = mockPrisma.questionnaire.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data["reponses"]).toEqual({ satisfaction: "très bien" });
    expect(call.data["noteGlobale"]).toBe(5);
    expect(call.data["reponduAt"]).toBeInstanceOf(Date);
  });

  it("accepte noteGlobale = 1 (borne basse)", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue({ id: "q-2" });
    mockPrisma.questionnaire.update.mockResolvedValue({ id: "q-2" });

    await expect(
      soumettreReponses({ token: "tok-2", reponses: {}, noteGlobale: 1 }),
    ).resolves.toEqual({ id: "q-2" });
  });

  it("accepte noteGlobale = 5 (borne haute)", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue({ id: "q-3" });
    mockPrisma.questionnaire.update.mockResolvedValue({ id: "q-3" });

    await expect(
      soumettreReponses({ token: "tok-3", reponses: {}, noteGlobale: 5 }),
    ).resolves.toEqual({ id: "q-3" });
  });

  it("lève si noteGlobale = 0 (invalide)", async () => {
    await expect(
      soumettreReponses({ token: "tok-4", reponses: {}, noteGlobale: 0 }),
    ).rejects.toThrow("noteGlobale invalide");
  });

  it("lève si noteGlobale = 6 (invalide)", async () => {
    await expect(
      soumettreReponses({ token: "tok-5", reponses: {}, noteGlobale: 6 }),
    ).rejects.toThrow("noteGlobale invalide");
  });

  it("lève si noteGlobale est décimal (non entier)", async () => {
    await expect(
      soumettreReponses({ token: "tok-6", reponses: {}, noteGlobale: 3.5 }),
    ).rejects.toThrow("noteGlobale invalide");
  });

  it("n'inclut pas noteGlobale si absent (exactOptionalPropertyTypes)", async () => {
    mockPrisma.questionnaire.findUnique.mockResolvedValue({ id: "q-7" });
    mockPrisma.questionnaire.update.mockResolvedValue({ id: "q-7" });

    await soumettreReponses({ token: "tok-7", reponses: { q1: "non" } });

    const call = mockPrisma.questionnaire.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect("noteGlobale" in call.data).toBe(false);
  });

  it("lève si DATABASE_URL contient stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(soumettreReponses({ token: "any", reponses: {} })).rejects.toThrow();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listQuestionnairesSession
// ─────────────────────────────────────────────────────────────────────────────

describe("listQuestionnairesSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.questionnaire.findMany.mockResolvedValue([]);
  });

  it("appelle findMany avec le bon sessionId", async () => {
    await listQuestionnairesSession("session-1");

    expect(mockPrisma.questionnaire.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enrollment: { sessionId: "session-1" } },
      }),
    );
  });

  it("retourne les questionnaires", async () => {
    const fakeQ = { id: "q-1", enrollmentId: "e-1", type: "satisfaction_chaud" };
    mockPrisma.questionnaire.findMany.mockResolvedValue([fakeQ]);

    const result = await listQuestionnairesSession("session-2");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "q-1" });
  });

  it("retourne [] en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await listQuestionnairesSession("any");
      expect(result).toEqual([]);
      expect(mockPrisma.questionnaire.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

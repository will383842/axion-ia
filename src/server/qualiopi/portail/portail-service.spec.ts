/**
 * Tests — portail-service.ts (T14 — AGENT A).
 *
 * Stratégie : mock @/lib/prisma + @/lib/pii-crypto.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    portailAcces: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    trainee: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: vi.fn((v: string | null) => (v === null ? null : `decrypted:${v}`)),
}));

import { prisma } from "@/lib/prisma";
import { creerAcces, verifierToken, revoquerAcces, getEspaceStagiaire } from "./portail-service";

const mockPrisma = prisma as unknown as {
  portailAcces: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  trainee: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// creerAcces
// ─────────────────────────────────────────────────────────────────────────────

describe("creerAcces", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cree un acces et retourne id, token (64 chars hex), expiresAt", async () => {
    const fakeExpires = new Date(Date.now() + 90 * 86400 * 1000);
    mockPrisma.portailAcces.create.mockResolvedValue({
      id: "acces-uuid-1",
      token: "a".repeat(64),
      expiresAt: fakeExpires,
    });

    const result = await creerAcces("trainee-1");

    expect(result.id).toBe("acces-uuid-1");
    expect(result.token).toHaveLength(64);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(mockPrisma.portailAcces.create).toHaveBeenCalledOnce();
  });

  it("transmet traineeId et expiresAt calcule a Prisma", async () => {
    const fakeExpires = new Date();
    mockPrisma.portailAcces.create.mockResolvedValue({
      id: "acces-2",
      token: "b".repeat(64),
      expiresAt: fakeExpires,
    });

    const before = Date.now();
    await creerAcces("trainee-2", 30);
    const after = Date.now();

    const callArg = mockPrisma.portailAcces.create.mock.calls[0]![0] as {
      data: { traineeId: string; expiresAt: Date };
    };
    expect(callArg.data.traineeId).toBe("trainee-2");
    const expiresMs = callArg.data.expiresAt.getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + 30 * 86400 * 1000 - 2000);
    expect(expiresMs).toBeLessThanOrEqual(after + 30 * 86400 * 1000 + 2000);
  });

  it("leve si DATABASE_URL contient stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(creerAcces("any")).rejects.toThrow("stub DB");
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifierToken
// ─────────────────────────────────────────────────────────────────────────────

describe("verifierToken", () => {
  beforeEach(() => vi.clearAllMocks());

  const validToken = "c".repeat(64);
  const validAcces = {
    id: "acces-v1",
    traineeId: "trainee-v1",
    token: validToken,
    expiresAt: new Date(Date.now() + 86400 * 1000),
    revoked: false,
  };

  it("retourne traineeId pour un token valide non-revoque non-expire", async () => {
    mockPrisma.portailAcces.findUnique.mockResolvedValue(validAcces);
    mockPrisma.portailAcces.update.mockResolvedValue({});

    const result = await verifierToken(validToken);

    expect(result).toEqual({ traineeId: "trainee-v1" });
  });

  it("retourne null si token inconnu (findUnique=null)", async () => {
    mockPrisma.portailAcces.findUnique.mockResolvedValue(null);

    const result = await verifierToken("tok-inconnu".padEnd(64, "0"));

    expect(result).toBeNull();
    expect(mockPrisma.portailAcces.update).not.toHaveBeenCalled();
  });

  it("retourne null si revoked=true", async () => {
    mockPrisma.portailAcces.findUnique.mockResolvedValue({ ...validAcces, revoked: true });

    const result = await verifierToken(validToken);

    expect(result).toBeNull();
  });

  it("retourne null si expiresAt est dans le passe", async () => {
    mockPrisma.portailAcces.findUnique.mockResolvedValue({
      ...validAcces,
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await verifierToken(validToken);

    expect(result).toBeNull();
  });

  it("met a jour lastUsedAt sur verification reussie", async () => {
    mockPrisma.portailAcces.findUnique.mockResolvedValue(validAcces);
    mockPrisma.portailAcces.update.mockResolvedValue({});

    await verifierToken(validToken);
    await Promise.resolve();

    expect(mockPrisma.portailAcces.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "acces-v1" },
        data: expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      }),
    );
  });

  it("retourne null en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await verifierToken("any".padEnd(64, "0"));
      expect(result).toBeNull();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// revoquerAcces
// ─────────────────────────────────────────────────────────────────────────────

describe("revoquerAcces", () => {
  beforeEach(() => vi.clearAllMocks());

  it("appelle prisma.portailAcces.update avec revoked=true", async () => {
    mockPrisma.portailAcces.update.mockResolvedValue({});

    await revoquerAcces("acces-r1");

    expect(mockPrisma.portailAcces.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "acces-r1" },
        data: { revoked: true },
      }),
    );
  });

  it("leve si stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(revoquerAcces("any")).rejects.toThrow("stub DB");
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getEspaceStagiaire
// ─────────────────────────────────────────────────────────────────────────────

describe("getEspaceStagiaire", () => {
  beforeEach(() => vi.clearAllMocks());

  const fakeTrainee = {
    prenom: "Alice",
    nom: "Dupont",
    situationHandicap: true,
    handicapDetailsChiffre: "enc:v1:aabbcc:ddeeff:112233",
    enrollments: [
      {
        statut: "confirmee",
        createdAt: new Date("2026-01-01"),
        session: {
          titreSession: "Formation IA",
          dateDebut: new Date("2026-02-01"),
          dateFin: new Date("2026-02-02"),
        },
        attestationDocument: {
          type: "attestation_realisation",
          numero: "ATT-001",
          pdfUrl: "https://example.com/att.pdf",
          qrToken: "qr-token-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        },
        questionnaires: [
          {
            type: "satisfaction_chaud",
            token: "quest-tok-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            reponduAt: null,
          },
        ],
      },
    ],
  };

  it("retourne l'espace stagiaire avec formations, attestations, questionnaires", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue(fakeTrainee);

    const espace = await getEspaceStagiaire("trainee-g1");

    expect(espace.trainee).toEqual({ prenom: "Alice", nom: "Dupont" });
    expect(espace.formations).toHaveLength(1);
    expect(espace.formations[0]!.titre).toBe("Formation IA");
    expect(espace.attestations).toHaveLength(1);
    expect(espace.attestations[0]!.numero).toBe("ATT-001");
    expect(espace.questionnaires).toHaveLength(1);
  });

  it("dechiffre le detail handicap via decryptPii", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue(fakeTrainee);

    const espace = await getEspaceStagiaire("trainee-g2");

    expect(espace.situationHandicap.declaree).toBe(true);
    expect(espace.situationHandicap.details).toBe("decrypted:enc:v1:aabbcc:ddeeff:112233");
  });

  it("retourne details=null si handicapDetailsChiffre est null", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue({
      ...fakeTrainee,
      situationHandicap: false,
      handicapDetailsChiffre: null,
    });

    const espace = await getEspaceStagiaire("trainee-g3");

    expect(espace.situationHandicap.declaree).toBe(false);
    expect(espace.situationHandicap.details).toBeNull();
  });

  it("leve si le stagiaire est introuvable", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue(null);

    await expect(getEspaceStagiaire("trainee-inconnu")).rejects.toThrow("introuvable");
  });

  it("retourne un espace vide en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const espace = await getEspaceStagiaire("any");
      expect(espace.formations).toEqual([]);
      expect(espace.attestations).toEqual([]);
      expect(espace.questionnaires).toEqual([]);
      expect(mockPrisma.trainee.findUnique).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

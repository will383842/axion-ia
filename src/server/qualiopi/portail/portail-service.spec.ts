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
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn().mockResolvedValue({ enqueued: true }),
}));

vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: vi.fn((v: string | null) => (v === null ? null : `decrypted:${v}`)),
}));

vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: vi.fn().mockReturnValue(false),
  getSignedUrlR2: vi.fn().mockResolvedValue("https://r2.example.com/signed-fresh.pdf"),
}));

import { prisma } from "@/lib/prisma";
import { isR2Configured, getSignedUrlR2 } from "@/lib/r2-storage";
import { enqueueEmail } from "@/server/queue/queues";
import {
  creerAcces,
  verifierToken,
  revoquerAcces,
  getEspaceStagiaire,
  demanderAccesParEmail,
} from "./portail-service";

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

const mockIsR2Configured = isR2Configured as ReturnType<typeof vi.fn>;
const mockGetSignedUrlR2 = getSignedUrlR2 as ReturnType<typeof vi.fn>;

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
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsR2Configured.mockReturnValue(false);
    mockGetSignedUrlR2.mockResolvedValue("https://r2.example.com/signed-fresh.pdf");
  });

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
          type: "attestation",
          numero: "AXI-ATT-2026-001",
          pdfUrl: "https://example.com/att.pdf",
          qrToken: "qr-token-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          createdAt: new Date("2026-02-02T10:00:00Z"),
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
    expect(espace.attestations[0]!.numero).toBe("AXI-ATT-2026-001");
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

  // ── S1 : URL signée régénérée (24 h) ──────────────────────────────────────

  it("S1 : régénère une URL signée fraîche (24 h) si R2 configuré", async () => {
    mockIsR2Configured.mockReturnValue(true);
    mockGetSignedUrlR2.mockResolvedValue("https://r2.example.com/signed-fresh.pdf");
    mockPrisma.trainee.findUnique.mockResolvedValue(fakeTrainee);

    const espace = await getEspaceStagiaire("trainee-s1");

    expect(mockGetSignedUrlR2).toHaveBeenCalledOnce();
    expect(mockGetSignedUrlR2).toHaveBeenCalledWith(
      "documents/2026/attestation/AXI-ATT-2026-001.pdf",
      86400,
    );
    expect(espace.attestations[0]!.pdfUrl).toBe("https://r2.example.com/signed-fresh.pdf");
  });

  it("S1 : construit la clé R2 à partir de createdAt.getFullYear(), type et numero", async () => {
    mockIsR2Configured.mockReturnValue(true);
    mockPrisma.trainee.findUnique.mockResolvedValue({
      ...fakeTrainee,
      enrollments: [
        {
          ...fakeTrainee.enrollments[0],
          attestationDocument: {
            type: "attestation_partielle",
            numero: "AXI-ATT-2025-042",
            pdfUrl: "https://example.com/old.pdf",
            qrToken: null,
            createdAt: new Date("2025-11-15T09:00:00Z"),
          },
        },
      ],
    });

    await getEspaceStagiaire("trainee-s1b");

    expect(mockGetSignedUrlR2).toHaveBeenCalledWith(
      "documents/2025/attestation_partielle/AXI-ATT-2025-042.pdf",
      86400,
    );
  });

  it("S1 : fallback vers pdfUrl DB si R2 non configuré", async () => {
    mockIsR2Configured.mockReturnValue(false);
    mockPrisma.trainee.findUnique.mockResolvedValue(fakeTrainee);

    const espace = await getEspaceStagiaire("trainee-s1c");

    expect(mockGetSignedUrlR2).not.toHaveBeenCalled();
    expect(espace.attestations[0]!.pdfUrl).toBe("https://example.com/att.pdf");
  });

  it("S1 : fallback fail-soft vers pdfUrl DB si getSignedUrlR2 lève", async () => {
    mockIsR2Configured.mockReturnValue(true);
    mockGetSignedUrlR2.mockRejectedValue(new Error("R2 network error"));
    mockPrisma.trainee.findUnique.mockResolvedValue(fakeTrainee);

    const espace = await getEspaceStagiaire("trainee-s1d");

    // Ne doit pas lever — retourne la pdfUrl DB (fallback)
    expect(espace.attestations[0]!.pdfUrl).toBe("https://example.com/att.pdf");
  });

  it("S1 : retourne pdfUrl=null si pdfUrl DB null et R2 non configuré", async () => {
    mockIsR2Configured.mockReturnValue(false);
    mockPrisma.trainee.findUnique.mockResolvedValue({
      ...fakeTrainee,
      enrollments: [
        {
          ...fakeTrainee.enrollments[0],
          attestationDocument: {
            ...fakeTrainee.enrollments[0]!.attestationDocument,
            pdfUrl: null,
          },
        },
      ],
    });

    const espace = await getEspaceStagiaire("trainee-s1e");

    expect(espace.attestations[0]!.pdfUrl).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// demanderAccesParEmail (self-service)
// ─────────────────────────────────────────────────────────────────────────────

describe("demanderAccesParEmail", () => {
  const traineeFindFirst = () =>
    (prisma as unknown as { trainee: { findFirst: ReturnType<typeof vi.fn> } }).trainee.findFirst;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("silencieux (aucun envoi) si aucun stagiaire ne correspond — anti-énumération", async () => {
    traineeFindFirst().mockResolvedValue(null);

    await demanderAccesParEmail("inconnu@exemple.fr");

    expect(mockPrisma.portailAcces.create).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("crée un accès et envoie le lien si un stagiaire correspond", async () => {
    traineeFindFirst().mockResolvedValue({ id: "trainee-42", prenom: "Jean", nom: "Dupont" });
    mockPrisma.portailAcces.create.mockResolvedValue({
      id: "acc-1",
      token: "t".repeat(64),
      expiresAt: new Date(),
    });

    await demanderAccesParEmail("  Jean.Dupont@Exemple.FR  ");

    // email normalisé (trim + lowercase) pour la recherche
    expect(traineeFindFirst()).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ email: "jean.dupont@exemple.fr" }),
      }),
    );
    expect(mockPrisma.portailAcces.create).toHaveBeenCalledTimes(1);
    expect(enqueueEmail).toHaveBeenCalledWith(
      "qualiopi-portail-acces",
      "jean.dupont@exemple.fr",
      "fr",
      expect.objectContaining({
        stagiairePrenomNom: "Jean Dupont",
        lienPortail: expect.stringContaining("/portail/acces/"),
      }),
    );
  });
});

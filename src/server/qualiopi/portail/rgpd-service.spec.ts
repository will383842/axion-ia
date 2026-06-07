/**
 * Tests — rgpd-service.ts (T14 — AGENT A).
 *
 * Strategie : mock @/lib/prisma + @/lib/pii-crypto.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainee: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    portailAcces: {
      updateMany: vi.fn(),
    },
    rgpdDemande: {
      create: vi.fn(),
    },
    // Forme tableau : exécute les opérations passées (update + updateMany).
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: vi.fn((v: string | null) => (v === null ? null : `decrypted:${v}`)),
}));

import { prisma } from "@/lib/prisma";
import { exporterDonneesStagiaire, supprimerStagiaire, creerDemandeRgpd } from "./rgpd-service";

const mockPrisma = prisma as unknown as {
  trainee: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  portailAcces: {
    updateMany: ReturnType<typeof vi.fn>;
  };
  rgpdDemande: {
    create: ReturnType<typeof vi.fn>;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// exporterDonneesStagiaire
// ─────────────────────────────────────────────────────────────────────────────

describe("exporterDonneesStagiaire", () => {
  beforeEach(() => vi.clearAllMocks());

  const fakeTrainee = {
    id: "t-1",
    nom: "Martin",
    prenom: "Jean",
    email: "jean@example.com",
    telephone: "0600000000",
    entreprise: "ACME",
    fonction: "DRH",
    situationHandicap: true,
    handicapDetailsChiffre: "enc:v1:aa:bb:cc",
    consentementFormation: true,
    consentementEmail: false,
    consentementVersion: "1.0",
    consentementAt: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    enrollments: [],
    documents: [],
    appreciations: [],
    rgpdDemandes: [],
  };

  it("retourne un objet exporteAt + stagiaire + donnees", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue(fakeTrainee);

    const result = (await exporterDonneesStagiaire("t-1")) as Record<string, unknown>;

    expect(result["exporteAt"]).toBeDefined();
    const stagiaire = result["stagiaire"] as Record<string, unknown>;
    expect(stagiaire["nom"]).toBe("Martin");
    expect(stagiaire["email"]).toBe("jean@example.com");
  });

  it("dechiffre handicapDetailsChiffre via decryptPii", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue(fakeTrainee);

    const result = (await exporterDonneesStagiaire("t-1")) as Record<string, unknown>;

    const stagiaire = result["stagiaire"] as Record<string, unknown>;
    expect(stagiaire["handicapDetails"]).toBe("decrypted:enc:v1:aa:bb:cc");
  });

  it("retourne handicapDetails=null si champ null", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue({
      ...fakeTrainee,
      handicapDetailsChiffre: null,
    });

    const result = (await exporterDonneesStagiaire("t-1")) as Record<string, unknown>;

    const stagiaire = result["stagiaire"] as Record<string, unknown>;
    expect(stagiaire["handicapDetails"]).toBeNull();
  });

  it("retourne {} si stagiaire introuvable", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue(null);

    const result = await exporterDonneesStagiaire("t-inconnu");

    expect(result).toEqual({});
  });

  it("retourne {} en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await exporterDonneesStagiaire("any");
      expect(result).toEqual({});
      expect(mockPrisma.trainee.findUnique).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// supprimerStagiaire
// ─────────────────────────────────────────────────────────────────────────────

describe("supprimerStagiaire", () => {
  beforeEach(() => vi.clearAllMocks());

  it("appelle prisma.trainee.update avec les champs anonymises et deletedAt", async () => {
    mockPrisma.trainee.update.mockResolvedValue({});

    await supprimerStagiaire("t-del-1");

    const call = mockPrisma.trainee.update.mock.calls[0]![0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(call.where.id).toBe("t-del-1");
    expect(call.data["nom"]).toBe("[supprime]");
    expect(call.data["prenom"]).toBe("[supprime]");
    expect(call.data["email"]).toContain("anonymise.invalid");
    expect(call.data["telephone"]).toBeNull();
    expect(call.data["handicapDetailsChiffre"]).toBeNull();
    expect(call.data["deletedAt"]).toBeInstanceOf(Date);
  });

  it("email anonymise contient le traineeId pour garantir l'unicite", async () => {
    mockPrisma.trainee.update.mockResolvedValue({});

    await supprimerStagiaire("t-del-unique-id");

    const call = mockPrisma.trainee.update.mock.calls[0]![0] as {
      data: { email: string };
    };
    expect(call.data.email).toContain("t-del-unique-id");
  });

  it("ne fait PAS de DELETE physique (utilise update)", async () => {
    mockPrisma.trainee.update.mockResolvedValue({});

    await supprimerStagiaire("t-del-2");

    expect(mockPrisma.trainee.update).toHaveBeenCalledOnce();
  });

  it("revoque les acces portail actifs du stagiaire anonymise (RGPD)", async () => {
    mockPrisma.trainee.update.mockResolvedValue({});
    mockPrisma.portailAcces.updateMany.mockResolvedValue({ count: 2 });

    await supprimerStagiaire("t-del-rgpd");

    expect(mockPrisma.portailAcces.updateMany).toHaveBeenCalledOnce();
    const call = mockPrisma.portailAcces.updateMany.mock.calls[0]![0] as {
      where: { traineeId: string; revoked: boolean };
      data: { revoked: boolean };
    };
    expect(call.where.traineeId).toBe("t-del-rgpd");
    expect(call.where.revoked).toBe(false);
    expect(call.data.revoked).toBe(true);
  });

  it("leve si stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(supprimerStagiaire("any")).rejects.toThrow("stub DB");
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// creerDemandeRgpd
// ─────────────────────────────────────────────────────────────────────────────

describe("creerDemandeRgpd", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cree une demande RGPD export avec statut demandee", async () => {
    const fakeDate = new Date("2026-06-06");
    mockPrisma.rgpdDemande.create.mockResolvedValue({
      id: "rgpd-1",
      type: "export",
      demandeAt: fakeDate,
    });

    const result = await creerDemandeRgpd("t-rgpd-1", "export");

    expect(result).toEqual({ id: "rgpd-1", type: "export", demandeAt: fakeDate });
    const call = mockPrisma.rgpdDemande.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data["statut"]).toBe("demandee");
    expect(call.data["traineeId"]).toBe("t-rgpd-1");
    expect(call.data["type"]).toBe("export");
  });

  it("cree une demande RGPD suppression", async () => {
    const fakeDate = new Date("2026-06-06");
    mockPrisma.rgpdDemande.create.mockResolvedValue({
      id: "rgpd-2",
      type: "suppression",
      demandeAt: fakeDate,
    });

    const result = await creerDemandeRgpd("t-rgpd-2", "suppression");

    expect(result.type).toBe("suppression");
  });

  it("demandeAt est une date recente", async () => {
    const before = Date.now();
    mockPrisma.rgpdDemande.create.mockImplementation(
      async (args: { data: { demandeAt: Date } }) => ({
        id: "rgpd-3",
        type: "export",
        demandeAt: args.data.demandeAt,
      }),
    );

    const result = await creerDemandeRgpd("t-rgpd-3", "export");
    const after = Date.now();

    expect(result.demandeAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.demandeAt.getTime()).toBeLessThanOrEqual(after + 100);
  });

  it("leve si stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(creerDemandeRgpd("any", "export")).rejects.toThrow("stub DB");
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

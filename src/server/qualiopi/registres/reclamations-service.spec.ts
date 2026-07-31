/**
 * Tests — registres/reclamations-service.ts (T12 — AGENT A).
 *
 * Stratégie : mock @/lib/prisma + @/server/qualiopi/config/site-settings.
 * Vérifie : création numéro AXI-REC, retry collision, réponse, statut,
 * liste, réclamations en retard (seuil config ou défaut 15), stub-aware.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reclamation: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockRejectedValue(new Error("clé absente")),
}));

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import {
  creerReclamation,
  repondreReclamation,
  setStatutReclamation,
  listReclamations,
  reclamationsEnRetard,
} from "./reclamations-service";

const mockPrisma = prisma as unknown as {
  reclamation: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const mockGetConfig = getQualiopiConfig as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeReclamation(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-uuid-001",
    numero: "AXI-REC-2026-001",
    source: "stagiaire" as const,
    reclamantNom: "Jean Dupont",
    reclamantEmail: "jean@example.com",
    objet: "Problème de connexion",
    description: "Impossible de se connecter au portail.",
    gravite: null,
    statut: "nouvelle" as const,
    dateReception: new Date("2026-06-01T10:00:00.000Z"),
    dateReponse: null,
    reponse: null,
    actionsCorrectives: null,
    enrollmentId: null,
    traiteeParId: null,
    createdAt: new Date("2026-06-01T10:00:00.000Z"),
    updatedAt: new Date("2026-06-01T10:00:00.000Z"),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// creerReclamation
// ─────────────────────────────────────────────────────────────────────────────

describe("creerReclamation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.reclamation.count.mockResolvedValue(0);
    // Chemin d'allocation depuis V20 : borne haute, série vide par défaut.
    mockPrisma.reclamation.findMany.mockResolvedValue([]);
    mockPrisma.reclamation.create.mockResolvedValue(makeReclamation());
  });

  it("crée une réclamation avec le numéro AXI-REC-YYYY-NNN correct", async () => {
    const result = await creerReclamation({
      source: "stagiaire",
      reclamantNom: "Jean Dupont",
      objet: "Problème de connexion",
      description: "Impossible de se connecter au portail.",
      dateReception: new Date("2026-06-01T10:00:00.000Z"),
    });

    // 🔴 Le dénominateur est désormais la SÉRIE, pas une fenêtre de dates : une
    // ligne reçue dans l'année mais numérotée hors série ne compte plus.
    expect(mockPrisma.reclamation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { numero: { startsWith: "AXI-REC-2026-" } },
      }),
    );
    expect(mockPrisma.reclamation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ numero: "AXI-REC-2026-001" }),
      }),
    );
    expect(result.numero).toBe("AXI-REC-2026-001");
  });

  it("génère AXI-REC-2026-004 si le maximum de la série est 003", async () => {
    // Trou volontaire en 002 : `count + 1` aurait rendu 003, déjà émis.
    mockPrisma.reclamation.findMany.mockResolvedValue([
      { numero: "AXI-REC-2026-001" },
      { numero: "AXI-REC-2026-003" },
    ]);
    mockPrisma.reclamation.create.mockResolvedValue(
      makeReclamation({ numero: "AXI-REC-2026-004" }),
    );

    const result = await creerReclamation({
      source: "client",
      reclamantNom: "Marie Martin",
      objet: "Facture incorrecte",
      description: "Le montant ne correspond pas.",
      dateReception: new Date("2026-06-10T08:00:00.000Z"),
    });

    expect(mockPrisma.reclamation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ numero: "AXI-REC-2026-004" }),
      }),
    );
    expect(result.numero).toBe("AXI-REC-2026-004");
  });

  it("transmet les champs optionnels si fournis", async () => {
    await creerReclamation({
      source: "financeur",
      reclamantNom: "OPCO Atlas",
      reclamantEmail: "opco@atlas.fr",
      objet: "Justificatifs manquants",
      description: "Dossier incomplet.",
      gravite: "haute",
      dateReception: new Date("2026-06-15T09:00:00.000Z"),
      enrollmentId: "enr-uuid-001",
      traiteeParId: "admin-uuid-001",
    });

    expect(mockPrisma.reclamation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reclamantEmail: "opco@atlas.fr",
          gravite: "haute",
          enrollmentId: "enr-uuid-001",
          traiteeParId: "admin-uuid-001",
        }),
      }),
    );
  });

  it("retry sur collision P2002 et réussit au 2e essai", async () => {
    const erreurUnique = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    mockPrisma.reclamation.create
      .mockRejectedValueOnce(erreurUnique)
      .mockResolvedValue(makeReclamation({ numero: "AXI-REC-2026-002" }));

    const result = await creerReclamation({
      source: "stagiaire",
      reclamantNom: "Paul Blanc",
      objet: "Retard",
      description: "Formateur en retard.",
      dateReception: new Date("2026-06-05T14:00:00.000Z"),
    });

    expect(mockPrisma.reclamation.create).toHaveBeenCalledTimes(2);
    expect(result.numero).toBe("AXI-REC-2026-002");
  });

  it("lève en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(
        creerReclamation({
          source: "stagiaire",
          reclamantNom: "Test",
          objet: "Test",
          description: "Test",
          dateReception: new Date(),
        }),
      ).rejects.toThrow("stub.invalid");
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// repondreReclamation
// ─────────────────────────────────────────────────────────────────────────────

describe("repondreReclamation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.reclamation.update.mockResolvedValue(
      makeReclamation({ statut: "resolue", dateReponse: new Date(), reponse: "Problème résolu." }),
    );
  });

  it("met à jour la réclamation avec réponse et statut resolue", async () => {
    const result = await repondreReclamation("rec-uuid-001", { reponse: "Problème résolu." });

    expect(mockPrisma.reclamation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rec-uuid-001" },
        data: expect.objectContaining({
          reponse: "Problème résolu.",
          statut: "resolue",
          dateReponse: expect.any(Date),
        }),
      }),
    );
    expect(result.statut).toBe("resolue");
  });

  it("transmet actionsCorrectives si fourni", async () => {
    await repondreReclamation("rec-uuid-001", {
      reponse: "Corrigé.",
      actionsCorrectives: "Mise à jour de la procédure.",
    });

    expect(mockPrisma.reclamation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionsCorrectives: "Mise à jour de la procédure." }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setStatutReclamation
// ─────────────────────────────────────────────────────────────────────────────

describe("setStatutReclamation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.reclamation.update.mockResolvedValue(makeReclamation({ statut: "cloturee" }));
  });

  it("met à jour le statut", async () => {
    const result = await setStatutReclamation("rec-uuid-001", "cloturee");

    expect(mockPrisma.reclamation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rec-uuid-001" },
        data: { statut: "cloturee" },
      }),
    );
    expect(result.statut).toBe("cloturee");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listReclamations
// ─────────────────────────────────────────────────────────────────────────────

describe("listReclamations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.reclamation.findMany.mockResolvedValue([makeReclamation()]);
  });

  it("retourne toutes les réclamations sans filtre", async () => {
    const result = await listReclamations();
    expect(result).toHaveLength(1);
  });

  it("filtre par statut si fourni", async () => {
    await listReclamations({ statut: "nouvelle" });
    expect(mockPrisma.reclamation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ statut: "nouvelle" }),
      }),
    );
  });

  it("filtre par source si fourni", async () => {
    await listReclamations({ source: "client" });
    expect(mockPrisma.reclamation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ source: "client" }),
      }),
    );
  });

  it("retourne [] en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await listReclamations();
      expect(result).toEqual([]);
      expect(mockPrisma.reclamation.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reclamationsEnRetard
// ─────────────────────────────────────────────────────────────────────────────

describe("reclamationsEnRetard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockRejectedValue(new Error("clé absente"));
    mockPrisma.reclamation.findMany.mockResolvedValue([]);
  });

  it("appelle findMany avec filtre statut nouvelle/en_cours + dateReponse null", async () => {
    await reclamationsEnRetard();

    expect(mockPrisma.reclamation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          statut: { in: ["nouvelle", "en_cours"] },
          dateReponse: null,
          dateReception: expect.objectContaining({ lte: expect.any(Date) }),
        }),
      }),
    );
  });

  it("utilise le seuil défaut 15 jours si config absente", async () => {
    mockGetConfig.mockRejectedValue(new Error("clé absente"));

    const avantAppel = new Date();
    avantAppel.setDate(avantAppel.getDate() - 15);

    await reclamationsEnRetard();

    const call = mockPrisma.reclamation.findMany.mock.calls[0]![0];
    const lteDate: Date = call.where.dateReception.lte;

    // La date seuil doit être proche de J-15 (tolérance ±5 secondes)
    const diffMs = Math.abs(lteDate.getTime() - avantAppel.getTime());
    expect(diffMs).toBeLessThan(5000);
  });

  it("utilise le seuil numérique retourné par config si valide", async () => {
    mockGetConfig.mockResolvedValue(30);

    const avantAppel = new Date();
    avantAppel.setDate(avantAppel.getDate() - 30);

    await reclamationsEnRetard();

    const call = mockPrisma.reclamation.findMany.mock.calls[0]![0];
    const lteDate: Date = call.where.dateReception.lte;

    const diffMs = Math.abs(lteDate.getTime() - avantAppel.getTime());
    expect(diffMs).toBeLessThan(5000);
  });

  it("retourne [] en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await reclamationsEnRetard();
      expect(result).toEqual([]);
      expect(mockPrisma.reclamation.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

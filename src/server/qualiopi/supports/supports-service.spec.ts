/**
 * Tests — supports-service.ts (T13 AGENT B).
 *
 * Stratégie :
 *   - Mock @/lib/prisma (formation + supportFormation).
 *   - Mock support-builder (construireSupport, titreSupport) — fonctions pures
 *     couvertes par support-builder.spec.ts.
 *   - Mock render-support (renderSupportToStored) — évite pdf() en test.
 *   - Mock organisme (getOrganismeIdentite).
 *   - Enrichissement IA : court-circuité (pas d'ANTHROPIC_API_KEY en test).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — AVANT tout import du module testé
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: {
      findUnique: vi.fn(),
    },
    supportFormation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn().mockResolvedValue({
    raisonSociale: "Axion-IA SAS",
    nda: "12345678901",
    qualiopi: "Q-2026-001",
    siret: "12345678900019",
    adresseSiege: "1 rue de la Paix, 75001 Paris",
    adresseExercice: "1 rue de la Paix, 75001 Paris",
    email: "contact@axion-ia.fr",
    telephone: "01 23 45 67 89",
    site: "https://axion-ia.fr",
  }),
}));

vi.mock("./support-builder", () => ({
  construireSupport: vi.fn().mockReturnValue({
    sections: [{ titre: "Introduction", blocs: [{ type: "paragraphe", texte: "Test" }] }],
    meta: { type: "slides_formateur", formation: "Formation Test" },
  }),
  titreSupport: vi.fn().mockImplementation((type: string, titre: string) => `${type} — ${titre}`),
}));

vi.mock("./render-support", () => ({
  renderSupportToStored: vi.fn().mockResolvedValue({
    pdfKey: "supports/2026/slides_formateur/abc123.pdf",
    pdfUrl: "https://r2.example.com/supports/2026/slides_formateur/abc123.pdf",
    hashSha256: "abc123def456",
    sizeBytes: 12345,
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports après mocks
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { construireSupport, titreSupport } from "./support-builder";
import { renderSupportToStored } from "./render-support";
import { genererSupport, listSupports, supprimerSupport } from "./supports-service";

// ─────────────────────────────────────────────────────────────────────────────
// Types de mock
// ─────────────────────────────────────────────────────────────────────────────

const mockPrisma = prisma as unknown as {
  formation: { findUnique: ReturnType<typeof vi.fn> };
  supportFormation: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const mockConstruire = construireSupport as ReturnType<typeof vi.fn>;
const mockTitre = titreSupport as ReturnType<typeof vi.fn>;
const mockRender = renderSupportToStored as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const FORMATION_UUID = "550e8400-e29b-41d4-a716-446655440001";
const SUPPORT_UUID = "660e8400-e29b-41d4-a716-446655440002";

const FORMATION_FIXTURE = {
  id: FORMATION_UUID,
  titre: "IA générative en entreprise",
  dureeHeures: 7,
  objectifsPedagogiques: ["Comprendre l'IA", "Utiliser les outils IA"],
  programmeDetaille: [
    {
      moduleId: "m1",
      titre: "Introduction à l'IA",
      dureeMin: 120,
      sequences: [{ titre: "Bases", dureeMin: 60 }],
    },
  ],
  methodesPedagogiques: "Apprentissage actif, cas pratiques",
  moyensTechniques: "PC + accès internet",
  ressourcesPedagogiques: ["Support de cours PDF"],
};

// ─────────────────────────────────────────────────────────────────────────────
// genererSupport
// ─────────────────────────────────────────────────────────────────────────────

describe("genererSupport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.formation.findUnique.mockResolvedValue(FORMATION_FIXTURE);
    mockPrisma.supportFormation.findFirst.mockResolvedValue(null);
    mockPrisma.supportFormation.create.mockResolvedValue({
      id: SUPPORT_UUID,
      pdfUrl: "https://r2.example.com/supports/2026/slides_formateur/abc123.pdf",
    });
    mockPrisma.supportFormation.update.mockResolvedValue({
      id: SUPPORT_UUID,
      pdfUrl: "https://r2.example.com/supports/2026/slides_formateur/abc123.pdf",
    });
  });

  it("crée un support quand aucun n'existe (version 1)", async () => {
    const result = await genererSupport({
      formationId: FORMATION_UUID,
      type: "slides_formateur",
    });

    expect(result.id).toBe(SUPPORT_UUID);
    expect(result.pdfUrl).toBeTruthy();
    expect(mockPrisma.supportFormation.create).toHaveBeenCalledOnce();
    const createCall = mockPrisma.supportFormation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data["version"]).toBe(1);
    expect(createCall.data["statut"]).toBe("genere");
    expect(createCall.data["aiGenerated"]).toBe(false);
    expect(createCall.data["formationId"]).toBe(FORMATION_UUID);
    expect(createCall.data["type"]).toBe("slides_formateur");
  });

  it("met à jour un support existant avec version incrémentée", async () => {
    mockPrisma.supportFormation.findFirst.mockResolvedValue({
      id: SUPPORT_UUID,
      version: 2,
    });

    await genererSupport({ formationId: FORMATION_UUID, type: "slides_formateur" });

    expect(mockPrisma.supportFormation.update).toHaveBeenCalledOnce();
    expect(mockPrisma.supportFormation.create).not.toHaveBeenCalled();
    const updateCall = mockPrisma.supportFormation.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
      where: Record<string, unknown>;
    };
    expect(updateCall.data["version"]).toBe(3);
    expect(updateCall.where["id"]).toBe(SUPPORT_UUID);
  });

  it("appelle construireSupport avec le bon type et la bonne formation", async () => {
    await genererSupport({ formationId: FORMATION_UUID, type: "livret_stagiaire" });

    expect(mockConstruire).toHaveBeenCalledOnce();
    expect(mockConstruire.mock.calls[0]![0]).toBe("livret_stagiaire");
    expect(mockConstruire.mock.calls[0]![1]).toMatchObject({
      titre: "IA générative en entreprise",
      dureeHeures: 7,
    });
  });

  it("appelle titreSupport avec le bon type et titre", async () => {
    await genererSupport({ formationId: FORMATION_UUID, type: "memo" });

    expect(mockTitre).toHaveBeenCalledWith("memo", "IA générative en entreprise");
  });

  it("appelle renderSupportToStored avec version + identite", async () => {
    await genererSupport({ formationId: FORMATION_UUID, type: "grille_eval" });

    expect(mockRender).toHaveBeenCalledOnce();
    const renderCall = mockRender.mock.calls[0]![0] as Record<string, unknown>;
    expect(renderCall["version"]).toBe(1);
    expect(renderCall["type"]).toBe("grille_eval");
    expect((renderCall["identite"] as Record<string, unknown>)["raisonSociale"]).toBe(
      "Axion-IA SAS",
    );
  });

  it("positionne aiGenerated selon enrichirIA (false par défaut)", async () => {
    await genererSupport({ formationId: FORMATION_UUID, type: "exercices" });

    const createCall = mockPrisma.supportFormation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data["aiGenerated"]).toBe(false);
  });

  it("lève si formation introuvable", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(null);

    await expect(genererSupport({ formationId: "unknown-uuid", type: "memo" })).rejects.toThrow(
      "Formation introuvable",
    );
  });

  it("lève en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(
        genererSupport({ formationId: FORMATION_UUID, type: "exercices" }),
      ).rejects.toThrow();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  it("supporte les 7 types de supports", async () => {
    const types = [
      "slides_formateur",
      "slides_stagiaire",
      "livret_stagiaire",
      "memo",
      "guide_animation",
      "exercices",
      "grille_eval",
    ] as const;

    for (const type of types) {
      vi.clearAllMocks();
      mockPrisma.formation.findUnique.mockResolvedValue(FORMATION_FIXTURE);
      mockPrisma.supportFormation.findFirst.mockResolvedValue(null);
      mockPrisma.supportFormation.create.mockResolvedValue({
        id: SUPPORT_UUID,
        pdfUrl: null,
      });

      const result = await genererSupport({ formationId: FORMATION_UUID, type });
      expect(result.id).toBe(SUPPORT_UUID);
    }
  });

  it("fail-soft R2 : persiste quand pdfUrl est null", async () => {
    mockRender.mockResolvedValueOnce({
      pdfKey: null,
      pdfUrl: null,
      hashSha256: "abc",
      sizeBytes: 100,
    });
    mockPrisma.supportFormation.create.mockResolvedValue({
      id: SUPPORT_UUID,
      pdfUrl: null,
    });

    const result = await genererSupport({ formationId: FORMATION_UUID, type: "memo" });
    expect(result.id).toBe(SUPPORT_UUID);
    expect(result.pdfUrl).toBeNull();
    expect(mockPrisma.supportFormation.create).toHaveBeenCalledOnce();
  });

  it("fail-soft PDF : persiste même si renderSupportToStored lève", async () => {
    mockRender.mockRejectedValueOnce(new Error("R2 unavailable"));
    mockPrisma.supportFormation.create.mockResolvedValue({
      id: SUPPORT_UUID,
      pdfUrl: null,
    });

    const result = await genererSupport({ formationId: FORMATION_UUID, type: "memo" });
    expect(result.id).toBe(SUPPORT_UUID);
    expect(mockPrisma.supportFormation.create).toHaveBeenCalledOnce();
  });

  it("positionne generatedAt sur l'heure courante", async () => {
    const before = new Date();
    await genererSupport({ formationId: FORMATION_UUID, type: "memo" });
    const after = new Date();

    const createCall = mockPrisma.supportFormation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    const generatedAt = createCall.data["generatedAt"] as Date;
    expect(generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listSupports
// ─────────────────────────────────────────────────────────────────────────────

describe("listSupports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.supportFormation.findMany.mockResolvedValue([]);
  });

  it("appelle findMany avec le bon formationId", async () => {
    await listSupports(FORMATION_UUID);

    expect(mockPrisma.supportFormation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { formationId: FORMATION_UUID } }),
    );
  });

  it("retourne les supports trouvés", async () => {
    const fakeSupport = {
      id: SUPPORT_UUID,
      formationId: FORMATION_UUID,
      type: "memo",
      titre: "Mémo récapitulatif — IA générative",
      version: 1,
      statut: "genere",
    };
    mockPrisma.supportFormation.findMany.mockResolvedValue([fakeSupport]);

    const result = await listSupports(FORMATION_UUID);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: SUPPORT_UUID });
  });

  it("retourne [] en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await listSupports(FORMATION_UUID);
      expect(result).toEqual([]);
      expect(mockPrisma.supportFormation.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// supprimerSupport
// ─────────────────────────────────────────────────────────────────────────────

describe("supprimerSupport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.supportFormation.delete.mockResolvedValue({ id: SUPPORT_UUID });
  });

  it("appelle delete avec le bon id", async () => {
    await supprimerSupport(SUPPORT_UUID);

    expect(mockPrisma.supportFormation.delete).toHaveBeenCalledWith({
      where: { id: SUPPORT_UUID },
    });
  });

  it("lève en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(supprimerSupport(SUPPORT_UUID)).rejects.toThrow();
      expect(mockPrisma.supportFormation.delete).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

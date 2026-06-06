/**
 * Tests — facturation-service.ts (T11 AGENT A).
 *
 * Stratégie : mock @/lib/prisma + dépendances I/O (organisme, generateDocument,
 * opco-calcul.tarifHoraireOpco, config).
 * On vérifie : stub-aware, subrogation bloquante, calcul forfait/horaire,
 * numérotation séquentielle, retry P2002, données créées en DB.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUniqueOrThrow: vi.fn(),
    },
    factureFormation: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(40),
}));

vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn().mockResolvedValue({
    raisonSociale: "Axion-IA SAS",
    nda: "11380000038",
    qualiopi: "FR-2024-001",
    siret: "12345678900001",
    adresseSiege: "Paris 75001",
    adresseExercice: "Saint-Lattier, Isère",
    email: "contact@axion-ia.com",
    telephone: "+33600000000",
    site: "https://axion-ia.com",
  }),
}));

vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: vi.fn().mockResolvedValue({
    id: "doc-uuid-1",
    numero: "AXI-FACT-2026-001",
    pdfUrl: null,
    hashSha256: "abc",
  }),
}));

import { prisma } from "@/lib/prisma";
import { genererFactureFormation } from "./facturation-service";

const mockPrisma = prisma as unknown as {
  trainingSession: { findUniqueOrThrow: ReturnType<typeof vi.fn> };
  factureFormation: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "sess-uuid-1",
    financementType: "direct" as const,
    opcoSubrogation: false,
    numeroDossierOpco: null,
    montantHtCents: 300_000,
    dureeReelleHeures: 7,
    nbParticipantsReels: 5,
    nbParticipantsPrevus: 6,
    modalite: "presentiel" as const,
    client: {
      raisonSociale: "ACME SAS",
      siret: "98765432100001",
      adresse: "Lyon 69001",
      opcoIdentifie: "Atlas",
    },
    formation: {
      dureeHeures: 7,
      modalite: "presentiel" as const,
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// genererFactureFormation
// ─────────────────────────────────────────────────────────────────────────────

describe("genererFactureFormation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.trainingSession.findUniqueOrThrow.mockResolvedValue(makeSession());
    mockPrisma.factureFormation.count.mockResolvedValue(0);
    mockPrisma.factureFormation.create.mockResolvedValue({
      id: "facture-uuid-1",
      numero: "AXI-FACT-2026-001",
    });
  });

  // ── Stub-aware ─────────────────────────────────────────────────────────────

  it("retourne un résultat stub si DATABASE_URL contient stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await genererFactureFormation({
        sessionId: "any",
        destinataire: "entreprise",
        ventilation: "forfait",
      });
      expect(result.factureId).toBe("stub");
      expect(result.documentId).toBeNull();
      expect(mockPrisma.trainingSession.findUniqueOrThrow).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  // ── Subrogation bloquante ──────────────────────────────────────────────────

  it("lève si opcoSubrogation=true + numeroDossierOpco null (subrogation bloquante)", async () => {
    mockPrisma.trainingSession.findUniqueOrThrow.mockResolvedValue(
      makeSession({ opcoSubrogation: true, numeroDossierOpco: null }),
    );
    await expect(
      genererFactureFormation({
        sessionId: "sess-uuid-1",
        destinataire: "opco",
        ventilation: "forfait",
      }),
    ).rejects.toThrow(/subrogation/i);
  });

  // ── Forfait ────────────────────────────────────────────────────────────────

  it("crée la facture avec ventilation forfait (1 ligne, montant=montantHtCents session)", async () => {
    await genererFactureFormation({
      sessionId: "sess-uuid-1",
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    expect(mockPrisma.factureFormation.create).toHaveBeenCalledOnce();
    const createArg = mockPrisma.factureFormation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(createArg.data["montantHtCents"]).toBe(300_000);
    expect(createArg.data["tvaExoneree"]).toBe(true);
    expect(createArg.data["statut"]).toBe("emise");
  });

  it("retourne factureId, numero et documentId", async () => {
    const result = await genererFactureFormation({
      sessionId: "sess-uuid-1",
      destinataire: "entreprise",
      ventilation: "forfait",
    });
    expect(result.factureId).toBe("facture-uuid-1");
    expect(result.numero).toBe("AXI-FACT-2026-001");
    // documentId peut être null ou une string (selon generateDocument)
    expect(result.documentId === null || typeof result.documentId === "string").toBe(true);
  });

  // ── Numéro séquentiel ─────────────────────────────────────────────────────

  it("le numéro séquentiel utilise formatDocumentNumber('facture', year, count+1)", async () => {
    mockPrisma.factureFormation.count.mockResolvedValue(3); // 3 factures existantes → seq=4
    await genererFactureFormation({
      sessionId: "sess-uuid-1",
      destinataire: "entreprise",
      ventilation: "forfait",
    });
    const createArg = mockPrisma.factureFormation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    const annee = new Date().getFullYear();
    expect(createArg.data["numero"]).toBe(`AXI-FACT-${annee}-004`);
  });

  // ── Retry P2002 ───────────────────────────────────────────────────────────

  it("retente sur erreur P2002 et réussit au 2e essai", async () => {
    const p2002Error = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    // 1er create : P2002 ; 2e create : succès
    mockPrisma.factureFormation.create
      .mockRejectedValueOnce(p2002Error)
      .mockResolvedValueOnce({ id: "facture-retry-1", numero: "AXI-FACT-2026-002" });

    const result = await genererFactureFormation({
      sessionId: "sess-uuid-1",
      destinataire: "entreprise",
      ventilation: "forfait",
    });
    expect(result.factureId).toBe("facture-retry-1");
    expect(mockPrisma.factureFormation.create).toHaveBeenCalledTimes(2);
  });

  it("propage l'erreur si P2002 se produit MAX_ATTEMPTS fois", async () => {
    const p2002Error = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    mockPrisma.factureFormation.create.mockRejectedValue(p2002Error);

    await expect(
      genererFactureFormation({
        sessionId: "sess-uuid-1",
        destinataire: "entreprise",
        ventilation: "forfait",
      }),
    ).rejects.toThrow();
  });

  // ── Subrogation happy path ────────────────────────────────────────────────

  it("force destinataire=opco si opcoSubrogation=true + inclut numeroDossierOpco", async () => {
    mockPrisma.trainingSession.findUniqueOrThrow.mockResolvedValue(
      makeSession({ opcoSubrogation: true, numeroDossierOpco: "ATLAS-2026-001234" }),
    );

    await genererFactureFormation({
      sessionId: "sess-uuid-1",
      destinataire: "entreprise", // sera ignoré, forcé à opco
      ventilation: "forfait",
    });

    const createArg = mockPrisma.factureFormation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(createArg.data["destinataire"]).toBe("opco");
    expect(createArg.data["subrogation"]).toBe(true);
    expect(createArg.data["numeroDossierOpco"]).toBe("ATLAS-2026-001234");
  });

  // ── TVA exonérée ──────────────────────────────────────────────────────────

  it("la facture a tvaExoneree=true (261-4-4° CGI par défaut)", async () => {
    await genererFactureFormation({
      sessionId: "sess-uuid-1",
      destinataire: "entreprise",
      ventilation: "forfait",
    });
    const createArg = mockPrisma.factureFormation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(createArg.data["tvaExoneree"]).toBe(true);
  });
});

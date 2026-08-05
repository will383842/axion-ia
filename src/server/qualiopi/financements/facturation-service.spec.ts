/**
 * Tests — facturation-service.ts (T11 AGENT A, mis à jour T18).
 *
 * Stratégie : mock @/lib/prisma + dépendances I/O (organisme, generateDocument).
 * On vérifie : stub-aware, subrogation bloquante, calcul forfait/ventilation dossier,
 * numérotation séquentielle, retry P2002, données créées en DB.
 * Note T18 : plus de référence à opco-bareme / tarifHoraireForOpco.
 *   La ventilation horaire utilise computeVentilationDossier (barème sur le dossier).
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
      // Chemin d'allocation depuis V20 : borne haute lue par `nextNumero`.
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
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

// Mock config (sinon site-settings → _guards → next-auth est chargé). Régime
// par défaut = assujetti (20 %).
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(async (key: string) =>
    key === "regime_tva" ? "assujetti" : key === "taux_tva_standard_percent" ? 20 : "",
  ),
}));

import { prisma } from "@/lib/prisma";
import { genererFactureFormation } from "./facturation-service";

const mockPrisma = prisma as unknown as {
  trainingSession: { findUniqueOrThrow: ReturnType<typeof vi.fn> };
  factureFormation: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
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
    // Barème prise en charge (T18) : barème valide par défaut pour les tests horaire
    priseEnChargeMontantCents: 4000, // 40 €/h
    priseEnChargeUnite: "euro_heure" as const,
    priseEnChargePlafondFormationCents: null,
    priseEnChargePlafondAnnuelCents: null,
    client: {
      raisonSociale: "ACME SAS",
      siret: "98765432100001",
      adresse: "Lyon 69001",
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
    mockPrisma.factureFormation.findMany.mockResolvedValue([]);
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
    // Régime assujetti par défaut → TVA 20 % (Qualiopi n'exonère pas).
    expect(createArg.data["tvaExoneree"]).toBe(false);
    expect(createArg.data["regimeTva"]).toBe("assujetti");
    expect(createArg.data["montantTvaCents"]).toBe(60_000); // 20 % de 300 000
    expect(createArg.data["montantTtcCents"]).toBe(360_000);
    expect(createArg.data["statut"]).toBe("emise");
  });

  it("INVARIANT runtime : tvaExoneree ⇔ montantTvaCents === 0, dans les deux régimes", async () => {
    // Le test du schéma (tva-mention.spec) ne verrouille que le DÉFAUT de la
    // colonne ; ici on verrouille que la valeur ÉCRITE dérive du calcul —
    // jamais un drapeau statique qui pourrait diverger des montants (garde-fou
    // 0.4 du plan vente : TVA partout, sans exception).
    await genererFactureFormation({
      sessionId: "sess-uuid-1",
      destinataire: "entreprise",
      ventilation: "forfait",
    });
    const assujetti = (
      mockPrisma.factureFormation.create.mock.calls[0]![0] as { data: Record<string, unknown> }
    ).data;
    expect(assujetti["tvaExoneree"]).toBe(assujetti["montantTvaCents"] === 0);
    expect(assujetti["tvaExoneree"]).toBe(false);

    // Exonération = choix EXPLICITE par config (jamais un défaut) : TVA nulle
    // → et alors seulement, la facture est marquée exonérée.
    const { getQualiopiConfig } = await import("@/server/qualiopi/config/site-settings");
    vi.mocked(getQualiopiConfig).mockImplementation(async (key: string) =>
      key === "regime_tva" ? "exoneration_261" : key === "taux_tva_standard_percent" ? 20 : "",
    );
    await genererFactureFormation({
      sessionId: "sess-uuid-1",
      destinataire: "entreprise",
      ventilation: "forfait",
    });
    const exonere = (
      mockPrisma.factureFormation.create.mock.calls[1]![0] as { data: Record<string, unknown> }
    ).data;
    expect(exonere["montantTvaCents"]).toBe(0);
    expect(exonere["tvaExoneree"]).toBe(exonere["montantTvaCents"] === 0);
    expect(exonere["tvaExoneree"]).toBe(true);

    // clearAllMocks ne restaure PAS les implémentations : on remet le régime
    // assujetti pour ne pas contaminer les tests suivants.
    vi.mocked(getQualiopiConfig).mockImplementation(async (key: string) =>
      key === "regime_tva" ? "assujetti" : key === "taux_tva_standard_percent" ? 20 : "",
    );
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

  it("le numéro séquentiel est MAX(séquence) + 1, pas count + 1", async () => {
    const annee = new Date().getFullYear();
    mockPrisma.factureFormation.findMany.mockResolvedValue([
      { numero: `AXI-FACT-${annee}-001` },
      { numero: `AXI-FACT-${annee}-003` },
    ]);
    await genererFactureFormation({
      sessionId: "sess-uuid-1",
      destinataire: "entreprise",
      ventilation: "forfait",
    });
    const createArg = mockPrisma.factureFormation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    // 🔴 Le cœur de V20 : la série a un TROU en 002 (facture supprimée, création
    // annulée). `count + 1` aurait rendu 003 — un numéro DÉJÀ ÉMIS, interdit par
    // l'art. 242 nonies A ann. II du CGI. La borne haute rend 004.
    expect(createArg.data["numero"]).toBe(`AXI-FACT-${annee}-004`);
    // Et le PRÉDICAT de lecture, pas seulement la valeur : c'est son absence de
    // pin qui a laissé vivre le dénominateur `createdAt` de financements.ts.
    expect(mockPrisma.factureFormation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { numero: { startsWith: `AXI-FACT-${annee}-` } } }),
    );
  });

  it("les avoirs et les brouillons n'entrent pas dans la série des factures", async () => {
    const annee = new Date().getFullYear();
    // Ces lignes vivent dans la MÊME table `factures_formation`. Le filtre par
    // préfixe les écarte côté requête, `parseSequence` côté calcul.
    mockPrisma.factureFormation.findMany.mockResolvedValue([
      { numero: `AXI-AVO-${annee}-001` },
      { numero: "BROUILLON-9f3ac2b1e4d05a6c" },
    ]);
    await genererFactureFormation({
      sessionId: "sess-uuid-1",
      destinataire: "entreprise",
      ventilation: "forfait",
    });
    const createArg = mockPrisma.factureFormation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(createArg.data["numero"]).toBe(`AXI-FACT-${annee}-001`);
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

  it("[P1] destinataire opco : nom LISIBLE de l'OPCO (« Atlas », pas le slug « atlas »)", async () => {
    mockPrisma.trainingSession.findUniqueOrThrow.mockResolvedValue(
      makeSession({
        opcoSubrogation: true,
        numeroDossierOpco: "ATLAS-2026-001234",
        client: { raisonSociale: "ACME SAS", siret: "98765432100001", opcoIdentifie: "atlas" },
      }),
    );
    await genererFactureFormation({
      sessionId: "sess-uuid-1",
      destinataire: "entreprise",
      ventilation: "forfait",
    });
    const createArg = mockPrisma.factureFormation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(createArg.data["destinataireNom"]).toBe("Atlas");
  });

  it("[P1] destinataire france_travail : facturé à « France Travail » (pas l'entreprise cliente)", async () => {
    await genererFactureFormation({
      sessionId: "sess-uuid-1",
      destinataire: "france_travail",
      ventilation: "forfait",
    });
    const createArg = mockPrisma.factureFormation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(createArg.data["destinataireNom"]).toBe("France Travail");
    expect(createArg.data["destinataireNom"]).not.toBe("ACME SAS");
  });

  it("[P1] destinataire stagiaire : facturé au bénéficiaire (pas l'entreprise cliente)", async () => {
    await genererFactureFormation({
      sessionId: "sess-uuid-1",
      destinataire: "stagiaire",
      ventilation: "forfait",
    });
    const createArg = mockPrisma.factureFormation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(createArg.data["destinataireNom"]).not.toBe("ACME SAS");
    expect(String(createArg.data["destinataireNom"])).toMatch(/b[ée]n[ée]ficiaire/i);
  });

  // ── Régime de TVA (par défaut assujetti — Qualiopi n'exonère PAS) ──────────

  it("la facture est en régime assujetti par défaut (TVA 20 %, tvaExoneree=false)", async () => {
    await genererFactureFormation({
      sessionId: "sess-uuid-1",
      destinataire: "entreprise",
      ventilation: "forfait",
    });
    const createArg = mockPrisma.factureFormation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(createArg.data["regimeTva"]).toBe("assujetti");
    expect(createArg.data["tvaExoneree"]).toBe(false);
    expect(createArg.data["montantTvaCents"]).toBeGreaterThan(0);
  });

  // ── Ventilation dossier (T18) ─────────────────────────────────────────────

  it("ventilation horaire avec barème dossier euro_heure : crée la facture correctement", async () => {
    // makeSession a priseEnChargeMontantCents=4000 (40€/h), euro_heure, 7h, 5 participants
    await genererFactureFormation({
      sessionId: "sess-uuid-1",
      destinataire: "entreprise",
      ventilation: "horaire",
    });

    expect(mockPrisma.factureFormation.create).toHaveBeenCalledOnce();
    const createArg = mockPrisma.factureFormation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    // 7h × 4000 cts/h = 28000 par participant × 5 = 140 000
    expect(createArg.data["montantHtCents"]).toBe(140_000);
    expect(createArg.data["tvaExoneree"]).toBe(false); // régime assujetti par défaut
    expect(createArg.data["montantTvaCents"]).toBe(28_000); // 20 % de 140 000
    expect(createArg.data["statut"]).toBe("emise");
  });

  it("ventilation horaire : lève si priseEnChargeMontantCents=null (barème absent)", async () => {
    mockPrisma.trainingSession.findUniqueOrThrow.mockResolvedValue(
      makeSession({ priseEnChargeMontantCents: null, priseEnChargeUnite: null }),
    );

    await expect(
      genererFactureFormation({
        sessionId: "sess-uuid-1",
        destinataire: "entreprise",
        ventilation: "horaire",
      }),
    ).rejects.toThrow(/barème de prise en charge/i);
  });

  it("ventilation horaire : lève si priseEnChargeUnite=null même si montant renseigné", async () => {
    mockPrisma.trainingSession.findUniqueOrThrow.mockResolvedValue(
      makeSession({ priseEnChargeMontantCents: 3000, priseEnChargeUnite: null }),
    );

    await expect(
      genererFactureFormation({
        sessionId: "sess-uuid-1",
        destinataire: "entreprise",
        ventilation: "horaire",
      }),
    ).rejects.toThrow(/barème de prise en charge/i);
  });
});

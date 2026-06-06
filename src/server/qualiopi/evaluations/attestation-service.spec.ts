/**
 * Tests — attestation-service.ts (T9).
 *
 * Stratégie : mock @/lib/prisma, generateDocument, getOrganismeIdentite,
 * makeQrToken, qrDataUrl, getQualiopiConfig, classifierPresence,
 * getFinaleReussite.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    trainer: {
      findUnique: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(80),
}));

vi.mock("@/server/qualiopi/presence/taux", () => ({
  classifierPresence: vi.fn().mockReturnValue("complete"),
}));

vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: vi.fn().mockResolvedValue({
    id: "doc-uuid-1",
    numero: "AXI-ATT-2026-001",
    pdfUrl: "https://r2.example.com/test.pdf",
    hashSha256: "a".repeat(64),
  }),
}));

vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn().mockResolvedValue({
    raisonSociale: "Axion-IA SAS",
    nda: "12345678901",
    qualiopi: "QUALIxxx",
    siret: "12345678900010",
    adresseSiege: "Paris",
    adresseExercice: "Saint-Lattier",
    email: "contact@axion-ia.com",
    telephone: "0600000000",
    site: "https://axion-ia.com",
  }),
}));

vi.mock("@/server/qualiopi/documents/qr", () => ({
  makeQrToken: vi.fn().mockReturnValue("qr-token-test-abc"),
  qrDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,fake"),
}));

vi.mock("./evaluations-service", () => ({
  getFinaleReussite: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/server/qualiopi/notifications/notifications-service", () => ({
  envoyerAttestationDisponible: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { classifierPresence } from "@/server/qualiopi/presence/taux";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getFinaleReussite } from "./evaluations-service";
import { envoyerAttestationDisponible } from "@/server/qualiopi/notifications/notifications-service";
import { genererAttestationPourEnrollment } from "./attestation-service";

const mockPrisma = prisma as unknown as {
  enrollment: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  trainer: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  activityLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

const mockClassifier = classifierPresence as ReturnType<typeof vi.fn>;
const mockGenDoc = generateDocument as ReturnType<typeof vi.fn>;
const mockGetConfig = getQualiopiConfig as ReturnType<typeof vi.fn>;
const mockGetFinale = getFinaleReussite as ReturnType<typeof vi.fn>;
const mockEnvoyerAttestation = envoyerAttestationDisponible as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// Fixture enrollment de base
// ─────────────────────────────────────────────────────────────────────────────

function makeEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: "enroll-1",
    statut: "presente",
    tauxPresencePct: 90,
    attestationResultat: null,
    attestationDocumentId: null,
    attestationGenereeAt: null,
    trainee: {
      id: "trainee-1",
      nom: "Dupont",
      prenom: "Marie",
      entreprise: "ACME Corp",
      fonction: "Directrice",
    },
    session: {
      id: "session-1",
      dateDebut: new Date("2026-06-01"),
      dateFin: new Date("2026-06-05"),
      modalite: "presentiel",
      coFormateurs: [],
      formation: {
        titre: "IA pour les managers",
        objectifsPedagogiques: ["Comprendre les bases de l'IA", "Identifier les cas d'usage"],
        dureeHeures: 14,
      },
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests principaux
// ─────────────────────────────────────────────────────────────────────────────

describe("genererAttestationPourEnrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue(80);
    mockClassifier.mockReturnValue("complete");
    mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment());
    mockPrisma.enrollment.update.mockResolvedValue({});
    mockPrisma.activityLog.create.mockResolvedValue({});
    mockGenDoc.mockResolvedValue({
      id: "doc-uuid-1",
      numero: "AXI-ATT-2026-001",
      pdfUrl: "https://r2.example.com/test.pdf",
      hashSha256: "a".repeat(64),
    });
    mockGetFinale.mockResolvedValue(null);
    mockEnvoyerAttestation.mockResolvedValue(undefined);
  });

  // ── Stub-aware ──────────────────────────────────────────────────────────��───

  it("retourne { resultat: 'aucune', documentId: null } en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await genererAttestationPourEnrollment("any-id");
      expect(result).toEqual({ resultat: "aucune", documentId: null });
      expect(mockPrisma.enrollment.findUnique).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  // ── Idempotence ─────────────────────────────────────────────────────────────

  it("retourne l'existant si attestationGenereeAt est déjà set (sans force)", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(
      makeEnrollment({
        attestationGenereeAt: new Date("2026-06-10"),
        attestationResultat: "complete",
        attestationDocumentId: "existing-doc-id",
      }),
    );

    const result = await genererAttestationPourEnrollment("enroll-1");

    expect(result).toEqual({ resultat: "complete", documentId: "existing-doc-id" });
    expect(mockGenDoc).not.toHaveBeenCalled();
    expect(mockPrisma.enrollment.update).not.toHaveBeenCalled();
  });

  it("re-génère si force=true même si attestationGenereeAt est set", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(
      makeEnrollment({
        attestationGenereeAt: new Date("2026-06-10"),
        attestationResultat: "complete",
        attestationDocumentId: "old-doc-id",
      }),
    );

    const result = await genererAttestationPourEnrollment("enroll-1", { force: true });

    expect(mockGenDoc).toHaveBeenCalledOnce();
    expect(result.documentId).toBe("doc-uuid-1");
  });

  // ── Résultat aucune ─────────────────────────────────────────────────────────

  it("retourne { resultat: 'aucune', documentId: null } si classifierPresence='aucune'", async () => {
    mockClassifier.mockReturnValue("aucune");

    const result = await genererAttestationPourEnrollment("enroll-1");

    expect(result).toEqual({ resultat: "aucune", documentId: null });
    expect(mockGenDoc).not.toHaveBeenCalled();
  });

  it("met à jour attestationResultat=aucune sans documentId si aucune présence", async () => {
    mockClassifier.mockReturnValue("aucune");

    await genererAttestationPourEnrollment("enroll-1");

    expect(mockPrisma.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "enroll-1" },
        data: expect.objectContaining({ attestationResultat: "aucune" }),
      }),
    );
    const updateCall = mockPrisma.enrollment.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect("attestationDocumentId" in updateCall.data).toBe(false);
  });

  // ── Attestation complète ────────────────────────────────────────────────────

  it("génère une attestation complète (type='attestation')", async () => {
    mockClassifier.mockReturnValue("complete");

    const result = await genererAttestationPourEnrollment("enroll-1");

    expect(result).toEqual({ resultat: "complete", documentId: "doc-uuid-1" });
    expect(mockGenDoc).toHaveBeenCalledWith(expect.objectContaining({ type: "attestation" }));
  });

  // ── Attestation partielle ───────────────────────────────────────────────────

  it("génère une attestation partielle (type='attestation_partielle')", async () => {
    mockClassifier.mockReturnValue("partielle");

    const result = await genererAttestationPourEnrollment("enroll-1");

    expect(result).toEqual({ resultat: "partielle", documentId: "doc-uuid-1" });
    expect(mockGenDoc).toHaveBeenCalledWith(
      expect.objectContaining({ type: "attestation_partielle" }),
    );
  });

  // ── QR token ────────────────────────────────────────────────────────────────

  it("passe le qrToken à generateDocument", async () => {
    await genererAttestationPourEnrollment("enroll-1");

    expect(mockGenDoc).toHaveBeenCalledWith(
      expect.objectContaining({ qrToken: "qr-token-test-abc" }),
    );
  });

  it("passe les refs sessionId et traineeId à generateDocument", async () => {
    await genererAttestationPourEnrollment("enroll-1");

    expect(mockGenDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        refs: expect.objectContaining({
          sessionId: "session-1",
          traineeId: "trainee-1",
        }),
      }),
    );
  });

  // ── Mise à jour enrollment ──────────────────────────────────────────────────

  it("met à jour enrollment avec attestationResultat, documentId et genereeAt", async () => {
    await genererAttestationPourEnrollment("enroll-1");

    expect(mockPrisma.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "enroll-1" },
        data: expect.objectContaining({
          attestationResultat: "complete",
          attestationDocumentId: "doc-uuid-1",
        }),
      }),
    );
    const data = (
      mockPrisma.enrollment.update.mock.calls[0]![0] as { data: Record<string, unknown> }
    ).data;
    expect(data["attestationGenereeAt"]).toBeInstanceOf(Date);
  });

  // ── Évaluation finale ───────────────────────────────────────────────────────

  it("inclut evaluationObtenue='Évaluation finale : Réussite' si finale réussie", async () => {
    mockGetFinale.mockResolvedValue(true);

    await genererAttestationPourEnrollment("enroll-1");

    const docCall = mockGenDoc.mock.calls[0]![0] as {
      element: { props: { data: Record<string, unknown> } };
    };
    const resultats = docCall.element.props.data["resultats"] as Record<string, unknown>;
    expect(resultats["evaluationObtenue"]).toBe("Évaluation finale : Réussite");
  });

  it("n'inclut pas evaluationObtenue si pas d'évaluation finale (null)", async () => {
    mockGetFinale.mockResolvedValue(null);

    await genererAttestationPourEnrollment("enroll-1");

    const docCall = mockGenDoc.mock.calls[0]![0] as {
      element: { props: { data: Record<string, unknown> } };
    };
    const resultats = docCall.element.props.data["resultats"] as Record<string, unknown>;
    expect("evaluationObtenue" in resultats).toBe(false);
  });

  // ── Seuil config ────────────────────────────────────────────────────────────

  it("utilise seuil_presence_pct de getQualiopiConfig pour classifierPresence", async () => {
    mockGetConfig.mockResolvedValue(75);

    await genererAttestationPourEnrollment("enroll-1");

    expect(mockClassifier).toHaveBeenCalledWith(90, 75);
  });

  // ── Enrollment introuvable ──────────────────────────────────────────────────

  it("lève si enrollment introuvable", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);

    await expect(genererAttestationPourEnrollment("unknown-id")).rejects.toThrow(
      "Enrollment introuvable",
    );
  });

  // ── Notification attestation disponible ────────────────────────────────────

  it("appelle envoyerAttestationDisponible après génération complète", async () => {
    mockClassifier.mockReturnValue("complete");

    await genererAttestationPourEnrollment("enroll-1");

    expect(mockEnvoyerAttestation).toHaveBeenCalledOnce();
    expect(mockEnvoyerAttestation).toHaveBeenCalledWith("enroll-1");
  });

  it("appelle envoyerAttestationDisponible après génération partielle", async () => {
    mockClassifier.mockReturnValue("partielle");

    await genererAttestationPourEnrollment("enroll-1");

    expect(mockEnvoyerAttestation).toHaveBeenCalledOnce();
    expect(mockEnvoyerAttestation).toHaveBeenCalledWith("enroll-1");
  });

  it("ne appelle PAS envoyerAttestationDisponible si résultat=aucune", async () => {
    mockClassifier.mockReturnValue("aucune");

    await genererAttestationPourEnrollment("enroll-1");

    expect(mockEnvoyerAttestation).not.toHaveBeenCalled();
  });

  it("continue malgré erreur de envoyerAttestationDisponible (fail-soft)", async () => {
    mockClassifier.mockReturnValue("complete");
    mockEnvoyerAttestation.mockRejectedValue(new Error("SMTP down"));

    // Ne doit pas lever, et retourne le documentId
    const result = await genererAttestationPourEnrollment("enroll-1");

    expect(result).toEqual({ resultat: "complete", documentId: "doc-uuid-1" });
  });

  // ── S2 : invariant statut exclu / abandon ──────────────────────────────────

  it("S2 : retourne { resultat: 'aucune', documentId: null } si statut=exclu", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ statut: "exclu" }));

    const result = await genererAttestationPourEnrollment("enroll-exclu");

    expect(result).toEqual({ resultat: "aucune", documentId: null });
    expect(mockGenDoc).not.toHaveBeenCalled();
    expect(mockPrisma.enrollment.update).not.toHaveBeenCalled();
  });

  it("S2 : retourne { resultat: 'aucune', documentId: null } si statut=abandon", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ statut: "abandon" }));

    const result = await genererAttestationPourEnrollment("enroll-abandon");

    expect(result).toEqual({ resultat: "aucune", documentId: null });
    expect(mockGenDoc).not.toHaveBeenCalled();
  });

  it("S2 : log l'activité qualiopi.attestation.refusee_statut si statut=exclu", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ statut: "exclu" }));

    await genererAttestationPourEnrollment("enroll-exclu-log");

    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "qualiopi.attestation.refusee_statut",
          targetType: "Enrollment",
          targetId: "enroll-exclu-log",
        }),
      }),
    );
  });

  it("S2 : log l'activité qualiopi.attestation.refusee_statut si statut=abandon", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ statut: "abandon" }));

    await genererAttestationPourEnrollment("enroll-abandon-log");

    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "qualiopi.attestation.refusee_statut",
        }),
      }),
    );
  });

  it("S2 : ignore l'erreur de log (best-effort) si activityLog.create lève", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ statut: "exclu" }));
    mockPrisma.activityLog.create.mockRejectedValue(new Error("DB error"));

    // Ne doit pas lever
    const result = await genererAttestationPourEnrollment("enroll-exclu-nolog");

    expect(result).toEqual({ resultat: "aucune", documentId: null });
  });

  it("S2 : génère normalement si statut=presente (non bloqué)", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ statut: "presente" }));

    const result = await genererAttestationPourEnrollment("enroll-presente");

    expect(result).toEqual({ resultat: "complete", documentId: "doc-uuid-1" });
    expect(mockGenDoc).toHaveBeenCalledOnce();
  });
});

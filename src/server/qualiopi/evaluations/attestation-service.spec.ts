/**
 * Tests — attestation-service.ts (T9).
 *
 * Stratégie : mock @/lib/prisma, generateDocument, getOrganismeIdentite,
 * makeQrToken, qrDataUrl, getQualiopiConfig, classifierPresence,
 * getFinaleResultats.
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
    // Régénération FORCÉE = rectification : on lit le numéro de l'attestation
    // remplacée pour que la nouvelle pièce déclare ce qu'elle rectifie.
    documentGenere: {
      findUnique: vi.fn(),
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
  getFinaleResultats: vi.fn().mockResolvedValue(null),
  // Implémentation RÉELLE, pas un stub : c'est elle qui décide si une
  // évaluation vide doit être présentée comme « non réalisée » plutôt que comme
  // un échec. Un `vi.fn()` renvoyant `undefined` ferait passer les tests F21/F22
  // tout en désactivant silencieusement le comportement qu'ils vérifient.
  evaluationSansAucuneNote: (r: { acquis: unknown[]; partiels: unknown[]; nonAcquis: unknown[] }) =>
    r.acquis.length === 0 && r.partiels.length === 0 && r.nonAcquis.length === 0,
}));

vi.mock("@/server/qualiopi/notifications/notifications-service", () => ({
  envoyerAttestationDisponible: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { classifierPresence } from "@/server/qualiopi/presence/taux";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getFinaleResultats } from "./evaluations-service";
import { envoyerAttestationDisponible } from "@/server/qualiopi/notifications/notifications-service";
import { genererAttestationPourEnrollment } from "./attestation-service";

const mockPrisma = prisma as unknown as {
  enrollment: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  documentGenere: { findUnique: ReturnType<typeof vi.fn> };
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
const mockGetFinale = getFinaleResultats as ReturnType<typeof vi.fn>;

/** Résultats d'évaluation finale, forme complète attendue par le service (F21). */
function resultatsFinale(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    reussite: true,
    scorePct: 100,
    niveauGlobal: "acquis",
    acquis: [],
    partiels: [],
    nonAcquis: [],
    nonEvalues: [],
    ...over,
  };
}
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

  // 🔴 Le motif de rectification est SAISI, jamais inventé. [2026-08-04]
  //
  // La formule générique « après mise à jour de l'évaluation des acquis »
  // s'imprimait quelle que soit la vraie raison. L'auditeur lit ce texte au
  // registre : il doit dire ce qui s'est passé, pas ce que le logiciel suppose.
  it("le motif SAISI remplace la formule générique", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(
      makeEnrollment({
        attestationGenereeAt: new Date("2026-06-10"),
        attestationResultat: "complete",
        attestationDocumentId: "old-doc-id",
      }),
    );
    mockPrisma.documentGenere.findUnique.mockResolvedValue({ numero: "AXI-ATT-2026-004" });

    await genererAttestationPourEnrollment("enroll-1", {
      force: true,
      rectificationMotif: "Nom du bénéficiaire corrigé après vérification de sa pièce d'identité.",
    });

    const passe = mockGenDoc.mock.calls[0]![0] as {
      rectifie?: { numero: string; motif: string };
    };
    expect(passe.rectifie).toEqual({
      numero: "AXI-ATT-2026-004",
      motif: "Nom du bénéficiaire corrigé après vérification de sa pièce d'identité.",
    });
  });

  it("sans motif saisi, la formule d'origine est conservée", async () => {
    // Le pendant du précédent : sans lui, le test ci-dessus passerait même si le
    // motif ecrasait tout, y compris quand aucun n'est fourni.
    mockPrisma.enrollment.findUnique.mockResolvedValue(
      makeEnrollment({
        attestationGenereeAt: new Date("2026-06-10"),
        attestationResultat: "complete",
        attestationDocumentId: "old-doc-id",
      }),
    );
    mockPrisma.documentGenere.findUnique.mockResolvedValue({ numero: "AXI-ATT-2026-004" });

    await genererAttestationPourEnrollment("enroll-1", { force: true });

    const passe = mockGenDoc.mock.calls[0]![0] as { rectifie?: { motif: string } };
    expect(passe.rectifie?.motif).toContain("mise à jour de l'évaluation des acquis");
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

  // ── buildElement — numéro injecté dans le PDF ──────────────────────────────

  it("passe buildElement (pas element) à generateDocument", async () => {
    await genererAttestationPourEnrollment("enroll-1");

    const docCall = mockGenDoc.mock.calls[0]![0] as Record<string, unknown>;
    expect(typeof docCall["buildElement"]).toBe("function");
    expect("element" in docCall).toBe(false);
  });

  it("buildElement injecte le numéro alloué dans les props du template", async () => {
    await genererAttestationPourEnrollment("enroll-1");

    const docCall = mockGenDoc.mock.calls[0]![0] as {
      buildElement: (numero: string) => { props: { data: Record<string, unknown> } };
    };
    const rendered = docCall.buildElement("AXI-ATT-2026-042");
    expect(rendered.props.data["numero"]).toBe("AXI-ATT-2026-042");
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

  /** Rend le PDF et retourne le bloc « resultats » de ses props. */
  async function resultatsRendus(): Promise<Record<string, unknown>> {
    await genererAttestationPourEnrollment("enroll-1");
    const docCall = mockGenDoc.mock.calls[0]![0] as {
      buildElement: (numero: string) => { props: { data: Record<string, unknown> } };
    };
    const rendered = docCall.buildElement("AXI-ATT-2026-001");
    return rendered.props.data["resultats"] as Record<string, unknown>;
  }

  it("inclut le verdict ET le score si une évaluation finale existe", async () => {
    // La compétence notée n'est pas décorative : un score de 87 % sans aucune
    // compétence notée est arithmétiquement impossible, et c'est désormais le
    // signe d'une saisie vide (cf. le test « aucune compétence notée » plus bas).
    mockGetFinale.mockResolvedValue(
      resultatsFinale({ scorePct: 87, acquis: ["Rédiger un prompt"] }),
    );

    expect((await resultatsRendus())["evaluationObtenue"]).toBe("Réussite — score 87 %");
  });

  it("n'inclut pas evaluationObtenue si pas d'évaluation finale (null)", async () => {
    mockGetFinale.mockResolvedValue(null);

    expect("evaluationObtenue" in (await resultatsRendus())).toBe(false);
  });

  // 🔴 Vérification E2E 2026-07-26. Une évaluation EXISTANTE mais dont aucune
  // compétence n'est notée sortait « Non validée — score 0 % » : un oubli de
  // saisie devenait un échec écrit sur l'attestation du stagiaire. F22 avait
  // fermé ce défaut au niveau du CALCUL, pas au niveau du document.
  it("une évaluation sans aucune compétence notée n'est pas un échec", async () => {
    mockGetFinale.mockResolvedValue(
      resultatsFinale({ reussite: false, scorePct: 0, niveauGlobal: "non_acquis" }),
    );

    const r = await resultatsRendus();
    expect("evaluationObtenue" in r).toBe(false);
    expect(r["competencesAcquises"]).toBe("Évaluation des acquis non réalisée");
  });

  // ── F21 — l'attestation restitue les RÉSULTATS, jamais le programme ──────────
  //
  // Le service recopiait la liste complète des objectifs du catalogue sous
  // « Compétences acquises », sans jamais lire l'évaluation : un stagiaire noté
  // « non acquis » sur trois objectifs sur cinq était attesté sur les cinq.
  // L6353-1 exige les résultats de l'évaluation des acquis (ind. 11, NON
  // graduable). Ces tests verrouillent la correction.

  it("F21 : n'imprime QUE les objectifs réellement notés « acquis »", async () => {
    mockGetFinale.mockResolvedValue(
      resultatsFinale({ acquis: ["Rédiger un prompt"], nonAcquis: ["Évaluer un biais"] }),
    );

    const resultats = await resultatsRendus();
    expect(resultats["competencesAcquises"]).toBe("Rédiger un prompt");
    // L'objectif non acquis ne doit apparaître QUE dans les réserves.
    expect(resultats["competencesAcquises"]).not.toContain("Évaluer un biais");
    expect(resultats["competencesReserves"]).toContain("Non acquis : Évaluer un biais");
  });

  it("F21 : le dit explicitement quand aucun objectif n'est acquis", async () => {
    mockGetFinale.mockResolvedValue(resultatsFinale({ nonAcquis: ["Évaluer un biais"] }));

    expect((await resultatsRendus())["competencesAcquises"]).toBe(
      "Aucun objectif évalué comme acquis",
    );
  });

  it("F21 : sans évaluation, n'affirme AUCUNE acquisition", async () => {
    mockGetFinale.mockResolvedValue(null);

    const resultats = await resultatsRendus();
    expect(resultats["competencesAcquises"]).toBe("Évaluation des acquis non réalisée");
    // Une attestation muette sur ce point se lirait comme une acquisition.
    expect(resultats["competencesReserves"]).toBeUndefined();
  });

  it("F22 : une compétence non notée est signalée, pas comptée comme échouée", async () => {
    mockGetFinale.mockResolvedValue(
      resultatsFinale({ acquis: ["Rédiger un prompt"], nonEvalues: ["Citer ses sources"] }),
    );

    expect((await resultatsRendus())["competencesReserves"]).toBe(
      "Non évalués : Citer ses sources",
    );
  });

  it("F21 : pas de rubrique « Réserves » quand tout est acquis", async () => {
    mockGetFinale.mockResolvedValue(resultatsFinale({ acquis: ["Rédiger un prompt"] }));

    expect((await resultatsRendus())["competencesReserves"]).toBeUndefined();
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

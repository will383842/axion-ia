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
      // Claim atomique d'idempotence (2026-08-15) : la garde n'est plus une
      // lecture, c'est un `updateMany` conditionné sur `attestationGenereeAt`.
      updateMany: vi.fn(),
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
    // 🔴 2026-09-05 — les PREUVES. L'attestation, due au stagiaire, était moins
    // gardée que le certificat, dû au financeur : elle exige désormais les mêmes
    // faits (taux mesuré, trace d'assiduité, évaluation finale).
    emargementSignature: {
      count: vi.fn(),
    },
    presenceCreneau: {
      count: vi.fn(),
    },
    evaluationAcquis: {
      count: vi.fn(),
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
import {
  genererAttestationPourEnrollment,
  preuvesManquantesAttestation,
} from "./attestation-service";

const mockPrisma = prisma as unknown as {
  enrollment: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  documentGenere: { findUnique: ReturnType<typeof vi.fn> };
  trainer: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  activityLog: {
    create: ReturnType<typeof vi.fn>;
  };
  emargementSignature: { count: ReturnType<typeof vi.fn> };
  presenceCreneau: { count: ReturnType<typeof vi.fn> };
  evaluationAcquis: { count: ReturnType<typeof vi.fn> };
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
    // Défaut : le claim RÉUSSIT (count = 1). Les tests qui veulent simuler une
    // course le surchargent explicitement.
    mockPrisma.enrollment.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.activityLog.create.mockResolvedValue({});
    mockGenDoc.mockResolvedValue({
      id: "doc-uuid-1",
      numero: "AXI-ATT-2026-001",
      pdfUrl: "https://r2.example.com/test.pdf",
      hashSha256: "a".repeat(64),
    });
    mockGetFinale.mockResolvedValue(null);
    mockEnvoyerAttestation.mockResolvedValue(undefined);
    // Défaut du dossier SAIN : une signature d'émargement au registre et une
    // évaluation finale. Les tests de la garde des preuves les retirent
    // explicitement — sans ce défaut, tous les autres tests mesureraient le
    // refus au lieu de ce qu'ils prétendent mesurer.
    mockPrisma.emargementSignature.count.mockResolvedValue(1);
    mockPrisma.presenceCreneau.count.mockResolvedValue(0);
    mockPrisma.evaluationAcquis.count.mockResolvedValue(1);
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

  // ── PREUVES — l'asymétrie fermée le 2026-09-05 ────────────────────────────

  describe("preuves : la pièce du stagiaire est gardée comme celle du financeur", () => {
    it("TÉMOIN POSITIF — dossier complet : l'attestation sort, aucun refus", async () => {
      // Sans ce cas, les refus ci-dessous ne distingueraient pas « la garde
      // fonctionne » de « plus rien ne sort jamais ».
      const result = await genererAttestationPourEnrollment("enroll-sain");

      expect(result).toEqual({ resultat: "complete", documentId: "doc-uuid-1" });
      expect(mockGenDoc).toHaveBeenCalledOnce();
    });

    it("refuse quand le taux de présence n'a pas été calculé", async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ tauxPresencePct: null }));

      await expect(genererAttestationPourEnrollment("enroll-sans-taux")).rejects.toThrow(
        /taux de présence n'a pas été calculé/,
      );
      expect(mockGenDoc).not.toHaveBeenCalled();
    });

    it("refuse quand aucune trace d'assiduité n'existe", async () => {
      mockPrisma.emargementSignature.count.mockResolvedValue(0);
      mockPrisma.presenceCreneau.count.mockResolvedValue(0);

      await expect(genererAttestationPourEnrollment("enroll-sans-trace")).rejects.toThrow(
        /aucune trace d'assiduité vérifiable/,
      );
      expect(mockGenDoc).not.toHaveBeenCalled();
    });

    it("un relevé de connexion importé VAUT trace (session distancielle)", async () => {
      // Le certificat de réalisation a payé ce cas le 2026-08-20 : il était
      // structurellement impossible en 100 % distanciel. L'attestation ne
      // refait pas la faute.
      mockPrisma.emargementSignature.count.mockResolvedValue(0);
      mockPrisma.presenceCreneau.count.mockResolvedValue(3);

      const result = await genererAttestationPourEnrollment("enroll-distanciel");

      expect(result).toEqual({ resultat: "complete", documentId: "doc-uuid-1" });
    });

    it("refuse quand aucune évaluation finale n'existe — le clic admin ne contourne plus le cron", async () => {
      mockPrisma.evaluationAcquis.count.mockResolvedValue(0);

      await expect(genererAttestationPourEnrollment("enroll-sans-eval")).rejects.toThrow(
        /aucune évaluation finale des acquis/,
      );
      expect(mockGenDoc).not.toHaveBeenCalled();
    });

    it("le refus NE consomme PAS le claim : le cron pourra reprendre le dossier", async () => {
      // Un refus levé après le claim laisserait `attestationGenereeAt` posé sans
      // pièce, et le cron (qui filtre sur `null`) ne reviendrait jamais.
      mockPrisma.evaluationAcquis.count.mockResolvedValue(0);

      await expect(genererAttestationPourEnrollment("enroll-sans-eval")).rejects.toThrow();

      expect(mockPrisma.enrollment.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.enrollment.update).not.toHaveBeenCalled();
    });

    it("le refus nomme TOUT ce qui manque, pas seulement le premier manque", async () => {
      // ⚠️ Le taux est MESURÉ ici, délibérément : sans lui, le refus DUR
      // (`AttestationTauxNonMesureError`) partirait d'abord et ce témoin
      // mesurerait le mauvais refus. C'est ce qui l'a fait rougir au moment où
      // le taux a quitté la soupape.
      mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ tauxPresencePct: 100 }));
      mockPrisma.emargementSignature.count.mockResolvedValue(0);
      mockPrisma.presenceCreneau.count.mockResolvedValue(0);
      mockPrisma.evaluationAcquis.count.mockResolvedValue(0);

      await expect(genererAttestationPourEnrollment("enroll-vide")).rejects.toThrow(
        /trace d'assiduité[\s\S]*évaluation finale/,
      );
    });

    it("🔴 un taux NON MESURÉ lève un refus DUR qu'aucun motif ne lève", async () => {
      // Le défaut que ce témoin ferme : avec la soupape, on passait la garde,
      // on posait le claim atomique, puis `tauxPresencePct ?? 0` classait à
      // « aucune » — la pièce ne sortait PAS et `attestationGenereeAt` restait
      // posé, gelant le dossier pour toujours (le cron filtre sur `null`).
      // La soupape était donc inerte dans son cas principal, et fabriquait le
      // gel qu'elle devait éviter. Un taux INCONNU n'est pas un taux de 0 %.
      mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ tauxPresencePct: null }));
      mockPrisma.emargementSignature.count.mockResolvedValue(3);
      mockPrisma.presenceCreneau.count.mockResolvedValue(0);
      mockPrisma.evaluationAcquis.count.mockResolvedValue(1);

      await expect(
        genererAttestationPourEnrollment("enroll-sans-taux", {
          motifPreuvesManquantes:
            "Le client affirme que la formation a bien eu lieu, je passe outre.",
        }),
      ).rejects.toThrow(/taux de présence n'a pas été calculé/);

      // ⚠️ La partie qui compte VRAIMENT : rien n'a été écrit. Un refus levé
      // après le claim aurait marqué l'inscription « attestée » sans pièce.
      expect(mockPrisma.enrollment.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.enrollment.update).not.toHaveBeenCalled();
    });

    it("un MOTIF ÉCRIT ouvre la sortie — la pièce est due au stagiaire (L.6353-1)", async () => {
      mockPrisma.evaluationAcquis.count.mockResolvedValue(0);

      const result = await genererAttestationPourEnrollment("enroll-motive", {
        motifPreuvesManquantes:
          "Émargement papier de 2024 archivé hors logiciel, retrouvé au dossier client.",
      });

      expect(result).toEqual({ resultat: "complete", documentId: "doc-uuid-1" });
    });

    it("le motif part au REGISTRE avec la liste des manques", async () => {
      mockPrisma.evaluationAcquis.count.mockResolvedValue(0);

      await genererAttestationPourEnrollment("enroll-motive", {
        motifPreuvesManquantes:
          "Émargement papier de 2024 archivé hors logiciel, retrouvé au dossier client.",
      });

      const appel = mockPrisma.activityLog.create.mock.calls.find(
        (c: unknown[]) =>
          (c[0] as { data: { action: string } }).data.action ===
          "qualiopi.attestation.preuves_manquantes_assumees",
      );
      expect(appel, "aucune entrée au registre : l'auditeur ne verrait rien").toBeDefined();
      const data = (appel?.[0] as { data: { changes: { manquantes: string[]; motif: string } } })
        .data;
      expect(data.changes.motif).toContain("Émargement papier");
      expect(data.changes.manquantes).toHaveLength(1);
    });

    it("🔴 taux INCONNU : la soupape ne doit PAS geler la ligne sans rien produire", async () => {
      // Défaut signalé par le lead le 2026-09-05, et il avait raison.
      //
      // La soupape laissait passer un taux non mesuré. Trois pas plus loin,
      // `?? 0` transformait cet INCONNU en présence de 0 %, `classifierPresence`
      // rendait « aucune », et la branche « aucune » écrivait
      // `attestationGenereeAt` en sortant SANS produire de pièce. Le cron filtre
      // sur `attestationGenereeAt: null` : la ligne était gelée pour toujours.
      //
      // La soupape existe pour DÉLIVRER une pièce due au stagiaire ; dans son cas
      // principal elle fabriquait exactement le gel qu'elle devait éviter.
      //
      // 🔑 `classifierPresence` est ici l'implémentation RÉELLE, importée du
      // producteur. Avec le mock par défaut (« complete » quoi qu'il arrive), ce
      // test serait vert sur le code fautif : il mesurerait le mock, pas la règle.
      const { classifierPresence: reel } = await vi.importActual<
        typeof import("@/server/qualiopi/presence/taux")
      >("@/server/qualiopi/presence/taux");
      mockClassifier.mockImplementation(reel);
      mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ tauxPresencePct: null }));

      await expect(
        genererAttestationPourEnrollment("enroll-taux-inconnu", {
          motifPreuvesManquantes: "Feuille d'émargement papier retrouvée au dossier client.",
        }),
      ).rejects.toThrow(/taux de présence/);

      expect(mockGenDoc, "aucune pièce n'est produite").not.toHaveBeenCalled();
      expect(
        mockPrisma.enrollment.updateMany,
        "le claim est posé : la ligne est gelée et le cron ne la reprendra jamais",
      ).not.toHaveBeenCalled();
      expect(
        mockPrisma.enrollment.update,
        "`attestationGenereeAt` est écrit sans pièce : c'est le gel",
      ).not.toHaveBeenCalled();
    });

    it("un motif TROP COURT ne vaut pas motif", async () => {
      mockPrisma.evaluationAcquis.count.mockResolvedValue(0);

      await expect(
        genererAttestationPourEnrollment("enroll-motif-court", {
          motifPreuvesManquantes: "  ok  ",
        }),
      ).rejects.toThrow(/Attestation refusée/);
      expect(mockGenDoc).not.toHaveBeenCalled();
    });

    it("la garde vaut AUSSI en régénération forcée — une révocation n'appelle pas un nouveau tirage", async () => {
      mockPrisma.emargementSignature.count.mockResolvedValue(0);
      mockPrisma.presenceCreneau.count.mockResolvedValue(0);

      await expect(
        genererAttestationPourEnrollment("enroll-force", { force: true }),
      ).rejects.toThrow(/aucune trace d'assiduité vérifiable/);
      expect(mockGenDoc).not.toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La règle elle-même, sans base
// ─────────────────────────────────────────────────────────────────────────────

describe("preuvesManquantesAttestation", () => {
  const complet = {
    tauxPresenceMesure: true,
    signaturesNonRevoquees: 1,
    creneauxImportes: 0,
    evaluationsFinales: 1,
  };

  it("TÉMOIN POSITIF — ne signale rien sur un dossier complet", () => {
    expect(preuvesManquantesAttestation(complet)).toEqual([]);
  });

  it("une signature révoquée ne compte pas : c'est la colonne qui est comptée, pas la ligne", () => {
    // `signaturesNonRevoquees` porte déjà le filtre `revokedAt: null` côté
    // requête. Ce que ce test verrouille, c'est qu'un ZÉRO ici suffit à refuser
    // — sans quoi révoquer toutes les signatures n'empêcherait rien.
    expect(preuvesManquantesAttestation({ ...complet, signaturesNonRevoquees: 0 })).toHaveLength(1);
  });

  it("le relevé importé remplace la signature, jamais l'évaluation", () => {
    expect(
      preuvesManquantesAttestation({
        ...complet,
        signaturesNonRevoquees: 0,
        creneauxImportes: 2,
      }),
    ).toEqual([]);
    expect(
      preuvesManquantesAttestation({
        ...complet,
        signaturesNonRevoquees: 0,
        creneauxImportes: 2,
        evaluationsFinales: 0,
      }),
    ).toHaveLength(1);
  });

  it("ne compte QUE les manques rattrapables — le taux n'en est pas", () => {
    // 🔴 Ce témoin exigeait 3 manques, taux compris. Le taux a QUITTÉ la
    // soupape le 2026-09-05 : on peut assumer par écrit l'absence d'une trace
    // ou d'une évaluation, on ne peut pas attester une assiduité dont on n'a
    // AUCUNE mesure. Il lève un refus DUR, il ne se liste pas ici.
    expect(
      preuvesManquantesAttestation({
        tauxPresenceMesure: false,
        signaturesNonRevoquees: 0,
        creneauxImportes: 0,
        evaluationsFinales: 0,
      }),
    ).toHaveLength(2);
  });

  it("le taux ne change RIEN à cette liste — mesuré ou non, mêmes manques", () => {
    // Contre-témoin : si le taux revenait subrepticement dans la liste, ce
    // témoin le verrait. Sans lui, le précédent passerait aussi avec un taux
    // qui compte pour un manque et une trace qui n'en compte plus.
    const sansTaux = preuvesManquantesAttestation({
      tauxPresenceMesure: false,
      signaturesNonRevoquees: 0,
      creneauxImportes: 0,
      evaluationsFinales: 0,
    });
    const avecTaux = preuvesManquantesAttestation({
      tauxPresenceMesure: true,
      signaturesNonRevoquees: 0,
      creneauxImportes: 0,
      evaluationsFinales: 0,
    });
    expect(sansTaux).toEqual(avecTaux);
  });
});

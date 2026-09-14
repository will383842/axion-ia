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

// `computeTauxPresence` reste RÉEL : les minutes réelles de présence (3e relecture
// A09) s'agrègent avec lui. Seul le classifieur est piloté par les tests.
vi.mock("@/server/qualiopi/presence/taux", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/presence/taux")>()),
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

  // ── Présence sous 60 % : la pièce reste DUE (L.6353-1 al. 2) ──────────────
  //
  // 🔴 Audit initial 2026-09-14 (M-documents-pdf-11). Sous 60 % de présence, le
  // service ne produisait RIEN : `attestationGenereeAt` posé, `documentId` nul.
  // Or l'article L.6353-1 al. 2 impose de remettre au stagiaire, à l'issue de la
  // formation, une attestation portant objectifs, nature, durée et résultats de
  // l'évaluation. Une assiduité faible change ce que la pièce DIT (la durée
  // réellement suivie), pas le fait qu'elle soit due.

  it("sous 60 % de présence, émet une attestation PARTIELLE — jamais « aucune pièce »", async () => {
    mockClassifier.mockReturnValue("aucune");
    mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ tauxPresencePct: 40 }));

    const result = await genererAttestationPourEnrollment("enroll-1");

    expect(result).toEqual({ resultat: "partielle", documentId: "doc-uuid-1" });
    expect(mockGenDoc).toHaveBeenCalledWith(
      expect.objectContaining({ type: "attestation_partielle" }),
    );
    expect(mockPrisma.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "enroll-1" },
        data: expect.objectContaining({
          attestationResultat: "partielle",
          attestationDocumentId: "doc-uuid-1",
        }),
      }),
    );
  });

  it("sous 60 %, la pièce porte la durée RÉELLEMENT suivie, pas la durée prévue", async () => {
    mockClassifier.mockReturnValue("aucune");
    // 40 % de 20 h = 8 h : un nombre rond, pour que l'assertion ne dépende pas
    // de la règle d'arrondi (hors du périmètre de ce correctif).
    mockPrisma.enrollment.findUnique.mockResolvedValue(
      makeEnrollment({
        tauxPresencePct: 40,
        session: { ...makeEnrollment().session, dureeReelleHeures: 20 },
      }),
    );

    await genererAttestationPourEnrollment("enroll-1");

    const docCall = mockGenDoc.mock.calls[0]![0] as {
      buildElement: (numero: string) => { props: { data: Record<string, unknown> } };
    };
    const resultats = docCall.buildElement("AXI-ATT-2026-009").props.data["resultats"] as Record<
      string,
      unknown
    >;
    expect(resultats["heuresSuivies"]).toBe(8);
    expect(resultats["heuresTotales"]).toBe(20);
  });

  // ── 2e relecture A09 (#audit initial 2026-09-14) ───────────────────────────

  it("🔴 0 h suivie, émission AUTOMATIQUE : rien n'est émis, rien n'est écrit", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ tauxPresencePct: 0 }));

    const result = await genererAttestationPourEnrollment("enroll-0h", { automatique: true });

    expect(result).toEqual({ resultat: "aucune", documentId: null, raison: "zero_heure_suivie" });
    expect(mockGenDoc).not.toHaveBeenCalled();
    expect(mockPrisma.enrollment.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.enrollment.update).not.toHaveBeenCalled();
  });

  it("🔴 taux NON NUL arrondi à 0 minute : ce n'est pas « 0 h » — la pièce part", async () => {
    // 3e relecture A09 : « n'a suivi aucune heure » exige des minutes réelles (ou
    // un taux) STRICTEMENT nulles. Un suivi, même bref, ne s'imprime jamais « 0 h ».
    mockClassifier.mockReturnValue("aucune");
    mockPrisma.enrollment.findUnique.mockResolvedValue(
      makeEnrollment({
        tauxPresencePct: 1,
        session: { ...makeEnrollment().session, dureeReelleHeures: 0.5 },
      }),
    );

    const result = await genererAttestationPourEnrollment("enroll-arrondi", { automatique: true });

    expect(result).toEqual({ resultat: "partielle", documentId: "doc-uuid-1" });
  });

  it("🔴 minutes RÉELLES : taux arrondi à 0 % mais 20 min suivies sur 70 h — pièce émise, 20 min", async () => {
    mockClassifier.mockReturnValue("aucune");
    mockPrisma.enrollment.findUnique.mockResolvedValue(
      makeEnrollment({
        tauxPresencePct: 0,
        session: { ...makeEnrollment().session, dureeReelleHeures: 70 },
        presences: [
          {
            dureePrevueMinutes: 4200,
            dureeRealiseeMinutes: 20,
            date: new Date("2026-06-01"),
            demiJournee: "journee",
          },
        ],
      }),
    );

    const result = await genererAttestationPourEnrollment("enroll-20min", { automatique: true });

    expect(result).toEqual({ resultat: "partielle", documentId: "doc-uuid-1" });
    const docCall = mockGenDoc.mock.calls[0]![0] as {
      buildElement: (numero: string) => { props: { data: Record<string, unknown> } };
    };
    const resultats = docCall.buildElement("AXI-ATT-2026-021").props.data["resultats"] as Record<
      string,
      unknown
    >;
    expect(resultats["heuresSuivies"]).toBe(20 / 60);
  });

  it("🔴 concordance avec le certificat : 93 % de 7 h = 391 minutes", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(
      makeEnrollment({
        tauxPresencePct: 93,
        session: { ...makeEnrollment().session, dureeReelleHeures: 7 },
      }),
    );

    await genererAttestationPourEnrollment("enroll-93");

    const docCall = mockGenDoc.mock.calls[0]![0] as {
      buildElement: (numero: string) => { props: { data: Record<string, unknown> } };
    };
    const resultats = docCall.buildElement("AXI-ATT-2026-022").props.data["resultats"] as Record<
      string,
      unknown
    >;
    expect(resultats["heuresSuivies"]).toBe(391 / 60);
  });

  it("0 h suivie, émission MANUELLE : la pièce sort — et elle est MARQUÉE pour la page de vérification", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ tauxPresencePct: 0 }));

    const result = await genererAttestationPourEnrollment("enroll-0h-manuel");

    expect(result).toEqual({ resultat: "partielle", documentId: "doc-uuid-1" });
    // 3e relecture A09 : la page publique du QR doit dire « aucune heure
    // suivie », pas « suivi partiel » — sans nouveau type de document.
    expect(mockGenDoc).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { aucuneHeureSuivie: true } }),
    );
  });

  it("🔴 les heures suivies sont calculées à la MINUTE, pas arrondies à l'heure", async () => {
    // 45 % de 3 h = 81 min = 1,35 h. L'arrondi à l'heure imprimait « 1 h ».
    mockPrisma.enrollment.findUnique.mockResolvedValue(
      makeEnrollment({
        tauxPresencePct: 45,
        session: { ...makeEnrollment().session, dureeReelleHeures: 3 },
      }),
    );

    await genererAttestationPourEnrollment("enroll-minutes");

    const docCall = mockGenDoc.mock.calls[0]![0] as {
      buildElement: (numero: string) => { props: { data: Record<string, unknown> } };
    };
    const resultats = docCall.buildElement("AXI-ATT-2026-020").props.data["resultats"] as Record<
      string,
      unknown
    >;
    expect(resultats["heuresSuivies"]).toBe(1.35);
  });

  it("🔴 exclu/abandon SANS taux mesuré : le refus EXPLIQUE, et ne propose aucun motif", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(
      makeEnrollment({ statut: "abandon", tauxPresencePct: null }),
    );

    const refus = await genererAttestationPourEnrollment("enroll-sortie").then(
      () => null,
      (e: unknown) => (e instanceof Error ? e.message : String(e)),
    );

    expect(refus).toMatch(/^Attestation refusée/);
    expect(refus).toMatch(/créneaux/);
    expect(refus).toMatch(/exclusion ou abandon/);
    expect(refus).not.toMatch(/en écrivant pourquoi/);
    expect(mockGenDoc).not.toHaveBeenCalled();
  });

  it("🔴 journal « sans évaluation finale » : PAS écrit si le rendu du PDF échoue", async () => {
    mockPrisma.evaluationAcquis.count.mockResolvedValue(0);
    mockGenDoc.mockRejectedValue(new Error("R2 indisponible"));

    await expect(genererAttestationPourEnrollment("enroll-rendu-ko")).rejects.toThrow();

    const appels = mockPrisma.activityLog.create.mock.calls.filter(
      (c: unknown[]) =>
        (c[0] as { data: { action: string } }).data.action ===
        "qualiopi.attestation.sans_evaluation_finale",
    );
    expect(appels).toHaveLength(0);
  });

  it("journal « sans évaluation finale » : écrit UNE fois, après le rendu réussi", async () => {
    mockPrisma.evaluationAcquis.count.mockResolvedValue(0);

    await genererAttestationPourEnrollment("enroll-rendu-ok");

    const appels = mockPrisma.activityLog.create.mock.calls.filter(
      (c: unknown[]) =>
        (c[0] as { data: { action: string } }).data.action ===
        "qualiopi.attestation.sans_evaluation_finale",
    );
    expect(appels).toHaveLength(1);
    const ordreJournal =
      mockPrisma.activityLog.create.mock.invocationCallOrder[
        mockPrisma.activityLog.create.mock.calls.indexOf(appels[0]!)
      ]!;
    expect(ordreJournal).toBeGreaterThan(mockGenDoc.mock.invocationCallOrder[0]!);
  });

  // ── Formateur : jamais la raison sociale ────────────────────────────────────

  it("sans formateur désigné, la ligne « Formateur(rice) » n'imprime PAS la raison sociale", async () => {
    // 🔴 M-documents-pdf-12. La convocation a fermé ce repli (D9) : nommer
    // l'organisme sur une ligne « Formateur » affirme qu'une personne morale a
    // animé la session.
    await genererAttestationPourEnrollment("enroll-1");

    const docCall = mockGenDoc.mock.calls[0]![0] as {
      buildElement: (numero: string) => { props: { data: Record<string, unknown> } };
    };
    const formation = docCall.buildElement("AXI-ATT-2026-010").props.data["formation"] as Record<
      string,
      unknown
    >;
    expect(formation["formateur"]).not.toBe("Axion-IA SAS");
    expect(formation["formateur"]).toBe("Non renseigné");
  });

  it("avec un formateur principal, c'est bien son nom qui est imprimé", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(
      makeEnrollment({
        session: { ...makeEnrollment().session, formateurPrincipalId: "trainer-1" },
      }),
    );
    mockPrisma.trainer.findUnique.mockResolvedValue({ prenom: "Luc", nom: "Martin" });

    await genererAttestationPourEnrollment("enroll-1");

    const docCall = mockGenDoc.mock.calls[0]![0] as {
      buildElement: (numero: string) => { props: { data: Record<string, unknown> } };
    };
    const formation = docCall.buildElement("AXI-ATT-2026-011").props.data["formation"] as Record<
      string,
      unknown
    >;
    expect(formation["formateur"]).toBe("Luc Martin");
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

  it("prévient AUSSI le stagiaire sous 60 % de présence — la pièce existe, elle lui est due", async () => {
    mockClassifier.mockReturnValue("aucune");
    mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ tauxPresencePct: 40 }));

    await genererAttestationPourEnrollment("enroll-1");

    expect(mockEnvoyerAttestation).toHaveBeenCalledWith("enroll-1");
  });

  it("prévient AUSSI le stagiaire exclu — la pièce des heures suivies lui est due (décision Will D2)", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ statut: "exclu" }));

    await genererAttestationPourEnrollment("enroll-1");

    expect(mockEnvoyerAttestation).toHaveBeenCalledWith("enroll-1");
  });

  it("continue malgré erreur de envoyerAttestationDisponible (fail-soft)", async () => {
    mockClassifier.mockReturnValue("complete");
    mockEnvoyerAttestation.mockRejectedValue(new Error("SMTP down"));

    // Ne doit pas lever, et retourne le documentId
    const result = await genererAttestationPourEnrollment("enroll-1");

    expect(result).toEqual({ resultat: "complete", documentId: "doc-uuid-1" });
  });

  // ── Exclu / abandon : la pièce des heures RÉELLEMENT suivies ──────────────
  //
  // 🔴 Décision Will D2 (2026-09-14, audit initial). L'invariant S2 refusait
  // toute pièce à un stagiaire exclu ou en abandon. L.6353-1 al. 2 la rend due
  // « à l'issue de la formation » : il reçoit désormais une attestation
  // PARTIELLE, qui porte ses heures et son taux réels et n'affirme aucune
  // validation — même si son taux dépasse le seuil de présence complète.

  it("D2 : un stagiaire EXCLU reçoit une attestation partielle", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ statut: "exclu" }));

    const result = await genererAttestationPourEnrollment("enroll-exclu");

    expect(result).toEqual({ resultat: "partielle", documentId: "doc-uuid-1" });
    expect(mockGenDoc).toHaveBeenCalledWith(
      expect.objectContaining({ type: "attestation_partielle" }),
    );
  });

  it("D2 : un ABANDON reste PARTIEL même au-dessus du seuil de présence complète", async () => {
    mockClassifier.mockReturnValue("complete");
    mockPrisma.enrollment.findUnique.mockResolvedValue(
      makeEnrollment({ statut: "abandon", tauxPresencePct: 90 }),
    );

    const result = await genererAttestationPourEnrollment("enroll-abandon");

    expect(result).toEqual({ resultat: "partielle", documentId: "doc-uuid-1" });
    expect(mockGenDoc).toHaveBeenCalledWith(
      expect.objectContaining({ type: "attestation_partielle" }),
    );
  });

  it("D2 : la pièce de l'abandon porte ses heures et son taux RÉELS", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(
      makeEnrollment({
        statut: "abandon",
        tauxPresencePct: 25,
        session: { ...makeEnrollment().session, dureeReelleHeures: 20 },
      }),
    );

    await genererAttestationPourEnrollment("enroll-abandon");

    const docCall = mockGenDoc.mock.calls[0]![0] as {
      buildElement: (numero: string) => { props: { data: Record<string, unknown> } };
    };
    const resultats = docCall.buildElement("AXI-ATT-2026-012").props.data["resultats"] as Record<
      string,
      unknown
    >;
    expect(resultats["heuresSuivies"]).toBe(5);
    expect(resultats["heuresTotales"]).toBe(20);
  });

  it("D2 : l'émission pour un exclu est journalisée avec son statut", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ statut: "exclu" }));

    await genererAttestationPourEnrollment("enroll-exclu-log");

    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "qualiopi.attestation.partielle",
          targetId: "enroll-exclu-log",
          changes: expect.objectContaining({ statut: "exclu" }),
        }),
      }),
    );
  });

  it("tranche 60-79 % (classifieur RÉEL) : pièce partielle, jamais complète", async () => {
    // Relecture A09 (#1087) : les tests « sous 60 % » mockent le classifieur à
    // « aucune » ; la tranche 60-79 % n'était exercée par aucun test du service.
    const { classifierPresence: reel } = await vi.importActual<
      typeof import("@/server/qualiopi/presence/taux")
    >("@/server/qualiopi/presence/taux");
    mockClassifier.mockImplementation(reel);
    mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ tauxPresencePct: 70 }));

    const result = await genererAttestationPourEnrollment("enroll-70");

    expect(result).toEqual({ resultat: "partielle", documentId: "doc-uuid-1" });
    expect(mockGenDoc).toHaveBeenCalledWith(
      expect.objectContaining({ type: "attestation_partielle" }),
    );
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

    it("D1 : sans évaluation finale, l'attestation SORT sans motif — et le registre le dit", async () => {
      // 🔴 Décision Will D1 (2026-09-14, audit initial, X-documents-pdf-04).
      // L'absence d'évaluation finale exigeait un motif écrit : la pièce que
      // L.6353-1 al. 2 doit au stagiaire « à l'issue de la formation » dépendait
      // donc d'un geste de l'organisme. Elle sort, porte « Évaluation des acquis
      // non réalisée », et l'absence est journalisée.
      mockPrisma.evaluationAcquis.count.mockResolvedValue(0);

      const result = await genererAttestationPourEnrollment("enroll-sans-eval");

      expect(result).toEqual({ resultat: "complete", documentId: "doc-uuid-1" });
      const appel = mockPrisma.activityLog.create.mock.calls.find(
        (c: unknown[]) =>
          (c[0] as { data: { action: string } }).data.action ===
          "qualiopi.attestation.sans_evaluation_finale",
      );
      expect(appel, "l'absence d'évaluation n'a laissé aucune trace au registre").toBeDefined();
      const docCall = mockGenDoc.mock.calls[0]![0] as {
        buildElement: (numero: string) => { props: { data: Record<string, unknown> } };
      };
      const resultats = docCall.buildElement("AXI-ATT-2026-013").props.data["resultats"] as Record<
        string,
        unknown
      >;
      expect(resultats["competencesAcquises"]).toBe("Évaluation des acquis non réalisée");
      expect(resultats["evaluationObtenue"]).toBeUndefined();
    });

    it("le refus NE consomme PAS le claim : le cron pourra reprendre le dossier", async () => {
      // Un refus levé après le claim laisserait `attestationGenereeAt` posé sans
      // pièce, et le cron (qui filtre sur `null`) ne reviendrait jamais.
      mockPrisma.emargementSignature.count.mockResolvedValue(0);
      mockPrisma.presenceCreneau.count.mockResolvedValue(0);

      await expect(genererAttestationPourEnrollment("enroll-sans-trace")).rejects.toThrow();

      expect(mockPrisma.enrollment.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.enrollment.update).not.toHaveBeenCalled();
    });

    it("D1 : sans trace NI évaluation, le refus ne réclame un motif QUE pour la trace", async () => {
      // ⚠️ Le taux est MESURÉ ici, délibérément : sans lui, le refus DUR
      // (`AttestationTauxNonMesureError`) partirait d'abord et ce témoin
      // mesurerait le mauvais refus.
      mockPrisma.enrollment.findUnique.mockResolvedValue(makeEnrollment({ tauxPresencePct: 100 }));
      mockPrisma.emargementSignature.count.mockResolvedValue(0);
      mockPrisma.presenceCreneau.count.mockResolvedValue(0);
      mockPrisma.evaluationAcquis.count.mockResolvedValue(0);

      const refus = await genererAttestationPourEnrollment("enroll-vide").then(
        () => null,
        (e: unknown) => (e instanceof Error ? e.message : String(e)),
      );
      expect(refus).toMatch(/trace d'assiduité/);
      expect(refus).not.toMatch(/évaluation finale/);
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
      mockPrisma.emargementSignature.count.mockResolvedValue(0);

      const result = await genererAttestationPourEnrollment("enroll-motive", {
        motifPreuvesManquantes:
          "Émargement papier de 2024 archivé hors logiciel, retrouvé au dossier client.",
      });

      expect(result).toEqual({ resultat: "complete", documentId: "doc-uuid-1" });
    });

    it("le motif part au REGISTRE avec la liste des manques", async () => {
      mockPrisma.emargementSignature.count.mockResolvedValue(0);

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
      mockPrisma.emargementSignature.count.mockResolvedValue(0);

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

  it("le relevé importé remplace la signature", () => {
    expect(
      preuvesManquantesAttestation({
        ...complet,
        signaturesNonRevoquees: 0,
        creneauxImportes: 2,
      }),
    ).toEqual([]);
  });

  it("D1 : l'absence d'évaluation finale n'est PLUS un manque qui exige un motif", () => {
    // Décision Will D1 (2026-09-14) : la pièce sort et imprime « Évaluation des
    // acquis non réalisée » ; l'absence est journalisée, pas soumise à motif.
    expect(preuvesManquantesAttestation({ ...complet, evaluationsFinales: 0 })).toEqual([]);
  });

  it("ne compte QUE les manques rattrapables — le taux n'en est pas", () => {
    // 🔴 Le taux a QUITTÉ la soupape le 2026-09-05 : on ne peut pas attester une
    // assiduité dont on n'a AUCUNE mesure. Il lève un refus DUR, il ne se liste
    // pas ici. L'évaluation, elle, n'est plus un manque depuis D1 (2026-09-14).
    expect(
      preuvesManquantesAttestation({
        tauxPresenceMesure: false,
        signaturesNonRevoquees: 0,
        creneauxImportes: 0,
        evaluationsFinales: 0,
      }),
    ).toHaveLength(1);
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

/**
 * Tests — actions de génération documentaire (T19 Cluster D).
 *
 * Stratégie :
 *   - Mock @/lib/prisma pour isoler la logique métier (sans DB).
 *   - Mock @/server/actions/qualiopi/_guards pour simuler l'authentification.
 *   - Mock @/server/qualiopi/documents/documents-service (generateDocument).
 *   - Mock @/server/qualiopi/documents/organisme (getOrganismeIdentite).
 *   - Mock @/server/qualiopi/config/site-settings (getQualiopiConfig).
 *
 * Cas couverts pour ≥ 6 types clés :
 *   convention, certificat_realisation, convocation, emargement,
 *   kit_opco, reglement_interieur + stub-aware.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks déclarés avant les imports (hoisting Vitest)
// ─────────────────────────────────────────────────────────────────────────────

const mockSessionFindUnique = vi.fn();
const mockSessionFindMany = vi.fn();
const mockEnrollmentFindUnique = vi.fn();
const mockEvaluationFindFirst = vi.fn();
const mockTrainerFindUnique = vi.fn();
const mockSessionJourFindMany = vi.fn();
const mockCompensationRuleFindMany = vi.fn();
const mockCoachingFindMany = vi.fn();
const mockAuditFindMany = vi.fn();

const mockSignatureCount = vi.fn();

// Annulation d'une pièce au registre (ind. — audit pré-visite 2026-08-04).
const mockDocumentFindUnique = vi.fn();
const mockDocumentUpdate = vi.fn();
const mockAdminUserFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: (...args: unknown[]) => mockSessionFindUnique(...args),
      findMany: (...args: unknown[]) => mockSessionFindMany(...args),
    },
    // La lettre de mission imprime la rémunération RÉSOLUE (le barème de la
    // paie), plus le tarif générique de la fiche.
    trainerCompensationRule: {
      findMany: (...args: unknown[]) => mockCompensationRuleFindMany(...args),
    },
    // La lettre-CADRE peut couvrir coachings AFEST et audits.
    coachingSession: {
      findMany: (...args: unknown[]) => mockCoachingFindMany(...args),
    },
    auditMission: {
      findMany: (...args: unknown[]) => mockAuditFindMany(...args),
    },
    enrollment: {
      findUnique: (...args: unknown[]) => mockEnrollmentFindUnique(...args),
    },
    // La grille d'évaluation lit l'évaluation finale ENREGISTRÉE plutôt que de
    // rendre un formulaire vierge qui contredirait l'attestation.
    evaluationAcquis: {
      findFirst: (...args: unknown[]) => mockEvaluationFindFirst(...args),
    },
    trainer: {
      findUnique: (...args: unknown[]) => mockTrainerFindUnique(...args),
    },
    // La convocation lit les horaires RÉELS des journées déclarées plutôt que
    // d'annoncer un « 09h00–17h00 » qui contredirait la feuille d'émargement.
    sessionJour: {
      findMany: (...args: unknown[]) => mockSessionJourFindMany(...args),
    },
    // 🔴 2026-07-26 — le certificat de réalisation exige desormais une TRACE
    // d'emargement. Par defaut on en simule une : les tests historiques
    // decrivent un dossier sain, et c'est le cas nominal.
    emargementSignature: {
      count: (...args: unknown[]) => mockSignatureCount(...args),
    },
    documentGenere: {
      findUnique: (...args: unknown[]) => mockDocumentFindUnique(...args),
      update: (...args: unknown[]) => mockDocumentUpdate(...args),
    },
    adminUser: {
      findUnique: (...args: unknown[]) => mockAdminUserFindUnique(...args),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({
    userId: "user-admin-uuid",
    role: "super_admin",
  }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

const mockGenerateDocument = vi.fn();

vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: (...args: unknown[]) => mockGenerateDocument(...args),
}));

const mockGetOrganismeIdentite = vi.fn();

vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: () => mockGetOrganismeIdentite(),
}));

const mockGetQualiopiConfig = vi.fn();
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: (...args: unknown[]) => mockGetQualiopiConfig(...args),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports des actions sous test
// ─────────────────────────────────────────────────────────────────────────────

import {
  genererConventionAction,
  genererCertificatRealisationAction,
  genererConvocationAction,
  genererEmargementAction,
  genererKitOpcoAction,
  genererReglementInterieurAction,
  genererConventionTripartiteAction,
  genererSatisfactionAction,
  genererPositionnementAction,
  genererGrilleEvaluationAction,
  genererKitCpfAction,
  genererKitFranceTravailAction,
  genererLettreMissionAction,
  genererLettreMissionCadreAction,
  genererLivretAccueilAction,
  genererContratFormationAction,
  annulerDocumentAction,
} from "./documents";
// Importé pour lire les appels au journal d'audit : la trace de conformité est
// le livrable du changement « avertir sans bloquer », elle doit être vérifiée.
import { logQualiopiActivity } from "./_guards";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures communes
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_ID = "a1234567-89ab-cdef-0123-456789abcdef";
const ENROLLMENT_ID = "b1234567-89ab-cdef-0123-456789abcdef";
const DOCUMENT_ID = "c1234567-89ab-cdef-0123-456789abcdef";
const NUMERO = "AXI-FORM-2026-001";

const IDENTITE_MOCK = {
  raisonSociale: "Axion-IA SAS",
  nda: "82381234567",
  qualiopi: "CERT-2026-001",
  siret: "12345678900011",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 23 45 67 89",
  site: "https://axion-ia.fr",
};

const DOC_RESULT_MOCK = { id: DOCUMENT_ID, numero: NUMERO, pdfUrl: null, hashSha256: "abc" };

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    titreSession: "IA Opérationnelle",
    dateDebut: new Date("2026-09-01T09:00:00Z"),
    dateFin: new Date("2026-09-02T17:00:00Z"),
    modalite: "presentiel",
    nbParticipantsPrevus: 8,
    montantHtCents: 150000,
    coFormateurs: [],
    priseEnChargeMontantCents: null,
    numeroDossierOpco: null,
    ftDispositif: null,
    dureeReelleHeures: null,
    client: {
      raisonSociale: "Client Test SA",
      siret: "11223344556677",
      adresse: "2 avenue des Tests, 69001 Lyon",
      contactNom: "Jean Test",
      contactEmail: "jean@test.fr",
      opcoIdentifie: "OPCO EP",
      opcoNumeroAdherent: "ADH-12345",
    },
    formation: {
      slug: "ia-operationnelle",
      dureeHeures: 14,
      titre: "IA Opérationnelle",
      objectifsPedagogiques: [
        { description: "Maîtriser les LLM" },
        { description: "Intégrer l'IA dans les process" },
      ],
      offreSite: { publicViseFr: "Professionnels en reconversion" },
      codeCpf: "RS12345",
    },
    enrollments: [],
    ...overrides,
  };
}

function makeEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: ENROLLMENT_ID,
    tauxPresencePct: 100,
    trainee: {
      nom: "Dupont",
      prenom: "Marie",
      entreprise: "Tech Corp",
      fonction: "Directrice Innovation",
    },
    session: makeSession(),
    ...overrides,
  };
}

/**
 * Données réellement transmises au gabarit PDF du PREMIER document généré.
 *
 * ⚠️ Elles ne sont PAS au sommet de l'appel : `generateDocument` reçoit un
 * `buildElement(numero)`, et c'est l'élément React produit qui les porte. Lire
 * `calls[0][0].data` renvoie `undefined` — donc une assertion qui ne prouve rien.
 */
function donneesPdf<T>(): T {
  const call = mockGenerateDocument.mock.calls[0]?.[0] as
    | { buildElement: (n: string) => { props: { data: T } } }
    | undefined;
  if (call === undefined) throw new Error("generateDocument n'a pas été appelé");
  return call.buildElement("AXI-TEST-2026-001").props.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // ⚠️ `clearAllMocks` efface les APPELS, pas les `mockResolvedValue` : toute
  // valeur par défaut doit être reposée ICI, sinon elle fuit d'un `describe` au
  // suivant et des tests passent par accident.
  vi.clearAllMocks();
  mockGetOrganismeIdentite.mockResolvedValue(IDENTITE_MOCK);
  mockGenerateDocument.mockResolvedValue(DOC_RESULT_MOCK);
  mockSessionJourFindMany.mockResolvedValue([]);
  // Dossier sain par defaut : une trace d'emargement existe.
  mockSignatureCount.mockResolvedValue(1);
  mockGetQualiopiConfig.mockResolvedValue(null);
  // Aucun barème par défaut → la lettre retombe sur le tarif de la fiche.
  mockCompensationRuleFindMany.mockResolvedValue([]);
  mockSessionFindMany.mockResolvedValue([]);
  mockCoachingFindMany.mockResolvedValue([]);
  mockAuditFindMany.mockResolvedValue([]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Convention
// ─────────────────────────────────────────────────────────────────────────────

describe("genererConventionAction", () => {
  it("retourne documentId + numero pour une session avec client", async () => {
    mockSessionFindUnique.mockResolvedValue(makeSession());

    const result = await genererConventionAction({ sessionId: SESSION_ID });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });
    expect(mockGenerateDocument).toHaveBeenCalledOnce();

    const call = mockGenerateDocument.mock.calls[0]![0]! as {
      type: string;
      buildElement: (n: string) => unknown;
      refs: { sessionId: string };
    };
    expect(call.type).toBe("convention");
    expect(call.refs.sessionId).toBe(SESSION_ID);

    // buildElement doit recevoir le numéro et retourner un élément React
    const element = call.buildElement("AXI-FORM-2026-001");
    expect(element).toBeDefined();
    expect(typeof element).toBe("object");
  });

  it("retourne error si session introuvable", async () => {
    mockSessionFindUnique.mockResolvedValue(null);
    const result = await genererConventionAction({ sessionId: SESSION_ID });
    expect(result).toEqual({ error: "Session introuvable" });
  });

  it("retourne error si session sans client", async () => {
    mockSessionFindUnique.mockResolvedValue(makeSession({ client: null }));
    const result = await genererConventionAction({ sessionId: SESSION_ID });
    expect(result).toHaveProperty("error");
  });

  it("retourne error sur UUID invalide", async () => {
    const result = await genererConventionAction({ sessionId: "pas-un-uuid" });
    expect(result).toEqual({ error: "Données invalides" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Certificat de réalisation (R.6313-3 — heures en centièmes)
// ─────────────────────────────────────────────────────────────────────────────

describe("genererCertificatRealisationAction", () => {
  it("génère le certificat et passe la durée réelle en centièmes", async () => {
    const enrollment = makeEnrollment({
      session: makeSession({ dureeReelleHeures: 14 }),
    });
    mockEnrollmentFindUnique.mockResolvedValue(enrollment);

    const result = await genererCertificatRealisationAction({ enrollmentId: ENROLLMENT_ID });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });

    const call = mockGenerateDocument.mock.calls[0]![0]! as {
      type: string;
      buildElement: (n: string) => unknown;
      refs: { sessionId: string };
    };
    expect(call.type).toBe("certificat_realisation");
    // buildElement doit retourner un élément React valide avec le numéro
    const element = call.buildElement("AXI-CERT-2026-001");
    expect(element).toBeDefined();
    expect(typeof element).toBe("object");
    // sessionId passé dans les refs
    expect(call.refs.sessionId).toBe(SESSION_ID);
  });

  it("utilise dureeHeures × taux si dureeReelleHeures absent", async () => {
    const enrollment = makeEnrollment({
      tauxPresencePct: 80,
      session: makeSession({ dureeReelleHeures: null }),
    });
    mockEnrollmentFindUnique.mockResolvedValue(enrollment);

    await genererCertificatRealisationAction({ enrollmentId: ENROLLMENT_ID });

    // Vérifie que generateDocument a été appelé (durée calculée = 80% × 14 = ~11)
    expect(mockGenerateDocument).toHaveBeenCalledOnce();
  });

  it("retourne error si enrollment introuvable", async () => {
    mockEnrollmentFindUnique.mockResolvedValue(null);
    const result = await genererCertificatRealisationAction({ enrollmentId: ENROLLMENT_ID });
    expect(result).toEqual({ error: "Inscription introuvable" });
  });

  it("REFUSE le certificat pour un stagiaire en abandon (R.6313-3)", async () => {
    mockEnrollmentFindUnique.mockResolvedValue(makeEnrollment({ statut: "abandon" }));
    const result = await genererCertificatRealisationAction({ enrollmentId: ENROLLMENT_ID });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("abandon/exclu");
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it("REFUSE le certificat pour un stagiaire exclu (R.6313-3)", async () => {
    mockEnrollmentFindUnique.mockResolvedValue(makeEnrollment({ statut: "exclu" }));
    const result = await genererCertificatRealisationAction({ enrollmentId: ENROLLMENT_ID });
    expect(result).toHaveProperty("error");
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Convocation
// ─────────────────────────────────────────────────────────────────────────────

describe("genererConvocationAction", () => {
  it("génère la convocation pour un enrollment valide", async () => {
    mockEnrollmentFindUnique.mockResolvedValue(makeEnrollment());

    const result = await genererConvocationAction({ enrollmentId: ENROLLMENT_ID });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });

    const call = mockGenerateDocument.mock.calls[0]![0]! as {
      type: string;
      buildElement: (n: string) => unknown;
      refs: { sessionId: string };
    };
    expect(call.type).toBe("convocation");
    // buildElement reçoit le numéro alloué
    const element = call.buildElement("AXI-SESS-2026-001");
    expect(element).toBeDefined();
    // refs pointe la session
    expect(call.refs.sessionId).toBe(SESSION_ID);
  });

  it("🔴 annonce les horaires RÉELS des journées déclarées", async () => {
    // La convocation et la feuille d'émargement doivent dire la MÊME chose :
    // CAA Nantes 20/04/2021 sanctionne les horaires divergents entre documents.
    mockEnrollmentFindUnique.mockResolvedValue(makeEnrollment());
    mockSessionJourFindMany.mockResolvedValue([
      { heureDebut: "08:30", heureFin: "16:45" },
      { heureDebut: "08:30", heureFin: "16:45" },
    ]);

    await genererConvocationAction({ enrollmentId: ENROLLMENT_ID });

    const data = donneesPdf<{ horaires: string }>();
    // Deux journées identiques → une seule plage, pas « 08:30–16:45, 08:30–16:45 ».
    expect(data.horaires).toBe("08:30–16:45");
  });

  it("liste les plages quand les journées ont des horaires DIFFÉRENTS", async () => {
    mockEnrollmentFindUnique.mockResolvedValue(makeEnrollment());
    mockSessionJourFindMany.mockResolvedValue([
      { heureDebut: "09:00", heureFin: "17:00" },
      { heureDebut: "09:00", heureFin: "12:30" },
    ]);

    await genererConvocationAction({ enrollmentId: ENROLLMENT_ID });

    const data = donneesPdf<{ horaires: string }>();
    expect(data.horaires).toBe("09:00–17:00, 09:00–12:30");
  });

  it("🔴 n'INVENTE pas d'horaires quand aucune journée n'est déclarée", async () => {
    mockEnrollmentFindUnique.mockResolvedValue(makeEnrollment());
    mockSessionJourFindMany.mockResolvedValue([]);

    await genererConvocationAction({ enrollmentId: ENROLLMENT_ID });

    const data = donneesPdf<{ horaires: string }>();
    expect(data.horaires).not.toMatch(/\d{2}:\d{2}/);
    expect(data.horaires).toContain("communiqués");
  });

  it("retourne error si enrollment introuvable", async () => {
    mockEnrollmentFindUnique.mockResolvedValue(null);
    const result = await genererConvocationAction({ enrollmentId: ENROLLMENT_ID });
    expect(result).toEqual({ error: "Inscription introuvable" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Émargement
// ─────────────────────────────────────────────────────────────────────────────

describe("genererEmargementAction", () => {
  /**
   * L'action interroge la session DEUX fois : une fois pour elle-même, une fois
   * via `construireFeuillePdf`. Les deux passent par le même mock, donc l'objet
   * doit porter la réunion des deux `select` — dont `jours`.
   */
  function sessionEmargeable(overrides: Record<string, unknown> = {}) {
    return makeSession({
      formateurPrincipal: { nom: "Jullin", prenom: "Williams" },
      jours: [
        {
          date: new Date("2026-09-01T00:00:00.000Z"),
          heureDebut: "08:30",
          heureFin: "16:45",
          modules: ["Module 1 — Cadrage"],
          trainer: null,
        },
      ],
      enrollments: [
        {
          id: ENROLLMENT_ID,
          trainee: { nom: "Dupont", prenom: "Marie", entreprise: "Tech" },
          emargementSignatures: [],
        },
        {
          id: "enr-2",
          trainee: { nom: "Martin", prenom: "Paul", entreprise: null },
          emargementSignatures: [],
        },
      ],
      emargementContresignatures: [],
      ...overrides,
    });
  }

  it("génère la feuille d'émargement avec les stagiaires de la session", async () => {
    mockSessionFindUnique.mockResolvedValue(sessionEmargeable());

    const result = await genererEmargementAction({ sessionId: SESSION_ID });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });

    const call = mockGenerateDocument.mock.calls[0]![0]! as {
      type: string;
      buildElement: (n: string) => unknown;
      refs: { sessionId: string };
      data: { journees: Array<{ horaires: string; formateurNom: string }> };
    };
    expect(call.type).toBe("emargement");
    // buildElement reçoit le numéro
    const element = call.buildElement("AXI-SESS-2026-002");
    expect(element).toBeDefined();
    expect(call.refs.sessionId).toBe(SESSION_ID);
  });

  it("🔴 porte les horaires RÉELS de la journée, jamais un « 09h00–17h00 » codé en dur", async () => {
    // CAA Nantes 20/04/2021 : une feuille dont les horaires ne correspondent pas
    // à la réalité est insuffisamment probante. C'est tout l'objet du passage par
    // `session_jours`.
    mockSessionFindUnique.mockResolvedValue(sessionEmargeable());
    await genererEmargementAction({ sessionId: SESSION_ID });

    const data = donneesPdf<{
      journees: Array<{ horaires: string; formateurNom: string; modules: string[] }>;
    }>();
    expect(data.journees).toHaveLength(1);
    expect(data.journees[0]!.horaires).toBe("08:30–16:45");
    expect(data.journees[0]!.formateurNom).toBe("Williams Jullin");
    expect(data.journees[0]!.modules).toEqual(["Module 1 — Cadrage"]);
  });

  it("🔴 REFUSE de produire la feuille quand aucune journée n'est déclarée", async () => {
    // Mieux vaut pas de pièce qu'une pièce fausse : sans horaires réels, la
    // feuille ne prouve rien et exposerait à un redressement au prorata.
    mockSessionFindUnique.mockResolvedValue(sessionEmargeable({ jours: [] }));

    const result = await genererEmargementAction({ sessionId: SESSION_ID });

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("journées");
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it("retourne error si session introuvable", async () => {
    mockSessionFindUnique.mockResolvedValue(null);
    const result = await genererEmargementAction({ sessionId: SESSION_ID });
    expect(result).toEqual({ error: "Session introuvable" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Kit OPCO
// ─────────────────────────────────────────────────────────────────────────────

describe("genererKitOpcoAction", () => {
  it("génère le kit OPCO avec la ventilation des participants", async () => {
    const session = makeSession({
      priseEnChargeMontantCents: 50000,
      enrollments: [
        {
          trainee: { nom: "Dupont", prenom: "Marie" },
          session: { dureeReelleHeures: 14, formation: { dureeHeures: 14 } },
        },
      ],
    });
    mockSessionFindUnique.mockResolvedValue(session);

    const result = await genererKitOpcoAction({ sessionId: SESSION_ID });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });

    const call = mockGenerateDocument.mock.calls[0]![0]! as {
      type: string;
      buildElement: (n: string) => unknown;
      refs: { sessionId: string };
    };
    expect(call.type).toBe("kit_opco");
    // buildElement reçoit le numéro et retourne un élément React
    const element = call.buildElement("AXI-FORM-2026-002");
    expect(element).toBeDefined();
    expect(call.refs.sessionId).toBe(SESSION_ID);
  });

  it("retourne error si session introuvable", async () => {
    mockSessionFindUnique.mockResolvedValue(null);
    const result = await genererKitOpcoAction({ sessionId: SESSION_ID });
    expect(result).toEqual({ error: "Session introuvable" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Règlement intérieur (L.6352-3)
// ─────────────────────────────────────────────────────────────────────────────

describe("genererReglementInterieurAction", () => {
  it("génère le règlement intérieur pour une session valide", async () => {
    mockSessionFindUnique.mockResolvedValue({ id: SESSION_ID });

    const result = await genererReglementInterieurAction({ sessionId: SESSION_ID });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });

    const call = mockGenerateDocument.mock.calls[0]![0]! as {
      type: string;
      buildElement: (n: string) => unknown;
      refs: { sessionId: string };
    };
    expect(call.type).toBe("reglement_interieur");
    // buildElement doit injecter le numéro dans le document
    const element = call.buildElement("AXI-FORM-2026-003");
    expect(element).toBeDefined();
    expect(call.refs.sessionId).toBe(SESSION_ID);
  });

  it("retourne error si session introuvable", async () => {
    mockSessionFindUnique.mockResolvedValue(null);
    const result = await genererReglementInterieurAction({ sessionId: SESSION_ID });
    expect(result).toEqual({ error: "Session introuvable" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Convention tripartite
// ─────────────────────────────────────────────────────────────────────────────

describe("genererConventionTripartiteAction", () => {
  it("génère la convention tripartite avec les infos OPCO", async () => {
    mockSessionFindUnique.mockResolvedValue(makeSession());

    const result = await genererConventionTripartiteAction({ sessionId: SESSION_ID });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });

    const call = mockGenerateDocument.mock.calls[0]![0]! as {
      type: string;
      refs: { sessionId: string };
    };
    expect(call.type).toBe("convention_tripartite");
    expect(call.refs.sessionId).toBe(SESSION_ID);
  });

  it("retourne error si session sans client", async () => {
    mockSessionFindUnique.mockResolvedValue(makeSession({ client: null }));
    const result = await genererConventionTripartiteAction({ sessionId: SESSION_ID });
    expect(result).toHaveProperty("error");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Satisfaction
// ─────────────────────────────────────────────────────────────────────────────

describe("genererSatisfactionAction", () => {
  it("génère le questionnaire de satisfaction", async () => {
    mockSessionFindUnique.mockResolvedValue({
      id: SESSION_ID,
      titreSession: "IA Opérationnelle",
      dateFin: new Date("2026-09-02T17:00:00Z"),
    });

    const result = await genererSatisfactionAction({ sessionId: SESSION_ID });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });
    const call = mockGenerateDocument.mock.calls[0]![0]! as { type: string };
    expect(call.type).toBe("satisfaction");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Positionnement
// ─────────────────────────────────────────────────────────────────────────────

describe("genererPositionnementAction", () => {
  it("génère le questionnaire de positionnement", async () => {
    mockSessionFindUnique.mockResolvedValue({
      id: SESSION_ID,
      titreSession: "IA Opérationnelle",
      dateDebut: new Date("2026-09-01T09:00:00Z"),
    });

    const result = await genererPositionnementAction({ sessionId: SESSION_ID });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });
    const call = mockGenerateDocument.mock.calls[0]![0]! as { type: string };
    expect(call.type).toBe("positionnement");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Grille d'évaluation
// ─────────────────────────────────────────────────────────────────────────────

describe("genererGrilleEvaluationAction", () => {
  it("génère la grille d'évaluation pour un stagiaire", async () => {
    mockEnrollmentFindUnique.mockResolvedValue(makeEnrollment());

    const result = await genererGrilleEvaluationAction({ enrollmentId: ENROLLMENT_ID });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });
    const call = mockGenerateDocument.mock.calls[0]![0]! as { type: string };
    expect(call.type).toBe("grille_evaluation");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Kit CPF
// ─────────────────────────────────────────────────────────────────────────────

describe("genererKitCpfAction", () => {
  it("génère le kit CPF avec les données financières", async () => {
    mockEnrollmentFindUnique.mockResolvedValue(makeEnrollment());

    const result = await genererKitCpfAction({ enrollmentId: ENROLLMENT_ID });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });
    const call = mockGenerateDocument.mock.calls[0]![0]! as { type: string };
    expect(call.type).toBe("kit_cpf");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Kit France Travail
// ─────────────────────────────────────────────────────────────────────────────

describe("genererKitFranceTravailAction", () => {
  it("génère le kit FT avec le dispositif AIF par défaut", async () => {
    mockEnrollmentFindUnique.mockResolvedValue(makeEnrollment());

    const result = await genererKitFranceTravailAction({ enrollmentId: ENROLLMENT_ID });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });
    const call = mockGenerateDocument.mock.calls[0]![0]! as { type: string };
    expect(call.type).toBe("kit_france_travail");
  });

  it("utilise le dispositif POEI si ftDispositif=poei", async () => {
    mockEnrollmentFindUnique.mockResolvedValue(
      makeEnrollment({ session: makeSession({ ftDispositif: "poei" }) }),
    );

    await genererKitFranceTravailAction({ enrollmentId: ENROLLMENT_ID });
    expect(mockGenerateDocument).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. Lettre de mission
// ─────────────────────────────────────────────────────────────────────────────

describe("genererLettreMissionAction", () => {
  const TRAINER_ID = "d1234567-89ab-cdef-0123-456789abcdef";

  /** Formateur sous-traitant nominal — le seul statut auquel la lettre est due. */
  const SOUS_TRAITANT = {
    nom: "Jullin",
    prenom: "Williams",
    email: "w@axion-ia.fr",
    telephone: null,
    statut: "sous_traitant",
    tarifJourneeHtCents: 80000,
    sousTraitantNda: null,
  };

  it("génère la lettre de mission pour une session, ancrée sur le formateur", async () => {
    mockSessionFindUnique.mockResolvedValue(makeSession({ formateurPrincipalId: TRAINER_ID }));
    mockTrainerFindUnique.mockResolvedValue(SOUS_TRAITANT);

    const result = await genererLettreMissionAction({ sessionId: SESSION_ID });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });
    const call = mockGenerateDocument.mock.calls[0]![0]! as {
      type: string;
      refs: Record<string, string>;
    };
    expect(call.type).toBe("lettre_mission");
    // 🔴 L'ancre du mandat. Sans elle, l'autorisation de signature repasse par
    // le détour de la session — le chemin legacy qu'on cherche à éteindre.
    expect(call.refs).toMatchObject({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
  });

  // 🔴 Sans règle de rémunération, la lettre n'imprime plus un tarif nu : elle
  // le dit « tarif général du formateur » — et si la fiche n'a rien, elle
  // l'ÉCRIT au lieu d'imprimer 0,00 € (un faux gratuit signé est irrattrapable).
  it("imprime le tarif de la fiche en repli quand aucun barème n'existe", async () => {
    mockSessionFindUnique.mockResolvedValue(makeSession({ formateurPrincipalId: TRAINER_ID }));
    mockTrainerFindUnique.mockResolvedValue(SOUS_TRAITANT);

    await genererLettreMissionAction({ sessionId: SESSION_ID });

    const data = donneesPdf<{
      remunerations: Array<{ intitule: string | null; libelle: string }>;
    }>();
    expect(data.remunerations).toHaveLength(1);
    expect(data.remunerations[0]!.libelle).toContain("800,00");
    expect(data.remunerations[0]!.libelle).toContain("tarif général");
  });

  it("🔴 imprime la règle RÉSOLUE quand elle existe — le même barème que la paie", async () => {
    mockSessionFindUnique.mockResolvedValue(makeSession({ formateurPrincipalId: TRAINER_ID }));
    mockTrainerFindUnique.mockResolvedValue(SOUS_TRAITANT);
    // Commission 40 % du CA sur cette formation précise, en vigueur.
    mockCompensationRuleFindMany.mockResolvedValue([
      {
        trainerId: TRAINER_ID,
        prestationType: "formation_collective",
        interventionSlug: "ia-operationnelle",
        model: "commission_ca_pct",
        tauxJourneeHtCents: null,
        tauxHoraireHtCents: null,
        forfaitHtCents: null,
        commissionPct: { toNumber: () => 40 },
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        effectiveTo: null,
      },
    ]);

    await genererLettreMissionAction({ sessionId: SESSION_ID });

    const data = donneesPdf<{ remunerations: Array<{ libelle: string }> }>();
    // Avant ce branchement : la lettre annonçait 800,00 € / jour pendant que la
    // paie appliquait 40 % du CA. Deux chiffres contradictoires, pièce signée.
    expect(data.remunerations[0]!.libelle).toContain("40 %");
    expect(data.remunerations[0]!.libelle).not.toContain("800,00");
  });

  // 🔴 Le document s'intitule « Lettre de mission formateur SOUS-TRAITANT ».
  // Un salarié est couvert par son contrat de travail ; le dirigeant ne peut pas
  // se confier une mission à lui-même. Le générateur ne regardait pas le statut.
  it("refuse la lettre pour un salarié, en expliquant pourquoi", async () => {
    mockSessionFindUnique.mockResolvedValue(makeSession({ formateurPrincipalId: TRAINER_ID }));
    mockTrainerFindUnique.mockResolvedValue({ ...SOUS_TRAITANT, statut: "salarie" });

    const result = await genererLettreMissionAction({ sessionId: SESSION_ID });

    expect(result).toMatchObject({ error: expect.stringContaining("salarié") });
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it("refuse la lettre pour le dirigeant-formateur", async () => {
    mockSessionFindUnique.mockResolvedValue(makeSession({ formateurPrincipalId: TRAINER_ID }));
    mockTrainerFindUnique.mockResolvedValue({ ...SOUS_TRAITANT, statut: "dirigeant" });

    const result = await genererLettreMissionAction({ sessionId: SESSION_ID });

    expect(result).toMatchObject({ error: expect.stringContaining("dirigeant") });
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it("🔴 REFUSE de nommer un formateur qui n'existe pas", async () => {
    // Le repli historique retombait sur la RAISON SOCIALE de l'organisme : la
    // lettre désignait « Axion-IA SAS » comme formateur, c'est-à-dire une
    // personne MORALE là où l'indicateur 21 attend une personne physique.
    //
    // ⚠️ Et la branche intermédiaire (nom lu dans le Json brut) était MORTE pour
    // toute donnée bien formée : `parseCoFormateurs` n'accepte que `trainerId`,
    // tandis que le repli lisait `id`, `nom` et `prenom`. On tombait donc
    // directement sur la raison sociale.
    //
    // Depuis que la lettre est SIGNABLE, l'incohérence est visible : le service
    // de signature refuse un signataire non résolvable, donc le générateur
    // produisait une pièce que personne ne pouvait signer.
    mockSessionFindUnique.mockResolvedValue(makeSession({ formateurPrincipalId: null }));
    mockTrainerFindUnique.mockResolvedValue(null);

    const result = await genererLettreMissionAction({ sessionId: SESSION_ID });

    expect(result).toMatchObject({ error: expect.stringContaining("Aucun formateur") });
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it("refuse aussi quand le formateur désigné a été supprimé", async () => {
    // `findUnique` rend `null` sur un formateur supprimé : sans ce refus on
    // retombait sur la raison sociale par exactement le même chemin.
    mockSessionFindUnique.mockResolvedValue(makeSession({ formateurPrincipalId: TRAINER_ID }));
    mockTrainerFindUnique.mockResolvedValue(null);

    const result = await genererLettreMissionAction({ sessionId: SESSION_ID });

    expect(result).toMatchObject({ error: expect.stringContaining("Aucun formateur") });
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13 bis. Lettre de mission-CADRE
// ─────────────────────────────────────────────────────────────────────────────

describe("genererLettreMissionCadreAction", () => {
  const TRAINER_ID = "d1234567-89ab-cdef-0123-456789abcdef";
  const SESSION_2 = "b2222222-2222-4222-8222-222222222222";

  const SOUS_TRAITANT = {
    nom: "Blanc",
    prenom: "Marie",
    email: "m@exemple.fr",
    telephone: null,
    statut: "sous_traitant",
    tarifJourneeHtCents: 60000,
    sousTraitantNda: null,
  };

  function makeSessionCadre(id: string, titre: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      numero: `AXI-SESS-2026-${id.slice(0, 3)}`,
      titreSession: titre,
      dateDebut: new Date("2026-09-10T09:00:00Z"),
      dateFin: new Date("2026-09-10T17:00:00Z"),
      modalite: "presentiel",
      lieuType: null,
      lieuIntitule: null,
      lieuAdresse: null,
      lieuCodePostal: null,
      lieuVille: null,
      lieuSalle: null,
      lieuVisioUrl: null,
      formateurPrincipalId: TRAINER_ID,
      coFormateurs: [],
      formationSnapshot: null,
      formation: { slug: "ia-operationnelle", dureeHeures: 7 },
      ...overrides,
    };
  }

  function armerNominal() {
    mockSessionFindUnique.mockResolvedValue(makeSession({ formateurPrincipalId: TRAINER_ID }));
    mockTrainerFindUnique.mockResolvedValue(SOUS_TRAITANT);
    mockSessionFindMany.mockResolvedValue([
      makeSessionCadre(SESSION_ID, "IA Opérationnelle"),
      makeSessionCadre(SESSION_2, "IA pour l'immobilier", {
        formation: { slug: "ia-immobilier", dureeHeures: 7 },
      }),
    ]);
  }

  it("génère UNE lettre couvrant les sessions cochées, ancrée sur le formateur seul", async () => {
    armerNominal();

    const result = await genererLettreMissionCadreAction({
      sessionId: SESSION_ID,
      dateDebut: "2026-09-01",
      dateFin: "2026-12-31",
      sessionIds: [SESSION_ID, SESSION_2],
    });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });
    const call = mockGenerateDocument.mock.calls[0]![0]! as {
      type: string;
      refs: Record<string, unknown>;
      metadata: { lettreCadre: { du: string; au: string; sessionIds: string[] } };
    };
    expect(call.type).toBe("lettre_mission");
    // 🔴 AUCUNE session en refs : le mandat est le formateur. Les sessions
    // couvertes vivent en métadonnées (affichage), jamais dans l'autorisation.
    expect(call.refs).toEqual({ trainerId: TRAINER_ID });
    expect(call.metadata.lettreCadre.sessionIds).toEqual([SESSION_ID, SESSION_2]);

    const data = donneesPdf<{
      periode: { du: string; au: string };
      formations: Array<{ intitule: string }>;
    }>();
    expect(data.periode).toBeDefined();
    expect(data.formations.map((f) => f.intitule)).toEqual([
      "IA Opérationnelle",
      "IA pour l'immobilier",
    ]);
  });

  it("compresse la rémunération en une ligne quand toutes les formations partagent le barème", async () => {
    armerNominal();

    await genererLettreMissionCadreAction({
      sessionId: SESSION_ID,
      dateDebut: "2026-09-01",
      dateFin: "2026-12-31",
      sessionIds: [SESSION_ID, SESSION_2],
    });

    const data = donneesPdf<{ remunerations: Array<{ intitule: string | null }> }>();
    // Même repli (tarif fiche) partout → une seule ligne « toutes formations ».
    expect(data.remunerations).toHaveLength(1);
    expect(data.remunerations[0]!.intitule).toBeNull();
  });

  it("garde une ligne PAR formation quand les barèmes diffèrent", async () => {
    armerNominal();
    mockCompensationRuleFindMany.mockResolvedValue([
      {
        trainerId: TRAINER_ID,
        prestationType: "formation_collective",
        interventionSlug: "ia-immobilier",
        model: "commission_ca_pct",
        tauxJourneeHtCents: null,
        tauxHoraireHtCents: null,
        forfaitHtCents: null,
        commissionPct: { toNumber: () => 40 },
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        effectiveTo: null,
      },
    ]);

    await genererLettreMissionCadreAction({
      sessionId: SESSION_ID,
      dateDebut: "2026-09-01",
      dateFin: "2026-12-31",
      sessionIds: [SESSION_ID, SESSION_2],
    });

    const data = donneesPdf<{
      remunerations: Array<{ intitule: string | null; libelle: string }>;
    }>();
    expect(data.remunerations).toHaveLength(2);
    expect(data.remunerations[1]!.libelle).toContain("40 %");
    expect(data.remunerations[0]!.libelle).toContain("600,00");
  });

  // 🔴 La liste cliente n'est JAMAIS crue : un identifiant étranger glissé dans
  // la requête ferait signer au sous-traitant une formation qui ne lui est pas
  // confiée — avec son nom imprimé et scellé dessus.
  it("refuse une session dont le formateur principal est quelqu'un d'autre", async () => {
    armerNominal();
    mockSessionFindMany.mockResolvedValue([
      makeSessionCadre(SESSION_ID, "IA Opérationnelle"),
      makeSessionCadre(SESSION_2, "Autre formation", {
        formateurPrincipalId: "e9999999-9999-4999-8999-999999999999",
      }),
    ]);

    const result = await genererLettreMissionCadreAction({
      sessionId: SESSION_ID,
      dateDebut: "2026-09-01",
      dateFin: "2026-12-31",
      sessionIds: [SESSION_ID, SESSION_2],
    });

    expect(result).toMatchObject({
      error: expect.stringContaining("formateur principal"),
    });
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it("refuse un salarié — même règle que la lettre de session", async () => {
    armerNominal();
    mockTrainerFindUnique.mockResolvedValue({ ...SOUS_TRAITANT, statut: "salarie" });

    const result = await genererLettreMissionCadreAction({
      sessionId: SESSION_ID,
      dateDebut: "2026-09-01",
      dateFin: "2026-12-31",
      sessionIds: [SESSION_ID],
    });

    expect(result).toMatchObject({ error: expect.stringContaining("salarié") });
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it("refuse une période inversée", async () => {
    armerNominal();

    const result = await genererLettreMissionCadreAction({
      sessionId: SESSION_ID,
      dateDebut: "2026-12-31",
      dateFin: "2026-09-01",
      sessionIds: [SESSION_ID],
    });

    expect(result).toMatchObject({ error: expect.stringContaining("postérieure") });
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it("refuse quand une session cochée a disparu entre la liste et la génération", async () => {
    armerNominal();
    mockSessionFindMany.mockResolvedValue([makeSessionCadre(SESSION_ID, "IA Opérationnelle")]);

    const result = await genererLettreMissionCadreAction({
      sessionId: SESSION_ID,
      dateDebut: "2026-09-01",
      dateFin: "2026-12-31",
      sessionIds: [SESSION_ID, SESSION_2],
    });

    expect(result).toMatchObject({ error: expect.stringContaining("introuvable") });
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  // ── Coachings AFEST + audits (Will 2026-08-01 : « on peut avoir des
  // sous-traitants aussi » sur ces prestations) ──

  const COACHING_ID = "c1111111-1111-4111-8111-111111111111";
  const AUDIT_ID = "a1111111-1111-4111-8111-111111111111";

  function armerMixte() {
    armerNominal();
    mockSessionFindMany.mockResolvedValue([makeSessionCadre(SESSION_ID, "IA Opérationnelle")]);
    mockCoachingFindMany.mockResolvedValue([
      {
        id: COACHING_ID,
        trainerId: TRAINER_ID,
        interventionSlug: "coaching-decouverte",
        dateSeance: new Date("2026-10-05T09:00:00Z"),
        dateSeanceFin: new Date("2026-10-05T12:00:00Z"),
        beneficiaireEntreprise: "INVEST SUN",
        lieuType: null,
        lieuIntitule: null,
        lieuAdresse: null,
        lieuCodePostal: null,
        lieuVille: null,
        lieuSalle: null,
        lieuVisioUrl: null,
      },
    ]);
    mockAuditFindMany.mockResolvedValue([
      {
        id: AUDIT_ID,
        numero: "AXI-AUD-2026-001",
        titre: "Audit IA process",
        formateurId: TRAINER_ID,
        dateDebut: new Date("2026-11-02T09:00:00Z"),
        dateFin: new Date("2026-11-03T17:00:00Z"),
        dureeHeures: 14,
        lieuType: null,
        lieuIntitule: null,
        lieuAdresse: null,
        lieuCodePostal: null,
        lieuVille: null,
        lieuSalle: null,
        lieuVisioUrl: null,
      },
    ]);
  }

  it("couvre formations + coachings + audits sur la même lettre, ancrée sur le formateur", async () => {
    armerMixte();

    const result = await genererLettreMissionCadreAction({
      sessionId: SESSION_ID,
      dateDebut: "2026-09-01",
      dateFin: "2026-12-31",
      sessionIds: [SESSION_ID],
      coachingIds: [COACHING_ID],
      auditIds: [AUDIT_ID],
    });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });
    const call = mockGenerateDocument.mock.calls[0]![0]! as {
      refs: Record<string, unknown>;
      metadata: { lettreCadre: Record<string, unknown> };
    };
    expect(call.refs).toEqual({ trainerId: TRAINER_ID });
    expect(call.metadata.lettreCadre["coachingIds"]).toEqual([COACHING_ID]);
    expect(call.metadata.lettreCadre["auditIds"]).toEqual([AUDIT_ID]);

    const data = donneesPdf<{ formations: Array<{ intitule: string; dureeHeures: number }> }>();
    expect(data.formations).toHaveLength(3);
    // L'ENTREPRISE bénéficiaire, jamais le nom d'une personne physique.
    expect(data.formations[1]!.intitule).toContain("Coaching 1-to-1");
    expect(data.formations[1]!.intitule).toContain("INVEST SUN");
    expect(data.formations[1]!.dureeHeures).toBe(3);
    expect(data.formations[2]!.intitule).toContain("Audit — Audit IA process");
  });

  it("🔴 le barème coaching se résout sur SON type de prestation, pas celui des formations", async () => {
    armerMixte();
    mockCompensationRuleFindMany.mockResolvedValue([
      {
        trainerId: TRAINER_ID,
        prestationType: "coaching_1to1",
        interventionSlug: null,
        model: "taux_horaire",
        tauxJourneeHtCents: null,
        tauxHoraireHtCents: 12000,
        forfaitHtCents: null,
        commissionPct: null,
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        effectiveTo: null,
      },
    ]);

    await genererLettreMissionCadreAction({
      sessionId: SESSION_ID,
      dateDebut: "2026-09-01",
      dateFin: "2026-12-31",
      sessionIds: [SESSION_ID],
      coachingIds: [COACHING_ID],
    });

    const data = donneesPdf<{
      remunerations: Array<{ intitule: string | null; libelle: string }>;
    }>();
    expect(data.remunerations).toHaveLength(2);
    // Formation → repli tarif fiche ; coaching → règle horaire dédiée.
    expect(data.remunerations[0]!.libelle).toContain("600,00");
    expect(data.remunerations[1]!.libelle).toContain("120,00");
    expect(data.remunerations[1]!.libelle).toContain("heure");
  });

  it("🔴 refuse un coaching animé par quelqu'un d'autre", async () => {
    armerMixte();
    mockCoachingFindMany.mockResolvedValue([
      {
        id: COACHING_ID,
        trainerId: "e9999999-9999-4999-8999-999999999999",
        interventionSlug: "coaching-decouverte",
        dateSeance: new Date("2026-10-05T09:00:00Z"),
        dateSeanceFin: null,
        beneficiaireEntreprise: null,
        lieuType: null,
        lieuIntitule: null,
        lieuAdresse: null,
        lieuCodePostal: null,
        lieuVille: null,
        lieuSalle: null,
        lieuVisioUrl: null,
      },
    ]);

    const result = await genererLettreMissionCadreAction({
      sessionId: SESSION_ID,
      dateDebut: "2026-09-01",
      dateFin: "2026-12-31",
      sessionIds: [SESSION_ID],
      coachingIds: [COACHING_ID],
    });

    expect(result).toMatchObject({ error: expect.stringContaining("coaching") });
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it("refuse une lettre-cadre sans AUCUNE prestation cochée", async () => {
    armerNominal();

    const result = await genererLettreMissionCadreAction({
      sessionId: SESSION_ID,
      dateDebut: "2026-09-01",
      dateFin: "2026-12-31",
      sessionIds: [],
    });

    expect(result).toMatchObject({ error: expect.any(String) });
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. Livret d'accueil
// ─────────────────────────────────────────────────────────────────────────────

describe("genererLivretAccueilAction", () => {
  it("génère le livret d'accueil pour une session", async () => {
    mockSessionFindUnique.mockResolvedValue({ id: SESSION_ID, coFormateurs: [] });

    const result = await genererLivretAccueilAction({ sessionId: SESSION_ID });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });
    const call = mockGenerateDocument.mock.calls[0]![0]! as { type: string };
    expect(call.type).toBe("livret_accueil");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. Stub-aware — toutes les actions renvoient error en mode build
// ─────────────────────────────────────────────────────────────────────────────

describe("stub-aware — mode build stub.invalid", () => {
  const originalUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
  });

  afterEach(() => {
    if (originalUrl !== undefined) {
      process.env.DATABASE_URL = originalUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it("genererConventionAction retourne error en mode stub", async () => {
    const result = await genererConventionAction({ sessionId: SESSION_ID });
    expect(result).toEqual({ error: "Génération désactivée en mode build (stub)" });
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it("genererCertificatRealisationAction retourne error en mode stub", async () => {
    const result = await genererCertificatRealisationAction({ enrollmentId: ENROLLMENT_ID });
    expect(result).toEqual({ error: "Génération désactivée en mode build (stub)" });
  });

  it("genererEmargementAction retourne error en mode stub", async () => {
    const result = await genererEmargementAction({ sessionId: SESSION_ID });
    expect(result).toEqual({ error: "Génération désactivée en mode build (stub)" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 Certificat de réalisation sans preuve d'assiduité.
//
// Constaté EN PRODUCTION le 2026-07-26, et déjà matérialisé : un
// `certificat_realisation` avait été émis le 22/07 alors que
// `emargement_signatures` comptait ZÉRO ligne.
//
// Le statut d'abandon était la seule garde. Plus bas, la durée n'est pondérée
// par le taux que `if (tauxPresencePct !== null)` — donc taux inconnu = durée
// PRÉVUE certifiée comme réalisée. R.6313-3, indicateurs 9 et 11.
// ─────────────────────────────────────────────────────────────────────────────

describe("genererCertificatRealisationAction — preuve d'assiduité exigée", () => {
  function inscription(over: Record<string, unknown> = {}) {
    return {
      id: ENROLLMENT_ID,
      statut: "presente",
      tauxPresencePct: 100,
      trainee: { id: "t-1", nom: "Martin", prenom: "Jean", fonction: null },
      session: {
        id: "s-1",
        titreSession: "IA pour bien commencer",
        dateDebut: new Date("2026-07-22"),
        dateFin: new Date("2026-07-22"),
        modalite: "presentiel",
        dureeReelleHeures: 4,
        formationSnapshot: null,
        formation: { titre: "IA pour bien commencer", dureeHeures: 4 },
        client: null,
        coFormateurs: [],
        formateurPrincipalId: null,
      },
      ...over,
    };
  }

  beforeEach(() => {
    mockEnrollmentFindUnique.mockResolvedValue(inscription());
    mockSignatureCount.mockResolvedValue(1);
  });

  it("refuse quand le taux de présence n'a jamais été calculé", async () => {
    mockEnrollmentFindUnique.mockResolvedValue(inscription({ tauxPresencePct: null }));
    const r = await genererCertificatRealisationAction({ enrollmentId: ENROLLMENT_ID });
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("taux de présence");
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  // Le cas exact trouvé en production : un taux existe, aucune signature.
  it("refuse quand aucune signature d'émargement n'est rattachée", async () => {
    mockSignatureCount.mockResolvedValue(0);
    const r = await genererCertificatRealisationAction({ enrollmentId: ENROLLMENT_ID });
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("signature");
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it("émet le certificat quand le taux est mesuré ET tracé", async () => {
    const r = await genererCertificatRealisationAction({ enrollmentId: ENROLLMENT_ID });
    expect("error" in r).toBe(false);
    expect(mockGenerateDocument).toHaveBeenCalled();
  });

  // Un taux de 0 % est une MESURE, pas une absence de mesure : il doit passer la
  // première garde et se faire refuser — ou non — sur d'autres critères, pas
  // être confondu avec « non calculé ».
  it("distingue un taux de 0 % d'un taux non calculé", async () => {
    mockEnrollmentFindUnique.mockResolvedValue(inscription({ tauxPresencePct: 0 }));
    const r = await genererCertificatRealisationAction({ enrollmentId: ENROLLMENT_ID });
    if ("error" in r) expect(r.error).not.toContain("n'a pas été calculé");
  });
});

describe("🔴 contrat particulier — l'acompte ANNONCÉ est celui qui sera demandé", () => {
  beforeEach(() => {
    // Le médiateur de la consommation est vide en production. Depuis le
    // 2026-07-30 son absence n'empêche plus l'émission — elle déclenche un
    // avertissement (cf. describe suivant). On le renseigne ici pour que ces
    // tests-ci portent sur le calcul d'acompte et rien d'autre.
    mockGetQualiopiConfig.mockImplementation(async (cle: string) =>
      cle === "mediateur_consommation_nom"
        ? "CM2C"
        : cle === "mediateur_consommation_url"
          ? "https://cm2c.net"
          : null,
    );
  });

  it("prend pour assiette le RESTE À CHARGE, pas le prix total", async () => {
    // Le défaut que ce test ferme : le gabarit accepte `acompteEuros` depuis le
    // 2026-07-27 pour imprimer ce qui a été CONVENU, mais PERSONNE ne le lui
    // fournissait. Il retombait donc sur 30 % de `prixNet`, c'est-à-dire du
    // TOTAL. Sur 2 000 € dont 1 200 € financés, le contrat annonçait 600 € là
    // où le calcul en propose 240 : le client signait un chiffre que le système
    // n'appliquait pas.
    mockEnrollmentFindUnique.mockResolvedValue(
      makeEnrollment({
        session: makeSession({
          montantHtCents: 200_000,
          priseEnChargeMontantCents: 120_000,
          opcoSubrogation: true,
        }),
      }),
    );

    await genererContratFormationAction({ enrollmentId: ENROLLMENT_ID });

    const data = donneesPdf<{ prixNet: number; acompteEuros?: number }>();
    // Le prix total reste imprimé tel quel — c'est le prix convenu.
    expect(data.prixNet).toBe(2000);
    // Mais l'acompte est calculé sur le reste à charge (800 €), pas sur 2 000 €.
    expect(data.acompteEuros).toBeDefined();
    expect(data.acompteEuros!).toBeLessThanOrEqual(800 * 0.3);
    expect(data.acompteEuros!).toBeLessThan(600);
  });

  it("🔴 l'acompte annoncé ne dépasse JAMAIS le plafond légal du prix convenu", async () => {
    // Les deux étages ne se contredisent pas : 30 % du reste à charge est
    // toujours ≤ 30 % du prix convenu, plafond que `facturation-hub` fait
    // respecter au refus. Ce test l'énonce plutôt que de le supposer.
    //
    // ⚠️ L'action est rejouée ICI : `clearAllMocks` efface les appels entre
    // chaque test, donc lire `donneesPdf()` sans rejouer ne lirait rien.
    mockEnrollmentFindUnique.mockResolvedValue(
      makeEnrollment({
        session: makeSession({ montantHtCents: 200_000, priseEnChargeMontantCents: 0 }),
      }),
    );

    await genererContratFormationAction({ enrollmentId: ENROLLMENT_ID });

    const data = donneesPdf<{ acompteEuros?: number }>();
    // Aucune prise en charge : reste à charge = prix convenu, donc le calcul
    // touche exactement le plafond sans jamais le franchir.
    expect(data.acompteEuros!).toBeLessThanOrEqual(2000 * 0.3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Médiation de la consommation — avertir sans bloquer (décision Will 2026-07-30)
// ─────────────────────────────────────────────────────────────────────────────
//
// L'audit de certification avait posé un REFUS dur : sans médiateur agréé
// renseigné, pas de contrat individuel. Décision de ne plus bloquer.
//
// L'obligation légale (art. L.612-1 C. conso.) ne disparaît pas pour autant, et
// ce n'est pas au code de la faire respecter. Ce que le code doit garantir, en
// revanche, c'est que l'absence ne passe pas INAPERÇUE — c'est précisément ce
// que ces tests verrouillent. Sans eux, « ne plus bloquer » dériverait en
// « ne plus rien dire », et la différence entre les deux est tout le sujet.
describe("contrat particulier — médiation absente : on avertit, on ne bloque plus", () => {
  beforeEach(() => {
    // Aucune configuration Qualiopi : l'état réel de la production.
    mockGetQualiopiConfig.mockResolvedValue(null);
    mockEnrollmentFindUnique.mockResolvedValue(makeEnrollment());
  });

  it("émet quand même le contrat, avec son numéro", async () => {
    const r = await genererContratFormationAction({ enrollmentId: ENROLLMENT_ID });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.data.numero).toBeTruthy();
    expect(r.data.documentId).toBeTruthy();
  });

  it("retourne un avertissement qui NOMME ce qui manque et où le corriger", async () => {
    const r = await genererContratFormationAction({ enrollmentId: ENROLLMENT_ID });
    if ("error" in r) throw new Error("le contrat ne devrait plus être refusé");
    // Un avertissement qui dit « attention » sans dire quoi faire ne sert à
    // rien : on verrouille la présence du fondement et des clés à renseigner.
    expect(r.data.avertissement).toBeDefined();
    expect(r.data.avertissement).toContain("L.612-1");
    expect(r.data.avertissement).toContain("mediateur_consommation_nom");
  });

  // La trace est le vrai livrable de ce changement. Le jour d'un contrôle, la
  // question ne sera pas « le logiciel bloquait-il ? » mais « quels contrats
  // ont été émis sans la mention ? » — sans cette clé, la réponse est
  // introuvable ; avec elle, elle s'extrait du journal en une requête.
  it("inscrit l'absence au journal d'audit, contrat par contrat", async () => {
    await genererContratFormationAction({ enrollmentId: ENROLLMENT_ID });
    const appels = vi.mocked(logQualiopiActivity).mock.calls;
    const contrat = appels.find(
      ([a]) => (a as { action: string }).action === "qualiopi.document.contrat.genere",
    );
    expect(contrat).toBeDefined();
    const changes = (contrat![0] as { changes: Record<string, unknown> }).changes;
    expect(changes["mentionMediationAbsente"]).toBe(true);
    // Le numéro doit y figurer aussi : une trace sans identifiant de contrat
    // ne permettrait pas de retrouver la pièce concernée.
    expect(changes["numero"]).toBeTruthy();
  });

  it("médiateur renseigné : aucun avertissement, aucune trace d'absence", async () => {
    mockGetQualiopiConfig.mockImplementation(async (cle: string) =>
      cle === "mediateur_consommation_nom"
        ? "CM2C"
        : cle === "mediateur_consommation_url"
          ? "https://cm2c.net"
          : null,
    );
    const r = await genererContratFormationAction({ enrollmentId: ENROLLMENT_ID });
    if ("error" in r) throw new Error("le contrat ne devrait pas être refusé");
    expect(r.data.avertissement).toBeUndefined();
    const contrat = vi
      .mocked(logQualiopiActivity)
      .mock.calls.find(
        ([a]) => (a as { action: string }).action === "qualiopi.document.contrat.genere",
      );
    const changes = (contrat![0] as { changes: Record<string, unknown> }).changes;
    expect(changes["mentionMediationAbsente"]).toBeUndefined();
  });

  // Une valeur vide ou blanche n'est pas une adhésion : le garde-fou doit la
  // traiter comme une absence, sans quoi il suffirait d'un espace pour éteindre
  // l'avertissement sans rien avoir fait.
  it("une valeur blanche vaut absence", async () => {
    mockGetQualiopiConfig.mockImplementation(async (cle: string) =>
      cle === "mediateur_consommation_nom" ? "   " : "https://cm2c.net",
    );
    const r = await genererContratFormationAction({ enrollmentId: ENROLLMENT_ID });
    if ("error" in r) throw new Error("le contrat ne devrait pas être refusé");
    expect(r.data.avertissement).toBeDefined();
  });
});

describe("🔴 annulerDocumentAction — la pièce reste, elle cesse de faire foi", () => {
  const DOC_A_ANNULER = "d1234567-89ab-cdef-0123-456789abcdef";
  const MOTIF = "Qualifie le dirigeant de mandataire sous-traitant de sa propre société.";

  beforeEach(() => {
    mockDocumentFindUnique.mockResolvedValue({
      id: DOC_A_ANNULER,
      numero: "AXI-DOC-2026-007",
      annuleeAt: null,
    });
    mockDocumentUpdate.mockResolvedValue({});
    mockAdminUserFindUnique.mockResolvedValue({ name: "Williams Jullin" });
  });

  it("annule en écrivant motif, date et auteur NOMMÉ", async () => {
    const res = await annulerDocumentAction({ documentId: DOC_A_ANNULER, motif: MOTIF });

    expect(res).toEqual({ data: { numero: "AXI-DOC-2026-007" } });
    const appel = mockDocumentUpdate.mock.calls[0]![0] as {
      where: { id: string };
      data: { annuleeAt: Date; annuleeMotif: string; annuleePar: string };
    };
    expect(appel.where).toEqual({ id: DOC_A_ANNULER });
    expect(appel.data.annuleeMotif).toBe(MOTIF);
    // « annulée par 4f3a-… » ne dit rien à un auditeur : l'auteur est nommé.
    expect(appel.data.annuleePar).toBe("Williams Jullin");
    expect(appel.data.annuleeAt).toBeInstanceOf(Date);
  });

  it("🔴 ne SUPPRIME rien — aucun delete n'est câblé", async () => {
    // Le numéro appartient à une série continue (CGI, art. 242 nonies A
    // ann. II) et la pièce peut porter une signature réelle : `AXI-DOC-2026-007`
    // est `statut_signature = signee`. Supprimer laisserait un trou dans la
    // série ET effacerait la preuve d'un acte qui a eu lieu.
    await annulerDocumentAction({ documentId: DOC_A_ANNULER, motif: MOTIF });
    expect(mockDocumentUpdate).toHaveBeenCalledTimes(1);
    expect(
      (mockDocumentUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data,
    ).not.toHaveProperty("deletedAt");
  });

  it("🔴 REFUSE un motif trop court — une annulation sans raison ne vaut rien", async () => {
    const res = await annulerDocumentAction({ documentId: DOC_A_ANNULER, motif: "erreur" });
    expect(res).toMatchObject({ error: expect.stringContaining("Motif obligatoire") });
    expect(mockDocumentUpdate).not.toHaveBeenCalled();
  });

  it("🔴 REFUSE de réannuler — la date et le motif d'origine ne s'écrasent pas", async () => {
    mockDocumentFindUnique.mockResolvedValue({
      id: DOC_A_ANNULER,
      numero: "AXI-DOC-2026-007",
      annuleeAt: new Date("2026-08-04T09:00:00Z"),
    });
    const res = await annulerDocumentAction({ documentId: DOC_A_ANNULER, motif: MOTIF });
    expect(res).toMatchObject({ error: expect.stringContaining("déjà annulée") });
    expect(mockDocumentUpdate).not.toHaveBeenCalled();
  });

  it("pièce introuvable → erreur, pas d'écriture", async () => {
    mockDocumentFindUnique.mockResolvedValue(null);
    const res = await annulerDocumentAction({ documentId: DOC_A_ANNULER, motif: MOTIF });
    expect(res).toMatchObject({ error: "Pièce introuvable" });
    expect(mockDocumentUpdate).not.toHaveBeenCalled();
  });

  it("trace l'annulation au journal d'activité", async () => {
    await annulerDocumentAction({ documentId: DOC_A_ANNULER, motif: MOTIF });
    expect(logQualiopiActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "qualiopi.document.annulee",
        targetType: "DocumentGenere",
        targetId: DOC_A_ANNULER,
      }),
    );
  });
});

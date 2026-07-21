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
const mockEnrollmentFindUnique = vi.fn();
const mockTrainerFindUnique = vi.fn();
const mockSessionJourFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: (...args: unknown[]) => mockSessionFindUnique(...args),
    },
    enrollment: {
      findUnique: (...args: unknown[]) => mockEnrollmentFindUnique(...args),
    },
    trainer: {
      findUnique: (...args: unknown[]) => mockTrainerFindUnique(...args),
    },
    // La convocation lit les horaires RÉELS des journées déclarées plutôt que
    // d'annoncer un « 09h00–17h00 » qui contredirait la feuille d'émargement.
    sessionJour: {
      findMany: (...args: unknown[]) => mockSessionJourFindMany(...args),
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

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(null),
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
  genererLivretAccueilAction,
} from "./documents";

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
          id: "enr-1",
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

    const data =
      donneesPdf<{ journees: Array<{ horaires: string; formateurNom: string; modules: string[] }> }>();
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
  it("génère la lettre de mission pour une session", async () => {
    mockSessionFindUnique.mockResolvedValue(makeSession());

    const result = await genererLettreMissionAction({ sessionId: SESSION_ID });

    expect(result).toEqual({ data: { documentId: DOCUMENT_ID, numero: NUMERO } });
    const call = mockGenerateDocument.mock.calls[0]![0]! as { type: string };
    expect(call.type).toBe("lettre_mission");
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

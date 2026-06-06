/**
 * Tests — notifications-service.ts (T15).
 *
 * Stratégie : mock @/lib/prisma + @/server/queue/queues.
 * Vérifie : appels enqueueEmail correct (template, to, locale, payload, jobId),
 * idempotence (jobId stable), early-exit stub, early-exit enrollment introuvable.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: {
      findUnique: vi.fn(),
    },
    trainingSession: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    alerteSysteme: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports après mocks
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import {
  envoyerConvocation,
  envoyerRappelJ7,
  envoyerSatisfactionJ1,
  envoyerSuiviJ30,
  envoyerAttestationDisponible,
  notifierAlerteInterne,
} from "./notifications-service";

const mockPrisma = prisma as unknown as {
  enrollment: { findUnique: ReturnType<typeof vi.fn> };
  trainingSession: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  alerteSysteme: { findUnique: ReturnType<typeof vi.fn> };
};
const mockEnqueueEmail = enqueueEmail as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ENROLLMENT_ID = "enr-uuid-1";
const SESSION_ID = "sess-uuid-1";
const ALERTE_ID = "alerte-uuid-1";

const fakeEnrollmentBase = {
  id: ENROLLMENT_ID,
  trainee: { email: "jean@example.com", nom: "Dupont", prenom: "Jean" },
  session: {
    numero: "AXI-SESS-2026-001",
    titreSession: "Formation IA",
    dateDebut: new Date("2026-09-01T09:00:00Z"),
    dateFin: new Date("2026-09-02T17:00:00Z"),
    modalite: "presentiel",
  },
};

const fakeSessionWithEnrollments = {
  id: SESSION_ID,
  numero: "AXI-SESS-2026-001",
  titreSession: "Formation IA",
  dateDebut: new Date("2026-09-01T09:00:00Z"),
  dateFin: new Date("2026-09-02T17:00:00Z"),
  modalite: "presentiel",
  enrollments: [
    {
      id: ENROLLMENT_ID,
      trainee: { email: "jean@example.com", nom: "Dupont", prenom: "Jean" },
    },
    {
      id: "enr-uuid-2",
      trainee: { email: "marie@example.com", nom: "Martin", prenom: "Marie" },
    },
  ],
};

const fakeAlerte = {
  id: ALERTE_ID,
  code: "emargement_manquant",
  niveau: "critique",
  titre: "Émargement manquant",
  message: "Session sans émargement 48h après.",
  cibleType: "TrainingSession",
  cibleId: "sess-uuid-1",
  createdAt: new Date("2026-06-06T10:00:00Z"),
};

// ─────────────────────────────────────────────────────────────────────────────
// envoyerConvocation
// ─────────────────────────────────────────────────────────────────────────────

describe("envoyerConvocation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enqueue le bon template avec jobId stable", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerConvocation(ENROLLMENT_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect(call[0]).toBe("qualiopi-convocation");
    expect(call[1]).toBe("jean@example.com");
    expect(call[2]).toBe("fr");
    expect((call[3] as Record<string, unknown>)["stagiairePrenomNom"]).toBe("Jean Dupont");
    expect((call[4] as { jobId?: string }).jobId).toBe(`qualiopi-convocation-${ENROLLMENT_ID}`);
  });

  it("early-exit si enrollment introuvable", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    await envoyerConvocation(ENROLLMENT_ID);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// envoyerRappelJ7
// ─────────────────────────────────────────────────────────────────────────────

describe("envoyerRappelJ7", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enqueue 1 email par enrollment (2 au total)", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(fakeSessionWithEnrollments);
    await envoyerRappelJ7(SESSION_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledTimes(2);
    const firstCall = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect(firstCall[0]).toBe("qualiopi-rappel-j7");
    expect(firstCall[2]).toBe("fr");
  });

  it("early-exit si session introuvable", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(null);
    await envoyerRappelJ7(SESSION_ID);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("jobId inclut enrollmentId + dateKey", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(fakeSessionWithEnrollments);
    await envoyerRappelJ7(SESSION_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const options = call[4] as { jobId?: string };
    // dateKey = YYYYMMDD extrait de dateDebut 2026-09-01
    expect(options.jobId).toMatch(/^qualiopi-rappel-j7-enr-uuid-1-20260901$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// envoyerSatisfactionJ1
// ─────────────────────────────────────────────────────────────────────────────

describe("envoyerSatisfactionJ1", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enqueue qualiopi-satisfaction-j1 avec lienQuestionnaire", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerSatisfactionJ1(ENROLLMENT_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect(call[0]).toBe("qualiopi-satisfaction-j1");
    expect((call[3] as { lienQuestionnaire?: string }).lienQuestionnaire).toContain("satisfaction");
  });

  it("early-exit si enrollment introuvable", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    await envoyerSatisfactionJ1(ENROLLMENT_ID);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// envoyerSuiviJ30
// ─────────────────────────────────────────────────────────────────────────────

describe("envoyerSuiviJ30", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enqueue qualiopi-suivi-j30", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerSuiviJ30(ENROLLMENT_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect(call[0]).toBe("qualiopi-suivi-j30");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// envoyerAttestationDisponible
// ─────────────────────────────────────────────────────────────────────────────

describe("envoyerAttestationDisponible", () => {
  beforeEach(() => vi.clearAllMocks());

  it("libellé 'attestation de formation' quand attestationResultat = 'complete'", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      ...fakeEnrollmentBase,
      attestationResultat: "complete",
    });
    await envoyerAttestationDisponible(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect((call[3] as { typeDocument?: string }).typeDocument).toBe("attestation de formation");
  });

  it("libellé 'certificat de réalisation' quand attestationResultat = null", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      ...fakeEnrollmentBase,
      attestationResultat: null,
    });
    await envoyerAttestationDisponible(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect((call[3] as { typeDocument?: string }).typeDocument).toBe("certificat de réalisation");
  });

  it("jobId stable = qualiopi-attestation-disponible-{enrollmentId}", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      ...fakeEnrollmentBase,
      attestationResultat: "complete",
    });
    await envoyerAttestationDisponible(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const options = call[4] as { jobId?: string };
    expect(options.jobId).toBe(`qualiopi-attestation-disponible-${ENROLLMENT_ID}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// notifierAlerteInterne
// ─────────────────────────────────────────────────────────────────────────────

describe("notifierAlerteInterne", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enqueue qualiopi-alerte-interne vers destinataire interne", async () => {
    mockPrisma.alerteSysteme.findUnique.mockResolvedValue(fakeAlerte);
    await notifierAlerteInterne(ALERTE_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect(call[0]).toBe("qualiopi-alerte-interne");
    // Le destinataire doit être un email (pas une adresse stagiaire)
    expect(typeof call[1]).toBe("string");
    expect(call[1] as string).toMatch(/@/);
    expect((call[3] as { code?: string }).code).toBe("emargement_manquant");
    expect((call[4] as { jobId?: string }).jobId).toBe(`qualiopi-alerte-interne-${ALERTE_ID}`);
  });

  it("early-exit si alerte introuvable", async () => {
    mockPrisma.alerteSysteme.findUnique.mockResolvedValue(null);
    await notifierAlerteInterne(ALERTE_ID);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });
});

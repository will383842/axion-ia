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
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    portailAcces: {
      findFirst: vi.fn(),
    },
    emargementToken: {
      findFirst: vi.fn(),
    },
  },
}));

// Jeton d'émargement du rappel J-7 — créé seulement si aucun jeton vivant.
vi.mock("@/server/qualiopi/emargement/token-service", () => ({
  creerTokenInscription: vi.fn().mockResolvedValue({
    token: "e".repeat(80),
    tokenId: "tok-uuid-1",
    expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
  }),
}));

// Mock portail-service.creerAcces (fall-through quand portailAcces.findFirst retourne null)
vi.mock("@/server/qualiopi/portail/portail-service", () => ({
  creerAcces: vi.fn().mockResolvedValue({
    id: "acces-uuid-1",
    token: "b".repeat(64),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  }),
}));

vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn().mockResolvedValue({ enqueued: true }),
}));

vi.mock("@/server/qualiopi/satisfaction/satisfaction-service", () => ({
  creerQuestionnaire: vi.fn().mockResolvedValue({ id: "quest-uuid-1", token: "c".repeat(48) }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports après mocks
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { creerAcces } from "@/server/qualiopi/portail/portail-service";
import { creerTokenInscription } from "@/server/qualiopi/emargement/token-service";
import { creerQuestionnaire } from "@/server/qualiopi/satisfaction/satisfaction-service";
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
  alerteSysteme: {
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  portailAcces: { findFirst: ReturnType<typeof vi.fn> };
  emargementToken: { findFirst: ReturnType<typeof vi.fn> };
};
const mockEnqueueEmail = enqueueEmail as ReturnType<typeof vi.fn>;
const mockCreerAcces = creerAcces as ReturnType<typeof vi.fn>;
const mockCreerQuestionnaire = creerQuestionnaire as ReturnType<typeof vi.fn>;
const mockCreerTokenInscription = creerTokenInscription as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ENROLLMENT_ID = "enr-uuid-1";
const SESSION_ID = "sess-uuid-1";
const ALERTE_ID = "alerte-uuid-1";

const TRAINEE_ID = "trainee-uuid-1";
const FAKE_TOKEN = "a".repeat(64);

const fakeEnrollmentBase = {
  id: ENROLLMENT_ID,
  trainee: { id: TRAINEE_ID, email: "jean@example.com", nom: "Dupont", prenom: "Jean" },
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
      trainee: { id: TRAINEE_ID, email: "jean@example.com", nom: "Dupont", prenom: "Jean" },
    },
    {
      id: "enr-uuid-2",
      trainee: { id: "trainee-uuid-2", email: "marie@example.com", nom: "Martin", prenom: "Marie" },
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
  beforeEach(() => {
    vi.clearAllMocks();
    // Par défaut : accès portail existant (idempotent)
    mockPrisma.portailAcces.findFirst.mockResolvedValue({ token: FAKE_TOKEN });
  });

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

  it("lienPortail contient /portail/acces/ (pas /espace-stagiaire)", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerConvocation(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lienPortail = (call[3] as Record<string, unknown>)["lienPortail"] as string;
    expect(lienPortail).toContain("/portail/acces/");
    expect(lienPortail).not.toContain("/espace-stagiaire");
  });

  it("lienPortail utilise creerAcces en fail-soft si findFirst retourne null", async () => {
    mockPrisma.portailAcces.findFirst.mockResolvedValue(null);
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerConvocation(ENROLLMENT_ID);
    expect(mockCreerAcces).toHaveBeenCalledWith(TRAINEE_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lienPortail = (call[3] as Record<string, unknown>)["lienPortail"] as string;
    expect(lienPortail).toContain("/portail/acces/");
  });

  it("early-exit si enrollment introuvable", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    await envoyerConvocation(ENROLLMENT_ID);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("formate le lieu réel quand la session a un lieu renseigné", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      ...fakeEnrollmentBase,
      session: {
        ...fakeEnrollmentBase.session,
        lieuType: "nos_locaux",
        lieuVille: "Grenoble",
      },
    });
    await envoyerConvocation(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lieu = (call[3] as Record<string, unknown>)["lieu"] as string;
    expect(lieu).toContain("Nos locaux");
    expect(lieu).toContain("Grenoble");
  });

  it("retombe sur « Voir convocation » quand aucun lieu n'est renseigné", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerConvocation(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect((call[3] as Record<string, unknown>)["lieu"]).toBe("Voir convocation");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// envoyerRappelJ7
// ─────────────────────────────────────────────────────────────────────────────

describe("envoyerRappelJ7", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.portailAcces.findFirst.mockResolvedValue({ token: FAKE_TOKEN });
    // Par défaut : aucun jeton d'émargement vivant → le rappel crée et inclut le lien.
    mockPrisma.emargementToken.findFirst.mockResolvedValue(null);
    mockCreerTokenInscription.mockResolvedValue({
      token: "e".repeat(80),
      tokenId: "tok-uuid-1",
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });
  });

  it("aucun jeton vivant → le payload porte le lien d'émargement personnel", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(fakeSessionWithEnrollments);
    await envoyerRappelJ7(SESSION_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lien = (call[3] as Record<string, unknown>)["lienEmargement"] as string;
    expect(lien).toContain("/fr/portail/emarger/");
    expect(lien).toContain("e".repeat(80));
  });

  // 🔴 Le cœur de la sémantique : un jeton ne se relit pas (hash seul) et toute
  // création révoque le précédent. Créer aveuglément tuerait un lien déjà
  // distribué par la console — le stagiaire cliquerait un lien mort le jour J.
  it("jeton vivant existant → PAS de création (le lien distribué reste le seul valide)", async () => {
    mockPrisma.emargementToken.findFirst.mockResolvedValue({ id: "tok-existant" });
    mockPrisma.trainingSession.findUnique.mockResolvedValue(fakeSessionWithEnrollments);
    await envoyerRappelJ7(SESSION_ID);
    expect(mockCreerTokenInscription).not.toHaveBeenCalled();
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect((call[3] as Record<string, unknown>)["lienEmargement"]).toBeUndefined();
  });

  // Fail-soft : journées non confirmées (TokenEmargementError) → le rappel J-7
  // part SANS lien plutôt que de ne pas partir. Retenir un rappel casserait
  // l'obligation d'information ; la console signale déjà le problème à l'admin.
  it("création de jeton en échec → l'e-mail part quand même, sans lien", async () => {
    mockCreerTokenInscription.mockRejectedValue(new Error("horaires_non_confirmes"));
    mockPrisma.trainingSession.findUnique.mockResolvedValue(fakeSessionWithEnrollments);
    await envoyerRappelJ7(SESSION_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledTimes(2);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect((call[3] as Record<string, unknown>)["lienEmargement"]).toBeUndefined();
    // Le reste du payload est intact — le lien portail notamment.
    expect((call[3] as Record<string, unknown>)["lienPortail"]).toContain("/portail/acces/");
  });

  it("enqueue 1 email par enrollment (2 au total)", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(fakeSessionWithEnrollments);
    await envoyerRappelJ7(SESSION_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledTimes(2);
    const firstCall = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect(firstCall[0]).toBe("qualiopi-rappel-j7");
    expect(firstCall[2]).toBe("fr");
  });

  it("lienPortail contient /portail/acces/ (pas /espace-stagiaire)", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(fakeSessionWithEnrollments);
    await envoyerRappelJ7(SESSION_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lienPortail = (call[3] as Record<string, unknown>)["lienPortail"] as string;
    expect(lienPortail).toContain("/portail/acces/");
    expect(lienPortail).not.toContain("/espace-stagiaire");
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

  it("formate le lieu réel dans le rappel quand renseigné", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue({
      ...fakeSessionWithEnrollments,
      lieuType: "distanciel",
      lieuVisioUrl: "https://meet.google.com/abc-defg-hij",
    });
    await envoyerRappelJ7(SESSION_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lieu = (call[3] as Record<string, unknown>)["lieu"] as string;
    expect(lieu).toContain("Distanciel");
    expect(lieu).toContain("meet.google.com");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// envoyerSatisfactionJ1
// ─────────────────────────────────────────────────────────────────────────────

describe("envoyerSatisfactionJ1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.portailAcces.findFirst.mockResolvedValue({ token: FAKE_TOKEN });
  });

  it("enqueue qualiopi-satisfaction-j1 avec lienQuestionnaire tokenisé", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerSatisfactionJ1(ENROLLMENT_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect(call[0]).toBe("qualiopi-satisfaction-j1");
    const lienQuestionnaire = (call[3] as { lienQuestionnaire?: string }).lienQuestionnaire;
    expect(lienQuestionnaire).toContain("/portail/acces/");
    expect(lienQuestionnaire).not.toContain("/espace-stagiaire");
  });

  it("early-exit si enrollment introuvable", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    await envoyerSatisfactionJ1(ENROLLMENT_ID);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("garantit le questionnaire satisfaction_chaud AVANT l'email (jamais de portail vide)", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerSatisfactionJ1(ENROLLMENT_ID);
    expect(mockCreerQuestionnaire).toHaveBeenCalledWith({
      enrollmentId: ENROLLMENT_ID,
      type: "satisfaction_chaud",
    });
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    // Le questionnaire est créé avant l'enqueue (ordre des invocations).
    const ordreQuestionnaire = mockCreerQuestionnaire.mock.invocationCallOrder[0] ?? Infinity;
    const ordreEmail = mockEnqueueEmail.mock.invocationCallOrder[0] ?? 0;
    expect(ordreQuestionnaire).toBeLessThan(ordreEmail);
  });

  it("n'envoie PAS l'email si la création du questionnaire échoue", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    mockCreerQuestionnaire.mockRejectedValueOnce(new Error("DB down"));
    await expect(envoyerSatisfactionJ1(ENROLLMENT_ID)).rejects.toThrow("DB down");
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// envoyerSuiviJ30
// ─────────────────────────────────────────────────────────────────────────────

describe("envoyerSuiviJ30", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.portailAcces.findFirst.mockResolvedValue({ token: FAKE_TOKEN });
  });

  it("enqueue qualiopi-suivi-j30", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerSuiviJ30(ENROLLMENT_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    expect(call[0]).toBe("qualiopi-suivi-j30");
  });

  it("lienPortail contient /portail/acces/ (pas /espace-stagiaire)", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerSuiviJ30(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lienPortail = (call[3] as Record<string, unknown>)["lienPortail"] as string;
    expect(lienPortail).toContain("/portail/acces/");
    expect(lienPortail).not.toContain("/espace-stagiaire");
  });

  it("garantit le questionnaire satisfaction_froid AVANT l'email", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    await envoyerSuiviJ30(ENROLLMENT_ID);
    expect(mockCreerQuestionnaire).toHaveBeenCalledWith({
      enrollmentId: ENROLLMENT_ID,
      type: "satisfaction_froid",
    });
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
  });

  it("n'envoie PAS l'email si la création du questionnaire échoue", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(fakeEnrollmentBase);
    mockCreerQuestionnaire.mockRejectedValueOnce(new Error("DB down"));
    await expect(envoyerSuiviJ30(ENROLLMENT_ID)).rejects.toThrow("DB down");
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// envoyerAttestationDisponible
// ─────────────────────────────────────────────────────────────────────────────

describe("envoyerAttestationDisponible", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.portailAcces.findFirst.mockResolvedValue({ token: FAKE_TOKEN });
  });

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

  it("lienPortail contient /portail/acces/ (pas /espace-stagiaire)", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      ...fakeEnrollmentBase,
      attestationResultat: "complete",
    });
    await envoyerAttestationDisponible(ENROLLMENT_ID);
    const call = mockEnqueueEmail.mock.calls[0] as unknown[];
    const lienPortail = (call[3] as Record<string, unknown>)["lienPortail"] as string;
    expect(lienPortail).toContain("/portail/acces/");
    expect(lienPortail).not.toContain("/espace-stagiaire");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// notifierAlerteInterne
// ─────────────────────────────────────────────────────────────────────────────

describe("notifierAlerteInterne", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Par défaut : claim atomique réussi (count=1) + enqueue OK.
    mockPrisma.alerteSysteme.updateMany.mockResolvedValue({ count: 1 });
    mockEnqueueEmail.mockResolvedValue({ enqueued: true });
  });

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

  it("pose le claim atomique (notifiedAt) AVANT d'enqueuer, gardé sur non-notifiée", async () => {
    mockPrisma.alerteSysteme.findUnique.mockResolvedValue(fakeAlerte);
    await notifierAlerteInterne(ALERTE_ID);
    expect(mockPrisma.alerteSysteme.updateMany).toHaveBeenCalledOnce();
    const claimArgs = mockPrisma.alerteSysteme.updateMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(claimArgs.where).toMatchObject({ id: ALERTE_ID, notifiedAt: null, resolue: false });
    expect(claimArgs.data["notifiedAt"]).toBeInstanceOf(Date);
    // Le claim précède l'enqueue (ordre des invocations).
    const ordreClaim = mockPrisma.alerteSysteme.updateMany.mock.invocationCallOrder[0] ?? Infinity;
    const ordreEmail = mockEnqueueEmail.mock.invocationCallOrder[0] ?? 0;
    expect(ordreClaim).toBeLessThan(ordreEmail);
  });

  it("skip (pas d'email) si le claim retourne count=0 — alerte déjà notifiée", async () => {
    mockPrisma.alerteSysteme.updateMany.mockResolvedValue({ count: 0 });
    await notifierAlerteInterne(ALERTE_ID);
    // Court-circuit : ni lecture de l'alerte ni enqueue.
    expect(mockPrisma.alerteSysteme.findUnique).not.toHaveBeenCalled();
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("libère le verrou (notifiedAt=null) si l'enqueue échoue (enqueued=false)", async () => {
    mockPrisma.alerteSysteme.findUnique.mockResolvedValue(fakeAlerte);
    mockEnqueueEmail.mockResolvedValue({ enqueued: false });
    await notifierAlerteInterne(ALERTE_ID);
    expect(mockEnqueueEmail).toHaveBeenCalledOnce();
    // Fail-soft : pas de "notifiée sans email" → reset pour re-tenter au prochain cron.
    expect(mockPrisma.alerteSysteme.update).toHaveBeenCalledOnce();
    const resetArgs = mockPrisma.alerteSysteme.update.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(resetArgs.where).toMatchObject({ id: ALERTE_ID });
    expect(resetArgs.data).toMatchObject({ notifiedAt: null });
  });

  it("ne libère PAS le verrou quand l'enqueue réussit (enqueued=true)", async () => {
    mockPrisma.alerteSysteme.findUnique.mockResolvedValue(fakeAlerte);
    await notifierAlerteInterne(ALERTE_ID);
    expect(mockPrisma.alerteSysteme.update).not.toHaveBeenCalled();
  });

  it("early-exit si alerte introuvable", async () => {
    mockPrisma.alerteSysteme.findUnique.mockResolvedValue(null);
    await notifierAlerteInterne(ALERTE_ID);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("libère le verrou ET propage si l'enqueue THROW (Redis transitoire)", async () => {
    mockPrisma.alerteSysteme.findUnique.mockResolvedValue(fakeAlerte);
    mockEnqueueEmail.mockRejectedValue(new Error("Redis connection lost"));
    // L'exception remonte (handleAlertes la catch/log), mais le verrou est libéré
    // pour re-tenter au prochain cron (sinon "notifiée" sans email parti).
    await expect(notifierAlerteInterne(ALERTE_ID)).rejects.toThrow("Redis connection lost");
    expect(mockPrisma.alerteSysteme.update).toHaveBeenCalledOnce();
    const resetArgs = mockPrisma.alerteSysteme.update.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(resetArgs.where).toMatchObject({ id: ALERTE_ID });
    expect(resetArgs.data).toMatchObject({ notifiedAt: null });
  });
});

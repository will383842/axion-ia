/**
 * Tests — handleDateDebut (formation-crons-worker) : garde financement.
 *
 * Vérifie que le cron date-debut ne passe PAS en_cours une session
 * dont les validations financement retournent au moins une entrée critique,
 * et qu'il laisse passer les sessions sans alerte critique.
 *
 * On exporte `formationCronsHandler` pour tester directement le handler.
 * On mock tout sauf la logique de décision financement.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    enrollment: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const mockGetFinancementValidations = vi.fn();

vi.mock("@/server/qualiopi/financements/validation-service", () => ({
  getFinancementValidations: (...args: unknown[]) => mockGetFinancementValidations(...args),
}));

vi.mock("@/server/qualiopi/formations/state-machine", () => ({
  assertSessionTransition: vi.fn(),
}));

vi.mock("@/server/qualiopi/formations/transition-helper", () => ({
  writeSessionTransition: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/formations/crons", () => ({
  decideSessionTransitions: vi
    .fn()
    .mockImplementation(
      (snapshots: Array<{ id: string; statut: string; dateDebut: Date; dateFin: Date }>) =>
        snapshots
          .filter((s) => s.statut === "planifiee")
          .map((s) => ({ sessionId: s.id, from: "planifiee" as const, to: "en_cours" as const })),
    ),
}));

vi.mock("@/server/qualiopi/evaluations/attestation-service", () => ({
  genererAttestationPourEnrollment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/indicateurs/service", () => ({
  invalidateIndicateursCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/notifications/notifications-service", () => ({
  envoyerConvocation: vi.fn().mockResolvedValue(undefined),
  envoyerRappelJ7: vi.fn().mockResolvedValue(undefined),
  envoyerSatisfactionJ1: vi.fn().mockResolvedValue(undefined),
  envoyerSuiviJ30: vi.fn().mockResolvedValue(undefined),
}));

// Cycle de vie du formateur (2026-09-03) : ces deux services importent la
// file d'e-mails au chargement, comme `notifications-service` — même
// isolement, sinon ce test rencontre un `bullmq` mocké sans `Queue`.
vi.mock("@/server/qualiopi/trainers/mission-formateur", () => ({
  relancerEtExpirerMissions: vi.fn().mockResolvedValue({ relancees: 0, erreurs: 0, expirees: 0 }),
}));
vi.mock("@/server/qualiopi/trainers/convocation-formateur", () => ({
  envoyerConvocationJ7Formateur: vi.fn().mockResolvedValue(true),
  envoyerRappelJ1Formateur: vi.fn().mockResolvedValue(true),
  FENETRE_CONVOCATION_J7_JOURS: 7.5,
  FENETRE_RAPPEL_J1_HEURES: 36,
}));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  synchroniserAlertes: vi.fn().mockResolvedValue({ crees: 0, resolues: 0 }),
}));

// Lot 14 — la notification des alertes a quitté le cron pour `envoi-groupe`.
// 🔴 Sans ce mock, la suite ne se CHARGE plus : `envoi-groupe` importe
// `@/server/queue/queues`, qui instancie une vraie `Queue` BullMQ au premier
// import. Le mock de `notifications-service` masquait jusqu'ici cet import
// transitif. Ce fichier ne teste pas les alertes — il teste le financement —
// mais il monte le worker entier, donc il paie tous ses imports.
vi.mock("@/server/qualiopi/alertes/envoi-groupe", () => ({
  notifierAlertesGroupees: vi
    .fn()
    .mockResolvedValue({ messages: 0, alertes: 0, sansGuichet: 0, replis: [] }),
}));

vi.mock("../connection", () => ({
  getBullConnectionOrThrow: vi.fn().mockReturnValue({}),
}));

vi.mock("@/server/queue/lib/sentry-worker", () => ({
  captureWorkerError: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { formationCronsHandler } from "../qualiopi-formation-crons-worker";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const NOW = new Date("2026-06-06T08:00:00.000Z");

function makeCandidate(id: string) {
  return {
    id,
    statut: "planifiee",
    dateDebut: new Date(NOW.getTime() - 60_000), // passée de 1 min
    dateFin: new Date(NOW.getTime() + 3_600_000),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("handleDateDebut — garde financement (cron)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        trainingSession: { update: vi.fn().mockResolvedValue(undefined) },
        formationTransition: { create: vi.fn().mockResolvedValue(undefined) },
      });
    });
  });

  it("ne passe pas en_cours une session avec alerte financement critique", async () => {
    const candidate = makeCandidate("sess-opco-critique");
    mockFindMany.mockResolvedValue([candidate]);
    mockGetFinancementValidations.mockResolvedValue([
      {
        code: "opco_accord",
        result: {
          ok: false,
          gravite: "critique",
          alerte: "Accord OPCO non reçu — JAMAIS commencer avant accord écrit.",
        },
      },
    ]);

    await formationCronsHandler({
      type: "formation-crons.date-debut",
      tick: "2026-06-06T08:00:00Z",
    });

    // La transaction de transition ne doit PAS avoir été appelée
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("ne passe pas en_cours si plusieurs alertes critiques", async () => {
    const candidate = makeCandidate("sess-multi-critique");
    mockFindMany.mockResolvedValue([candidate]);
    mockGetFinancementValidations.mockResolvedValue([
      { code: "opco_accord", result: { ok: false, gravite: "critique", alerte: "OPCO manquant." } },
      { code: "cpf_edof", result: { ok: false, gravite: "critique", alerte: "EDOF manquant." } },
    ]);

    await formationCronsHandler({
      type: "formation-crons.date-debut",
      tick: "2026-06-06T08:00:00Z",
    });

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("passe en_cours une session dont les validations sont toutes ok", async () => {
    const candidate = makeCandidate("sess-ok");
    mockFindMany.mockResolvedValue([candidate]);
    mockGetFinancementValidations.mockResolvedValue([
      { code: "opco_accord", result: { ok: true } },
      { code: "cpf_edof", result: { ok: true } },
      { code: "cpf_eligibilite", result: { ok: true } },
      { code: "france_travail", result: { ok: true } },
    ]);

    await formationCronsHandler({
      type: "formation-crons.date-debut",
      tick: "2026-06-06T08:00:00Z",
    });

    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("passe en_cours si seulement un avertissement (warning, non bloquant)", async () => {
    const candidate = makeCandidate("sess-warning");
    mockFindMany.mockResolvedValue([candidate]);
    mockGetFinancementValidations.mockResolvedValue([
      {
        code: "france_travail",
        result: { ok: false, gravite: "warning", alerte: "AIF prescription manquante." },
      },
    ]);

    await formationCronsHandler({
      type: "formation-crons.date-debut",
      tick: "2026-06-06T08:00:00Z",
    });

    // Warning ne bloque pas
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("fail-soft : skip la session si getFinancementValidations lève (pas d'autres sessions impactées)", async () => {
    const c1 = makeCandidate("sess-erreur");
    const c2 = makeCandidate("sess-ok-2");
    mockFindMany.mockResolvedValue([c1, c2]);

    // c1 : erreur DB
    // c2 : ok
    mockGetFinancementValidations
      .mockRejectedValueOnce(new Error("DB timeout"))
      .mockResolvedValueOnce([{ code: "opco_accord", result: { ok: true } }]);

    await formationCronsHandler({
      type: "formation-crons.date-debut",
      tick: "2026-06-06T08:00:00Z",
    });

    // Seule c2 a été transitionée
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("ne lance pas getFinancementValidations si aucun candidat", async () => {
    mockFindMany.mockResolvedValue([]);

    await formationCronsHandler({
      type: "formation-crons.date-debut",
      tick: "2026-06-06T08:00:00Z",
    });

    expect(mockGetFinancementValidations).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

/**
 * Reprise du retard — drain des échecs et déblocage des jobs figés.
 *
 * Enjeu protégé par ces tests : un slot de campagne est consommé À VIE (le
 * compteur ne redescend jamais, l'orchestrateur ne repasse jamais sur un slot
 * servi). Sans reprise, les ~1 340 échecs d'infrastructure de juillet ne seraient
 * JAMAIS régénérés, même une fois le crédit rechargé. Et une reprise mal bornée
 * viderait ce crédit en quelques minutes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();
const countMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentGenJob: {
      findMany: (args: unknown) => findManyMock(args),
      count: (args: unknown) => countMock(args),
      update: (args: unknown) => updateMock(args),
    },
  },
}));

import {
  DEFAULT_RECOVERY_SETTINGS,
  drainFailedJobs,
  requeueContentGenJob,
  sweepStrandedQualityJobs,
} from "../backlog-recovery";

/** File BullMQ simulée, avec l'état renvoyé par `getState()`. */
function makeQueue(existingState: string | null = null) {
  const removeMock = vi.fn().mockResolvedValue(undefined);
  const addMock = vi.fn().mockResolvedValue({ id: "bull-1" });
  const getJobMock = vi.fn().mockResolvedValue(
    existingState === null
      ? null
      : { getState: vi.fn().mockResolvedValue(existingState), remove: removeMock },
  );
  return {
    queue: { getJob: getJobMock, add: addMock } as never,
    addMock,
    removeMock,
    getJobMock,
  };
}

function failedJob(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "job-1",
    contentType: "blog_article",
    targetSearchIntent: "informational",
    inputPayload: { slotIndex: 7 },
    retryCount: 0,
    errorMessage: "OpenAI rate limited",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMock.mockResolvedValue({});
  countMock.mockResolvedValue(0);
});

describe("requeueContentGenJob", () => {
  it("supprime la clé d'un job terminé avant de ré-enfiler", async () => {
    // Sans ce remove, BullMQ ignore SILENCIEUSEMENT le `add` (la clé existe
    // encore : les jobs terminés sont conservés 30 jours) et fabrique un zombie —
    // statut `queued` en base, absent de Redis, jamais traité.
    const { queue, addMock, removeMock } = makeQueue("failed");

    const ok = await requeueContentGenJob(queue, failedJob());

    expect(ok).toBe(true);
    expect(removeMock).toHaveBeenCalledOnce();
    expect(addMock).toHaveBeenCalledOnce();
    expect(addMock.mock.calls[0]?.[2]).toEqual({ jobId: "gen-job-1" });
  });

  it("ne touche PAS à un job encore en vol", async () => {
    const { queue, addMock, removeMock } = makeQueue("active");

    const ok = await requeueContentGenJob(queue, failedJob());

    expect(ok).toBe(false);
    expect(removeMock).not.toHaveBeenCalled();
    expect(addMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("réutilise la LIGNE existante et incrémente le compteur de tentatives", async () => {
    // Point capital : on ne crée aucun job. Le slot de campagne, le contenu et
    // l'identifiant sont préservés — rien n'est perdu ni redécompté.
    const { queue } = makeQueue(null);

    await requeueContentGenJob(queue, failedJob());

    const arg = updateMock.mock.calls[0]?.[0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: "job-1" });
    expect(arg.data.status).toBe("queued");
    expect(arg.data.retryCount).toEqual({ increment: 1 });
    expect(arg.data.errorMessage).toBeNull();
  });
});

describe("drainFailedJobs", () => {
  it("ne relance que les échecs d'infrastructure, jamais ceux de génération", async () => {
    const { queue, addMock } = makeQueue(null);
    findManyMock.mockResolvedValue([
      failedJob({ id: "a", errorMessage: "OpenAI rate limited" }),
      failedJob({ id: "b", errorMessage: "blog-article: plan invalide après 2 tentatives" }),
      failedJob({ id: "c", errorMessage: "Circuit breaker open for openai" }),
      failedJob({ id: "d", errorMessage: "aucun output valide après quality loop" }),
    ]);

    const outcome = await drainFailedJobs(queue, DEFAULT_RECOVERY_SETTINGS);

    expect(outcome.requeued).toBe(2);
    expect(outcome.skipped).toBe(2);
    expect(addMock).toHaveBeenCalledTimes(2);
  });

  it("respecte le plafond par tick", async () => {
    const { queue, addMock } = makeQueue(null);
    findManyMock.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => failedJob({ id: `job-${i}` })),
    );

    const outcome = await drainFailedJobs(queue, { ...DEFAULT_RECOVERY_SETTINGS, maxPerTick: 3 });

    expect(outcome.requeued).toBe(3);
    expect(addMock).toHaveBeenCalledTimes(3);
  });

  it("s'arrête net quand le plafond quotidien est déjà consommé", async () => {
    // Garde-fou de dépense : sans elle, une remise de crédit se ferait engloutir
    // par 1 500 relances lancées en quelques minutes.
    const { queue, addMock } = makeQueue(null);
    countMock.mockResolvedValue(40);
    findManyMock.mockResolvedValue([failedJob()]);

    const outcome = await drainFailedJobs(queue, {
      ...DEFAULT_RECOVERY_SETTINGS,
      maxPerDay: 40,
    });

    expect(outcome.requeued).toBe(0);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("ne fait rien quand la reprise est désactivée", async () => {
    const { queue } = makeQueue(null);

    const outcome = await drainFailedJobs(queue, { ...DEFAULT_RECOVERY_SETTINGS, enabled: false });

    expect(outcome.requeued).toBe(0);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("un job en erreur n'empêche pas les suivants d'être repris", async () => {
    // Leçon du correctif `retryAllFailed` : une exception au job k laissait
    // k+1..N zombies.
    const { queue, addMock } = makeQueue(null);
    addMock.mockRejectedValueOnce(new Error("Redis indisponible"));
    findManyMock.mockResolvedValue([
      failedJob({ id: "a" }),
      failedJob({ id: "b" }),
      failedJob({ id: "c" }),
    ]);

    const outcome = await drainFailedJobs(queue, DEFAULT_RECOVERY_SETTINGS);

    expect(outcome.requeued).toBe(2);
    expect(outcome.skipped).toBe(1);
  });

  it("ne reprend jamais un job qui a épuisé son budget de tentatives", async () => {
    const { queue } = makeQueue(null);
    findManyMock.mockResolvedValue([failedJob({ retryCount: 3 })]);

    const outcome = await drainFailedJobs(queue, DEFAULT_RECOVERY_SETTINGS);

    expect(outcome.requeued).toBe(0);
  });
});

describe("sweepStrandedQualityJobs", () => {
  it("réinjecte dans la boucle qualité avec une clé propre à la tentative", async () => {
    // Le jobId FIXE `quality-<id>` est précisément ce qui a figé 56 jobs depuis
    // le 20/07 : BullMQ ignorait le second `add`. La clé doit donc varier.
    const { queue, addMock } = makeQueue("completed");
    findManyMock.mockResolvedValue([
      { id: "job-9", qualityScore: 72, qualityImprovementAttempts: 1 },
    ]);

    const outcome = await sweepStrandedQualityJobs(queue, DEFAULT_RECOVERY_SETTINGS);

    expect(outcome.requeued).toBe(1);
    expect(addMock.mock.calls[0]?.[1]).toEqual({ contentGenJobId: "job-9", previousScore: 72 });
    expect(addMock.mock.calls[0]?.[2]).toEqual({ jobId: "quality-job-9-a1" });
  });

  it("ne double jamais une évaluation déjà en cours", async () => {
    const { queue, addMock } = makeQueue("active");
    findManyMock.mockResolvedValue([
      { id: "job-9", qualityScore: 72, qualityImprovementAttempts: 1 },
    ]);

    const outcome = await sweepStrandedQualityJobs(queue, DEFAULT_RECOVERY_SETTINGS);

    expect(outcome.requeued).toBe(0);
    expect(addMock).not.toHaveBeenCalled();
  });
});

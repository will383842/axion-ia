/**
 * Plafond quotidien GLOBAL — budget partagé entre reprise et production neuve.
 *
 * Décision Will du 2026-08-15 : le plafond porte sur le TOTAL de contenus payés
 * dans une journée, pas sur chaque canal séparément. Avant ce changement, la
 * reprise du retard (40/jour) et la production neuve (20/jour) avaient chacune
 * leur budget et s'additionnaient donc à 60/jour.
 *
 * Ces tests verrouillent le mécanisme côté reprise : quand l'orchestrateur lui
 * impose un budget, elle ne peut pas le dépasser, quels que soient ses propres
 * réglages.
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

import { DEFAULT_RECOVERY_SETTINGS, drainFailedJobs, sweepStuckJobs } from "../backlog-recovery";

function makeQueue() {
  const addMock = vi.fn().mockResolvedValue({ id: "bull-1" });
  const getJobMock = vi.fn().mockResolvedValue(null);
  return { queue: { getJob: getJobMock, add: addMock } as never, addMock };
}

function failedJob(id: string) {
  return {
    id,
    contentType: "blog_article",
    targetSearchIntent: "informational",
    inputPayload: {},
    retryCount: 0,
    errorMessage: "OpenAI rate limited",
    status: "failed",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMock.mockResolvedValue({});
  countMock.mockResolvedValue(0);
});

describe("drainFailedJobs — budget partagé imposé par l'orchestrateur", () => {
  it("ne dépasse jamais le budget partagé, même si ses propres réglages le permettraient", async () => {
    const { queue, addMock } = makeQueue();
    findManyMock.mockResolvedValue(Array.from({ length: 20 }, (_, i) => failedJob(`j-${i}`)));

    // maxPerTick=5 et maxPerDay=20 autoriseraient 5 relances ; le budget partagé
    // n'en laisse que 2 (la production neuve a déjà consommé le reste).
    const outcome = await drainFailedJobs(queue, DEFAULT_RECOVERY_SETTINGS, 2);

    expect(outcome.requeued).toBe(2);
    expect(addMock).toHaveBeenCalledTimes(2);
  });

  it("ne relance rien quand le plafond du jour est déjà consommé", async () => {
    const { queue, addMock } = makeQueue();
    findManyMock.mockResolvedValue([failedJob("j-1")]);

    const outcome = await drainFailedJobs(queue, DEFAULT_RECOVERY_SETTINGS, 0);

    expect(outcome.requeued).toBe(0);
    expect(addMock).not.toHaveBeenCalled();
    // Rien n'est même lu en base : inutile de payer une requête pour un budget nul.
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("garde son comportement d'origine quand aucun budget n'est imposé", async () => {
    const { queue } = makeQueue();
    findManyMock.mockResolvedValue(Array.from({ length: 20 }, (_, i) => failedJob(`j-${i}`)));

    const outcome = await drainFailedJobs(queue, DEFAULT_RECOVERY_SETTINGS);

    expect(outcome.requeued).toBe(DEFAULT_RECOVERY_SETTINGS.maxPerTick);
  });
});

describe("sweepStuckJobs — budget partagé", () => {
  it("s'arrête au budget imposé", async () => {
    const { queue, addMock } = makeQueue();
    findManyMock.mockResolvedValue([failedJob("s-1"), failedJob("s-2"), failedJob("s-3")]);

    const outcome = await sweepStuckJobs(queue, DEFAULT_RECOVERY_SETTINGS, 1);

    expect(outcome.requeued).toBe(1);
    expect(addMock).toHaveBeenCalledTimes(1);
  });

  it("ne RELANCE rien avec un budget nul — mais continue de nettoyer", async () => {
    // ⚠️ Ce test exigeait aussi `findManyMock` non appelé. C'était une hypothèse
    // recopiée du drain (« inutile de payer une requête pour un budget nul ») —
    // vraie là-bas, fausse ici : le drain ne sait que RELANCER, alors que le
    // balayage a aussi du travail GRATUIT, la clôture des jobs irrécupérables.
    //
    // Mesuré en production le 2026-09-01 : le plafond quotidien étant atteint
    // (14/15), le tick a rendu `tickBudget=0`, le balayage s'est arrêté net et
    // les 59 jobs figés sont restés figés. La garde protégeait la dépense en
    // bloquant un nettoyage qui ne dépense rien.
    //
    // L'invariant qui compte — aucune relance sans budget — est conservé.
    const { queue, addMock } = makeQueue();
    findManyMock.mockResolvedValue([]);

    const outcome = await sweepStuckJobs(queue, DEFAULT_RECOVERY_SETTINGS, 0);

    expect(outcome.requeued).toBe(0);
    expect(addMock).not.toHaveBeenCalled();
    expect(findManyMock).toHaveBeenCalled();
  });
});

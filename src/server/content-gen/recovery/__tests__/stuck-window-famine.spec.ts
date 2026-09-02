/**
 * Famine de fenêtre du balayage des jobs figés — régression du 2026-09-01.
 *
 * Ce que ces tests protègent, mesuré en production :
 *
 *   60 jobs `running` figés, dont 20 depuis le 19/08. Le balayage tournait
 *   96 fois par jour depuis 12 jours et n'en avait remis AUCUN en file.
 *
 * La fenêtre est bornée (`take: maxPerTick * 4` = 20) et triée par `updatedAt`
 * croissant. Les 20 plus anciens portaient tous `retryCount = maxRetries` :
 * l'ancien code les comptait `skipped` puis passait au suivant, MAIS les
 * laissait `running` en base. Ils reprenaient donc exactement la même place au
 * tick suivant. Les 40 jobs derrière eux n'ont jamais été regardés.
 *
 * 🔑 Un candidat écarté sans être retiré de l'ensemble des candidats affame la
 * file qu'il occupe. Le premier test ci-dessous échoue sur l'ancien code.
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
  closeStuckJob,
  resolveStuckClosure,
  sweepStuckJobs,
} from "../backlog-recovery";

/** File BullMQ simulée. `existingState` = ce que renvoie `getState()`. */
function makeQueue(existingState: string | null = null) {
  const removeMock = vi.fn().mockResolvedValue(undefined);
  const addMock = vi.fn().mockResolvedValue({ id: "bull-1" });
  const getJobMock = vi
    .fn()
    .mockResolvedValue(
      existingState === null
        ? null
        : { getState: vi.fn().mockResolvedValue(existingState), remove: removeMock },
    );
  return { queue: { getJob: getJobMock, add: addMock } as never, addMock, removeMock, getJobMock };
}

function stuckJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    contentType: "blog_article",
    targetSearchIntent: "informational",
    inputPayload: { slotIndex: 7 },
    retryCount: 0,
    status: "running",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMock.mockResolvedValue({});
  countMock.mockResolvedValue(0);
});

describe("famine de fenêtre — la tête ne doit pas se re-remplir", () => {
  it("clôt les jobs à tentatives épuisées ET atteint le job récupérable derrière eux", async () => {
    // Reproduction exacte de la production du 2026-09-01 : la fenêtre de 20
    // s'ouvre sur 20 jobs à `retryCount = maxRetries`, et le seul job
    // récupérable est le 21e. Ancien code : 0 relancé, 0 clos, pour toujours.
    const { queue, addMock } = makeQueue(null);
    const epuises = Array.from({ length: 20 }, (_, i) =>
      stuckJob({ id: `vieux-${i}`, retryCount: DEFAULT_RECOVERY_SETTINGS.maxRetries }),
    );
    findManyMock.mockResolvedValue([...epuises, stuckJob({ id: "recuperable", retryCount: 1 })]);

    const outcome = await sweepStuckJobs(queue, DEFAULT_RECOVERY_SETTINGS);

    expect(outcome.closed).toBe(20);
    expect(outcome.requeued).toBe(1);
    // Le job récupérable est bien celui qui repart, pas un des cadavres.
    expect(addMock).toHaveBeenCalledOnce();
    expect(addMock.mock.calls[0]?.[2]).toEqual({ jobId: "gen-recuperable" });
  });

  it("écrit un état TERMINAL et le motif — sans quoi le job reviendrait dans la fenêtre", async () => {
    const { queue } = makeQueue(null);
    findManyMock.mockResolvedValue([
      stuckJob({ id: "epuise", retryCount: DEFAULT_RECOVERY_SETTINGS.maxRetries }),
    ]);

    await sweepStuckJobs(queue, DEFAULT_RECOVERY_SETTINGS);

    const arg = updateMock.mock.calls[0]?.[0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: "epuise" });
    expect(arg.data.status).toBe("failed");
    expect(String(arg.data.errorMessage)).toContain("tentative");
    expect(arg.data.completedAt).toBeInstanceOf(Date);
  });

  it("un budget serré ne bloque PAS les clôtures (elles ne dépensent rien)", async () => {
    // Le budget partagé plafonne la DÉPENSE : une clôture est une écriture en
    // base, aucun appel provider. La laisser tomber au premier job relancé
    // laisserait la tête de fenêtre se reformer dès le lendemain.
    const { queue } = makeQueue(null);
    findManyMock.mockResolvedValue([
      stuckJob({ id: "recup-1", retryCount: 0 }),
      stuckJob({ id: "recup-2", retryCount: 0 }),
      stuckJob({ id: "epuise", retryCount: DEFAULT_RECOVERY_SETTINGS.maxRetries }),
    ]);

    const outcome = await sweepStuckJobs(queue, DEFAULT_RECOVERY_SETTINGS, 1);

    expect(outcome.requeued).toBe(1);
    expect(outcome.skipped).toBe(1);
    expect(outcome.closed).toBe(1);
  });

  it("clôt même quand le budget du jour est ÉPUISÉ (budget 0)", async () => {
    // Mesuré en production le 2026-09-01, dans l'heure suivant le déploiement :
    // le tick a rendu `tickBudget=0` (plafond quotidien 14/15 atteint), le
    // balayage s'est arrêté net sur un `return` anticipé, et les 59 jobs figés
    // sont restés figés. Le correctif se bloquait lui-même.
    //
    // 🔑 Un nettoyage qui ne coûte rien ne doit pas être gardé par un budget de
    // dépense. Le plafond ne concerne que les remises en file.
    const { queue, addMock } = makeQueue(null);
    findManyMock.mockResolvedValue([
      stuckJob({ id: "epuise", retryCount: DEFAULT_RECOVERY_SETTINGS.maxRetries }),
      stuckJob({ id: "recuperable", retryCount: 0 }),
    ]);

    const outcome = await sweepStuckJobs(queue, DEFAULT_RECOVERY_SETTINGS, 0);

    expect(outcome.closed).toBe(1);
    // …mais rien n'est relancé : le budget reste souverain sur la dépense.
    expect(outcome.requeued).toBe(0);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("ne clôt JAMAIS un job encore en vol, même à tentatives épuisées", async () => {
    // Le statut en base peut être en retard sur un traitement bien vivant.
    // Clore ici rendrait fantôme un job au moment précis où il aboutit.
    const { queue } = makeQueue("active");
    findManyMock.mockResolvedValue([
      stuckJob({ id: "en-vol", retryCount: DEFAULT_RECOVERY_SETTINGS.maxRetries }),
    ]);

    const outcome = await sweepStuckJobs(queue, DEFAULT_RECOVERY_SETTINGS);

    expect(outcome.closed).toBe(0);
    expect(outcome.skipped).toBe(1);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("resolveStuckClosure", () => {
  it("tentatives épuisées → failed", () => {
    const closure = resolveStuckClosure(
      { contentType: "blog_article", inputPayload: {}, retryCount: 3 },
      DEFAULT_RECOVERY_SETTINGS,
    );
    expect(closure?.status).toBe("failed");
  });

  it("dépêche périmée → cancelled, le même vocabulaire que la remédiation du 15/08", () => {
    const closure = resolveStuckClosure(
      {
        contentType: "blog_from_rss",
        inputPayload: { rssPubDate: "2026-07-06T08:00:00.000Z" },
        retryCount: 0,
      },
      DEFAULT_RECOVERY_SETTINGS,
    );
    expect(closure?.status).toBe("cancelled");
    expect(closure?.reason).toContain("périmé");
  });

  it("job récupérable → null (aucune clôture)", () => {
    expect(
      resolveStuckClosure(
        { contentType: "blog_article", inputPayload: {}, retryCount: 1 },
        DEFAULT_RECOVERY_SETTINGS,
      ),
    ).toBeNull();
  });

  it("une dépêche FRAÎCHE n'est pas close", () => {
    expect(
      resolveStuckClosure(
        {
          contentType: "blog_from_rss",
          inputPayload: { rssPubDate: new Date().toISOString() },
          retryCount: 0,
        },
        DEFAULT_RECOVERY_SETTINGS,
      ),
    ).toBeNull();
  });
});

describe("closeStuckJob", () => {
  it("interroge BullMQ sous la clé gen-<id> avant d'écrire", async () => {
    const { queue, getJobMock } = makeQueue(null);

    const ok = await closeStuckJob(queue, "job-42", { status: "cancelled", reason: "motif" });

    expect(ok).toBe(true);
    expect(getJobMock).toHaveBeenCalledWith("gen-job-42");
  });

  it("rend false et n'écrit rien sur un job en vol", async () => {
    const { queue } = makeQueue("waiting");

    const ok = await closeStuckJob(queue, "job-42", { status: "failed", reason: "motif" });

    expect(ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

/**
 * Un job CLOS aujourd'hui n'est pas un job RELANCÉ aujourd'hui.
 *
 * Constaté en production le 2026-09-02 : l'arbitrage manuel a passé en
 * `cancelled` un job portant `retryCount = 2`. Les deux comptages du budget
 * quotidien (`alreadyToday` du drain, `requeuedTodayAll` de l'orchestrateur)
 * lisaient `retryCount > 0 AND updatedAt >= minuit` sans filtre de statut : le
 * job clos a compté comme une relance, le budget global est passé à 6/15 au
 * lieu de 5/15, et le premier tick de reprise a glissé de 08:15 à 09:45 UTC.
 * La veille, les 21 clôtures automatiques du balayage (`failed`, motif
 * `STUCK_CLOSURE_PREFIX`) avaient produit le même fantôme, 21 fois.
 *
 * Ces tests verrouillent la clause partagée `requeuedTodayWhere` et le fait que
 * le drain s'en sert réellement — un helper juste mais non branché ne
 * corrigerait rien.
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
  CLOSED_WITHOUT_RUNNING_EXCLUSION,
  DEFAULT_RECOVERY_SETTINGS,
  STUCK_CLOSURE_PREFIX,
  computeRecoveryRoom,
  drainFailedJobs,
  requeuedTodayWhere,
  resolveStuckClosure,
} from "../backlog-recovery";

beforeEach(() => {
  vi.clearAllMocks();
  updateMock.mockResolvedValue({});
  countMock.mockResolvedValue(0);
  findManyMock.mockResolvedValue([]);
});

describe("requeuedTodayWhere — la signature d'une relance, pas d'une clôture", () => {
  const startOfDay = new Date("2026-09-02T00:00:00.000Z");
  const where = requeuedTodayWhere(startOfDay);

  it("garde le cœur du comptage : retryCount > 0 et updatedAt du jour", () => {
    expect(where.retryCount).toEqual({ gt: 0 });
    expect(where.updatedAt).toEqual({ gte: startOfDay });
  });

  it("exclut les jobs `cancelled` — une relance ne finit jamais annulée", () => {
    expect(where.status).toEqual({ not: "cancelled" });
  });

  it("exclut les `failed` clos par le balayage, reconnus à leur motif", () => {
    expect(where.NOT).toEqual({
      status: "failed",
      errorMessage: { startsWith: STUCK_CLOSURE_PREFIX },
    });
  });

  it("ne touche pas aux `failed` de relance (erreur provider) : ils restent comptés", () => {
    // La clause NOT porte sur le couple (failed ET motif de clôture) : un
    // `failed` portant une erreur provider n'est exclu par aucun terme.
    expect(where.NOT.errorMessage.startsWith).not.toBe("");
    expect(Object.keys(where.NOT)).toEqual(["status", "errorMessage"]);
  });
});

describe("STUCK_CLOSURE_PREFIX — dérivé, jamais recopié", () => {
  const settings = { ...DEFAULT_RECOVERY_SETTINGS, maxRetries: 3 };

  it("la clôture « tentatives épuisées » commence par le préfixe", () => {
    const closure = resolveStuckClosure(
      { contentType: "blog_article", inputPayload: {}, retryCount: 3 },
      settings,
    );
    expect(closure?.status).toBe("failed");
    expect(closure?.reason.startsWith(STUCK_CLOSURE_PREFIX)).toBe(true);
  });

  it("la clôture « sujet périmé » commence par le préfixe", () => {
    const closure = resolveStuckClosure(
      {
        contentType: "blog_from_rss",
        inputPayload: { rssPubDate: "2026-01-01T00:00:00.000Z" },
        retryCount: 0,
      },
      settings,
    );
    expect(closure?.status).toBe("cancelled");
    expect(closure?.reason.startsWith(STUCK_CLOSURE_PREFIX)).toBe(true);
  });
});

describe("drainFailedJobs — le comptage du jour utilise la clause partagée", () => {
  it("interroge `count` avec requeuedTodayWhere, pas avec la clause nue", async () => {
    const queue = { getJob: vi.fn().mockResolvedValue(null), add: vi.fn() } as never;
    await drainFailedJobs(queue, DEFAULT_RECOVERY_SETTINGS);

    expect(countMock).toHaveBeenCalledTimes(1);
    const args = countMock.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(args.where.status).toEqual({ not: "cancelled" });
    expect(args.where.NOT).toEqual({
      status: "failed",
      errorMessage: { startsWith: STUCK_CLOSURE_PREFIX },
    });
    // Le fantôme du 02/09 : sans ces deux termes, ce test doit rougir.
    expect(Object.keys(args.where).sort()).toEqual(
      ["NOT", "retryCount", "status", "updatedAt"].sort(),
    );
  });
});

describe("CLOSED_WITHOUT_RUNNING_EXCLUSION — partagée par le budget et par l'alarme de rejet", () => {
  it("exclut les `cancelled` et les `failed` de clôture, rien d'autre", () => {
    expect(CLOSED_WITHOUT_RUNNING_EXCLUSION).toEqual({
      status: { not: "cancelled" },
      NOT: { status: "failed", errorMessage: { startsWith: STUCK_CLOSURE_PREFIX } },
    });
  });

  it("requeuedTodayWhere est dérivée de la même clause", () => {
    const where = requeuedTodayWhere(new Date("2026-09-02T00:00:00.000Z"));
    expect(where.status).toBe(CLOSED_WITHOUT_RUNNING_EXCLUSION.status);
    expect(where.NOT).toBe(CLOSED_WITHOUT_RUNNING_EXCLUSION.NOT);
  });
});

describe("computeRecoveryRoom — la reprise ne prend qu'une part du plafond", () => {
  it("plafond 15, part 0,5, rien relancé : la reprise a droit à 7 (floor), pas à tout", () => {
    expect(
      computeRecoveryRoom({
        capPerDay: 15,
        shareOfDailyCap: 0.5,
        requeuedToday: 0,
        globalRoom: 15,
      }),
    ).toBe(7);
  });

  it("déduit ce que la reprise a déjà relancé aujourd'hui", () => {
    expect(
      computeRecoveryRoom({
        capPerDay: 15,
        shareOfDailyCap: 0.5,
        requeuedToday: 5,
        globalRoom: 15,
      }),
    ).toBe(2);
    expect(
      computeRecoveryRoom({
        capPerDay: 15,
        shareOfDailyCap: 0.5,
        requeuedToday: 9,
        globalRoom: 15,
      }),
    ).toBe(0);
  });

  it("ne dépasse jamais le budget global restant du tick (lissage horaire)", () => {
    expect(
      computeRecoveryRoom({ capPerDay: 15, shareOfDailyCap: 0.5, requeuedToday: 0, globalRoom: 1 }),
    ).toBe(1);
    expect(
      computeRecoveryRoom({ capPerDay: 15, shareOfDailyCap: 0.5, requeuedToday: 0, globalRoom: 0 }),
    ).toBe(0);
  });

  it("une part absente ou aberrante retombe sur la part par défaut, jamais sur « tout »", () => {
    const base = { capPerDay: 15, requeuedToday: 0, globalRoom: 15 };
    const attendu = computeRecoveryRoom({
      ...base,
      shareOfDailyCap: DEFAULT_RECOVERY_SETTINGS.shareOfDailyCap,
    });
    expect(attendu).toBeLessThan(15);
    for (const share of [undefined, 0, -1, 2, Number.NaN]) {
      expect(computeRecoveryRoom({ ...base, shareOfDailyCap: share })).toBe(attendu);
    }
  });

  it("part 1 = comportement d'avant (la reprise peut tout prendre) — reste possible par config", () => {
    expect(
      computeRecoveryRoom({ capPerDay: 15, shareOfDailyCap: 1, requeuedToday: 0, globalRoom: 15 }),
    ).toBe(15);
  });
});

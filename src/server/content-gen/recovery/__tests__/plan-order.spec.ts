/**
 * Reprise dans l'ordre du plan.
 *
 * Question posée le 2026-08-15 : « ne peut-on pas annuler les jobs en échec pour
 * repartir propre, tout en resuivant l'ordre de ce qu'il fallait faire ? »
 *
 * La réponse tient à ce que ces jobs contiennent. Un job de campagne en échec ne
 * porte aucun sujet figé — mais il porte sa PLACE DANS LE PLAN, et tout ce qui en
 * découle : `slotIndex`, type de contenu, ville d'ancrage et intention de
 * recherche sont échantillonnés déterministement à partir du slot par
 * l'orchestrateur. Le relancer rejoue donc exactement l'élément de plan prévu.
 *
 * L'annuler, à l'inverse, le perdrait définitivement : le compteur de slots d'une
 * campagne ne redescend jamais et l'orchestrateur ne repasse jamais sur un slot
 * servi. Une annulation creuse un trou permanent dans le plan.
 *
 * Restait un défaut : la reprise suivait l'ordre des ÉCHECS (`updatedAt`), si
 * bien que les jobs déjà rejoués une fois remontaient en tête et que le plan
 * était repris en désordre. Elle suit désormais l'ordre de CRÉATION, qui est
 * l'ordre des slots.
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

import { DEFAULT_RECOVERY_SETTINGS, drainFailedJobs } from "../backlog-recovery";

function makeQueue() {
  const addMock = vi.fn().mockResolvedValue({ id: "bull-1" });
  return { queue: { getJob: vi.fn().mockResolvedValue(null), add: addMock } as never, addMock };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMock.mockResolvedValue({});
  countMock.mockResolvedValue(0);
  findManyMock.mockResolvedValue([]);
});

describe("drainFailedJobs — ordre du plan", () => {
  it("lit les échecs dans l'ordre de CRÉATION (= ordre des slots)", async () => {
    const { queue } = makeQueue();

    await drainFailedJobs(queue, DEFAULT_RECOVERY_SETTINGS);

    const args = findManyMock.mock.calls[0]?.[0] as { orderBy: Record<string, string> };
    expect(args.orderBy).toEqual({ createdAt: "asc" });
  });

  it("n'ordonne PLUS par date d'échec", async () => {
    // `updatedAt` faisait remonter en tête les jobs déjà rejoués une fois (la
    // relance-test du 18/07), donc reprenait le plan en désordre.
    const { queue } = makeQueue();

    await drainFailedJobs(queue, DEFAULT_RECOVERY_SETTINGS);

    const args = findManyMock.mock.calls[0]?.[0] as { orderBy: Record<string, string> };
    expect(args.orderBy).not.toHaveProperty("updatedAt");
  });

  it("ne reprend que les jobs dont le budget de tentatives n'est pas épuisé", async () => {
    const { queue } = makeQueue();

    await drainFailedJobs(queue, DEFAULT_RECOVERY_SETTINGS);

    const args = findManyMock.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(args.where.status).toBe("failed");
    expect(args.where.retryCount).toEqual({ lt: DEFAULT_RECOVERY_SETTINGS.maxRetries });
  });
});

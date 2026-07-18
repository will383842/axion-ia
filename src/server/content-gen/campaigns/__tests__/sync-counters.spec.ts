/**
 * Fix 2026-07-18 — resynchronisation des compteurs de campagne.
 *
 * Bug couvert : `failedCount`/`publishedCount` n'étaient écrits par personne —
 * la console affichait « échecs : 0, publiés : 0 » sur toutes les campagnes
 * (mesuré en prod : 0/0 affiché pour 890 échecs / 63 publiés réels).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { groupByMock, findManyMock, updateMock } = vi.hoisted(() => ({
  groupByMock: vi.fn(),
  findManyMock: vi.fn(),
  updateMock: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentGenJob: { groupBy: groupByMock },
    coverageCampaign: { findMany: findManyMock, update: updateMock },
  },
}));

import { computeCounterDrifts, syncCampaignCounters } from "../sync-counters";

const row = (campaignId: string | null, status: string, n: number) => ({
  campaignId,
  status,
  _count: { _all: n },
});

describe("computeCounterDrifts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("détecte la dérive du cas prod (0/0 stocké pour 890 échecs / 63 publiés)", async () => {
    groupByMock.mockResolvedValue([
      row("camp-aura", "failed", 890),
      row("camp-aura", "published", 63),
      row("camp-aura", "needs_review", 232),
    ]);
    findManyMock.mockResolvedValue([{ id: "camp-aura", failedCount: 0, publishedCount: 0 }]);

    const drifts = await computeCounterDrifts();

    expect(drifts).toEqual([{ campaignId: "camp-aura", failedCount: 890, publishedCount: 63 }]);
  });

  it("ne retourne RIEN quand les compteurs sont justes (aucun write inutile)", async () => {
    groupByMock.mockResolvedValue([row("camp-1", "failed", 5), row("camp-1", "published", 7)]);
    findManyMock.mockResolvedValue([{ id: "camp-1", failedCount: 5, publishedCount: 7 }]);

    expect(await computeCounterDrifts()).toEqual([]);
  });

  it("remet à ZÉRO une campagne sans aucun job (compteur résiduel)", async () => {
    groupByMock.mockResolvedValue([]);
    findManyMock.mockResolvedValue([{ id: "camp-vide", failedCount: 12, publishedCount: 3 }]);

    expect(await computeCounterDrifts()).toEqual([
      { campaignId: "camp-vide", failedCount: 0, publishedCount: 0 },
    ]);
  });

  it("ignore les jobs orphelins (campaignId null) et les statuts non comptés", async () => {
    groupByMock.mockResolvedValue([
      row(null, "failed", 50),
      row("camp-1", "cancelled", 9),
      row("camp-1", "needs_review", 4),
    ]);
    findManyMock.mockResolvedValue([{ id: "camp-1", failedCount: 0, publishedCount: 0 }]);

    // cancelled/needs_review ne comptent ni en failed ni en published → 0/0 = juste.
    expect(await computeCounterDrifts()).toEqual([]);
  });
});

describe("syncCampaignCounters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockResolvedValue({});
  });

  it("écrit uniquement les campagnes en dérive et retourne leur nombre", async () => {
    groupByMock.mockResolvedValue([
      row("camp-derive", "failed", 890),
      row("camp-derive", "published", 63),
      row("camp-ok", "published", 2),
    ]);
    findManyMock.mockResolvedValue([
      { id: "camp-derive", failedCount: 0, publishedCount: 0 },
      { id: "camp-ok", failedCount: 0, publishedCount: 2 },
    ]);

    const n = await syncCampaignCounters();

    expect(n).toBe(1);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "camp-derive" },
      data: { failedCount: 890, publishedCount: 63 },
    });
  });

  it("0 dérive → 0 write", async () => {
    groupByMock.mockResolvedValue([]);
    findManyMock.mockResolvedValue([]);

    expect(await syncCampaignCounters()).toBe(0);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

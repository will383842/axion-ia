/**
 * Liste + archivage + suppression des campagnes de couverture.
 *
 * - `listCampaigns` : regroupement par vue (active/paused/terminated/archived/all),
 *   override par statut exact, filtre secteur, pagination (skip/take + total).
 * - `parseCampaignListView` : normalisation des vues.
 * - `archiveCampaign` / `unarchiveCampaign` : bascule `archivedAt` (réversible).
 * - `deleteCampaignPermanently` : détache les jobs (campaignId → null) puis delete.
 *
 * Refonte 2026-07-03 : archivage EXPLICITE via `archivedAt` (migration dédiée).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks hoisted (harnais coverage éprouvé) ──────────────────────────────────

const countMock = vi.fn(async (_args?: unknown) => 0);
const findManyMock = vi.fn(async (_args?: unknown) => [] as unknown[]);
const updateMock = vi.fn(async (_args?: unknown) => ({}) as unknown);
const findUniqueMock = vi.fn(async (_args?: unknown) => null as unknown);
const jobUpdateManyMock = vi.fn(async (_args?: unknown) => ({ count: 0 }));
const deleteMock = vi.fn(async (_args?: unknown) => ({}) as unknown);
const transactionMock = vi.fn(async (ops: unknown) => {
  // Reproduit le comportement d'un $transaction(array) : renvoie les résultats.
  if (Array.isArray(ops)) return Promise.all(ops);
  return [];
});

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("../_auth", () => ({
  requireAdmin: vi.fn(async () => ({
    userId: "admin-1",
    email: "admin@axion-ia.com",
    ip: "127.0.0.1",
    userAgent: "test",
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coverageCampaign: {
      count: (args: unknown) => countMock(args),
      findMany: (args: unknown) => findManyMock(args),
      update: (args: unknown) => updateMock(args),
      findUnique: (args: unknown) => findUniqueMock(args),
      delete: (args: unknown) => deleteMock(args),
    },
    contentGenJob: {
      updateMany: (args: unknown) => jobUpdateManyMock(args),
    },
    $transaction: (ops: unknown) => transactionMock(ops),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("bullmq", () => ({ Queue: vi.fn() }));
vi.mock("@/server/content-gen/shared/activity-log", () => ({
  logActivity: vi.fn(async () => undefined),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    count: 1,
    remaining: 59,
    resetAt: Date.now() + 60_000,
  })),
}));

import {
  listCampaigns,
  archiveCampaign,
  unarchiveCampaign,
  deleteCampaignPermanently,
} from "../coverage";
import {
  ACTIVE_CAMPAIGN_STATUSES,
  TERMINAL_CAMPAIGN_STATUSES,
  parseCampaignListView,
} from "../coverage-status-groups";

beforeEach(() => {
  countMock.mockClear();
  findManyMock.mockClear();
  updateMock.mockClear();
  findUniqueMock.mockClear();
  jobUpdateManyMock.mockClear();
  deleteMock.mockClear();
  transactionMock.mockClear();
  countMock.mockResolvedValue(0);
  findManyMock.mockResolvedValue([]);
  findUniqueMock.mockResolvedValue(null);
  jobUpdateManyMock.mockResolvedValue({ count: 0 });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lastFindArgs(): any {
  return findManyMock.mock.calls.at(-1)?.[0];
}

describe("listCampaigns — vues (archivage explicite)", () => {
  it("vue par défaut = active → non archivées + statuts non terminaux", async () => {
    await listCampaigns();
    expect(lastFindArgs().where).toEqual({
      archivedAt: null,
      status: { in: [...ACTIVE_CAMPAIGN_STATUSES] },
    });
    expect(lastFindArgs().orderBy).toEqual({ createdAt: "desc" });
  });

  it("vue paused → non archivées + en pause", async () => {
    await listCampaigns({ view: "paused" });
    expect(lastFindArgs().where).toEqual({ archivedAt: null, status: "paused" });
  });

  it("vue terminated → non archivées + statuts terminaux", async () => {
    await listCampaigns({ view: "terminated" });
    expect(lastFindArgs().where).toEqual({
      archivedAt: null,
      status: { in: [...TERMINAL_CAMPAIGN_STATUSES] },
    });
  });

  it("vue archived → archivedAt non null (quel que soit le statut)", async () => {
    await listCampaigns({ view: "archived" });
    expect(lastFindArgs().where).toEqual({ archivedAt: { not: null } });
  });

  it("vue all → aucun filtre", async () => {
    await listCampaigns({ view: "all" });
    expect(lastFindArgs().where).toEqual({});
  });

  it("un statut exact affine la vue (prime sur le regroupement)", async () => {
    await listCampaigns({ view: "active", status: "running" });
    expect(lastFindArgs().where).toEqual({ archivedAt: null, status: "running" });
  });

  it("filtre secteur combiné à la vue all", async () => {
    await listCampaigns({ view: "all", serviceSector: "audits" });
    expect(lastFindArgs().where).toEqual({ serviceSector: "audits" });
  });
});

describe("listCampaigns — pagination", () => {
  it("page 3, pageSize 10 → skip 20, take 10", async () => {
    await listCampaigns({ view: "all", page: 3, pageSize: 10 });
    expect(lastFindArgs().skip).toBe(20);
    expect(lastFindArgs().take).toBe(10);
  });

  it("pageSize par défaut = 25, page 1 → skip 0", async () => {
    await listCampaigns();
    expect(lastFindArgs().skip).toBe(0);
    expect(lastFindArgs().take).toBe(25);
  });

  it("pageSize plafonné à 200", async () => {
    await listCampaigns({ pageSize: 9999 });
    expect(lastFindArgs().take).toBe(200);
  });

  it("page invalide (<= 0) → page 1 (skip 0)", async () => {
    await listCampaigns({ page: -5 });
    expect(lastFindArgs().skip).toBe(0);
  });

  it("renvoie total + page + pageSize + view", async () => {
    countMock.mockResolvedValue(42);
    const res = await listCampaigns({ page: 2 });
    expect(res.total).toBe(42);
    expect(res.page).toBe(2);
    expect(res.pageSize).toBe(25);
    expect(res.view).toBe("active");
    expect(res.rows).toEqual([]);
  });
});

describe("parseCampaignListView", () => {
  it("normalise les vues valides", () => {
    for (const v of ["active", "paused", "terminated", "archived", "all"] as const) {
      expect(parseCampaignListView(v)).toBe(v);
    }
  });

  it("valeur inconnue / absente → active (défaut)", () => {
    expect(parseCampaignListView(undefined)).toBe("active");
    expect(parseCampaignListView("n-importe-quoi")).toBe("active");
  });
});

describe("archiveCampaign / unarchiveCampaign", () => {
  it("archiveCampaign renseigne archivedAt (Date)", async () => {
    await archiveCampaign("camp-1");
    const args = updateMock.mock.calls.at(-1)?.[0] as {
      where: unknown;
      data: { archivedAt: unknown };
    };
    expect(args.where).toEqual({ id: "camp-1" });
    expect(args.data.archivedAt).toBeInstanceOf(Date);
  });

  it("unarchiveCampaign remet archivedAt à null", async () => {
    await unarchiveCampaign("camp-1");
    const args = updateMock.mock.calls.at(-1)?.[0] as {
      where: unknown;
      data: { archivedAt: unknown };
    };
    expect(args.where).toEqual({ id: "camp-1" });
    expect(args.data.archivedAt).toBeNull();
  });
});

describe("deleteCampaignPermanently", () => {
  it("détache les jobs (campaignId → null) PUIS supprime la campagne", async () => {
    findUniqueMock.mockResolvedValue({ recurringSchedule: null });
    jobUpdateManyMock.mockResolvedValue({ count: 3 });
    const res = await deleteCampaignPermanently("camp-9");
    // detach : updateMany des jobs de la campagne vers campaignId null
    expect(jobUpdateManyMock).toHaveBeenCalledWith({
      where: { campaignId: "camp-9" },
      data: { campaignId: null },
    });
    // delete de la campagne
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "camp-9" } });
    // transaction atomique (detach + delete)
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(res.detachedJobs).toBe(3);
  });
});

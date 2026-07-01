/**
 * Archivage liste des campagnes (2026-07-01) — `listCampaigns`.
 *
 * Vérifie le regroupement par vue (active/archived/all), l'override par statut
 * exact, le filtre secteur et la pagination (skip/take + total).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks hoisted (harnais coverage éprouvé) ──────────────────────────────────

const countMock = vi.fn(async (_args?: unknown) => 0);
const findManyMock = vi.fn(async (_args?: unknown) => [] as unknown[]);

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coverageCampaign: {
      count: (args: unknown) => countMock(args),
      findMany: (args: unknown) => findManyMock(args),
    },
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

import { listCampaigns } from "../coverage";
import { ACTIVE_CAMPAIGN_STATUSES, ARCHIVED_CAMPAIGN_STATUSES } from "../coverage-status-groups";

beforeEach(() => {
  countMock.mockClear();
  findManyMock.mockClear();
  countMock.mockResolvedValue(0);
  findManyMock.mockResolvedValue([]);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lastArgs(): any {
  return findManyMock.mock.calls.at(-1)?.[0];
}

describe("listCampaigns — vues d'archivage", () => {
  it("vue par défaut = active → filtre sur les statuts non terminaux", async () => {
    await listCampaigns();
    expect(lastArgs().where).toEqual({ status: { in: [...ACTIVE_CAMPAIGN_STATUSES] } });
    expect(lastArgs().orderBy).toEqual({ createdAt: "desc" });
  });

  it("vue archived → filtre sur les statuts terminaux", async () => {
    await listCampaigns({ view: "archived" });
    expect(lastArgs().where).toEqual({ status: { in: [...ARCHIVED_CAMPAIGN_STATUSES] } });
  });

  it("vue all → aucun filtre de statut", async () => {
    await listCampaigns({ view: "all" });
    expect(lastArgs().where).toEqual({});
  });

  it("un statut exact prime sur la vue", async () => {
    await listCampaigns({ view: "active", status: "completed" });
    expect(lastArgs().where).toEqual({ status: "completed" });
  });

  it("filtre secteur combiné à la vue", async () => {
    await listCampaigns({ view: "all", serviceSector: "audits" });
    expect(lastArgs().where).toEqual({ serviceSector: "audits" });
  });
});

describe("listCampaigns — pagination", () => {
  it("page 3, pageSize 10 → skip 20, take 10", async () => {
    await listCampaigns({ view: "all", page: 3, pageSize: 10 });
    expect(lastArgs().skip).toBe(20);
    expect(lastArgs().take).toBe(10);
  });

  it("pageSize par défaut = 25, page 1 → skip 0", async () => {
    await listCampaigns();
    expect(lastArgs().skip).toBe(0);
    expect(lastArgs().take).toBe(25);
  });

  it("pageSize plafonné à 200", async () => {
    await listCampaigns({ pageSize: 9999 });
    expect(lastArgs().take).toBe(200);
  });

  it("page invalide (<= 0) → page 1 (skip 0)", async () => {
    await listCampaigns({ page: -5 });
    expect(lastArgs().skip).toBe(0);
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

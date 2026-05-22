/**
 * B.2 P0-10 — pauseCampaign purge BullMQ jobs en attente.
 *
 * Vérifie que `pauseCampaign` :
 * 1. Flippe la campagne en `paused`.
 * 2. Charge les jobs `queued` de la campagne.
 * 3. Pour chaque job : getJob(`gen-${id}`) → si waiting → remove().
 * 4. Les jobs non-waiting (ex: active) ne sont PAS supprimés.
 * 5. Si queue indisponible (pas de REDIS_URL) : graceful (0 purge, pas d'erreur).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks hoisted (avant imports) ─────────────────────────────────────────────

const getJobMock = vi.fn<
  (
    jobId: string,
  ) => Promise<null | { getState: () => Promise<string>; remove: () => Promise<void> }>
>(async () => null);
const campaignUpdateMock = vi.fn(async (_args: unknown) => ({ id: "campaign-x" }));
const contentGenJobFindManyMock = vi.fn(async () => [] as { id: string }[]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const activityLogCreateMock = vi.fn(async (_args: any) => ({ id: "a-1" }));
const authMock = vi.fn(async () => ({
  user: { id: "u-1", email: "admin@axion-ia.com", role: "admin" },
}));
const revalidatePathMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coverageCampaign: {
      update: (args: unknown) => campaignUpdateMock(args),
      // Sprint Campaign Controls — needed for recurringSchedule lookup in pauseCampaign
      findUnique: vi.fn(async () => ({ recurringSchedule: null })),
    },
    contentGenJob: {
      findMany: () => contentGenJobFindManyMock(),
    },
    activityLog: {
      create: (args: unknown) => activityLogCreateMock(args),
    },
    contentGenAuditLog: {
      create: vi.fn(async () => ({ id: "audit-1" })),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => revalidatePathMock(p),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers() as unknown),
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    getJob: (jobId: string) => getJobMock(jobId),
  })),
}));

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

import { pauseCampaign } from "../coverage";

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Force REDIS_URL pour que getContentGenQueue() instancie la Queue mockée.
  process.env.REDIS_URL = "redis://test.invalid:6379";
  authMock.mockClear();
  authMock.mockImplementation(async () => ({
    user: { id: "u-1", email: "admin@axion-ia.com", role: "admin" },
  }));
  campaignUpdateMock.mockClear();
  contentGenJobFindManyMock.mockClear();
  activityLogCreateMock.mockClear();
  revalidatePathMock.mockClear();
  getJobMock.mockClear();
  getJobMock.mockResolvedValue(null);
});

describe("pauseCampaign — B.2 P0-10 purge BullMQ jobs", () => {
  it("flipe la campagne en paused", async () => {
    contentGenJobFindManyMock.mockResolvedValue([]);
    await pauseCampaign("campaign-1");
    expect(campaignUpdateMock).toHaveBeenCalledOnce();
    const updateArg = campaignUpdateMock.mock.calls[0]![0] as {
      where: { id: string };
      data: { status: string; pausedAt: Date };
    };
    expect(updateArg.where.id).toBe("campaign-1");
    expect(updateArg.data.status).toBe("paused");
    expect(updateArg.data.pausedAt).toBeInstanceOf(Date);
  });

  it("purge les jobs BullMQ en state=waiting", async () => {
    const removeMock = vi.fn(async () => {});
    contentGenJobFindManyMock.mockResolvedValue([{ id: "job-aaa" }, { id: "job-bbb" }]);
    // job-aaa → waiting → doit être supprimé
    // job-bbb → active → ne doit PAS être supprimé
    getJobMock.mockImplementation(async (jobId) => {
      if (jobId === "gen-job-aaa") return { getState: async () => "waiting", remove: removeMock };
      if (jobId === "gen-job-bbb") return { getState: async () => "active", remove: removeMock };
      return null;
    });

    await pauseCampaign("campaign-2");

    // getJob appelé pour les 2 jobs
    expect(getJobMock).toHaveBeenCalledWith("gen-job-aaa");
    expect(getJobMock).toHaveBeenCalledWith("gen-job-bbb");
    // remove appelé seulement pour le job waiting (job-aaa)
    expect(removeMock).toHaveBeenCalledOnce();
  });

  it("ne purge rien si 0 jobs queued", async () => {
    contentGenJobFindManyMock.mockResolvedValue([]);
    await pauseCampaign("campaign-3");
    expect(getJobMock).not.toHaveBeenCalled();
  });

  it("graceful si BullMQ job introuvable (getJob retourne null)", async () => {
    contentGenJobFindManyMock.mockResolvedValue([{ id: "job-zzz" }]);
    getJobMock.mockResolvedValue(null);
    // Ne doit pas throw
    await expect(pauseCampaign("campaign-4")).resolves.toBeUndefined();
  });
});

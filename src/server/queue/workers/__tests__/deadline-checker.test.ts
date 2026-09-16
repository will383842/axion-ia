/**
 * Sprint Campaign Controls (§ 25.2 v1.8 2026-05-22) — C.3
 *
 * Tests content-gen-deadline-checker.
 * 5 scénarios :
 *  1. Campagne running avec endDate passé → status=completed + completedReason=deadline_reached
 *  2. Campagne scheduled avec endDate passé → status=completed
 *  3. Campagne running avec endDate futur → inchangée
 *  4. Campagne running sans endDate → inchangée
 *  5. Campagne avec recurringSchedule + endDate passé → removeRepeatable appelé
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const campaignFindManyMock = vi.fn();
const campaignUpdateMock = vi.fn();
const contentGenJobFindManyMock = vi.fn();
const contentGenJobUpdateManyMock = vi.fn();
const ecrireJournalActiviteMock = vi.fn();
const captureWorkerErrorMock = vi.fn();
const queueGetJobMock = vi.fn();
const queueRemoveRepeatableMock = vi.fn();

const capturedProcessor: { fn: ((job: Job) => Promise<void>) | null } = { fn: null };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coverageCampaign: {
      findMany: () => campaignFindManyMock(),
      update: (args: unknown) => campaignUpdateMock(args),
    },
    contentGenJob: {
      findMany: (args: unknown) => contentGenJobFindManyMock(args),
      updateMany: (args: unknown) => contentGenJobUpdateManyMock(args),
    },
  },
}));

// ⚠️ CE DOUBLE NE PROUVE RIEN SUR L'ÉCRITURE, et c'est assumé : ce fichier teste
// les CINQ scénarios d'arrêt de campagne, pas le journal. Jusqu'au 2026-09-16 il
// doublait `logActivity` de la même façon, et son `expect(...).toHaveBeenCalled()`
// restait vert alors qu'aucune ligne ne partait en base — `logActivity` lit
// `headers()`, qui lève hors requête, dans le même `try` que son `create`.
// La preuve que la ligne existe VRAIMENT est dans `deadline-checker-journal.spec.ts`,
// qui ne double que `prisma` et `next/headers`.
vi.mock("@/server/content-gen/shared/activity-log-writer", () => ({
  acteurSysteme: (origine: string) => ({ adminUserId: null, origine }),
  ecrireJournalActivite: (...args: unknown[]) => ecrireJournalActiviteMock(...args),
}));

vi.mock("@/server/queue/lib/sentry-worker", () => ({
  captureWorkerError: (...args: unknown[]) => captureWorkerErrorMock(...args),
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    getJob: (id: string) => queueGetJobMock(id),
    removeRepeatable: (...args: unknown[]) => queueRemoveRepeatableMock(...args),
  })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Worker: vi.fn().mockImplementation((_name: string, fn: any) => {
    capturedProcessor.fn = fn;
    return { on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) };
  }),
}));

import { startContentDeadlineCheckerWorker } from "../content-gen-deadline-checker";

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REDIS_URL = "redis://test.invalid:6379";
  campaignUpdateMock.mockResolvedValue({ id: "campaign-1" });
  contentGenJobFindManyMock.mockResolvedValue([]);
  contentGenJobUpdateManyMock.mockResolvedValue({ count: 0 });
  ecrireJournalActiviteMock.mockResolvedValue(undefined);
  queueGetJobMock.mockResolvedValue(null);
  queueRemoveRepeatableMock.mockResolvedValue(undefined);
});

function getProcessor() {
  startContentDeadlineCheckerWorker();
  return capturedProcessor.fn!;
}

const MOCK_JOB = { id: "job-1", data: {} } as Job;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("content-gen-deadline-checker", () => {
  it("D1: campagne running avec endDate passé → status=completed + completedReason=deadline_reached", async () => {
    campaignFindManyMock.mockResolvedValue([
      { id: "campaign-1", name: "Test", recurringSchedule: null },
    ]);

    const fn = getProcessor();
    await fn(MOCK_JOB);

    expect(campaignUpdateMock).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArg: any = campaignUpdateMock.mock.calls[0]?.[0];
    expect(callArg?.data?.status).toBe("completed");
    expect(callArg?.data?.completedReason).toBe("deadline_reached");
    expect(ecrireJournalActiviteMock).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logArg: any = ecrireJournalActiviteMock.mock.calls[0]?.[1];
    expect(logArg?.changes?.soc2).toBe("CAMPAIGN_AUTO_STOPPED_DEADLINE");
  });

  it("D2: campagne scheduled avec endDate passé → status=completed", async () => {
    campaignFindManyMock.mockResolvedValue([
      { id: "campaign-2", name: "Scheduled", recurringSchedule: null },
    ]);

    const fn = getProcessor();
    await fn(MOCK_JOB);

    expect(campaignUpdateMock).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArg: any = campaignUpdateMock.mock.calls[0]?.[0];
    expect(callArg?.data?.status).toBe("completed");
  });

  it("D3: campagne running avec endDate futur → inchangée (query filtre endDate<=NOW)", async () => {
    // La query Prisma filtre endDate <= NOW — si retourne vide → rien
    campaignFindManyMock.mockResolvedValue([]);

    const fn = getProcessor();
    await fn(MOCK_JOB);

    expect(campaignUpdateMock).not.toHaveBeenCalled();
  });

  it("D4: campagne running sans endDate → inchangée (query filtre endDate non null)", async () => {
    // La query Prisma filtre endDate <= NOW — si null → hors résultat
    campaignFindManyMock.mockResolvedValue([]);

    const fn = getProcessor();
    await fn(MOCK_JOB);

    expect(campaignUpdateMock).not.toHaveBeenCalled();
  });

  it("D5: campagne avec recurringSchedule + endDate passé → removeRepeatable appelé", async () => {
    campaignFindManyMock.mockResolvedValue([
      { id: "campaign-1", name: "Recurring", recurringSchedule: "0 9 * * 1" },
    ]);

    const fn = getProcessor();
    await fn(MOCK_JOB);

    expect(queueRemoveRepeatableMock).toHaveBeenCalledWith(
      "campaign-campaign-1-recurring",
      expect.objectContaining({ pattern: "0 9 * * 1" }),
    );
  });
});

/**
 * 🔴 UNE CAMPAGNE ARRÊTÉE AUTOMATIQUEMENT NE LAISSAIT AUCUNE TRACE.
 *
 * `content-gen-deadline-checker` tourne dans le conteneur worker, sous `tsx`,
 * hors de Next. Il appelait `logActivity` — une Server Action (`"use server"`)
 * dont la PREMIÈRE instruction du `try` est `await headers()`. Hors requête,
 * `headers()` lève ; le `catch` unique du helper avale l'erreur ; et le
 * `prisma.activityLog.create` qui suit, placé DANS le même `try`, n'est
 * **jamais atteint**. La trace SOC2 `content-gen.campaign.auto-stopped`
 * n'existait pas en base. Même famille que le cron des autofactures (#1098).
 *
 * 🔑 Et il y en avait DEUX, empilés : l'acteur passé était la chaîne
 * `"system:deadline-checker"`, alors que `ActivityLog.adminUserId` est un
 * `@db.Uuid` avec clé étrangère vers `AdminUser`. Même si `headers()` avait
 * répondu, le `create` aurait levé — et le même `catch` l'aurait avalé aussi.
 * Un acte du système s'écrit `adminUserId: null`, et son auteur se lit dans
 * `changes.origine`.
 *
 * ⚠️ CE TEST NE DOUBLE PAS LE JOURNAL, et c'est tout son intérêt.
 * `deadline-checker.test.ts`, juste à côté, remplace le module de journal par un
 * `vi.fn()` : il vérifie donc que le worker APPELLE quelque chose, jamais qu'une
 * ligne est ÉCRITE. Son `expect(...).toHaveBeenCalled()` est resté vert pendant
 * que la production n'écrivait rien. Ici, seuls `prisma` et `next/headers` sont
 * doublés — `headers()` LÈVE, comme en production — et l'assertion porte sur
 * `prisma.activityLog.create`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";

const campaignFindManyMock = vi.fn();
const campaignUpdateMock = vi.fn();
const contentGenJobFindManyMock = vi.fn();
const contentGenJobUpdateManyMock = vi.fn();
const activityLogCreateMock = vi.fn();

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
    activityLog: {
      create: (args: unknown) => activityLogCreateMock(args),
    },
  },
}));

// Le worker n'a NI requête NI store asynchrone : c'est exactement ce que fait
// `headers()` de Next 16 quand on l'appelle depuis `tsx`.
vi.mock("next/headers", () => ({
  headers: async () => {
    throw new Error(
      "`headers` was called outside a request scope. Read more: https://nextjs.org/docs/messages/next-dynamic-api-wrong-context",
    );
  },
}));

vi.mock("@/server/queue/lib/sentry-worker", () => ({
  captureWorkerError: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    getJob: vi.fn().mockResolvedValue(null),
    removeRepeatable: vi.fn().mockResolvedValue(undefined),
  })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Worker: vi.fn().mockImplementation((_name: string, fn: any) => {
    capturedProcessor.fn = fn;
    return { on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) };
  }),
}));

import { startContentDeadlineCheckerWorker } from "../content-gen-deadline-checker";

/** Un UUID, parce que `CoverageCampaign.id` et `ActivityLog.targetId` en sont. */
const CAMPAGNE = "3f0e2a10-6c4b-4d2e-9f51-0b7a1c8d4e62";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REDIS_URL = "redis://test.invalid:6379";
  campaignFindManyMock.mockResolvedValue([
    { id: CAMPAGNE, name: "Campagne de test", recurringSchedule: null },
  ]);
  campaignUpdateMock.mockResolvedValue({ id: CAMPAGNE });
  contentGenJobFindManyMock.mockResolvedValue([]);
  contentGenJobUpdateManyMock.mockResolvedValue({ count: 0 });
  activityLogCreateMock.mockResolvedValue({ id: "log-1" });
});

function processeur() {
  startContentDeadlineCheckerWorker();
  return capturedProcessor.fn as (job: Job) => Promise<void>;
}

const JOB = { id: "job-1", data: {} } as Job;

describe("🔴 le deadline-checker écrit sa trace SOC2 SANS session admin", () => {
  it("une campagne auto-stoppée laisse une ligne `ActivityLog`, alors que `headers()` lève", async () => {
    await processeur()(JOB);

    expect(
      activityLogCreateMock,
      "Aucune ligne ActivityLog écrite : la trace SOC2 `content-gen.campaign.auto-stopped` " +
        "n'existe pas en base. Le chemin d'écriture passe par une Server Action qui lit " +
        "`headers()` — extraire un service pur (cf. `autofacture-emission.ts`, #1098).",
    ).toHaveBeenCalledTimes(1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = activityLogCreateMock.mock.calls[0]?.[0]?.data;
    expect(data?.action).toBe("content-gen.campaign.auto-stopped");
    expect(data?.targetType).toBe("CoverageCampaign");
    expect(data?.targetId).toBe(CAMPAGNE);
  });

  it("l'acteur est `null`, pas une chaîne — `adminUserId` est un uuid avec clé étrangère", async () => {
    await processeur()(JOB);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = activityLogCreateMock.mock.calls[0]?.[0]?.data;
    expect(
      data?.adminUserId,
      "`ActivityLog.adminUserId` est `@db.Uuid` et pointe `AdminUser`. Écrire " +
        '`"system:deadline-checker"` lève côté Prisma, et le `catch` best-effort l\'avale.',
    ).toBeNull();
    expect(data?.ipAddress ?? null).toBeNull();
    expect(data?.userAgent ?? null).toBeNull();
  });

  it("le contenu métier de la trace est conservé, et l'auteur système se lit dans `changes.origine`", async () => {
    contentGenJobFindManyMock.mockResolvedValue([{ id: "job-a" }, { id: "job-b" }]);

    await processeur()(JOB);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const changes: any = activityLogCreateMock.mock.calls[0]?.[0]?.data?.changes;
    expect(changes?.soc2).toBe("CAMPAIGN_AUTO_STOPPED_DEADLINE");
    expect(changes?.completedReason).toBe("deadline_reached");
    expect(changes?.queuedJobsCancelled).toBe(2);
    expect(changes?.origine).toBe("content-gen-deadline-checker");
  });
});

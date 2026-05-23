/**
 * Sprint v7 Phase 1 commit 2 — Tests cities-order server actions.
 *
 * Pattern : mock @/lib/prisma + ./_auth + activity-log + Sentry, import
 * direct des actions. 6 cases minimum (cf. SPRINT-V7-SESSION-2-BRIEF.md) :
 *   1. reorderCities atomique : batch update tous les ranks (2-pass pattern)
 *   2. reorderCities Zod rejette inputs invalides
 *   3. reorderCities rejette doublons slugs
 *   4. pinCity toggle + pinnedAt now/null
 *   5. getCoverageStats agg 3 buckets distincts D13
 *   6. requireAdminWriteRateLimited 429 propagé via throw
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const findManyMock = vi.fn();
const countMock = vi.fn();
const updateMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cityGenerationOrder: {
      findMany: (args: unknown) => findManyMock(args),
      count: (args: unknown) => countMock(args),
      update: (args: unknown) => updateMock(args),
    },
    contentGenJob: {
      count: (args: unknown) => countMock(args),
    },
    $transaction: (cb: (tx: unknown) => Promise<void>) => transactionMock(cb),
  },
}));

const requireAdminMock = vi.fn();
const requireAdminWriteRateLimitedMock = vi.fn();

vi.mock("../_auth", () => ({
  requireAdmin: () => requireAdminMock(),
  requireAdminWriteRateLimited: (actionId: string, opts: unknown) =>
    requireAdminWriteRateLimitedMock(actionId, opts),
}));

const logActivityMock = vi.fn();
vi.mock("@/server/content-gen/shared/activity-log", () => ({
  logActivity: (input: unknown) => logActivityMock(input),
}));

const captureExceptionMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ─── Imports sous test (après mocks) ────────────────────────────────────────

import { getCoverageStats, pinCity, reorderCities } from "../cities-order";

const ADMIN_SESSION = { userId: "u1", email: "will@axion-ia.com", role: "super_admin" };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(ADMIN_SESSION);
  requireAdminWriteRateLimitedMock.mockResolvedValue(ADMIN_SESSION);
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("reorderCities — Sprint v7 Phase 1 commit 2", () => {
  it("1 — applique l'ordre atomique via 2-pass transaction (neg temp ranks puis positifs)", async () => {
    // Pre-check count = nombre de slugs (tous existent)
    countMock.mockResolvedValueOnce(3);

    const txUpdates: Array<{ slug: string; rank: number }> = [];
    transactionMock.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      const tx = {
        cityGenerationOrder: {
          update: ({ where, data }: { where: { villeSlug: string }; data: { rank: number } }) => {
            txUpdates.push({ slug: where.villeSlug, rank: data.rank });
            return Promise.resolve();
          },
        },
      };
      await cb(tx);
    });

    await reorderCities({ slugs: ["paris", "lyon", "marseille"] });

    // 2-pass = 6 updates total : 3 négatifs + 3 positifs
    expect(txUpdates).toHaveLength(6);
    // Pass 1 : ranks négatifs uniques
    expect(txUpdates[0]).toEqual({ slug: "paris", rank: -1_000_000 });
    expect(txUpdates[1]).toEqual({ slug: "lyon", rank: -1_000_001 });
    expect(txUpdates[2]).toEqual({ slug: "marseille", rank: -1_000_002 });
    // Pass 2 : ranks positifs 1..N
    expect(txUpdates[3]).toEqual({ slug: "paris", rank: 1 });
    expect(txUpdates[4]).toEqual({ slug: "lyon", rank: 2 });
    expect(txUpdates[5]).toEqual({ slug: "marseille", rank: 3 });

    // Rate-limit + audit log triggered
    expect(requireAdminWriteRateLimitedMock).toHaveBeenCalledWith("cities-reorder", {
      limit: 30,
      windowSec: 60,
    });
    expect(logActivityMock).toHaveBeenCalledOnce();
  });

  it("2 — rejette Zod inputs invalides (slugs vide, > 2200, non-array)", async () => {
    // slugs vide
    await expect(reorderCities({ slugs: [] })).rejects.toThrow();
    // slugs > 2200
    await expect(
      reorderCities({ slugs: Array.from({ length: 2201 }, (_, i) => `v${i}`) }),
    ).rejects.toThrow();
    // input non-objet
    await expect(reorderCities("not-an-object")).rejects.toThrow();
    // slug avec string vide rejeté par Zod min(1)
    await expect(reorderCities({ slugs: [""] })).rejects.toThrow();

    // Zod parse est AVANT try/catch (validation user input != exception
    // applicative à investiguer). Sentry NE doit PAS être appelé.
    // Transaction non démarrée non plus.
    expect(captureExceptionMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("3 — rejette doublons slugs avec error 'duplicate_slugs'", async () => {
    await expect(reorderCities({ slugs: ["paris", "lyon", "paris"] })).rejects.toThrow(
      "duplicate_slugs",
    );
    // Doit short-circuit AVANT transaction
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

describe("pinCity — Sprint v7 Phase 1 commit 2", () => {
  it("4 — toggle pinned=true set pinnedAt = now(), pinned=false set null", async () => {
    updateMock.mockResolvedValue({});

    const beforePin = Date.now();
    await pinCity({ slug: "paris", pinned: true });
    const afterPin = Date.now();

    expect(updateMock).toHaveBeenCalledOnce();
    const pinArgs = updateMock.mock.calls[0]![0] as {
      where: { villeSlug: string };
      data: { pinned: boolean; pinnedAt: Date | null };
    };
    expect(pinArgs.where.villeSlug).toBe("paris");
    expect(pinArgs.data.pinned).toBe(true);
    expect(pinArgs.data.pinnedAt).toBeInstanceOf(Date);
    expect(pinArgs.data.pinnedAt!.getTime()).toBeGreaterThanOrEqual(beforePin);
    expect(pinArgs.data.pinnedAt!.getTime()).toBeLessThanOrEqual(afterPin);

    // Unpin clear pinnedAt
    updateMock.mockClear();
    await pinCity({ slug: "paris", pinned: false });
    const unpinArgs = updateMock.mock.calls[0]![0] as {
      data: { pinned: boolean; pinnedAt: Date | null };
    };
    expect(unpinArgs.data.pinned).toBe(false);
    expect(unpinArgs.data.pinnedAt).toBeNull();

    // logActivity action différenciée pin vs unpin
    const actions = logActivityMock.mock.calls.map((c) => (c[0] as { action: string }).action);
    expect(actions).toContain("content-gen.cities-order.pin");
    expect(actions).toContain("content-gen.cities-order.unpin");
  });
});

describe("getCoverageStats — Sprint v7 Phase 1 commit 2", () => {
  it("5 — agrège 3 buckets distincts (editorial / landings / rss) par villeSlug", async () => {
    // 3 queries en parallèle : editorial(in:[7 types]) / landings(landing_ville) / rss(blog_from_rss)
    countMock
      .mockResolvedValueOnce(42) // editorial
      .mockResolvedValueOnce(3) // landings
      .mockResolvedValueOnce(7); // rss

    const stats = await getCoverageStats("paris");

    expect(stats).toEqual({ coveredEditorial: 42, coveredLandings: 3, coveredRss: 7 });
    expect(countMock).toHaveBeenCalledTimes(3);

    // Bucket editorial : ContentType `in` array de 7 types
    const editorialCall = countMock.mock.calls[0]![0] as {
      where: { contentType: { in: string[] }; status: string; anchorVilleSlug: string };
    };
    expect(editorialCall.where.status).toBe("published");
    expect(editorialCall.where.anchorVilleSlug).toBe("paris");
    expect(editorialCall.where.contentType.in).toEqual(
      expect.arrayContaining([
        "blog_article",
        "blog_from_keywords",
        "blog_from_title",
        "comparison",
        "guide_pilier",
        "qa_derived",
        "faq_standalone",
      ]),
    );
    expect(editorialCall.where.contentType.in).toHaveLength(7);

    // Bucket landings : ContentType scalar landing_ville
    const landingsCall = countMock.mock.calls[1]![0] as {
      where: { contentType: string };
    };
    expect(landingsCall.where.contentType).toBe("landing_ville");

    // Bucket rss : ContentType scalar blog_from_rss
    const rssCall = countMock.mock.calls[2]![0] as {
      where: { contentType: string };
    };
    expect(rssCall.where.contentType).toBe("blog_from_rss");
  });
});

describe("rate-limit — Sprint v7 Phase 1 commit 2", () => {
  it("6 — propage l'erreur rate_limited de requireAdminWriteRateLimited", async () => {
    requireAdminWriteRateLimitedMock.mockRejectedValueOnce(
      new Error("rate_limited:cities-reorder:31/30"),
    );

    await expect(reorderCities({ slugs: ["paris", "lyon"] })).rejects.toThrow(
      "rate_limited:cities-reorder:31/30",
    );

    // Sentry NE doit PAS être appelé sur rate-limit (Will/audit normal usage,
    // pas une exception applicative à investiguer) — l'erreur est levée AVANT
    // d'entrer dans le try/catch du body de l'action.
    expect(captureExceptionMock).not.toHaveBeenCalled();
    // Transaction non démarrée non plus.
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

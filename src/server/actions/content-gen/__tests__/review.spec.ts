/**
 * Tests — Review queue server actions (review.ts)
 *
 * Couvre : approveReview, rejectReview, requestEdits, promoteToTier1,
 *          bulkApproveReviews, bulkRejectReviews, listReview, listReviewPaginated
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const authMock = vi.fn();
const reviewUpdateManyMock = vi.fn();
const reviewFindUniqueMock = vi.fn();
const reviewFindManyMock = vi.fn();
const reviewCountMock = vi.fn();
const reviewUpdateMock = vi.fn();
const jobUpdateMock = vi.fn();
const transactionMock = vi.fn();
const activityLogMock = vi.fn();
const revalidatePathMock = vi.fn();
const queueAddMock = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reviewQueue: {
      updateMany: (args: unknown) => reviewUpdateManyMock(args),
      findUnique: (args: unknown) => reviewFindUniqueMock(args),
      findMany: (args: unknown) => reviewFindManyMock(args),
      count: (args: unknown) => reviewCountMock(args),
      update: (args: unknown) => reviewUpdateMock(args),
    },
    contentGenJob: {
      update: (args: unknown) => jobUpdateMock(args),
    },
    $transaction: (ops: unknown) => transactionMock(ops),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePathMock(p) }));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: (...args: unknown[]) => queueAddMock(...args),
  })),
}));

vi.mock("@/server/content-gen/shared/activity-log", () => ({
  logActivity: (...args: unknown[]) => activityLogMock(...args),
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
  approveReview,
  rejectReview,
  requestEdits,
  promoteToTier1,
  bulkApproveReviews,
  bulkRejectReviews,
  listReview,
  listReviewPaginated,
} from "../review";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ADMIN_SESSION = {
  user: { id: "admin-1", email: "admin@axion-ia.com", role: "admin" },
};

function makeReviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rev-1",
    jobId: "job-1",
    status: "pending",
    reviewedBy: null,
    reviewNotes: null,
    reviewedAt: null,
    promotedToTier1At: null,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    job: {
      contentType: "blog_article",
      anchorVilleSlug: "paris",
      qualityScore: 80,
      seoScore: 75,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REDIS_URL = "redis://test.invalid:6379";
  authMock.mockResolvedValue(ADMIN_SESSION);
  reviewUpdateManyMock.mockResolvedValue({ count: 1 });
  reviewFindUniqueMock.mockResolvedValue({ jobId: "job-1", status: "pending" });
  reviewFindManyMock.mockResolvedValue([makeReviewRow()]);
  reviewCountMock.mockResolvedValue(1);
  jobUpdateMock.mockResolvedValue({ id: "job-1" });
  activityLogMock.mockResolvedValue(undefined);
  revalidatePathMock.mockReturnValue(undefined);
  queueAddMock.mockResolvedValue({ id: "bull-1" });
  // $transaction: execute each item if it's a promise (array form)
  transactionMock.mockImplementation(async (ops: unknown[]) => {
    for (const op of ops) await op;
  });
});

// ─── approveReview ────────────────────────────────────────────────────────────

describe("approveReview", () => {
  it("appelle updateMany avec status=approved et userId admin", async () => {
    await approveReview("rev-1");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = reviewUpdateManyMock.mock.calls[0] as [{ where: any; data: any }];
    expect(call[0].where).toMatchObject({ id: "rev-1", status: "pending" });
    expect(call[0].data.status).toBe("approved");
    expect(call[0].data.reviewedBy).toBe("admin-1");
  });

  it("throw si pas de session admin", async () => {
    authMock.mockResolvedValue(null);
    await expect(approveReview("rev-1")).rejects.toThrow("unauthorized");
  });

  it("throw ReviewAlreadyTransitionedError si count=0", async () => {
    reviewUpdateManyMock.mockResolvedValue({ count: 0 });
    reviewFindUniqueMock.mockResolvedValue({ status: "approved" });
    await expect(approveReview("rev-1")).rejects.toThrow("review_already_transitioned");
  });

  it("throw ZodError si id vide", async () => {
    await expect(approveReview("")).rejects.toThrow();
  });

  it("appelle revalidatePath après approbation", async () => {
    await approveReview("rev-1");
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it("appelle logActivity avec action approve", async () => {
    await approveReview("rev-1", "looks good");
    expect(activityLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "content-gen.review.approve" }),
    );
  });
});

// ─── rejectReview ─────────────────────────────────────────────────────────────

describe("rejectReview", () => {
  it("appelle updateMany avec status=rejected", async () => {
    await rejectReview("rev-1", "contenu trop court ici");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = reviewUpdateManyMock.mock.calls[0] as [{ where: any; data: any }];
    expect(call[0].data.status).toBe("rejected");
    expect(call[0].where).toMatchObject({ id: "rev-1", status: "pending" });
  });

  it("throw si notes trop courtes (<5 chars)", async () => {
    await expect(rejectReview("rev-1", "ok")).rejects.toThrow("notes_required");
  });

  it("throw ReviewAlreadyTransitionedError si count=0", async () => {
    reviewUpdateManyMock.mockResolvedValue({ count: 0 });
    reviewFindUniqueMock.mockResolvedValue({ status: "rejected" });
    await expect(rejectReview("rev-1", "notes suffisamment longues")).rejects.toThrow(
      "review_already_transitioned",
    );
  });

  it("appelle logActivity avec action reject", async () => {
    await rejectReview("rev-1", "trop court et mal formaté");
    expect(activityLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "content-gen.review.reject" }),
    );
  });
});

// ─── requestEdits ─────────────────────────────────────────────────────────────

describe("requestEdits", () => {
  it("appelle $transaction pour update review + job", async () => {
    await requestEdits("rev-1", "veuillez ajouter plus de détails concrets");
    expect(transactionMock).toHaveBeenCalled();
  });

  it("throw si comment trop court (<10 chars)", async () => {
    // 9 chars — below the 10-char minimum enforced after Zod
    await expect(requestEdits("rev-1", "court123")).rejects.toThrow("comment_required");
  });

  it("throw review_not_found si review introuvable", async () => {
    reviewFindUniqueMock.mockResolvedValue(null);
    await expect(requestEdits("rev-1", "commentaire suffisamment long")).rejects.toThrow(
      "review_not_found",
    );
  });

  it("throw review_not_pending si review déjà traitée", async () => {
    reviewFindUniqueMock.mockResolvedValue({ jobId: "job-1", status: "approved" });
    await expect(requestEdits("rev-1", "commentaire suffisamment long")).rejects.toThrow(
      "review_not_pending",
    );
  });

  it("appelle logActivity avec action request-edits", async () => {
    await requestEdits("rev-1", "merci d'ajouter des sources et de reformuler l'intro");
    expect(activityLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "content-gen.review.request-edits" }),
    );
  });
});

// ─── promoteToTier1 ───────────────────────────────────────────────────────────

describe("promoteToTier1", () => {
  it("appelle updateMany avec status=promoted_t1", async () => {
    reviewFindUniqueMock
      .mockResolvedValueOnce({ jobId: "job-1", status: "pending" }) // pour le findUnique post-update
      .mockResolvedValueOnce({ jobId: "job-1" }); // pour récupérer jobId après
    await promoteToTier1("rev-1");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = reviewUpdateManyMock.mock.calls[0] as [{ data: any }];
    expect(call[0].data.status).toBe("promoted_t1");
    expect(call[0].data.promotedToTier1At).toBeInstanceOf(Date);
  });

  it("throw ReviewAlreadyTransitionedError si count=0", async () => {
    reviewUpdateManyMock.mockResolvedValue({ count: 0 });
    reviewFindUniqueMock.mockResolvedValue({ status: "rejected" });
    await expect(promoteToTier1("rev-1")).rejects.toThrow("review_already_transitioned");
  });

  it("appelle logActivity avec action promote-tier1", async () => {
    reviewFindUniqueMock.mockResolvedValue({ jobId: "job-1" });
    await promoteToTier1("rev-1");
    expect(activityLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "content-gen.review.promote-tier1" }),
    );
  });
});

// ─── bulkApproveReviews ───────────────────────────────────────────────────────

describe("bulkApproveReviews", () => {
  it("retourne { approved: N } après upsert en boucle", async () => {
    reviewFindManyMock.mockResolvedValue([
      { id: "rev-1", job: { id: "job-1" } },
      { id: "rev-2", job: { id: "job-2" } },
    ]);
    reviewUpdateMock.mockResolvedValue({ id: "rev-1" });
    const result = await bulkApproveReviews(75, 50);
    expect(result.approved).toBe(2);
  });

  it("throw ZodError si minScore hors [0,100]", async () => {
    await expect(bulkApproveReviews(150)).rejects.toThrow();
  });

  it("appelle logActivity bulk-approve", async () => {
    reviewFindManyMock.mockResolvedValue([{ id: "rev-1", job: { id: "job-1" } }]);
    reviewUpdateMock.mockResolvedValue({ id: "rev-1" });
    await bulkApproveReviews(75);
    expect(activityLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "content-gen.review.bulk-approve" }),
    );
  });
});

// ─── bulkRejectReviews ────────────────────────────────────────────────────────

describe("bulkRejectReviews", () => {
  it("retourne { rejected: 0 } si aucun candidat", async () => {
    reviewFindManyMock.mockResolvedValue([]);
    const result = await bulkRejectReviews(50);
    expect(result.rejected).toBe(0);
  });

  it("appelle updateMany avec ids des candidats", async () => {
    reviewFindManyMock.mockResolvedValue([{ id: "rev-1" }, { id: "rev-2" }]);
    reviewUpdateManyMock.mockResolvedValue({ count: 2 });
    const result = await bulkRejectReviews(50);
    expect(result.rejected).toBe(2);
  });
});

// ─── listReview / listReviewPaginated ─────────────────────────────────────────

describe("listReview", () => {
  it("retourne les rows mappées depuis prisma.findMany", async () => {
    const rows = await listReview();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe("rev-1");
    expect(rows[0]!.jobContentType).toBe("blog_article");
  });

  it("filtre par status si fourni", async () => {
    await listReview("pending");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = reviewFindManyMock.mock.calls[0] as [{ where: any }];
    expect(call[0].where).toMatchObject({ status: "pending" });
  });
});

describe("listReviewPaginated", () => {
  it("retourne total, page, totalPages, rows", async () => {
    reviewCountMock.mockResolvedValue(55);
    reviewFindManyMock.mockResolvedValue([makeReviewRow()]);
    const result = await listReviewPaginated(undefined, 1);
    expect(result.total).toBe(55);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(2); // 55/50 = 2 pages
    expect(result.rows).toHaveLength(1);
  });
});

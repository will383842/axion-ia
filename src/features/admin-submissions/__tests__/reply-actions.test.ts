// Tests reply-actions (Sprint Notif Infra 2026-05-26 / Chantier 5).
//
// On mocke `@/auth` (RBAC), `@/lib/prisma` (DB) et `@/server/queue/queues`
// (BullMQ) pour tester l'ensemble Server Actions sans dependances externes.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks ---------------------------------------------------------------------

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const enqueueEmailMock = vi.fn();
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...args: unknown[]) => enqueueEmailMock(...args),
}));

const renderEmailTemplateMock = vi.fn().mockResolvedValue({
  subject: "Re: test",
  html: "<p>Hello</p>",
  text: "Hello",
});
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...args: unknown[]) => renderEmailTemplateMock(...args),
}));

const submissionFindUnique = vi.fn();
const submissionReplyCreate = vi.fn();
const submissionReplyFindUnique = vi.fn();
const submissionReplyUpdate = vi.fn();
const submissionUpdate = vi.fn();
const submissionUpdateMany = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findUnique: (...args: unknown[]) => submissionFindUnique(...args),
      update: (...args: unknown[]) => submissionUpdate(...args),
      updateMany: (...args: unknown[]) => submissionUpdateMany(...args),
    },
    submissionReply: {
      create: (...args: unknown[]) => submissionReplyCreate(...args),
      findUnique: (...args: unknown[]) => submissionReplyFindUnique(...args),
      update: (...args: unknown[]) => submissionReplyUpdate(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => transactionMock(fn),
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

// ---------------------------------------------------------------------------

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
const REPLY_ID = "ckxxxxxx";

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({
    user: { id: "admin-1", role: "admin", name: "Will" },
  });
  // enqueueEmail renvoie désormais { enqueued: boolean } (retour détectable).
  enqueueEmailMock.mockResolvedValue({ enqueued: true });
});

describe("replyToSubmissionAction", () => {
  it("happy path — crée reply + enqueue + retourne replyId", async () => {
    submissionFindUnique.mockResolvedValueOnce({
      id: VALID_UUID,
      contactEmail: "user@example.com",
      locale: "fr",
      status: "new",
      firstRepliedAt: null,
    });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      // Provide a tx with the same shape as prisma
      return fn({
        submissionReply: { create: () => ({ id: REPLY_ID }) },
        submission: { update: () => ({}) },
      });
    });
    const { replyToSubmissionAction } = await import("../reply-actions");
    const result = await replyToSubmissionAction({
      submissionId: VALID_UUID,
      subject: "Re: votre demande",
      bodyMarkdown: "Bonjour,\n\nMerci pour votre message.",
    });
    expect(result).toEqual({ ok: true, replyId: REPLY_ID });
    expect(renderEmailTemplateMock).toHaveBeenCalledWith(
      "submission-reply",
      "fr",
      expect.objectContaining({ subject: "Re: votre demande" }),
    );
    // Sécurité : plus de PII (email en clair) dans le payload de queue — le
    // worker re-déchiffre l'adresse depuis la DB. L'arg `to` est donc vide.
    expect(enqueueEmailMock).toHaveBeenCalledWith(
      "submission-reply",
      "",
      "fr",
      expect.objectContaining({ replyId: REPLY_ID }),
    );
  });

  it("RBAC : non-admin → unauthorized", async () => {
    authMock.mockResolvedValueOnce(null);
    const { replyToSubmissionAction } = await import("../reply-actions");
    const result = await replyToSubmissionAction({
      submissionId: VALID_UUID,
      subject: "S",
      bodyMarkdown: "B",
    });
    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("submission inexistante → submission_not_found", async () => {
    submissionFindUnique.mockResolvedValueOnce(null);
    const { replyToSubmissionAction } = await import("../reply-actions");
    const result = await replyToSubmissionAction({
      submissionId: VALID_UUID,
      subject: "Re: subject valide",
      bodyMarkdown: "Body content",
    });
    expect(result).toEqual({ ok: false, error: "submission_not_found" });
  });

  it("Zod validation : subject vide → erreur", async () => {
    const { replyToSubmissionAction } = await import("../reply-actions");
    const result = await replyToSubmissionAction({
      submissionId: VALID_UUID,
      subject: "",
      bodyMarkdown: "B",
    });
    expect(result.ok).toBe(false);
  });
});

describe("archiveSubmissionAction", () => {
  it("archive un id valide → status=archived + archivedAt set", async () => {
    submissionUpdate.mockResolvedValueOnce({});
    const { archiveSubmissionAction } = await import("../reply-actions");
    const result = await archiveSubmissionAction(VALID_UUID);
    expect(result).toEqual({ ok: true });
    expect(submissionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_UUID },
        data: expect.objectContaining({ status: "archived" }),
      }),
    );
  });

  it("RBAC : non-admin → ok=false", async () => {
    authMock.mockResolvedValueOnce(null);
    const { archiveSubmissionAction } = await import("../reply-actions");
    const result = await archiveSubmissionAction(VALID_UUID);
    expect(result).toEqual({ ok: false });
    expect(submissionUpdate).not.toHaveBeenCalled();
  });
});

describe("bulkArchiveSubmissionsAction", () => {
  it("archive 3 items → archived=3", async () => {
    submissionUpdateMany.mockResolvedValueOnce({ count: 3 });
    const { bulkArchiveSubmissionsAction } = await import("../reply-actions");
    const ids = [
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      "33333333-3333-3333-3333-333333333333",
    ];
    const result = await bulkArchiveSubmissionsAction(ids);
    expect(result).toEqual({ archived: 3 });
  });

  it("ids vide → archived=0 (Zod refuse)", async () => {
    const { bulkArchiveSubmissionsAction } = await import("../reply-actions");
    const result = await bulkArchiveSubmissionsAction([]);
    expect(result).toEqual({ archived: 0 });
    expect(submissionUpdateMany).not.toHaveBeenCalled();
  });
});

describe("markNeedsAttentionAction", () => {
  it("toggle needsAttention=true", async () => {
    submissionUpdate.mockResolvedValueOnce({});
    const { markNeedsAttentionAction } = await import("../reply-actions");
    const result = await markNeedsAttentionAction(VALID_UUID, true);
    expect(result).toEqual({ ok: true });
    expect(submissionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_UUID },
        data: { needsAttention: true },
      }),
    );
  });
});

describe("retryFailedReplyAction", () => {
  it("reply failed → reset pending + re-enqueue", async () => {
    submissionReplyFindUnique.mockResolvedValueOnce({
      id: REPLY_ID,
      toEmail: "u@e.com",
      subject: "S",
      submissionId: VALID_UUID,
      deliveryStatus: "failed",
      submission: { id: VALID_UUID, locale: "fr" },
    });
    submissionReplyUpdate.mockResolvedValueOnce({});
    const { retryFailedReplyAction } = await import("../reply-actions");
    const result = await retryFailedReplyAction(REPLY_ID);
    expect(result).toEqual({ ok: true });
    expect(enqueueEmailMock).toHaveBeenCalledOnce();
  });

  it("reply déjà sent → not_retryable", async () => {
    submissionReplyFindUnique.mockResolvedValueOnce({
      id: REPLY_ID,
      deliveryStatus: "sent",
      submission: { id: VALID_UUID, locale: "fr" },
    });
    const { retryFailedReplyAction } = await import("../reply-actions");
    const result = await retryFailedReplyAction(REPLY_ID);
    expect(result).toEqual({ ok: false, error: "not_retryable" });
    expect(submissionReplyUpdate).not.toHaveBeenCalled();
    expect(enqueueEmailMock).not.toHaveBeenCalled();
  });
});

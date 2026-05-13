/** KB-4 — approveAction (review → approved) + rejectReviewAction (review → draft). */
"use server";

import { z } from "zod";
import { requireAdminWrite } from "./_guards";
import { executeTransition, type TransitionResult } from "./_transition";

const approveSchema = z.object({
  id: z.string().uuid(),
  reviewerNote: z.string().max(2000).optional().nullable(),
});

export async function approveAction(input: {
  id: string;
  reviewerNote?: string | null;
}): Promise<TransitionResult> {
  const session = await requireAdminWrite();
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  return executeTransition({
    entryId: parsed.data.id,
    toStatus: "approved",
    auditAction: "kb.approved",
    context: { userRole: session.role, userId: session.userId },
    snapshot: true,
    ...(parsed.data.reviewerNote
      ? { auditChanges: { reviewerNote: parsed.data.reviewerNote } }
      : {}),
  });
}

const rejectSchema = z.object({
  id: z.string().uuid(),
  rejectionReason: z.string().max(2000).optional().nullable(),
});

export async function rejectReviewAction(input: {
  id: string;
  rejectionReason?: string | null;
}): Promise<TransitionResult> {
  const session = await requireAdminWrite();
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  return executeTransition({
    entryId: parsed.data.id,
    toStatus: "draft",
    auditAction: "kb.draft.saved",
    context: { userRole: session.role, userId: session.userId },
    snapshot: true,
    ...(parsed.data.rejectionReason
      ? { auditChanges: { rejectionReason: parsed.data.rejectionReason } }
      : {}),
  });
}

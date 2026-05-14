/**
 * KB-4 — assignReviewerAction (manual V1 — round-robin auto en Sprint KB-17).
 */

"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { requireAdminWrite } from "./_guards";
import { logKbActivity } from "./_audit";
import { revalidateAdminKbRoutes } from "./_revalidate";

const inputSchema = z.object({
  entryId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  dueAt: z.coerce.date().optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export interface AssignReviewerResult {
  readonly ok: boolean;
  readonly assignmentId?: string;
  readonly error?: string;
}

export async function assignReviewerAction(input: {
  entryId: string;
  reviewerId: string;
  dueAt?: string | Date | null;
  note?: string | null;
}): Promise<AssignReviewerResult> {
  const session = await requireAdminWrite();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const [entry, reviewer] = await Promise.all([
    prisma.knowledgeEntry.findUnique({
      where: { id: parsed.data.entryId },
      select: { id: true, deletedAt: true, createdById: true },
    }),
    prisma.adminUser.findUnique({
      where: { id: parsed.data.reviewerId },
      select: { id: true, status: true },
    }),
  ]);
  if (!entry || entry.deletedAt) return { ok: false, error: "entry_not_found" };
  if (!reviewer || reviewer.status !== "active") return { ok: false, error: "reviewer_not_active" };

  if (entry.createdById && entry.createdById === reviewer.id) {
    return { ok: false, error: "self_review_refused" };
  }

  const headerList = await headers();
  const ip = await getClientIp();
  const ua = headerList.get("user-agent");

  try {
    const assignment = await prisma.knowledgeReviewerAssignment.upsert({
      where: {
        entryId_reviewerId: { entryId: parsed.data.entryId, reviewerId: parsed.data.reviewerId },
      },
      create: {
        entryId: parsed.data.entryId,
        reviewerId: parsed.data.reviewerId,
        assignedById: session.userId,
        status: "pending",
        ...(parsed.data.dueAt ? { dueAt: parsed.data.dueAt } : {}),
        ...(parsed.data.note ? { reviewerNote: parsed.data.note } : {}),
      },
      update: {
        assignedById: session.userId,
        status: "pending",
        ...(parsed.data.dueAt ? { dueAt: parsed.data.dueAt } : {}),
        ...(parsed.data.note ? { reviewerNote: parsed.data.note } : {}),
      },
      select: { id: true },
    });

    await prisma.knowledgeEntry.update({
      where: { id: parsed.data.entryId },
      data: { assignedReviewerId: parsed.data.reviewerId },
    });

    await logKbActivity({
      action: "kb.updated",
      entryId: parsed.data.entryId,
      adminUserId: session.userId,
      ipAddress: ip,
      userAgent: ua,
      changes: {
        reviewerAssigned: parsed.data.reviewerId,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt).toISOString() : null,
      },
    });

    await revalidateAdminKbRoutes(parsed.data.entryId);

    return { ok: true, assignmentId: assignment.id };
  } catch (err) {
    console.error("[kb.assignReviewer] error", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

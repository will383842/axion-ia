/**
 * Knowledge Base — wrapper d'audit ActivityLog pour events `kb.*`.
 *
 * Réutilise la table existante `ActivityLog` (cf. Agent 8 §08-WORKFLOW-VERSIONING).
 * V1 (KB-3) : 4 events couverts — `kb.created`, `kb.updated`, `kb.draft.saved`,
 * `kb.deleted`. Extensions KB-4 / KB-5+ ajouteront les autres.
 */

"use server";

import { prisma } from "@/lib/prisma";

export type KbActivityAction =
  | "kb.created"
  | "kb.updated"
  | "kb.draft.saved"
  | "kb.deleted"
  | "kb.restored"
  | "kb.submitted_for_review"
  | "kb.approved"
  | "kb.scheduled"
  | "kb.published"
  | "kb.unpublished"
  | "kb.archived";

export interface KbAuditPayload {
  readonly action: KbActivityAction;
  readonly entryId: string;
  readonly adminUserId: string;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly changes?: Record<string, unknown>;
}

export async function logKbActivity(payload: KbAuditPayload): Promise<void> {
  await prisma.activityLog.create({
    data: {
      adminUserId: payload.adminUserId,
      action: payload.action,
      targetType: "KnowledgeEntry",
      targetId: payload.entryId,
      ...(payload.changes ? { changes: payload.changes as object } : {}),
      ipAddress: payload.ipAddress ?? null,
      userAgent: payload.userAgent ?? null,
    },
  });
}

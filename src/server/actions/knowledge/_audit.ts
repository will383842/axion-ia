/**
 * Knowledge Base — wrapper d'audit ActivityLog pour events `kb.*`.
 *
 * Réutilise la table existante `ActivityLog` (cf. Agent 8 §08-WORKFLOW-VERSIONING).
 * V1 (KB-3) : 4 events couverts — `kb.created`, `kb.updated`, `kb.draft.saved`,
 * `kb.deleted`. Extensions KB-4 / KB-5+ ajouteront les autres.
 *
 * 🔴 2026-08-19 — retrait de `"use server"` : `logKbActivity` écrit une ligne
 * d'`ActivityLog` à partir d'un `adminUserId`, d'une IP et d'un user-agent
 * FOURNIS PAR L'APPELANT. Exposée comme Server Action, elle laissait n'importe
 * quel client fabriquer des entrées de piste d'audit au nom d'un autre admin —
 * un journal falsifiable ne prouve rien. Appelée uniquement par les Server
 * Actions KB, gardées ; aucun composant client ne l'importe. Défense en
 * profondeur, même geste que `ingest.ts` (P0-S1-1).
 */

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

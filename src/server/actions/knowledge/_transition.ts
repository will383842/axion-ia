/**
 * KB-4 — Helper transition générique workflow.
 * Encapsule : lecture entry → validate state machine → snapshot version → update + audit + revalidate.
 */

"use server";

import { headers } from "next/headers";
import type { KbStatus, Prisma } from "../../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { makeEntrySnapshot } from "@/lib/knowledge/snapshot";
import { validateTransition, type TransitionContext } from "@/lib/knowledge/state-machine";
import { logKbActivity, type KbActivityAction } from "./_audit";
import { revalidateAdminKbRoutes, revalidatePublicKbRoutes } from "./_revalidate";

export interface TransitionResult {
  readonly ok: boolean;
  readonly newStatus?: KbStatus;
  readonly versionId?: string;
  readonly error?: string;
  readonly reason?: string;
}

export interface TransitionInput {
  readonly entryId: string;
  readonly toStatus: KbStatus;
  readonly auditAction: KbActivityAction;
  readonly context: TransitionContext;
  readonly extraEntryUpdates?: Prisma.KnowledgeEntryUpdateInput;
  readonly auditChanges?: Record<string, unknown>;
  readonly snapshot?: boolean;
}

export async function executeTransition(input: TransitionInput): Promise<TransitionResult> {
  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id: input.entryId },
    include: {
      translations: true,
      tags: { include: { tag: { select: { slug: true } } } },
      outgoingRelations: true,
    },
  });

  if (!entry) return { ok: false, error: "not_found" };
  if (entry.deletedAt) return { ok: false, error: "deleted" };

  const decision = validateTransition(entry.status, input.toStatus, {
    ...input.context,
    authorId: entry.createdById,
  });
  if (!decision.ok) {
    return {
      ok: false,
      error: "transition_refused",
      ...(decision.reason ? { reason: decision.reason } : {}),
    };
  }

  const headerList = await headers();
  const ip = await getClientIp();
  const ua = headerList.get("user-agent");

  let nextVersion = 1;
  if (input.snapshot) {
    const lastVersion = await prisma.knowledgeVersion.findFirst({
      where: { entryId: input.entryId, translationId: null },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    nextVersion = (lastVersion?.version ?? 0) + 1;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let versionId: string | null = null;
      if (input.snapshot) {
        const snap = makeEntrySnapshot({
          entry,
          translations: entry.translations,
          tags: entry.tags as never,
          outgoingRelations: entry.outgoingRelations,
        });
        const created = await tx.knowledgeVersion.create({
          data: {
            entryId: input.entryId,
            version: nextVersion,
            snapshotJson: snap as unknown as object,
            createdById: input.context.userId,
          },
          select: { id: true },
        });
        versionId = created.id;
      }

      await tx.knowledgeEntry.update({
        where: { id: input.entryId },
        data: {
          status: input.toStatus,
          updatedById: input.context.userId,
          ...input.extraEntryUpdates,
        },
      });

      return { versionId };
    });

    await logKbActivity({
      action: input.auditAction,
      entryId: input.entryId,
      adminUserId: input.context.userId,
      ipAddress: ip,
      userAgent: ua,
      changes: {
        fromStatus: entry.status,
        toStatus: input.toStatus,
        ...(result.versionId ? { versionId: result.versionId } : {}),
        ...(input.auditChanges ?? {}),
      },
    });

    revalidateAdminKbRoutes(input.entryId);
    if (
      input.toStatus === "published" ||
      input.toStatus === "deprecated" ||
      entry.status === "published"
    ) {
      revalidatePublicKbRoutes(entry.type);
    }

    return {
      ok: true,
      newStatus: input.toStatus,
      ...(result.versionId ? { versionId: result.versionId } : {}),
    };
  } catch (err) {
    console.error(`[kb.transition ${input.auditAction}] error`, err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

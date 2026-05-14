/**
 * KB-3 — Server action deleteEntryAction (soft-delete via deletedAt).
 *
 * Pas de hard-delete V1 (récupération possible via retention-purge cron > 30j).
 * Audit log `kb.deleted` + revalidation.
 *
 * Permission : super_admin uniquement (cf. Agent 9 matrice RBAC).
 */

"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { requireAdminDelete } from "./_guards";
import { logKbActivity } from "./_audit";
import { revalidateAdminKbRoutes, revalidatePublicKbRoutes } from "./_revalidate";
import { deleteEntryInputSchema, type DeleteEntryInput } from "./_zod-schemas";

export interface DeleteEntryResult {
  readonly ok: boolean;
  readonly error?: string;
}

export async function deleteEntryAction(input: DeleteEntryInput): Promise<DeleteEntryResult> {
  const session = await requireAdminDelete();

  const parsed = deleteEntryInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, type: true, deletedAt: true, status: true },
  });

  if (!entry) {
    return { ok: false, error: "not_found" };
  }
  if (entry.deletedAt) {
    return { ok: false, error: "already_deleted" };
  }

  const headerList = await headers();
  const ip = await getClientIp();
  const ua = headerList.get("user-agent");

  try {
    await prisma.knowledgeEntry.update({
      where: { id: parsed.data.id },
      data: {
        deletedAt: new Date(),
        updatedById: session.userId,
      },
    });

    await logKbActivity({
      action: "kb.deleted",
      entryId: parsed.data.id,
      adminUserId: session.userId,
      ipAddress: ip,
      userAgent: ua,
      changes: { previousStatus: entry.status },
    });

    await revalidateAdminKbRoutes(parsed.data.id);
    if (entry.status === "published" || entry.status === "deprecated") {
      await revalidatePublicKbRoutes(entry.type);
    }

    return { ok: true };
  } catch (err) {
    console.error("[kb.deleteEntry] error", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

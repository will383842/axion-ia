/**
 * KB-3 — Server action updateEntry (PATCH style — champs métadonnées seulement).
 *
 * Modifie les champs Entry-level (type/domain/audience/confidentiality/status/
 * pipelineStage/slug/brief). Les translations sont gérées via saveDraftAction.
 */

"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { requireAdminWrite } from "./_guards";
import { logKbActivity } from "./_audit";
import { revalidateAdminKbRoutes, revalidatePublicKbRoutes } from "./_revalidate";
import { updateEntryInputSchema, type UpdateEntryInput } from "./_zod-schemas";
import type {
  KbAudience,
  KbConfidentiality,
  KbDomain,
  KbPipelineStage,
  KbStatus,
  KbType,
} from "../../../../prisma/generated/client";

export interface UpdateEntryResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

export async function updateEntryAction(input: UpdateEntryInput): Promise<UpdateEntryResult> {
  const session = await requireAdminWrite();

  const parsed = updateEntryInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  // Vérifier existence + soft-delete
  const existing = await prisma.knowledgeEntry.findUnique({
    where: { id: data.id },
    select: { id: true, type: true, slug: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) {
    return { ok: false, error: "not_found" };
  }

  // Si slug change : vérifier unicité + créer ligne KnowledgeSlugHistory
  if (data.slug && data.slug !== existing.slug) {
    const slugConflict = await prisma.knowledgeEntry.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (slugConflict) {
      return { ok: false, error: "slug_already_used" };
    }
  }

  const headerList = await headers();
  const ip = await getClientIp();
  const ua = headerList.get("user-agent");

  try {
    await prisma.$transaction(async (tx) => {
      // Slug history si renommage
      if (data.slug && data.slug !== existing.slug) {
        await tx.knowledgeSlugHistory.create({
          data: {
            oldLocale: "fr",
            oldType: existing.type,
            oldSlug: existing.slug,
            entryId: existing.id,
            reason: "rename_via_update_entry_action",
          },
        });
      }

      await tx.knowledgeEntry.update({
        where: { id: data.id },
        data: {
          ...(data.type ? { type: data.type as KbType } : {}),
          ...(data.domain ? { domain: data.domain as KbDomain } : {}),
          ...(data.audience ? { audience: data.audience as KbAudience } : {}),
          ...(data.confidentiality
            ? { confidentiality: data.confidentiality as KbConfidentiality }
            : {}),
          ...(data.status ? { status: data.status as KbStatus } : {}),
          ...(data.pipelineStage ? { pipelineStage: data.pipelineStage as KbPipelineStage } : {}),
          ...(data.slug ? { slug: data.slug } : {}),
          ...(data.briefMarkdown !== undefined ? { briefMarkdown: data.briefMarkdown } : {}),
          ...(data.targetWordCount !== undefined ? { targetWordCount: data.targetWordCount } : {}),
          ...(data.targetKeyword !== undefined ? { targetKeyword: data.targetKeyword } : {}),
          updatedById: session.userId,
        },
      });
    });

    await logKbActivity({
      action: "kb.updated",
      entryId: data.id,
      adminUserId: session.userId,
      ipAddress: ip,
      userAgent: ua,
      changes: { fieldsChanged: Object.keys(data).filter((k) => k !== "id") },
    });

    await revalidateAdminKbRoutes(data.id);
    await revalidatePublicKbRoutes((data.type ?? existing.type) as KbType);

    return { ok: true };
  } catch (err) {
    console.error("[kb.updateEntry] error", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

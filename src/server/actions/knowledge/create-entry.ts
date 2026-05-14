/**
 * KB-3 — Server action createEntry.
 *
 * Crée une nouvelle `KnowledgeEntry` (type 'team' par défaut, statut 'draft').
 * Audit log via `ActivityLog` event `kb.created`.
 */

"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { requireAdminWrite } from "./_guards";
import { logKbActivity } from "./_audit";
import { revalidateAdminKbRoutes, revalidatePublicKbRoutes } from "./_revalidate";
import { createEntryInputSchema, type CreateEntryInput } from "./_zod-schemas";
import type {
  KbAudience,
  KbConfidentiality,
  KbDomain,
  KbPipelineStage,
  KbStatus,
  KbType,
} from "../../../../prisma/generated/client";

export interface CreateEntryResult {
  readonly ok: boolean;
  readonly entryId?: string;
  readonly error?: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

export async function createEntryAction(input: CreateEntryInput): Promise<CreateEntryResult> {
  const session = await requireAdminWrite();

  // Validation Zod
  const parsed = createEntryInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  // Unicité slug racine
  const existing = await prisma.knowledgeEntry.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "slug_already_used" };
  }

  // IP/UA pour audit log (lecture des headers SSR)
  const headerList = await headers();
  const ip = await getClientIp();
  const ua = headerList.get("user-agent");

  try {
    const entry = await prisma.knowledgeEntry.create({
      data: {
        type: data.type as KbType,
        domain: data.domain as KbDomain,
        audience: data.audience as KbAudience,
        confidentiality: data.confidentiality as KbConfidentiality,
        status: data.status as KbStatus,
        pipelineStage: data.pipelineStage as KbPipelineStage,
        slug: data.slug,
        briefMarkdown: data.briefMarkdown ?? null,
        targetWordCount: data.targetWordCount ?? null,
        targetKeyword: data.targetKeyword ?? null,
        createdById: session.userId,
        updatedById: session.userId,
        translations: {
          create: data.translations.map((t) => ({
            locale: t.locale,
            title: t.title,
            slug: t.slug,
            excerpt: t.excerpt ?? null,
            body: t.body ?? "",
            bodyText: t.bodyText ?? null,
            metaTitle: t.metaTitle ?? null,
            metaDescription: t.metaDescription ?? null,
            // bodyJson géré séparément à cause de JsonValue contraint Prisma
            ...(t.bodyJson != null && t.bodyJson !== undefined
              ? { bodyJson: t.bodyJson as object }
              : {}),
          })),
        },
      },
      select: { id: true, type: true },
    });

    await logKbActivity({
      action: "kb.created",
      entryId: entry.id,
      adminUserId: session.userId,
      ipAddress: ip,
      userAgent: ua,
      changes: { type: data.type, slug: data.slug, status: data.status },
    });

    await revalidateAdminKbRoutes(entry.id);
    if (data.status === "published" || data.status === "deprecated") {
      await revalidatePublicKbRoutes(entry.type);
    }

    return { ok: true, entryId: entry.id };
  } catch (err) {
    console.error("[kb.createEntry] error", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

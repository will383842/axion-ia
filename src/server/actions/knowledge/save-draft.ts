/**
 * KB-3 — Server action saveDraftAction (autosave throttled côté client).
 *
 * Met à jour le body d'une translation existante (1 par entry × locale).
 * Si la translation n'existe pas encore (premier draft EN par ex.), elle est créée.
 *
 * Event audit : `kb.draft.saved`. Ne change PAS le status entry (reste 'draft').
 */

"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { requireAdminWrite } from "./_guards";
import { logKbActivity } from "./_audit";
import { revalidateAdminKbRoutes } from "./_revalidate";
import { saveDraftInputSchema, type SaveDraftInput } from "./_zod-schemas";

export interface SaveDraftResult {
  readonly ok: boolean;
  readonly translationId?: string;
  readonly savedAt?: string;
  readonly error?: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

export async function saveDraftAction(input: SaveDraftInput): Promise<SaveDraftResult> {
  const session = await requireAdminWrite();

  const parsed = saveDraftInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  // Vérifier entry existe et pas soft-deleted
  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id: data.entryId },
    select: { id: true, deletedAt: true, slug: true },
  });
  if (!entry || entry.deletedAt) {
    return { ok: false, error: "not_found" };
  }

  const headerList = await headers();
  const ip = await getClientIp();
  const ua = headerList.get("user-agent");

  // Slug provisoire en création : génère un slug unique en cas de conflit.
  // Unique (locale, slug) — on suffixe avec un nano-id court si collision.
  async function generateProvisionalSlug(
    baseSlug: string,
    locale: typeof data.locale,
  ): Promise<string> {
    const candidate = `${baseSlug}-${locale}`;
    const exists = await prisma.knowledgeTranslation.findUnique({
      where: { locale_slug: { locale, slug: candidate } },
      select: { id: true },
    });
    if (!exists) return candidate;
    // Fallback : suffixe court basé sur l'entryId (8 premiers chars du UUID).
    return `${candidate}-${data.entryId.slice(0, 8)}`;
  }

  try {
    const existingTranslation = await prisma.knowledgeTranslation.findUnique({
      where: { entryId_locale: { entryId: data.entryId, locale: data.locale } },
      select: { id: true },
    });

    let provisionalSlug: string | null = null;
    if (!existingTranslation) {
      provisionalSlug = await generateProvisionalSlug(entry.slug, data.locale);
    }

    const translation = await prisma.knowledgeTranslation.upsert({
      where: { entryId_locale: { entryId: data.entryId, locale: data.locale } },
      create: {
        entryId: data.entryId,
        locale: data.locale,
        title: data.title || "Sans titre",
        slug: provisionalSlug ?? `${entry.slug}-${data.locale}`,
        body: data.body ?? "",
        bodyText: data.bodyText ?? null,
        excerpt: data.excerpt ?? null,
        ...(data.bodyJson != null && data.bodyJson !== undefined
          ? { bodyJson: data.bodyJson as object }
          : {}),
      },
      update: {
        title: data.title,
        body: data.body ?? "",
        bodyText: data.bodyText ?? null,
        excerpt: data.excerpt ?? null,
        ...(data.bodyJson != null && data.bodyJson !== undefined
          ? { bodyJson: data.bodyJson as object }
          : {}),
      },
      select: { id: true, updatedAt: true },
    });

    // Marque l'entry comme modifiée
    await prisma.knowledgeEntry.update({
      where: { id: data.entryId },
      data: { updatedById: session.userId },
    });

    await logKbActivity({
      action: "kb.draft.saved",
      entryId: data.entryId,
      adminUserId: session.userId,
      ipAddress: ip,
      userAgent: ua,
      changes: { locale: data.locale, translationId: translation.id },
    });

    // Pas de revalidation publique (draft = pas visible publique).
    revalidateAdminKbRoutes(data.entryId);

    return {
      ok: true,
      translationId: translation.id,
      savedAt: translation.updatedAt.toISOString(),
    };
  } catch (err) {
    console.error("[kb.saveDraft] error", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

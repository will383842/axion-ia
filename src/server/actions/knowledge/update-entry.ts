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
import { buildKbPublicUrl } from "@/content/knowledge/routes";
import { enqueueIndexingForUrls } from "@/server/content-gen/indexing/enqueue";
import { requireAdminWrite } from "./_guards";
import { logKbActivity } from "./_audit";
import { revalidateAdminKbRoutes, revalidatePublicKbRoutes } from "./_revalidate";
import { updateEntryInputSchema, type UpdateEntryInput } from "./_zod-schemas";
import type {
  KbAudience,
  KbConfidentiality,
  KbDomain,
  KbPipelineStage,
  KbType,
} from "../../../../prisma/generated/client";

const KB_DEFAULT_SITE_URL = "https://axion-ia.com";
function kbAbsoluteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? KB_DEFAULT_SITE_URL).replace(/\/$/, "");
  return `${base}${path}`;
}

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
    select: {
      id: true,
      type: true,
      slug: true,
      deletedAt: true,
      status: true,
      translations: { select: { locale: true, slug: true } },
    },
  });
  if (!existing || existing.deletedAt) {
    return { ok: false, error: "not_found" };
  }

  // P0 audit KB 2026-05-29 — anti-bypass state-machine : le statut ne peut PAS
  // être changé via updateEntry (sinon draft→published saute PII/qualité/dedup).
  // Tout changement de statut passe par les actions dédiées (submit/approve/
  // publish/schedule/unpublish/archive). On rejette explicitement tout écart
  // (pas de no-op silencieux) ; un payload renvoyant le statut inchangé est toléré.
  if (data.status && data.status !== existing.status) {
    return { ok: false, error: "status_change_forbidden_use_workflow" };
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
          // status volontairement non modifiable ici (P0 audit KB 2026-05-29) :
          // garde anti-bypass en amont (voir plus haut). Statut = state-machine.
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
    const newType = (data.type ?? existing.type) as KbType;
    await revalidatePublicKbRoutes(newType);

    // Audit indexation 2026-05-15 P0-4 — ping IndexNow + Google Indexing si l'entry
    // est published. Si slug a changé, ping ancien URL en `delete` + nouveau URL
    // en `update` (perfection slug rename = perte SEO zéro).
    if (existing.status === "published" || existing.status === "deprecated") {
      const slugChanged = !!(data.slug && data.slug !== existing.slug);
      const urlsUpdate: string[] = [];
      const urlsDeleted: string[] = [];
      for (const t of existing.translations) {
        if (t.locale !== "fr" && t.locale !== "en") continue;
        const oldPath = buildKbPublicUrl(existing.type, t.locale, t.slug);
        if (oldPath) {
          if (slugChanged) urlsDeleted.push(kbAbsoluteUrl(oldPath));
        }
        // Pour le nouveau URL : si la translation locale FR a son slug Entry-level
        // renommé, on construit avec data.slug ; sinon on garde l'existant.
        const newSlug = slugChanged && t.locale === "fr" ? (data.slug as string) : t.slug;
        const newPath = buildKbPublicUrl(newType, t.locale, newSlug);
        if (newPath) urlsUpdate.push(kbAbsoluteUrl(newPath));
      }
      try {
        if (urlsDeleted.length > 0) {
          await enqueueIndexingForUrls({
            entityId: `${data.id}-old`,
            urls: urlsDeleted,
            origin: "manual",
            lifecycleEvent: "delete",
          });
        }
        if (urlsUpdate.length > 0) {
          await enqueueIndexingForUrls({
            entityId: data.id,
            urls: urlsUpdate,
            origin: "manual",
            lifecycleEvent: "update",
          });
        }
      } catch {
        // best-effort
      }
    }

    return { ok: true };
  } catch (err) {
    console.error("[kb.updateEntry] error", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

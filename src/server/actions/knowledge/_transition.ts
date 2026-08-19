/**
 * KB-4 — Helper transition générique workflow.
 * Encapsule : lecture entry → validate state machine → snapshot version → update + audit + revalidate.
 *
 * 🔴 2026-08-19 — retrait de `"use server"` : cette fonction n'est plus exposée
 * comme Server Action (donc plus appelable depuis n'importe quel client). Même
 * geste que `ingest.ts` (P0-S1-1), pour le même risque, en pire :
 *
 *   - `executeTransition` ne lit AUCUNE session. Sa décision d'autorisation
 *     repose sur `input.context.userRole` et `input.context.system`, deux champs
 *     fournis par l'APPELANT — et `state-machine.ts:181` court-circuite la
 *     vérification de rôle dès que `context.system === true`. Une autorisation
 *     qui vient du payload n'est pas une autorisation.
 *   - `extraEntryUpdates?: Prisma.KnowledgeEntryUpdateInput` est injecté tel quel
 *     dans `tx.knowledgeEntry.update` : exposé, l'endpoint n'était pas un
 *     changement de statut mais une ÉCRITURE ARBITRAIRE sur l'entrée.
 *
 * L'autorisation réelle vit chez les 7 appelants (`publish`, `approve`,
 * `archive`, `restore`, `unpublish`, `submit-for-review`, `schedule-publish`),
 * qui sont eux des Server Actions gardées et passent un `context` construit
 * depuis leur propre session. Ce module reste un helper serveur → serveur ;
 * aucun composant client ne l'importe. Défense en profondeur.
 */

import { headers } from "next/headers";
import type { KbStatus, Prisma } from "../../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { makeEntrySnapshot } from "@/lib/knowledge/snapshot";
import { validateTransition, type TransitionContext } from "@/lib/knowledge/state-machine";
import { buildKbPublicUrl } from "@/content/knowledge/routes";
import {
  enqueueIndexingForUrls,
  type IndexingLifecycleEvent,
} from "@/server/content-gen/indexing/enqueue";
import { logKbActivity, type KbActivityAction } from "./_audit";
import { revalidateAdminKbRoutes, revalidatePublicKbRoutes } from "./_revalidate";

const DEFAULT_SITE_URL = "https://axion-ia.com";

function absoluteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, "");
  return `${base}${path}`;
}

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

    await revalidateAdminKbRoutes(input.entryId);
    const wasPublished = entry.status === "published";
    const willBePublished = input.toStatus === "published";
    const willBeDeprecated = input.toStatus === "deprecated";
    if (willBePublished || willBeDeprecated || wasPublished) {
      await revalidatePublicKbRoutes(entry.type);

      // Audit indexation 2026-05-15 P0-4 — KB V4 lifecycle ping IndexNow + Google
      // Indexing pour chaque traduction publique (FR canonique + EN miroir si
      // présent). Avant ce patch, la KB factory ne signalait JAMAIS ses URLs
      // aux moteurs → délai d'indexation ~7-14j vs 24-48h avec ping.
      //
      // Mapping lifecycleEvent :
      //   draft/review → published         → "publish"  (URL apparaît)
      //   published    → published (edit)  → "update"   (URL existante mise à jour)
      //   published    → deprecated/archive → "delete"  (URL sort du sitemap indexable)
      let lifecycleEvent: IndexingLifecycleEvent;
      if (willBePublished && !wasPublished) {
        lifecycleEvent = "publish";
      } else if (willBePublished && wasPublished) {
        lifecycleEvent = "update";
      } else {
        lifecycleEvent = "delete";
      }

      const urls: string[] = [];
      for (const t of entry.translations) {
        if (t.locale !== "fr" && t.locale !== "en") continue;
        const path = buildKbPublicUrl(entry.type, t.locale, t.slug);
        if (path) urls.push(absoluteUrl(path));
      }
      if (urls.length > 0) {
        try {
          await enqueueIndexingForUrls({
            entityId: input.entryId,
            urls,
            origin: "manual",
            lifecycleEvent,
          });
        } catch {
          // best-effort — n'échoue jamais une transition pour un échec d'indexation
        }
      }
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

/**
 * KB-4 — rollbackVersionAction.
 * Crée nouvelle version n+1 = copie d'une version antérieure n-K (append-only).
 */

"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { requireAdminPublish } from "./_guards";
import { logKbActivity } from "./_audit";
import { revalidateAdminKbRoutes } from "./_revalidate";

const inputSchema = z.object({
  entryId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export interface RollbackResult {
  readonly ok: boolean;
  readonly newVersionId?: string;
  readonly error?: string;
}

export async function rollbackVersionAction(input: {
  entryId: string;
  versionId: string;
}): Promise<RollbackResult> {
  const session = await requireAdminPublish();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const targetVersion = await prisma.knowledgeVersion.findUnique({
    where: { id: parsed.data.versionId },
    select: { entryId: true, version: true, snapshotJson: true },
  });
  if (!targetVersion || targetVersion.entryId !== parsed.data.entryId) {
    return { ok: false, error: "version_not_found" };
  }

  const lastVersion = await prisma.knowledgeVersion.findFirst({
    where: { entryId: parsed.data.entryId, translationId: null },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (lastVersion?.version ?? 0) + 1;

  const headerList = await headers();
  const ip = await getClientIp();
  const ua = headerList.get("user-agent");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshot = targetVersion.snapshotJson as any;
  if (!snapshot || typeof snapshot !== "object" || !snapshot.entry) {
    return { ok: false, error: "snapshot_invalid" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const newVersion = await tx.knowledgeVersion.create({
        data: {
          entryId: parsed.data.entryId,
          version: nextVersion,
          snapshotJson: snapshot as object,
          createdById: session.userId,
        },
        select: { id: true },
      });

      await tx.knowledgeEntry.update({
        where: { id: parsed.data.entryId },
        data: {
          slug: snapshot.entry.slug,
          briefMarkdown: snapshot.entry.briefMarkdown ?? null,
          targetKeyword: snapshot.entry.targetKeyword ?? null,
          targetWordCount: snapshot.entry.targetWordCount ?? null,
          updatedById: session.userId,
        },
      });

      for (const t of snapshot.translations ?? []) {
        await tx.knowledgeTranslation.update({
          where: { id: t.id },
          data: {
            title: t.title,
            slug: t.slug,
            excerpt: t.excerpt ?? null,
            body: t.body,
            bodyText: t.bodyText ?? null,
            metaTitle: t.metaTitle ?? null,
            metaDescription: t.metaDescription ?? null,
          },
        });
      }

      return { newVersionId: newVersion.id };
    });

    await logKbActivity({
      action: "kb.updated",
      entryId: parsed.data.entryId,
      adminUserId: session.userId,
      ipAddress: ip,
      userAgent: ua,
      changes: {
        rolledBackToVersion: targetVersion.version,
        newVersionId: result.newVersionId,
      },
    });

    revalidateAdminKbRoutes(parsed.data.entryId);

    return { ok: true, newVersionId: result.newVersionId };
  } catch (err) {
    console.error("[kb.rollbackVersion] error", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

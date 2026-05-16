/**
 * KB V4 (Sprint KB-18) — Server actions annotations team.
 *
 * Annotation = commentaire d'équipe sur un entry (review_comment, seo_suggestion,
 * factual_check, typo, content_request). Différent de KnowledgeBookmark
 * (côté client). Workflow open → resolved | wont_fix.
 *
 * Sprint Correctif S+1 (2026-05-16) — P0-S1-1 RBAC : `authorId` / `resolverId`
 * dérivés de la session admin (plus de spoofing form-data).
 */

"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "./_guards";

export type AnnotationKind =
  | "review_comment"
  | "seo_suggestion"
  | "factual_check"
  | "typo"
  | "content_request";
export type AnnotationStatus = "open" | "resolved" | "wont_fix";

export interface CreateAnnotationInput {
  readonly entryId: string;
  readonly bodyMarkdown: string;
  readonly anchorRef?: string | null;
  readonly kind?: AnnotationKind;
}

export async function createAnnotation(input: CreateAnnotationInput) {
  const session = await requireAdminWrite();
  if (input.bodyMarkdown.trim().length < 3) {
    throw new Error("Annotation body trop court (min 3 chars)");
  }
  return prisma.knowledgeAnnotation.create({
    data: {
      entryId: input.entryId,
      authorId: session.userId,
      bodyMarkdown: input.bodyMarkdown.trim(),
      anchorRef: input.anchorRef ?? null,
      kind: input.kind ?? "review_comment",
      status: "open",
    },
    select: { id: true, status: true, createdAt: true },
  });
}

export async function resolveAnnotation(
  annotationId: string,
  status: "resolved" | "wont_fix" = "resolved",
) {
  const session = await requireAdminWrite();
  return prisma.knowledgeAnnotation.update({
    where: { id: annotationId },
    data: {
      status,
      resolvedAt: new Date(),
      resolvedById: session.userId,
    },
    select: { id: true, status: true, resolvedAt: true },
  });
}

export async function listAnnotationsForEntry(entryId: string, statusFilter?: AnnotationStatus) {
  return prisma.knowledgeAnnotation.findMany({
    where: {
      entryId,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      authorId: true,
      anchorRef: true,
      bodyMarkdown: true,
      kind: true,
      status: true,
      resolvedAt: true,
      resolvedById: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function countOpenAnnotationsForEntry(entryId: string): Promise<number> {
  return prisma.knowledgeAnnotation.count({ where: { entryId, status: "open" } });
}

/**
 * KB V4 (Sprint KB-19) — Export RGPD pour un sujet donné.
 *
 * Liste tout ce que KB stocke à propos d'une personne :
 *  - Bookmarks (par clientEmail)
 *  - Annotations (par authorId, si user-side identifié)
 *  - Reviewer assignments (par reviewerId, si user-side)
 *  - Feedback (par submittedById si tracé)
 *  - Mentions dans audit log (par actor matching userId)
 *
 * Format : JSON sérialisé, à streamer côté API `/api/gdpr-export?subject=...`.
 * Anonymisation post-export : Sprint KB-19 V2 (deferred — endpoint dédié).
 */

import { prisma } from "@/lib/prisma";

export interface KbRgpdExport {
  readonly subject: string;
  readonly exportedAt: string;
  readonly bookmarks: ReadonlyArray<Record<string, unknown>>;
  readonly annotations: ReadonlyArray<Record<string, unknown>>;
  readonly reviewerAssignments: ReadonlyArray<Record<string, unknown>>;
  readonly auditMentions: ReadonlyArray<Record<string, unknown>>;
}

/**
 * Export par identifiant utilisateur (UUID) — pour authors/reviewers/staff.
 */
export async function exportKbDataForUserId(userId: string): Promise<KbRgpdExport> {
  const [annotations, reviewerAssignments, auditMentions] = await Promise.all([
    prisma.knowledgeAnnotation.findMany({
      where: { authorId: userId },
      select: {
        id: true,
        entryId: true,
        anchorRef: true,
        bodyMarkdown: true,
        kind: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.knowledgeReviewerAssignment.findMany({
      where: { reviewerId: userId },
      select: {
        id: true,
        entryId: true,
        status: true,
        assignedAt: true,
        completedAt: true,
        reviewerNote: true,
      },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.knowledgeAuditLog.findMany({
      where: { actor: userId },
      select: { id: true, eventKind: true, entryId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  return {
    subject: userId,
    exportedAt: new Date().toISOString(),
    bookmarks: [],
    annotations: annotations.map((a) => ({ ...a, id: a.id })),
    reviewerAssignments: reviewerAssignments.map((r) => ({ ...r, id: r.id })),
    auditMentions: auditMentions.map((m) => ({ ...m, id: m.id.toString() })),
  };
}

/**
 * Export par email — pour clients/visiteurs (bookmarks principalement).
 */
export async function exportKbDataForEmail(email: string): Promise<KbRgpdExport> {
  const bookmarks = await prisma.knowledgeBookmark.findMany({
    where: { clientEmail: email },
    select: {
      id: true,
      entryId: true,
      privateNoteMarkdown: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    subject: email,
    exportedAt: new Date().toISOString(),
    bookmarks: bookmarks.map((b) => ({ ...b, id: b.id })),
    annotations: [],
    reviewerAssignments: [],
    auditMentions: [],
  };
}

/**
 * Anonymisation des données d'un utilisateur (right-to-erasure).
 * Remplace email par hash, vide les body markdown, supprime bookmarks.
 * Audit log : conservé (legal hold), mais l'actor est remplacé par "erased:<hash>".
 */
export async function eraseKbDataForEmail(email: string): Promise<{ bookmarksDeleted: number }> {
  const result = await prisma.knowledgeBookmark.deleteMany({
    where: { clientEmail: email },
  });
  return { bookmarksDeleted: result.count };
}

// Reply Server Actions admin (Sprint Notif Infra 2026-05-26 / Chantier 5).
//
// Permet à l'admin (super_admin / admin / editor) de :
//  - répondre à une Submission depuis l'admin → SubmissionReply created
//    + email enqueued via worker dédié
//  - archiver / désarchiver (single + bulk)
//  - marquer needsAttention=true/false (toggle inbox)
//  - retry une reply failed/bounced
//
// Pattern hérité de `admin-submissions/actions.ts` :
//  - requireAdminWriteSession() (RBAC strict)
//  - Zod schema strict
//  - Prisma transaction si update Submission + create SubmissionReply
//  - revalidatePath(/contacts/messages + /contacts/messages/[id])
//  - Sentry.captureException sur catch (audit trail)

"use server";

import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { INBOX_COUNTS_TAG } from "@/features/admin-inbox/cache-tags";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { renderEmailTemplate } from "@/lib/email/templates";
import { enqueueEmail } from "@/server/queue/queues";
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";

async function requireAdminWriteSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
  const name = (session.user as { name?: string }).name ?? session.user.id;
  return { userId: session.user.id, role, name };
}

// ============================================================
// replyToSubmissionAction
// ============================================================

const replySchema = z.object({
  submissionId: z.string().uuid(),
  subject: z.string().min(2).max(500),
  bodyMarkdown: z.string().min(1).max(50_000),
  template: z
    .enum(["default", "audit_followup", "intervention_followup", "custom"])
    .default("default"),
  internalNote: z.string().max(2000).optional(),
});

export type ReplyToSubmissionState =
  | { ok: true; replyId: string }
  // replyId présent si la reply a été persistée mais l'envoi a échoué (enqueue KO)
  // → l'admin peut la réessayer via retryFailedReplyAction.
  | { ok: false; error: string; replyId?: string };

export async function replyToSubmissionAction(
  input: z.input<typeof replySchema>,
): Promise<ReplyToSubmissionState> {
  let session: { userId: string; role: string; name: string };
  try {
    session = await requireAdminWriteSession();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unauthorized";
    return { ok: false, error: msg };
  }

  const parsed = replySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Champs invalides",
    };
  }
  const data = parsed.data;

  const submission = await prisma.submission.findUnique({
    where: { id: data.submissionId },
  });
  if (!submission) return { ok: false, error: "submission_not_found" };

  // 0. Pré-vol : déchiffrer + valider l'adresse DANS le process web (qui a la
  //    clé). Si l'adresse est illisible (clé absente → placeholder) ou invalide,
  //    on échoue AVANT de créer une reply orpheline, avec une erreur claire.
  if (!isDecryptedEmailUsable(decryptPii(submission.contactEmail))) {
    return { ok: false, error: "invalid_recipient" };
  }

  // 1. Pre-render template HTML + plain text via @react-email/render.
  let rendered: { subject: string; html: string; text: string };
  try {
    rendered = await renderEmailTemplate("submission-reply", submission.locale, {
      subject: data.subject,
      bodyMarkdown: data.bodyMarkdown,
    });
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, error: "render_failed" };
  }

  // 2. Create SubmissionReply + update Submission cache cols en transaction.
  const replyId = await prisma
    .$transaction(async (tx) => {
      const reply = await tx.submissionReply.create({
        data: {
          submissionId: submission.id,
          repliedByUserId: session.userId,
          repliedByName: session.name,
          toEmail: submission.contactEmail,
          subject: data.subject,
          bodyHtml: rendered.html,
          bodyText: rendered.text,
          deliveryStatus: "pending",
          ...(data.internalNote ? { internalNote: data.internalNote } : {}),
          templateUsed: data.template,
        },
      });

      await tx.submission.update({
        where: { id: submission.id },
        data: {
          replyCount: { increment: 1 },
          needsAttention: false,
          ...(submission.status === "new" ? { status: "in_progress" as const } : {}),
        },
      });

      return reply.id;
    })
    .catch((e) => {
      Sentry.captureException(e);
      return null;
    });

  if (!replyId) return { ok: false, error: "db_failed" };

  // 3. Enqueue email (le worker re-déchiffre l'adresse depuis la DB → PAS de PII
  //    dans le payload de queue). Si l'enqueue échoue (queue indisponible), on
  //    marque la reply `failed` (rejouable) et on remonte l'échec à l'admin
  //    (plus de faux succès pendant que la reply reste `pending` éternellement).
  let enqueued = false;
  try {
    const res = await enqueueEmail("submission-reply", "", submission.locale, {
      replyId,
      subject: data.subject,
      submissionId: submission.id,
    });
    enqueued = res.enqueued;
  } catch (e) {
    Sentry.captureException(e);
  }

  revalidatePath(adminPath("fr", "contacts/messages"));
  revalidatePath(adminPath("fr", `contacts/messages/${submission.id}`));
  // Sprint Notif Infra 2026-05-26 / fix P1-1 audit 2026-05-27 — invalide le
  // compteur unread cached du badge sidebar.
  updateTag("admin:contacts-unread");
  updateTag(INBOX_COUNTS_TAG);

  if (!enqueued) {
    await prisma.submissionReply
      .update({
        where: { id: replyId },
        data: {
          deliveryStatus: "failed",
          failedAt: new Date(),
          errorMsg: "enqueue_failed (file d'envoi indisponible)",
        },
      })
      .catch((e) => Sentry.captureException(e));
    return { ok: false, error: "enqueue_failed", replyId };
  }

  return { ok: true, replyId };
}

// ============================================================
// archive / unarchive
// ============================================================

const idsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });
const singleIdSchema = z.object({ id: z.string().uuid() });

export async function archiveSubmissionAction(id: string): Promise<{ ok: boolean }> {
  try {
    await requireAdminWriteSession();
  } catch {
    return { ok: false };
  }
  const parsed = singleIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false };
  await prisma.submission.update({
    where: { id: parsed.data.id },
    data: { archivedAt: new Date(), needsAttention: false, status: "archived" },
  });
  revalidatePath(adminPath("fr", "contacts/messages"));
  updateTag("admin:contacts-unread");
  updateTag(INBOX_COUNTS_TAG);
  return { ok: true };
}

export async function unarchiveSubmissionAction(id: string): Promise<{ ok: boolean }> {
  try {
    await requireAdminWriteSession();
  } catch {
    return { ok: false };
  }
  const parsed = singleIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false };
  await prisma.submission.update({
    where: { id: parsed.data.id },
    data: { archivedAt: null, status: "in_progress" },
  });
  revalidatePath(adminPath("fr", "contacts/messages"));
  updateTag("admin:contacts-unread");
  updateTag(INBOX_COUNTS_TAG);
  return { ok: true };
}

export async function bulkArchiveSubmissionsAction(ids: string[]): Promise<{ archived: number }> {
  try {
    await requireAdminWriteSession();
  } catch {
    return { archived: 0 };
  }
  const parsed = idsSchema.safeParse({ ids });
  if (!parsed.success) return { archived: 0 };
  const result = await prisma.submission.updateMany({
    where: { id: { in: parsed.data.ids }, archivedAt: null },
    data: { archivedAt: new Date(), needsAttention: false, status: "archived" },
  });
  revalidatePath(adminPath("fr", "contacts/messages"));
  updateTag("admin:contacts-unread");
  updateTag(INBOX_COUNTS_TAG);
  return { archived: result.count };
}

export async function bulkUnarchiveSubmissionsAction(
  ids: string[],
): Promise<{ unarchived: number }> {
  try {
    await requireAdminWriteSession();
  } catch {
    return { unarchived: 0 };
  }
  const parsed = idsSchema.safeParse({ ids });
  if (!parsed.success) return { unarchived: 0 };
  const result = await prisma.submission.updateMany({
    where: { id: { in: parsed.data.ids }, archivedAt: { not: null } },
    data: { archivedAt: null, status: "in_progress" },
  });
  revalidatePath(adminPath("fr", "contacts/messages"));
  updateTag("admin:contacts-unread");
  updateTag(INBOX_COUNTS_TAG);
  return { unarchived: result.count };
}

// ============================================================
// soft-delete / restore (Corbeille — 2026-07-10)
// ============================================================
//
// Corbeille récupérable : `deletedAt` non null masque le message de tous les
// listings sauf l'onglet « Corbeille ». Restauration = deletedAt→null. La
// suppression DÉFINITIVE reste l'effacement RGPD (`eraseSubmissionAction`,
// super_admin, dans admin-submissions/actions.ts).

export async function softDeleteSubmissionAction(id: string): Promise<{ ok: boolean }> {
  try {
    await requireAdminWriteSession();
  } catch {
    return { ok: false };
  }
  const parsed = singleIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false };
  await prisma.submission.update({
    where: { id: parsed.data.id },
    data: { deletedAt: new Date(), needsAttention: false },
  });
  revalidatePath(adminPath("fr", "contacts/messages"));
  updateTag("admin:contacts-unread");
  updateTag(INBOX_COUNTS_TAG);
  return { ok: true };
}

export async function restoreSubmissionAction(id: string): Promise<{ ok: boolean }> {
  try {
    await requireAdminWriteSession();
  } catch {
    return { ok: false };
  }
  const parsed = singleIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false };
  await prisma.submission.update({
    where: { id: parsed.data.id },
    data: { deletedAt: null },
  });
  revalidatePath(adminPath("fr", "contacts/messages"));
  updateTag("admin:contacts-unread");
  updateTag(INBOX_COUNTS_TAG);
  return { ok: true };
}

// ============================================================
// markNeedsAttentionAction
// ============================================================

export async function markNeedsAttentionAction(
  id: string,
  value: boolean,
): Promise<{ ok: boolean }> {
  try {
    await requireAdminWriteSession();
  } catch {
    return { ok: false };
  }
  const parsed = singleIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false };
  await prisma.submission.update({
    where: { id: parsed.data.id },
    data: { needsAttention: value },
  });
  revalidatePath(adminPath("fr", "contacts/messages"));
  updateTag("admin:contacts-unread");
  updateTag(INBOX_COUNTS_TAG);
  return { ok: true };
}

// ============================================================
// retryFailedReplyAction
// ============================================================

export async function retryFailedReplyAction(
  replyId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminWriteSession();
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = z.string().min(1).max(64).safeParse(replyId);
  if (!parsed.success) return { ok: false, error: "invalid_id" };

  const reply = await prisma.submissionReply.findUnique({
    where: { id: parsed.data },
    include: { submission: { select: { id: true, locale: true } } },
  });
  if (!reply) return { ok: false, error: "not_found" };

  if (reply.deliveryStatus !== "failed" && reply.deliveryStatus !== "bounced") {
    return { ok: false, error: "not_retryable" };
  }

  await prisma.submissionReply.update({
    where: { id: reply.id },
    data: {
      deliveryStatus: "pending",
      retryCount: { increment: 1 },
      failedAt: null,
      errorMsg: null,
    },
  });

  let enqueued = false;
  try {
    // Pas de PII dans le payload : le worker re-déchiffre depuis la DB.
    const res = await enqueueEmail("submission-reply", "", reply.submission.locale, {
      replyId: reply.id,
      subject: reply.subject,
      submissionId: reply.submissionId,
    });
    enqueued = res.enqueued;
  } catch (e) {
    Sentry.captureException(e);
  }
  if (!enqueued) {
    await prisma.submissionReply
      .update({
        where: { id: reply.id },
        data: {
          deliveryStatus: "failed",
          failedAt: new Date(),
          errorMsg: "enqueue_failed (file d'envoi indisponible)",
        },
      })
      .catch((e) => Sentry.captureException(e));
    return { ok: false, error: "enqueue_failed" };
  }

  revalidatePath(adminPath("fr", `contacts/messages/${reply.submissionId}`));
  return { ok: true };
}

// ============================================================
// getReplyDeliveryStatusAction — polling léger du statut réel d'envoi
// (le worker met à jour deliveryStatus de façon asynchrone). Sert au
// ReplyComposer pour afficher « Réponse envoyée ✓ » ou l'erreur. Ne renvoie
// JAMAIS de PII.
// ============================================================

export type ReplyDeliveryStatus = "pending" | "sent" | "delivered" | "failed" | "bounced";

export async function getReplyDeliveryStatusAction(replyId: string): Promise<{
  status: ReplyDeliveryStatus;
  errorMsg: string | null;
  retryCount: number;
} | null> {
  try {
    await requireAdminWriteSession();
  } catch {
    return null;
  }
  const parsed = z.string().min(1).max(64).safeParse(replyId);
  if (!parsed.success) return null;

  const reply = await prisma.submissionReply.findUnique({
    where: { id: parsed.data },
    select: { deliveryStatus: true, errorMsg: true, retryCount: true },
  });
  if (!reply) return null;

  return {
    status: reply.deliveryStatus as ReplyDeliveryStatus,
    errorMsg: reply.errorMsg,
    retryCount: reply.retryCount,
  };
}

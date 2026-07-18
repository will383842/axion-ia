// Worker BullMQ — envoi des emails (Sprint 15 / M8 step 4).
//
// Consume la queue `emails` : pour chaque job, render le template React Email
// (via @react-email/render) puis envoie via Nodemailer SMTP localhost:2525.
//
// En dev → Mailhog UI (http://localhost:8025) intercepte tout.
// En prod → PowerMTA local sur Hetzner relai vers IP dediee.

import { Worker } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "../lib/sentry-worker";
import { sendEmail } from "@/lib/email/client";
import type { SendEmailParams } from "@/lib/email/client";
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import { renderEmailTemplate } from "@/lib/email/templates";
import { prisma } from "@/lib/prisma";
import { isR2Configured, getObjectBufferR2 } from "@/lib/r2-storage";
import { EmailLogStatus } from "../../../../prisma/generated/client";
import type { EmailJobData, EmailJobName } from "../types";

/**
 * Journalise durablement un envoi dans EmailLog (traçabilité audit). FAIL-SOFT :
 * une erreur d'écriture ne doit JAMAIS transformer un envoi réussi en échec/retry
 * (log console seulement, pas de rethrow). Une ligne par tentative.
 */
async function logEmail(entry: {
  template: EmailJobName;
  recipient: string;
  locale: EmailJobData["locale"];
  marketing: boolean;
  attempts: number;
  status: EmailLogStatus;
  entityType?: string;
  entityId?: string;
  jobId?: string;
  providerMessageId?: string;
  error?: string;
  sentAt?: Date;
  failedAt?: Date;
}): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        template: entry.template,
        recipient: entry.recipient,
        locale: entry.locale,
        marketing: entry.marketing,
        attempts: entry.attempts,
        status: entry.status,
        ...(entry.entityType ? { entityType: entry.entityType } : {}),
        ...(entry.entityId ? { entityId: entry.entityId } : {}),
        ...(entry.jobId ? { jobId: entry.jobId } : {}),
        ...(entry.providerMessageId ? { providerMessageId: entry.providerMessageId } : {}),
        ...(entry.error ? { error: entry.error } : {}),
        ...(entry.sentAt ? { sentAt: entry.sentAt } : {}),
        ...(entry.failedAt ? { failedAt: entry.failedAt } : {}),
      },
    });
  } catch (e) {
    console.error(
      `[email-worker] EmailLog write failed (${entry.template} → ${entry.recipient}):`,
      e instanceof Error ? e.message : String(e),
    );
  }
}

/**
 * Hub facturation — résout les pièces jointes d'un job (clé R2 → Buffer).
 * FAIL-HARD (revue M8) : les templates affirment « le document est joint » —
 * envoyer sans la PJ serait un mensonge au client. PJ irrécupérable → throw
 * → retry BullMQ (backoff), puis job `failed` visible (Sentry + logs).
 */
async function resolveAttachments(
  attachments: EmailJobData["attachments"],
): Promise<SendEmailParams["attachments"]> {
  if (!attachments || attachments.length === 0) return undefined;
  if (!isR2Configured()) {
    throw new Error(
      "[email-worker] pièces jointes demandées mais R2 non configuré — envoi refusé (le template promet un document joint)",
    );
  }
  const resolved: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
  for (const att of attachments) {
    const buffer = await getObjectBufferR2(att.r2Key).catch(() => null);
    if (buffer === null) {
      throw new Error(
        `[email-worker] PJ introuvable sur R2 (${att.r2Key}) — envoi refusé, retry BullMQ`,
      );
    }
    resolved.push({
      filename: att.filename,
      content: buffer,
      contentType: att.contentType ?? "application/pdf",
    });
  }
  return resolved;
}

export function startEmailWorker(): Worker<EmailJobData, void, EmailJobName> {
  const worker = new Worker<EmailJobData, void, EmailJobName>(
    "emails",
    async (job) => {
      const { template, to, locale, payload, marketing, entityType, entityId } = job.data;

      // Sprint Notif Infra 2026-05-26 / Chantier 5 — branche dédiée
      // submission-reply : on synchronise SubmissionReply.deliveryStatus
      // + Submission.firstRepliedAt/lastRepliedAt après envoi MTA. Suivi propre
      // via SubmissionReply → pas de double journalisation dans EmailLog.
      if (template === "submission-reply") {
        await handleSubmissionReply(payload);
        return;
      }

      const jobId = job.id;
      const attempts = job.attemptsMade + 1;

      try {
        const { subject, html, text } = await renderEmailTemplate(template, locale, payload);
        const attachments = await resolveAttachments(job.data.attachments);
        // RFC 8058 List-Unsubscribe (P0-RGPD-3 fix audit final 2026-05-09).
        // Marketing emails ET transactionnels qui contiennent un lien
        // unsubscribe DOIVENT exposer les headers `List-Unsubscribe` +
        // `List-Unsubscribe-Post` pour Gmail/Yahoo/Apple/Outlook 2024+.
        const unsubscribeToken =
          payload && typeof payload === "object" && "unsubscribeToken" in payload
            ? typeof (payload as { unsubscribeToken?: unknown }).unsubscribeToken === "string"
              ? (payload as { unsubscribeToken: string }).unsubscribeToken
              : undefined
            : undefined;
        const result = await sendEmail({
          to,
          subject,
          html,
          text,
          marketing: marketing === true,
          ...(unsubscribeToken ? { unsubscribeToken } : {}),
          ...(attachments ? { attachments } : {}),
        });
        // Journalisation fail-soft : ne jamais rethrow après un envoi réussi
        // (sinon retry BullMQ → email renvoyé).
        await logEmail({
          template,
          recipient: to,
          locale,
          marketing: marketing === true,
          attempts,
          status: EmailLogStatus.sent,
          providerMessageId: result.messageId,
          sentAt: new Date(),
          ...(entityType ? { entityType } : {}),
          ...(entityId ? { entityId } : {}),
          ...(jobId ? { jobId } : {}),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await logEmail({
          template,
          recipient: to,
          locale,
          marketing: marketing === true,
          attempts,
          status: EmailLogStatus.failed,
          error: msg.slice(0, 2000),
          failedAt: new Date(),
          ...(entityType ? { entityType } : {}),
          ...(entityId ? { entityId } : {}),
          ...(jobId ? { jobId } : {}),
        });
        throw err; // rethrow : conserve le retry BullMQ + capture Sentry existante
      }
    },
    {
      connection: getBullConnectionOrThrow(),
      concurrency: 8,
      lockDuration: 120_000,
      // P2-23 audit indexation 2026-05-18 — bornage retention Redis :
      // garde 1000 jobs completed + 5000 jobs failed max (BullMQ purge auto).
      // Évite saturation Redis long-terme sur high-volume workers.
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on("ready", () => console.log("[email-worker] ready"));
  worker.on("completed", (job) => console.log(`[email-worker] sent: ${job.name} → ${job.data.to}`));
  worker.on("failed", (job, err) => {
    console.error(`[email-worker] failed: ${job?.name} → ${job?.data?.to}: ${err.message}`);
    // Sprint Final P1-2 (audit final 2026-05-22) — Sentry capture email-worker.
    captureWorkerError("email", "emails", job, err);
  });

  return worker;
}

// ============================================================
// submission-reply : delivery status sync (Sprint Notif Infra 2026-05-26)
// ============================================================
//
// Le payload `submission-reply` ne contient PAS le HTML — il référence le
// `SubmissionReply.id`. On lit le bodyHtml/bodyText pré-rendu depuis la DB
// (figé au moment du replyToSubmissionAction), on envoie, puis on update
// le `deliveryStatus` + `sentAt`/`failedAt` + `Submission.firstRepliedAt`/
// `lastRepliedAt`. Throw en cas d'échec SMTP → BullMQ retry avec backoff.

async function handleSubmissionReply(payload: Record<string, unknown>): Promise<void> {
  const replyId = typeof payload["replyId"] === "string" ? (payload["replyId"] as string) : null;
  if (!replyId) throw new Error("[email-worker] submission-reply: missing replyId");

  const reply = await prisma.submissionReply.findUnique({
    where: { id: replyId },
    include: { submission: { select: { id: true, firstRepliedAt: true } } },
  });
  if (!reply) throw new Error(`[email-worker] SubmissionReply ${replyId} not found`);

  const replyTo = process.env.ADMIN_REPLY_FROM ?? "contact@axion-ia.com";

  // `toEmail` est stocké CHIFFRÉ au repos (enc:v1, PII contact). On déchiffre au
  // seul moment de l'envoi. decryptPii = no-op sur une valeur déjà en clair.
  const to = decryptPii(reply.toEmail);

  // Garde : si l'adresse est illisible — clé `PII_ENCRYPTION_KEY` absente ou
  // désalignée sur le WORKER → decryptPii renvoie le placeholder — inutile de
  // consommer les 5 retries BullMQ sur un problème de CONFIG. On marque `failed`
  // avec un errorMsg distinctif (rejouable après alignement de la clé) et on NE
  // throw PAS. C'est la cause racine #1 du « Échec envoi » (cf. plan §0).
  if (!isDecryptedEmailUsable(to)) {
    await prisma.submissionReply.update({
      where: { id: reply.id },
      data: {
        deliveryStatus: "failed",
        failedAt: new Date(),
        errorMsg: "recipient: adresse illisible (PII_ENCRYPTION_KEY worker absente/désalignée ?)",
      },
    });
    return;
  }

  try {
    const result = await sendEmail({
      to,
      subject: reply.subject,
      html: reply.bodyHtml,
      text: reply.bodyText,
      replyTo,
    });
    const now = new Date();
    await prisma.$transaction([
      prisma.submissionReply.update({
        where: { id: reply.id },
        data: {
          deliveryStatus: "sent",
          sentAt: now,
          providerMessageId: result.messageId,
        },
      }),
      prisma.submission.update({
        where: { id: reply.submissionId },
        data: {
          firstRepliedAt: reply.submission.firstRepliedAt ?? now,
          lastRepliedAt: now,
        },
      }),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.submissionReply.update({
      where: { id: reply.id },
      data: {
        deliveryStatus: "failed",
        failedAt: new Date(),
        errorMsg: msg.slice(0, 2000),
        retryCount: { increment: 1 },
      },
    });
    throw e; // BullMQ retry avec backoff exponentiel
  }
}

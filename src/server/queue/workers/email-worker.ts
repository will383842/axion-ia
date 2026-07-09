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
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import { renderEmailTemplate } from "@/lib/email/templates";
import { prisma } from "@/lib/prisma";
import type { EmailJobData, EmailJobName } from "../types";

export function startEmailWorker(): Worker<EmailJobData, void, EmailJobName> {
  const worker = new Worker<EmailJobData, void, EmailJobName>(
    "emails",
    async (job) => {
      const { template, to, locale, payload, marketing } = job.data;

      // Sprint Notif Infra 2026-05-26 / Chantier 5 — branche dédiée
      // submission-reply : on synchronise SubmissionReply.deliveryStatus
      // + Submission.firstRepliedAt/lastRepliedAt après envoi MTA.
      if (template === "submission-reply") {
        await handleSubmissionReply(payload);
        return;
      }

      const { subject, html, text } = await renderEmailTemplate(template, locale, payload);
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
      await sendEmail({
        to,
        subject,
        html,
        text,
        marketing: marketing === true,
        ...(unsubscribeToken ? { unsubscribeToken } : {}),
      });
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

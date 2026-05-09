// Worker BullMQ — envoi des emails (Sprint 15 / M8 step 4).
//
// Consume la queue `emails` : pour chaque job, render le template React Email
// (via @react-email/render) puis envoie via Nodemailer SMTP localhost:2525.
//
// En dev → Mailhog UI (http://localhost:8025) intercepte tout.
// En prod → PowerMTA local sur Hetzner relai vers IP dediee.

import { Worker } from "bullmq";
import { getBullConnection } from "../connection";
import { sendEmail } from "@/lib/email/client";
import { renderEmailTemplate } from "@/lib/email/templates";
import type { EmailJobData, EmailJobName } from "../types";

export function startEmailWorker(): Worker<EmailJobData, void, EmailJobName> {
  const worker = new Worker<EmailJobData, void, EmailJobName>(
    "emails",
    async (job) => {
      const { template, to, locale, payload, marketing } = job.data;
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
    { connection: getBullConnection(), concurrency: 8 },
  );

  worker.on("ready", () => console.log("[email-worker] ready"));
  worker.on("completed", (job) => console.log(`[email-worker] sent: ${job.name} → ${job.data.to}`));
  worker.on("failed", (job, err) =>
    console.error(`[email-worker] failed: ${job?.name} → ${job?.data?.to}: ${err.message}`),
  );

  return worker;
}

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
      await sendEmail({
        to,
        subject,
        html,
        text,
        marketing: marketing === true,
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

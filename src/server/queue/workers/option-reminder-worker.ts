// Worker BullMQ — rappel option 48h H+24 (Sprint 15 / M8 step 4).
//
// Tick toutes les heures. Trouve les options pending qui expirent dans
// (24h, 25h] (fenetre 1h glissante) et n'ont pas encore recu de rappel.
// Envoie email + flag reminderSentAt.

import { Worker } from "bullmq";
import { getBullConnection } from "../connection";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "../queues";
import type { OptionReminderJobData } from "../types";

export function startOptionReminderWorker(): Worker<OptionReminderJobData> {
  const worker = new Worker<OptionReminderJobData>(
    "option-reminder",
    async () => {
      const now = new Date();
      // Fenetre : expiresAt dans (now+24h, now+25h]
      const fromDate = new Date(now.getTime() + 24 * 3600 * 1000);
      const toDate = new Date(now.getTime() + 25 * 3600 * 1000);

      const due = await prisma.bookingOption.findMany({
        where: {
          status: "pending",
          reminderSentAt: null,
          expiresAt: { gt: fromDate, lte: toDate },
        },
        select: {
          id: true,
          contactName: true,
          contactEmail: true,
          locale: true,
          interventionType: true,
          expiresAt: true,
          slot: { select: { slotDate: true } },
        },
      });

      if (due.length === 0) return;

      for (const opt of due) {
        await enqueueEmail("option-reminder", opt.contactEmail, opt.locale, {
          contactName: opt.contactName,
          bookingDate: opt.slot?.slotDate.toISOString().slice(0, 10) ?? "",
          interventionType: opt.interventionType,
          expiresAt: opt.expiresAt.toISOString(),
          optionId: opt.id,
        });
        await prisma.bookingOption.update({
          where: { id: opt.id },
          data: { reminderSentAt: new Date() },
        });
      }
      console.log(`[option-reminder] reminders sent for ${due.length} option(s)`);
    },
    { connection: getBullConnection(), concurrency: 1 },
  );

  worker.on("ready", () => console.log("[option-reminder-worker] ready"));
  worker.on("failed", (_job, err) =>
    console.error(`[option-reminder-worker] failed: ${err.message}`),
  );

  return worker;
}

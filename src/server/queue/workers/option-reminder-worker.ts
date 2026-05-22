// Worker BullMQ — rappel option 48h H+24 (Sprint 15 / M8 step 4).
//
// Tick toutes les heures. Trouve les options pending qui expirent dans
// (24h, 25h] (fenetre 1h glissante) et n'ont pas encore recu de rappel.
// Envoie email + flag reminderSentAt.

import { Worker } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "../queues";
import type { OptionReminderJobData } from "../types";

export function startOptionReminderWorker(): Worker<OptionReminderJobData> {
  const worker = new Worker<OptionReminderJobData>(
    "option-reminder",
    async () => {
      const now = new Date();
      // Sprint 15 fix Fork 1 C3 : fenetre elargie [22h, 26h] pour garantir
      // capture par au moins 2 ticks horaires. Avant : (24h, 25h] glissante
      // ratait toute option creee a un offset minutes proche de l'heure
      // pile (24h±dispatch_offset hors fenetre).
      // Sentinel reminderSentAt empeche le double-rappel.
      const fromDate = new Date(now.getTime() + 22 * 3600 * 1000);
      const toDate = new Date(now.getTime() + 26 * 3600 * 1000);

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
    {
      connection: getBullConnectionOrThrow(),
      concurrency: 1,
      lockDuration: 120_000,
      // P2-23 audit indexation 2026-05-18 — bornage retention Redis :
      // garde 1000 jobs completed + 5000 jobs failed max (BullMQ purge auto).
      // Évite saturation Redis long-terme sur high-volume workers.
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on("ready", () => console.log("[option-reminder-worker] ready"));
  worker.on("failed", (job, err) => {
    console.error(`[option-reminder-worker] failed: ${err.message}`);
    captureWorkerError("option-reminder", "option-reminder", job, err);
  });

  return worker;
}

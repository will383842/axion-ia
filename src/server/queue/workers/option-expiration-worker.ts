// Worker BullMQ — expiration options 48h (Sprint 15 / M8 step 4).
//
// Tick toutes les 5 minutes (cron pattern repeatable). Pour chaque option
// status='pending' avec expiresAt < now :
//   1. Flip option.status='expired'
//   2. Libère le slot calendar_slot.status='available' (sauf si admin a deja
//      passe a 'reserved' via une autre option ou booking).
//   3. Enqueue email option-expired pour le client.
//   4. Notifie Telegram [OPTION EXPIRÉE].

import { Worker } from "bullmq";
import { getBullConnection } from "../connection";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "../queues";
import { sendTelegram } from "@/lib/telegram";
import type { OptionExpirationJobData } from "../types";

export function startOptionExpirationWorker(): Worker<OptionExpirationJobData> {
  const worker = new Worker<OptionExpirationJobData>(
    "option-expiration",
    async () => {
      const expired = await prisma.bookingOption.findMany({
        where: { status: "pending", expiresAt: { lt: new Date() } },
        select: {
          id: true,
          slotId: true,
          contactName: true,
          contactEmail: true,
          locale: true,
          interventionType: true,
          slot: { select: { slotDate: true, status: true } },
        },
      });

      if (expired.length === 0) return;

      for (const opt of expired) {
        await prisma.$transaction(async (tx) => {
          await tx.bookingOption.update({
            where: { id: opt.id },
            data: { status: "expired" },
          });
          // Libere le slot uniquement si toujours reserved par cette option
          // (et qu'il n'est pas devenu un booking ferme).
          if (opt.slot?.status === "reserved") {
            const otherActiveOption = await tx.bookingOption.findFirst({
              where: {
                slotId: opt.slotId,
                status: { in: ["pending", "confirmed"] },
                NOT: { id: opt.id },
              },
              select: { id: true },
            });
            const hasBooking = await tx.booking.findFirst({
              where: { slotId: opt.slotId },
              select: { id: true },
            });
            if (!otherActiveOption && !hasBooking) {
              await tx.calendarSlot.update({
                where: { id: opt.slotId },
                data: {
                  status: "available",
                  displaySector: null,
                  interventionType: null,
                  participantsCount: null,
                },
              });
            }
          }
        });

        await enqueueEmail("option-expired", opt.contactEmail, opt.locale, {
          contactName: opt.contactName,
          bookingDate: opt.slot?.slotDate.toISOString().slice(0, 10) ?? "",
          interventionType: opt.interventionType,
        });

        await sendTelegram({
          tag: "OPTION EXPIRÉE",
          body: `Option \`${opt.id}\` expirée\n• Contact : ${opt.contactName}\n• Date : ${opt.slot?.slotDate.toISOString().slice(0, 10)}\n• Intervention : ${opt.interventionType}`,
          silent: true,
        });
      }
      console.log(`[option-expiration] expired ${expired.length} option(s)`);
    },
    { connection: getBullConnection(), concurrency: 1 },
  );

  worker.on("ready", () => console.log("[option-expiration-worker] ready"));
  worker.on("failed", (_job, err) =>
    console.error(`[option-expiration-worker] failed: ${err.message}`),
  );

  return worker;
}

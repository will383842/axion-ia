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
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "../queues";
import { sendTelegram } from "@/lib/telegram";
import { redactName } from "@/lib/pii-redaction";
import type { OptionExpirationJobData } from "../types";

export function startOptionExpirationWorker(): Worker<OptionExpirationJobData> {
  const worker = new Worker<OptionExpirationJobData>(
    "option-expiration",
    async () => {
      // Liste les expirees a l'instant — donnees indicatives, status sera
      // re-verifie dans la tx avec lock pessimiste (Sprint 15 fix Fork 1 C1).
      const expired = await prisma.bookingOption.findMany({
        where: { status: "pending", expiresAt: { lt: new Date() } },
        select: {
          id: true,
          slotId: true,
          contactName: true,
          contactEmail: true,
          locale: true,
          interventionType: true,
        },
      });

      if (expired.length === 0) return;

      for (const opt of expired) {
        // Sprint 15 fix Fork 1 C1 : on RE-LIT slot.status DANS la tx avec
        // SELECT FOR UPDATE pour eviter la race avec une confirmation admin
        // (qui aurait pu changer status='reserved' → 'confirmed' via booking
        // ferme entre temps).
        const result = await prisma.$transaction(async (tx) => {
          // Verrouille le slot pendant cette tx
          const slotRows = await tx.$queryRaw<Array<{ status: string; slot_date: Date }>>`
            SELECT status, slot_date FROM calendar_slots
            WHERE id = ${opt.slotId}::uuid
            FOR UPDATE
          `;
          const slot = slotRows[0];
          if (!slot) return null;

          // Re-verifie que l'option est toujours pending (un admin peut
          // l'avoir confirmee ou refusee entre le findMany et la tx).
          const opt2 = await tx.bookingOption.findUnique({
            where: { id: opt.id },
            select: { status: true },
          });
          if (!opt2 || opt2.status !== "pending") return null;

          await tx.bookingOption.update({
            where: { id: opt.id },
            data: { status: "expired" },
          });

          // Libere le slot uniquement si toujours reserved par cette option
          // (et qu'il n'est pas devenu un booking ferme entre temps).
          if (slot.status === "reserved") {
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
          return { slotDate: slot.slot_date };
        });

        // Skip notif/email si option deja traitee par admin (race detected)
        if (!result) continue;

        await enqueueEmail("option-expired", opt.contactEmail, opt.locale, {
          contactName: opt.contactName,
          bookingDate: result.slotDate.toISOString().slice(0, 10),
          interventionType: opt.interventionType,
        });

        await sendTelegram({
          tag: "OPTION EXPIRÉE",
          body: `Option \`${opt.id}\` expirée\n• Contact : ${redactName(opt.contactName)}\n• Date : ${result.slotDate.toISOString().slice(0, 10)}\n• Intervention : ${opt.interventionType}`,
          silent: true,
        });
      }
      console.log(`[option-expiration] expired ${expired.length} option(s)`);
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

  worker.on("ready", () => console.log("[option-expiration-worker] ready"));
  worker.on("failed", (job, err) => {
    console.error(`[option-expiration-worker] failed: ${err.message}`);
    captureWorkerError("option-expiration", "option-expiration", job, err);
  });

  return worker;
}

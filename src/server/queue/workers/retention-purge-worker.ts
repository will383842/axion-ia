// Worker BullMQ — purge RGPD quotidienne (Sprint 24 / D3).
//
// Cron 03:00 UTC. Pour chaque table cible :
//   - activity_logs : suppression hard si created_at > N mois (default 12).
//   - submissions   : suppression hard si status='archived' ET updated_at > N mois (default 24).
//   - newsletter_subscribers : suppression hard si status='unsubscribed' ET unsubscribed_at > N mois (default 36).
//                              On ne conserve que email_hash dans activity_log
//                              (handle propre RGPD art. 17 droit à l'oubli +
//                              audit trail nominatif).
//   - bookings      : suppression hard si status='cancelled' ET updated_at > N mois (default 12).
//
// Variables env :
//   RETENTION_LOGS_MONTHS=12
//   RETENTION_SUBS_ARCHIVE_MONTHS=24
//   RETENTION_NEWSLETTER_UNSUB_MONTHS=36
//   RETENTION_BOOKINGS_CANCELLED_MONTHS=12
//
// Sécurité : aucune action si valeur < 1 (anti-misconfig accidentel).

import { Worker } from "bullmq";
import { getBullConnection } from "../connection";
import { prisma } from "@/lib/prisma";
import type { RetentionPurgeJobData } from "../types";

const DEFAULTS = {
  logs: 12,
  submissionsArchived: 24,
  newsletterUnsub: 36,
  bookingsCancelled: 12,
} as const;

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

function readMonths(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

async function hashEmail(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.toLowerCase().trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function startRetentionPurgeWorker(): Worker<RetentionPurgeJobData> {
  const worker = new Worker<RetentionPurgeJobData>(
    "retention-purge",
    async () => {
      const counts = { logs: 0, submissions: 0, newsletter: 0, bookings: 0 };

      // 1) activity_logs ancients
      const logsMonths = readMonths("RETENTION_LOGS_MONTHS", DEFAULTS.logs);
      const logsResult = await prisma.activityLog.deleteMany({
        where: { createdAt: { lt: monthsAgo(logsMonths) } },
      });
      counts.logs = logsResult.count;

      // 2) submissions archivées anciennes
      const subsMonths = readMonths("RETENTION_SUBS_ARCHIVE_MONTHS", DEFAULTS.submissionsArchived);
      const archivedSubs = await prisma.submission.findMany({
        where: { status: "archived", updatedAt: { lt: monthsAgo(subsMonths) } },
        select: { id: true, contactEmail: true, type: true },
      });
      for (const s of archivedSubs) {
        await prisma.$transaction(async (tx) => {
          await tx.booking.updateMany({
            where: { submissionId: s.id },
            data: { submissionId: null },
          });
          await tx.submission.delete({ where: { id: s.id } });
          await tx.activityLog.create({
            data: {
              adminUserId: null,
              action: "submission.purged",
              targetType: "submission",
              targetId: s.id,
              changes: {
                emailHash: await hashEmail(s.contactEmail),
                type: s.type,
                policy: "retention",
                ageMonths: subsMonths,
              },
            },
          });
        });
        counts.submissions++;
      }

      // 3) newsletter_subscribers unsubscribed anciens
      const newsMonths = readMonths("RETENTION_NEWSLETTER_UNSUB_MONTHS", DEFAULTS.newsletterUnsub);
      const oldUnsub = await prisma.newsletterSubscriber.findMany({
        where: {
          status: "unsubscribed",
          unsubscribedAt: { lt: monthsAgo(newsMonths) },
        },
        select: { id: true, email: true },
      });
      for (const sub of oldUnsub) {
        await prisma.$transaction(async (tx) => {
          await tx.newsletterSubscriber.delete({ where: { id: sub.id } });
          await tx.activityLog.create({
            data: {
              adminUserId: null,
              action: "newsletter.purged",
              targetType: "newsletter_subscriber",
              targetId: sub.id,
              changes: {
                emailHash: await hashEmail(sub.email),
                policy: "retention",
                ageMonths: newsMonths,
              },
            },
          });
        });
        counts.newsletter++;
      }

      // 4) bookings cancelled anciens
      const bookingsMonths = readMonths(
        "RETENTION_BOOKINGS_CANCELLED_MONTHS",
        DEFAULTS.bookingsCancelled,
      );
      const cancelledBookings = await prisma.booking.deleteMany({
        where: { status: "cancelled", updatedAt: { lt: monthsAgo(bookingsMonths) } },
      });
      counts.bookings = cancelledBookings.count;

      console.log(
        `[retention-purge] logs=${counts.logs} submissions=${counts.submissions} ` +
          `newsletter=${counts.newsletter} bookings=${counts.bookings}`,
      );
    },
    { connection: getBullConnection(), concurrency: 1 },
  );

  worker.on("ready", () => console.log("[retention-purge-worker] ready"));
  worker.on("failed", (_job, err) =>
    console.error(`[retention-purge-worker] failed: ${err.message}`),
  );

  return worker;
}

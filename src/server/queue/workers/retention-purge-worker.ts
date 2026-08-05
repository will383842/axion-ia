// Worker BullMQ — purge RGPD quotidienne (Sprint 24 / D3 + audit B5 2026-05-15).
//
// Cron 03:00 UTC. Pour chaque table cible :
//   - activity_logs : suppression hard si created_at > N mois (default 12).
//   - submissions   : suppression hard si status='archived' ET updated_at > N mois (default 24).
//   - newsletter_subscribers : suppression hard si status='unsubscribed' ET unsubscribed_at > N mois (default 36).
//                              On ne conserve que email_hash dans activity_log
//                              (handle propre RGPD art. 17 droit à l'oubli +
//                              audit trail nominatif).
//   - bookings      : suppression hard si status='cancelled' ET updated_at > N mois (default 12).
//   - generation_logs (audit B5 P0-7) : logs techniques content-gen — purge à N mois
//                              (default 12). Ces logs sont append-only et lient les
//                              prompts content-gen à un job_id non-PII. Pas d'export
//                              RGPD utilisateur (cf. politique-confidentialite §
//                              IA générative — logs techniques exclus art. 23 RGPD).
//   - cost_ledger (audit B5 P0-7) : ledger atomique provider IA — purge à N mois
//                              (default 24, alignée obligation comptable française).
//                              Aucun PII (provider key + montant USD seulement).
//   - web_vital_samples (audit B5 P0-7) : RUM agrégé Web Vitals — purge à N mois
//                              (default 6). Pas de PII (sessionId anonyme client).
//
// Variables env :
//   RETENTION_LOGS_MONTHS=12
//   RETENTION_SUBS_ARCHIVE_MONTHS=24
//   RETENTION_NEWSLETTER_UNSUB_MONTHS=36
//   RETENTION_BOOKINGS_CANCELLED_MONTHS=12
//   RETENTION_GENERATION_LOGS_MONTHS=12   (audit B5)
//   RETENTION_COST_LEDGER_MONTHS=24       (audit B5 — obligation comptable française)
//   RETENTION_WEB_VITALS_MONTHS=6         (audit B5)
//   RETENTION_CHAT_MONTHS=12              (chatbot — conversations/messages/escalades + cache/idempotence)
//
// Sécurité : aucune action si valeur < 1 (anti-misconfig accidentel).

import { Worker } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import type { RetentionPurgeJobData } from "../types";

const DEFAULTS = {
  logs: 12,
  submissionsArchived: 24,
  newsletterUnsub: 36,
  bookingsCancelled: 12,
  generationLogs: 12,
  costLedger: 24,
  webVitals: 6,
  imageLogs: 12,
  chat: 12,
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
      const counts = {
        logs: 0,
        submissions: 0,
        newsletter: 0,
        bookings: 0,
        generationLogs: 0,
        costLedger: 0,
        webVitals: 0,
        imageUsageLogs: 0,
        imageDownloadLogs: 0,
        chatConversations: 0,
        chatEscalations: 0,
        chatSemanticCache: 0,
        chatIdempotency: 0,
      };

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

      // 5) generation_logs anciens (content-gen audit trail technique, audit B5 P0-7).
      // GenerationLog.timestamp = createdAt — pas de updatedAt (table append-only).
      const genLogsMonths = readMonths("RETENTION_GENERATION_LOGS_MONTHS", DEFAULTS.generationLogs);
      const genLogsResult = await prisma.generationLog.deleteMany({
        where: { timestamp: { lt: monthsAgo(genLogsMonths) } },
      });
      counts.generationLogs = genLogsResult.count;

      // 6) cost_ledger ancien (atomique provider IA, audit B5 P0-7).
      // Aucune PII, juste provider + model + tokens + costUsd. 24 mois alignés
      // obligation comptable française (la table comptable principale reste
      // les invoices Stripe — ce ledger est observabilité interne).
      const costLedgerMonths = readMonths("RETENTION_COST_LEDGER_MONTHS", DEFAULTS.costLedger);
      const costLedgerResult = await prisma.costLedger.deleteMany({
        where: { timestamp: { lt: monthsAgo(costLedgerMonths) } },
      });
      counts.costLedger = costLedgerResult.count;

      // 7) web_vital_samples anciens (RUM, audit B5 P0-7).
      // sessionId est généré client (anonyme). userAgent peut être quasi-identifiant
      // → purge agressive 6 mois par défaut (alignée pratique RUM industrielle).
      const webVitalsMonths = readMonths("RETENTION_WEB_VITALS_MONTHS", DEFAULTS.webVitals);
      const webVitalsResult = await prisma.webVitalSample.deleteMany({
        where: { createdAt: { lt: monthsAgo(webVitalsMonths) } },
      });
      counts.webVitals = webVitalsResult.count;

      // 8) image_usage_logs + image_download_logs (image-bank Sprint 7 V1).
      // ip_hash SHA-256 + IP_HASH_SALT — non réversible mais quasi-identifiant
      // longue durée. Purge 12 mois par défaut (RGPD art. 5.1.e minimisation).
      const imageLogsMonths = readMonths("RETENTION_IMAGE_LOGS_MONTHS", DEFAULTS.imageLogs);
      const imageUsageResult = await prisma.imageUsageLog.deleteMany({
        where: { createdAt: { lt: monthsAgo(imageLogsMonths) } },
      });
      const imageDownloadResult = await prisma.imageDownloadLog.deleteMany({
        where: { downloadedAt: { lt: monthsAgo(imageLogsMonths) } },
      });
      counts.imageUsageLogs = imageUsageResult.count;
      counts.imageDownloadLogs = imageDownloadResult.count;

      // 9) chat_* anciens (RGPD — chatbot). Le contenu (chat_messages.contenu,
      // chat_conversations.{prospect_profile, resume, ip_hash}, chat_escalations.
      // contact_email) est de la PII. Les chat_messages partent en CASCADE avec
      // la conversation (FK ON DELETE CASCADE). Cache sémantique + clés
      // d'idempotence = housekeeping non-PII.
      const chatMonths = readMonths("RETENTION_CHAT_MONTHS", DEFAULTS.chat);
      const chatConvResult = await prisma.chatConversation.deleteMany({
        where: { updatedAt: { lt: monthsAgo(chatMonths) } },
      });
      counts.chatConversations = chatConvResult.count;
      const chatEscResult = await prisma.chatEscalation.deleteMany({
        where: { createdAt: { lt: monthsAgo(chatMonths) } },
      });
      counts.chatEscalations = chatEscResult.count;
      const chatCacheResult = await prisma.chatSemanticCache.deleteMany({
        where: { createdAt: { lt: monthsAgo(chatMonths) } },
      });
      counts.chatSemanticCache = chatCacheResult.count;
      const chatIdemResult = await prisma.chatActionIdempotency.deleteMany({
        where: { createdAt: { lt: monthsAgo(chatMonths) } },
      });
      counts.chatIdempotency = chatIdemResult.count;

      // Prospection & Base Entreprises — purge par `retentionUntil` (3 ans après
      // dernière action, entreprise ET personne) + journal d'accès ancien (RGPD).
      const now = new Date();
      const prospCompanies = await prisma.prospectionCompany.deleteMany({
        where: { retentionUntil: { not: null, lt: now } },
      });
      const prospPersons = await prisma.prospectionPerson.deleteMany({
        where: { retentionUntil: { not: null, lt: now } },
      });
      // Prospection Santé V2 — praticiens (données NOMINATIVES de pro de santé) :
      // même horizon de conservation, sinon rétention illimitée (art. 5.1.e).
      const prospPractitioners = await prisma.prospectionHealthPractitioner.deleteMany({
        where: { retentionUntil: { not: null, lt: now } },
      });
      const accessLogMonths = readMonths("RETENTION_PROSPECTION_ACCESS_MONTHS", 12);
      const prospAccess = await prisma.prospectionAccessLog.deleteMany({
        where: { createdAt: { lt: monthsAgo(accessLogMonths) } },
      });

      // Parcours vente — brouillons du wizard « Nouvelle vente » : le payload
      // contient des PII (contact saisi avant création du Client). Même pattern
      // `retentionUntil` que la prospection ci-dessus. Les brouillons convertis
      // sont supprimés dès la création du devis (côté action) ; ici on ramasse
      // les abandonnés. Jamais de purge des pièces émises (Devis, factures,
      // DocumentGenere : obligation comptable).
      const venteBrouillons = await prisma.venteBrouillon.deleteMany({
        where: { retentionUntil: { not: null, lt: now } },
      });
      console.log(`[retention-purge][vente] brouillons=${venteBrouillons.count}`);
      console.log(
        `[retention-purge][prospection] companies=${prospCompanies.count} ` +
          `persons=${prospPersons.count} practitioners=${prospPractitioners.count} ` +
          `accessLogs=${prospAccess.count}`,
      );

      console.log(
        `[retention-purge] logs=${counts.logs} submissions=${counts.submissions} ` +
          `newsletter=${counts.newsletter} bookings=${counts.bookings} ` +
          `generationLogs=${counts.generationLogs} costLedger=${counts.costLedger} ` +
          `webVitals=${counts.webVitals} ` +
          `imageUsageLogs=${counts.imageUsageLogs} imageDownloadLogs=${counts.imageDownloadLogs} ` +
          `chatConversations=${counts.chatConversations} chatEscalations=${counts.chatEscalations} ` +
          `chatSemanticCache=${counts.chatSemanticCache} chatIdempotency=${counts.chatIdempotency}`,
      );
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

  worker.on("ready", () => console.log("[retention-purge-worker] ready"));
  worker.on("failed", (job, err) => {
    console.error(`[retention-purge-worker] failed: ${err.message}`);
    captureWorkerError("retention-purge", "retention-purge", job, err);
  });

  return worker;
}

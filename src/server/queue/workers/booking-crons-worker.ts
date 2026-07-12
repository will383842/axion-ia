// Worker BullMQ — Booking V1 crons (Sprint X.12).
//
// Une seule queue `booking-crons` qui dispatche par `type`. Permet de
// mutualiser la connexion Redis + le worker pour les ~11 jobs de scan
// quotidiens (relances paiement, J-7/J-1 reminders, expiration devis, etc.).
//
// Chaque handler est idempotent (peut être ré-exécuté sans effet secondaire
// néfaste) — un job loupé une fois sera rattrapé au tick suivant.
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.12 (~21 jobs cibles V1)
//   - 03-ARCHITECTURE-CIBLE §5.6 (Crons & workers cible V1)

import { Worker } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "../queues";
import { decryptPii } from "@/lib/pii-crypto";
import { sendTelegram } from "@/lib/telegram";
import { applyTransition, StateMachineError } from "@/features/booking/state-machine";
import type { BookingCronJobData, BookingCronJobType, EmailJobName } from "../types";

// ====================================================================
// Helpers temporels
// ====================================================================

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(0, 0, 0, 0);
  return r;
}
function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(23, 59, 59, 999);
  return r;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

async function enqueueClientEmail(
  template: EmailJobName,
  payload: {
    contactEmail: string | null | undefined;
    locale: "fr" | "en";
    data: Record<string, unknown>;
  },
): Promise<void> {
  if (!payload.contactEmail) return;
  // Méta-cert 2026-05-15 AGENT 12 P0 OWASP A02 — décrypter contactEmail avant
  // envoi email. Les rows écrites post-PII_ENCRYPTION_KEY set sont au format
  // `enc:v1:...`. `decryptPii` passe-through si cleartext legacy ou si la clé
  // est absente (dev). Idem `decryptPii` sur contactName dans payload.data.
  const recipient = decryptPii(payload.contactEmail);
  if (payload.data && typeof payload.data === "object" && "contactName" in payload.data) {
    const name = (payload.data as Record<string, unknown>).contactName;
    if (typeof name === "string") {
      (payload.data as Record<string, unknown>).contactName = decryptPii(name);
    }
  }
  await enqueueEmail(template, recipient, payload.locale, payload.data).catch(() => {
    /* fail-soft */
  });
}

// ====================================================================
// Handlers
// ====================================================================

/**
 * Daily 08:00 UTC — scan invoices issued/partially_paid avec dueAt passé.
 *
 * ⚠️ Phase 4 Hub facturation (règle produit ABSOLUE) : ce handler N'ENVOIE
 * PLUS AUCUN email client. Il DÉTECTE (statut overdue) et PROPOSE une relance
 * (`RelanceProposee`, une par facture+palier, idempotent) + Telegram INTERNE.
 * L'envoi au client = clic admin dans « Relances à traiter » (Hub).
 */
async function handlePaymentOverdueScan(): Promise<void> {
  const now = new Date();
  const j15 = startOfDay(addDays(now, -15));
  const j30 = startOfDay(addDays(now, -30));

  const candidates = await prisma.invoice.findMany({
    where: {
      status: { in: ["issued", "partially_paid", "overdue"] },
      dueAt: { lt: now },
    },
    select: {
      id: true,
      number: true,
      dueAt: true,
      amountTtcCents: true,
      status: true,
      booking: { select: { id: true } },
    },
  });

  let proposees = 0;
  for (const inv of candidates) {
    if (!inv.dueAt) continue;
    const dueDate = startOfDay(inv.dueAt);
    const palier =
      dueDate.getTime() <= j30.getTime()
        ? "j30"
        : dueDate.getTime() <= j15.getTime()
          ? "j15"
          : "j1";

    // Statut overdue (idempotent, détection seule).
    if (inv.status !== "overdue") {
      await prisma.invoice
        .update({ where: { id: inv.id }, data: { status: "overdue" } })
        .catch(() => {});
    }

    // Une proposition par facture+palier (idempotence applicative).
    const deja = await prisma.relanceProposee.findFirst({
      where: { invoiceId: inv.id, palier },
      select: { id: true },
    });
    if (deja !== null) continue;

    await prisma.relanceProposee.create({
      data: {
        type: "facture_retard",
        palier,
        invoiceId: inv.id,
        suggestion: `Facture ${inv.number} (${(inv.amountTtcCents / 100).toFixed(2)} € TTC) échue le ${inv.dueAt.toLocaleDateString("fr-FR")} — relance ${palier.toUpperCase()}.`,
      },
    });
    proposees++;

    if (palier !== "j1") {
      await sendTelegram({
        tag: "AUTO",
        body: `💸 Relance ${palier} À TRAITER (manuelle) — facture ${inv.number} (booking ${inv.booking.id})`,
        silent: true,
      }).catch(() => {});
    }
  }

  console.log(
    `[booking-crons] payment-overdue-scan: ${candidates.length} facture(s) échue(s), ${proposees} relance(s) proposée(s) — AUCUN email client (manuel)`,
  );
}

/**
 * Daily 08:00 UTC — bookings confirmed à J+7 → reminder paiement solde.
 */
async function handleBookingJ7Reminder(): Promise<void> {
  const now = new Date();
  const target = startOfDay(addDays(now, 7));
  const targetEnd = endOfDay(target);

  const bookings = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      bookingDate: { gte: target, lte: targetEnd },
    },
    select: {
      id: true,
      interventionType: true,
      bookingDate: true,
      balanceAmountCents: true,
      locale: true,
      submission: { select: { contactEmail: true, contactName: true } },
      fromSubmission: { select: { contactEmail: true, contactName: true } },
    },
  });

  for (const b of bookings) {
    const sub = b.fromSubmission ?? b.submission;
    await enqueueClientEmail("payment-reminder-j7", {
      contactEmail: sub?.contactEmail,
      locale: b.locale === "en" ? "en" : "fr",
      data: {
        contactName: sub?.contactName ?? "Client",
        interventionType: b.interventionType,
        bookingDate: b.bookingDate.toISOString().slice(0, 10),
        balanceAmount: b.balanceAmountCents ? (b.balanceAmountCents / 100).toFixed(2) : null,
      },
    });
  }
  console.log(`[booking-crons] booking-j7-reminder sent for ${bookings.length} booking(s)`);
}

/**
 * Daily 08:00 UTC — bookings confirmed/in_progress à J+1 → reminder.
 */
async function handleBookingJ1Reminder(): Promise<void> {
  const now = new Date();
  const target = startOfDay(addDays(now, 1));
  const targetEnd = endOfDay(target);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["confirmed", "in_progress"] },
      bookingDate: { gte: target, lte: targetEnd },
    },
    select: {
      id: true,
      interventionType: true,
      bookingDate: true,
      locale: true,
      submission: { select: { contactEmail: true, contactName: true } },
      fromSubmission: { select: { contactEmail: true, contactName: true } },
    },
  });

  for (const b of bookings) {
    const sub = b.fromSubmission ?? b.submission;
    await enqueueClientEmail("booking-j1-reminder", {
      contactEmail: sub?.contactEmail,
      locale: b.locale === "en" ? "en" : "fr",
      data: {
        contactName: sub?.contactName ?? "Client",
        interventionType: b.interventionType,
        bookingDate: b.bookingDate.toISOString().slice(0, 10),
      },
    });
  }
  console.log(`[booking-crons] booking-j1-reminder sent for ${bookings.length} booking(s)`);
}

/**
 * Daily 08:00 UTC — cadrageMeetings scheduledAt à J+1 → reminder.
 */
async function handleCadrageJ1Reminder(): Promise<void> {
  const now = new Date();
  const target = startOfDay(addDays(now, 1));
  const targetEnd = endOfDay(target);

  const cadrages = await prisma.cadrageMeeting.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { gte: target, lte: targetEnd },
    },
    select: {
      id: true,
      scheduledAt: true,
      visioUrl: true,
      bookings: {
        take: 1,
        select: {
          id: true,
          locale: true,
          interventionType: true,
          submission: { select: { contactEmail: true, contactName: true } },
          fromSubmission: { select: { contactEmail: true, contactName: true } },
        },
      },
    },
  });

  for (const c of cadrages) {
    const b = c.bookings[0];
    if (!b) continue;
    const sub = b.fromSubmission ?? b.submission;
    await enqueueClientEmail("cadrage-j1-reminder", {
      contactEmail: sub?.contactEmail,
      locale: b.locale === "en" ? "en" : "fr",
      data: {
        contactName: sub?.contactName ?? "Client",
        interventionType: b.interventionType,
        scheduledAt: c.scheduledAt.toISOString(),
        visioUrl: c.visioUrl ?? null,
      },
    });
  }
  console.log(`[booking-crons] cadrage-j1-reminder sent for ${cadrages.length} cadrage(s)`);
}

/**
 * Hourly — cadrageMeetings scheduledAt dans [now+2h, now+3h] → reminder H-2.
 */
async function handleCadrageH2Reminder(): Promise<void> {
  const now = new Date();
  const minTime = new Date(now.getTime() + 2 * 3600 * 1000);
  const maxTime = new Date(now.getTime() + 3 * 3600 * 1000);

  const cadrages = await prisma.cadrageMeeting.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { gte: minTime, lte: maxTime },
    },
    select: {
      id: true,
      scheduledAt: true,
      visioUrl: true,
      bookings: {
        take: 1,
        select: {
          id: true,
          locale: true,
          interventionType: true,
          submission: { select: { contactEmail: true, contactName: true } },
          fromSubmission: { select: { contactEmail: true, contactName: true } },
        },
      },
    },
  });

  for (const c of cadrages) {
    const b = c.bookings[0];
    if (!b) continue;
    const sub = b.fromSubmission ?? b.submission;
    await enqueueClientEmail("cadrage-h2-reminder", {
      contactEmail: sub?.contactEmail,
      locale: b.locale === "en" ? "en" : "fr",
      data: {
        contactName: sub?.contactName ?? "Client",
        interventionType: b.interventionType,
        scheduledAt: c.scheduledAt.toISOString(),
        visioUrl: c.visioUrl ?? null,
      },
    });
  }
  console.log(`[booking-crons] cadrage-h2-reminder sent for ${cadrages.length} cadrage(s)`);
}

/**
 * Daily — ContractDocument sent depuis >3j status=sent → contract-reminder.
 */
async function handleContractPendingReminder(): Promise<void> {
  const threshold = addDays(new Date(), -3);
  const contracts = await prisma.contractDocument.findMany({
    where: {
      status: "sent",
      sentAt: { lt: threshold },
    },
    select: {
      id: true,
      bookingId: true,
      sentAt: true,
      booking: {
        select: {
          locale: true,
          submission: { select: { contactEmail: true, contactName: true } },
          fromSubmission: { select: { contactEmail: true, contactName: true } },
        },
      },
    },
  });

  for (const c of contracts) {
    const sub = c.booking.fromSubmission ?? c.booking.submission;
    await enqueueClientEmail("contract-reminder", {
      contactEmail: sub?.contactEmail,
      locale: c.booking.locale === "en" ? "en" : "fr",
      data: {
        contactName: sub?.contactName ?? "Client",
        bookingId: c.bookingId,
        sentAt: c.sentAt?.toISOString().slice(0, 10) ?? null,
      },
    });
  }
  console.log(`[booking-crons] contract-pending-reminder sent for ${contracts.length} contract(s)`);
}

/**
 * Daily — Quote sent depuis >3j status=sent → quote-reminder.
 */
async function handleQuotePendingReminder(): Promise<void> {
  const threshold = addDays(new Date(), -3);
  const quotes = await prisma.quote.findMany({
    where: {
      status: "sent",
      sentAt: { lt: threshold },
    },
    select: {
      id: true,
      number: true,
      sentAt: true,
      validUntil: true,
      bookingId: true,
      booking: {
        select: {
          locale: true,
          submission: { select: { contactEmail: true, contactName: true } },
          fromSubmission: { select: { contactEmail: true, contactName: true } },
        },
      },
    },
  });

  // ⚠️ Phase 4 Hub facturation : plus d'email automatique — proposition de
  // relance idempotente (une par devis, palier j3), envoi = clic admin.
  let proposees = 0;
  for (const q of quotes) {
    const deja = await prisma.relanceProposee.findFirst({
      where: { quoteId: q.id, palier: "j3" },
      select: { id: true },
    });
    if (deja !== null) continue;
    await prisma.relanceProposee.create({
      data: {
        type: "devis_sans_reponse",
        palier: "j3",
        quoteId: q.id,
        suggestion: `Devis ${q.number} envoyé sans réponse depuis 3 jours (valable jusqu'au ${q.validUntil.toLocaleDateString("fr-FR")}) — relance de courtoisie.`,
      },
    });
    proposees++;
  }
  console.log(
    `[booking-crons] quote-pending-reminder: ${quotes.length} devis sans réponse, ${proposees} relance(s) proposée(s) — AUCUN email client (manuel)`,
  );
}

/**
 * Daily — Quote validUntil < now ET status=sent → mark expired + email.
 */
async function handleQuoteExpirationCheck(): Promise<void> {
  const now = new Date();
  const expired = await prisma.quote.findMany({
    where: {
      status: "sent",
      validUntil: { lt: now },
    },
    select: {
      id: true,
      number: true,
      bookingId: true,
      booking: {
        select: {
          locale: true,
          submission: { select: { contactEmail: true, contactName: true } },
          fromSubmission: { select: { contactEmail: true, contactName: true } },
        },
      },
    },
  });

  for (const q of expired) {
    await prisma.quote.update({ where: { id: q.id }, data: { status: "expired" } });
    const sub = q.booking.fromSubmission ?? q.booking.submission;
    await enqueueClientEmail("quote-expired", {
      contactEmail: sub?.contactEmail,
      locale: q.booking.locale === "en" ? "en" : "fr",
      data: {
        contactName: sub?.contactName ?? "Client",
        quoteNumber: q.number,
        bookingId: q.bookingId,
      },
    });
  }
  console.log(`[booking-crons] quote-expiration-check expired ${expired.length} quote(s)`);
}

/**
 * Daily (D52) — bookings status=contract_payment_sent depuis 10j+ sans
 * paiement → annule pour défaut paiement (clause CGV résolution).
 */
async function handleContractSignedWithoutDepositCutoff(): Promise<void> {
  const now = new Date();
  const cutoffDate = addDays(now, -10);
  const bookings = await prisma.booking.findMany({
    where: {
      status: "contract_payment_sent",
      updatedAt: { lt: cutoffDate },
      depositPaidAt: null,
    },
    select: {
      id: true,
      locale: true,
      submission: { select: { contactEmail: true, contactName: true } },
      fromSubmission: { select: { contactEmail: true, contactName: true } },
    },
  });

  for (const b of bookings) {
    try {
      await prisma.$transaction(async (tx) => {
        await applyTransition(tx, b.id, {
          to: "cancelled_by_admin",
          trigger: "cron.contract_signed_without_deposit_cutoff",
          triggeredBy: "cron",
          reason: "Acompte non reçu après 10 jours — résolution clause CGV D52/D53.",
        });
      });
      await sendTelegram({
        tag: "AUTO",
        body: `⏰ Booking ${b.id} auto-annulé : acompte non reçu sous 10j (clause D52).`,
        silent: true,
      });
    } catch (e) {
      if (!(e instanceof StateMachineError)) console.error("[contract-cutoff]", e);
    }
  }
  console.log(
    `[booking-crons] contract-signed-without-deposit-cutoff: ${bookings.length} cancelled`,
  );
}

/**
 * Daily — bookings paused dont pausedUntil approche (≤7j) → telegram Will.
 */
async function handleBookingPausedResumeReminder(): Promise<void> {
  const now = new Date();
  const limit = addDays(now, 7);
  const bookings = await prisma.booking.findMany({
    where: {
      status: "paused",
      pausedUntil: { lte: limit, gte: now },
    },
    select: {
      id: true,
      pausedUntil: true,
      pauseReason: true,
      submission: { select: { companyName: true } },
      fromSubmission: { select: { companyName: true } },
    },
  });

  for (const b of bookings) {
    const company = b.fromSubmission?.companyName ?? b.submission?.companyName ?? "—";
    await sendTelegram({
      tag: "AUTO",
      body: `⏸ Reprise prévue ${b.pausedUntil?.toISOString().slice(0, 10) ?? "?"} : ${company} (booking ${b.id})`,
      silent: true,
    }).catch(() => {});
  }
  console.log(`[booking-crons] booking-paused-resume-reminder: ${bookings.length} ping(s)`);
}

/**
 * Evening (18h) — bookings completed le jour même → thanks email (D57 retiré).
 * V1 minimal : envoie booking-completed-thanks le soir du completion.
 */
async function handleBookingCompletedThanksSweep(): Promise<void> {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const bookings = await prisma.booking.findMany({
    where: {
      status: "completed",
      completedAt: { gte: dayStart, lte: dayEnd },
    },
    select: {
      id: true,
      interventionType: true,
      locale: true,
      submission: { select: { contactEmail: true, contactName: true } },
      fromSubmission: { select: { contactEmail: true, contactName: true } },
    },
  });

  for (const b of bookings) {
    const sub = b.fromSubmission ?? b.submission;
    await enqueueClientEmail("booking-completed-thanks", {
      contactEmail: sub?.contactEmail,
      locale: b.locale === "en" ? "en" : "fr",
      data: {
        contactName: sub?.contactName ?? "Client",
        interventionType: b.interventionType,
        bookingId: b.id,
      },
    });
  }
  console.log(`[booking-crons] booking-completed-thanks-sweep: ${bookings.length} sent`);
}

// ====================================================================
// Worker dispatcher
// ====================================================================

const HANDLERS: Record<BookingCronJobType, () => Promise<void>> = {
  "payment-overdue-scan": handlePaymentOverdueScan,
  "booking-j7-reminder": handleBookingJ7Reminder,
  "booking-j1-reminder": handleBookingJ1Reminder,
  "cadrage-j1-reminder": handleCadrageJ1Reminder,
  "cadrage-h2-reminder": handleCadrageH2Reminder,
  "contract-pending-reminder": handleContractPendingReminder,
  "quote-pending-reminder": handleQuotePendingReminder,
  "quote-expiration-check": handleQuoteExpirationCheck,
  "contract-signed-without-deposit-cutoff": handleContractSignedWithoutDepositCutoff,
  "booking-paused-resume-reminder": handleBookingPausedResumeReminder,
  "booking-completed-thanks-sweep": handleBookingCompletedThanksSweep,
};

export function startBookingCronsWorker(): Worker<BookingCronJobData> {
  const worker = new Worker<BookingCronJobData>(
    "booking-crons",
    async (job) => {
      const handler = HANDLERS[job.data.type];
      if (!handler) {
        console.warn(`[booking-crons-worker] unknown job type: ${job.data.type}`);
        return;
      }
      await handler();
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

  worker.on("ready", () => console.log("[booking-crons-worker] ready"));
  worker.on("failed", (job, err) => {
    console.error(`[booking-crons-worker] failed type=${job?.data?.type ?? "?"}: ${err.message}`);
    captureWorkerError("booking-crons", "booking-crons", job, err);
  });

  return worker;
}

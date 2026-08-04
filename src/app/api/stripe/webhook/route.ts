// POST /api/stripe/webhook — Stripe webhook ingestion (Sprint X.2 + X.2 final).
//
// SOURCE :
//   - ADR 0013 — Stripe Checkout V1
//   - 03-ARCHITECTURE-CIBLE §5.2.4 (webhook lifecycle)
//   - 04-PLAN-EXECUTION Sprint X.2 (skeleton) + X.2 final (full dispatch)
//   - Agent 4 §5.2 (outbox + idempotence) + Agent 8 P0-2 (signature)
//
// PIPELINE :
//   1. Lire le body RAW (Stripe exige bytes-exact pour signature HMAC).
//   2. Vérifier la signature avec `stripe.webhooks.constructEvent` (5 min
//      tolerance par défaut).
//   3. Idempotency outbox : INSERT `StripeWebhookEvent` avec `stripeEventId`
//      UNIQUE. Si conflict → event déjà reçu, return 200 sans re-traitement.
//   4. Dispatch sync inline pour les 4 events critiques :
//        - `checkout.session.completed` → Payment.succeeded + transition
//          `awaiting_admin_validation` (D50 deposit-gated)
//        - `payment_intent.payment_failed` → Payment.failed + email
//        - `charge.refunded` → Refund record + transition `refunded_*`
//        - `charge.dispute.created` → Telegram URGENT (admin intervention)
//      V2 : déplacer le dispatch vers BullMQ workers (Sprint X.12).
//   5. Return 200 OK immédiat (Stripe attend < 5s, sinon retry).
//
// SÉCURITÉ :
//   - Stripe signature obligatoire (constructEvent throw si invalide).
//   - Idempotence DB : `providerEventId` UNIQUE sur Payment évite les
//     doublons même en cas de replay manuel Stripe.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getWebhookSecret, isStripeConfigured } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";
import { applyTransition, StateMachineError } from "@/features/booking/state-machine";
import { enqueueEmail } from "@/server/queue/queues";
import type {
  BookingStatus,
  PaymentType,
  RefundReason,
} from "../../../../../prisma/generated/client";

const KNOWN_EVENTS = new Set<Stripe.Event["type"]>([
  "checkout.session.completed",
  "payment_intent.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
  "review.opened",
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  // -- 0. L'INTERRUPTEUR NE COUPAIT QUE LE SORTANT (2026-08-04) ---------
  //
  // 🔴 `isStripeConfigured()` gardait la création de session Checkout
  // (`features/payment/actions.ts`) et les remboursements
  // (`features/booking/refund-actions.ts`) — mais PAS cette route. Stripe était
  // donc « éteint » dans un seul sens : rien ne partait, tout pouvait entrer.
  //
  // Ce qui suit n'est pas anodin : la route écrit dans `stripeWebhookEvent` PUIS
  // appelle `dispatchStripeEvent`, qui mute l'état des réservations et des
  // paiements. Un événement correctement signé aurait donc modifié des données
  // persistées d'une intégration réputée hors service.
  //
  // Constaté en production le 2026-08-04 : `STRIPE_ENABLED` absent, aucun code
  // client ne charge Stripe.js, et 0 ligne dans `stripe_webhook_events`,
  // `payments`, `bookings`. Rien n'est jamais entré — mais rien ne l'empêchait.
  //
  // 404 plutôt que 403 : une route de paiement désactivée n'a pas à confirmer
  // son existence. Et on refuse AVANT de lire le corps, donc sans rien traiter.
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // -- 1. Raw body (REQUIRED pour signature constructEvent) -------------
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  // -- 2. Vérification signature HMAC -----------------------------------
  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    const secret = getWebhookSecret();
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch {
    // Signature invalide = potentiellement une attaque.
    await sendTelegram({
      tag: "STRIPE_WEBHOOK_SIGNATURE_FAIL",
      body: `Webhook Stripe rejeté (signature invalide). IP: ${req.headers.get("x-forwarded-for") ?? "?"}`,
    }).catch(() => {});
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // -- 3. Outbox idempotence (Agent 4 §5.2) -----------------------------
  let webhookEventId: string;
  try {
    const inserted = await prisma.stripeWebhookEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        livemode: event.livemode,
        apiVersion: event.api_version ?? null,
        payload: event as unknown as object,
        eventCreatedAt: new Date(event.created * 1000),
      },
      select: { id: true },
    });
    webhookEventId = inserted.id;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json({ received: true, idempotent: true }, { status: 200 });
    }
    return NextResponse.json({ error: "outbox_failed" }, { status: 500 });
  }

  // -- 4. Dispatch sync inline (X.2 final) -----------------------------
  try {
    if (KNOWN_EVENTS.has(event.type)) {
      await dispatchStripeEvent(event);
    }
    await prisma.stripeWebhookEvent.update({
      where: { id: webhookEventId },
      data: { processedAt: new Date() },
    });
  } catch (err) {
    // Erreur de dispatch : on log mais on retourne 200 pour éviter le replay
    // infini de Stripe. L'event reste dans la table avec processedAt=NULL
    // pour reprocessing manuel admin.
    console.error("[stripe-webhook] dispatch failed", err);
    await prisma.stripeWebhookEvent
      .update({
        where: { id: webhookEventId },
        data: { error: (err as Error).message.slice(0, 500), retryCount: { increment: 1 } },
      })
      .catch(() => {});
    sendTelegram({
      tag: "STRIPE_EVENT",
      body: `⚠️ Stripe webhook dispatch error ${event.type} (${event.id}): ${(err as Error).message.slice(0, 200)}`,
    }).catch(() => {});
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

// ============================================================
// Dispatchers internes
// ============================================================

async function dispatchStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, event.id);
      break;
    case "payment_intent.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
      break;
    case "charge.refunded":
      await handleChargeRefunded(event.data.object as Stripe.Charge, event.id);
      break;
    case "charge.dispute.created":
      await handleDisputeCreated(event.data.object as Stripe.Dispute);
      break;
    default:
      // review.opened ou autres events outbox-stockés sans handler dédié V1.
      break;
  }
}

/**
 * checkout.session.completed → acompte reçu (D50 deposit-gated).
 *
 * 1. Lookup Invoice via metadata.invoiceId.
 * 2. INSERT Payment idempotent (providerEventId UNIQUE).
 * 3. Update Invoice status = paid.
 * 4. applyTransition booking → awaiting_admin_validation (admin valide
 *    ensuite manuellement sur calendrier = clic Will 2).
 * 5. Enqueue email `payment-receipt` au visiteur.
 * 6. Telegram admin : "Acompte reçu, valider sur calendrier".
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  eventId: string,
): Promise<void> {
  if (session.payment_status !== "paid") return;

  const invoiceId = session.metadata?.["invoiceId"];
  if (!invoiceId) {
    sendTelegram({
      tag: "STRIPE_EVENT",
      body: `⚠️ checkout.session.completed sans metadata.invoiceId (session ${session.id})`,
    }).catch(() => {});
    return;
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      number: true,
      type: true,
      amountTtcCents: true,
      bookingId: true,
      booking: {
        select: {
          locale: true,
          submission: { select: { contactEmail: true, contactName: true } },
        },
      },
    },
  });
  if (!invoice) {
    throw new Error(`[stripe-webhook] invoice ${invoiceId} not found for session ${session.id}`);
  }

  const paymentType: PaymentType = invoice.type === "deposit" ? "deposit" : "balance";
  const paidAt = session.created ? new Date(session.created * 1000) : new Date();

  // INSERT Payment idempotent.
  try {
    await prisma.payment.create({
      data: {
        bookingId: invoice.bookingId,
        invoiceId: invoice.id,
        provider: "stripe",
        providerEventId: eventId,
        ...(typeof session.payment_intent === "string"
          ? { providerPaymentIntentId: session.payment_intent }
          : {}),
        providerCheckoutSessionId: session.id,
        amountCents: session.amount_total ?? invoice.amountTtcCents,
        currency: (session.currency ?? "eur").toUpperCase(),
        type: paymentType,
        status: "succeeded",
        paidAt,
        mode: "card",
      },
    });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      // Payment déjà inséré (replay) → idempotent no-op.
      return;
    }
    throw err;
  }

  // Update Invoice status.
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: "paid", paidAt },
  });

  // Transition booking — best-effort (la state machine refuse les transitions
  // backward, donc safe en cas de replay).
  await tryTransition(invoice.bookingId, "awaiting_admin_validation", `stripe.${eventId}`);

  // Email visiteur + Telegram admin.
  const email = invoice.booking.submission?.contactEmail;
  if (email) {
    enqueueEmail("payment-receipt", email, invoice.booking.locale, {
      contactName: invoice.booking.submission?.contactName ?? "Client",
      invoiceNumber: invoice.number,
      amountTtc: ((session.amount_total ?? invoice.amountTtcCents) / 100).toFixed(2) + " €",
      paidAt: paidAt.toISOString().slice(0, 10),
      paymentType,
      bookingId: invoice.bookingId,
    }).catch(() => {});
  }
  sendTelegram({
    tag: "OPTION CONFIRMÉE",
    body: `💳 Acompte reçu pour ${invoice.number} (booking ${invoice.bookingId}). À valider sur calendrier.`,
  }).catch(() => {});
}

/**
 * payment_intent.payment_failed → Payment.failed + email retry.
 *
 * On ne touche pas au state machine ici : le booking reste en
 * contract_payment_sent, l'admin/le visiteur peuvent re-tenter.
 */
async function handlePaymentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  const invoiceId = pi.metadata?.["invoiceId"];
  if (!invoiceId) return;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      number: true,
      amountTtcCents: true,
      booking: {
        select: {
          locale: true,
          submission: { select: { contactEmail: true, contactName: true } },
        },
      },
    },
  });
  if (!invoice) return;

  const email = invoice.booking.submission?.contactEmail;
  if (email) {
    enqueueEmail("payment-failed", email, invoice.booking.locale, {
      contactName: invoice.booking.submission?.contactName ?? "Client",
      invoiceNumber: invoice.number,
      amountTtc: (invoice.amountTtcCents / 100).toFixed(2) + " €",
      ...(pi.last_payment_error?.code ? { reasonCode: pi.last_payment_error.code } : {}),
    }).catch(() => {});
  }
  sendTelegram({
    tag: "STRIPE_EVENT",
    body: `❌ Paiement échoué pour ${invoice.number}. Code: ${pi.last_payment_error?.code ?? "?"}`,
  }).catch(() => {});
}

/**
 * charge.refunded → Refund record + transition refunded_* selon scope.
 *
 * Stripe envoie cet event pour chaque refund (partiel ou total). On crée
 * un enregistrement Refund pour chaque charge.refunds.data, idempotent
 * sur stripeRefundId UNIQUE.
 */
async function handleChargeRefunded(charge: Stripe.Charge, _eventId: string): Promise<void> {
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!piId) return;

  const payment = await prisma.payment.findFirst({
    where: { providerPaymentIntentId: piId },
    select: {
      id: true,
      invoiceId: true,
      bookingId: true,
      amountCents: true,
    },
  });
  if (!payment || !payment.invoiceId) {
    sendTelegram({
      tag: "STRIPE_EVENT",
      body: `⚠️ charge.refunded pour PI ${piId} mais Payment introuvable.`,
    }).catch(() => {});
    return;
  }

  const refunds = charge.refunds?.data ?? [];
  for (const r of refunds) {
    const scope = r.amount === charge.amount ? "full" : "partial";
    try {
      await prisma.refund.create({
        data: {
          invoiceId: payment.invoiceId,
          paymentId: payment.id,
          amountCents: r.amount,
          reason: mapRefundReason(r.reason),
          scope,
          status: r.status === "succeeded" ? "succeeded" : "pending",
          stripeRefundId: r.id,
          ...(r.status === "succeeded" ? { processedAt: new Date(r.created * 1000) } : {}),
        },
      });
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") continue; // déjà enregistré
      throw err;
    }

    // Transition booking → refunded_partial/full (best-effort). `bookingId`
    // nullable depuis le Hub facturation — un Payment Stripe a toujours un
    // booking, mais on garde le guard pour le type.
    if (payment.bookingId !== null) {
      const target: BookingStatus = scope === "full" ? "refunded_full" : "refunded_partial";
      await tryTransition(payment.bookingId, target, `stripe.refund.${r.id}`);
    }
  }

  sendTelegram({
    tag: "STRIPE_EVENT",
    body: `💸 Refund traité pour booking ${payment.bookingId}: ${refunds.length} refund(s).`,
  }).catch(() => {});
}

/**
 * charge.dispute.created → Telegram URGENT.
 *
 * Pas de transition automatique : l'admin doit intervenir (preuves Stripe,
 * réponse au litige, etc.). On log juste pour visibilité immédiate.
 */
async function handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
  sendTelegram({
    tag: "STRIPE_EVENT",
    body: `🚨 LITIGE Stripe ouvert (dispute ${dispute.id}, montant ${(dispute.amount / 100).toFixed(2)} ${dispute.currency.toUpperCase()}, raison ${dispute.reason}). Action requise dashboard Stripe.`,
  }).catch(() => {});
}

// ============================================================
// Helpers
// ============================================================

async function tryTransition(bookingId: string, to: BookingStatus, trigger: string): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await applyTransition(tx, bookingId, {
        to,
        trigger,
        triggeredBy: "webhook",
        ignoreDuplicate: true,
      });
    });
  } catch (e) {
    if (e instanceof StateMachineError) {
      // Transition pas autorisée depuis le current state → on log mais
      // ne fait pas échouer le dispatch (le DB write principal est déjà fait).
      console.warn(`[stripe-webhook] transition ${to} skipped: ${e.code}`);
      return;
    }
    throw e;
  }
}

function mapRefundReason(reason: Stripe.Refund.Reason | null | undefined): RefundReason {
  switch (reason) {
    case "duplicate":
      return "duplicate";
    case "fraudulent":
      return "fraudulent";
    case "requested_by_customer":
      return "client_cancellation";
    default:
      return "admin_decision";
  }
}

// POST /api/stripe/webhook — Stripe webhook ingestion (Sprint X.2 — Booking V1)
//
// SOURCE :
//   - ADR 0013 — Stripe Checkout V1
//   - 03-ARCHITECTURE-CIBLE §5.2.4 (webhook lifecycle)
//   - 04-PLAN-EXECUTION Sprint X.2 § « Périmètre — Route handlers »
//   - Agent 4 §5.2 (outbox + idempotence) + Agent 8 P0-2 (signature)
//
// PIPELINE :
//   1. Lire le body RAW (Stripe exige bytes-exact pour signature HMAC).
//   2. Vérifier la signature avec `stripe.webhooks.constructEvent` (5 min
//      tolerance par défaut).
//   3. Idempotency outbox : INSERT `StripeWebhookEvent` avec `stripeEventId`
//      UNIQUE. Si conflict → event déjà reçu, return 200 sans re-traitement.
//   4. (HORS SPRINT X.2 — Sprint X.4+) Dispatch async via BullMQ
//      `stripeQueue.add(event.type, payload, { jobId: event.id })`.
//   5. Return 200 OK immédiat (Stripe attend < 5s, sinon retry).
//
// CONTRAT NEXT 16 :
//   - Route handler `export async function POST(req: Request)`.
//   - `request.text()` pour récupérer le raw body (PAS `.json()` qui parse
//     et casse la signature).
//   - Pas de `force-dynamic` nécessaire — Next.js comprend qu'un POST handler
//     est dynamique par défaut.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getWebhookSecret } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";

/**
 * 5 events critiques V1 (ADR 0013) que les workers BullMQ traiteront
 * dans Sprint X.4. Ce route handler les recoit, les outbox-store, et
 * retourne 200 sans logique métier ici.
 *
 * Les autres events (subscription.*, etc.) sont ignorés V1 mais quand même
 * outbox-stockés au cas où on ajoute des hooks plus tard.
 */
const KNOWN_EVENTS = new Set<Stripe.Event["type"]>([
  "checkout.session.completed",
  "payment_intent.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
  "review.opened",
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
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
    // On log mais on ne donne pas de détails à l'appelant (Agent 8 P0-2).
    await sendTelegram({
      tag: "STRIPE_WEBHOOK_SIGNATURE_FAIL",
      body: `Webhook Stripe rejeté (signature invalide). IP: ${req.headers.get("x-forwarded-for") ?? "?"}`,
    }).catch(() => {
      /* ne bloque pas la réponse */
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // -- 3. Outbox idempotence (Agent 4 §5.2) -----------------------------
  // INSERT avec UNIQUE sur stripeEventId — si event déjà ingéré, on retourne
  // 200 OK direct sans re-traiter. Stripe retries en attendant 2xx.
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        livemode: event.livemode,
        apiVersion: event.api_version ?? null,
        payload: event as unknown as object,
        eventCreatedAt: new Date(event.created * 1000),
      },
    });
  } catch (err) {
    // Prisma P2002 = unique constraint violation = event déjà reçu.
    // On retourne 200 OK pour que Stripe arrête de retry.
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json({ received: true, idempotent: true }, { status: 200 });
    }
    // Autre erreur DB = on retourne 500 pour que Stripe retry.
    return NextResponse.json({ error: "outbox_failed" }, { status: 500 });
  }

  // -- 4. Dispatch async (HORS SCOPE X.2) --------------------------------
  // Sprint X.4+ ajoutera ici :
  //   await stripeQueue.add(`stripe.${event.type}`, event, { jobId: event.id });
  // Pour l'instant, on log les events connus côté Telegram pour visibilité
  // (mais le traitement métier réel attend les workers).
  if (KNOWN_EVENTS.has(event.type)) {
    sendTelegram({
      tag: "STRIPE_EVENT",
      body: `Event \`${event.type}\` reçu (id: ${event.id}). Worker BullMQ traitera (Sprint X.4+).`,
    }).catch(() => {
      /* observability best-effort */
    });
  }

  // -- 5. 200 OK immédiat -----------------------------------------------
  return NextResponse.json({ received: true }, { status: 200 });
}

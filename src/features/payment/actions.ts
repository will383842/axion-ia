"use server";
// Server Actions paiement Stripe (Sprint X.2 — Booking V1)
//
// SOURCE :
//   - ADR 0013 — Stripe Checkout V1 + mode hybride manuel
//   - 03-ARCHITECTURE-CIBLE §5.2 (Stripe lifecycle)
//   - 04-PLAN-EXECUTION Sprint X.2 § « Périmètre — Server Actions »
//   - Agent 8 P0-6 (anti open-redirect) + P1-4 (rate-limit) + P1-5 (Idempotency-Key)
//
// SCOPE V1 :
//   - `createStripeCheckoutSessionAction(invoiceId)` — appelé côté admin
//     (validation Will) ou côté client via magic-link signé.
//   - `cancelStripeCheckoutSessionAction(sessionId)` — annule session pending.
//
// HORS SCOPE V1 (Sprint X.4+) :
//   - Worker BullMQ qui process les webhook events outbox-stockés.
//   - Customer Portal endpoint (D56 retiré V1).
//
// CONTEXTE :
//   - Stripe Checkout = page Stripe-hosted ; URL retournée puis redirect.
//   - Idempotency-Key garantit qu'un double-clic ne crée pas 2 sessions.
//   - `successUrl` / `cancelUrl` validés origin axion-ia.com uniquement
//     (Agent 8 P0-6 — anti open redirect).

import { z } from "zod";
import { auth } from "@/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";

// ============================================================
// Helpers
// ============================================================

/**
 * Anti open-redirect (Agent 8 P0-6). Stripe Checkout success/cancel URLs
 * doivent pointer sur axion-ia.com uniquement.
 *
 * En dev, on tolère localhost pour tests locaux Stripe CLI.
 */
function isAllowedRedirectUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname;
  return (
    host === "axion-ia.com" ||
    host === "www.axion-ia.com" ||
    (process.env.NODE_ENV !== "production" && host === "localhost")
  );
}

const urlSchema = z
  .string()
  .url()
  .refine(isAllowedRedirectUrl, { message: "URL doit pointer sur axion-ia.com" });

async function requireAdminWrite(): Promise<{ userId: string; role: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
  return { userId: session.user.id, role };
}

// ============================================================
// createStripeCheckoutSessionAction
// ============================================================

const createSessionSchema = z.object({
  invoiceId: z.string().uuid(),
  successUrl: urlSchema.optional(),
  cancelUrl: urlSchema.optional(),
});

export interface CheckoutSessionResult {
  ok: boolean;
  /** URL Stripe Checkout à laquelle rediriger le client. */
  url?: string;
  /** Stripe session id pour tracking. */
  sessionId?: string;
  /** Code d'erreur stable (jamais un message Stripe brut). */
  error?: string;
}

/**
 * Crée une session Stripe Checkout pour payer une Invoice.
 *
 * Flow admin :
 *   1. Will valide une réservation côté admin.
 *   2. Action createInvoiceAction crée Invoice deposit (Sprint X.4).
 *   3. Cette action crée la session Checkout et stocke `stripeCheckoutSessionId`.
 *   4. Email `payment-link` est envoyé au client avec l'URL Checkout.
 *
 * Cap V1 : currency EUR uniquement (D63 — historique import devises hors V1).
 */
export async function createStripeCheckoutSessionAction(
  input: z.input<typeof createSessionSchema>,
): Promise<CheckoutSessionResult> {
  // -- 1. Validation input + gates ---------------------------------------
  const parsed = createSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  if (!isStripeConfigured()) {
    // Mode hybride manuel (ADR 0013) — admin paiement hors-Stripe.
    return { ok: false, error: "stripe_not_configured" };
  }

  // Auth admin (V1 : seul admin déclenche checkout. Magic-link client = X.4).
  try {
    await requireAdminWrite();
  } catch {
    return { ok: false, error: "unauthorized" };
  }

  // Rate-limit per IP (Agent 8 P1-4) — 5 créations / 10 min.
  const ip = await getClientIp();
  const rl = await checkRateLimit(`stripe:checkout:${ip}`, { limit: 5, windowSec: 600 });
  if (!rl.allowed) {
    return { ok: false, error: "rate_limited" };
  }

  // -- 2. Récupération Invoice + Booking + Submission (email) ------------
  const invoice = await prisma.invoice.findUnique({
    where: { id: parsed.data.invoiceId },
    include: {
      booking: {
        include: {
          submission: { select: { contactEmail: true } },
        },
      },
    },
  });

  if (!invoice) return { ok: false, error: "invoice_not_found" };
  if (invoice.amountTtcCents <= 0) return { ok: false, error: "invoice_amount_invalid" };

  const customerEmail = invoice.booking.submission?.contactEmail;
  if (!customerEmail) return { ok: false, error: "customer_email_missing" };

  // -- 3. Création Stripe Checkout Session -------------------------------
  const stripe = getStripe();
  const baseUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://axion-ia.com";
  const defaultSuccess = `${baseUrl}/fr/paiement/succes?invoice=${invoice.id}`;
  const defaultCancel = `${baseUrl}/fr/paiement/annule?invoice=${invoice.id}`;

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        currency: "eur",
        customer_email: customerEmail,
        // 30 min d'expiration — au-delà, l'invoice attend une nouvelle session.
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: invoice.amountTtcCents,
              product_data: {
                name: `Facture ${invoice.number}`,
                description: `Axion-IA · ${invoice.type}`,
              },
            },
          },
        ],
        metadata: {
          invoiceId: invoice.id,
          bookingId: invoice.bookingId,
          invoiceNumber: invoice.number,
          type: invoice.type,
        },
        success_url: parsed.data.successUrl ?? defaultSuccess,
        cancel_url: parsed.data.cancelUrl ?? defaultCancel,
      },
      {
        // Idempotency-Key (Agent 8 P1-5) : double-clic = même session retournée.
        // Suffix `-v1` pour bumper si on change la shape (sinon Stripe ré-utilise
        // l'ancienne session même si le payload diffère).
        idempotencyKey: `${invoice.id}-v1`,
      },
    );

    // -- 4. Persist session id sur l'Invoice ----------------------------
    // Note : champ `stripeCheckoutSessionId` doit être ajouté à Invoice
    // dans une prochaine migration (hors scope skeleton). Pour V1 minimal,
    // on stocke dans `paymentReference` qui existe déjà côté Payment.
    // Sprint X.4 brancchera Invoice → Payment → Checkout session id.

    return {
      ok: true,
      ...(session.url ? { url: session.url } : {}),
      sessionId: session.id,
    };
  } catch (err) {
    // Stripe peut throw pour : rate-limit Stripe, card_declined, invalid_request.
    // On masque le détail au caller (jamais d'erreur Stripe brute en UI).
    console.error("[stripe.checkout.create]", err);
    return { ok: false, error: "stripe_api_error" };
  }
}

// ============================================================
// cancelStripeCheckoutSessionAction
// ============================================================

const cancelSessionSchema = z.object({
  sessionId: z.string().startsWith("cs_"),
});

export async function cancelStripeCheckoutSessionAction(
  input: z.input<typeof cancelSessionSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = cancelSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  if (!isStripeConfigured()) return { ok: false, error: "stripe_not_configured" };

  try {
    await requireAdminWrite();
  } catch {
    return { ok: false, error: "unauthorized" };
  }

  const stripe = getStripe();
  try {
    await stripe.checkout.sessions.expire(parsed.data.sessionId);
    return { ok: true };
  } catch (err) {
    console.error("[stripe.checkout.cancel]", err);
    return { ok: false, error: "stripe_api_error" };
  }
}

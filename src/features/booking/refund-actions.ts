"use server";
// Server Actions admin — annulation booking + refund Stripe (Sprint X.8b).
//
// SOURCE :
//   - 03-ARCHITECTURE-CIBLE.md §5.2.2 (A10 triggerRefundAction, A11 cancelBookingByAdmin)
//   - CGV grille refund V1 (cf. refund-calc.ts) + force majeure 100 %
//   - Stripe refunds API : https://docs.stripe.com/api/refunds/create
//
// SCOPE V1 livré
//   - cancelBookingByAdminAction(bookingId, reason, refundDecision)
//       → grille auto (CGV) OU override admin (custom amount)
//       → transition vers cancelled_by_admin
//       → libère slot, crée Refund row, déclenche Stripe refund si applicable
//       → email cancellation-confirmed-by-user + refund-issued
//   - triggerRefundAction(paymentId, amountCents, reason, scope)
//       → wrapper bas niveau pour cas spéciaux (force_majeure, duplicate, etc.)

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { enqueueEmail } from "@/server/queue/queues";
import { sendTelegram } from "@/lib/telegram";
import { applyTransition, StateMachineError } from "./state-machine";
import { computeRefundFromCancellation } from "./refund-calc";
import type { Prisma, RefundReason } from "../../../prisma/generated/client";

// ====================================================================
// Helpers auth
// ====================================================================

type AdminContext = { userId: string; role: "super_admin" | "admin" | "editor" | "reader" };

async function requireAdminWrite(): Promise<AdminContext> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role as AdminContext["role"] | undefined;
  if (!role) throw new Error("forbidden");
  if (role !== "super_admin" && role !== "admin") throw new Error("forbidden");
  return { userId: session.user.id, role };
}

function authError(err: unknown): {
  ok: false;
  error: "unauthorized" | "forbidden" | "internal_error";
} {
  const msg = (err as Error)?.message;
  if (msg === "unauthorized") return { ok: false, error: "unauthorized" };
  if (msg === "forbidden") return { ok: false, error: "forbidden" };
  return { ok: false, error: "internal_error" };
}

// ====================================================================
// cancelBookingByAdminAction (A11)
// ====================================================================

const cancelSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(10).max(500),
  /**
   * refundDecision :
   *   - `auto_cgv` (défaut) : applique la grille refund-calc selon bookingDate
   *   - `force_majeure` : refund 100 %
   *   - `keep_deposit` : 0 % (acompte conservé)
   *   - `custom` : montant explicite via `customRefundCents`
   */
  refundDecision: z
    .enum(["auto_cgv", "force_majeure", "keep_deposit", "custom"])
    .default("auto_cgv"),
  customRefundCents: z.number().int().nonnegative().optional(),
  /** Raison Refund (audit RGPD). Défaut dérivé de refundDecision. */
  refundReason: z
    .enum([
      "client_cancellation",
      "force_majeure",
      "admin_decision",
      "dispute",
      "cgv_window",
      "duplicate",
      "fraudulent",
      "other",
    ])
    .optional(),
});

export type CancelBookingResult =
  | {
      ok: true;
      bookingId: string;
      refundAmountCents: number;
      refundId: string | null;
      stripeRefundId: string | null;
    }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "forbidden"
        | "invalid_input"
        | "booking_not_found"
        | "transition_not_allowed"
        | "custom_amount_required"
        | "no_succeeded_payment"
        | "stripe_refund_failed"
        | "internal_error";
    };

export async function cancelBookingByAdminAction(
  input: z.input<typeof cancelSchema>,
): Promise<CancelBookingResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdminWrite();
  } catch (err) {
    return authError(err) as CancelBookingResult;
  }

  if (parsed.data.refundDecision === "custom" && !parsed.data.customRefundCents) {
    return { ok: false, error: "custom_amount_required" };
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parsed.data.bookingId },
      select: {
        id: true,
        status: true,
        locale: true,
        bookingDate: true,
        interventionType: true,
        slotId: true,
        submission: { select: { contactEmail: true, contactName: true } },
        fromSubmission: { select: { contactEmail: true, contactName: true } },
        payments: {
          where: { status: "succeeded", type: "deposit" },
          orderBy: { paidAt: "desc" },
          take: 1,
          select: {
            id: true,
            amountCents: true,
            provider: true,
            providerPaymentIntentId: true,
            invoiceId: true,
          },
        },
      },
    });
    if (!booking) return { ok: false, error: "booking_not_found" };

    // Compute refund amount based on decision
    let refundAmountCents = 0;
    let refundReason: RefundReason = parsed.data.refundReason ?? "admin_decision";

    if (parsed.data.refundDecision === "auto_cgv") {
      const calc = computeRefundFromCancellation({
        bookingDate: booking.bookingDate,
        now: new Date(),
      });
      const depositCents = booking.payments[0]?.amountCents ?? 0;
      refundAmountCents = Math.round((depositCents * calc.refundPercentage) / 100);
      refundReason = parsed.data.refundReason ?? "cgv_window";
    } else if (parsed.data.refundDecision === "force_majeure") {
      refundAmountCents = booking.payments[0]?.amountCents ?? 0;
      refundReason = "force_majeure";
    } else if (parsed.data.refundDecision === "keep_deposit") {
      refundAmountCents = 0;
      refundReason = parsed.data.refundReason ?? "admin_decision";
    } else if (parsed.data.refundDecision === "custom") {
      refundAmountCents = parsed.data.customRefundCents!;
      refundReason = parsed.data.refundReason ?? "admin_decision";
    }

    const payment = booking.payments[0] ?? null;

    // 1. Stripe refund (hors transaction — peut être lent)
    let stripeRefundId: string | null = null;
    if (refundAmountCents > 0 && payment) {
      if (
        payment.provider === "stripe" &&
        payment.providerPaymentIntentId &&
        isStripeConfigured()
      ) {
        try {
          const stripe = getStripe();
          const refund = await stripe.refunds.create({
            payment_intent: payment.providerPaymentIntentId,
            amount: refundAmountCents,
            reason: refundReason === "fraudulent" ? "fraudulent" : "requested_by_customer",
            metadata: {
              bookingId: parsed.data.bookingId,
              adminUserId: admin.userId,
              cancellationReason: parsed.data.reason,
            },
          });
          stripeRefundId = refund.id;
        } catch (err) {
          console.error("[cancelBookingByAdmin] stripe refund failed", err);
          return { ok: false, error: "stripe_refund_failed" };
        }
      }
      // Si provider manuel (virement/chèque/cash) → pas de remboursement
      // automatique : Will doit faire le virement manuellement. On crée
      // quand même la Refund row pour traçabilité.
    }

    // 2. Transaction : transition booking + Refund row + slot release
    let refundId: string | null = null;
    const toStatus: "cancelled_by_admin" | "force_majeure" =
      parsed.data.refundDecision === "force_majeure" ? "force_majeure" : "cancelled_by_admin";

    await prisma.$transaction(async (tx) => {
      await applyTransition(tx, parsed.data.bookingId, {
        to: toStatus,
        trigger: "admin.cancel_booking",
        triggeredBy: "admin",
        triggeredById: admin.userId,
        reason: parsed.data.reason,
      });

      await tx.booking.update({
        where: { id: parsed.data.bookingId },
        data: {
          cancelledAt: new Date(),
          cancellationReason: parsed.data.reason,
          cancelledByUserId: admin.userId,
        },
      });

      // Libère le slot calendrier
      if (booking.slotId) {
        await tx.calendarSlot.update({
          where: { id: booking.slotId },
          data: { status: "available" },
        });
      }

      // Crée Refund row si refund applicable
      if (refundAmountCents > 0 && payment && payment.invoiceId) {
        const created = await tx.refund.create({
          data: {
            invoiceId: payment.invoiceId,
            paymentId: payment.id,
            amountCents: refundAmountCents,
            reason: refundReason,
            scope: refundAmountCents >= payment.amountCents ? "full" : "partial",
            status: stripeRefundId ? "succeeded" : "pending",
            ...(stripeRefundId ? { stripeRefundId, processedAt: new Date() } : {}),
            adminUserId: admin.userId,
            notes: parsed.data.reason,
          },
          select: { id: true },
        });
        refundId = created.id;
      }

      // Audit log
      await tx.activityLog.create({
        data: {
          adminUserId: admin.userId,
          action: "booking.cancel_by_admin",
          targetType: "booking",
          targetId: parsed.data.bookingId,
          changes: {
            reason: parsed.data.reason,
            refundDecision: parsed.data.refundDecision,
            refundAmountCents,
            refundReason,
            ...(stripeRefundId ? { stripeRefundId } : {}),
          } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    // 3. Side-effects email + telegram (hors tx)
    const sub = booking.fromSubmission ?? booking.submission;
    if (sub?.contactEmail) {
      await enqueueEmail("cancellation-confirmed-by-user", sub.contactEmail, booking.locale, {
        contactName: sub.contactName ?? "Client",
        interventionType: booking.interventionType,
        bookingDate: booking.bookingDate.toISOString().slice(0, 10),
        refundAmount: (refundAmountCents / 100).toFixed(2),
        refundCurrency: "EUR",
        cancelReason: parsed.data.reason,
      }).catch(() => {});

      if (refundAmountCents > 0) {
        await enqueueEmail("refund-issued", sub.contactEmail, booking.locale, {
          contactName: sub.contactName ?? "Client",
          amountRefunded: (refundAmountCents / 100).toFixed(2),
          stripeRefundId,
          bookingId: parsed.data.bookingId,
        }).catch(() => {});
      }
    }

    await sendTelegram({
      tag: "AUTO",
      body: `🚫 Booking ${parsed.data.bookingId} annulé par ${admin.userId.slice(0, 8)}.\nRaison: ${parsed.data.reason}\nRefund: ${(refundAmountCents / 100).toFixed(2)}€ ${stripeRefundId ? "(Stripe)" : "(manuel)"}`,
    }).catch(() => {});

    revalidatePath(
      `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/reservations/${parsed.data.bookingId}`,
    );
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/reservations`);
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/calendrier`);

    return {
      ok: true,
      bookingId: parsed.data.bookingId,
      refundAmountCents,
      refundId,
      stripeRefundId,
    };
  } catch (err) {
    if (err instanceof StateMachineError) {
      return { ok: false, error: "transition_not_allowed" };
    }
    console.error("[cancelBookingByAdminAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ====================================================================
// triggerRefundAction (A10 — bas niveau, cas spéciaux)
// ====================================================================

const refundSchema = z.object({
  paymentId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  reason: z.enum([
    "client_cancellation",
    "force_majeure",
    "admin_decision",
    "dispute",
    "cgv_window",
    "duplicate",
    "fraudulent",
    "other",
  ]),
  scope: z.enum(["full", "partial"]),
  notes: z.string().max(2000).optional(),
});

export type TriggerRefundResult =
  | {
      ok: true;
      refundId: string;
      stripeRefundId: string | null;
    }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "forbidden"
        | "invalid_input"
        | "payment_not_found"
        | "amount_exceeds_payment"
        | "stripe_refund_failed"
        | "internal_error";
    };

export async function triggerRefundAction(
  input: z.input<typeof refundSchema>,
): Promise<TriggerRefundResult> {
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  let admin: AdminContext;
  try {
    admin = await requireAdminWrite();
  } catch (err) {
    return authError(err) as TriggerRefundResult;
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: parsed.data.paymentId },
      select: {
        id: true,
        amountCents: true,
        provider: true,
        providerPaymentIntentId: true,
        invoiceId: true,
        status: true,
      },
    });
    if (!payment) return { ok: false, error: "payment_not_found" };
    if (parsed.data.amountCents > payment.amountCents) {
      return { ok: false, error: "amount_exceeds_payment" };
    }
    if (!payment.invoiceId) {
      return { ok: false, error: "payment_not_found" };
    }

    // Stripe refund si applicable
    let stripeRefundId: string | null = null;
    if (payment.provider === "stripe" && payment.providerPaymentIntentId && isStripeConfigured()) {
      try {
        const stripe = getStripe();
        const refund = await stripe.refunds.create({
          payment_intent: payment.providerPaymentIntentId,
          amount: parsed.data.amountCents,
          reason: parsed.data.reason === "fraudulent" ? "fraudulent" : "requested_by_customer",
          metadata: {
            paymentId: parsed.data.paymentId,
            adminUserId: admin.userId,
          },
        });
        stripeRefundId = refund.id;
      } catch (err) {
        console.error("[triggerRefundAction] stripe refund failed", err);
        return { ok: false, error: "stripe_refund_failed" };
      }
    }

    const refund = await prisma.$transaction(async (tx) => {
      const created = await tx.refund.create({
        data: {
          invoiceId: payment.invoiceId!,
          paymentId: payment.id,
          amountCents: parsed.data.amountCents,
          reason: parsed.data.reason,
          scope: parsed.data.scope,
          status: stripeRefundId ? "succeeded" : "pending",
          ...(stripeRefundId ? { stripeRefundId, processedAt: new Date() } : {}),
          adminUserId: admin.userId,
          ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
        },
        select: { id: true },
      });

      // Audit log
      await tx.activityLog.create({
        data: {
          adminUserId: admin.userId,
          action: "refund.trigger",
          targetType: "payment",
          targetId: parsed.data.paymentId,
          changes: {
            amountCents: parsed.data.amountCents,
            reason: parsed.data.reason,
            scope: parsed.data.scope,
            ...(stripeRefundId ? { stripeRefundId } : {}),
            ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    return { ok: true, refundId: refund.id, stripeRefundId };
  } catch (err) {
    console.error("[triggerRefundAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

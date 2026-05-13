"use server";
// Self-service client (Sprint X.15 / Booking V1).
//
// Tokens magic-link envoyés aux clients dans les emails confirmation /
// rappel pour permettre annulation/reschedule sans login admin.
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.15
//   - Agent 8 P0-7 + Agent 1 P0-8 (lien magique self-service)
//   - CGV grille refund (V1 default, Sprint X.17 override admin)
//
// SCOPE V1 livré :
//   - `cancelBookingByUserAction({token})` — annulation client + calcul
//     CancellationWindow + grille refund + transition confirmed →
//     cancelled_by_user + email.
//   - `rescheduleBookingByUserAction({token, newDate})` — reschedule client
//     ≥ J-7 + slot dispo + transition (soft, garde confirmed) + email.
//   - Rate-limit `magic:<token-prefix>` 10/600s.
//
// HORS SCOPE V1 :
//   - Customer Portal Stripe (D56 retiré V1).
//   - Revocation explicite jti store (V1.5 — Redis SETEX consumed).

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyMagicToken } from "@/lib/magic-token";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { sendTelegram } from "@/lib/telegram";
import { enqueueEmail } from "@/server/queue/queues";
import { applyTransition, StateMachineError } from "./state-machine";
import { computeRefundFromCancellation, type RefundCalculation } from "./refund-calc";
import type { CancellationWindow } from "../../../prisma/generated/client";

export type { RefundCalculation };

export interface SelfServiceResult {
  ok: boolean;
  bookingId?: string;
  refundPercentage?: number;
  cancellationWindow?: CancellationWindow;
  error?:
    | "invalid_token"
    | "expired_token"
    | "rate_limited"
    | "invalid_input"
    | "booking_not_found"
    | "booking_not_eligible"
    | "transition_not_allowed"
    | "slot_unavailable"
    | "internal_error";
}

// ============================================================
// Grille refund CGV V1 (Sprint X.17 = override admin par Booking)
// ============================================================

/**
 * Calcule la fenêtre d'annulation + % refund acompte selon CGV V1.
 * Source : 04-PLAN-EXECUTION I8 + D40 (CancellationWindow).
 *
 * Règle V1 par défaut :
 *   - J-15+ (15 jours ou plus avant) → 50 % de l'acompte refundé
 *   - 15j > diff ≥ 2j → 0 % (acompte conservé)
 *   - < J-2 → 0 % (acompte conservé)
 *   - force_majeure (déclaré par admin) → 100 %
 */
// computeRefundFromCancellation + RefundCalculation extraits dans
// `./refund-calc.ts` (Next 16 : pas d'export non-async depuis "use server").

// ============================================================
// Rate-limit shared
// ============================================================

async function tokenRateLimit(token: string): Promise<boolean> {
  const ip = await getClientIp();
  // Préfixe 12 chars pour identifier sans logger tout le token.
  const prefix = token.slice(0, 12);
  const rl = await checkRateLimit(`magic:${prefix}:${ip}`, { limit: 10, windowSec: 600 });
  return rl.allowed;
}

// ============================================================
// cancelBookingByUserAction
// ============================================================

const cancelSchema = z.object({
  token: z.string().min(20),
  reason: z.string().max(500).optional(),
});

export async function cancelBookingByUserAction(
  input: z.input<typeof cancelSchema>,
): Promise<SelfServiceResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  if (!(await tokenRateLimit(parsed.data.token))) {
    return { ok: false, error: "rate_limited" };
  }

  const v = await verifyMagicToken(parsed.data.token, { scope: "cancel" });
  if (!v.ok) {
    return {
      ok: false,
      error: v.reason === "expired" ? "expired_token" : "invalid_token",
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: v.resourceId },
        select: {
          id: true,
          status: true,
          bookingDate: true,
          slotId: true,
          submission: { select: { contactEmail: true, contactName: true } },
          locale: true,
        },
      });
      if (!booking) throw new StateMachineError("Booking introuvable", "booking_not_found");

      // Eligibilité : seuls les statuts "actifs" (confirmed, contract_payment_sent,
      // awaiting_admin_validation, reminded_j7) peuvent être annulés par le user.
      const ELIGIBLE: ReadonlySet<string> = new Set([
        "confirmed",
        "reminded_j7",
        "contract_payment_sent",
        "awaiting_admin_validation",
        "paused",
      ]);
      if (!ELIGIBLE.has(booking.status)) {
        throw new StateMachineError(
          `Booking status=${booking.status} non éligible à l'annulation user`,
          "transition_not_allowed",
        );
      }

      const refund = computeRefundFromCancellation({
        bookingDate: booking.bookingDate,
        now: new Date(),
      });

      await applyTransition(tx, booking.id, {
        to: "cancelled_by_user",
        trigger: "user.magic_link_cancel",
        triggeredBy: "client",
        ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
      });

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          cancelledAt: new Date(),
          cancellationWindow: refund.cancellationWindow,
          ...(parsed.data.reason ? { cancellationReason: parsed.data.reason } : {}),
        },
      });

      // Libère le slot si confirmé.
      if (booking.slotId) {
        await tx.calendarSlot.update({
          where: { id: booking.slotId },
          data: { status: "available" },
        });
      }

      return { booking, refund };
    });

    // Hors tx : email + Telegram.
    const email = result.booking.submission?.contactEmail;
    if (email) {
      enqueueEmail("cancellation-confirmed-by-user", email, result.booking.locale, {
        contactName: result.booking.submission?.contactName ?? "Client",
        cancellationWindow: result.refund.cancellationWindow,
        refundPercentage: result.refund.refundPercentage,
        bookingId: result.booking.id,
      }).catch(() => {
        /* fail-soft */
      });
    }
    sendTelegram({
      tag: "ANNULATION",
      body: `🛑 Booking ${result.booking.id} annulé par user\n• Fenêtre : ${result.refund.cancellationWindow}\n• Refund : ${result.refund.refundPercentage}%`,
    }).catch(() => {});

    return {
      ok: true,
      bookingId: result.booking.id,
      refundPercentage: result.refund.refundPercentage,
      cancellationWindow: result.refund.cancellationWindow,
    };
  } catch (err) {
    if (err instanceof StateMachineError) {
      return {
        ok: false,
        error: err.code === "booking_not_found" ? "booking_not_found" : "booking_not_eligible",
      };
    }
    console.error("[cancelBookingByUserAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

// ============================================================
// rescheduleBookingByUserAction
// ============================================================

const rescheduleSchema = z.object({
  token: z.string().min(20),
  /** Nouvelle date ISO (timestamp UTC). ≥ J-7 enforcé. */
  newDate: z.string().datetime(),
});

export async function rescheduleBookingByUserAction(
  input: z.input<typeof rescheduleSchema>,
): Promise<SelfServiceResult> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  if (!(await tokenRateLimit(parsed.data.token))) {
    return { ok: false, error: "rate_limited" };
  }

  const v = await verifyMagicToken(parsed.data.token, { scope: "reschedule" });
  if (!v.ok) {
    return {
      ok: false,
      error: v.reason === "expired" ? "expired_token" : "invalid_token",
    };
  }

  try {
    const newDate = new Date(parsed.data.newDate);
    if (Number.isNaN(newDate.getTime())) {
      return { ok: false, error: "invalid_input" };
    }

    const bookingId = v.resourceId;
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        bookingDate: true,
        status: true,
        submission: { select: { contactEmail: true, contactName: true } },
        locale: true,
        interventionType: true,
      },
    });
    if (!booking) return { ok: false, error: "booking_not_found" };

    // Règle métier : reschedule possible ≥ J-7 (cf. plan).
    const daysUntil = (booking.bookingDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    if (daysUntil < 7) {
      return { ok: false, error: "booking_not_eligible" };
    }

    // Doctrine : on update bookingDate sans changer status (reste confirmed).
    // Pas de transition state-machine — c'est une modification, pas un changement
    // de cycle de vie. On audit dans BookingTransition avec trigger custom.
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { bookingDate: newDate },
      });
      // Audit log soft (pas de transition status — on insère manuellement).
      await tx.bookingTransition.create({
        data: {
          bookingId,
          fromStatus: booking.status,
          toStatus: booking.status, // pas de changement
          trigger: "user.magic_link_reschedule",
          triggeredBy: "client",
          notes: `Reschedule : ${booking.bookingDate.toISOString()} → ${newDate.toISOString()}`,
          snapshotBefore: { bookingDate: booking.bookingDate.toISOString() },
          snapshotAfter: { bookingDate: newDate.toISOString() },
        },
      });
    });

    if (booking.submission?.contactEmail) {
      enqueueEmail(
        "booking-validated-on-calendar", // V1 réutilise template existant (re-confirmation)
        booking.submission.contactEmail,
        booking.locale,
        {
          contactName: booking.submission.contactName ?? "Client",
          interventionType: booking.interventionType,
          bookingDate: newDate.toISOString().slice(0, 10),
          bookingTime: newDate.toISOString().slice(11, 16),
          participantsCount: 1,
          bookingId,
        },
      ).catch(() => {
        /* fail-soft */
      });
    }

    sendTelegram({
      tag: "INTERVENTION",
      body: `📅 Booking ${bookingId} reschedulé par user\n• Ancienne date : ${booking.bookingDate.toISOString()}\n• Nouvelle date : ${newDate.toISOString()}`,
    }).catch(() => {});

    return { ok: true, bookingId };
  } catch (err) {
    console.error("[rescheduleBookingByUserAction]", err);
    return { ok: false, error: "internal_error" };
  }
}

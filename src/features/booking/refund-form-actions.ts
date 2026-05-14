"use server";
// Form Action wrappers — annulation booking admin (Sprint A — UI admin).
//
// Pont entre `refund-actions.ts` (signature canonique) et useActionState.

import { cancelBookingByAdminAction } from "./refund-actions";

export interface CancelBookingFormState {
  ok: boolean;
  error?: string;
  message?: string;
  refundAmountCents?: number;
  stripeRefundId?: string | null;
}

export const CANCEL_BOOKING_FORM_INITIAL: CancelBookingFormState = { ok: false };

export async function cancelBookingFormAction(
  _prev: CancelBookingFormState,
  formData: FormData,
): Promise<CancelBookingFormState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const refundDecision = String(formData.get("refundDecision") ?? "auto_cgv") as
    | "auto_cgv"
    | "force_majeure"
    | "keep_deposit"
    | "custom";
  const customRefundEurRaw = formData.get("customRefundEur")?.toString().trim();
  const customRefundCents = customRefundEurRaw
    ? Math.round(parseFloat(customRefundEurRaw) * 100)
    : undefined;

  const result = await cancelBookingByAdminAction({
    bookingId,
    reason,
    refundDecision,
    ...(customRefundCents !== undefined && Number.isFinite(customRefundCents)
      ? { customRefundCents }
      : {}),
  });

  if (result.ok) {
    const refundMsg =
      result.refundAmountCents > 0
        ? `Remboursement ${(result.refundAmountCents / 100).toFixed(2)} € ${result.stripeRefundId ? "(Stripe)" : "(manuel à effectuer)"}`
        : "Acompte conservé.";
    return {
      ok: true,
      message: `Booking annulé. ${refundMsg}`,
      refundAmountCents: result.refundAmountCents,
      stripeRefundId: result.stripeRefundId,
    };
  }
  return { ok: false, error: result.error };
}

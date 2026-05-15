/**
 * Cancel booking form state — extraits du fichier `refund-form-actions.ts`
 * ("use server") pour respecter la contrainte Next 16 : un module `"use server"`
 * ne peut exporter que des `async function`. Pattern identique à
 * `policies-constants.ts`.
 *
 * Audit 2026-05-15 — fix verrou build SSG prod.
 */

export interface CancelBookingFormState {
  ok: boolean;
  error?: string;
  message?: string;
  refundAmountCents?: number;
  stripeRefundId?: string | null;
}

export const CANCEL_BOOKING_FORM_INITIAL: CancelBookingFormState = { ok: false };

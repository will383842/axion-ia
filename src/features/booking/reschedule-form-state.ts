/**
 * Reschedule form state — extraits du fichier `reschedule-form-actions.ts`
 * ("use server") pour respecter la contrainte Next 16 : un module `"use server"`
 * ne peut exporter que des `async function`. Pattern identique à
 * `policies-constants.ts`.
 *
 * Audit 2026-05-15 — fix verrou build SSG prod.
 */

export interface RescheduleFormState {
  ok: boolean;
  error?: string;
  message?: string;
  newBookingDate?: string;
}

export const RESCHEDULE_FORM_INITIAL: RescheduleFormState = { ok: false };

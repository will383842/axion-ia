/**
 * Payment schedule admin form state — extraits du fichier `admin-form-actions.ts`
 * ("use server") pour respecter la contrainte Next 16 : un module `"use server"`
 * ne peut exporter que des `async function`. Pattern identique à
 * `policies-constants.ts`.
 *
 * Audit 2026-05-15 — fix verrou build SSG prod.
 */

export interface ScheduleFormState {
  ok: boolean;
  error?: string;
  message?: string;
  profileId?: string;
  slug?: string;
}

export const SCHEDULE_FORM_INITIAL: ScheduleFormState = { ok: false };

/**
 * Quote form state — extraits du fichier `quote-form-actions.ts` ("use server")
 * pour respecter la contrainte Next 16 : un module `"use server"` ne peut
 * exporter que des `async function`. Les constantes / interfaces / types sont
 * sortis ici (pattern identique à `policies-constants.ts`).
 *
 * Audit 2026-05-15 — fix verrou build SSG prod.
 */

export interface QuoteFormState {
  ok: boolean;
  error?: string;
  message?: string;
  quoteId?: string;
  number?: string;
}

export const QUOTE_FORM_INITIAL: QuoteFormState = { ok: false };

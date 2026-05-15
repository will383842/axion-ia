/**
 * Contract admin form state — extraits du fichier `admin-form-actions.ts`
 * ("use server") pour respecter la contrainte Next 16 : un module `"use server"`
 * ne peut exporter que des `async function`. Pattern identique à
 * `policies-constants.ts`.
 *
 * Audit 2026-05-15 — fix verrou build SSG prod.
 */

import type { ContractActionErrorCode } from "./admin-actions";

export interface ContractFormState {
  ok: boolean;
  error?: ContractActionErrorCode | "invalid_amount" | "invalid_body";
  message?: string;
  contractDocumentId?: string;
  submissionId?: string;
  invoiceId?: string;
}

export const CONTRACT_FORM_INITIAL: ContractFormState = { ok: false };

"use server";
// Form Action wrappers admin Factures (Sprint X.10).
//
// Pont entre les Server Actions canoniques `admin-actions.ts` (signature
// `(input) => Promise<Result>`) et useActionState (`(prev, fd) => Promise<S>`).

import { markInvoicePaidManuallyAction, issueCreditNoteAction } from "./admin-actions";

export interface InvoiceFormState {
  ok: boolean;
  error?: string;
  message?: string;
}

export async function markPaidManualFormAction(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const amountEurStr = String(formData.get("amountEur") ?? "0");
  const amountCents = Math.round(parseFloat(amountEurStr) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, error: "invalid_amount" };
  }
  const paidAtRaw = String(formData.get("paidAt") ?? "");
  const paidAt = paidAtRaw
    ? new Date(`${paidAtRaw}T12:00:00Z`).toISOString()
    : new Date().toISOString();
  const mode = String(formData.get("mode") ?? "manual_wire") as
    "manual_wire" | "manual_check" | "manual_cash";
  const reference = formData.get("reference")?.toString().trim() || undefined;
  const notes = formData.get("notes")?.toString().trim() || undefined;

  const result = await markInvoicePaidManuallyAction({
    invoiceId,
    amountCents,
    paidAt,
    mode,
    ...(reference ? { reference } : {}),
    ...(notes ? { notes } : {}),
  });
  if (result.ok) {
    return { ok: true, message: `Paiement enregistré (${(amountCents / 100).toFixed(2)} €).` };
  }
  return { ok: false, error: result.error };
}

export async function issueCreditNoteFormAction(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const originalInvoiceId = String(formData.get("invoiceId") ?? "");
  const amountEurStr = String(formData.get("amountEur") ?? "0");
  const amountCents = Math.round(parseFloat(amountEurStr) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, error: "invalid_amount" };
  }
  const reason = String(formData.get("reason") ?? "");

  const result = await issueCreditNoteAction({
    originalInvoiceId,
    amountCents,
    reason,
  });
  if (result.ok) {
    return {
      ok: true,
      message: `Avoir ${result.number} émis pour ${(amountCents / 100).toFixed(2)} €.`,
    };
  }
  return { ok: false, error: result.error };
}

// 🔴 2026-08-19 — `export { INITIAL as INVOICE_FORM_INITIAL }` RETIRÉ, et la
// constante `INITIAL` avec lui.
//
// Une CONSTANTE exportée d'un module `"use server"` n'est pas une action, et
// Next.js la traite pourtant comme un point d'entrée HTTP. Aucun consommateur
// ne l'importait — le formulaire client écrit son propre état initial —, si
// bien que `INITIAL` n'existait plus que pour être ré-exportée : la déclarer
// non exportée aurait juste déplacé le code mort. C'est `eslint` qui l'a dit,
// pas la relecture.

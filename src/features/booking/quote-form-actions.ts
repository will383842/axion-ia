"use server";
// Form Action wrappers admin Quotes (Sprint A — UI admin devis).
//
// Pont entre `quote-actions.ts` (Server Actions canoniques) et useActionState
// pour les forms admin.

import {
  generateQuoteDraftAction,
  editQuoteDraftAction,
  sendQuoteAction,
  markQuoteSignedManuallyAction,
  markQuoteDeclinedAction,
} from "./quote-actions";

export interface QuoteFormState {
  ok: boolean;
  error?: string;
  message?: string;
  quoteId?: string;
  number?: string;
}

export const QUOTE_FORM_INITIAL: QuoteFormState = { ok: false };

function parseBody(raw: FormDataEntryValue | null): object | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : undefined;
  } catch {
    // V1 : si pas JSON valide, on stocke comme texte brut dans un wrapper
    return { type: "raw", text: raw };
  }
}

// ────────────────────────────────────────────────────────────────────
// generateQuoteDraftFormAction (depuis page Réservation)
// ────────────────────────────────────────────────────────────────────

export async function generateQuoteDraftFormAction(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const amountHtEur = parseFloat(String(formData.get("amountHtEur") ?? "0"));
  const vatRate = parseFloat(String(formData.get("vatRate") ?? "0"));
  const vatReverseCharge = formData.get("vatReverseCharge") === "on";
  const body = parseBody(formData.get("body")) ?? { type: "raw", text: "" };
  const validUntilDate = formData.get("validUntilDate")?.toString().trim() || "";
  const validUntilIso = validUntilDate
    ? new Date(`${validUntilDate}T12:00:00Z`).toISOString()
    : undefined;

  if (!Number.isFinite(amountHtEur) || amountHtEur <= 0) {
    return { ok: false, error: "invalid_amount" };
  }

  const result = await generateQuoteDraftAction({
    bookingId,
    amountHtCents: Math.round(amountHtEur * 100),
    vatRate,
    vatReverseCharge,
    body,
    ...(validUntilIso ? { validUntilIso } : {}),
  });

  if (result.ok) {
    return {
      ok: true,
      message: `Devis ${result.number ?? "?"} créé en draft.`,
      ...(result.quoteId ? { quoteId: result.quoteId } : {}),
      ...(result.number ? { number: result.number } : {}),
    };
  }
  return { ok: false, error: result.error ?? "internal_error" };
}

// ────────────────────────────────────────────────────────────────────
// editQuoteDraftFormAction
// ────────────────────────────────────────────────────────────────────

export async function editQuoteDraftFormAction(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const quoteId = String(formData.get("quoteId") ?? "");
  const amountHtEurRaw = formData.get("amountHtEur")?.toString().trim();
  const vatRateRaw = formData.get("vatRate")?.toString().trim();
  const vatReverseCharge = formData.get("vatReverseCharge")
    ? formData.get("vatReverseCharge") === "on"
    : undefined;
  const body = parseBody(formData.get("body"));
  const validUntilDate = formData.get("validUntilDate")?.toString().trim() || "";

  const result = await editQuoteDraftAction({
    quoteId,
    ...(amountHtEurRaw ? { amountHtCents: Math.round(parseFloat(amountHtEurRaw) * 100) } : {}),
    ...(vatRateRaw ? { vatRate: parseFloat(vatRateRaw) } : {}),
    ...(vatReverseCharge !== undefined ? { vatReverseCharge } : {}),
    ...(body ? { body } : {}),
    ...(validUntilDate
      ? { validUntilIso: new Date(`${validUntilDate}T12:00:00Z`).toISOString() }
      : {}),
  });

  if (result.ok) return { ok: true, message: "Devis mis à jour.", quoteId };
  return { ok: false, error: result.error ?? "internal_error" };
}

// ────────────────────────────────────────────────────────────────────
// sendQuoteFormAction
// ────────────────────────────────────────────────────────────────────

export async function sendQuoteFormAction(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const quoteId = String(formData.get("quoteId") ?? "");
  const result = await sendQuoteAction({ quoteId });
  if (result.ok) {
    return {
      ok: true,
      message: "Devis envoyé via DocuSeal (signature séquentielle client → Axion-IA).",
      quoteId,
    };
  }
  return { ok: false, error: result.error ?? "internal_error" };
}

// ────────────────────────────────────────────────────────────────────
// markQuoteSignedManuallyFormAction (super_admin)
// ────────────────────────────────────────────────────────────────────

export async function markQuoteSignedManuallyFormAction(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const quoteId = String(formData.get("quoteId") ?? "");
  const pdfUrl = formData.get("pdfUrl")?.toString().trim() || undefined;
  const result = await markQuoteSignedManuallyAction({
    quoteId,
    ...(pdfUrl ? { pdfUrl } : {}),
  });
  if (result.ok) {
    return { ok: true, message: "Devis marqué signé manuellement (audit super_admin).", quoteId };
  }
  return { ok: false, error: result.error ?? "internal_error" };
}

// ────────────────────────────────────────────────────────────────────
// markQuoteDeclinedFormAction
// ────────────────────────────────────────────────────────────────────

export async function markQuoteDeclinedFormAction(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const quoteId = String(formData.get("quoteId") ?? "");
  const result = await markQuoteDeclinedAction({ quoteId });
  if (result.ok) return { ok: true, message: "Devis marqué refusé.", quoteId };
  return { ok: false, error: result.error ?? "internal_error" };
}

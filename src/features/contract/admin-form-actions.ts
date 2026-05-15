"use server";
// Form Action wrappers admin Contrats (Sprint A — UI admin).
//
// Pont entre les Server Actions `contract/admin-actions.ts`
// (signature `(input) => Promise<Result>`) et useActionState
// (`(prev, formData) => Promise<State>`).
//
// Toutes les actions retournent un `ContractFormState` uniforme avec :
//   - `ok: true` + `message` + ressources créées (contractId, submissionId, invoiceId)
//   - `ok: false` + `error` (code stable)

import {
  sendContractAndDepositRequestAction,
  cancelAndReissueContractAction,
  createContractAddendumAction,
} from "./admin-actions";
import type { ContractFormState } from "./admin-form-state";

// `ContractFormState` + `CONTRACT_FORM_INITIAL` exportés depuis
// `admin-form-state.ts` (Next 16 "use server" interdit les exports
// non-async function).

function parseTiptapJson(raw: FormDataEntryValue | null): object | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : undefined;
  } catch {
    return undefined;
  }
}

// ────────────────────────────────────────────────────────────────────
// sendContractAndDepositRequestFormAction (D49 clic Will 1)
// ────────────────────────────────────────────────────────────────────

export async function sendContractAndDepositRequestFormAction(
  _prev: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  // Frais accessoires (cents) — input texte en euros, conversion en cents
  function toCents(v: FormDataEntryValue | null): number | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    if (!s) return undefined;
    const n = parseFloat(s);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n * 100);
  }

  const depositAmountCentsOverride = toCents(formData.get("depositAmountEur"));
  const travelFeeCents = toCents(formData.get("travelFeeEur"));
  const accommodationFeeCents = toCents(formData.get("accommodationFeeEur"));
  const mealFeeCents = toCents(formData.get("mealFeeEur"));
  const additionalFeesCents = toCents(formData.get("additionalFeesEur"));
  const additionalFeesNotes = formData.get("additionalFeesNotes")?.toString().trim() || undefined;
  const notes = formData.get("notes")?.toString().trim() || undefined;
  const contractBodyTiptap = parseTiptapJson(formData.get("contractBodyTiptap"));

  // Variables interpolées dans le template DocuSeal (clé=valeur multi-lignes)
  const variablesRaw = formData.get("contractVariables")?.toString().trim() || "";
  const contractVariables: Record<string, string> = {};
  if (variablesRaw) {
    for (const line of variablesRaw.split(/\r?\n/)) {
      const [k, ...rest] = line.split("=");
      if (k && rest.length > 0) contractVariables[k.trim()] = rest.join("=").trim();
    }
  }

  const result = await sendContractAndDepositRequestAction({
    bookingId,
    ...(depositAmountCentsOverride !== undefined ? { depositAmountCentsOverride } : {}),
    ...(travelFeeCents !== undefined ? { travelFeeCents } : {}),
    ...(accommodationFeeCents !== undefined ? { accommodationFeeCents } : {}),
    ...(mealFeeCents !== undefined ? { mealFeeCents } : {}),
    ...(additionalFeesCents !== undefined ? { additionalFeesCents } : {}),
    ...(additionalFeesNotes ? { additionalFeesNotes } : {}),
    ...(notes ? { notes } : {}),
    ...(contractBodyTiptap ? { contractBodyTiptap } : {}),
    ...(Object.keys(contractVariables).length > 0 ? { contractVariables } : {}),
  });

  if (result.ok) {
    return {
      ok: true,
      message: "Contrat envoyé + lien paiement actif. Email client en cours.",
      contractDocumentId: result.contractDocumentId,
      submissionId: result.submissionId,
      ...(result.invoiceId ? { invoiceId: result.invoiceId } : {}),
    };
  }
  return { ok: false, error: result.error };
}

// ────────────────────────────────────────────────────────────────────
// cancelAndReissueContractFormAction (D62 avant signature)
// ────────────────────────────────────────────────────────────────────

export async function cancelAndReissueContractFormAction(
  _prev: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const contractDocumentId = String(formData.get("contractDocumentId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const newBodyTiptap = parseTiptapJson(formData.get("newBodyTiptap"));

  if (!newBodyTiptap) return { ok: false, error: "invalid_body" };

  const result = await cancelAndReissueContractAction({
    contractDocumentId,
    newBodyTiptap,
    reason,
  });
  if (result.ok) {
    return {
      ok: true,
      message: "Contrat v(N+1) émis. Ancien archivé. Email client envoyé.",
      contractDocumentId: result.contractDocumentId,
      submissionId: result.submissionId,
    };
  }
  return { ok: false, error: result.error };
}

// ────────────────────────────────────────────────────────────────────
// createContractAddendumFormAction (D62 après signature)
// ────────────────────────────────────────────────────────────────────

export async function createContractAddendumFormAction(
  _prev: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const addendumBodyTiptap = parseTiptapJson(formData.get("addendumBodyTiptap"));

  if (!addendumBodyTiptap) return { ok: false, error: "invalid_body" };

  const result = await createContractAddendumAction({
    bookingId,
    addendumBodyTiptap,
    reason,
  });
  if (result.ok) {
    return {
      ok: true,
      message: "Avenant créé + envoyé en signature. Contrat principal reste immuable.",
      contractDocumentId: result.contractDocumentId,
      submissionId: result.submissionId,
    };
  }
  return { ok: false, error: result.error };
}

"use client";
// use-client: useActionState pour 2 actions admin factures (Sprint X.10).
//
//   - markPaidManualFormAction (mode hybride X.11)
//   - issueCreditNoteFormAction (avoir)
//
// Affichées uniquement si rôle admin/super_admin et status approprié.

import { useActionState, useState } from "react";
import {
  markPaidManualFormAction,
  issueCreditNoteFormAction,
  INVOICE_FORM_INITIAL,
  type InvoiceFormState,
} from "@/features/invoice/admin-form-actions";
import type { InvoiceStatus, InvoiceType } from "../../../../../../../prisma/generated/client";

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  type: InvoiceType;
  remainingCents: number;
  role: string;
  adminPrefix: string;
}

export function InvoiceActions({
  invoiceId,
  invoiceNumber,
  status,
  type,
  remainingCents,
  role,
}: Props) {
  const canWrite = role === "super_admin" || role === "admin";
  if (!canWrite) {
    return (
      <p className="admin-meta-block">
        Lecture seule — votre rôle ne permet pas d&apos;agir sur les factures.
      </p>
    );
  }

  const canMarkPaid =
    type !== "credit_note" &&
    status !== "cancelled" &&
    status !== "void" &&
    status !== "refunded" &&
    remainingCents > 0;

  const canIssueCreditNote =
    type !== "credit_note" && (status === "paid" || status === "partially_paid");

  return (
    <div className="admin-form">
      {canMarkPaid && (
        <MarkPaidForm
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber}
          remainingCents={remainingCents}
        />
      )}
      {canIssueCreditNote && <CreditNoteForm invoiceId={invoiceId} invoiceNumber={invoiceNumber} />}
      {!canMarkPaid && !canIssueCreditNote && (
        <p className="admin-meta-block">
          Aucune action admin disponible (facture {status}, type {type}).
        </p>
      )}
    </div>
  );
}

function FormResult({ state }: { state: InvoiceFormState }) {
  if (state.ok) {
    return (
      <p role="status" className="admin-alert admin-alert-success">
        ✓ {state.message}
      </p>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="admin-alert admin-alert-error">
        {state.error}
      </p>
    );
  }
  return null;
}

function MarkPaidForm({
  invoiceId,
  invoiceNumber,
  remainingCents,
}: {
  invoiceId: string;
  invoiceNumber: string;
  remainingCents: number;
}) {
  const [state, action, pending] = useActionState(markPaidManualFormAction, INVOICE_FORM_INITIAL);
  const [open, setOpen] = useState(false);
  const remainingEur = (remainingCents / 100).toFixed(2);

  if (state.ok) return <FormResult state={state} />;
  if (!open) {
    return (
      <button type="button" className="admin-button-ghost" onClick={() => setOpen(true)}>
        + Enregistrer un paiement manuel…
      </button>
    );
  }
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Paiement manuel sur {invoiceNumber}</h3>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="admin-field">
        <label htmlFor={`amount-${invoiceId}`} className="admin-label">
          Montant € TTC (reste dû : {remainingEur} €)
        </label>
        <input
          id={`amount-${invoiceId}`}
          name="amountEur"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={remainingEur}
          required
          className="admin-input"
          disabled={pending}
        />
      </div>
      <div className="admin-field">
        <label htmlFor={`mode-${invoiceId}`} className="admin-label">
          Mode
        </label>
        <select
          id={`mode-${invoiceId}`}
          name="mode"
          defaultValue="manual_wire"
          className="admin-input"
          disabled={pending}
        >
          <option value="manual_wire">Virement (SEPA)</option>
          <option value="manual_check">Chèque</option>
          <option value="manual_cash">Espèces</option>
        </select>
      </div>
      <div className="admin-field">
        <label htmlFor={`paidAt-${invoiceId}`} className="admin-label">
          Date paiement (réception en compte)
        </label>
        <input
          id={`paidAt-${invoiceId}`}
          name="paidAt"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
          className="admin-input"
          disabled={pending}
        />
      </div>
      <div className="admin-field">
        <label htmlFor={`reference-${invoiceId}`} className="admin-label">
          Référence (numéro virement / chèque)
        </label>
        <input
          id={`reference-${invoiceId}`}
          name="reference"
          type="text"
          maxLength={120}
          className="admin-input"
          disabled={pending}
        />
      </div>
      <div className="admin-field">
        <label htmlFor={`notes-${invoiceId}`} className="admin-label">
          Notes internes (optionnel)
        </label>
        <textarea
          id={`notes-${invoiceId}`}
          name="notes"
          rows={2}
          maxLength={2000}
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>
      <FormResult state={state} />
      <div className="admin-filters-actions">
        <button type="submit" disabled={pending} className="admin-button admin-button-validate">
          {pending ? "Enregistrement…" : "✓ Enregistrer le paiement"}
        </button>
        <button
          type="button"
          className="admin-button-ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

function CreditNoteForm({
  invoiceId,
  invoiceNumber,
}: {
  invoiceId: string;
  invoiceNumber: string;
}) {
  const [state, action, pending] = useActionState(issueCreditNoteFormAction, INVOICE_FORM_INITIAL);
  const [open, setOpen] = useState(false);
  if (state.ok) return <FormResult state={state} />;
  if (!open) {
    return (
      <button type="button" className="admin-button-ghost" onClick={() => setOpen(true)}>
        Générer un avoir…
      </button>
    );
  }
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Avoir lié à {invoiceNumber}</h3>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="admin-field">
        <label htmlFor={`cn-amount-${invoiceId}`} className="admin-label">
          Montant € TTC (HT positif, l&apos;avoir sera enregistré en négatif)
        </label>
        <input
          id={`cn-amount-${invoiceId}`}
          name="amountEur"
          type="number"
          step="0.01"
          min="0.01"
          required
          className="admin-input"
          disabled={pending}
        />
      </div>
      <div className="admin-field">
        <label htmlFor={`cn-reason-${invoiceId}`} className="admin-label">
          Motif (10-500 caractères, archivé immuable)
        </label>
        <textarea
          id={`cn-reason-${invoiceId}`}
          name="reason"
          rows={3}
          minLength={10}
          maxLength={500}
          required
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>
      <FormResult state={state} />
      <div className="admin-filters-actions">
        <button type="submit" disabled={pending} className="admin-button admin-button-refuse">
          {pending ? "Génération…" : "↩ Générer l'avoir"}
        </button>
        <button
          type="button"
          className="admin-button-ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

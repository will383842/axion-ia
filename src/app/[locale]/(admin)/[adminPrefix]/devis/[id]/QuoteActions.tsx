"use client";
// use-client: useActionState pour 4 actions admin devis (Sprint A).
//
// Actions exposées dynamiquement selon status :
//   - edit (si draft)
//   - send (si draft) — déclenche DocuSeal séquentiel client → Axion-IA
//   - markSignedManually (super_admin only — si sent)
//   - markDeclined (si sent)
//
// Edit form est inline (pas de modal) — édite montant HT + TVA + body.

import { useActionState, useState } from "react";
import {
  editQuoteDraftFormAction,
  sendQuoteFormAction,
  markQuoteSignedManuallyFormAction,
  markQuoteDeclinedFormAction,
  QUOTE_FORM_INITIAL,
  type QuoteFormState,
} from "@/features/booking/quote-form-actions";
import type { QuoteStatus } from "../../../../../../../prisma/generated/client";

interface Props {
  quoteId: string;
  status: QuoteStatus;
  role: string;
}

export function QuoteActions({ quoteId, status, role }: Props) {
  const isSuperAdmin = role === "super_admin";
  const canWrite = role === "super_admin" || role === "admin";

  if (!canWrite) {
    return (
      <p className="admin-meta-block">
        Lecture seule — votre rôle ne permet pas d&apos;agir sur les devis.
      </p>
    );
  }

  const canEdit = status === "draft";
  const canSend = status === "draft";
  const canMarkSigned = isSuperAdmin && status === "sent";
  const canMarkDeclined = status === "sent";

  return (
    <div className="admin-form">
      {canEdit && <EditDraftForm quoteId={quoteId} />}
      {canSend && <SendForm quoteId={quoteId} />}
      {canMarkSigned && <MarkSignedForm quoteId={quoteId} />}
      {canMarkDeclined && <MarkDeclinedForm quoteId={quoteId} />}
      {!canEdit && !canSend && !canMarkSigned && !canMarkDeclined && (
        <p className="admin-meta-block">
          Aucune action admin disponible pour le statut actuel ({status}).
        </p>
      )}
    </div>
  );
}

function FormResult({ state }: { state: QuoteFormState }) {
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

function EditDraftForm({ quoteId }: { quoteId: string }) {
  const [state, action, pending] = useActionState(editQuoteDraftFormAction, QUOTE_FORM_INITIAL);
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Éditer le brouillon</h3>
      <input type="hidden" name="quoteId" value={quoteId} />
      <div className="admin-field">
        <label htmlFor={`eq-amount-${quoteId}`} className="admin-label">
          Montant € HT (override — laisser vide pour ne pas changer)
        </label>
        <input
          id={`eq-amount-${quoteId}`}
          name="amountHtEur"
          type="number"
          step="0.01"
          min="0"
          className="admin-input"
          disabled={pending}
        />
      </div>
      <div className="admin-field">
        <label htmlFor={`eq-vat-${quoteId}`} className="admin-label">
          Taux TVA (%) — 0 si reverse charge
        </label>
        <input
          id={`eq-vat-${quoteId}`}
          name="vatRate"
          type="number"
          step="0.01"
          min="0"
          max="30"
          className="admin-input"
          disabled={pending}
        />
      </div>
      <div className="admin-field">
        <label className="admin-label">
          <input type="checkbox" name="vatReverseCharge" disabled={pending} /> TVA reverse charge UE
        </label>
      </div>
      <div className="admin-field">
        <label htmlFor={`eq-validuntil-${quoteId}`} className="admin-label">
          Validité jusqu&apos;au (override)
        </label>
        <input
          id={`eq-validuntil-${quoteId}`}
          name="validUntilDate"
          type="date"
          className="admin-input"
          disabled={pending}
        />
      </div>
      <div className="admin-field">
        <label htmlFor={`eq-body-${quoteId}`} className="admin-label">
          Corps Tiptap JSON (override)
        </label>
        <textarea
          id={`eq-body-${quoteId}`}
          name="body"
          rows={6}
          className="admin-input admin-textarea"
          placeholder='{"type":"doc","content":[…]}'
          disabled={pending}
        />
      </div>
      <FormResult state={state} />
      <button type="submit" disabled={pending} className="admin-button">
        {pending ? "Sauvegarde…" : "💾 Sauvegarder le brouillon"}
      </button>
    </form>
  );
}

function SendForm({ quoteId }: { quoteId: string }) {
  const [state, action, pending] = useActionState(sendQuoteFormAction, QUOTE_FORM_INITIAL);
  if (state.ok) return <FormResult state={state} />;
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Envoyer le devis pour signature</h3>
      <p className="admin-meta-block">
        Crée la submission DocuSeal (signature séquentielle client → Axion-IA), marque le devis{" "}
        <code>sent</code>, transite le booking <code>quote_required → quote_sent</code>, envoie
        l&apos;email visiteur avec le lien de signature.
      </p>
      <input type="hidden" name="quoteId" value={quoteId} />
      <FormResult state={state} />
      <button type="submit" disabled={pending} className="admin-button admin-button-validate">
        {pending ? "Envoi…" : "📤 Envoyer le devis"}
      </button>
    </form>
  );
}

function MarkSignedForm({ quoteId }: { quoteId: string }) {
  const [state, action, pending] = useActionState(
    markQuoteSignedManuallyFormAction,
    QUOTE_FORM_INITIAL,
  );
  const [open, setOpen] = useState(false);
  if (state.ok) return <FormResult state={state} />;
  if (!open) {
    return (
      <button type="button" className="admin-button-ghost" onClick={() => setOpen(true)}>
        ✓ Marquer signé manuellement (super_admin)…
      </button>
    );
  }
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Marquer signé manuellement (super_admin)</h3>
      <p className="admin-meta-block">
        Utilise uniquement si signature physique scannée OU webhook DocuSeal manqué. Audit log
        immutable.
      </p>
      <input type="hidden" name="quoteId" value={quoteId} />
      <div className="admin-field">
        <label htmlFor={`ms-pdfurl-${quoteId}`} className="admin-label">
          URL PDF signé (optionnel — preuve)
        </label>
        <input
          id={`ms-pdfurl-${quoteId}`}
          name="pdfUrl"
          type="url"
          className="admin-input"
          disabled={pending}
        />
      </div>
      <FormResult state={state} />
      <div className="admin-filters-actions">
        <button type="submit" disabled={pending} className="admin-button admin-button-validate">
          {pending ? "Validation…" : "✓ Marquer signé"}
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

function MarkDeclinedForm({ quoteId }: { quoteId: string }) {
  const [state, action, pending] = useActionState(markQuoteDeclinedFormAction, QUOTE_FORM_INITIAL);
  const [open, setOpen] = useState(false);
  if (state.ok) return <FormResult state={state} />;
  if (!open) {
    return (
      <button type="button" className="admin-button-ghost" onClick={() => setOpen(true)}>
        ✕ Marquer refusé…
      </button>
    );
  }
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Marquer le devis refusé</h3>
      <input type="hidden" name="quoteId" value={quoteId} />
      <FormResult state={state} />
      <div className="admin-filters-actions">
        <button type="submit" disabled={pending} className="admin-button admin-button-refuse">
          {pending ? "Marquage…" : "✕ Marquer refusé"}
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

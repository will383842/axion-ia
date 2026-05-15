"use client";
// use-client: generateQuoteDraftFormAction wrapper (Sprint A patch).
//
// Form de création devis lié à un Booking. Validité par défaut +30j (V1).

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { generateQuoteDraftFormAction } from "@/features/booking/quote-form-actions";
import { QUOTE_FORM_INITIAL, type QuoteFormState } from "@/features/booking/quote-form-state";

interface Props {
  bookingId: string;
  defaultAmountHtCents: number | null | undefined;
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

export function NewQuoteForm({ bookingId, defaultAmountHtCents }: Props) {
  const [state, action, pending] = useActionState(generateQuoteDraftFormAction, QUOTE_FORM_INITIAL);
  const router = useRouter();
  const defaultAmountEur = defaultAmountHtCents ? (defaultAmountHtCents / 100).toFixed(2) : "";

  // Redirect vers /devis/[id] après succès (useEffect, pas dans action serveur)
  useEffect(() => {
    if (state.ok && state.quoteId) {
      const adminPrefix = window.location.pathname.split("/")[2] ?? "admin";
      const timeout = setTimeout(() => {
        router.push(`/fr/${adminPrefix}/devis/${state.quoteId}`);
      }, 1200);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [state, router]);

  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="bookingId" value={bookingId} />

      <div className="admin-field">
        <label htmlFor="nq-amount" className="admin-label">
          Montant € HT (devis)
        </label>
        <input
          id="nq-amount"
          name="amountHtEur"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={defaultAmountEur}
          required
          className="admin-input"
          disabled={pending}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="nq-vat" className="admin-label">
          Taux TVA (%) — 0 si reverse charge UE
        </label>
        <input
          id="nq-vat"
          name="vatRate"
          type="number"
          step="0.01"
          min="0"
          max="30"
          defaultValue="0"
          required
          className="admin-input"
          disabled={pending}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label">
          <input type="checkbox" name="vatReverseCharge" defaultChecked disabled={pending} /> TVA
          reverse charge (Axion-IA OÜ Estonie — UE intra)
        </label>
      </div>

      <div className="admin-field">
        <label htmlFor="nq-validuntil" className="admin-label">
          Validité du devis (jusqu&apos;au, par défaut +30 jours si vide)
        </label>
        <input
          id="nq-validuntil"
          name="validUntilDate"
          type="date"
          className="admin-input"
          disabled={pending}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="nq-body" className="admin-label">
          Corps Tiptap JSON ou texte libre (snapshot immuable)
        </label>
        <textarea
          id="nq-body"
          name="body"
          rows={8}
          required
          className="admin-input admin-textarea"
          placeholder='Description détaillée du périmètre, livrables, conditions... (texte simple ou {"type":"doc","content":[…]})'
          disabled={pending}
        />
      </div>

      <FormResult state={state} />

      <button type="submit" disabled={pending} className="admin-button admin-button-validate">
        {pending ? "Création…" : "📄 Créer le devis draft"}
      </button>
    </form>
  );
}

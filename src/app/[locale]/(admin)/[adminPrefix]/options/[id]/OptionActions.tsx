"use client";
// use-client: useActionState pour 2 actions (validate + refuse) avec UI distincte.

import { useActionState, useState } from "react";
import {
  validateOptionAction,
  refuseOptionAction,
  type ValidateOptionState,
  type RefuseOptionState,
} from "@/features/admin-options/actions";

const initValidate: ValidateOptionState = { ok: false, error: "" };
const initRefuse: RefuseOptionState = { ok: false, error: "" };

export function OptionActions({ optionId }: { optionId: string }) {
  const [vState, vAction, vPending] = useActionState(validateOptionAction, initValidate);
  const [rState, rAction, rPending] = useActionState(refuseOptionAction, initRefuse);
  const [showRefuse, setShowRefuse] = useState(false);

  if (vState.ok) {
    return (
      <p role="status" className="admin-alert admin-alert-success">
        ✓ Option validée → réservation ferme créée. Email envoyé au contact.
      </p>
    );
  }
  if (rState.ok) {
    return (
      <p role="status" className="admin-alert admin-alert-success">
        ✓ Option refusée. Créneau libéré. Email envoyé au contact.
      </p>
    );
  }

  return (
    <div className="admin-form">
      <form action={vAction} className="admin-form">
        <input type="hidden" name="id" value={optionId} />
        <div className="admin-field">
          <label htmlFor="validate-notes" className="admin-label">
            Notes internes (optionnelles)
          </label>
          <textarea
            id="validate-notes"
            name="notes"
            rows={3}
            maxLength={2000}
            className="admin-input admin-textarea"
            placeholder="Ex: contact prioritaire, paiement déjà reçu, etc."
            disabled={vPending || rPending}
          />
        </div>
        {!vState.ok && vState.error && (
          <p role="alert" className="admin-alert admin-alert-error">
            {vState.error}
          </p>
        )}
        <button
          type="submit"
          disabled={vPending || rPending}
          className="admin-button admin-button-validate"
        >
          {vPending ? "Validation..." : "✓ Valider l'option (créer réservation ferme)"}
        </button>
      </form>

      {!showRefuse ? (
        <button
          type="button"
          className="admin-button-ghost"
          onClick={() => setShowRefuse(true)}
          disabled={vPending || rPending}
        >
          Refuser l&apos;option…
        </button>
      ) : (
        <form action={rAction} className="admin-form admin-form-refuse">
          <input type="hidden" name="id" value={optionId} />
          <div className="admin-field">
            <label htmlFor="refuse-reason" className="admin-label">
              Motif du refus (envoyé au contact dans l&apos;email)
            </label>
            <textarea
              id="refuse-reason"
              name="reason"
              rows={3}
              maxLength={500}
              className="admin-input admin-textarea"
              placeholder="Ex: créneau finalement indisponible, profil pas adapté…"
              disabled={vPending || rPending}
            />
          </div>
          {!rState.ok && rState.error && (
            <p role="alert" className="admin-alert admin-alert-error">
              {rState.error}
            </p>
          )}
          <div className="admin-filters-actions">
            <button
              type="submit"
              disabled={vPending || rPending}
              className="admin-button admin-button-refuse"
            >
              {rPending ? "Refus..." : "✕ Refuser et libérer le créneau"}
            </button>
            <button
              type="button"
              className="admin-button-ghost"
              onClick={() => setShowRefuse(false)}
              disabled={vPending || rPending}
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

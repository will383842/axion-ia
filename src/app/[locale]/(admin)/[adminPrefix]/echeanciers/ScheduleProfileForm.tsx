"use client";
// use-client: useActionState pour upsert profile échéancier (Sprint C).

import { useActionState } from "react";
import {
  upsertProfileFormAction,
  SCHEDULE_FORM_INITIAL,
  type ScheduleFormState,
} from "@/features/payment-schedule/admin-form-actions";

function FormResult({ state }: { state: ScheduleFormState }) {
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

export function ScheduleProfileForm() {
  const [state, action, pending] = useActionState(upsertProfileFormAction, SCHEDULE_FORM_INITIAL);

  return (
    <form action={action} className="admin-form">
      <div className="admin-field">
        <label htmlFor="sp-id" className="admin-label">
          ID profil (laisser vide pour créer un nouveau)
        </label>
        <input id="sp-id" name="id" type="text" className="admin-input" disabled={pending} />
      </div>

      <div className="admin-field">
        <label htmlFor="sp-name" className="admin-label">
          Nom (ex: « medium » ou « 30/30/40 standard »)
        </label>
        <input
          id="sp-name"
          name="name"
          type="text"
          required
          maxLength={120}
          className="admin-input"
          disabled={pending}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="sp-slug" className="admin-label">
          Slug ([a-z0-9_-], unique)
        </label>
        <input
          id="sp-slug"
          name="slug"
          type="text"
          required
          maxLength={80}
          pattern="^[a-z0-9_-]+$"
          className="admin-input"
          disabled={pending}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="sp-installments" className="admin-label">
          Installments JSON (somme percentage = 100)
        </label>
        <textarea
          id="sp-installments"
          name="installmentsJson"
          rows={10}
          required
          className="admin-input admin-textarea"
          placeholder='[{"percentage":50,"dueOffsetDays":14,"dueRelativeTo":"validation","description":"Acompte 50 %"},{"percentage":50,"dueOffsetDays":-7,"dueRelativeTo":"booking_date","description":"Solde J-7"}]'
          disabled={pending}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="sp-threshmin" className="admin-label">
          Seuil min € HT (optionnel — auto-sélection profile selon montant booking)
        </label>
        <input
          id="sp-threshmin"
          name="thresholdMinEur"
          type="number"
          step="1"
          min="0"
          className="admin-input"
          disabled={pending}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="sp-threshmax" className="admin-label">
          Seuil max € HT (optionnel)
        </label>
        <input
          id="sp-threshmax"
          name="thresholdMaxEur"
          type="number"
          step="1"
          min="0"
          className="admin-input"
          disabled={pending}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label">
          <input type="checkbox" name="isDefault" disabled={pending} /> Profil par défaut pour cette
          tranche
        </label>
      </div>

      <FormResult state={state} />

      <button type="submit" disabled={pending} className="admin-button admin-button-validate">
        {pending ? "Sauvegarde…" : "💾 Sauvegarder le profil"}
      </button>
    </form>
  );
}

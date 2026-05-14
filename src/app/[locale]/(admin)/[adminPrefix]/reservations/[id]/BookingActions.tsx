"use client";
// use-client: useActionState pour 6 actions admin booking (Sprint X.8).
//
// Actions exposées dynamiquement selon le status :
//   - validateOnCalendarFormAction (D49 — si awaiting_admin_validation)
//   - pauseBookingFormAction (D61 — si confirmed)
//   - resumeBookingFormAction (D61 — si paused)
//   - markCompletedFormAction (si in_progress)
//   - markNoShowFormAction (super_admin only — si confirmed)
//   - markForceMajeureFormAction (super_admin only — quasi tous status actifs)
//
// Conventions :
//   - Chaque sous-formulaire = 1 useActionState dédié
//   - Le bloc se "compresse" après succès (rendu remplacé par un message)
//   - Reasons / notes obligatoires affichées en textarea, validées côté action

import { useActionState, useState } from "react";
import {
  validateOnCalendarFormAction,
  pauseBookingFormAction,
  resumeBookingFormAction,
  markCompletedFormAction,
  markNoShowFormAction,
  markForceMajeureFormAction,
  type BookingFormState,
} from "@/features/booking/admin-form-actions";
import type { BookingStatus } from "../../../../../../../prisma/generated/client";

interface Props {
  bookingId: string;
  status: BookingStatus;
  adminPrefix: string;
  role: string;
}

const initial: BookingFormState = { ok: false };

const ACTIVE_STATUSES: BookingStatus[] = [
  "contract_pending",
  "contract_payment_sent",
  "awaiting_admin_validation",
  "confirmed",
  "paused",
  "in_progress",
  "reminded_j7",
];

export function BookingActions({ bookingId, status, adminPrefix, role }: Props) {
  const isSuperAdmin = role === "super_admin";
  const canWrite = role === "super_admin" || role === "admin";

  if (!canWrite) {
    return (
      <p className="admin-meta-block">
        Lecture seule — votre rôle ne permet pas d&apos;agir sur les bookings.
      </p>
    );
  }

  const canValidate = status === "awaiting_admin_validation";
  const canPause = status === "confirmed";
  const canResume = status === "paused";
  const canComplete = status === "in_progress";
  const canMarkNoShow = isSuperAdmin && status === "confirmed";
  const canForceMajeure = isSuperAdmin && ACTIVE_STATUSES.includes(status);

  const anyActionAvailable =
    canValidate || canPause || canResume || canComplete || canMarkNoShow || canForceMajeure;

  return (
    <div className="admin-form">
      {canValidate && <ValidateOnCalendarForm bookingId={bookingId} adminPrefix={adminPrefix} />}
      {canPause && <PauseForm bookingId={bookingId} adminPrefix={adminPrefix} />}
      {canResume && <ResumeForm bookingId={bookingId} adminPrefix={adminPrefix} />}
      {canComplete && <MarkCompletedForm bookingId={bookingId} adminPrefix={adminPrefix} />}
      {canMarkNoShow && <MarkNoShowForm bookingId={bookingId} adminPrefix={adminPrefix} />}
      {canForceMajeure && <MarkForceMajeureForm bookingId={bookingId} adminPrefix={adminPrefix} />}
      {!anyActionAvailable && (
        <p className="admin-meta-block">
          Aucune action admin disponible pour le statut actuel ({status}).
        </p>
      )}
    </div>
  );
}

// ─── individual forms ───────────────────────────────────────────────────────

function FormResult({ state }: { state: BookingFormState }) {
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

function HiddenInputs({ bookingId, adminPrefix }: { bookingId: string; adminPrefix: string }) {
  return (
    <>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="adminPrefix" value={adminPrefix} />
    </>
  );
}

function ValidateOnCalendarForm({
  bookingId,
  adminPrefix,
}: {
  bookingId: string;
  adminPrefix: string;
}) {
  const [state, action, pending] = useActionState(validateOnCalendarFormAction, initial);
  if (state.ok) return <FormResult state={state} />;
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Valider sur le calendrier (clic Will 2 — D49)</h3>
      <HiddenInputs bookingId={bookingId} adminPrefix={adminPrefix} />
      <div className="admin-field">
        <label htmlFor={`v-notes-${bookingId}`} className="admin-label">
          Notes internes (optionnel)
        </label>
        <textarea
          id={`v-notes-${bookingId}`}
          name="notes"
          rows={3}
          maxLength={2000}
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>
      <FormResult state={state} />
      <button type="submit" disabled={pending} className="admin-button admin-button-validate">
        {pending ? "Validation…" : "✓ Verrouiller sur le calendrier"}
      </button>
    </form>
  );
}

function PauseForm({ bookingId, adminPrefix }: { bookingId: string; adminPrefix: string }) {
  const [state, action, pending] = useActionState(pauseBookingFormAction, initial);
  const [open, setOpen] = useState(false);
  if (state.ok) return <FormResult state={state} />;
  if (!open) {
    return (
      <button type="button" className="admin-button-ghost" onClick={() => setOpen(true)}>
        Mettre en pause (D61)…
      </button>
    );
  }
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Mise en pause (D61)</h3>
      <HiddenInputs bookingId={bookingId} adminPrefix={adminPrefix} />
      <div className="admin-field">
        <label htmlFor={`p-reason-${bookingId}`} className="admin-label">
          Motif (10-500 caractères, visible client par email)
        </label>
        <textarea
          id={`p-reason-${bookingId}`}
          name="reason"
          rows={3}
          minLength={10}
          maxLength={500}
          required
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>
      <div className="admin-field">
        <label htmlFor={`p-until-${bookingId}`} className="admin-label">
          Reprise prévue (date indicative, optionnel)
        </label>
        <input
          type="date"
          id={`p-until-${bookingId}`}
          name="pausedUntil"
          className="admin-input"
          disabled={pending}
        />
      </div>
      <FormResult state={state} />
      <div className="admin-filters-actions">
        <button type="submit" disabled={pending} className="admin-button admin-button-refuse">
          {pending ? "Mise en pause…" : "⏸ Mettre en pause"}
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

function ResumeForm({ bookingId, adminPrefix }: { bookingId: string; adminPrefix: string }) {
  const [state, action, pending] = useActionState(resumeBookingFormAction, initial);
  if (state.ok) return <FormResult state={state} />;
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Reprendre le booking (D61)</h3>
      <HiddenInputs bookingId={bookingId} adminPrefix={adminPrefix} />
      <div className="admin-field">
        <label htmlFor={`r-slot-${bookingId}`} className="admin-label">
          Nouveau slot id (optionnel — laisser vide pour reprise sans changement de date)
        </label>
        <input
          type="text"
          id={`r-slot-${bookingId}`}
          name="newSlotId"
          className="admin-input"
          placeholder="uuid du slot"
          disabled={pending}
        />
      </div>
      <FormResult state={state} />
      <button type="submit" disabled={pending} className="admin-button admin-button-validate">
        {pending ? "Reprise…" : "▶ Reprendre"}
      </button>
    </form>
  );
}

function MarkCompletedForm({ bookingId, adminPrefix }: { bookingId: string; adminPrefix: string }) {
  const [state, action, pending] = useActionState(markCompletedFormAction, initial);
  if (state.ok) return <FormResult state={state} />;
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Marquer comme terminé</h3>
      <HiddenInputs bookingId={bookingId} adminPrefix={adminPrefix} />
      <div className="admin-field">
        <label htmlFor={`c-notes-${bookingId}`} className="admin-label">
          Notes (optionnel)
        </label>
        <textarea
          id={`c-notes-${bookingId}`}
          name="notes"
          rows={3}
          maxLength={2000}
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>
      <FormResult state={state} />
      <button type="submit" disabled={pending} className="admin-button admin-button-validate">
        {pending ? "Clôture…" : "✓ Marquer terminé"}
      </button>
    </form>
  );
}

function MarkNoShowForm({ bookingId, adminPrefix }: { bookingId: string; adminPrefix: string }) {
  const [state, action, pending] = useActionState(markNoShowFormAction, initial);
  const [open, setOpen] = useState(false);
  if (state.ok) return <FormResult state={state} />;
  if (!open) {
    return (
      <button type="button" className="admin-button-ghost" onClick={() => setOpen(true)}>
        Marquer no-show (super_admin)…
      </button>
    );
  }
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">No-show (super_admin)</h3>
      <HiddenInputs bookingId={bookingId} adminPrefix={adminPrefix} />
      <div className="admin-field">
        <label htmlFor={`ns-reason-${bookingId}`} className="admin-label">
          Motif (10-500 caractères, audit immuable)
        </label>
        <textarea
          id={`ns-reason-${bookingId}`}
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
          {pending ? "Enregistrement…" : "✕ Marquer no-show"}
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

function MarkForceMajeureForm({
  bookingId,
  adminPrefix,
}: {
  bookingId: string;
  adminPrefix: string;
}) {
  const [state, action, pending] = useActionState(markForceMajeureFormAction, initial);
  const [open, setOpen] = useState(false);
  if (state.ok) return <FormResult state={state} />;
  if (!open) {
    return (
      <button type="button" className="admin-button-ghost" onClick={() => setOpen(true)}>
        Force majeure (super_admin)…
      </button>
    );
  }
  return (
    <form action={action} className="admin-form admin-form-block">
      <h3 className="admin-h3">Force majeure (super_admin)</h3>
      <HiddenInputs bookingId={bookingId} adminPrefix={adminPrefix} />
      <div className="admin-field">
        <label htmlFor={`fm-notes-${bookingId}`} className="admin-label">
          Description circonstanciée (20-2000 caractères)
        </label>
        <textarea
          id={`fm-notes-${bookingId}`}
          name="notes"
          rows={5}
          minLength={20}
          maxLength={2000}
          required
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>
      <FormResult state={state} />
      <div className="admin-filters-actions">
        <button type="submit" disabled={pending} className="admin-button admin-button-refuse">
          {pending ? "Enregistrement…" : "⚠ Déclarer force majeure"}
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

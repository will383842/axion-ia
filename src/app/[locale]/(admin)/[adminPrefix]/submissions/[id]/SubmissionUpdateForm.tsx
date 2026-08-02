"use client";
// use-client: useActionState pour bind updateSubmissionAction (status + notes + assigned).

import { useActionState } from "react";
import {
  updateSubmissionAction,
  type UpdateSubmissionState,
} from "@/features/admin-submissions/actions";

const initialState: UpdateSubmissionState = { ok: false, error: "" };

interface Props {
  id: string;
  currentStatus: string;
  currentInternalNotes: string | null;
  currentAssignedTo: string | null;
}

export function SubmissionUpdateForm({
  id,
  currentStatus,
  currentInternalNotes,
  currentAssignedTo,
}: Props) {
  const [state, formAction, pending] = useActionState(updateSubmissionAction, initialState);
  return (
    <form action={formAction} className="admin-form">
      <input type="hidden" name="id" value={id} />

      <div className="admin-field">
        <label htmlFor="status" className="admin-label">
          Statut
        </label>
        <select
          id="status"
          name="status"
          defaultValue={currentStatus}
          className="admin-input"
          disabled={pending}
        >
          <option value="new">Nouveau</option>
          <option value="in_progress">En cours</option>
          <option value="processed">Traité</option>
          <option value="archived">Archivé</option>
        </select>
      </div>

      <div className="admin-field">
        <label htmlFor="assignedTo" className="admin-label">
          Assigné à (nom interne)
        </label>
        <input
          id="assignedTo"
          name="assignedTo"
          type="text"
          defaultValue={currentAssignedTo ?? ""}
          maxLength={100}
          className="admin-input"
          disabled={pending}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="internalNotes" className="admin-label">
          Notes internes (privées)
        </label>
        <textarea
          id="internalNotes"
          name="internalNotes"
          rows={5}
          defaultValue={currentInternalNotes ?? ""}
          maxLength={5000}
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>

      {state.ok ? (
        <p role="status" className="admin-alert admin-alert-success">
          Mise à jour enregistrée.
        </p>
      ) : state.error ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="admin-button">
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}

"use client";
// use-client: useActionState bind updateApplicationStatusAction + deleteApplicationAction.

import { useActionState } from "react";
import {
  updateApplicationStatusAction,
  deleteApplicationAction,
  type UpdateApplicationState,
} from "@/features/admin-job-applications/actions";

const init: UpdateApplicationState = { ok: false, error: "" };

const STATUSES: ReadonlyArray<readonly [string, string]> = [
  ["new", "Nouvelle"],
  ["reviewing", "En revue"],
  ["shortlisted", "Présélection"],
  ["rejected", "Refusée"],
  ["hired", "Recrutée"],
  ["archived", "Archivée"],
];

interface Props {
  id: string;
  status: string;
  internalNotes: string | null;
  assignedTo: string | null;
  needsAttention: boolean;
}

export function ApplicationStatusForm({
  id,
  status,
  internalNotes,
  assignedTo,
  needsAttention,
}: Props) {
  const [state, formAction, pending] = useActionState(updateApplicationStatusAction, init);
  const [delState, delAction, delPending] = useActionState(deleteApplicationAction, init);

  return (
    <>
      <form action={formAction} className="admin-form">
        <input type="hidden" name="id" value={id} />
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="status" className="admin-label">
              Statut
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              className="admin-input"
              disabled={pending}
            >
              {STATUSES.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="assignedTo" className="admin-label">
              Assignée à
            </label>
            <input
              id="assignedTo"
              name="assignedTo"
              type="text"
              maxLength={100}
              defaultValue={assignedTo ?? ""}
              className="admin-input"
              disabled={pending}
            />
          </div>
        </div>
        <div className="admin-field">
          <label htmlFor="internalNotes" className="admin-label">
            Notes internes
          </label>
          <textarea
            id="internalNotes"
            name="internalNotes"
            rows={3}
            defaultValue={internalNotes ?? ""}
            className="admin-input admin-textarea"
            disabled={pending}
          />
        </div>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            name="needsAttention"
            value="true"
            defaultChecked={needsAttention}
            disabled={pending}
          />
          À traiter
        </label>
        <div>
          <button type="submit" disabled={pending} className="admin-button">
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
          {state.ok ? (
            <span role="status" className="admin-meta-small">
              {" "}
              Mis à jour
            </span>
          ) : state.error ? (
            <span role="alert" className="admin-meta-small">
              {" "}
              {state.error}
            </span>
          ) : null}
        </div>
      </form>

      <form
        action={delAction}
        onSubmit={(e) => {
          if (
            !window.confirm(
              "Supprimer définitivement cette candidature et son CV ? Irréversible (RGPD).",
            )
          )
            e.preventDefault();
        }}
        className="admin-inline-form"
      >
        <input type="hidden" name="id" value={id} />
        <button type="submit" disabled={delPending} className="admin-button-ghost">
          {delPending ? "…" : "Supprimer (droit à l'effacement)"}
        </button>
        {delState.ok === false && delState.error ? (
          <span role="alert" className="admin-meta-small">
            {delState.error}
          </span>
        ) : null}
      </form>
    </>
  );
}

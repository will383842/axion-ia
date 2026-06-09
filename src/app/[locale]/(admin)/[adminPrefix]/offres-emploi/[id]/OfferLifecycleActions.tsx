"use client";
// use-client: useActionState bind des actions lifecycle (archive/pourvu/clone/delete).

import { useActionState } from "react";
import {
  archiveJobOfferAction,
  setJobOfferFilledAction,
  cloneJobOfferAction,
  deleteJobOfferAction,
  type JobOfferActionState,
} from "@/features/admin-job-offers/actions";

const init: JobOfferActionState = { ok: false, error: "" };

type LifecycleAction = (
  prev: JobOfferActionState,
  formData: FormData,
) => Promise<JobOfferActionState>;

function ActionForm({
  action,
  id,
  label,
  confirmMessage,
}: {
  action: LifecycleAction;
  id: string;
  label: string;
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, init);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage))
          e.preventDefault();
      }}
      className="admin-inline-form"
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="admin-button-ghost">
        {pending ? "…" : label}
      </button>
      {state.ok === false && state.error ? (
        <span role="alert" className="admin-meta-small">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

export function OfferLifecycleActions({ id }: { id: string }) {
  return (
    <div className="admin-actions-row">
      <ActionForm
        action={setJobOfferFilledAction}
        id={id}
        label="Marquer pourvu"
      />
      <ActionForm action={cloneJobOfferAction} id={id} label="Dupliquer" />
      <ActionForm
        action={archiveJobOfferAction}
        id={id}
        label="Archiver"
        confirmMessage="Archiver cette offre ? Elle ne sera plus visible publiquement."
      />
      <ActionForm
        action={deleteJobOfferAction}
        id={id}
        label="Supprimer définitivement"
        confirmMessage="SUPPRIMER définitivement l'offre ET toutes ses candidatures (CV inclus) ? Action irréversible."
      />
    </div>
  );
}

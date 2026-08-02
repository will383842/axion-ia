"use client";
// use-client: useActionState pour archive button avec confirmation visuelle.

import { useActionState, useState } from "react";
import { archiveFAQAction, type DeleteFAQState } from "@/features/admin-faq/actions";

const init: DeleteFAQState = { ok: false, error: "" };

export function ArchiveButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(archiveFAQAction, init);
  const [confirm, setConfirm] = useState(false);

  if (state.ok) {
    return <span className="admin-alert admin-alert-success">Archivée.</span>;
  }
  if (!confirm) {
    return (
      <button type="button" className="admin-button-ghost" onClick={() => setConfirm(true)}>
        Archiver…
      </button>
    );
  }
  return (
    <form action={formAction} className="admin-filters-actions">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="admin-button admin-button-refuse" disabled={pending}>
        {pending ? "Archivage..." : "Confirmer archivage"}
      </button>
      <button
        type="button"
        className="admin-button-ghost"
        onClick={() => setConfirm(false)}
        disabled={pending}
      >
        Annuler
      </button>
    </form>
  );
}

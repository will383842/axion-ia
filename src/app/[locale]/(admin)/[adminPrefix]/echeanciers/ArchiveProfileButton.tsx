"use client";
// use-client: archiveProfileFormAction wrapper (Sprint A patch).
//
// Bouton inline dans le tableau /echeanciers pour soft-delete un profile.

import { useActionState } from "react";
import { archiveProfileFormAction } from "@/features/payment-schedule/admin-form-actions";
import { SCHEDULE_FORM_INITIAL } from "@/features/payment-schedule/admin-form-state";

export function ArchiveProfileButton({ profileId }: { profileId: string }) {
  const [state, action, pending] = useActionState(archiveProfileFormAction, SCHEDULE_FORM_INITIAL);

  if (state.ok) {
    return (
      <span role="status" className="admin-meta-small" style={{ color: "var(--color-sage)" }}>
        ✓ archivé
      </span>
    );
  }

  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="profileId" value={profileId} />
      <button
        type="submit"
        disabled={pending}
        className="admin-button-ghost admin-button-refuse"
        title="Soft-delete (archivedAt non-null) — récupérable via DB"
        style={{ padding: "2px 8px", fontSize: 12 }}
      >
        {pending ? "…" : "🗄 Archiver"}
      </button>
      {state.error && (
        <span
          role="alert"
          className="admin-meta-small"
          style={{ color: "var(--color-warning)", marginLeft: 8 }}
        >
          {state.error}
        </span>
      )}
    </form>
  );
}

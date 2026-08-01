"use client";
// use-client: useActionState (pattern OptionActions.tsx / BookingActions.tsx —
// idiome dominant de la console pour les boutons de mutation avec feedback).

import { useActionState } from "react";

import {
  validateImageAction,
  correctImageModuleAction,
  type ReviewActionState,
} from "@/server/actions/image-bank/review.action";
import { MODULES, MODULE_LABELS_FR, type Module } from "@/server/image-bank/taxonomy";

const initState: ReviewActionState = { ok: false, error: "" };

interface Props {
  imageId: string;
  module: string | null;
}

export function ImageReviewActions({ imageId, module }: Props): React.ReactElement {
  const [vState, vAction, vPending] = useActionState(validateImageAction, initState);
  const [cState, cAction, cPending] = useActionState(correctImageModuleAction, initState);
  const busy = vPending || cPending;

  return (
    <div className="flex flex-col gap-[var(--space-admin-4)]">
      {vState.ok ? (
        <p role="status" className="admin-alert admin-alert-success">
          ✓ Image validée — retirée de la file « Qualité ».
        </p>
      ) : (
        <form action={vAction}>
          <input type="hidden" name="imageId" value={imageId} />
          {vState.error && (
            <p role="alert" className="admin-alert admin-alert-error">
              {vState.error}
            </p>
          )}
          <button type="submit" disabled={busy} className="admin-button admin-button-validate">
            {vPending ? "Validation…" : "✓ Valider"}
          </button>
        </form>
      )}

      <form action={cAction} className="flex flex-wrap items-end gap-[var(--space-admin-3)]">
        <input type="hidden" name="imageId" value={imageId} />
        <label className="flex flex-col gap-1">
          <span className="admin-meta-small">Corriger le classement</span>
          <select
            name="module"
            defaultValue={module ?? ""}
            className="admin-select"
            disabled={busy}
          >
            <option value="" disabled>
              Choisir un module…
            </option>
            {MODULES.map((m: Module) => (
              <option key={m} value={m}>
                {MODULE_LABELS_FR[m]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy} className="admin-button-ghost">
          {cPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
      {cState.ok && (
        <p role="status" className="admin-alert admin-alert-success">
          ✓ Classement mis à jour.
        </p>
      )}
      {!cState.ok && cState.error && (
        <p role="alert" className="admin-alert admin-alert-error">
          {cState.error}
        </p>
      )}
    </div>
  );
}

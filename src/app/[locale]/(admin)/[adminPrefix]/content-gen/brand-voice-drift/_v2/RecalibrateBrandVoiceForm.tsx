"use client";
// use-client: useActionState (React 19) pour le feedback inline + SubmitButton (useFormStatus).
//
// Refonte content-gen UX 2026 — fix B1 : le bouton « Recalibrer la référence »
// pointait vers une route /recalibrate inexistante (404). Remplacé par un
// <form action> inline branché sur l'action serveur existante.

import { useActionState } from "react";
import { SubmitButton } from "@/components/admin/content-gen/SubmitButton";
import {
  recalibrateBrandVoiceForm,
  type RecalibrateBrandVoiceFormState,
} from "@/server/actions/content-gen/brand-voice";

interface Props {
  /** IDs des articles de référence utilisés pour calculer l'embedding moyen. */
  readonly articleIds: readonly string[];
}

const INITIAL_STATE: RecalibrateBrandVoiceFormState = { status: "idle", message: "" };

export function RecalibrateBrandVoiceForm({ articleIds }: Props): React.ReactElement {
  const [state, formAction] = useActionState(recalibrateBrandVoiceForm, INITIAL_STATE);
  const hasArticles = articleIds.length > 0;

  return (
    <form action={formAction} className="flex flex-col items-end gap-[var(--space-admin-2)]">
      {articleIds.map((id) => (
        <input key={id} type="hidden" name="articleIds" value={id} />
      ))}
      <SubmitButton
        variant="primary"
        pendingLabel="Recalibration…"
        disabled={!hasArticles}
        ariaLabel="Recalibrer la référence brand voice à partir des articles affichés"
      >
        Recalibrer la référence
      </SubmitButton>
      {!hasArticles && (
        <span className="text-xs text-[color:var(--color-admin-muted)]">
          Aucun article disponible pour recalibrer.
        </span>
      )}
      {state.status === "success" && (
        <span role="status" className="text-xs" style={{ color: "var(--color-admin-success)" }}>
          {state.message}
        </span>
      )}
      {state.status === "error" && (
        <span role="alert" className="text-xs" style={{ color: "var(--color-admin-terracotta)" }}>
          {state.message}
        </span>
      )}
    </form>
  );
}

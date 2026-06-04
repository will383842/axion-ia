"use client";
// use-client: bouton de déclenchement d'ingestion (useActionState + état pending).

import { useActionState } from "react";
import {
  triggerIngestionAction,
  type TriggerIngestionState,
} from "@/features/admin-chatbot/actions";

const INIT: TriggerIngestionState = { ok: false, error: "" };

export function IngestionButton(): React.ReactElement {
  const [state, formAction, pending] = useActionState(triggerIngestionAction, INIT);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-3 py-1.5 text-[length:var(--text-admin-sm)] font-medium hover:bg-[color:var(--color-admin-surface-hover)] disabled:opacity-50"
      >
        {pending ? "Lancement…" : "Lancer l'ingestion"}
      </button>
      {state.ok ? (
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]">
          Ingestion lancée (le worker la traite).
        </span>
      ) : state.error ? (
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

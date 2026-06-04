// Bouton client « Résoudre » une escalade (server action + useActionState).

"use client";

import { useActionState } from "react";
import {
  resolveEscalationAction,
  type ResolveEscalationState,
} from "@/features/admin-chatbot/actions";

const INIT: ResolveEscalationState = { ok: false, error: "" };

export function EscaladeResolveButton({ id }: { id: string }): React.ReactElement {
  const [state, formAction, pending] = useActionState(resolveEscalationAction, INIT);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-3 py-1 text-[length:var(--text-admin-sm)] font-medium hover:bg-[color:var(--color-admin-surface-hover)] disabled:opacity-50"
      >
        {pending ? "…" : "Résoudre"}
      </button>
      {!state.ok && state.error ? (
        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-destructive)]">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

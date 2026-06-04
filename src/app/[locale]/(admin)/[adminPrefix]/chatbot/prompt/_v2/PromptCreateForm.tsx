"use client";
// use-client: formulaire de création de version (useActionState + textarea).

import { useActionState } from "react";
import {
  createPromptVersionAction,
  type CreatePromptState,
} from "@/features/admin-chatbot/actions";

const INIT: CreatePromptState = { ok: false, error: "" };

export function PromptCreateForm({ tenantId }: { tenantId: string }): React.ReactElement {
  const [state, formAction, pending] = useActionState(createPromptVersionAction, INIT);
  return (
    <form action={formAction} className="flex flex-col gap-[var(--space-admin-3)]">
      <input type="hidden" name="tenantId" value={tenantId} />
      <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
        <span className="font-medium">Contenu du prompt (règles système)</span>
        <textarea
          name="contenu"
          rows={8}
          required
          minLength={20}
          disabled={pending}
          placeholder="Tu es l'assistant d'Axion-IA…"
          className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-2 font-mono text-[length:var(--text-admin-sm)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
        <span className="font-medium">Note (optionnelle)</span>
        <input
          type="text"
          name="note"
          maxLength={200}
          disabled={pending}
          placeholder="ex. ton plus direct"
          className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-2 text-[length:var(--text-admin-sm)]"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-info)] px-4 py-2 text-[length:var(--text-admin-sm)] font-medium text-white disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Créer la version (inactive)"}
        </button>
        {state.ok ? (
          <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]">
            Version {state.version} créée. Activez-la pour la mettre en service.
          </span>
        ) : state.error ? (
          <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

"use client";
// use-client: édition inline d'une revue de direction (date + statut) via useTransition + Server Action.

/**
 * RevueDirectionRowActions — Édition d'une revue de direction (T19).
 *
 * Bouton « Modifier » ouvre un panneau d'édition inline (date de la revue +
 * statut) → updateRevueDirectionAction. Les champs JSON (participants,
 * décisions, plan d'actions) ne sont pas édités ici — ils sont capturés à la
 * création / via les outils dédiés.
 *
 * "use client" : useState/useTransition + appel Server Action.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { updateRevueDirectionAction } from "@/server/actions/qualiopi/revue-direction";

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-admin-accent)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-medium uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-1";

export interface RevueDirectionRowActionsProps {
  revue: {
    id: string;
    dateRevue: Date;
    statut: string;
  };
  updateAction: typeof updateRevueDirectionAction;
}

export function RevueDirectionRowActions({
  revue,
  updateAction,
}: RevueDirectionRowActionsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dateRevue, setDateRevue] = useState(() => revue.dateRevue.toISOString().slice(0, 10));
  const [statut, setStatut] = useState(revue.statut);

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateAction({
        id: revue.id,
        dateRevue: new Date(dateRevue),
        statut,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)] transition-opacity hover:opacity-80"
      >
        Modifier
      </button>
    );
  }

  return (
    <form
      onSubmit={handleUpdate}
      className="flex w-full max-w-sm flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]"
    >
      <div>
        <label htmlFor="revuedirectionrowactions-date-de-la-revue" className={labelCls}>
          Date de la revue
        </label>
        <input
          id="revuedirectionrowactions-date-de-la-revue"
          type="date"
          value={dateRevue}
          onChange={(e) => setDateRevue(e.target.value)}
          disabled={isPending}
          required
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="revuedirectionrowactions-statut" className={labelCls}>
          Statut
        </label>
        <select
          id="revuedirectionrowactions-statut"
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
          disabled={isPending}
          className={inputCls}
        >
          <option value="brouillon">Brouillon</option>
          <option value="validee">Validée</option>
          <option value="archivee">Archivée</option>
        </select>
      </div>
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      <div className="flex items-center gap-[var(--space-admin-2)]">
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={isPending}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] underline"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

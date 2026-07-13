"use client";
// use-client: report d'un verbatim/constat vers la revue de direction via useTransition + Server Action.

/**
 * ReporterEnRevueButton — Reporte un verbatim/constat dans le plan d'actions
 * de la revue de direction de l'année courante (LOT 4).
 *
 * Appelle `reporterEnRevueDirectionAction({ texte, source })` ; la revue est
 * créée en brouillon si absente. Feedback inline (reporté / erreur).
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import type { reporterEnRevueDirectionAction } from "@/server/actions/qualiopi/revue-direction";

export interface ReporterEnRevueButtonProps {
  texte: string;
  source: string;
  action: typeof reporterEnRevueDirectionAction;
}

export function ReporterEnRevueButton({
  texte,
  source,
  action,
}: ReporterEnRevueButtonProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await action({ texte, source });
      if ("error" in result) {
        setError(result.error);
      } else {
        setDone(true);
      }
    });
  }

  if (done) {
    return (
      <span className="text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-success)]">
        Reporté en revue de direction
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-[var(--space-admin-1)]">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline disabled:opacity-50"
      >
        {isPending ? "Report en cours…" : "Reporter en revue de direction"}
      </button>
      {error !== null && (
        <span
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </span>
      )}
    </span>
  );
}

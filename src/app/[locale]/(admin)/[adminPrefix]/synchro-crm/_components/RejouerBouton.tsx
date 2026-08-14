"use client";
// use-client: bouton d'action avec état de transition (useTransition) et affichage
// du message d'erreur retourné par la Server Action — impossible côté serveur.

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

type ActionResult<T> = { data: T } | { error: string };

export interface RejouerBoutonProps {
  id: string;
  action: (input: { id: string }) => Promise<ActionResult<{ id: string }>>;
}

/**
 * Remet une ligne d'outbox en file.
 *
 * Le succès n'affiche pas de message : la page est revalidée par l'action, donc
 * la ligne change d'état sous les yeux. Un « OK » en plus serait redondant — et
 * un « OK » qui mentirait pendant que rien ne bouge serait pire que rien.
 */
export function RejouerBouton({ id, action }: RejouerBoutonProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick(): void {
    setError(null);
    startTransition(async () => {
      const result = await action({ id });
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-start gap-[var(--space-admin-1)]">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="admin-button-secondary"
        aria-label={`Rejouer l'envoi de la ligne ${id}`}
      >
        <RefreshCw aria-hidden="true" className="size-4" />
        {isPending ? "Rejeu en cours…" : "Rejouer"}
      </button>
      {error !== null && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}

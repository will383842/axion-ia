"use client";
// use-client: confirmation locale en 2 temps + useTransition pour la server action
// enqueueBatchGenerationAction (enfile la génération IA du catalogue = coût API).
/**
 * BatchGenerationButton — Lance en un clic la génération IA de toutes les formations
 * relançables du catalogue (intention / structure_generee / contenu_evalue), bornée
 * par `limite`. N'enfile JAMAIS les formations en attente de validation humaine ou
 * publiées (garde-fou côté action).
 *
 * Confirmation en 2 temps : la génération consomme du crédit API Anthropic.
 *
 * "use client" : appel Server Action + feedback. Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface BatchGenerationButtonProps {
  /** Garde-fou : nombre max de formations enfilées d'un coup (1–50, défaut 20). */
  limite?: number;
  /** Server Action — enfile la génération du catalogue. */
  enqueueAction: (input: {
    limite?: number;
  }) => Promise<{ data: { enfilees: number; formationIds: string[] } } | { error: string }>;
}

export function BatchGenerationButton({
  limite = 20,
  enqueueAction,
}: BatchGenerationButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  function handleLancer() {
    setError(null);
    setSucces(null);
    startTransition(async () => {
      const result = await enqueueAction({ limite });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSucces(
          result.data.enfilees > 0
            ? `${result.data.enfilees} formation(s) enfilée(s) pour génération.`
            : "Aucune formation relançable à enfiler.",
        );
        setConfirming(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-[var(--space-admin-2)]">
      {!confirming ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setSucces(null);
            setConfirming(true);
          }}
          disabled={isPending}
          className="admin-button"
        >
          Générer tout le catalogue (max {limite})
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Lancer la génération IA (consomme du crédit API) ?
          </span>
          <button
            type="button"
            onClick={handleLancer}
            disabled={isPending}
            className="admin-button"
          >
            {isPending ? "Enfilage…" : "Confirmer"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isPending}
            className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      )}

      {succes !== null && (
        <p
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
        >
          {succes}
        </p>
      )}
      {error !== null && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
    </div>
  );
}

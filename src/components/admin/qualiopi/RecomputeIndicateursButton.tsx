"use client";
// use-client: appel Server Action recomputeIndicateursAction + router.refresh() pour re-fetcher les données serveur après recalcul.

/**
 * RecomputeIndicateursButton — Bouton de recalcul forcé des indicateurs.
 *
 * Invalide le cache Redis et recalcule les indicateurs via
 * `recomputeIndicateursAction({ annee })` (AGENT B), puis
 * appelle `router.refresh()` pour rafraîchir le Server Component parent.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recomputeIndicateursAction } from "@/server/actions/qualiopi/satisfaction";

interface RecomputeIndicateursButtonProps {
  annee: number;
  /** Optionnel : restreindre le recalcul à une formation spécifique. */
  formationId?: string;
}

export function RecomputeIndicateursButton({
  annee,
  formationId,
}: RecomputeIndicateursButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleRecompute() {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await recomputeIndicateursAction({
        annee,
        ...(formationId !== undefined ? { formationId } : {}),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Indicateurs recalculés.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-[var(--space-admin-2)]">
      <button
        type="button"
        onClick={handleRecompute}
        disabled={isPending}
        className="admin-button"
        aria-label={`Recalculer les indicateurs ${annee}`}
      >
        {isPending ? "Recalcul en cours…" : "Recalculer les indicateurs"}
      </button>
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
        >
          {successMsg}
        </p>
      )}
    </div>
  );
}

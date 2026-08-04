"use client";
// use-client: bouton de suppression d'une ligne de barème (server action + confirm).

/**
 * BaremeOpcoRowActions — Suppression d'une version de barème saisie par erreur.
 * L'historique légitime se gère par le versionnement (nouvelle version) ; la
 * suppression est réservée aux erreurs de saisie.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { supprimerBaremeOpcoAction } from "@/server/actions/qualiopi/baremes-opco";

export interface BaremeOpcoRowActionsProps {
  id: string;
  supprimerAction: typeof supprimerBaremeOpcoAction;
}

export function BaremeOpcoRowActions({ id, supprimerAction }: BaremeOpcoRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm("Supprimer cette version de barème ? (réservé aux erreurs de saisie)")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await supprimerAction({ id });
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)] underline-offset-2 hover:underline disabled:opacity-50"
      >
        {isPending ? "Suppression…" : "Supprimer"}
      </button>
      {error && (
        <span
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </span>
      )}
    </div>
  );
}

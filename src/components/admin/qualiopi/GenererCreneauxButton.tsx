"use client";
// use-client: bouton interactif déclenchant une server action via useTransition.
/**
 * GenererCreneauxButton — Bouton pour générer les créneaux de présence d'une session.
 *
 * Appelle `generateSessionCreneauxAction` puis rafraîchit la page.
 * "use client" : interactivité + Server Action.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface GenererCreneauxButtonProps {
  sessionId: string;
  genererAction: (input: {
    sessionId: string;
    heuresParJour?: number;
  }) => Promise<{ data: { created: number } } | { error: string }>;
  hasCreneaux: boolean;
}

export function GenererCreneauxButton({
  sessionId,
  genererAction,
  hasCreneaux,
}: GenererCreneauxButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number } | null>(null);

  function handleClick() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const r = await genererAction({ sessionId });
      if ("error" in r) {
        setError(r.error);
      } else {
        setResult(r.data);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-2)]">
      <div className="flex items-center gap-[var(--space-admin-3)]">
        <button type="button" onClick={handleClick} disabled={isPending} className="admin-button">
          {isPending
            ? "Génération..."
            : hasCreneaux
              ? "Régénérer les créneaux"
              : "Générer les créneaux"}
        </button>
        {hasCreneaux && (
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            (idempotent — les créneaux existants ne seront pas dupliqués)
          </span>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
      {result && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {result.created} créneau(x) créé(s).
        </p>
      )}
    </div>
  );
}

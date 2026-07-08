"use client";
// use-client: case enrichissement IA + feedback + useTransition pour la server action
// genererTousSupportsAction (génère les 7 supports d'un coup).
/**
 * GenererTousSupportsButton — Génère en un clic les 7 types de supports d'une
 * formation (formateur, stagiaire, mémo, guide d'animation, exercices, grille éval…).
 *
 * Les supports sont déterministes (aucun appel IA sauf case « enrichir » cochée) —
 * la génération est donc gratuite par défaut.
 *
 * "use client" : appel Server Action + feedback. Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface GenererTousSupportsButtonProps {
  formationId: string;
  /** Server Action — génère les 7 supports. */
  genererTousAction: (input: {
    formationId: string;
    enrichirIA?: boolean;
  }) => Promise<{ data: unknown } | { error: string }>;
}

export function GenererTousSupportsButton({
  formationId,
  genererTousAction,
}: GenererTousSupportsButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enrichirIA, setEnrichirIA] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  function handleGenerer() {
    setError(null);
    setSucces(null);
    startTransition(async () => {
      const result = await genererTousAction({ formationId, enrichirIA });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSucces("Les 7 supports ont été (re)générés.");
        router.refresh();
      }
    });
  }

  return (
    <div className="mb-[var(--space-admin-5)] flex flex-wrap items-center gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-4)] py-[var(--space-admin-3)]">
      <button type="button" onClick={handleGenerer} disabled={isPending} className="admin-button">
        {isPending ? "Génération…" : "Générer les 7 supports"}
      </button>
      <label className="flex cursor-pointer items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        <input
          type="checkbox"
          checked={enrichirIA}
          onChange={(e) => setEnrichirIA(e.target.checked)}
          disabled={isPending}
          className="accent-[color:var(--color-admin-accent)]"
        />
        Enrichir avec l&apos;IA (sinon gratuit, déterministe)
      </label>

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

"use client";
// use-client: état interactif local (résultat + erreur) + useTransition pour les server actions de supports.
/**
 * GenererSupportButton — Bouton de génération / regénération / suppression
 * d'un support de formation à la charte.
 *
 * Déclenche `genererSupportAction` (nouveau support) ou `regenererSupportAction`
 * (version existante) selon le mode. Propose aussi un bouton « Supprimer » pour
 * les supports archivés / à purger.
 *
 * "use client" : appel Server Action + feedback interactif.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Types (calqués sur les signatures AGENT B)
// ─────────────────────────────────────────────────────────────────────────────

export type SupportTypeValue =
  | "slides_formateur"
  | "slides_stagiaire"
  | "livret_stagiaire"
  | "memo"
  | "guide_animation"
  | "exercices"
  | "grille_eval";

export interface GenererSupportButtonProps {
  formationId: string;
  type: SupportTypeValue;
  /** id du support existant (pour regénérer/supprimer). Absent = génération initiale. */
  supportId?: string | undefined;
  /** Server Action AGENT B — génération initiale. */
  genererAction: (input: {
    formationId: string;
    type: SupportTypeValue;
    enrichirIA?: boolean;
  }) => Promise<{ data: { id: string; pdfUrl: string | null } } | { error: string }>;
  /** Server Action AGENT B — regénération. */
  regenererAction: (input: {
    id: string;
  }) => Promise<{ data: { id: string; pdfUrl: string | null } } | { error: string }>;
  /** Server Action AGENT B — suppression. */
  supprimerAction: (input: { id: string }) => Promise<{ data: { id: string } } | { error: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function GenererSupportButton({
  formationId,
  type,
  supportId,
  genererAction,
  regenererAction,
  supprimerAction,
}: GenererSupportButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enrichirIA, setEnrichirIA] = useState(false);

  function clearFeedback() {
    setError(null);
    setSucces(null);
  }

  function handleGenerer() {
    clearFeedback();
    startTransition(async () => {
      const result = await genererAction({ formationId, type, enrichirIA });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSucces(
          result.data.pdfUrl
            ? "Support généré — PDF disponible."
            : "Support généré (PDF en cours de traitement).",
        );
        router.refresh();
      }
    });
  }

  function handleRegenerer() {
    if (!supportId) return;
    clearFeedback();
    startTransition(async () => {
      const result = await regenererAction({ id: supportId });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSucces("Support regénéré.");
        router.refresh();
      }
    });
  }

  function handleSupprimer() {
    if (!supportId) return;
    clearFeedback();
    startTransition(async () => {
      const result = await supprimerAction({ id: supportId });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSucces("Support supprimé.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-[var(--space-admin-2)]">
      {/* Case enrichissement IA — disponible seulement pour la génération initiale */}
      {!supportId && (
        <label className="flex cursor-pointer items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          <input
            type="checkbox"
            checked={enrichirIA}
            onChange={(e) => setEnrichirIA(e.target.checked)}
            disabled={isPending}
            className="accent-[color:var(--color-admin-accent)]"
          />
          Enrichir avec l&apos;IA
        </label>
      )}

      {/* Bouton principal */}
      {!supportId ? (
        <button type="button" onClick={handleGenerer} disabled={isPending} className="admin-button">
          {isPending ? "Génération…" : "Générer"}
        </button>
      ) : (
        <div className="flex gap-[var(--space-admin-2)]">
          <button
            type="button"
            onClick={handleRegenerer}
            disabled={isPending}
            className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] hover:border-[color:var(--color-admin-accent)] hover:text-[color:var(--color-admin-accent)] disabled:opacity-50"
          >
            {isPending ? "Génération…" : "Regénérer"}
          </button>
          <button
            type="button"
            onClick={handleSupprimer}
            disabled={isPending}
            className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)] hover:border-[color:var(--color-admin-error)] disabled:opacity-50"
          >
            Supprimer
          </button>
        </div>
      )}

      {/* Succès */}
      {succes !== null && (
        <p
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
        >
          {succes}
        </p>
      )}

      {/* Erreur */}
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

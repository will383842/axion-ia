"use client";
// use-client: boutons interactifs (résoudre / marquer lu / synchroniser) via useTransition + Server Actions.
/**
 * AlerteActions — Boutons d'action sur une alerte (mode "item") ou
 * bouton de synchronisation globale (mode "synchroniser").
 *
 * Modes :
 *   - "item"         : affiche « Résoudre » et « Marquer lu » pour une alerte précise.
 *   - "synchroniser" : affiche le bouton « Synchroniser » seul (en-tête de page).
 *
 * "use client" : useTransition + appel Server Actions.
 * Zéro appel DB côté client — toute mutation passe par les Server Actions.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Types des actions (signatures AGENT C)
// ─────────────────────────────────────────────────────────────────────────────

type ActionResult<T> = { data: T } | { error: string };

type ResoudreAction = (input: { id: string }) => Promise<ActionResult<{ id: string }>>;
type MarquerLuAction = (input: { id: string }) => Promise<ActionResult<{ id: string }>>;
type SynchroniserAction = () => Promise<ActionResult<{ crees: number; resolues: number }>>;

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export type AlerteActionsProps =
  | {
      mode: "item";
      alerteId: string;
      lu: boolean;
      resoudreAction?: ResoudreAction;
      marquerLuAction?: MarquerLuAction;
      /** Requis uniquement en mode "synchroniser" mais accepté partout. */
      synchroniserAction: SynchroniserAction;
    }
  | {
      mode: "synchroniser";
      synchroniserAction: SynchroniserAction;
    };

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function AlerteActions(props: AlerteActionsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleResoudre() {
    if (props.mode !== "item") return;
    const resoudreAction = props.resoudreAction;
    if (!resoudreAction) return;

    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await resoudreAction({ id: props.alerteId });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Alerte résolue.");
        router.refresh();
      }
    });
  }

  function handleMarquerLu() {
    if (props.mode !== "item") return;
    const marquerLuAction = props.marquerLuAction;
    if (!marquerLuAction) return;

    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await marquerLuAction({ id: props.alerteId });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Alerte marquée comme lue.");
        router.refresh();
      }
    });
  }

  function handleSynchroniser() {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await props.synchroniserAction();
      if ("error" in result) {
        setError(result.error);
      } else {
        const { crees, resolues } = result.data;
        setSuccessMsg(
          `Synchronisation terminée — ${crees} créée${crees !== 1 ? "s" : ""}, ${resolues} résolue${resolues !== 1 ? "s" : ""}.`,
        );
        router.refresh();
      }
    });
  }

  // ── Rendu mode "item" ─────────────────────────────────────────────────────

  if (props.mode === "item") {
    return (
      <div className="flex flex-col gap-[var(--space-admin-2)]">
        <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
          {props.resoudreAction && (
            <button
              type="button"
              onClick={handleResoudre}
              disabled={isPending}
              className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-success)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-success)] transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {isPending ? "En cours…" : "Résoudre"}
            </button>
          )}
          {props.marquerLuAction && !props.lu && (
            <button
              type="button"
              onClick={handleMarquerLu}
              disabled={isPending}
              className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)] transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {isPending ? "En cours…" : "Marquer lu"}
            </button>
          )}
        </div>
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

  // ── Rendu mode "synchroniser" ─────────────────────────────────────────────

  return (
    <div className="flex flex-col items-end gap-[var(--space-admin-2)]">
      <button
        type="button"
        onClick={handleSynchroniser}
        disabled={isPending}
        className="admin-button"
      >
        {isPending ? "Synchronisation…" : "Synchroniser"}
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

"use client";
// use-client: sélection interactive du formateur principal + assignation/retrait via server action.

/**
 * AssignFormateurForm — assigne (ou retire) le formateur principal d'une session.
 *
 * Le blocage d'habilitation est appliqué côté serveur (assignTrainerToSessionAction
 * → isTrainerHabilite). L'UI signale visuellement les formateurs non habilités et
 * affiche le message d'erreur serveur en cas de refus.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignTrainerToSessionAction } from "@/server/actions/qualiopi/trainers";

export interface AssignFormateurFormProps {
  sessionId: string;
  currentTrainerId: string | null;
  /** Formateurs actifs + indicateur d'habilitation sur la formation de la session. */
  trainers: Array<{ id: string; label: string; habilite: boolean }>;
}

export function AssignFormateurForm({
  sessionId,
  currentTrainerId,
  trainers,
}: AssignFormateurFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>(currentTrainerId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function run(trainerId: string | null) {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const r = await assignTrainerToSessionAction({ sessionId, trainerId });
      if ("error" in r) {
        setError(r.error);
      } else {
        setMsg(trainerId ? "Formateur assigné." : "Formateur retiré.");
        router.refresh();
      }
    });
  }

  const selectCls =
    "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      {trainers.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucun formateur actif. Créez et habilitez un formateur dans « Formateurs ».
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-[var(--space-admin-3)]">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={isPending}
            className={selectCls}
            aria-label="Formateur principal"
          >
            <option value="">— Aucun —</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.habilite ? "" : " (non habilité)"}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isPending || selected === ""}
            className="admin-button"
            onClick={() => run(selected || null)}
          >
            {isPending ? "…" : "Assigner"}
          </button>
          {currentTrainerId && (
            <button
              type="button"
              disabled={isPending}
              className="admin-button"
              onClick={() => {
                setSelected("");
                run(null);
              }}
            >
              Retirer
            </button>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {msg && (
        <p
          role="status"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {msg}
        </p>
      )}
    </div>
  );
}

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
  const [avertissements, setAvertissements] = useState<string[]>([]);

  function run(trainerId: string | null) {
    setError(null);
    setMsg(null);
    setAvertissements([]);
    startTransition(async () => {
      const r = await assignTrainerToSessionAction({ sessionId, trainerId });
      if ("error" in r) {
        setError(r.error);
      } else {
        setMsg(trainerId ? "Formateur assigné." : "Formateur retiré.");
        // L'affectation a réussi : ces manquements documentaires n'ont PAS bloqué
        // (le seuil URSSAF n'est pas tranché juridiquement). Mais les taire
        // reviendrait à envoyer un formateur non conforme chez un client.
        setAvertissements(r.data.avertissements);
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
        // `--color-admin-error` n'existe pas (le jeton s'appelle `-destructive`) :
        // le message d'erreur s'affichait dans la couleur héritée, donc pas en rouge.
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]"
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
      {avertissements.length > 0 && (
        // L'affectation a réussi. Ces manquements ne bloquent pas (le seuil URSSAF
        // n'est pas tranché), mais envoyer un formateur non conforme chez un client
        // engage l'organisme : on les met sous les yeux de l'opérateur.
        <div
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]"
        >
          <p>Formateur assigné, mais sa conformité documentaire est incomplète :</p>
          <ul className="mt-[var(--space-admin-2)] list-disc pl-[var(--space-admin-5)]">
            {avertissements.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

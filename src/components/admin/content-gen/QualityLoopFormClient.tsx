"use client";
// use-client: useState pour capture d'erreur Server Action + startTransition.
// Sprint correctif SP-01 — error UI formulaire quality-loop.

import { useState, useTransition } from "react";
import { AdminFormError } from "@/components/admin/ui/AdminFormError";

interface QualityLoopConfig {
  enabled: boolean;
  minScoreThreshold: number;
  targetScore: number;
  maxAttemptsAuto: number;
  monthlyBudgetCapUsd: number;
}

interface Props {
  cfg: QualityLoopConfig;
  saveAction: (formData: FormData) => Promise<void>;
}

export function QualityLoopFormClient({ cfg, saveAction }: Props): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await saveAction(fd);
      } catch (err: unknown) {
        if (
          err != null &&
          typeof err === "object" &&
          "digest" in err &&
          typeof (err as { digest: unknown }).digest === "string" &&
          (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
        const msg = err instanceof Error ? err.message : "Erreur lors de l'enregistrement.";
        setError(msg);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="admin-field">
        <label className="admin-label">
          <input type="checkbox" name="enabled" defaultChecked={cfg.enabled} /> Boucle activée
        </label>
      </div>
      <div className="admin-filters-grid">
        <div className="admin-field">
          <label htmlFor="minScoreThreshold" className="admin-label">
            Seuil min déclencheur
          </label>
          <input
            id="minScoreThreshold"
            name="minScoreThreshold"
            type="number"
            min="0"
            max="100"
            defaultValue={cfg.minScoreThreshold}
            className="admin-input"
            required
          />
        </div>
        <div className="admin-field">
          <label htmlFor="targetScore" className="admin-label">
            Score cible
          </label>
          <input
            id="targetScore"
            name="targetScore"
            type="number"
            min="0"
            max="100"
            defaultValue={cfg.targetScore}
            className="admin-input"
            required
          />
        </div>
        <div className="admin-field">
          <label htmlFor="maxAttemptsAuto" className="admin-label">
            Passages auto max
          </label>
          <input
            id="maxAttemptsAuto"
            name="maxAttemptsAuto"
            type="number"
            min="0"
            max="5"
            defaultValue={cfg.maxAttemptsAuto}
            className="admin-input"
            required
          />
        </div>
        <div className="admin-field">
          <label htmlFor="monthlyBudgetCapUsd" className="admin-label">
            Budget mensuel boucle (USD)
          </label>
          <input
            id="monthlyBudgetCapUsd"
            name="monthlyBudgetCapUsd"
            type="number"
            step="0.01"
            min="0"
            defaultValue={cfg.monthlyBudgetCapUsd}
            className="admin-input"
            required
          />
        </div>
      </div>
      {error && (
        <div className="mt-[var(--space-admin-3)]">
          <AdminFormError message={error} onDismiss={() => setError(null)} />
        </div>
      )}
      <div className="admin-filters-actions">
        <button type="submit" className="admin-button" disabled={isPending} aria-busy={isPending}>
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

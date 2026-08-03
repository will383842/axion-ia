"use client";
// use-client: useState pour capture d'erreur Server Action + startTransition.
// Sprint correctif SP-01 — error UI formulaires providers.

import { useState, useTransition } from "react";
import { AdminFormError } from "@/components/admin/ui/AdminFormError";

interface ProviderRow {
  id: string;
  provider: string;
  role: string;
  apiKeyEnvVar: string;
  enabled: boolean;
  model: string;
  monthlyCapUsd: number;
  rateLimitRpm: number | null;
  currentMonthSpentUsd: number;
}

interface Props {
  row: ProviderRow;
  saveAction: (formData: FormData) => Promise<void>;
  resetSpendAction: (formData: FormData) => Promise<void>;
}

export function ProviderFormClient({
  row,
  saveAction,
  resetSpendAction,
}: Props): React.ReactElement {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isSavePending, startSaveTransition] = useTransition();
  const [isResetPending, startResetTransition] = useTransition();

  const spent = Number(row.currentMonthSpentUsd);
  const cap = Number(row.monthlyCapUsd);
  const pct = cap > 0 ? Math.round((spent / cap) * 100) : 0;

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaveError(null);
    startSaveTransition(async () => {
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
        setSaveError(msg);
      }
    });
  }

  function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setResetError(null);
    startResetTransition(async () => {
      try {
        await resetSpendAction(fd);
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
        const msg = err instanceof Error ? err.message : "Erreur lors de la réinitialisation.";
        setResetError(msg);
      }
    });
  }

  return (
    <>
      <form onSubmit={handleSave}>
        <input type="hidden" name="id" value={row.id} />
        <h2 className="admin-h2">
          {row.provider} <span className="admin-meta">({row.role})</span>
        </h2>
        <p className="admin-meta-block">
          Clé env : <code>{row.apiKeyEnvVar}</code> · Dépensé ce mois : ${spent.toFixed(2)} / $
          {cap.toFixed(2)} ({pct}%)
        </p>

        <div className="admin-filters-grid">
          <div className="admin-field">
            <label className="admin-label">
              <input type="checkbox" name="enabled" defaultChecked={row.enabled} /> Actif
            </label>
          </div>
          <div className="admin-field">
            <label htmlFor={`model-${row.id}`} className="admin-label">
              Modèle
            </label>
            <input
              id={`model-${row.id}`}
              name="model"
              defaultValue={row.model}
              className="admin-input"
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor={`cap-${row.id}`} className="admin-label">
              Plafond de dépense mensuel (USD)
            </label>
            <input
              id={`cap-${row.id}`}
              name="monthlyCapUsd"
              type="number"
              step="0.01"
              min="0"
              defaultValue={row.monthlyCapUsd}
              className="admin-input"
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor={`rpm-${row.id}`} className="admin-label">
              Limite d&apos;appels par minute
            </label>
            <input
              id={`rpm-${row.id}`}
              name="rateLimitRpm"
              type="number"
              min="1"
              defaultValue={row.rateLimitRpm ?? ""}
              className="admin-input"
            />
          </div>
        </div>

        {saveError && (
          <div className="mt-[var(--space-admin-3)]">
            <AdminFormError message={saveError} onDismiss={() => setSaveError(null)} />
          </div>
        )}

        <div className="admin-filters-actions">
          <button
            type="submit"
            className="admin-button"
            disabled={isSavePending}
            aria-busy={isSavePending}
          >
            {isSavePending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>

        {/* 🔴 UN <details> SANS AUCUN ENFANT : on cliquait, le triangle
            s'ouvrait sur du vide. Le vrai bouton vit dans le formulaire
            suivant, hors de ce repli. Le titre servait donc d'intitulé à une
            section inexistante — on le rend au bouton qu'il annonçait. */}
      </form>
      <form onSubmit={handleReset} className="mt-[var(--space-admin-4)]">
        <p className="admin-meta-small mb-[var(--space-admin-2)]">
          Réinitialiser la dépense mensuelle (fin de cycle)
        </p>
        <input type="hidden" name="id" value={row.id} />
        {resetError && (
          <div className="mb-[var(--space-admin-3)]">
            <AdminFormError message={resetError} onDismiss={() => setResetError(null)} />
          </div>
        )}
        <button
          type="submit"
          className="admin-button-ghost"
          disabled={isResetPending}
          aria-busy={isResetPending}
        >
          {isResetPending ? "Réinitialisation en cours…" : "Réinitialiser la dépense du mois à 0"}
        </button>
      </form>
    </>
  );
}

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

// ─── Formatage FR des montants (audit console 2026-09-02) ───────────────────
// 🔴 « $0.78 / $200.00 (0%) » : format anglo-saxon, et un arrondi à l'entier qui
// affichait « 0 % » pour une dépense réelle. Aucun formateur USD n'existe dans
// `src/lib` (`formatAmount` de `src/content/pricing.ts` est EUR HT, hors sujet) :
// formateur local, espace insécable avant le symbole comme le veut la typographie
// française.
const NBSP = "\u00a0";
const USD_FR_2 = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const USD_FR_COURT = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const PCT_FR_1 = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const PCT_FR_0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** « 0,78 $ » ; en forme courte, « 200 $ » (plafond saisi en entier). */
function formatUsdFr(montant: number, forme: "deux-decimales" | "court" = "deux-decimales") {
  return `${(forme === "court" ? USD_FR_COURT : USD_FR_2).format(montant)}${NBSP}$`;
}

/**
 * Part consommée du plafond : une décimale sous 10 % (« 0,4 % »), entier
 * au-delà (« 37 % »). Une dépense réelle qui arrondirait à zéro est dite
 * « < 0,1 % », jamais « 0,0 % ».
 */
function formatPartPlafondFr(depense: number, plafond: number): string {
  const ratio = (depense / plafond) * 100;
  if (ratio >= 10) return `${PCT_FR_0.format(ratio)}${NBSP}%`;
  if (depense > 0 && ratio < 0.05) return `<${NBSP}0,1${NBSP}%`;
  return `${PCT_FR_1.format(ratio)}${NBSP}%`;
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
  // Sans plafond (0), un ratio n'a pas de sens : « 0,00 $ / 0,00 $ (0 %) »
  // laissait croire à un plafond atteint ou à une dépense nulle plafonnée.
  const depenseMois =
    cap > 0
      ? `${formatUsdFr(spent)} / ${formatUsdFr(cap, "court")} (${formatPartPlafondFr(spent, cap)})`
      : `${formatUsdFr(spent)} · sans plafond`;

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
          Clé env : <code>{row.apiKeyEnvVar}</code> · Dépensé ce mois : {depenseMois}
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

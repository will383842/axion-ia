// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Quality loop V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { updateQualityLoop } from "@/server/actions/content-gen/policies";

interface QualityLoopConfig {
  enabled: boolean;
  minScoreThreshold: number;
  targetScore: number;
  maxAttemptsAuto: number;
  monthlyBudgetCapUsd: number;
}

interface Props {
  cfg: QualityLoopConfig;
}

export function QualityLoopV2({ cfg }: Props): React.ReactElement {
  async function save(formData: FormData) {
    "use server";
    await updateQualityLoop({
      enabled: formData.get("enabled") === "on",
      minScoreThreshold: Number(formData.get("minScoreThreshold") ?? 0),
      targetScore: Number(formData.get("targetScore") ?? 0),
      maxAttemptsAuto: Number(formData.get("maxAttemptsAuto") ?? 0),
      monthlyBudgetCapUsd: Number(formData.get("monthlyBudgetCapUsd") ?? 0),
    });
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Boucle qualité"
        description="Re-prompt automatique des contenus tier-2 sous-score. § 27 master prompt v1.7."
      />

      <AdminCard>
        <form action={save}>
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
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Enregistrer
            </button>
          </div>
        </form>
      </AdminCard>
    </AdminPageShell>
  );
}

// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Search intent distribution V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { updateSearchIntentDistribution } from "@/server/actions/content-gen/policies";

interface IntentConfig {
  informational: number;
  commercial: number;
  local: number;
  transactional: number;
  navigational: number;
}

interface Props {
  cfg: IntentConfig;
}

export function SearchIntentDistributionV2({ cfg }: Props): React.ReactElement {
  async function save(formData: FormData) {
    "use server";
    await updateSearchIntentDistribution({
      informational: Number(formData.get("informational") ?? 0),
      commercial: Number(formData.get("commercial") ?? 0),
      local: Number(formData.get("local") ?? 0),
      transactional: Number(formData.get("transactional") ?? 0),
      navigational: Number(formData.get("navigational") ?? 0),
    });
  }

  const sum = cfg.informational + cfg.commercial + cfg.local + cfg.transactional + cfg.navigational;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Distribution intentions de recherche"
        description={`5 intentions reconnues (§ 26.1). Somme actuelle : ${sum} % (doit être 100).`}
      />

      <AdminCard>
        <form action={save}>
          <div className="admin-filters-grid">
            {(
              [
                ["informational", "Informationnelle", cfg.informational],
                ["commercial", "Commerciale", cfg.commercial],
                ["local", "Locale", cfg.local],
                ["transactional", "Transactionnelle", cfg.transactional],
                ["navigational", "Navigationnelle", cfg.navigational],
              ] as const
            ).map(([key, label, value]) => (
              <div className="admin-field" key={key}>
                <label htmlFor={key} className="admin-label">
                  {label} %
                </label>
                <input
                  id={key}
                  name={key}
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue={value}
                  className="admin-input"
                  required
                />
              </div>
            ))}
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

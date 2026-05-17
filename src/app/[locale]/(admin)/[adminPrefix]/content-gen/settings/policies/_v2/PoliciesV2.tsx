// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Policies settings V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { updatePolicies } from "@/server/actions/content-gen/policies";

interface PoliciesConfig {
  skipVilleIfCopyExists: boolean;
  rssAutoPublishMinScore: number;
  plagiarismJaccardInternal: number;
  plagiarismJaccardRss: number;
  tier3RetentionDays: number;
}

interface Props {
  cfg: PoliciesConfig;
}

export function PoliciesV2({ cfg }: Props): React.ReactElement {
  async function save(formData: FormData) {
    "use server";
    await updatePolicies({
      skipVilleIfCopyExists: formData.get("skipVilleIfCopyExists") === "on",
      rssAutoPublishMinScore: Number(formData.get("rssAutoPublishMinScore") ?? 0),
      plagiarismJaccardInternal: Number(formData.get("plagiarismJaccardInternal") ?? 0),
      plagiarismJaccardRss: Number(formData.get("plagiarismJaccardRss") ?? 0),
      tier3RetentionDays: Number(formData.get("tier3RetentionDays") ?? 0),
    });
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Policies content-gen"
        description="Skip-existing · plagiat seuils · retention tier-3 · RSS auto-publish."
      />

      <AdminCard>
        <form action={save}>
          <div className="admin-field">
            <label className="admin-label">
              <input
                type="checkbox"
                name="skipVilleIfCopyExists"
                defaultChecked={cfg.skipVilleIfCopyExists}
              />{" "}
              Skip ville si copy existe déjà (économise tokens)
            </label>
          </div>

          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="rssAutoPublishMinScore" className="admin-label">
                RSS auto-publish min score
              </label>
              <input
                id="rssAutoPublishMinScore"
                name="rssAutoPublishMinScore"
                type="number"
                min="0"
                max="100"
                defaultValue={cfg.rssAutoPublishMinScore}
                className="admin-input"
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="plagiarismJaccardInternal" className="admin-label">
                Jaccard plagiat interne (0-1)
              </label>
              <input
                id="plagiarismJaccardInternal"
                name="plagiarismJaccardInternal"
                type="number"
                step="0.01"
                min="0"
                max="1"
                defaultValue={cfg.plagiarismJaccardInternal}
                className="admin-input"
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="plagiarismJaccardRss" className="admin-label">
                Jaccard plagiat RSS (0-1)
              </label>
              <input
                id="plagiarismJaccardRss"
                name="plagiarismJaccardRss"
                type="number"
                step="0.01"
                min="0"
                max="1"
                defaultValue={cfg.plagiarismJaccardRss}
                className="admin-input"
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="tier3RetentionDays" className="admin-label">
                Retention tier-3 (jours)
              </label>
              <input
                id="tier3RetentionDays"
                name="tier3RetentionDays"
                type="number"
                min="1"
                max="730"
                defaultValue={cfg.tier3RetentionDays}
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

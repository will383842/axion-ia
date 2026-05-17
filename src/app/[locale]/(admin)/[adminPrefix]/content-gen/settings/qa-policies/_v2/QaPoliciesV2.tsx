// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// QA policies V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { updateQaPolicies } from "@/server/actions/content-gen/policies";

interface QaPoliciesConfig {
  autoCreatePages: boolean;
  minWordsPerAnswer: number;
  promoteTier1MinCtr: number;
}

interface Props {
  cfg: QaPoliciesConfig;
}

export function QaPoliciesV2({ cfg }: Props): React.ReactElement {
  async function save(formData: FormData) {
    "use server";
    await updateQaPolicies({
      autoCreatePages: formData.get("autoCreatePages") === "on",
      minWordsPerAnswer: Number(formData.get("minWordsPerAnswer") ?? 0),
      promoteTier1MinCtr: Number(formData.get("promoteTier1MinCtr") ?? 0),
    });
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Q/R post-process"
        description="Auto-extraction Q/R + pages indexables. § 29 master prompt v1.7."
      />

      <AdminCard>
        <form action={save}>
          <div className="admin-field">
            <label className="admin-label">
              <input type="checkbox" name="autoCreatePages" defaultChecked={cfg.autoCreatePages} />{" "}
              Auto-create pages Q/R indexables après chaque génération
            </label>
          </div>
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="minWordsPerAnswer" className="admin-label">
                Min mots par réponse
              </label>
              <input
                id="minWordsPerAnswer"
                name="minWordsPerAnswer"
                type="number"
                min="10"
                max="500"
                defaultValue={cfg.minWordsPerAnswer}
                className="admin-input"
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="promoteTier1MinCtr" className="admin-label">
                CTR seuil promotion tier-1 (%)
              </label>
              <input
                id="promoteTier1MinCtr"
                name="promoteTier1MinCtr"
                type="number"
                step="0.1"
                min="0"
                max="20"
                defaultValue={cfg.promoteTier1MinCtr}
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

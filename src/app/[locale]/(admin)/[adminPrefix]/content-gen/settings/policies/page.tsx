/**
 * Content Generator — Settings policies (§ 12.5).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPolicies, updatePolicies } from "@/server/actions/content-gen/policies";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function PoliciesSettingsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const cfg = await getPolicies();

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
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Policies content-gen</h1>
          <p className="admin-meta">
            Skip-existing · plagiat seuils · retention tier-3 · RSS auto-publish.
          </p>
        </div>
      </div>

      <form action={save} className="admin-card">
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
    </section>
  );
}

/**
 * Content Generator — Settings quality loop (§ 27 v1.7).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getQualityLoop, updateQualityLoop } from "@/server/actions/content-gen/policies";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { QualityLoopV2 } from "./_v2/QualityLoopV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function QualityLoopSettingsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const cfg = await getQualityLoop();

  if (await isAdminV2Enabled()) {
    return <QualityLoopV2 cfg={cfg} />;
  }

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
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Boucle qualité</h1>
          <p className="admin-meta">
            Re-prompt automatique des contenus tier-2 sous-score. § 27 master prompt v1.7.
          </p>
        </div>
      </div>

      <form action={save} className="admin-card">
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
    </section>
  );
}

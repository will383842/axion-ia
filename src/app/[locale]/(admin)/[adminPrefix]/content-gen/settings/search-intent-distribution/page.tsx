/**
 * Content Generator — Settings distribution intentions de recherche (§ 26).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getSearchIntentDistribution,
  updateSearchIntentDistribution,
} from "@/server/actions/content-gen/policies";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { SearchIntentDistributionV2 } from "./_v2/SearchIntentDistributionV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function SearchIntentDistributionPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const cfg = await getSearchIntentDistribution();

  if (await isAdminV2Enabled()) {
    return <SearchIntentDistributionV2 cfg={cfg} />;
  }

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
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Distribution intentions de recherche</h1>
          <p className="admin-meta">
            5 intentions reconnues (§ 26.1). Somme actuelle : <strong>{sum} %</strong> (doit être
            100).
          </p>
        </div>
      </div>

      <form action={save} className="admin-card">
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
    </section>
  );
}

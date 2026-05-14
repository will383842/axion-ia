/**
 * Content Generator — Orchestrator (§ 12.1 v1.7).
 *
 * Vue globale : campagnes actives, daily plan, quota par pipeline, alertes.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrchestratorStats } from "@/server/actions/content-gen/geo";
import { getBatchSettings } from "@/server/actions/content-gen/policies";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function OrchestratorPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const [stats, batches] = await Promise.all([getOrchestratorStats(), getBatchSettings()]);

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Orchestrateur</h1>
          <p className="admin-meta">
            Vue globale § 12.1 v1.7. Daily batch size config : {batches.dailyBatchSize} ·
            Concurrency : {batches.workersConcurrency}
          </p>
        </div>
      </div>

      <div className="admin-card-grid" style={{ marginBottom: 24 }}>
        <KpiCard label="Campagnes actives" value={stats.activeCampaigns.length} />
        <KpiCard label="Cible cumulée" value={stats.totalActiveTarget} />
        <KpiCard label="Générées (campagnes)" value={stats.totalActiveGenerated} />
        <KpiCard label="Jobs 24 h" value={stats.dailyPlanJobs24h} />
        <KpiCard label="Quota daily configuré" value={batches.dailyBatchSize} />
      </div>

      <div className="admin-card admin-table-wrapper">
        <h2>Campagnes actives</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Scope</th>
              <th>Avancement</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {stats.activeCampaigns.length === 0 ? (
              <tr>
                <td colSpan={5}>Aucune campagne active.</td>
              </tr>
            ) : (
              stats.activeCampaigns.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.scope}</td>
                  <td>
                    {c.generatedCount}/{c.totalTargetCount}
                  </td>
                  <td>{c.status}</td>
                  <td>
                    <a
                      href={`/fr/${adminPrefix}/content-gen/coverage/${c.id}`}
                      className="admin-button-ghost"
                    >
                      Détail
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-card">
        <h2>Pipelines actifs</h2>
        <ul>
          <li>Pipeline 1 — Landing villes directes (✅ Sprint 1+2)</li>
          <li>Pipeline 2 — Actualités RSS (⏳ Sprint 4)</li>
          <li>Pipeline 3 — Campagnes de couverture (✅ Sprint 3 squelette + worker Sprint 4)</li>
        </ul>
      </div>
    </section>
  );
}

function KpiCard({ label, value }: { readonly label: string; readonly value: string | number }) {
  return (
    <div className="admin-card admin-kpi-card">
      <p className="admin-kpi-label">{label}</p>
      <p className="admin-kpi-value">{value}</p>
    </div>
  );
}

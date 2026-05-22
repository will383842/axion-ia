// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Orchestrator V2 — AdminPageShell + AdminPageHeader + AdminCard + AdminStatCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminStatCard } from "@/components/admin/ui";
import { getOrchestratorStats } from "@/server/actions/content-gen/geo";
import { getBatchSettings } from "@/server/actions/content-gen/policies";

interface Props {
  adminPrefix: string;
}

export async function OrchestratorV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const [stats, batches] = await Promise.all([getOrchestratorStats(), getBatchSettings()]);

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Orchestrateur"
        description={`Vue globale § 12.1 v1.7. Daily batch size config : ${batches.dailyBatchSize} · Concurrency : ${batches.workersConcurrency}`}
      />

      <section
        aria-label="KPIs orchestrateur"
        className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-5"
      >
        <AdminStatCard label="Campagnes actives" value={stats.activeCampaigns.length} />
        <AdminStatCard label="Cible cumulée" value={stats.totalActiveTarget} />
        <AdminStatCard label="Générées (campagnes)" value={stats.totalActiveGenerated} />
        <AdminStatCard label="Jobs 24 h" value={stats.dailyPlanJobs24h} />
        <AdminStatCard label="Quota daily configuré" value={batches.dailyBatchSize} />
      </section>

      <AdminCard variant="compact" className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Campagnes actives</h2>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Scope</th>
                <th>Avancement</th>
                <th>Statut</th>
                <th>ETA</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {stats.activeCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-table-empty">
                    Aucune campagne active.
                  </td>
                </tr>
              ) : (
                stats.activeCampaigns.map((c) => {
                  const pct =
                    c.totalTargetCount > 0
                      ? Math.round((c.generatedCount / c.totalTargetCount) * 100)
                      : 0;
                  return (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.scope}</td>
                      <td style={{ minWidth: 160 }}>
                        <div className="flex flex-col gap-[var(--space-admin-1)]">
                          <span className="text-[length:var(--text-admin-xs)] tabular-nums">
                            {c.generatedCount}/{c.totalTargetCount} ({pct}%)
                          </span>
                          <progress
                            value={c.generatedCount}
                            max={c.totalTargetCount}
                            aria-label={`${pct}% généré`}
                            style={{
                              width: "100%",
                              height: 6,
                              accentColor: pct < 33 ? "#b13a2b" : pct < 66 ? "#a8651b" : "#2f7d3a",
                            }}
                          />
                        </div>
                      </td>
                      <td>{c.status}</td>
                      <td>
                        {c.etaDays != null ? (
                          <span className="admin-meta">~{c.etaDays}j</span>
                        ) : (
                          <span className="admin-meta">—</span>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/fr/${adminPrefix}/content-gen/coverage/${c.id}`}
                          className="admin-button-ghost"
                        >
                          Détail
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Pipelines actifs</h2>
        <ul className="admin-meta-block">
          <li>Pipeline 1 — Landing villes directes (✅ Sprint 1+2)</li>
          <li>Pipeline 2 — Actualités RSS (⏳ Sprint 4)</li>
          <li>Pipeline 3 — Campagnes de couverture (✅ Sprint 3 squelette + worker Sprint 4)</li>
        </ul>
      </AdminCard>
    </AdminPageShell>
  );
}

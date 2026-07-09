// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Orchestrator V2 — AdminPageShell + AdminPageHeader + AdminCard + AdminStatCard.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminTable,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { getOrchestratorStats } from "@/server/actions/content-gen/geo";
import { getBatchSettings } from "@/server/actions/content-gen/policies";
import { Layers, Target, CheckCircle2, Clock, Cpu } from "lucide-react";

interface Props {
  adminPrefix: string;
}

type ActiveCampaign = Awaited<ReturnType<typeof getOrchestratorStats>>["activeCampaigns"][number];

export async function OrchestratorV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const [stats, batches] = await Promise.all([getOrchestratorStats(), getBatchSettings()]);

  const campaignColumns: ReadonlyArray<AdminTableColumn<ActiveCampaign>> = [
    { key: "name", header: "Nom", cell: (c) => c.name },
    { key: "scope", header: "Périmètre", cell: (c) => c.scope },
    {
      key: "avancement",
      header: "Avancement",
      cell: (c) => {
        const pct =
          c.totalTargetCount > 0 ? Math.round((c.generatedCount / c.totalTargetCount) * 100) : 0;
        return (
          <div className="flex flex-col gap-[var(--space-admin-1)]" style={{ minWidth: 160 }}>
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
                accentColor:
                  pct < 33
                    ? "var(--color-admin-destructive)"
                    : pct < 66
                      ? "var(--color-admin-warning)"
                      : "var(--color-admin-success)",
              }}
            />
          </div>
        );
      },
    },
    { key: "status", header: "Statut", cell: (c) => c.status },
    {
      key: "eta",
      header: "ETA",
      cell: (c) =>
        c.etaDays != null ? (
          <span className="admin-meta">~{c.etaDays}j</span>
        ) : (
          <span className="admin-meta">—</span>
        ),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Orchestrateur"
        description={`Vue globale § 12.1 v1.7. Concurrency workers : ${batches.workersConcurrency} · Anti-burst : ${batches.antiBurstEnabled ? "on" : "off"}`}
      />

      <section
        aria-label="KPIs orchestrateur"
        className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-5"
      >
        <AdminStatCard
          label="Campagnes actives"
          value={stats.activeCampaigns.length}
          icon={Layers}
        />
        <AdminStatCard label="Cible cumulée" value={stats.totalActiveTarget} icon={Target} />
        <AdminStatCard
          label="Générées (campagnes)"
          value={stats.totalActiveGenerated}
          icon={CheckCircle2}
        />
        <AdminStatCard label="Jobs 24 h" value={stats.dailyPlanJobs24h} icon={Clock} />
        <AdminStatCard
          label="Concurrency workers"
          value={batches.workersConcurrency}
          icon={Cpu}
        />
      </section>

      <AdminCard variant="compact" className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Campagnes actives</h2>
        {stats.activeCampaigns.length === 0 ? (
          <AdminEmptyState title="Aucune campagne active." />
        ) : (
          <AdminTable
            columns={campaignColumns}
            rows={stats.activeCampaigns}
            getRowId={(c) => c.id}
            caption="Liste des campagnes actives"
            rowAction={(c) => (
              <Link
                href={`/fr/${adminPrefix}/content-gen/coverage/${c.id}`}
                className="admin-button-ghost"
              >
                Détail
              </Link>
            )}
          />
        )}
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

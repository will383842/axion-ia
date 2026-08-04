// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Geo cockpit V2 — AdminPageShell + AdminPageHeader + AdminCard + AdminStatCard.
// IMPORTANT : GeoEventsBanner préservé intégralement (contrat SSE inchangé).

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminTable,
  AdminEmptyState,
} from "@/components/admin/ui";
import { VillesTabsNav } from "@/components/admin/content-gen/VillesTabsNav";
import type { AdminTableColumn } from "@/components/admin/ui";
import { GeoEventsBanner } from "@/components/admin/content-gen/GeoEventsBanner";
import { getGlobalGeoStats, listRegionGeoStats } from "@/server/actions/content-gen/geo";
import { MapPin, CheckCircle2, Clock, AlertTriangle, Hourglass, TrendingUp } from "lucide-react";

type RegionRow = Awaited<ReturnType<typeof listRegionGeoStats>>[number];

interface Props {
  adminPrefix: string;
}

export async function GeoCockpitV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const [global, regions] = await Promise.all([getGlobalGeoStats(), listRegionGeoStats()]);

  const base = `/fr/${adminPrefix}/content-gen/geo`;
  const totalPublished = regions.reduce((a, r) => a + r.publishedJobs, 0);

  const regionColumns: ReadonlyArray<AdminTableColumn<RegionRow>> = [
    { key: "region", header: "Région", cell: (r) => r.name },
    { key: "phase", header: "Phase", cell: (r) => r.publicationPhase },
    { key: "published", header: "Publié", cell: (r) => r.publishedJobs },
    { key: "running", header: "En cours", cell: (r) => r.runningJobs },
    { key: "failed", header: "Échecs", cell: (r) => r.failedJobs },
    { key: "review", header: "Revue", cell: (r) => r.pendingReviewJobs },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Cockpit géographique"
        description={`${regions.length} région${regions.length > 1 ? "s" : ""} · ${totalPublished} contenu${totalPublished > 1 ? "s" : ""} publié${totalPublished > 1 ? "s" : ""} · vélocité 7 j : ${global.velocity7dJobs}`}
        actions={
          <div className="flex gap-[var(--space-admin-3)]">
            <Link href={`${base}/batches/new`} className="admin-button">
              + Nouveau lot
            </Link>
            <Link href={`${base}/batches`} className="admin-button-ghost">
              Lots
            </Link>
            <Link href={`${base}/history`} className="admin-button-ghost">
              Historique
            </Link>
          </div>
        }
      />
      <VillesTabsNav adminPrefix={adminPrefix} current="regions" />

      <GeoEventsBanner />

      <section
        aria-label="KPIs géo"
        className="mb-[var(--space-admin-6)] grid grid-cols-2 gap-[var(--space-admin-4)] md:grid-cols-3 lg:grid-cols-6"
      >
        <AdminStatCard
          label="Régions actives"
          value={regions.filter((r) => r.publicationPhase === 1).length}
          icon={MapPin}
        />
        <AdminStatCard label="Publiés total" value={global.publishedJobs} icon={CheckCircle2} />
        <AdminStatCard label="En cours" value={global.runningJobs} icon={Clock} />
        <AdminStatCard
          label="Échecs"
          value={global.failedJobs}
          tone={global.failedJobs > 0 ? "warning" : "default"}
          icon={AlertTriangle}
        />
        <AdminStatCard label="En revue" value={global.pendingReviewJobs} icon={Hourglass} />
        <AdminStatCard label="Vélocité 7 j" value={global.velocity7dJobs} icon={TrendingUp} />
      </section>

      <AdminCard variant="compact" className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Progression par région</h2>
        {regions.length === 0 ? (
          <AdminEmptyState title="Aucune région." />
        ) : (
          <AdminTable
            columns={regionColumns}
            rows={regions}
            getRowId={(r) => r.slug}
            caption="Progression par région"
            rowAction={(r) => (
              <Link href={`${base}/batches/new?region=${r.slug}`} className="admin-button-ghost">
                Batch
              </Link>
            )}
          />
        )}
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Carte interactive</h2>
        <p className="admin-meta-block">
          Une carte de France cliquable viendra compléter le tableau ci-dessus. Elle n’est pas
          encore disponible.
        </p>
      </AdminCard>
    </AdminPageShell>
  );
}

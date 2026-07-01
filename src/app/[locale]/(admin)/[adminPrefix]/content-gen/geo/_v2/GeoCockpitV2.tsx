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
import type { AdminTableColumn } from "@/components/admin/ui";
import { GeoEventsBanner } from "@/components/admin/content-gen/GeoEventsBanner";
import { getGlobalGeoStats, listRegionGeoStats } from "@/server/actions/content-gen/geo";

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
        description={`13 régions métropole · ${totalPublished} contenu${totalPublished > 1 ? "s" : ""} publié${totalPublished > 1 ? "s" : ""} · vélocité 7 j : ${global.velocity7dJobs}`}
        actions={
          <div className="flex gap-[var(--space-admin-3)]">
            <Link href={`${base}/batches/new`} className="admin-button">
              + Nouveau batch
            </Link>
            <Link href={`${base}/batches`} className="admin-button-ghost">
              Batches
            </Link>
            <Link href={`${base}/history`} className="admin-button-ghost">
              Historique
            </Link>
          </div>
        }
      />

      <GeoEventsBanner />

      <section
        aria-label="KPIs géo"
        className="mb-[var(--space-admin-6)] grid grid-cols-2 gap-[var(--space-admin-4)] md:grid-cols-3 lg:grid-cols-6"
      >
        <AdminStatCard
          label="Régions actives"
          value={regions.filter((r) => r.publicationPhase === 1).length}
        />
        <AdminStatCard label="Publiés total" value={global.publishedJobs} />
        <AdminStatCard label="En cours" value={global.runningJobs} />
        <AdminStatCard
          label="Échecs"
          value={global.failedJobs}
          tone={global.failedJobs > 0 ? "warning" : "default"}
        />
        <AdminStatCard label="En revue" value={global.pendingReviewJobs} />
        <AdminStatCard label="Vélocité 7 j" value={global.velocity7dJobs} />
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
          La carte React `react-simple-maps` + SSE temps réel arrive Sprint 4 (composant lourd, ~50
          KB gz). V1 = table ci-dessus.
        </p>
      </AdminCard>
    </AdminPageShell>
  );
}

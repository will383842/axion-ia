/**
 * Content Generator — Cockpit géographique (§ 15).
 *
 * V1 = vue par région (13) + KPIs globaux. La carte React `react-simple-maps`
 * + SSE temps réel arrive Sprint 4 (composant lourd, lazy). V1 = table HTML
 * compacte + progress bars CSS.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getGlobalGeoStats, listRegionGeoStats } from "@/server/actions/content-gen/geo";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function GeoCockpitPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const [global, regions] = await Promise.all([getGlobalGeoStats(), listRegionGeoStats()]);

  const base = `/fr/${adminPrefix}/content-gen/geo`;
  const totalPublished = regions.reduce((a, r) => a + r.publishedJobs, 0);

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Cockpit géographique</h1>
          <p className="admin-meta">
            13 régions métropole · {totalPublished} contenu{totalPublished > 1 ? "s" : ""} publié
            {totalPublished > 1 ? "s" : ""} · vélocité 7 j : {global.velocity7dJobs}
          </p>
        </div>
        <div className="admin-dashboard-actions">
          <a href={`${base}/batches/new`} className="admin-button">
            + Nouveau batch
          </a>
          <a href={`${base}/batches`} className="admin-button-ghost">
            Batches
          </a>
          <a href={`${base}/history`} className="admin-button-ghost">
            Historique
          </a>
        </div>
      </div>

      <div className="admin-card-grid" style={{ marginBottom: 24 }}>
        <KpiCard
          label="Régions actives"
          value={regions.filter((r) => r.publicationPhase === 1).length}
        />
        <KpiCard label="Publiés total" value={global.publishedJobs} />
        <KpiCard label="En cours" value={global.runningJobs} />
        <KpiCard
          label="Failed"
          value={global.failedJobs}
          tone={global.failedJobs > 0 ? "warn" : undefined}
        />
        <KpiCard label="En revue" value={global.pendingReviewJobs} />
        <KpiCard label="Vélocité 7 j" value={global.velocity7dJobs} />
      </div>

      <div className="admin-card admin-table-wrapper">
        <h2>Progression par région</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Région</th>
              <th>Phase</th>
              <th>Publié</th>
              <th>En cours</th>
              <th>Failed</th>
              <th>Review</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((r) => (
              <tr key={r.slug}>
                <td>{r.name}</td>
                <td>{r.publicationPhase}</td>
                <td>{r.publishedJobs}</td>
                <td>{r.runningJobs}</td>
                <td>{r.failedJobs}</td>
                <td>{r.pendingReviewJobs}</td>
                <td>
                  <a href={`${base}/batches/new?region=${r.slug}`} className="admin-button-ghost">
                    Batch
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-card">
        <h2>Carte interactive</h2>
        <p>
          La carte React `react-simple-maps` + SSE temps réel arrive Sprint 4 (composant lourd, ~50
          KB gz). V1 = table ci-dessus.
        </p>
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly tone?: "warn" | undefined;
}) {
  return (
    <div
      className="admin-card admin-kpi-card"
      style={tone === "warn" ? { borderColor: "var(--color-terracotta)" } : undefined}
    >
      <p className="admin-kpi-label">{label}</p>
      <p className="admin-kpi-value">{value}</p>
    </div>
  );
}

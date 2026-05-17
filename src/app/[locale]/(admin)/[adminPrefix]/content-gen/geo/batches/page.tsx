/**
 * Content Generator — Geo batches list (§ 15.3).
 *
 * V1 = campagnes type `scope=region` ou `scope=departement` filtrées.
 * Une table batch dédiée arrive Sprint 4 si volume justifie.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { GeoBatchesV2 } from "./_v2/GeoBatchesV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function GeoBatchesPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <GeoBatchesV2 adminPrefix={adminPrefix} />;
  }

  const batches = await prisma.coverageCampaign.findMany({
    where: { scope: { in: ["region", "departement", "multi"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const base = `/fr/${adminPrefix}/content-gen/geo/batches`;

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Batches géographiques</h1>
          <p className="admin-meta">
            {batches.length} batch{batches.length > 1 ? "es" : ""} (scope région/dépt/multi)
          </p>
        </div>
        <a href={`${base}/new`} className="admin-button">
          + Nouveau batch
        </a>
      </div>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Nom</th>
              <th>Scope</th>
              <th>Cible</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td colSpan={6}>Aucun batch — créez-en un.</td>
              </tr>
            ) : (
              batches.map((b) => (
                <tr key={b.id}>
                  <td>{b.createdAt.toISOString().slice(0, 10)}</td>
                  <td>
                    <a href={`${base}/${b.id}`}>{b.name}</a>
                  </td>
                  <td>{b.scope}</td>
                  <td>{b.totalTargetCount}</td>
                  <td>{b.status}</td>
                  <td>
                    <a
                      href={`/fr/${adminPrefix}/content-gen/coverage/${b.id}`}
                      className="admin-button-ghost"
                    >
                      Voir détail
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

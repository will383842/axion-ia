/**
 * Content Generator — Geo history (§ 15.5).
 *
 * Journal des batches passés. V1 lit ContentGenJob agrégé par jour.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { GeoHistoryV2 } from "./_v2/GeoHistoryV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function GeoHistoryPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <GeoHistoryV2 adminPrefix={adminPrefix} />;
  }

  const recentCampaigns = await prisma.coverageCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Historique géo</h1>
          <p className="admin-meta">
            {recentCampaigns.length} campagne{recentCampaigns.length > 1 ? "s" : ""} récente
            {recentCampaigns.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Nom</th>
              <th>Scope</th>
              <th>Cible</th>
              <th>Gen/Pub/Fail</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {recentCampaigns.length === 0 ? (
              <tr>
                <td colSpan={6}>Aucune campagne — historique vide.</td>
              </tr>
            ) : (
              recentCampaigns.map((c) => (
                <tr key={c.id}>
                  <td>{c.createdAt.toISOString().slice(0, 10)}</td>
                  <td>
                    <a href={`/fr/${adminPrefix}/content-gen/coverage/${c.id}`}>{c.name}</a>
                  </td>
                  <td>{c.scope}</td>
                  <td>{c.totalTargetCount}</td>
                  <td>
                    {c.generatedCount} / {c.publishedCount} / {c.failedCount}
                  </td>
                  <td>{c.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

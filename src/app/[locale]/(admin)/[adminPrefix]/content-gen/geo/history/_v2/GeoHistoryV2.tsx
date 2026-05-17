// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Geo history V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

interface Props {
  adminPrefix: string;
}

export async function GeoHistoryV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const recentCampaigns = await prisma.coverageCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Historique géo"
        description={`${recentCampaigns.length} campagne${recentCampaigns.length > 1 ? "s" : ""} récente${recentCampaigns.length > 1 ? "s" : ""}`}
      />

      <AdminCard variant="compact">
        <div className="admin-table-wrapper">
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
                  <td colSpan={6} className="admin-table-empty">
                    Aucune campagne — historique vide.
                  </td>
                </tr>
              ) : (
                recentCampaigns.map((c) => (
                  <tr key={c.id}>
                    <td>{c.createdAt.toISOString().slice(0, 10)}</td>
                    <td>
                      <Link
                        href={`/fr/${adminPrefix}/content-gen/coverage/${c.id}`}
                        className="admin-link"
                      >
                        {c.name}
                      </Link>
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
      </AdminCard>
    </AdminPageShell>
  );
}

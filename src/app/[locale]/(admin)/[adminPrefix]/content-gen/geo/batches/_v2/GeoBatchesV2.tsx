// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Geo batches list V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

interface Props {
  adminPrefix: string;
}

export async function GeoBatchesV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const batches = await prisma.coverageCampaign.findMany({
    where: { scope: { in: ["region", "departement", "multi"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const base = `/fr/${adminPrefix}/content-gen/geo/batches`;

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Batches géographiques"
        description={`${batches.length} batch${batches.length > 1 ? "es" : ""} (scope région/dépt/multi)`}
        actions={
          <Link href={`${base}/new`} className="admin-button">
            + Nouveau batch
          </Link>
        }
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
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-table-empty">
                    Aucun batch — créez-en un.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id}>
                    <td>{b.createdAt.toISOString().slice(0, 10)}</td>
                    <td>
                      <Link href={`${base}/${b.id}`} className="admin-link">
                        {b.name}
                      </Link>
                    </td>
                    <td>{b.scope}</td>
                    <td>{b.totalTargetCount}</td>
                    <td>{b.status}</td>
                    <td>
                      <Link
                        href={`/fr/${adminPrefix}/content-gen/coverage/${b.id}`}
                        className="admin-button-ghost"
                      >
                        Voir détail
                      </Link>
                    </td>
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

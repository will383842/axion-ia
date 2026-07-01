// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Geo batches list V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badge statut → <AdminBadge>.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

interface Props {
  adminPrefix: string;
}

// Track 2 : tonalité du badge dérivée du statut de batch.
const STATUS_TONE: Record<string, "success" | "warning" | "destructive" | "neutral"> = {
  done: "success",
  completed: "success",
  running: "warning",
  pending: "warning",
  active: "warning",
  failed: "destructive",
  cancelled: "neutral",
};

type BatchRow = Awaited<ReturnType<typeof prisma.coverageCampaign.findMany>>[number];

export async function GeoBatchesV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const batches = await prisma.coverageCampaign.findMany({
    where: { scope: { in: ["region", "departement", "multi"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const base = `/fr/${adminPrefix}/content-gen/geo/batches`;

  const columns: ReadonlyArray<AdminTableColumn<BatchRow>> = [
    { key: "date", header: "Date", cell: (b) => b.createdAt.toISOString().slice(0, 10) },
    {
      key: "name",
      header: "Nom",
      cell: (b) => (
        <Link href={`${base}/${b.id}`} className="admin-link">
          {b.name}
        </Link>
      ),
    },
    { key: "scope", header: "Périmètre", cell: (b) => b.scope },
    { key: "target", header: "Cible", cell: (b) => b.totalTargetCount },
    {
      key: "status",
      header: "Statut",
      cell: (b) => <AdminBadge tone={STATUS_TONE[b.status] ?? "neutral"}>{b.status}</AdminBadge>,
    },
  ];

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

      {batches.length === 0 ? (
        <AdminEmptyState title="Aucun batch — créez-en un." />
      ) : (
        <AdminTable
          columns={columns}
          rows={batches}
          getRowId={(b) => b.id}
          caption="Liste des batches géographiques"
          rowAction={(b) => (
            <Link
              href={`/fr/${adminPrefix}/content-gen/coverage/${b.id}`}
              className="admin-button-ghost"
            >
              Voir détail
            </Link>
          )}
        />
      )}
    </AdminPageShell>
  );
}

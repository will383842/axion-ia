// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Geo history V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminTable,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

interface Props {
  adminPrefix: string;
}

export async function GeoHistoryV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const recentCampaigns = await prisma.coverageCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  type Campaign = (typeof recentCampaigns)[number];

  const columns: ReadonlyArray<AdminTableColumn<Campaign>> = [
    { key: "date", header: "Date", cell: (c) => c.createdAt.toISOString().slice(0, 10) },
    {
      key: "name",
      header: "Nom",
      cell: (c) => (
        <Link href={`/fr/${adminPrefix}/content-gen/coverage/${c.id}`} className="admin-link">
          {c.name}
        </Link>
      ),
    },
    { key: "scope", header: "Périmètre", cell: (c) => c.scope },
    { key: "target", header: "Cible", cell: (c) => c.totalTargetCount },
    {
      key: "genpubfail",
      header: "Gén/Pub/Échec",
      cell: (c) => `${c.generatedCount} / ${c.publishedCount} / ${c.failedCount}`,
    },
    { key: "status", header: "Statut", cell: (c) => c.status },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Historique géo"
        description={`${recentCampaigns.length} campagne${recentCampaigns.length > 1 ? "s" : ""} récente${recentCampaigns.length > 1 ? "s" : ""}`}
      />

      {recentCampaigns.length === 0 ? (
        <AdminEmptyState title="Aucune campagne — historique vide." />
      ) : (
        <AdminTable
          columns={columns}
          rows={recentCampaigns}
          getRowId={(c) => c.id}
          caption="Historique des campagnes géo récentes"
        />
      )}
    </AdminPageShell>
  );
}

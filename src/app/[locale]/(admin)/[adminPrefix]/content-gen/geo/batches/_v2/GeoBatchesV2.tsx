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
import { formatDateFrShort } from "@/lib/format-date-fr";
import {
  perimetreCampagneLabelFr,
  statutCampagneLabelFr,
  statutCampagneTone,
} from "@/server/content-gen/shared/campaign-labels";

interface Props {
  adminPrefix: string;
}

// 🔴 Cette liste portait sa PROPRE table de statuts (pending / done / active…),
// dont aucune valeur n'existe dans l'enum `CoverageStatus` réel, et qui
// ignorait `draft` : un lot fraîchement créé s'affichait « DRAFT », et son
// périmètre « multi ». Les libellés viennent désormais de la même source que
// la liste des campagnes (typée sur l'enum, exhaustive à la compilation).

type BatchRow = Awaited<ReturnType<typeof prisma.coverageCampaign.findMany>>[number];

export async function GeoBatchesV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const batches = await prisma.coverageCampaign.findMany({
    where: { scope: { in: ["region", "departement", "multi"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const base = `/fr/${adminPrefix}/content-gen/geo/batches`;

  const columns: ReadonlyArray<AdminTableColumn<BatchRow>> = [
    { key: "date", header: "Date", cell: (b) => formatDateFrShort(b.createdAt) },
    {
      key: "name",
      header: "Nom",
      cell: (b) => (
        <Link href={`${base}/${b.id}`} className="admin-link">
          {b.name}
        </Link>
      ),
    },
    { key: "scope", header: "Périmètre", cell: (b) => perimetreCampagneLabelFr(b.scope) },
    { key: "target", header: "Cible", cell: (b) => b.totalTargetCount },
    {
      key: "status",
      header: "Statut",
      cell: (b) => (
        <AdminBadge tone={statutCampagneTone(b.status)}>
          {statutCampagneLabelFr(b.status)}
        </AdminBadge>
      ),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Lots géographiques"
        // Le compteur est plafonné par la requête (take: 50) : au-delà, il
        // annoncerait « 50 » quel que soit le nombre réel de lots.
        description={
          batches.length === 50
            ? "Les 50 lots les plus récents — par région, département ou zone multiple"
            : `${batches.length} lot${batches.length > 1 ? "s" : ""} — par région, département ou zone multiple`
        }
        actions={
          <Link href={`${base}/new`} className="admin-button">
            + Nouveau lot
          </Link>
        }
      />

      {batches.length === 0 ? (
        <AdminEmptyState title="Aucun lot — créez-en un." />
      ) : (
        <AdminTable
          columns={columns}
          rows={batches}
          getRowId={(b) => b.id}
          caption="Liste des lots géographiques"
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

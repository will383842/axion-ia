// Contacts admin — onglet « RV téléphonique » : liste unifiée des rendez-vous.
// V1 = Calendly (source active). Détail → page Calendly existante.

import { listRendezVous } from "@/features/admin-rendezvous/queries";
import { RDV_STATUS_LABELS, type RdvFilters } from "@/features/admin-rendezvous/types";
import { timeInParis } from "@/lib/calendar-grid";
import { AdminListScaffold } from "../../_v2/AdminListScaffold";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function RendezVousPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const page = sp["page"] ? parseInt(sp["page"], 10) : 1;
  const pageSize = 25;

  const { rows, total } = await listRendezVous({
    page,
    pageSize,
    ...(sp["status"] ? { status: sp["status"] as NonNullable<RdvFilters["status"]> } : {}),
    ...(sp["q"] ? { q: sp["q"] } : {}),
    ...(sp["from"] ? { from: sp["from"] } : {}),
    ...(sp["to"] ? { to: sp["to"] } : {}),
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const base = `/fr/${adminPrefix}/contacts/rendez-vous`;

  const scaffoldRows = rows.map((r) => ({
    id: r.key,
    detailHref: r.detailHref,
    cells: [
      <span key="dt">
        {r.dayKey}
        {r.timeConfirmed && r.startTime ? (
          ` · ${timeInParis(r.startTime)}`
        ) : (
          <span className="text-[color:var(--color-admin-fg-muted)]"> · heure ?</span>
        )}
      </span>,
      r.title,
      r.contactName ?? "—",
      r.contactEmail ?? "—",
      RDV_STATUS_LABELS[r.status],
    ] as React.ReactNode[],
  }));

  return (
    <AdminListScaffold
      title="RV téléphonique"
      itemLabel="rendez-vous"
      total={total}
      page={page}
      totalPages={totalPages}
      columnHeaders={["Date / heure", "Type", "Contact", "Email", "Statut"]}
      rows={scaffoldRows}
      rowClickable
      paginationBaseHref={base}
      paginationPreservedParams={{
        status: sp["status"],
        q: sp["q"],
        from: sp["from"],
        to: sp["to"],
      }}
    />
  );
}

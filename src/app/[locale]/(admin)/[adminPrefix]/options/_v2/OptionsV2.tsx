// Refonte admin mai 2026 — PR 6 — options 48h V2.

import { listOptionsAction } from "@/features/admin-options/actions";
import { AdminFilterTabs, AdminStatusBadge } from "@/components/admin/ui";
import { interventionTypeLabel } from "@/lib/intervention-label";
import { AdminListScaffold } from "../../_v2/AdminListScaffold";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  refused: "Refusée",
  expired: "Expirée",
  converted: "Validée → réservation",
};

function formatExpiry(expiresAt: Date, status: string): string {
  if (status !== "pending") return "—";
  const now = Date.now();
  const diffMs = expiresAt.getTime() - now;
  if (diffMs <= 0) return "Expirée à l'instant";
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 24) return `Dans ${Math.floor(hours / 24)}j ${hours % 24}h`;
  return `Dans ${hours}h ${minutes}min`;
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
}

export async function OptionsV2({ adminPrefix, searchParams }: Props): Promise<React.ReactElement> {
  const status = searchParams["status"];
  const page = searchParams["page"] ? parseInt(searchParams["page"], 10) : 1;
  const result = await listOptionsAction({
    status: status as never,
    page,
  });

  const base = `/fr/${adminPrefix}/options`;
  const statusOptions = [
    { value: "all", label: "Toutes", href: base },
    ...(["pending", "confirmed", "refused", "expired", "converted"] as const).map((s) => ({
      value: s,
      label: STATUS_LABELS[s] ?? s,
      href: `${base}?status=${s}`,
    })),
  ];

  const rows = result.items.map((o) => ({
    id: o.id,
    cells: [
      o.slotDate.toISOString().slice(0, 10),
      <span key="company" className="block">
        <div>{o.companyName}</div>
        <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {o.companySector}
        </div>
      </span>,
      <span key="contact" className="block">
        <div>{o.contactName}</div>
        <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {o.contactEmail}
        </div>
      </span>,
      interventionTypeLabel(o.interventionType),
      String(o.participantsCount),
      <AdminStatusBadge
        key="status"
        type="booking"
        status={o.status}
        label={STATUS_LABELS[o.status] ?? o.status}
      />,
      formatExpiry(o.expiresAt, o.status),
    ],
  }));

  return (
    <AdminListScaffold
      title="Options 48h"
      itemLabel="option(s)"
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      filters={<AdminFilterTabs current={status ?? "all"} options={statusOptions} label="Statut" />}
      columnHeaders={[
        "Date créneau",
        "Société",
        "Contact",
        "Intervention",
        "Participants",
        "Statut",
        "Échéance",
      ]}
      rows={rows}
      paginationBaseHref={base}
      {...(status ? { paginationPreservedParams: { status } } : {})}
    />
  );
}

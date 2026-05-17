// Refonte admin mai 2026 — PR 6 — submissions V2.

import Link from "next/link";
import { listSubmissionsAction } from "@/features/admin-submissions/actions";
import { SubmissionFilters } from "../SubmissionFilters";
import { AdminPageShell, AdminPageHeader, AdminStatusBadge } from "@/components/admin/ui";
import { AdminListScaffold } from "../../_v2/AdminListScaffold";

const TYPE_LABELS: Record<string, string> = {
  audit: "Audit",
  implementation: "Implémentation",
  intervention: "Intervention",
  contact: "Contact",
};
const STATUS_LABELS: Record<string, string> = {
  new: "Nouveau",
  in_progress: "En cours",
  processed: "Traité",
  archived: "Archivé",
};

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
}

export async function SubmissionsV2({
  adminPrefix,
  searchParams,
}: Props): Promise<React.ReactElement> {
  const result = await listSubmissionsAction({
    type: searchParams["type"] as never,
    status: searchParams["status"] as never,
    locale: searchParams["locale"] as never,
    search: searchParams["search"],
    dateFrom: searchParams["dateFrom"],
    dateTo: searchParams["dateTo"],
    page: searchParams["page"] ? parseInt(searchParams["page"], 10) : 1,
    pageSize: 25,
  });

  const csvUrl = `/api/admin/submissions/export?${new URLSearchParams({
    ...(searchParams["type"] ? { type: searchParams["type"] } : {}),
    ...(searchParams["status"] ? { status: searchParams["status"] } : {}),
    ...(searchParams["locale"] ? { locale: searchParams["locale"] } : {}),
  }).toString()}`;

  const base = `/fr/${adminPrefix}/submissions`;
  const rows = result.items.map((s) => ({
    id: s.id,
    detailHref: `${base}/${s.id}`,
    cells: [
      s.submittedAt.toISOString().slice(0, 10),
      TYPE_LABELS[s.type] ?? s.type,
      <AdminStatusBadge
        key="status"
        type="image-asset"
        status={s.status}
        label={STATUS_LABELS[s.status] ?? s.status}
      />,
      s.companyName,
      <span key="contact" className="block">
        <div>{s.contactName}</div>
        <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {s.contactEmail}
        </div>
      </span>,
      s.locale.toUpperCase(),
    ],
  }));

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Soumissions"
        description={`${result.total} soumission${result.total > 1 ? "s" : ""} · page ${result.page}/${result.totalPages}`}
        actions={
          <Link href={csvUrl} className="admin-button-ghost" download>
            Exporter CSV
          </Link>
        }
      />
      <div className="mb-[var(--space-admin-6)]">
        <SubmissionFilters initial={searchParams} />
      </div>
      <AdminListScaffold
        title=""
        itemLabel="soumission(s)"
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        columnHeaders={["Date", "Type", "Statut", "Société", "Contact", "Locale"]}
        rows={rows}
        paginationBaseHref={base}
        paginationPreservedParams={{
          type: searchParams["type"],
          status: searchParams["status"],
          locale: searchParams["locale"],
          search: searchParams["search"],
          dateFrom: searchParams["dateFrom"],
          dateTo: searchParams["dateTo"],
        }}
      />
    </AdminPageShell>
  );
}

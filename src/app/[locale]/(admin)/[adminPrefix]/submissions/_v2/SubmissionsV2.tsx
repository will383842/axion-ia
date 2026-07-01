// Refonte admin mai 2026 — PR 6 — submissions V2.
// Sprint Notif Infra 2026-05-26 / fix P1-2 audit 2026-05-27 — colonne "Réponse"
// avec badges Sans réponse / Répondu (N) / Échec / Archivé.

import Link from "next/link";
import type { SubmissionListItem } from "@/features/admin-submissions/actions";
import { listSubmissionsAction } from "@/features/admin-submissions/actions";
import { SubmissionFilters } from "../SubmissionFilters";
import { AdminPageShell, AdminPageHeader, AdminStatusBadge } from "@/components/admin/ui";
import { AdminListScaffold } from "../../_v2/AdminListScaffold";
import { resolveSubmissionLabel } from "./submission-type-labels";
const STATUS_LABELS: Record<string, string> = {
  new: "Nouveau",
  in_progress: "En cours",
  processed: "Traité",
  archived: "Archivé",
};

/**
 * Computed reply badge — derives 4 visual states from SubmissionListItem :
 *  - "unanswered"  : aucune reply envoyée + status=new/in_progress + non archivé
 *  - "answered"    : ≥1 reply envoyée (replyCount > 0)
 *  - "failed"      : dernière reply en deliveryStatus failed/bounced
 *  - "archived"    : Submission archivée (archivedAt non null)
 */
function replyBadge(s: SubmissionListItem): { label: string; tone: string; emoji: string } {
  if (s.archivedAt) return { label: "Archivé", tone: "muted", emoji: "🗄️" };
  if (s.lastReplyStatus === "failed" || s.lastReplyStatus === "bounced") {
    return { label: "Échec envoi", tone: "warning", emoji: "⚠️" };
  }
  if (s.replyCount > 0) {
    return {
      label: `Répondu (${s.replyCount})`,
      tone: "success",
      emoji: "🟢",
    };
  }
  return { label: "Sans réponse", tone: "danger", emoji: "🔴" };
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  /**
   * Chemin canonique du listing pour construire les liens détail. Défaut
   * `/submissions` (legacy redirect) ; passer `/contacts/messages` quand la
   * route canonique est utilisée (cf. fix P0-1 audit 2026-05-27).
   */
  basePath?: "submissions" | "contacts/messages" | "contacts/commercial";
}

export async function SubmissionsV2({
  adminPrefix,
  searchParams,
  basePath = "submissions",
}: Props): Promise<React.ReactElement> {
  const includeArchived = searchParams["includeArchived"] === "true";
  const result = await listSubmissionsAction({
    type: searchParams["type"] as never,
    unifiedType: searchParams["unifiedType"],
    status: searchParams["status"] as never,
    locale: searchParams["locale"] as never,
    search: searchParams["search"],
    dateFrom: searchParams["dateFrom"],
    dateTo: searchParams["dateTo"],
    page: searchParams["page"] ? parseInt(searchParams["page"], 10) : 1,
    pageSize: 25,
    includeArchived,
  });

  const csvUrl = `/api/admin/submissions/export?${new URLSearchParams({
    ...(searchParams["type"] ? { type: searchParams["type"] } : {}),
    ...(searchParams["status"] ? { status: searchParams["status"] } : {}),
    ...(searchParams["locale"] ? { locale: searchParams["locale"] } : {}),
  }).toString()}`;

  const base = `/fr/${adminPrefix}/${basePath}`;
  const rows = result.items.map((s) => {
    const r = replyBadge(s);
    return {
      id: s.id,
      detailHref: `${base}/${s.id}`,
      cells: [
        s.submittedAt.toISOString().slice(0, 10),
        resolveSubmissionLabel(s.type, s.unifiedType),
        <span
          key="reply"
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[length:var(--text-admin-xs)] font-medium admin-badge-${r.tone}`}
          title={r.label}
        >
          <span aria-hidden="true">{r.emoji}</span>
          {r.label}
        </span>,
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
    };
  });

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
        columnHeaders={["Date", "Type", "Réponse", "Statut", "Société", "Contact", "Langue"]}
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

// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Review queue list V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badge statut → <AdminBadge>. Le formulaire de filtres garde les classes
// utilitaires admin.css (legit — pas de composant filtre dédié).

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import {
  approveReview,
  listReviewPaginated,
  rejectReview,
} from "@/server/actions/content-gen/review";
import { SubmitButton } from "@/components/admin/content-gen/SubmitButton";
import type { ReviewStatus } from "../../../../../../../../prisma/generated/client";

const STATUSES: ReadonlyArray<ReviewStatus> = [
  "pending",
  "approved",
  "rejected",
  "needs_edits",
  "promoted_t1",
];

// Track 2 : tonalité du badge dérivée du statut de review.
const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "destructive"> = {
  approved: "success",
  promoted_t1: "success",
  pending: "warning",
  needs_edits: "warning",
  rejected: "destructive",
};

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
}

export async function ReviewQueueListV2({
  adminPrefix,
  searchParams: sp,
}: Props): Promise<React.ReactElement> {
  const status = (sp["status"] as ReviewStatus | undefined) || "pending";
  const page = Math.max(1, Number(sp["page"] ?? "1") || 1);
  const { rows, total, totalPages } = await listReviewPaginated(status, page);
  const base = `/fr/${adminPrefix}/content-gen/review-queue`;
  const pageHref = (p: number) => `${base}?status=${status}&page=${p}`;

  async function approve(formData: FormData) {
    "use server";
    await approveReview(String(formData.get("id")));
  }
  async function reject(formData: FormData) {
    "use server";
    await rejectReview(
      String(formData.get("id")),
      String(formData.get("notes") ?? "Rejet sans note"),
    );
  }

  type ReviewRow = (typeof rows)[number];
  const columns: ReadonlyArray<AdminTableColumn<ReviewRow>> = [
    { key: "date", header: "Date", cell: (r) => r.createdAt.toISOString().slice(0, 16) },
    { key: "type", header: "Type", cell: (r) => r.jobContentType },
    { key: "ville", header: "Ville", cell: (r) => r.jobAnchorVille ?? "—" },
    { key: "quality", header: "Quality", cell: (r) => r.jobQualityScore ?? "—" },
    { key: "seo", header: "SEO", cell: (r) => r.jobSeoScore ?? "—" },
    {
      key: "status",
      header: "Statut",
      cell: (r) => <AdminBadge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</AdminBadge>,
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Review queue"
        description={`${total} contenu${total > 1 ? "s" : ""} en statut ${status} — page ${page}/${totalPages}`}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="status" className="admin-label">
                Statut
              </label>
              <select id="status" name="status" defaultValue={status} className="admin-input">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Filtrer
            </button>
          </div>
        </form>
      </AdminCard>

      {rows.length === 0 ? (
        <AdminEmptyState title="Aucun contenu en revue." />
      ) : (
        <AdminTable
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          caption="Liste des contenus en revue"
          className="mb-[var(--space-admin-5)]"
          rowAction={(r) => (
            <>
              <Link href={`${base}/${r.id}`} className="admin-button-ghost">
                Détail
              </Link>{" "}
              {r.status === "pending" ? (
                <>
                  <form action={approve} className="inline">
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton
                      variant="ghost"
                      pendingLabel="✅ …"
                      ariaLabel={`Approuver la review ${r.id}`}
                    >
                      ✅ Approuver
                    </SubmitButton>
                  </form>{" "}
                  <form action={reject} className="inline">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="notes" value="Rejet rapide via liste" />
                    <SubmitButton
                      variant="ghost"
                      pendingLabel="❌ …"
                      ariaLabel={`Rejeter la review ${r.id}`}
                    >
                      ❌ Rejeter
                    </SubmitButton>
                  </form>
                </>
              ) : null}
            </>
          )}
        />
      )}

      {totalPages > 1 ? (
        <nav className="admin-pagination" aria-label="Pagination review queue">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="admin-button-ghost" rel="prev">
              ← Précédent
            </Link>
          ) : (
            <span className="admin-button-ghost admin-button-disabled" aria-disabled="true">
              ← Précédent
            </span>
          )}
          <span className="admin-meta" aria-live="polite">
            Page {page}/{totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="admin-button-ghost" rel="next">
              Suivant →
            </Link>
          ) : (
            <span className="admin-button-ghost admin-button-disabled" aria-disabled="true">
              Suivant →
            </span>
          )}
        </nav>
      ) : null}
    </AdminPageShell>
  );
}

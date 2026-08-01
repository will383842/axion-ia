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
  AdminPagination,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import {
  approveReview,
  listReviewPaginated,
  rejectReview,
} from "@/server/actions/content-gen/review";
import { SubmitButton } from "@/components/admin/content-gen/SubmitButton";
import {
  REVIEW_STATUS_LABELS_FR,
  REVIEW_STATUS_TONE,
  contentTypeLabelFr,
} from "@/server/content-gen/shared/admin-labels";
import type { ReviewStatus } from "../../../../../../../../prisma/generated/client";

const STATUSES: ReadonlyArray<ReviewStatus> = [
  "pending",
  "approved",
  "rejected",
  "needs_edits",
  "promoted_t1",
];

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
    // Audit UX 2026-08-01 (Défaut 1, P0) — sans titre, impossible de savoir ce
    // qu'on approuve/rejette sans ouvrir chaque ligne. Le titre porte le lien
    // de détail (même page que le bouton « Détail » de `rowAction` ci-dessous).
    {
      key: "title",
      header: "Titre",
      cell: (r) => (
        <Link href={`${base}/${r.id}`} className="admin-link">
          {r.jobTitle ?? "Titre indisponible"}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (r) => <span title={r.jobContentType}>{contentTypeLabelFr(r.jobContentType)}</span>,
    },
    { key: "ville", header: "Ville", cell: (r) => r.jobAnchorVille ?? "—" },
    { key: "quality", header: "Qualité", cell: (r) => r.jobQualityScore ?? "—" },
    { key: "seo", header: "SEO", cell: (r) => r.jobSeoScore ?? "—" },
    {
      key: "status",
      header: "Statut",
      cell: (r) => (
        <AdminBadge tone={REVIEW_STATUS_TONE[r.status] ?? "neutral"}>
          {REVIEW_STATUS_LABELS_FR[r.status] ?? r.status}
        </AdminBadge>
      ),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="File de relecture"
        description={`${total} contenu${total > 1 ? "s" : ""} · ${REVIEW_STATUS_LABELS_FR[status] ?? status} — page ${page}/${totalPages}`}
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
                    {REVIEW_STATUS_LABELS_FR[s] ?? s}
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

      <AdminPagination
        page={page}
        totalPages={totalPages}
        baseHref={base}
        preservedParams={{ status }}
      />
    </AdminPageShell>
  );
}

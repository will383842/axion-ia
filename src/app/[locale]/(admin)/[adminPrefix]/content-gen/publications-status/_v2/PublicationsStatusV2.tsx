// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Publications-status kanban V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { bulkApproveReviews, bulkRejectReviews } from "@/server/actions/content-gen/review";
import { retryAllFailed } from "@/server/actions/content-gen/jobs";
import { contentTypeLabelFr } from "@/server/content-gen/shared/admin-labels";

interface Props {
  adminPrefix: string;
}

export async function PublicationsStatusV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const [draft, review, approved, published, rejected] = await Promise.all([
    prisma.contentGenJob.findMany({
      where: { status: { in: ["queued", "running"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.contentGenJob.findMany({
      where: { status: "needs_review" },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.reviewQueue.findMany({
      where: { status: "approved", promotedToTier1At: null },
      include: { job: true },
      orderBy: { reviewedAt: "desc" },
      take: 30,
    }),
    prisma.contentGenJob.findMany({
      where: { status: "published" },
      orderBy: { completedAt: "desc" },
      take: 30,
    }),
    prisma.contentGenJob.findMany({
      where: { status: "failed" },
      orderBy: { completedAt: "desc" },
      take: 30,
    }),
  ]);

  const base = `/fr/${adminPrefix}/content-gen`;

  async function doBulkApprove(formData: FormData) {
    "use server";
    const min = Number(formData.get("minScore") ?? 75);
    await bulkApproveReviews(min, 100);
  }
  async function doBulkReject(formData: FormData) {
    "use server";
    const max = Number(formData.get("maxScore") ?? 50);
    await bulkRejectReviews(max, 100);
  }
  async function doRetryFailed() {
    "use server";
    await retryAllFailed();
  }

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Suivi des publications"
        description="Vue d'ensemble : Brouillon → En relecture → Approuvé → Publié (en ligne) → Refusé. La colonne « Publié » = articles réellement en ligne sur le site."
        actions={
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a
            href="/api/content-gen/export?type=jobs"
            className="admin-button-ghost"
            title="Export CSV de tous les jobs (10K max)"
          >
            Export CSV jobs
          </a>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Actions groupées</h2>
        <p className="admin-meta-block">
          Traite d&apos;un coup les contenus en attente de relecture. Le score qualité va de 0 à
          100.
        </p>
        <div className="flex flex-wrap items-center gap-[var(--space-admin-4)]">
          <form action={doBulkApprove} className="flex items-center gap-[var(--space-admin-2)]">
            <label htmlFor="bulkMin" className="admin-meta">
              Score min
            </label>
            <input
              id="bulkMin"
              type="number"
              name="minScore"
              defaultValue={75}
              min={0}
              max={100}
              className="admin-input w-[60px]"
            />
            <button type="submit" className="admin-button">
              Approuver en masse (score ≥ min)
            </button>
          </form>
          <form action={doBulkReject} className="flex items-center gap-[var(--space-admin-2)]">
            <label htmlFor="bulkMax" className="admin-meta">
              Score max
            </label>
            <input
              id="bulkMax"
              type="number"
              name="maxScore"
              defaultValue={50}
              min={0}
              max={100}
              className="admin-input w-[60px]"
            />
            <button type="submit" className="admin-button-ghost">
              Rejeter en masse (score ≤ max)
            </button>
          </form>
          <form action={doRetryFailed}>
            <button type="submit" className="admin-button-ghost">
              <RefreshCw size={14} aria-hidden="true" /> Relancer tous les échecs
            </button>
          </form>
        </div>
      </AdminCard>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KanbanColumn
          title={`Brouillon (en génération) · ${draft.length}`}
          rows={draft}
          base={base}
        />
        <KanbanColumn title={`En relecture · ${review.length}`} rows={review} base={base} />
        <KanbanColumn
          title={`Approuvé (à publier) · ${approved.length}`}
          rows={approved.map((a) => a.job)}
          base={base}
        />
        <KanbanColumn
          title={`Publié (en ligne) · ${published.length}`}
          rows={published}
          base={base}
        />
        <KanbanColumn title={`Refusé (échec) · ${rejected.length}`} rows={rejected} base={base} />
      </div>
    </AdminPageShell>
  );
}

function KanbanColumn({
  title,
  rows,
  base,
}: {
  title: string;
  rows: ReadonlyArray<{
    id: string;
    contentType: string;
    anchorVilleSlug: string | null;
    qualityScore: number | null;
    createdAt: Date;
  }>;
  base: string;
}) {
  return (
    <AdminCard variant="compact" className="min-h-[200px]">
      <h2 className="admin-h2 text-[length:var(--text-admin-sm)]">{title}</h2>
      <ul className="list-none p-0 text-[length:var(--text-admin-xs)]">
        {rows.slice(0, 12).map((r) => (
          <li
            key={r.id}
            className="border-b border-[color:var(--color-admin-border)] py-[var(--space-admin-2)]"
          >
            <Link href={`${base}/jobs/${r.id}`} className="admin-link" title={r.contentType}>
              <strong>{contentTypeLabelFr(r.contentType)}</strong>
              {r.anchorVilleSlug ? ` · ${r.anchorVilleSlug}` : null}
            </Link>
            <br />
            <span className="admin-meta">
              {r.qualityScore != null ? `score ${r.qualityScore}` : "—"} ·{" "}
              {formatDateFrShort(r.createdAt)}
            </span>
          </li>
        ))}
        {rows.length > 12 ? (
          <li className="mt-[var(--space-admin-3)]">
            <em>… +{rows.length - 12} autres</em>
          </li>
        ) : null}
      </ul>
    </AdminCard>
  );
}

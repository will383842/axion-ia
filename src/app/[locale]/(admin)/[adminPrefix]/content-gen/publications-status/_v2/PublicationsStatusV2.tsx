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
      // 2026-09-02 — `promotedToTier1At` n'est posé que par `promoteToTier1` ;
      // `approveReview` publie sans le poser. Sans le filtre sur le statut du
      // job, les 258 publiés restaient dans « à publier » (314 affichés).
      where: { status: "approved", promotedToTier1At: null, job: { status: { not: "published" } } },
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

  /**
   * 🔴 LES CINQ COMPTEURS AFFICHAIENT LE PLAFOND DES REQUÊTES, PAS LE TOTAL.
   * Chaque colonne lit `take: 30` puis titrait « Publié (en ligne) · 30 » :
   * avec cinq mille articles publiés, la colonne annonçait trente. Et comme
   * elle n'en montre que douze (`slice(0, 12)`), aucun des deux nombres
   * affichés ne disait quoi que ce soit de vrai sur le volume réel.
   *
   * On compte donc en base, et on dit à côté ce que la colonne montre.
   */
  const [nbDraft, nbReview, nbApproved, nbPublished, nbRejected] = await Promise.all([
    prisma.contentGenJob.count({ where: { status: { in: ["queued", "running"] } } }),
    prisma.contentGenJob.count({ where: { status: "needs_review" } }),
    prisma.reviewQueue.count({
      where: { status: "approved", promotedToTier1At: null, job: { status: { not: "published" } } },
    }),
    prisma.contentGenJob.count({ where: { status: "published" } }),
    prisma.contentGenJob.count({ where: { status: "failed" } }),
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
              className="admin-input"
              style={{ width: 60 }}
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
              className="admin-input"
              style={{ width: 60 }}
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
        <KanbanColumn title="Brouillon (en génération)" total={nbDraft} rows={draft} base={base} />
        <KanbanColumn title="En relecture" total={nbReview} rows={review} base={base} />
        <KanbanColumn
          title="Approuvé (à publier)"
          total={nbApproved}
          rows={approved.map((a) => a.job)}
          base={base}
        />
        <KanbanColumn title="Publié (en ligne)" total={nbPublished} rows={published} base={base} />
        <KanbanColumn title="Refusé (échec)" total={nbRejected} rows={rejected} base={base} />
      </div>
    </AdminPageShell>
  );
}

function KanbanColumn({
  title,
  rows,
  base,
  total,
}: {
  title: string;
  /** Nombre réel en base — la liste, elle, est plafonnée. */
  total: number;
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
      <h2 className="admin-h2 text-[length:var(--text-admin-sm)]">
        {title} · {total}
      </h2>
      {total > rows.slice(0, 12).length ? (
        <p className="admin-meta-small">
          {rows.slice(0, 12).length} affichée{rows.slice(0, 12).length > 1 ? "s" : ""} sur {total}
        </p>
      ) : null}
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
        {/* 2026-09-02 — l'ancien « … +N autres » valait toujours 18 (30 lignes
            chargées − 12 affichées) : l'indicateur « N affichées sur total »
            ci-dessus est le seul juste. */}
      </ul>
    </AdminCard>
  );
}

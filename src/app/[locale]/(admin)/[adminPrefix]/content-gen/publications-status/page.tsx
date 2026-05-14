/**
 * Content Generator — Dashboard kanban publications (§ 12.1 v1.7).
 *
 * 5 colonnes : Brouillon (draft/queued) / En revue (needs_review) / Approuvé
 * (review.approved pending publish) / Publié / Refusé. Drag&drop arrive V1.5.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { bulkApproveReviews, bulkRejectReviews } from "@/server/actions/content-gen/review";
import { retryAllFailed } from "@/server/actions/content-gen/jobs";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function PublicationsStatusPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

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
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Statut publications (kanban)</h1>
          <p className="admin-meta">5 colonnes · drag&drop V1.5 · bulk actions ci-dessous</p>
        </div>
        <div className="admin-dashboard-actions">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/content-gen/export?type=jobs"
            className="admin-button-ghost"
            title="Export CSV de tous les jobs (10K max)"
          >
            📥 Export CSV jobs
          </a>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 14 }}>Bulk actions (§ 12.1 v1.8)</h2>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          <form action={doBulkApprove} style={{ display: "flex", gap: 4, alignItems: "center" }}>
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
              ✅ Approve bulk pending
            </button>
          </form>
          <form action={doBulkReject} style={{ display: "flex", gap: 4, alignItems: "center" }}>
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
              ❌ Reject bulk pending
            </button>
          </form>
          <form action={doRetryFailed}>
            <button type="submit" className="admin-button-ghost">
              🔁 Retry all failed
            </button>
          </form>
        </div>
      </div>

      <div
        className="admin-card-grid"
        // P1-10 fix audit opérationnel 2026-05-14 : `auto-fit` + minmax 200px
        // permet à la grille de wrap proprement sous 1000px. Sur mobile < 480px,
        // les colonnes s'empilent en 1 colonne unique (chaque colonne ≥ 200px).
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        <KanbanColumn title={`Brouillon · ${draft.length}`} rows={draft} base={base} />
        <KanbanColumn title={`En revue · ${review.length}`} rows={review} base={base} />
        <KanbanColumn
          title={`Approuvé · ${approved.length}`}
          rows={approved.map((a) => a.job)}
          base={base}
        />
        <KanbanColumn title={`Publié · ${published.length}`} rows={published} base={base} />
        <KanbanColumn title={`Refusé · ${rejected.length}`} rows={rejected} base={base} />
      </div>
    </section>
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
    <div className="admin-card" style={{ minHeight: 200 }}>
      <h2 style={{ fontSize: 14, marginTop: 0 }}>{title}</h2>
      <ul style={{ listStyle: "none", padding: 0, fontSize: 12 }}>
        {rows.slice(0, 12).map((r) => (
          <li
            key={r.id}
            style={{
              padding: "6px 0",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <a href={`${base}/jobs/${r.id}`}>
              <strong>{r.contentType}</strong>
              {r.anchorVilleSlug ? ` · ${r.anchorVilleSlug}` : null}
            </a>
            <br />
            <span className="admin-meta">
              {r.qualityScore != null ? `score ${r.qualityScore}` : "—"} ·{" "}
              {r.createdAt.toISOString().slice(5, 10)}
            </span>
          </li>
        ))}
        {rows.length > 12 ? (
          <li style={{ marginTop: 8 }}>
            <em>… +{rows.length - 12} autres</em>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

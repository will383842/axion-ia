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
import { PublicationsStatusV2 } from "./_v2/PublicationsStatusV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function PublicationsStatusPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <PublicationsStatusV2 adminPrefix={adminPrefix} />;
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

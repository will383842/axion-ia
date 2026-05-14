/**
 * Content Generator — BullMQ inspection (§ 12.1).
 *
 * V1 lit Prisma table `ContentGenJob` (status = queued/running/failed). La
 * vue BullMQ in-Redis (bullmq-board) sera Sprint 6 si Will la veut.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listJobs, retryAllFailed } from "@/server/actions/content-gen/jobs";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function QueuePage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const [running, waiting, failed] = await Promise.all([
    listJobs({ status: "running" }),
    listJobs({ status: "queued" }),
    listJobs({ status: "failed" }),
  ]);

  async function retryAll() {
    "use server";
    await retryAllFailed();
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Queue BullMQ</h1>
          <p className="admin-meta">Inspection rapide. La vraie vue Redis arrivera Sprint 6.</p>
        </div>
        <form action={retryAll}>
          <button type="submit" className="admin-button">
            Retry all failed ({failed.total})
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h2>En cours ({running.total})</h2>
        <JobMini rows={running.rows} adminPrefix={adminPrefix} />
      </div>

      <div className="admin-card">
        <h2>En attente ({waiting.total})</h2>
        <JobMini rows={waiting.rows} adminPrefix={adminPrefix} />
      </div>

      <div
        className="admin-card"
        style={{ borderColor: failed.total > 0 ? "var(--color-terracotta)" : undefined }}
      >
        <h2>Failed ({failed.total})</h2>
        <JobMini rows={failed.rows} adminPrefix={adminPrefix} />
      </div>
    </section>
  );
}

function JobMini({
  rows,
  adminPrefix,
}: {
  rows: ReadonlyArray<{
    id: string;
    contentType: string;
    anchorVilleSlug: string | null;
    errorMessage: string | null;
    createdAt: Date;
  }>;
  adminPrefix: string;
}) {
  if (rows.length === 0) return <p>Aucun job dans cet état.</p>;
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Type</th>
          <th>Ville</th>
          <th>Date</th>
          <th>Erreur</th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 20).map((r) => (
          <tr key={r.id}>
            <td>
              <a href={`/fr/${adminPrefix}/content-gen/jobs/${r.id}`}>
                <code>{r.id.slice(0, 10)}…</code>
              </a>
            </td>
            <td>{r.contentType}</td>
            <td>{r.anchorVilleSlug ?? "—"}</td>
            <td>{r.createdAt.toISOString().slice(0, 16)}</td>
            <td>{r.errorMessage ? r.errorMessage.slice(0, 60) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

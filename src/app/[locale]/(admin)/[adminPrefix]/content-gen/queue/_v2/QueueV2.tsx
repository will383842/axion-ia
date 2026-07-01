// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Queue BullMQ V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { listJobs, retryAllFailed } from "@/server/actions/content-gen/jobs";

interface Props {
  adminPrefix: string;
}

export async function QueueV2({ adminPrefix }: Props): Promise<React.ReactElement> {
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
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Queue BullMQ"
        description="Inspection rapide. La vraie vue Redis arrivera Sprint 6."
        actions={
          <form action={retryAll}>
            <button type="submit" className="admin-button">
              Relancer tous les échecs ({failed.total})
            </button>
          </form>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">En cours ({running.total})</h2>
        <JobMini rows={running.rows} adminPrefix={adminPrefix} />
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">En attente ({waiting.total})</h2>
        <JobMini rows={waiting.rows} adminPrefix={adminPrefix} />
      </AdminCard>

      <AdminCard
        {...(failed.total > 0
          ? { className: "border-l-4 border-l-[color:var(--color-admin-destructive)]" }
          : {})}
      >
        <h2 className="admin-h2">En échec ({failed.total})</h2>
        <JobMini rows={failed.rows} adminPrefix={adminPrefix} />
      </AdminCard>
    </AdminPageShell>
  );
}

interface JobRow {
  id: string;
  contentType: string;
  anchorVilleSlug: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

function JobMini({ rows, adminPrefix }: { rows: ReadonlyArray<JobRow>; adminPrefix: string }) {
  if (rows.length === 0) return <AdminEmptyState title="Aucun job dans cet état." />;
  const columns: ReadonlyArray<AdminTableColumn<JobRow>> = [
    { key: "type", header: "Type", cell: (r) => r.contentType },
    { key: "ville", header: "Ville", cell: (r) => r.anchorVilleSlug ?? "—" },
    { key: "date", header: "Date", cell: (r) => r.createdAt.toISOString().slice(0, 16) },
    {
      key: "error",
      header: "Erreur",
      cell: (r) => (r.errorMessage ? r.errorMessage.slice(0, 60) : "—"),
    },
  ];
  return (
    <AdminTable
      columns={columns}
      rows={rows.slice(0, 20)}
      getRowId={(r) => r.id}
      caption="Liste des jobs de la file"
      rowAction={(r) => (
        <Link href={`/fr/${adminPrefix}/content-gen/jobs/${r.id}`} className="admin-link">
          <code>{r.id.slice(0, 10)}…</code>
        </Link>
      )}
    />
  );
}

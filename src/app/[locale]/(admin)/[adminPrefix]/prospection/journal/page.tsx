import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminTable, type AdminTableColumn } from "@/components/admin/ui/AdminTable";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { listRecentEvents } from "@/server/prospection/admin/queries";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listRecentEvents>>[number];

export default async function JournalPage() {
  const events = await listRecentEvents();
  const columns: ReadonlyArray<AdminTableColumn<Row>> = [
    {
      key: "date",
      header: "Date",
      cell: (e) => e.createdAt.toISOString().slice(0, 19).replace("T", " "),
    },
    { key: "type", header: "Événement", cell: (e) => e.type },
    { key: "reason", header: "Détail", cell: (e) => e.reason ?? "—" },
  ];
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Journal / audit"
        description="Événements du module (collecte, opt-out, export…) + journal d'accès aux données personnelles (RGPD)."
      />
      <AdminTable
        columns={columns}
        rows={events}
        getRowId={(e) => e.id}
        emptyState={<AdminEmptyState title="Aucun événement" />}
      />
    </AdminPageShell>
  );
}

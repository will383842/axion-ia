import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminTable, type AdminTableColumn } from "@/components/admin/ui/AdminTable";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { listSuppressions } from "@/server/prospection/admin/queries";
import { RgpdForm } from "./RgpdForm";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listSuppressions>>[number];

export default async function RgpdPage() {
  const suppressions = await listSuppressions();
  const columns: ReadonlyArray<AdminTableColumn<Row>> = [
    { key: "type", header: "Type", cell: (s) => s.type },
    { key: "value", header: "Valeur", cell: (s) => s.value },
    { key: "raison", header: "Raison", cell: (s) => s.raison ?? "—" },
    { key: "date", header: "Date", cell: (s) => s.createdAt.toISOString().slice(0, 10) },
  ];
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="RGPD — Oppositions & droits"
        description="Opt-out multi-clé (siren/email/domaine/personKey), vraiment bloquant : filtré à la collecte, à l'enrichissement ET à l'export. Base légale : intérêt légitime B2B (art. 6.1.f)."
      />
      <section className="admin-card" style={{ marginBottom: "1rem" }}>
        <h2 className="admin-section-title">Enregistrer une opposition</h2>
        <RgpdForm />
      </section>
      <h2 className="admin-section-title">Registre des oppositions</h2>
      <AdminTable
        columns={columns}
        rows={suppressions}
        getRowId={(s) => s.id}
        emptyState={<AdminEmptyState title="Aucune opposition enregistrée" />}
      />
    </AdminPageShell>
  );
}

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminTable, type AdminTableColumn } from "@/components/admin/ui/AdminTable";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { getFranceKpis, listRegionCoverage } from "@/server/prospection/admin/queries";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listRegionCoverage>>[number];

function pct(n: number): string {
  return `${Math.round(n * 100)} %`;
}

export default async function CouverturePage() {
  const [france, regions] = await Promise.all([getFranceKpis(), listRegionCoverage()]);

  const columns: ReadonlyArray<AdminTableColumn<Row>> = [
    { key: "region", header: "Région", cell: (r) => r.regionLabel },
    {
      key: "stock",
      header: "Stock attendu",
      cell: (r) => r.stockAttendu.toLocaleString("fr-FR"),
      align: "right",
    },
    {
      key: "collectees",
      header: "Collectées",
      cell: (r) => r.collectees.toLocaleString("fr-FR"),
      align: "right",
    },
    { key: "completion", header: "Complétion", cell: (r) => pct(r.pctCompletion), align: "right" },
    {
      key: "exploitables",
      header: "Exploitables",
      cell: (r) => r.exploitables.toLocaleString("fr-FR"),
      align: "right",
    },
    {
      key: "contactStock",
      header: "% contacts / stock",
      cell: (r) => pct(r.pctExploitableSurStock),
      align: "right",
    },
  ];

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Couverture — dép → région → France"
        description="Taux de complétion (collectées / stock) et de contactabilité (exploitables / stock)."
      />
      <section className="admin-card" style={{ marginBottom: "1rem" }}>
        <h2 className="admin-section-title">Bandeau France</h2>
        <p>
          Complétion <strong>{pct(france.pctCompletion)}</strong> ·{" "}
          {france.collectees.toLocaleString("fr-FR")} /{" "}
          {france.stockAttendu.toLocaleString("fr-FR")} entreprises · Contactabilité{" "}
          <strong>{pct(france.pctExploitableSurStock)}</strong>
        </p>
      </section>
      <AdminTable
        columns={columns}
        rows={regions}
        getRowId={(r) => r.scopeId}
        emptyState={
          <AdminEmptyState
            title="Aucune statistique de couverture"
            description="Le rollup s'exécute après la première collecte (coverage-worker)."
          />
        }
      />
    </AdminPageShell>
  );
}

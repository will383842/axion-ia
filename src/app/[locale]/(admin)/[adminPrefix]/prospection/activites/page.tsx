import Link from "next/link";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminTable, type AdminTableColumn } from "@/components/admin/ui/AdminTable";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { getActivityBreakdown } from "@/server/prospection/admin/queries";
import { EnrichSegmentForm } from "./EnrichSegmentForm";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof getActivityBreakdown>>[number];

function pct(n: number): string {
  return `${Math.round(n * 100)} %`;
}

export default async function ActivitesPage({
  params,
  searchParams,
}: {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<{ departement?: string; secteur?: string }>;
}) {
  const { adminPrefix } = await params;
  const { departement, secteur } = await searchParams;
  const rows = await getActivityBreakdown({
    ...(departement ? { departement } : {}),
    ...(secteur ? { secteur } : {}),
  });
  const base = `/fr/${adminPrefix}/prospection/activites`;
  const drilldown = !!secteur; // affiche des NAF, sinon des secteurs

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { departement, secteur, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  const columns: ReadonlyArray<AdminTableColumn<Row>> = [
    {
      key: "activite",
      header: drilldown ? "Code NAF" : "Secteur",
      cell: (r) => (drilldown ? r.label : <Link href={qs({ secteur: r.key })}>{r.label}</Link>),
    },
    {
      key: "collectees",
      header: "Collectées",
      cell: (r) => r.collectees.toLocaleString("fr-FR"),
      align: "right",
    },
    {
      key: "enrichies",
      header: "Enrichies",
      cell: (r) => `${r.enrichies.toLocaleString("fr-FR")} (${pct(r.pctEnrichies)})`,
      align: "right",
    },
    {
      key: "exploitables",
      header: "Exploitables",
      cell: (r) => (
        <>
          {r.exploitables.toLocaleString("fr-FR")}{" "}
          <AdminBadge tone={r.pctExploitable >= 0.2 ? "success" : "warning"}>
            {pct(r.pctExploitable)}
          </AdminBadge>
        </>
      ),
      align: "right",
    },
    {
      key: "partiels",
      header: "Partiels",
      cell: (r) => r.partiels.toLocaleString("fr-FR"),
      align: "right",
    },
  ];

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Couverture par activité"
        description="Collectées / enrichies / exploitables ventilées par secteur puis par code NAF (ex. architectes du BTP). Le % exploitable = taux de succès « contact exploitable »."
        breadcrumbs={
          drilldown ? <Link href={qs({ secteur: undefined })}>← Tous les secteurs</Link> : undefined
        }
      />

      <form method="get" className="admin-toolbar" style={{ marginBottom: "1rem" }}>
        {secteur && <input type="hidden" name="secteur" value={secteur} />}
        <input
          name="departement"
          defaultValue={departement}
          placeholder="Filtrer par département (ex. 38)"
        />
        <button type="submit" className="admin-button">
          Filtrer
        </button>
      </form>

      <section className="admin-card" style={{ marginBottom: "1rem" }}>
        <h2 className="admin-section-title">
          Enrichir ce segment {departement ? `· dép ${departement}` : "· France"}{" "}
          {secteur ? `· ${secteur}` : ""}
        </h2>
        <p className="admin-muted">
          Relance l’enrichissement (découverte de site + coordonnées + responsables) des entreprises
          déjà collectées de ce segment, indépendamment d’une campagne.
        </p>
        <EnrichSegmentForm
          {...(departement ? { departement } : {})}
          {...(secteur ? { secteur } : {})}
        />
      </section>

      <AdminTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.key}
        emptyState={
          <AdminEmptyState
            title="Aucune donnée"
            description="Lancez l’ingestion Stock + une collecte pour peupler la base, puis l’enrichissement."
          />
        }
      />
    </AdminPageShell>
  );
}

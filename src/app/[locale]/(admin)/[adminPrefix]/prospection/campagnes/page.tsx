import Link from "next/link";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminTable, type AdminTableColumn } from "@/components/admin/ui/AdminTable";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { listCampaigns } from "@/server/prospection/admin/queries";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listCampaigns>>[number];

export default async function CampagnesPage({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}) {
  const { adminPrefix } = await params;
  const base = `/fr/${adminPrefix}/prospection/campagnes`;
  const campaigns = await listCampaigns();

  const columns: ReadonlyArray<AdminTableColumn<Row>> = [
    { key: "nom", header: "Campagne", cell: (c) => <Link href={`${base}/${c.id}`}>{c.nom}</Link> },
    {
      key: "statut",
      header: "Statut",
      cell: (c) => (
        <AdminBadge tone={c.statut === "active" ? "success" : "neutral"}>{c.statut}</AdminBadge>
      ),
    },
    {
      key: "cible",
      header: "Cible",
      cell: (c) =>
        `${c.departements.join(", ")} · ${(c.secteurs.length ? c.secteurs : c.nafCodes).join(", ")} · ${c.tailles.join(", ")}`,
    },
    {
      key: "avancement",
      header: "Avancement",
      cell: (c) =>
        `${c.cellulesFaites}/${c.cellulesTotal} cellules · ${c.entreprisesCollectees.toLocaleString("fr-FR")} collectées`,
    },
  ];

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Campagnes de prospection"
        description="Chaque campagne cible département × secteur/NAF × taille et se découpe en cellules de couverture."
        actions={
          <Link className="admin-button-cta" href={`${base}/nouvelle`}>
            + Nouvelle campagne
          </Link>
        }
      />
      <AdminTable
        columns={columns}
        rows={campaigns}
        getRowId={(c) => c.id}
        emptyState={
          <AdminEmptyState
            title="Aucune campagne"
            description="Créez une campagne pour lancer la collecte (ex. Isère 38 · BTP + Santé)."
            primaryAction={
              <Link className="admin-button-cta" href={`${base}/nouvelle`}>
                Créer une campagne
              </Link>
            }
          />
        }
      />
    </AdminPageShell>
  );
}

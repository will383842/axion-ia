import { notFound } from "next/navigation";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { getCampaign } from "@/server/prospection/admin/queries";
import { CampaignActions } from "./CampaignActions";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const byStatut = campaign.cells.reduce<Record<string, number>>((acc, c) => {
    acc[c.statut] = (acc[c.statut] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={campaign.nom}
        description={`${campaign.departements.join(", ")} · ${(campaign.secteurs.length ? campaign.secteurs : campaign.nafCodes).join(", ")} · ${campaign.tailles.join(", ")}`}
        meta={
          <AdminBadge tone={campaign.statut === "active" ? "success" : "neutral"}>
            {campaign.statut}
          </AdminBadge>
        }
        actions={<CampaignActions id={campaign.id} statut={campaign.statut} />}
      />
      <section className="admin-card">
        <h2 className="admin-section-title">Avancement</h2>
        <p>
          {campaign.cellulesFaites}/{campaign.cellulesTotal} cellules ·{" "}
          {campaign.entreprisesCollectees.toLocaleString("fr-FR")} entreprises collectées ·{" "}
          {campaign.entreprisesEnrichies.toLocaleString("fr-FR")} enrichies
        </p>
        <ul className="admin-list">
          {Object.entries(byStatut).map(([statut, n]) => (
            <li key={statut}>
              <AdminBadge
                tone={
                  statut === "fait" ? "success" : statut === "erreur" ? "destructive" : "neutral"
                }
              >
                {statut}
              </AdminBadge>{" "}
              {n} cellules
            </li>
          ))}
        </ul>
      </section>
      <section className="admin-card">
        <h2 className="admin-section-title">Cellules (extrait)</h2>
        <ul className="admin-list">
          {campaign.cells.slice(0, 50).map((c) => (
            <li key={c.id}>
              {c.departement} · {c.naf} · {c.taille} — {c.collecte}/{c.attendu}{" "}
              <AdminBadge
                tone={
                  c.statut === "fait"
                    ? "success"
                    : c.statut === "erreur"
                      ? "destructive"
                      : "neutral"
                }
              >
                {c.statut}
              </AdminBadge>
            </li>
          ))}
        </ul>
      </section>
    </AdminPageShell>
  );
}

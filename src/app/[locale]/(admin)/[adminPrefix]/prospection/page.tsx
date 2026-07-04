import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { getFranceKpis, listActiveCampaigns } from "@/server/prospection/admin/queries";

export const dynamic = "force-dynamic";

function pct(n: number): string {
  return `${Math.round(n * 100)} %`;
}

export default async function ProspectionDashboardPage() {
  const [kpis, campaigns] = await Promise.all([getFranceKpis(), listActiveCampaigns()]);
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Prospection — Tableau de bord"
        description="Constitution de la base d'entreprises françaises (V1 : base + export, aucun envoi d'email)."
        meta={<AdminBadge tone="info">France</AdminBadge>}
      />
      <div
        className="admin-stat-grid"
        style={{
          display: "grid",
          gap: "var(--space-admin-4, 1rem)",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        }}
      >
        <AdminStatCard
          label="Entreprises collectées"
          value={kpis.collectees.toLocaleString("fr-FR")}
          meta={`sur ${kpis.stockAttendu.toLocaleString("fr-FR")} attendues`}
        />
        <AdminStatCard label="Complétion" value={pct(kpis.pctCompletion)} tone="info" />
        <AdminStatCard label="Enrichies" value={kpis.enrichies.toLocaleString("fr-FR")} />
        <AdminStatCard
          label="Exploitables"
          value={kpis.exploitables.toLocaleString("fr-FR")}
          tone="success"
          meta={`${pct(kpis.pctExploitableSurStock)} du stock`}
        />
        <AdminStatCard label="Campagnes actives" value={campaigns.length} />
      </div>
      <section style={{ marginTop: "var(--space-admin-6, 1.5rem)" }}>
        <h2 className="admin-section-title">Campagnes actives</h2>
        {campaigns.length === 0 ? (
          <p className="admin-muted">Aucune campagne active. Créez-en une depuis « Campagnes ».</p>
        ) : (
          <ul className="admin-list">
            {campaigns.map((c) => (
              <li key={c.id}>
                <strong>{c.nom}</strong> — {c.cellulesFaites}/{c.cellulesTotal} cellules ·{" "}
                {c.entreprisesCollectees.toLocaleString("fr-FR")} collectées{" "}
                <AdminBadge tone={c.statut === "active" ? "success" : "warning"}>
                  {c.statut}
                </AdminBadge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminPageShell>
  );
}

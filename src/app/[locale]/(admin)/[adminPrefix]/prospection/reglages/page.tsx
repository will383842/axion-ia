import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { getAllProspectionConfig } from "@/server/prospection/config/site-settings";

export const dynamic = "force-dynamic";

export default async function ReglagesPage() {
  const config = await getAllProspectionConfig();
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Réglages"
        description="Configuration effective (SiteSetting catégorie prospection) : quotas, rate-limits, seuils, fenêtres de fraîcheur, budgets de crawl, poids de score, rétention RGPD, identité légale."
      />
      <section className="admin-card">
        <p className="admin-muted">
          Les valeurs légales (raison sociale, SIREN, DPO) sont des placeholders à compléter avant
          la collecte en production.
        </p>
        <pre style={{ overflow: "auto", padding: "1rem", fontSize: "0.85rem" }}>
          {JSON.stringify(config, null, 2)}
        </pre>
      </section>
    </AdminPageShell>
  );
}

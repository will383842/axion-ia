import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { listDepartmentCoverage } from "@/server/prospection/admin/queries";
import { DepartmentSweepPanel } from "./DepartmentSweepPanel";

export const dynamic = "force-dynamic";

export default async function DepartementsPage() {
  const rows = await listDepartmentCoverage();

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Départements — balayage automatique"
        description="Cochez un ou plusieurs départements et lancez : la collecte + l'enrichissement de TOUTES les entreprises (tous secteurs, santé comprise) se déroulent en automatique de bout en bout. La complétion s'affiche ici et se met à jour toute seule."
      />
      <section className="admin-card" style={{ marginBottom: "1rem" }}>
        <p className="admin-muted">
          Un clic = tout le département. Le moteur draine + clôt chaque campagne tout seul (marquée
          « Complet » quand tout est traité). Pour un ciblage fin (ex. seulement les architectes
          PME), utilisez « Campagnes » → « Nouvelle campagne ».
        </p>
      </section>
      <DepartmentSweepPanel rows={rows} />
    </AdminPageShell>
  );
}

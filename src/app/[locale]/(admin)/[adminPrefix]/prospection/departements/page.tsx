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
        title="Départements — récupération & enrichissement"
        description="Cochez un ou plusieurs départements, puis lancez en 2 étapes distinctes, tous secteurs (santé comprise). Le suivi de chaque étape s'affiche ici et se met à jour tout seul."
      />
      <section className="admin-card" style={{ marginBottom: "1rem" }}>
        <ul className="admin-list">
          <li>
            <strong>Étape 1 — Récupérer</strong> : remplit la base (nom, activité, taille, adresse)
            des départements cochés. Rapide, pas de crawl. Prérequis : avoir chargé le fichier INSEE
            une fois (bouton « Lancer l’ingestion Stock » dans Réglages).
          </li>
          <li>
            <strong>Étape 2 — Enrichir</strong> : lance le crawl des sites (emails, téléphones,
            responsables) des entreprises déjà récupérées. Plus long, à lancer quand tu veux.
          </li>
        </ul>
        <p className="admin-muted">
          Pour un ciblage fin (ex. seulement les architectes PME), utilise « Campagnes » → «
          Nouvelle campagne ».
        </p>
      </section>
      <DepartmentSweepPanel rows={rows} />
    </AdminPageShell>
  );
}

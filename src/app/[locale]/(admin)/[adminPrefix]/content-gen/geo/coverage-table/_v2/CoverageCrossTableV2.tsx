// P1-5 Sprint P5 - Tableau croise ville x secteur x etat.
// Resolution D-P5-4: tableau croise dynamique (pas heatmap).

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { getJobsVilleSectorDetail } from "@/server/actions/content-gen/geo";

interface Props {
  adminPrefix: string;
}

const STATUS_LABELS: Record<string, string> = {
  published: "Publie",
  draft: "Brouillon",
  running: "En cours",
  queued: "En attente",
  failed: "Echec",
  needs_review: "Review",
  quality_improving: "Qualite auto",
  cancelled: "Annule",
};

export async function CoverageCrossTableV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const base = `/fr/${adminPrefix}/content-gen`;
  const rows = await getJobsVilleSectorDetail(200);

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Tableau croise villes x secteur x etat"
        description={`${rows.length} lignes aggregees. Top 200 combinaisons.`}
        actions={
          <Link href={`${base}/geo`} className="admin-button-ghost">
            Retour cockpit geo
          </Link>
        }
      />

      <AdminCard variant="compact">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ville</th>
                <th>Etat</th>
                <th>Count</th>
                <th>Score moy.</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-table-empty">
                    Aucune donnee. Lancez des campagnes de couverture.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={`${r.anchorVilleSlug}-${r.status}-${i}`}>
                    <td className="font-medium">{r.anchorVilleSlug}</td>
                    <td>
                      <span className="admin-badge">{STATUS_LABELS[r.status] ?? r.status}</span>
                    </td>
                    <td>{r.count}</td>
                    <td>{r.avgQuality != null ? r.avgQuality.toFixed(1) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}

// Observatoire IA 2026 — dashboard admin (AdminPageShell + AdminCard).
// Stats effectifs (réels vs seedés), KPIs du snapshot, recalcul manuel.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import {
  getBarometerStats,
  recomputeBarometerSnapshotForm,
  generateBarometerArticleForm,
} from "@/server/actions/observatoire/admin";

const INSIGHT_LABELS: Record<string, string> = {
  competitors_use_ai: "Pensent que leurs concurrents utilisent l'IA",
  no_formal_strategy: "Sans stratégie IA formalisée",
  rgpd_concern: "Préoccupés par la souveraineté des données",
  investment_intent: "Prévoient d'augmenter leur budget IA",
};

export async function ObservatoireV2(): Promise<React.ReactElement> {
  const stats = await getBarometerStats();
  const insights = stats.snapshot?.insights ?? {};
  const computed = stats.lastComputedAt
    ? new Date(stats.lastComputedAt).toLocaleString("fr-FR")
    : "jamais";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Observatoire IA 2026"
        description={`${stats.totalResponses} réponses (${stats.realResponses} réelles · ${stats.seededResponses} démo) · snapshot recalculé : ${computed}`}
      />

      <AdminCard variant="compact" className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Effectifs</h2>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Total réponses</th>
                <th>Réelles (formulaire)</th>
                <th>Démo (seed)</th>
                <th>Snapshot effectif</th>
                <th>Dernier recalcul</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{stats.totalResponses}</td>
                <td>{stats.realResponses}</td>
                <td>{stats.seededResponses}</td>
                <td>{stats.snapshot?.totalResponses ?? 0}</td>
                <td>{computed}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="admin-help mt-[var(--space-admin-4)]">
          ⚠️ Les réponses « démo » (seed) sont une fixture de développement. En production, ne
          publier les chiffres qu’à partir d’un échantillon RÉEL.
        </p>
      </AdminCard>

      <AdminCard variant="compact" className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Recalcul du snapshot</h2>
        <p className="admin-help">
          Recalcule les agrégats publics (page « Observatoire » + presse) à partir des réponses
          actuelles.
        </p>
        <form action={recomputeBarometerSnapshotForm} className="mt-[var(--space-admin-4)]">
          <button type="submit" className="admin-btn admin-btn-primary">
            Recalculer maintenant
          </button>
        </form>
      </AdminCard>

      <AdminCard variant="compact" className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Générer un article d’analyse</h2>
        <p className="admin-help">
          Crée un article « barometer_insight » ancré sur les chiffres RÉELS du snapshot
          (review-queue). Refusé si aucun échantillon réel.
        </p>
        <form action={generateBarometerArticleForm} className="mt-[var(--space-admin-4)]">
          <button type="submit" className="admin-btn admin-btn-primary">
            Générer un article
          </button>
        </form>
      </AdminCard>

      <AdminCard variant="compact">
        <h2 className="admin-h2">Constats phares (snapshot)</h2>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Constat</th>
                <th>Valeur</th>
              </tr>
            </thead>
            <tbody>
              {stats.snapshot == null ? (
                <tr>
                  <td colSpan={2} className="admin-table-empty">
                    Aucun snapshot.
                  </td>
                </tr>
              ) : (
                Object.entries(INSIGHT_LABELS).map(([key, label]) => (
                  <tr key={key}>
                    <td>{label}</td>
                    <td>{insights[key] != null ? `${insights[key]} %` : "—"}</td>
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

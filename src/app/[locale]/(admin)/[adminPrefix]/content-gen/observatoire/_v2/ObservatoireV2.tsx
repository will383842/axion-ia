// Observatoire IA 2026 — dashboard admin (AdminPageShell + AdminCard).
// Stats effectifs (réels vs seedés), KPIs du snapshot, recalcul manuel.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import {
  getBarometerStats,
  recomputeBarometerSnapshotForm,
  regenerateBarometerAnalysisForm,
  generateBarometerArticleForm,
} from "@/server/actions/observatoire/admin";
import { TriangleAlert } from "lucide-react";

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
          <TriangleAlert
            size={14}
            aria-hidden="true"
            className="inline-block shrink-0 align-[-0.125em]"
          />{" "}
          Les réponses « démo » (seed) sont une fixture de développement. En production, ne publier
          les chiffres qu’à partir d’un échantillon RÉEL.
        </p>
      </AdminCard>

      <AdminCard variant="compact" className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Recalcul du snapshot</h2>
        <p className="admin-help">
          Recalcule les agrégats publics (page « Observatoire » + presse) à partir des réponses
          actuelles.
        </p>
        <form action={recomputeBarometerSnapshotForm} className="mt-[var(--space-admin-4)]">
          <button type="submit" className="admin-button-cta">
            Recalculer maintenant
          </button>
        </form>
      </AdminCard>

      <AdminCard variant="compact" className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Générer un article d’analyse</h2>
        <p className="admin-help">
          Crée une analyse de l&apos;Observatoire, adossée aux chiffres RÉELS du dernier relevé, et
          l&apos;envoie en relecture. Refusée si aucun échantillon réel n&apos;existe.
        </p>
        <form action={generateBarometerArticleForm} className="mt-[var(--space-admin-4)]">
          <button type="submit" className="admin-button-cta">
            Générer un article
          </button>
        </form>
      </AdminCard>

      <AdminCard variant="compact" className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Segments &amp; auto-update</h2>
        <p className="admin-help">
          Breakdowns publiés par dimension (segments ≥ 5 réponses) + historique des courbes
          d’évolution. Recalcul automatique toutes les 6 h (worker
          «&nbsp;observatoire-snapshot&nbsp;»).
        </p>
        <div className="admin-table-wrapper mt-[var(--space-admin-4)]">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Par taille</th>
                <th>Par secteur</th>
                <th>Par région</th>
                <th>Points d’historique</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{stats.segmentCounts.companySize}</td>
                <td>{stats.segmentCounts.sector}</td>
                <td>{stats.segmentCounts.region}</td>
                <td>{stats.historyCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </AdminCard>

      <AdminCard variant="compact" className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Synthèse IA publique</h2>
        <p className="admin-help">
          Analyse rédigée par IA, ancrée sur les chiffres vérifiés, affichée sur la page publique.
          Régénérée automatiquement quand l’effectif change ; bouton ci-dessous pour forcer.
        </p>
        {stats.analysis ? (
          <div className="mt-[var(--space-admin-4)]">
            <p className="admin-help">
              Générée le {new Date(stats.analysis.generatedAt).toLocaleString("fr-FR")} · ancrée sur{" "}
              {stats.analysis.basedOnTotal} réponses
              {stats.analysis.basedOnTotal !== stats.totalResponses
                ? ` · effectif actuel : ${stats.totalResponses} — régénération conseillée`
                : " à jour"}
              .
            </p>
            <blockquote className="text-fg-soft mt-[var(--space-admin-3)] border-l-2 pl-3 text-sm italic">
              {stats.analysis.overview}
            </blockquote>
          </div>
        ) : (
          <p className="admin-help mt-[var(--space-admin-3)]">
            Aucune analyse en cache. {stats.realResponses === 0 ? "Aucune réponse réelle." : ""}
          </p>
        )}
        <form action={regenerateBarometerAnalysisForm} className="mt-[var(--space-admin-4)]">
          <button type="submit" className="admin-button-cta">
            Régénérer l’analyse
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

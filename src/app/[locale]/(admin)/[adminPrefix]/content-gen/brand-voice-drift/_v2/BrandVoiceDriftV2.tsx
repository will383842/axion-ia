// Refonte admin V2 — Sprint H 2026-05-22 Brand Voice Drift Monitor.
//
// Server Component affichant les stats de dérive brand voice + liste articles flaggés.
// AdminPageShell + AdminPageHeader + AdminCard + AdminStatCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminStatCard } from "@/components/admin/ui";
import { FileText, AlertTriangle, AlertOctagon } from "lucide-react";
import { getBrandVoiceDriftStats } from "@/server/actions/content-gen/brand-voice";
import { RecalibrateBrandVoiceForm } from "./RecalibrateBrandVoiceForm";

interface Props {
  adminPrefix: string;
}

export async function BrandVoiceDriftV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const base = `/fr/${adminPrefix}/content-gen`;

  const stats = await getBrandVoiceDriftStats().catch(() => null);

  // Articles de référence pour la recalibration : on s'appuie sur les articles
  // récemment analysés (dérives détectées). L'action serveur ignore ceux sans
  // embedding et throw si aucun n'en a — feedback géré dans le form.
  const recalibrateArticleIds = Array.from(
    new Set((stats?.recentDrifts ?? []).map((d) => d.articleId)),
  );

  const lastRunLabel = stats?.lastRunAt
    ? new Date(stats.lastRunAt).toLocaleString("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Jamais exécuté";

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Détection de dérive de la voix de marque"
        description="Monitoring quotidien (04:00 UTC) — similarité cosinus article vs référence Manon. Alerte si < 0.80."
        actions={<RecalibrateBrandVoiceForm articleIds={recalibrateArticleIds} />}
      />

      {/* Statut embedding référence */}
      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Configuration</h2>
        <ul className="admin-meta-block">
          <li>
            Embedding de référence configuré :{" "}
            <strong>
              {stats?.referenceConfigured ? (
                <span style={{ color: "var(--color-admin-success)" }}>Oui</span>
              ) : (
                <span style={{ color: "var(--color-admin-terracotta)" }}>
                  Non — recalibrez depuis les articles publiés ci-dessous
                </span>
              )}
            </strong>
          </li>
          <li>
            Dernier passage : <strong>{lastRunLabel}</strong>
          </li>
        </ul>
      </AdminCard>

      {/* Stats du dernier run */}
      {stats && (
        <AdminCard className="mb-[var(--space-admin-5)]">
          <h2 className="admin-h2">Stats — 30 derniers jours</h2>
          <div className="mt-[var(--space-admin-4)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-3">
            <AdminStatCard
              label="Articles analysés"
              value={String(stats.articlesAnalyzed)}
              meta="fenêtre du dernier passage"
              icon={FileText}
            />
            <AdminStatCard
              label="Articles flaggés (< 0.80)"
              value={String(stats.articlesFlagged)}
              meta="alerte de dérive 30j"
              tone={stats.articlesFlagged > 0 ? "warning" : "default"}
              icon={AlertTriangle}
            />
            <AdminStatCard
              label="Articles needs_review (< 0.70)"
              value={String(stats.articlesNeedsReview)}
              meta="dérive sévère 30j"
              tone={stats.articlesNeedsReview > 0 ? "destructive" : "default"}
              icon={AlertOctagon}
            />
          </div>
        </AdminCard>
      )}

      {/* Liste des dérives récentes */}
      <AdminCard>
        <h2 className="admin-h2">Top 10 articles en dérive (30 derniers jours)</h2>

        {!stats || stats.recentDrifts.length === 0 ? (
          <p className="admin-meta-block">
            {stats?.referenceConfigured
              ? "Aucune dérive détectée sur les 30 derniers jours."
              : "Embedding de référence non configuré — exécutez une recalibration pour commencer."}
          </p>
        ) : (
          <div className="mt-[var(--space-admin-4)] overflow-x-auto">
            <table className="admin-table w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Article ID</th>
                  <th className="px-3 py-2 text-left">Similarité</th>
                  <th className="px-3 py-2 text-left">Niveau</th>
                  <th className="px-3 py-2 text-left">Détecté le</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentDrifts.map((drift) => (
                  <tr key={drift.id} className="border-t border-[color:var(--color-admin-border)]">
                    <td className="px-3 py-2">
                      <code className="text-xs">{drift.articleId.slice(0, 12)}…</code>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        style={{
                          color:
                            drift.similarity < 0.7
                              ? "var(--color-admin-terracotta)"
                              : "var(--color-admin-warning)",
                          fontWeight: "bold",
                        }}
                      >
                        {drift.similarity.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          drift.level === "needs_review"
                            ? "admin-badge-error"
                            : "admin-badge-warning"
                        }
                      >
                        {drift.level === "needs_review" ? "Revue requise" : "Avertissement"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-[color:var(--color-admin-muted)]">
                      {new Date(drift.detectedAt).toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`${base}/publications?articleId=${drift.articleId}`}
                        className="admin-link text-xs"
                      >
                        Voir l&apos;article
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-[var(--space-admin-5)] border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-4)]">
          <h3 className="admin-h3 mb-[var(--space-admin-3)]">Seuils de détection</h3>
          <ul className="admin-meta-block text-sm">
            <li>
              <strong>similarity &lt; 0.70</strong> → Article mis en <code>needs_review</code> +
              audit log SOC2
            </li>
            <li>
              <strong>0.70 ≤ similarity &lt; 0.80</strong> → Drift warning loggé (audit log SOC2,
              pas de changement de statut)
            </li>
            <li>
              <strong>similarity ≥ 0.80</strong> → OK, dans la tonalité brand voice
            </li>
          </ul>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}

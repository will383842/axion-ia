/**
 * Content Generator — Admin dashboard (Sprint 3 § 12.2 master prompt).
 *
 * Lecture KPIs 7j + état queue + KB health + kill-switch status + quick
 * actions vers les sous-sections. Server Component pur — `force-dynamic`
 * pour toujours afficher les dernières valeurs DB.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDashboardKpis } from "@/server/actions/content-gen/dashboard";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function ContentGenDashboardPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const base = `/fr/${adminPrefix}/content-gen`;
  const kpis = await getDashboardKpis();

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Générateur de contenus</h1>
          <p className="admin-meta">
            Console pilotage Will · doctrine AxionIA ≥ 95 % · FR uniquement · auteur Manon
            {kpis.killSwitchActive ? (
              <strong style={{ marginLeft: 12, color: "var(--color-terracotta)" }}>
                🛑 Kill switch ACTIF — toutes générations stoppées
              </strong>
            ) : null}
          </p>
        </div>
        <div className="admin-dashboard-actions">
          <a href={`${base}/coverage/new`} className="admin-button">
            + Nouvelle campagne
          </a>
          <a href={`${base}/settings/kill-switch`} className="admin-button-ghost">
            Kill switch
          </a>
        </div>
      </div>

      <div className="admin-card-grid" style={{ marginBottom: 24 }}>
        <KpiCard label="Jobs (7 j)" value={kpis.jobsRun7d} />
        <KpiCard label="Publiés (7 j)" value={kpis.published7d} />
        <KpiCard
          label="Failed (7 j)"
          value={kpis.failed7d}
          tone={kpis.failed7d > 0 ? "warn" : undefined}
        />
        <KpiCard label="En revue" value={kpis.pendingReview} />
        <KpiCard label="Coût 7 j (USD)" value={`$${kpis.costSpent7dUsd.toFixed(2)}`} />
        <KpiCard
          label="Score qualité moyen"
          value={kpis.avgQualityScore7d != null ? kpis.avgQualityScore7d.toFixed(1) : "—"}
        />
        <KpiCard label="Plagiat bloqués" value={kpis.plagiarismBlocks7d} />
        <KpiCard label="KB entries" value={kpis.kbHealth.chunks} />
      </div>

      <div className="admin-card">
        <h2>Queue temps réel</h2>
        <ul className="admin-inline-list">
          <li>
            <strong>En cours :</strong> {kpis.activeQueue.running}
          </li>
          <li>
            <strong>En attente :</strong> {kpis.activeQueue.waiting}
          </li>
          <li>
            <strong>Failed :</strong> {kpis.activeQueue.failed}
          </li>
          <li>
            <a href={`${base}/queue`} className="admin-button-ghost">
              Inspecter BullMQ →
            </a>
          </li>
        </ul>
      </div>

      <div className="admin-card">
        <h2>Pilotage rapide</h2>
        <ul className="admin-quick-actions">
          <li>
            <a href={`${base}/coverage`}>📦 Campagnes de couverture</a>
          </li>
          <li>
            <a href={`${base}/geo`}>🗺️ Cockpit géographique</a>
          </li>
          <li>
            <a href={`${base}/jobs`}>🛠️ Jobs &amp; logs</a>
          </li>
          <li>
            <a href={`${base}/review-queue`}>👀 Review queue ({kpis.pendingReview})</a>
          </li>
          <li>
            <a href={`${base}/publications-status`}>📋 Statut publications (kanban)</a>
          </li>
          <li>
            <a href={`${base}/templates`}>📝 Templates de prompts</a>
          </li>
          <li>
            <a href={`${base}/rss`}>📡 Sources RSS</a>
          </li>
          <li>
            <a href={`${base}/similarity-monitor`}>🧬 Anti-doublon</a>
          </li>
          <li>
            <a href={`${base}/orchestrator`}>🎼 Orchestrateur</a>
          </li>
          <li>
            <a href={`${base}/costs`}>💸 Coûts &amp; budget</a>
          </li>
          <li>
            <a href={`${base}/author/manon`}>✍️ Profil auteur Manon</a>
          </li>
          <li>
            <a href={`${base}/kb-readonly`}>📚 KB (lecture seule)</a>
          </li>
        </ul>
      </div>

      <div className="admin-card">
        <h2>Réglages</h2>
        <ul className="admin-quick-actions">
          <li>
            <a href={`${base}/settings/providers`}>Providers IA &amp; cost caps</a>
          </li>
          <li>
            <a href={`${base}/settings/batches`}>Batches &amp; workers</a>
          </li>
          <li>
            <a href={`${base}/settings/policies`}>Policies (skip, plagiat, retention)</a>
          </li>
          <li>
            <a href={`${base}/settings/coverage-distribution`}>Distribution 5 types contenu</a>
          </li>
          <li>
            <a href={`${base}/settings/audience-mix`}>Mix audiences (taille × organisation)</a>
          </li>
          <li>
            <a href={`${base}/settings/search-intent-distribution`}>Distribution intentions</a>
          </li>
          <li>
            <a href={`${base}/settings/quality-loop`}>Boucle qualité</a>
          </li>
          <li>
            <a href={`${base}/settings/qa-policies`}>Q/R post-process</a>
          </li>
          <li>
            <a href={`${base}/settings/banned-phrases`}>Phrases interdites</a>
          </li>
          <li>
            <a href={`${base}/settings/llms-txt`}>llms.txt édition</a>
          </li>
        </ul>
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly tone?: "warn" | undefined;
}) {
  return (
    <div
      className="admin-card admin-kpi-card"
      style={tone === "warn" ? { borderColor: "var(--color-terracotta)" } : undefined}
    >
      <p className="admin-kpi-label">{label}</p>
      <p className="admin-kpi-value">{value}</p>
    </div>
  );
}

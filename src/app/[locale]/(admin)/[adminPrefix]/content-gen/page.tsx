/**
 * Content Generator — Admin dashboard (Sprint 3 § 12.2 master prompt).
 *
 * Lecture KPIs 7j + état queue + KB health + kill-switch status + quick
 * actions vers les sous-sections. Server Component pur — `force-dynamic`
 * pour toujours afficher les dernières valeurs DB.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDashboardKpis, getSectorBreakdownToday } from "@/server/actions/content-gen/dashboard";
import { enqueueDirectGen } from "@/server/actions/content-gen/enqueue";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { ContentGenDashboardV2 } from "./_v2/ContentGenDashboardV2";
import type { ContentType, SearchIntent } from "../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function ContentGenDashboardPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <ContentGenDashboardV2 adminPrefix={adminPrefix} />;
  }

  const base = `/fr/${adminPrefix}/content-gen`;
  const [kpis, sectorBreakdown] = await Promise.all([
    getDashboardKpis(),
    getSectorBreakdownToday(),
  ]);

  // Quick actions § 12.2 master prompt — 5 boutons "Générer X…" inline.
  // Pour V1, on accepte les champs minimaux : contentType + ville/keyword/title
  // selon le type. Le worker pickera et le generator dérivera le reste depuis
  // la KB + searchIntent.
  async function quickGen(formData: FormData) {
    "use server";
    const contentType = String(formData.get("contentType") ?? "") as ContentType;
    const targetSearchIntent =
      (String(formData.get("targetSearchIntent") ?? "informational") as SearchIntent) ||
      "informational";
    const anchorVilleSlug = String(formData.get("anchorVilleSlug") ?? "").trim();
    const primaryKeyword = String(formData.get("primaryKeyword") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const result = await enqueueDirectGen({
      contentType,
      targetSearchIntent,
      ...(anchorVilleSlug ? { anchorVilleSlug } : {}),
      ...(primaryKeyword ? { primaryKeyword } : {}),
      ...(title ? { title } : {}),
    });
    redirect(`/fr/${adminPrefix}/content-gen/jobs/${result.jobId}`);
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Générateur de contenus</h1>
          <p className="admin-meta">
            Console pilotage Will · doctrine Axion-IA ≥ 95 % · FR uniquement · auteur Manon
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

      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h2>Rollup aujourd&apos;hui — secteurs &amp; pipelines indépendants</h2>
        <p className="admin-meta" style={{ marginTop: 0, marginBottom: 12 }}>
          3 secteurs éditoriaux (campagnes ciblées) + 2 pipelines indépendants (landing villes,
          RSS). Fenêtre depuis minuit UTC.
        </p>
        <div
          className="admin-card-grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}
        >
          {sectorBreakdown.cards.map((c) => {
            const href =
              c.key === "landing_ville" || c.key === "blog_from_rss"
                ? `${base}/jobs?contentType=${c.key}`
                : `${base}/jobs?serviceSector=${c.key}`;
            return (
              <a
                key={c.key}
                href={href}
                className="admin-card admin-kpi-card"
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <p className="admin-kpi-label" style={{ fontSize: 12 }}>
                  {c.label}
                </p>
                <p className="admin-kpi-value" style={{ fontSize: 24 }}>
                  {c.publishedToday}
                  <span style={{ fontSize: 14, opacity: 0.6 }}> / {c.generatedToday}</span>
                </p>
                <p className="admin-meta" style={{ fontSize: 11, marginTop: 4 }}>
                  publiés / générés
                  {c.failedToday > 0 ? (
                    <span style={{ color: "var(--color-terracotta)" }}>
                      {" "}
                      {/* hex-ok: pas de fallback hex (token toujours dispo) */} · {c.failedToday}{" "}
                      fail
                    </span>
                  ) : null}
                  {c.campaignsActive > 0 ? ` · ${c.campaignsActive} camp. live` : ""}
                </p>
              </a>
            );
          })}
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
        <h2>Génération unitaire (§ 12.2)</h2>
        <p className="admin-meta" style={{ marginTop: 0, marginBottom: 16 }}>
          Lance 1 contenu pour test ou ad-hoc. Pour la production en masse, utiliser{" "}
          <a href={`${base}/coverage/new`}>Nouvelle campagne</a>.
        </p>
        <div
          className="admin-card-grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}
        >
          <QuickGenForm
            action={quickGen}
            contentType="landing_ville"
            targetSearchIntent="local"
            label="🏙️ Générer landing ville"
            inputs={[
              { name: "anchorVilleSlug", placeholder: "ville-slug (ex. lyon)", required: true },
            ]}
          />
          <QuickGenForm
            action={quickGen}
            contentType="blog_from_title"
            targetSearchIntent="informational"
            label="📝 Générer article (depuis titre)"
            inputs={[{ name: "title", placeholder: "Titre article", required: true }]}
          />
          <QuickGenForm
            action={quickGen}
            contentType="blog_from_keywords"
            targetSearchIntent="informational"
            label="🔑 Générer article (depuis mot-clé)"
            inputs={[{ name: "primaryKeyword", placeholder: "Mot-clé principal", required: true }]}
          />
          <QuickGenForm
            action={quickGen}
            contentType="comparison"
            targetSearchIntent="commercial_investigation"
            label="⚖️ Générer comparatif"
            inputs={[
              {
                name: "title",
                placeholder: "Sujet comparatif (ex. Mistral vs Claude PME)",
                required: true,
              },
            ]}
          />
          <QuickGenForm
            action={quickGen}
            contentType="guide_pilier"
            targetSearchIntent="informational"
            label="📚 Générer guide pilier"
            inputs={[
              {
                name: "title",
                placeholder: "Sujet pilier (ex. Comment auditer son IA)",
                required: true,
              },
            ]}
          />
          <QuickGenForm
            action={quickGen}
            contentType="faq_standalone"
            targetSearchIntent="informational"
            label="❓ Générer FAQ standalone"
            inputs={[{ name: "title", placeholder: "Thématique FAQ", required: true }]}
          />
        </div>
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

function QuickGenForm({
  action,
  contentType,
  targetSearchIntent,
  label,
  inputs,
}: {
  readonly action: (fd: FormData) => Promise<void>;
  readonly contentType: ContentType;
  readonly targetSearchIntent: SearchIntent;
  readonly label: string;
  readonly inputs: ReadonlyArray<{
    readonly name: string;
    readonly placeholder: string;
    readonly required?: boolean;
  }>;
}) {
  return (
    <form
      action={action}
      style={{
        padding: 12,
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <input type="hidden" name="contentType" value={contentType} />
      <input type="hidden" name="targetSearchIntent" value={targetSearchIntent} />
      <strong style={{ fontSize: 14 }}>{label}</strong>
      {inputs.map((i) => (
        <input
          key={i.name}
          type="text"
          name={i.name}
          placeholder={i.placeholder}
          required={i.required ?? false}
          className="admin-input"
          style={{ fontSize: 13 }}
        />
      ))}
      <button type="submit" className="admin-button" style={{ fontSize: 13 }}>
        Lancer →
      </button>
    </form>
  );
}

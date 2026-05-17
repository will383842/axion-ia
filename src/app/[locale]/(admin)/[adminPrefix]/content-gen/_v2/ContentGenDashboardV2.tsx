// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Content-gen dashboard V2 — utilise AdminPageShell + AdminPageHeader + AdminCard
// + AdminStatCard. Server Component, re-fetch identique V1. Server Actions
// inline préservées (enqueueDirectGen). Pas de modif Server Actions ni Prisma.

import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminStatCard } from "@/components/admin/ui";
import { getDashboardKpis, getSectorBreakdownToday } from "@/server/actions/content-gen/dashboard";
import { enqueueDirectGen } from "@/server/actions/content-gen/enqueue";
import type { ContentType, SearchIntent } from "../../../../../../../prisma/generated/client";

interface Props {
  adminPrefix: string;
}

export async function ContentGenDashboardV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const base = `/fr/${adminPrefix}/content-gen`;
  const [kpis, sectorBreakdown] = await Promise.all([
    getDashboardKpis(),
    getSectorBreakdownToday(),
  ]);

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
    <AdminPageShell>
      <AdminPageHeader
        title="Générateur de contenus"
        description={
          kpis.killSwitchActive
            ? "🛑 Kill switch ACTIF — toutes générations stoppées · doctrine Axion-IA ≥ 95 % · FR uniquement · auteur Manon"
            : "Console pilotage Will · doctrine Axion-IA ≥ 95 % · FR uniquement · auteur Manon"
        }
        actions={
          <div className="flex gap-[var(--space-admin-3)]">
            <Link href={`${base}/coverage/new`} className="admin-button">
              + Nouvelle campagne
            </Link>
            <Link href={`${base}/settings/kill-switch`} className="admin-button-ghost">
              Kill switch
            </Link>
          </div>
        }
      />

      <AdminCard className="mb-[var(--space-admin-6)]">
        <h2 className="admin-h2">
          Rollup aujourd&apos;hui — secteurs &amp; pipelines indépendants
        </h2>
        <p className="admin-meta">
          3 secteurs éditoriaux (campagnes ciblées) + 2 pipelines indépendants (landing villes,
          RSS). Fenêtre depuis minuit UTC.
        </p>
        <div className="mt-[var(--space-admin-4)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {sectorBreakdown.cards.map((c) => {
            const href =
              c.key === "landing_ville" || c.key === "blog_from_rss"
                ? `${base}/jobs?contentType=${c.key}`
                : `${base}/jobs?serviceSector=${c.key}`;
            return (
              <AdminStatCard
                key={c.key}
                label={c.label}
                value={`${c.publishedToday} / ${c.generatedToday}`}
                meta={
                  c.failedToday > 0
                    ? `publiés / générés · ${c.failedToday} fail${c.campaignsActive > 0 ? ` · ${c.campaignsActive} camp. live` : ""}`
                    : `publiés / générés${c.campaignsActive > 0 ? ` · ${c.campaignsActive} camp. live` : ""}`
                }
                tone={c.failedToday > 0 ? "warning" : "default"}
                href={href}
              />
            );
          })}
        </div>
      </AdminCard>

      <section
        aria-label="KPIs 7 jours"
        className="mb-[var(--space-admin-6)] grid grid-cols-2 gap-[var(--space-admin-4)] md:grid-cols-4 lg:grid-cols-8"
      >
        <AdminStatCard label="Jobs (7 j)" value={kpis.jobsRun7d} />
        <AdminStatCard label="Publiés (7 j)" value={kpis.published7d} />
        <AdminStatCard
          label="Failed (7 j)"
          value={kpis.failed7d}
          tone={kpis.failed7d > 0 ? "warning" : "default"}
        />
        <AdminStatCard label="En revue" value={kpis.pendingReview} />
        <AdminStatCard label="Coût 7 j (USD)" value={`$${kpis.costSpent7dUsd.toFixed(2)}`} />
        <AdminStatCard
          label="Score qualité moyen"
          value={kpis.avgQualityScore7d != null ? kpis.avgQualityScore7d.toFixed(1) : "—"}
        />
        <AdminStatCard label="Plagiat bloqués" value={kpis.plagiarismBlocks7d} />
        <AdminStatCard label="KB entries" value={kpis.kbHealth.chunks} />
      </section>

      <AdminCard className="mb-[var(--space-admin-6)]">
        <h2 className="admin-h2">Queue temps réel</h2>
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
            <Link href={`${base}/queue`} className="admin-button-ghost">
              Inspecter BullMQ →
            </Link>
          </li>
        </ul>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-6)]">
        <h2 className="admin-h2">Génération unitaire (§ 12.2)</h2>
        <p className="admin-meta">
          Lance 1 contenu pour test ou ad-hoc. Pour la production en masse, utiliser{" "}
          <Link href={`${base}/coverage/new`} className="admin-link">
            Nouvelle campagne
          </Link>
          .
        </p>
        <div className="mt-[var(--space-admin-4)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-3">
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
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-6)]">
        <h2 className="admin-h2">Pilotage rapide</h2>
        <ul className="admin-quick-actions">
          <li>
            <Link href={`${base}/coverage`}>📦 Campagnes de couverture</Link>
          </li>
          <li>
            <Link href={`${base}/geo`}>🗺️ Cockpit géographique</Link>
          </li>
          <li>
            <Link href={`${base}/jobs`}>🛠️ Jobs &amp; logs</Link>
          </li>
          <li>
            <Link href={`${base}/review-queue`}>👀 Review queue ({kpis.pendingReview})</Link>
          </li>
          <li>
            <Link href={`${base}/publications-status`}>📋 Statut publications (kanban)</Link>
          </li>
          <li>
            <Link href={`${base}/templates`}>📝 Templates de prompts</Link>
          </li>
          <li>
            <Link href={`${base}/rss`}>📡 Sources RSS</Link>
          </li>
          <li>
            <Link href={`${base}/similarity-monitor`}>🧬 Anti-doublon</Link>
          </li>
          <li>
            <Link href={`${base}/orchestrator`}>🎼 Orchestrateur</Link>
          </li>
          <li>
            <Link href={`${base}/costs`}>💸 Coûts &amp; budget</Link>
          </li>
          <li>
            <Link href={`${base}/author/manon`}>✍️ Profil auteur Manon</Link>
          </li>
          <li>
            <Link href={`${base}/kb-readonly`}>📚 KB (lecture seule)</Link>
          </li>
        </ul>
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Réglages</h2>
        <ul className="admin-quick-actions">
          <li>
            <Link href={`${base}/settings/providers`}>Providers IA &amp; cost caps</Link>
          </li>
          <li>
            <Link href={`${base}/settings/batches`}>Batches &amp; workers</Link>
          </li>
          <li>
            <Link href={`${base}/settings/policies`}>Policies (skip, plagiat, retention)</Link>
          </li>
          <li>
            <Link href={`${base}/settings/coverage-distribution`}>
              Distribution 5 types contenu
            </Link>
          </li>
          <li>
            <Link href={`${base}/settings/audience-mix`}>
              Mix audiences (taille × organisation)
            </Link>
          </li>
          <li>
            <Link href={`${base}/settings/search-intent-distribution`}>
              Distribution intentions
            </Link>
          </li>
          <li>
            <Link href={`${base}/settings/quality-loop`}>Boucle qualité</Link>
          </li>
          <li>
            <Link href={`${base}/settings/qa-policies`}>Q/R post-process</Link>
          </li>
          <li>
            <Link href={`${base}/settings/banned-phrases`}>Phrases interdites</Link>
          </li>
          <li>
            <Link href={`${base}/settings/llms-txt`}>llms.txt édition</Link>
          </li>
        </ul>
      </AdminCard>
    </AdminPageShell>
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
      className="flex flex-col gap-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]"
    >
      <input type="hidden" name="contentType" value={contentType} />
      <input type="hidden" name="targetSearchIntent" value={targetSearchIntent} />
      <strong className="text-[length:var(--text-admin-sm)]">{label}</strong>
      {inputs.map((i) => (
        <input
          key={i.name}
          type="text"
          name={i.name}
          placeholder={i.placeholder}
          required={i.required ?? false}
          className="admin-input"
        />
      ))}
      <button type="submit" className="admin-button">
        Lancer →
      </button>
    </form>
  );
}

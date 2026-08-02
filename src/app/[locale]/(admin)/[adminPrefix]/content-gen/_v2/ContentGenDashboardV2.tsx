// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Content-gen dashboard V2 — utilise AdminPageShell + AdminPageHeader + AdminCard
// + AdminStatCard. Server Component, re-fetch identique V1. Server Actions
// inline préservées (enqueueDirectGen). Pas de modif Server Actions ni Prisma.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminButton,
} from "@/components/admin/ui";
import {
  AlertTriangle,
  ArrowRight,
  ChartColumn,
  CheckCircle2,
  Database,
  FileText,
  Gauge,
  Hourglass,
  ListChecks,
  Rocket,
  ShieldCheck,
  Target,
  Wallet,
  Wrench,
} from "lucide-react";
import { getDashboardKpis, getSectorBreakdownToday } from "@/server/actions/content-gen/dashboard";
import { enqueueDirectGen } from "@/server/actions/content-gen/enqueue";
import { regenerateTier1Corpus } from "@/server/actions/content-gen/regenerate";
import { getCityCoverageProgress, getOrchestratorStats } from "@/server/actions/content-gen/geo";
import type { ContentType, SearchIntent } from "../../../../../../../prisma/generated/client";

interface Props {
  adminPrefix: string;
}

export async function ContentGenDashboardV2({ adminPrefix }: Props): Promise<React.ReactElement> {
  const base = `/fr/${adminPrefix}/content-gen`;
  const [kpis, sectorBreakdown, cityProgress, orchestrator] = await Promise.all([
    getDashboardKpis(),
    getSectorBreakdownToday(),
    getCityCoverageProgress(),
    getOrchestratorStats(),
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

  // Régénération EN PLACE (2026-06-22) — relance les N articles tier-1 les plus
  // anciens avec les blocs de la refonte templates (réponses-par-H2, avis
  // d'expert, point clé, images de corps, liens profonds). Slug PRÉSERVÉ (pas de
  // nouvelle URL). À lancer plusieurs fois pour couvrir tout le corpus.
  // ⚠️ Prérequis : KB seedée (assertKbReady) sinon les jobs bloquent ;
  // publication throttlée par le drip-window + daily-cap du worker.
  async function regenCorpus(formData: FormData): Promise<void> {
    "use server";
    const parsed = Number.parseInt(String(formData.get("limit") ?? "10"), 10);
    const limit = Number.isFinite(parsed) ? Math.max(1, Math.min(25, parsed)) : 10;
    await regenerateTier1Corpus({ limit });
    redirect(`/fr/${adminPrefix}/content-gen/jobs`);
  }

  // Onboarding zero-state : aucune campagne et aucun job → wizard premier pas
  const zeroCampaigns = orchestrator.activeCampaigns.length === 0 && kpis.jobsRun7d === 0;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Générateur de contenus"
        description={
          kpis.killSwitchActive
            ? "Kill switch ACTIF — toutes générations stoppées · doctrine Axion-IA ≥ 95 % · FR uniquement · auteur Manon"
            : "Console pilotage Will · doctrine Axion-IA ≥ 95 % · FR uniquement · auteur Manon"
        }
        actions={
          <div className="flex gap-[var(--space-admin-3)]">
            <Link href={`${base}/campaigns/new`} className="admin-button-cta">
              + Nouvelle campagne
            </Link>
            <Link href={`${base}/settings/kill-switch`} className="admin-button-ghost">
              Kill switch
            </Link>
          </div>
        }
      />

      <AdminCard className="mb-[var(--space-admin-6)]">
        <h2 className="admin-h2">Régénération en place — refonte templates</h2>
        <p className="admin-meta">
          Relance les articles tier-1 les plus anciens avec les nouveaux blocs (réponse sous chaque
          H2, avis d&apos;expert interne, point clé, images de corps, liens profonds). L&apos;URL
          est <strong>préservée</strong> (aucun doublon, aucun 301). Relancez plusieurs fois pour
          couvrir tout le corpus. Prérequis : KB seedée ; publication étalée par le drip-window +
          cap quotidien.
        </p>
        <form
          action={regenCorpus}
          className="mt-[var(--space-admin-4)] flex flex-wrap items-end gap-[var(--space-admin-3)]"
        >
          <label className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
            Nombre d&apos;articles (1–25)
            <input
              type="number"
              name="limit"
              min={1}
              max={25}
              defaultValue={10}
              className="admin-input w-[120px]"
            />
          </label>
          <AdminButton type="submit" iconAfter={ArrowRight}>
            Régénérer le lot tier-1
          </AdminButton>
        </form>
      </AdminCard>

      {zeroCampaigns && (
        <AdminCard className="mb-[var(--space-admin-6)] border-2 border-[color:var(--color-admin-terracotta)]">
          <h2 className="admin-h2 flex items-center gap-[var(--space-admin-3)]">
            <Rocket
              size={17}
              aria-hidden="true"
              className="shrink-0 text-[color:var(--color-admin-accent)]"
            />
            Démarrer la génération de contenus
          </h2>
          <p className="admin-meta-block">
            Aucune campagne active. Créez votre première campagne depuis un preset ou en mode libre.
          </p>
          <div className="mt-[var(--space-admin-4)] flex flex-wrap gap-[var(--space-admin-4)]">
            <AdminButton href={`${base}/coverage/presets`} iconAfter={ArrowRight}>
              Choisir un preset
            </AdminButton>
            <Link href={`${base}/campaigns/new`} className="admin-button-ghost">
              Campagne libre
            </Link>
          </div>
        </AdminCard>
      )}

      <AdminCard className="mb-[var(--space-admin-6)]">
        <h2 className="admin-h2">Récapitulatif du jour — secteurs &amp; pipelines indépendants</h2>
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
                    ? `publiés / générés · ${c.failedToday} échec(s)${c.campaignsActive > 0 ? ` · ${c.campaignsActive} camp. live` : ""}`
                    : `publiés / générés${c.campaignsActive > 0 ? ` · ${c.campaignsActive} camp. live` : ""}`
                }
                tone={c.failedToday > 0 ? "warning" : "default"}
                href={href}
                icon={FileText}
              />
            );
          })}
        </div>
      </AdminCard>

      <section
        aria-label="KPIs 7 jours"
        className="mb-[var(--space-admin-6)] grid grid-cols-2 gap-[var(--space-admin-4)] md:grid-cols-4 lg:grid-cols-8"
      >
        <AdminStatCard label="Tâches (7 j)" value={kpis.jobsRun7d} icon={ListChecks} />
        <AdminStatCard label="Publiés (7 j)" value={kpis.published7d} icon={CheckCircle2} />
        <AdminStatCard
          label="Échecs (7 j)"
          value={kpis.failed7d}
          tone={kpis.failed7d > 0 ? "warning" : "default"}
          icon={AlertTriangle}
        />
        <AdminStatCard label="En revue" value={kpis.pendingReview} icon={Hourglass} />
        <AdminStatCard
          label="Coût 7 j (USD)"
          value={`$${kpis.costSpent7dUsd.toFixed(2)}`}
          icon={Wallet}
        />
        <AdminStatCard
          label="Score qualité moyen"
          value={kpis.avgQualityScore7d != null ? kpis.avgQualityScore7d.toFixed(1) : "—"}
          icon={Gauge}
        />
        <AdminStatCard label="Plagiat bloqués" value={kpis.plagiarismBlocks7d} icon={ShieldCheck} />
        <AdminStatCard label="Entrées KB" value={kpis.kbHealth.chunks} icon={Database} />
      </section>

      {/* P2 — Progression couverture villes */}
      <AdminCard className="mb-[var(--space-admin-6)]">
        <h2 className="admin-h2">Progression couverture villes</h2>
        <p className="admin-meta-block">
          {cityProgress.publishedVilles} / {cityProgress.targetVilles} villes avec au moins 1
          article publié
        </p>
        <div className="mt-[var(--space-admin-3)]">
          <progress
            value={cityProgress.publishedVilles}
            max={cityProgress.targetVilles}
            aria-label={`${cityProgress.pct}% des villes cibles couvertes`}
            style={{
              width: "100%",
              height: 12,
              appearance: "none",
              borderRadius: "var(--radius-admin-sm)",
              overflow: "hidden",
              accentColor:
                cityProgress.pct < 33
                  ? "var(--color-admin-destructive)"
                  : cityProgress.pct < 66
                    ? "var(--color-admin-warning)"
                    : "var(--color-admin-success)",
            }}
          />
          <p className="admin-meta mt-[var(--space-admin-2)]">
            {cityProgress.pct}%{" "}
            {cityProgress.pct < 33
              ? "démarrage"
              : cityProgress.pct < 66
                ? "en progression"
                : "bonne couverture"}
            {" · "}
            <AdminButton
              href={`${base}/city-coverage`}
              variant="ghost"
              size="sm"
              iconAfter={ArrowRight}
            >
              Détail villes
            </AdminButton>
          </p>
        </div>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-6)]">
        <h2 className="admin-h2">File d&apos;attente temps réel</h2>
        <ul className="admin-inline-list">
          <li>
            <strong>En cours :</strong> {kpis.activeQueue.running}
          </li>
          <li>
            <strong>En attente :</strong> {kpis.activeQueue.waiting}
          </li>
          <li>
            <strong>Échecs :</strong> {kpis.activeQueue.failed}
          </li>
          <li>
            <AdminButton href={`${base}/jobs`} variant="ghost" iconAfter={ArrowRight}>
              Voir la file d&apos;attente
            </AdminButton>
          </li>
        </ul>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-6)]">
        <h2 className="admin-h2">Génération unitaire (§ 12.2)</h2>
        <p className="admin-meta">
          Lance 1 contenu pour test ou ad-hoc. Pour la production en masse, utiliser{" "}
          <Link href={`${base}/campaigns/new`} className="admin-link">
            Nouvelle campagne
          </Link>
          .
        </p>
        <div className="mt-[var(--space-admin-4)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-3">
          <QuickGenForm
            action={quickGen}
            contentType="landing_ville"
            targetSearchIntent="local"
            label="Générer landing ville"
            inputs={[
              { name: "anchorVilleSlug", placeholder: "ville-slug (ex. lyon)", required: true },
            ]}
          />
          <QuickGenForm
            action={quickGen}
            contentType="blog_from_title"
            targetSearchIntent="informational"
            label="Générer article (depuis titre)"
            inputs={[{ name: "title", placeholder: "Titre article", required: true }]}
          />
          <QuickGenForm
            action={quickGen}
            contentType="blog_from_keywords"
            targetSearchIntent="informational"
            label="Générer article (depuis mot-clé)"
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
            label="Générer guide pilier"
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
            label="Générer FAQ standalone"
            inputs={[{ name: "title", placeholder: "Thématique FAQ", required: true }]}
          />
        </div>
      </AdminCard>

      {/* P0-5 Sprint P5 — 4 sections sémantiques / P5.x — badges compteurs */}
      <div className="grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-4">
        <AdminCard>
          <h2 className="admin-h2 flex items-center gap-[var(--space-admin-3)]">
            <Target
              size={17}
              aria-hidden="true"
              className="shrink-0 text-[color:var(--color-admin-accent)]"
            />
            Pilotage
          </h2>
          <ul className="admin-quick-actions mt-[var(--space-admin-3)]">
            <li>
              <Link href={`${base}/coverage`}>
                Campagnes
                {orchestrator.activeCampaigns.length > 0 && (
                  <span className="admin-badge ml-[var(--space-admin-2)]">
                    {orchestrator.activeCampaigns.length} actives
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link href={`${base}/costs`}>Coûts &amp; budget</Link>
            </li>
            <li>
              <Link href={`${base}/quality`}>
                Qualité
                {kpis.pendingReview > 0 && (
                  <span className="admin-badge ml-[var(--space-admin-2)]">
                    {kpis.pendingReview} en revue
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link href={`${base}/geo`}>Cockpit géo</Link>
            </li>
          </ul>
        </AdminCard>

        <AdminCard>
          <h2 className="admin-h2 flex items-center gap-[var(--space-admin-3)]">
            <Wrench
              size={17}
              aria-hidden="true"
              className="shrink-0 text-[color:var(--color-admin-accent)]"
            />
            Sources
          </h2>
          <ul className="admin-quick-actions mt-[var(--space-admin-3)]">
            <li>
              <Link href={`${base}/rss`}>Sources RSS</Link>
            </li>
            <li>
              <Link href={`${base}/keyword-tracking`}>Suivi des mots-clés</Link>
            </li>
            <li>
              {/* Dédup 2026-08-01 (phase 2) : pointe la vraie page Connaissances,
                  filtrée sur le périmètre qu'affichait kb-readonly. */}
              <Link href={`/fr/${adminPrefix}/connaissances?status=published`}>
                KB (lecture seule)
                {kpis.kbHealth.chunks > 0 && (
                  <span className="admin-badge ml-[var(--space-admin-2)]">
                    {kpis.kbHealth.chunks}
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link href={`${base}/coverage/presets`}>Presets campagnes</Link>
            </li>
            <li>
              <Link href={`${base}/templates`}>Templates prompts</Link>
            </li>
          </ul>
        </AdminCard>

        <AdminCard>
          <h2 className="admin-h2 flex items-center gap-[var(--space-admin-3)]">
            <ChartColumn
              size={17}
              aria-hidden="true"
              className="shrink-0 text-[color:var(--color-admin-accent)]"
            />
            Suivi
          </h2>
          <ul className="admin-quick-actions mt-[var(--space-admin-3)]">
            <li>
              <Link href={`${base}/jobs`}>
                Tâches &amp; journaux
                {kpis.activeQueue.running + kpis.activeQueue.waiting > 0 && (
                  <span className="admin-badge ml-[var(--space-admin-2)]">
                    {kpis.activeQueue.running + kpis.activeQueue.waiting} actifs
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link href={`${base}/review-queue`}>
                File de revue
                {kpis.pendingReview > 0 && (
                  <span className="admin-badge ml-[var(--space-admin-2)]">
                    {kpis.pendingReview}
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link href={`${base}/city-coverage`}>
                Villes couvertes
                <span className="admin-badge ml-[var(--space-admin-2)]">
                  {cityProgress.publishedVilles}/{cityProgress.targetVilles}
                </span>
              </Link>
            </li>
            <li>
              <Link href={`${base}/geo/coverage-table`}>Tableau croisé</Link>
            </li>
            <li>
              <Link href={`${base}/similarity-monitor`}>Anti-doublon</Link>
            </li>
          </ul>
        </AdminCard>

        <AdminCard>
          <h2 className="admin-h2">Réglages</h2>
          <ul className="admin-quick-actions mt-[var(--space-admin-3)]">
            <li>
              <Link href={`${base}/settings/providers`}>Fournisseurs IA</Link>
            </li>
            <li>
              <Link href={`${base}/settings/batches`}>Batches &amp; workers</Link>
            </li>
            <li>
              <Link href={`${base}/settings/quality-loop`}>Boucle qualité</Link>
            </li>
            <li>
              <Link href={`${base}/settings/kill-switch`}>Kill switch</Link>
            </li>
            <li>
              <Link href={`${base}/settings`}>Tous les réglages →</Link>
            </li>
          </ul>
        </AdminCard>
      </div>
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
          aria-label={i.placeholder}
          key={i.name}
          type="text"
          name={i.name}
          placeholder={i.placeholder}
          required={i.required ?? false}
          className="admin-input"
        />
      ))}
      <AdminButton type="submit" iconAfter={ArrowRight}>
        Lancer
      </AdminButton>
    </form>
  );
}

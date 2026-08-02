// Refonte admin mai 2026 — PR 10 (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Web Vitals V2 — AdminPageShell + AdminPageHeader + AdminCard + AdminStatCard.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { BarChart3, Link as LinkIcon, AlertTriangle, Database } from "lucide-react";

const WINDOW_HOURS = 24;
const MIN_SAMPLES = 5;
const TABLE_CAP = 200;

interface AggregateRow {
  url: string;
  metric: string;
  count: number;
  p75: number;
  budget: number;
  breach: boolean;
}

interface Props {
  adminPrefix: string;
  totalSamples: number;
  routeCount: number;
  breachCount: number;
  isLive: boolean;
  computedAt: string;
  display: ReadonlyArray<AggregateRow>;
  aggregatesLength: number;
  lastAlertSentAt: string | undefined;
  lastAlertBreachCount: number | undefined;
  recomputeEnabled: boolean;
  triggerRecomputeAction: () => Promise<void>;
}

function fmtValue(metric: string, v: number): string {
  if (metric === "CLS") return v.toFixed(3);
  return `${Math.round(v)} ms`;
}

/**
 * Libellés humains des métriques Web Vitals — un non-technicien (Will) ne
 * doit jamais voir "LCP"/"INP"/"CLS" bruts sans traduction (audit UX admin).
 * Le code technique reste entre parenthèses pour qui veut le retrouver dans
 * PageSpeed Insights / Search Console.
 */
const METRIC_LABELS: Record<string, string> = {
  LCP: "Affichage du contenu principal (LCP)",
  INP: "Réactivité (INP)",
  CLS: "Stabilité visuelle (CLS)",
  FCP: "Premier affichage (FCP)",
  TTFB: "Réponse serveur (TTFB)",
  TBT: "Blocage total (TBT)",
};

function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric;
}

function classifyRating(metric: string, value: number): "good" | "needs_improvement" | "poor" {
  const seuils: Record<string, { good: number; poor: number }> = {
    LCP: { good: 2500, poor: 4000 },
    INP: { good: 200, poor: 500 },
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 },
    TBT: { good: 200, poor: 600 },
  };
  const t = seuils[metric];
  if (!t) return "good";
  if (value <= t.good) return "good";
  if (value <= t.poor) return "needs_improvement";
  return "poor";
}

// Track 2 : pill CrUX → <AdminBadge> (success=good, warning=needs-improvement,
// destructive=poor). Labels inchangés.
const RATING_LABELS: Record<"good" | "needs_improvement" | "poor", string> = {
  good: "● Good",
  needs_improvement: "● Needs improvement",
  poor: "● Poor",
};
const RATING_TONE: Record<
  "good" | "needs_improvement" | "poor",
  "success" | "warning" | "destructive"
> = {
  good: "success",
  needs_improvement: "warning",
  poor: "destructive",
};

function ratingPill(rating: "good" | "needs_improvement" | "poor") {
  return <AdminBadge tone={RATING_TONE[rating] ?? "neutral"}>{RATING_LABELS[rating]}</AdminBadge>;
}

function budgetPill(breach: boolean) {
  return (
    <span
      className={`admin-status-pill ${breach ? "admin-severity-critical" : "admin-severity-info"}`}
    >
      {breach ? "● Objectif dépassé" : "● Objectif atteint"}
    </span>
  );
}

function psiUrl(routePath: string): string {
  const site = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";
  const full = `${site}${routePath}`;
  return `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(full)}`;
}

export function WebVitalsV2({
  adminPrefix,
  totalSamples,
  routeCount,
  breachCount,
  isLive,
  computedAt,
  display,
  aggregatesLength,
  lastAlertSentAt,
  lastAlertBreachCount,
  recomputeEnabled,
  triggerRecomputeAction,
}: Props): React.ReactElement {
  const columns: ReadonlyArray<AdminTableColumn<AggregateRow>> = [
    {
      key: "url",
      header: "Route",
      cell: (row) => <code>{row.url}</code>,
    },
    {
      key: "metric",
      header: "Métrique",
      cell: (row) => <strong>{metricLabel(row.metric)}</strong>,
    },
    {
      key: "p75",
      header: "Temps mesuré",
      cell: (row) => (
        <span className={row.breach ? "font-bold" : ""}>{fmtValue(row.metric, row.p75)}</span>
      ),
    },
    {
      key: "budget",
      header: "Objectif",
      cell: (row) => fmtValue(row.metric, row.budget),
    },
    {
      key: "count",
      header: "Mesures",
      cell: (row) => row.count,
    },
    {
      key: "status",
      header: "Statut",
      cell: (row) => budgetPill(row.breach),
    },
    {
      key: "rating",
      header: "Repère Google (CrUX)",
      cell: (row) => ratingPill(classifyRating(row.metric, row.p75)),
    },
  ];

  // Verdict en langage clair, en tête de page (même esprit que /qualiopi/a-traiter) :
  // Will doit comprendre d'un coup d'œil si le site est rapide, sans lire de tableau.
  // Réutilise breachCount / aggregatesLength / routeCount déjà calculés côté page.tsx
  // (aucune nouvelle métrique inventée) — "mesure(s)" = une ligne (route × métrique),
  // volontairement pas "page(s)" pour rester fidèle à la granularité réellement mesurée.
  const noData = aggregatesLength === 0;
  const isGood = !noData && breachCount === 0;
  const verdictTone = noData
    ? "text-[color:var(--color-admin-fg-muted)]"
    : isGood
      ? "text-[color:var(--color-admin-success)]"
      : "text-[color:var(--color-admin-warning)]";
  const verdictText = noData
    ? `ℹ️ Pas encore assez de données pour juger la vitesse du site (minimum ${MIN_SAMPLES} mesures par page). Revenez dans 24 à 48h après la mise en production.`
    : isGood
      ? `Votre site est rapide — les ${aggregatesLength} mesure(s) suivies (sur ${routeCount} page(s)) respectent l'objectif de vitesse.`
      : `⚠️ ${breachCount} mesure(s) sur ${aggregatesLength} (sur ${routeCount} page(s) suivies) dépassent l'objectif de vitesse — voir le détail par page ci-dessous.`;

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Vitesse du site"
        description="Suivi en continu de la vitesse ressentie par vos visiteurs, mesurée sur les dernières 24 heures."
        actions={
          <Link href={`/fr/${adminPrefix}`} className="admin-link">
            ← Retour au tableau de bord
          </Link>
        }
      />

      <AdminCard className="mb-[var(--space-admin-6)]">
        <p className={`text-[length:var(--text-admin-lg)] font-semibold ${verdictTone}`}>
          {verdictText}
        </p>
      </AdminCard>

      <section
        aria-label="KPIs RUM"
        className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminStatCard
          label="Mesures collectées (24h)"
          value={totalSamples.toLocaleString("fr-FR")}
          icon={BarChart3}
        />
        <AdminStatCard label="Pages suivies" value={routeCount} icon={LinkIcon} />
        <AdminStatCard
          label="Mesures hors objectif"
          value={breachCount}
          tone={breachCount > 0 ? "destructive" : "default"}
          icon={AlertTriangle}
        />
        <AdminStatCard
          label="Source"
          value={isLive ? "Live (DB)" : "Snapshot worker"}
          meta={computedAt ? new Date(computedAt).toLocaleString("fr-FR") : "—"}
          icon={Database}
        />
      </section>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Budgets référence (AGENTS.md)</h2>
        <p className="admin-meta-block">
          Cible interne stricte (Web Vitals 2026 — voir{" "}
          <code>_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md</code>) : LCP ≤ 1 800 ms · INP ≤ 100 ms ·
          CLS = 0 (epsilon 0,01) · FCP ≤ 1 000 ms · TTFB ≤ 600 ms · TBT ≤ 150 ms. Google « good »
          plus laxiste (LCP 2 500 / INP 200 / CLS 0,1) — Axion-IA vise la perfection. Alerte
          Telegram tag <code>MONITORING</code> émise via helpers SSOT{" "}
          <code>content-gen-alerts.ts</code> par breach (runbook <code>R30</code>).
        </p>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Actions</h2>
        <form action={triggerRecomputeAction}>
          <button
            type="submit"
            className="admin-button"
            disabled={!recomputeEnabled}
            title={
              recomputeEnabled
                ? "Enqueue un tick worker pour recalculer immédiatement (sinon cron nightly 02:30 UTC)"
                : "BULLMQ_DISABLED — worker non disponible (probablement env dev)"
            }
          >
            Forcer un recompute
          </button>
        </form>
        <p className="admin-meta-small mt-[var(--space-admin-3)]">
          Le cron nightly écrit le snapshot toutes les nuits 02:30 UTC. Bouton utile pour vérifier
          immédiatement après un patch perf.
        </p>
        {lastAlertSentAt && (
          <p className="admin-meta-block mt-[var(--space-admin-3)]">
            <strong>Dernière alerte Telegram :</strong>{" "}
            {new Date(lastAlertSentAt).toLocaleString("fr-FR")} ({lastAlertBreachCount ?? 0}{" "}
            breaches notifiées)
          </p>
        )}
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Détail par page — top {Math.min(TABLE_CAP, aggregatesLength)}</h2>
        {display.length === 0 ? (
          <AdminEmptyState
            title={`Pas encore de mesure fiable sur les dernières ${WINDOW_HOURS}h (il faut au moins ${MIN_SAMPLES} visites par page pour être fiable). C'est normal en faible trafic — patientez 24-48h après mise en production pour des données stables.`}
          />
        ) : (
          <div className="mt-[var(--space-admin-3)]">
            <AdminTable
              columns={columns}
              rows={display}
              getRowId={(row) => `${row.url}-${row.metric}`}
              caption="Détail Web Vitals par route et métrique"
              rowAction={(row) => (
                <a
                  href={psiUrl(row.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-link"
                >
                  ↗
                </a>
              )}
            />
          </div>
        )}
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Lecture rapide</h2>
        <ul className="admin-meta-block">
          <li>
            <strong>Objectif dépassé</strong> = la vitesse mesurée dépasse la cible interne
            AGENTS.md (plus stricte que le seuil « bon » standard de Google). Une alerte Telegram a
            déjà été envoyée — voir <code>/alerts</code>.
          </li>
          <li>
            <strong>Repère Google (CrUX)</strong> = classification Google standard pour comparaison
            externe (Search Console, PageSpeed Insights). Indicatif, calculé côté visiteur.
          </li>
          <li>
            <strong>PSI ↗</strong> = lance un audit Lighthouse labo direct sur cette route. Utile
            quand le RUM agrège différents devices/réseaux et que tu veux voir une mesure contrôlée.
          </li>
          <li>
            <strong>Stack RUM</strong> : <code>WebVitals.tsx</code> (next/web-vitals) →{" "}
            <code>/api/vitals</code> (sendBeacon) → <code>WebVitalSample</code> Prisma. Worker
            agrège p75 nuitamment + alerte Telegram via helpers SSOT.
          </li>
        </ul>
      </AdminCard>
    </AdminPageShell>
  );
}

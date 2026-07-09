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
      {breach ? "● Hors budget" : "● Budget OK"}
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
      cell: (row) => <strong>{row.metric}</strong>,
    },
    {
      key: "p75",
      header: "p75",
      cell: (row) => (
        <span className={row.breach ? "font-bold" : ""}>{fmtValue(row.metric, row.p75)}</span>
      ),
    },
    {
      key: "budget",
      header: "Budget",
      cell: (row) => fmtValue(row.metric, row.budget),
    },
    {
      key: "count",
      header: "n",
      cell: (row) => row.count,
    },
    {
      key: "status",
      header: "Statut",
      cell: (row) => budgetPill(row.breach),
    },
    {
      key: "rating",
      header: "Rating CrUX",
      cell: (row) => ratingPill(classifyRating(row.metric, row.p75)),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Web Vitals — RUM 24h"
        description={`Mesures réelles (Real User Monitoring) consolidées sur la fenêtre ${WINDOW_HOURS}h. p75 calculé par (route × métrique) — minimum ${MIN_SAMPLES} samples requis pour fiabilité. Budget AGENTS.md = cible interne plus stricte que Google « good » (CrUX).`}
        actions={
          <Link href={`/fr/${adminPrefix}`} className="admin-link">
            ← Retour au tableau de bord
          </Link>
        }
      />

      <section
        aria-label="KPIs RUM"
        className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminStatCard
          label="Samples 24h"
          value={totalSamples.toLocaleString("fr-FR")}
          icon={BarChart3}
        />
        <AdminStatCard label="Routes mesurées" value={routeCount} icon={LinkIcon} />
        <AdminStatCard
          label="Lignes hors budget"
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
            ⚙️ Forcer un recompute
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
        <h2 className="admin-h2">
          Détail (route × métrique) — top {Math.min(TABLE_CAP, aggregatesLength)}
        </h2>
        {display.length === 0 ? (
          <AdminEmptyState
            title={`Aucune ligne fiable dans la fenêtre ${WINDOW_HOURS}h (chaque combinaison requiert ≥ ${MIN_SAMPLES} samples). C'est normal en faible trafic — patientez 24-48h après mise en production pour des données stables.`}
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
            <strong>Hors budget</strong> = p75 dépasse la cible interne AGENTS.md (plus stricte que
            Google CrUX « good »). Alerte Telegram déjà envoyée — voir <code>/alerts</code>.
          </li>
          <li>
            <strong>Rating CrUX</strong> = classification Google standard pour comparaison externe
            (Search Console, PSI). Indicatif user-side.
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

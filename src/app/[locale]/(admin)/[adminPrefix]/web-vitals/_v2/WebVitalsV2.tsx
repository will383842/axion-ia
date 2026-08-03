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
  // 🔴 Les trois verdicts empilaient jusqu'à DEUX « (s) » dans la même phrase
  // — « 1 mesure(s) sur 16 (sur 4 page(s) suivies) ». C'est la première ligne
  // de la page, en gros et en couleur. On accorde pour de bon, et l'emoji
  // laisse la place à l'icône déjà posée par le bandeau.
  const s = (n: number): string => (n > 1 ? "s" : "");
  const verdictText = noData
    ? `Pas encore assez de données pour juger la vitesse du site (il en faut au moins ${MIN_SAMPLES} par page). Revenez dans 24 à 48 h après la mise en production.`
    : isGood
      ? `Votre site est rapide — les ${aggregatesLength} mesure${s(aggregatesLength)} suivie${s(aggregatesLength)}, sur ${routeCount} page${s(routeCount)}, respectent l'objectif de vitesse.`
      : `${breachCount} mesure${s(breachCount)} sur ${aggregatesLength}, réparties sur ${routeCount} page${s(routeCount)} suivie${s(routeCount)}, dépasse${breachCount > 1 ? "nt" : ""} l'objectif de vitesse — voir le détail par page ci-dessous.`;

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

      {/* 🔴 Ce bloc recopiait un extrait de la documentation développeur du
          dépôt, à l'écran : chemin d'un fichier d'audit, nom d'un module de
          helpers, numéro de runbook, nom d'un tag Telegram. Même défaut que le
          renvoi « (CLAUDE.md §15) » de la page Utilisateurs — un lecteur de
          cette console n'a accès à aucun de ces fichiers.
          Ce qui reste est ce qui se lit : les seuils, et pourquoi ils sont plus
          sévères que ceux de Google. */}
      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Objectifs de vitesse</h2>
        <p className="admin-meta-block">
          Seuils visés : affichage du contenu principal ≤ 1 800 ms · réaction au clic ≤ 100 ms ·
          aucun décalage de mise en page · premier affichage ≤ 1 000 ms · réponse du serveur ≤ 600
          ms. Ils sont volontairement plus sévères que le seuil « bon » de Google (2 500 ms / 200 ms
          / 0,1). Chaque dépassement déclenche une notification.
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
                ? "Relance le calcul tout de suite, sans attendre la mesure automatique de 02 h 30"
                : "Le calcul à la demande est indisponible sur cet environnement"
            }
          >
            Recalculer maintenant
          </button>
        </form>
        <p className="admin-meta-small mt-[var(--space-admin-3)]">
          La mesure est recalculée automatiquement chaque nuit à 02 h 30. Ce bouton sert à vérifier
          tout de suite l&apos;effet d&apos;une optimisation.
        </p>
        {lastAlertSentAt && (
          <p className="admin-meta-block mt-[var(--space-admin-3)]">
            {/* « (3 breaches notifiées) » — un mot anglais, accordé au féminin. */}
            <strong>Dernière notification :</strong>{" "}
            {new Date(lastAlertSentAt).toLocaleString("fr-FR")} — {lastAlertBreachCount ?? 0}{" "}
            dépassement
            {(lastAlertBreachCount ?? 0) > 1 ? "s" : ""} signalé
            {(lastAlertBreachCount ?? 0) > 1 ? "s" : ""}
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

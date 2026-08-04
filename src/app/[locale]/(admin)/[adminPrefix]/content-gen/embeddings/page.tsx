/**
 * Content Generator — Embeddings Backfill Monitor (Phase F Sprint Perfection 2026).
 *
 * Affiche :
 * - Nombre d'articles AVEC embedding vs SANS embedding
 * - Jours restants estimés pour compléter le backfill (à 1 000/jour)
 * - Statut du dernier run (ContentGenConfig key="embeddings_last_run")
 * - Coût estimé du dernier run (ContentGenConfig key="embeddings_daily_cost_usd")
 * - Bouton déclenchement manuel (placeholder — déclenche via API route future)
 *
 * Server Component — force-dynamic (données temps réel).
 * Convention Admin V2 : AdminPageShell + AdminPageHeader + AdminStatCard + AdminCard + AdminBadge.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminBadge,
} from "@/components/admin/ui";
import { CheckCircle2, AlertTriangle, Gauge, Hourglass } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

interface LastRunData {
  at?: string;
  processed?: number;
  skipped?: number;
  errors?: number;
  estimatedCostUsd?: number;
  totalArticlesWithoutEmbedding?: number;
  durationMs?: number;
  nothingToDo?: boolean;
  skippedReason?: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    });
  } catch {
    return iso;
  }
}

async function fetchEmbeddingsStats() {
  const [withEmbedding, withoutEmbedding, lastRunConfig, costConfig] = await Promise.all([
    prisma
      .$queryRawUnsafe<Array<{ count: string }>>(
        `SELECT COUNT(*)::text AS count FROM articles WHERE status = 'published' AND embedding IS NOT NULL`,
      )
      .catch(() => [{ count: "0" }]),

    prisma
      .$queryRawUnsafe<Array<{ count: string }>>(
        `SELECT COUNT(*)::text AS count FROM articles WHERE status = 'published' AND embedding IS NULL`,
      )
      .catch(() => [{ count: "0" }]),

    prisma.contentGenConfig.findUnique({ where: { key: "embeddings_last_run" } }).catch(() => null),

    prisma.contentGenConfig
      .findUnique({ where: { key: "embeddings_daily_cost_usd" } })
      .catch(() => null),
  ]);

  const countWith = parseInt(withEmbedding[0]?.count ?? "0", 10);
  const countWithout = parseInt(withoutEmbedding[0]?.count ?? "0", 10);
  const totalPublished = countWith + countWithout;
  const coveragePct = totalPublished > 0 ? Math.round((countWith / totalPublished) * 100) : 0;
  const daysRemaining = Math.ceil(countWithout / 1000);

  const lastRunRaw = lastRunConfig?.value;
  const lastRun: LastRunData | null =
    lastRunRaw !== null && typeof lastRunRaw === "object" ? (lastRunRaw as LastRunData) : null;

  const lastCost =
    costConfig?.value !== null && costConfig?.value !== undefined
      ? parseFloat(String(costConfig.value))
      : null;

  const embeddingsEnabled = process.env.OPENAI_EMBEDDINGS_ENABLED === "true";

  return {
    countWith,
    countWithout,
    totalPublished,
    coveragePct,
    daysRemaining,
    lastRun,
    lastCost,
    embeddingsEnabled,
  };
}

export default async function EmbeddingsMonitorPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const stats = await fetchEmbeddingsStats();

  const coverageTone: "success" | "warning" | "destructive" =
    stats.coveragePct >= 90 ? "success" : stats.coveragePct >= 50 ? "warning" : "destructive";

  return (
    <AdminPageShell>
      <AdminPageHeader
        // Audit UX 2026-08-01 (Défaut 2, P0) — libellé aligné sur la sidebar
        // (admin-nav.ts, route /content-gen/embeddings) ; description et badge
        // en langage métier (plus de nom de variable d'env ni de jargon
        // technique « backfill / dims / pipeline B.7 » affiché à Will).
        title="Suivi des vecteurs de similarité"
        description={`Chaque article publié reçoit une empreinte qui permet de détecter les doublons. ${stats.countWith.toLocaleString("fr-FR")} article${stats.countWith > 1 ? "s" : ""} traité${stats.countWith > 1 ? "s" : ""} sur ${stats.totalPublished.toLocaleString("fr-FR")}.`}
        meta={
          <AdminBadge tone={stats.embeddingsEnabled ? "success" : "warning"}>
            {stats.embeddingsEnabled ? "Analyse activée" : "Analyse désactivée"}
          </AdminBadge>
        }
      />

      {/* KPI tiles */}
      <div className="mb-[var(--space-admin-7)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          label="Articles analysés"
          value={stats.countWith.toLocaleString("fr-FR")}
          meta={`sur ${stats.totalPublished.toLocaleString("fr-FR")} publiés`}
          tone={coverageTone}
          icon={CheckCircle2}
        />
        <AdminStatCard
          label="Articles en attente d'analyse"
          value={stats.countWithout.toLocaleString("fr-FR")}
          meta="à traiter"
          tone={
            stats.countWithout === 0
              ? "success"
              : stats.countWithout < 500
                ? "warning"
                : "destructive"
          }
          icon={AlertTriangle}
        />
        <AdminStatCard
          label="Couverture"
          value={`${stats.coveragePct} %`}
          meta="des articles publiés"
          tone={coverageTone}
          icon={Gauge}
        />
        <AdminStatCard
          label="Jours restants estimés"
          value={stats.countWithout === 0 ? "0" : stats.daysRemaining.toString()}
          meta="à 1 000 articles/jour"
          tone={
            stats.daysRemaining === 0
              ? "success"
              : stats.daysRemaining <= 7
                ? "warning"
                : "destructive"
          }
          icon={Hourglass}
        />
      </div>

      {/* Dernier run */}
      <div className="grid grid-cols-1 gap-[var(--space-admin-5)] lg:grid-cols-2">
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
            Dernier passage (chaque nuit à 3 h UTC)
          </h2>
          {stats.lastRun === null ? (
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Aucun passage enregistré pour l&apos;instant.
            </p>
          ) : stats.lastRun.skippedReason ? (
            <div className="flex flex-col gap-[var(--space-admin-3)]">
              <div className="flex items-center gap-[var(--space-admin-3)]">
                <AdminBadge tone="warning">Ignoré</AdminBadge>
                <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
                  {stats.lastRun.skippedReason}
                </span>
              </div>
              {stats.lastRun.at ? (
                <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                  {formatDate(stats.lastRun.at)}
                </p>
              ) : null}
            </div>
          ) : stats.lastRun.nothingToDo ? (
            <div className="flex flex-col gap-[var(--space-admin-3)]">
              <div className="flex items-center gap-[var(--space-admin-3)]">
                <AdminBadge tone="success">Rien à faire</AdminBadge>
                <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
                  Tous les articles ont un embedding
                </span>
              </div>
              {stats.lastRun.at ? (
                <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                  {formatDate(stats.lastRun.at)}
                </p>
              ) : null}
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-[var(--space-admin-6)] gap-y-[var(--space-admin-4)]">
              {stats.lastRun.at ? (
                <>
                  <dt className="text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                    Date
                  </dt>
                  <dd className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                    {formatDate(stats.lastRun.at)}
                  </dd>
                </>
              ) : null}
              <dt className="text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                Traités
              </dt>
              <dd className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                {stats.lastRun.processed ?? 0}
              </dd>
              <dt className="text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                Ignorés
              </dt>
              <dd className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                {stats.lastRun.skipped ?? 0}
              </dd>
              <dt className="text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                Erreurs
              </dt>
              <dd className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                <AdminBadge tone={(stats.lastRun.errors ?? 0) > 0 ? "destructive" : "success"}>
                  {stats.lastRun.errors ?? 0}
                </AdminBadge>
              </dd>
              {stats.lastRun.durationMs !== undefined ? (
                <>
                  <dt className="text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                    Durée
                  </dt>
                  <dd className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                    {formatDuration(stats.lastRun.durationMs)}
                  </dd>
                </>
              ) : null}
            </dl>
          )}
        </AdminCard>

        {/* Coût + infos */}
        <AdminCard>
          <h2 className="mb-[var(--space-admin-5)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
            Coût &amp; configuration
          </h2>
          <dl className="grid grid-cols-2 gap-x-[var(--space-admin-6)] gap-y-[var(--space-admin-4)]">
            <dt className="text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
              Coût dernier run
            </dt>
            <dd className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              {stats.lastCost !== null ? `$${stats.lastCost.toFixed(4)}` : "—"}
            </dd>
            <dt className="text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
              Coût estimé total
            </dt>
            <dd className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              {stats.countWithout > 0
                ? `~$${(stats.countWithout * 695 * 0.00000013).toFixed(2)}`
                : "$0.00"}
            </dd>
            <dt className="text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
              Modèle
            </dt>
            <dd className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              text-embedding-3-large
            </dd>
            <dt className="text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
              Dimensions
            </dt>
            <dd className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              1 536
            </dd>
            <dt className="text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
              Limite/run
            </dt>
            <dd className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              1 000 articles
            </dd>
            <dt className="text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
              Cron
            </dt>
            <dd className="font-mono text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              0 3 * * * (03:00 UTC)
            </dd>
          </dl>

          {/* Trigger manuel (placeholder) */}
          <div className="mt-[var(--space-admin-6)] border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-5)]">
            <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Déclenchement manuel disponible via l&apos;API BullMQ ou la commande worker.
            </p>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-flex cursor-not-allowed items-center rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-5)] py-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-muted)] opacity-50"
            >
              Déclenchement impossible depuis cet écran
            </button>
          </div>
        </AdminCard>
      </div>
    </AdminPageShell>
  );
}

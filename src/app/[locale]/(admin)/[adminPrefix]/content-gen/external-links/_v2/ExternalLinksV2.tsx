// Server Component — External Links Database admin V2.
//
// Sprint External Links Database 2026-05-22.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminStatCard } from "@/components/admin/ui";
import { listExternalLinks } from "@/server/actions/content-gen/external-links";
import { TriggerVerificationButton } from "./TriggerVerificationButton";
import { Link as LinkIcon, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import {
  EXTERNAL_LINK_CATEGORY_LABELS,
  EXTERNAL_LINK_SCOPE_LABELS,
  EXTERNAL_LINK_STATUS_LABELS,
} from "@/data/external-links/types";

interface Props {
  adminPrefix: string;
  filters: {
    category?: string;
    scope?: string;
    status?: string;
    search?: string;
    onlyProblems?: boolean;
    offset?: number;
  };
}

const PAGE_SIZE = 100;

/** Construit l'URL de pagination en préservant tous les filtres actifs. */
function pageUrl(
  offset: number,
  filters: {
    category?: string;
    scope?: string;
    status?: string;
    search?: string;
    onlyProblems?: boolean;
  },
): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.category) params.set("category", filters.category);
  if (filters.scope) params.set("scope", filters.scope);
  if (filters.status) params.set("status", filters.status);
  if (filters.onlyProblems) params.set("onlyProblems", "1");
  params.set("offset", String(offset));
  return `?${params.toString()}`;
}

export async function ExternalLinksV2({
  adminPrefix,
  filters,
}: Props): Promise<React.ReactElement> {
  const base = `/fr/${adminPrefix}/content-gen`;
  const result = await listExternalLinks({
    ...filters,
    limit: PAGE_SIZE,
    offset: filters.offset ?? 0,
  });

  const lastRunLabel = result.lastMonitorRun?.analyzedAt
    ? new Date(result.lastMonitorRun.analyzedAt).toLocaleString("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Jamais exécuté (env var EXTERNAL_LINKS_MONITOR_ENABLED requise)";

  const brokenPct =
    result.lastMonitorRun && result.lastMonitorRun.totalLinks > 0
      ? ((result.lastMonitorRun.broken / result.lastMonitorRun.totalLinks) * 100).toFixed(1)
      : "—";

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Catalogue de liens externes"
        description={`Catalogue d'autorité ~2400 liens (${result.stats.healthyForSelection} actuellement éligibles à selectExternalLinks()). Worker mensuel + tracking rotation équitable.`}
        actions={
          <div className="flex gap-2">
            <TriggerVerificationButton />
            <Link href={`${base}`} className="admin-button-secondary">
              ← Retour content-gen
            </Link>
          </div>
        }
      />

      {/* Stats globales */}
      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Stats globales</h2>
        <div className="mt-[var(--space-admin-4)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-4">
          <AdminStatCard
            label="Total liens"
            value={String(result.stats.total)}
            meta="catalogue bootstrap + seed + manual"
            icon={LinkIcon}
          />
          <AdminStatCard
            label="Éligibles selection"
            value={String(result.stats.healthyForSelection)}
            meta="actifs + indexable + https + non-paywall + non-concurrent"
            tone={
              result.stats.healthyForSelection >= result.stats.total * 0.8 ? "default" : "warning"
            }
            icon={CheckCircle2}
          />
          <AdminStatCard
            label="Paywall détecté"
            value={String(result.stats.paywalls)}
            meta="exclus de selectExternalLinks()"
            tone={result.stats.paywalls > 0 ? "warning" : "default"}
            icon={AlertTriangle}
          />
          <AdminStatCard
            label="Concurrents détectés"
            value={String(result.stats.competitors)}
            meta="filtre dur — ne sortent jamais"
            tone={result.stats.competitors > 0 ? "destructive" : "default"}
            icon={ShieldAlert}
          />
        </div>
      </AdminCard>

      {/* Stats dernier monitor run */}
      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Dernier monitor run</h2>
        <ul className="admin-meta-block">
          <li>
            Date : <strong>{lastRunLabel}</strong>
          </li>
          {result.lastMonitorRun && (
            <>
              <li>
                Liens vérifiés : <strong>{result.lastMonitorRun.totalLinks}</strong>
              </li>
              <li>
                Liens cassés (404 / deprecated) :{" "}
                <strong
                  style={{
                    color:
                      result.lastMonitorRun.broken > 0 ? "var(--color-admin-warning)" : "inherit",
                  }}
                >
                  {result.lastMonitorRun.broken} ({brokenPct} %)
                </strong>
              </li>
            </>
          )}
        </ul>
      </AdminCard>

      {/* Top liens utilisés (rotation) */}
      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Top 10 liens cités (rotation équitable)</h2>
        {result.topUsedLinks.length === 0 ? (
          <p className="admin-meta-block">Aucune utilisation tracée pour le moment.</p>
        ) : (
          <div className="mt-[var(--space-admin-4)] overflow-x-auto">
            <table className="admin-table w-full text-sm">
              <thead>
                <tr>
                  <th>Lien</th>
                  <th>Citations</th>
                  <th>Dernière citation</th>
                </tr>
              </thead>
              <tbody>
                {result.topUsedLinks.map((u) => (
                  <tr key={u.linkId}>
                    <td>{u.title}</td>
                    <td>
                      <strong>{u.usageCount}</strong>
                    </td>
                    <td>
                      {u.lastUsedAt
                        ? new Date(u.lastUsedAt).toLocaleString("fr-FR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {/* Filtres + liste */}
      <AdminCard>
        <h2 className="admin-h2">
          Catalogue ({result.total} matchant{result.total > 1 ? "s" : ""}
          {filters.onlyProblems ? " — problèmes uniquement" : ""})
        </h2>

        <form method="get" className="mt-[var(--space-admin-4)] flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Recherche
            <input
              type="text"
              name="search"
              defaultValue={filters.search ?? ""}
              className="admin-input ml-2"
              placeholder="title / org / url"
            />
          </label>
          <label className="text-sm">
            Catégorie
            <select
              name="category"
              defaultValue={filters.category ?? ""}
              className="admin-input ml-2"
            >
              <option value="">— toutes —</option>
              {/* 🔴 Deux catégories manquaient à ce menu — « industry_assoc » et
                  « cci » — donc INFILTRABLES alors qu'elles existent en base.
                  La liste est maintenant dérivée du type. */}
              {Object.entries(EXTERNAL_LINK_CATEGORY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            État
            <select name="status" defaultValue={filters.status ?? ""} className="admin-input ml-2">
              <option value="">— tous —</option>
              {/* « redirect_problem » manquait : un lien cassé par une
                  redirection ne pouvait pas être filtré. */}
              {Object.entries(EXTERNAL_LINK_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Problèmes uniquement
            <input
              type="checkbox"
              name="onlyProblems"
              value="1"
              defaultChecked={filters.onlyProblems}
              className="ml-2"
            />
          </label>
          <button type="submit" className="admin-button-secondary">
            Filtrer
          </button>
        </form>

        {/* Le tableau était rendu sans condition : les huit en-têtes
            s'affichaient au-dessus de rien quand aucun lien ne correspondait. */}
        {result.rows.length === 0 ? (
          <p className="admin-meta-block mt-[var(--space-admin-4)]">
            Aucun lien ne correspond aux filtres.
          </p>
        ) : null}
        <div
          className="mt-[var(--space-admin-4)] overflow-x-auto"
          hidden={result.rows.length === 0}
        >
          <table className="admin-table w-full text-sm">
            <thead>
              <tr>
                <th>Identifiant</th>
                <th>Organisation</th>
                <th>Titre</th>
                <th>Autorité</th>
                <th>Portée</th>
                <th>État</th>
                <th>Signalements</th>
                <th>Citations</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((l) => {
                const flags: string[] = [];
                if (l.paywall) flags.push("payant");
                if (!l.indexable) flags.push("non indexable");
                if (!l.isHttps) flags.push("non sécurisé (HTTP)");
                if (l.isCompetitor) flags.push("CONCURRENT");
                if (l.hasSchemaOrg) flags.push("données structurées");
                return (
                  <tr key={l.id}>
                    <td>
                      <code className="admin-code-inline">{l.id}</code>
                    </td>
                    <td>{l.organization}</td>
                    <td>
                      <a href={l.url} target="_blank" rel="noopener noreferrer">
                        {l.title}
                      </a>
                    </td>
                    <td>{l.authority}/5</td>
                    <td>{EXTERNAL_LINK_SCOPE_LABELS[l.scope]}</td>
                    <td>
                      <span
                        style={{
                          color:
                            l.status === "active"
                              ? "var(--color-admin-success)"
                              : "var(--color-admin-warning)",
                        }}
                      >
                        {EXTERNAL_LINK_STATUS_LABELS[l.status]}
                      </span>
                    </td>
                    <td>{flags.join(", ") || "—"}</td>
                    <td>{l.usageCountFromDb}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-[var(--space-admin-4)] flex items-center justify-between text-sm">
          <span>
            {result.rows.length} lien{result.rows.length > 1 ? "s" : ""} affiché
            {result.rows.length > 1 ? "s" : ""} sur {result.total}
          </span>
          <div className="flex gap-2">
            {(filters.offset ?? 0) > 0 && (
              <Link
                href={pageUrl(Math.max(0, (filters.offset ?? 0) - PAGE_SIZE), filters)}
                className="admin-button-secondary"
              >
                ← Précédent
              </Link>
            )}
            {(filters.offset ?? 0) + PAGE_SIZE < result.total && (
              <Link
                href={pageUrl((filters.offset ?? 0) + PAGE_SIZE, filters)}
                className="admin-button-secondary"
              >
                Suivant →
              </Link>
            )}
          </div>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}

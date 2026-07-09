// Server Component — External Links Database admin V2.
//
// Sprint External Links Database 2026-05-22.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminStatCard } from "@/components/admin/ui";
import { listExternalLinks } from "@/server/actions/content-gen/external-links";
import { TriggerVerificationButton } from "./TriggerVerificationButton";
import { Link as LinkIcon, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";

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
        title="External Links Database"
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
              <option value="gov_fr">gov_fr</option>
              <option value="gov_eu">gov_eu</option>
              <option value="academic">academic</option>
              <option value="research_industry">research_industry</option>
              <option value="official_doc">official_doc</option>
              <option value="press_top">press_top</option>
              <option value="mairie">mairie</option>
              <option value="opco">opco</option>
              <option value="international">international</option>
            </select>
          </label>
          <label className="text-sm">
            Status
            <select name="status" defaultValue={filters.status ?? ""} className="admin-input ml-2">
              <option value="">— tous —</option>
              <option value="active">active</option>
              <option value="redirect_acceptable">redirect_acceptable</option>
              <option value="404">404</option>
              <option value="deprecated">deprecated</option>
              <option value="pending_verify">pending_verify</option>
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
          <button type="submit" className="admin-button">
            Filtrer
          </button>
        </form>

        <div className="mt-[var(--space-admin-4)] overflow-x-auto">
          <table className="admin-table w-full text-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>Organisation</th>
                <th>Title</th>
                <th>Authority</th>
                <th>Scope</th>
                <th>Status</th>
                <th>Flags</th>
                <th>Usage</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((l) => {
                const flags: string[] = [];
                if (l.paywall) flags.push("paywall");
                if (!l.indexable) flags.push("non-indexable");
                if (!l.isHttps) flags.push("HTTP");
                if (l.isCompetitor) flags.push("CONCURRENT");
                if (l.hasSchemaOrg) flags.push("schema.org");
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
                    <td>{l.scope}</td>
                    <td>
                      <span
                        style={{
                          color:
                            l.status === "active"
                              ? "var(--color-admin-success)"
                              : "var(--color-admin-warning)",
                        }}
                      >
                        {l.status}
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
            Affichage {result.rows.length} sur {result.total}
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

// P1-5 Sprint P5 - Tableau croise ville x secteur x etat.
// Resolution D-P5-4: tableau croise dynamique (pas heatmap).
// P5.5 — serviceSector + filtres URL + pagination 50/page + export CSV.
// P5.x — tri serveur par colonne (count/score/ville) + direction asc/desc.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { getJobsVilleSectorDetail } from "@/server/actions/content-gen/geo";

interface Props {
  adminPrefix: string;
  searchParams?: { status?: string; ville?: string; page?: string; sort?: string; dir?: string };
}

const STATUS_LABELS: Record<string, string> = {
  published: "Publié",
  draft: "Brouillon",
  running: "En cours",
  queued: "En attente",
  failed: "Échec",
  needs_review: "Review",
  quality_improving: "Qualité auto",
  cancelled: "Annulé",
};

const SECTOR_LABELS: Record<string, string> = {
  interventions_formations: "Interventions",
  audits: "Audits",
  implementations: "Implantations",
  un_a_un: "1-à-1",
  sites_web_augmentes: "Web IA",
};

const PAGE_SIZE = 50;

const VALID_SORT = ["count", "score", "ville"] as const;
type SortBy = (typeof VALID_SORT)[number];

export async function CoverageCrossTableV2({
  adminPrefix,
  searchParams,
}: Props): Promise<React.ReactElement> {
  const base = `/fr/${adminPrefix}/content-gen`;
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const filterStatus = searchParams?.status ?? "";
  const filterVille = searchParams?.ville ?? "";
  const sortBy: SortBy = VALID_SORT.includes(searchParams?.sort as SortBy)
    ? (searchParams?.sort as SortBy)
    : "count";
  const sortDir: "asc" | "desc" = searchParams?.dir === "asc" ? "asc" : "desc";

  const rows = await getJobsVilleSectorDetail(
    PAGE_SIZE,
    filterStatus || undefined,
    filterVille || undefined,
    (page - 1) * PAGE_SIZE,
    sortBy,
    sortDir,
  );

  const totalLabel =
    rows.length === PAGE_SIZE
      ? `${(page - 1) * PAGE_SIZE + 1}–${page * PAGE_SIZE}+`
      : `${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + rows.length}`;

  function buildUrl(params: Record<string, string>) {
    const sp = new URLSearchParams();
    if (filterStatus) sp.set("status", filterStatus);
    if (filterVille) sp.set("ville", filterVille);
    if (sortBy !== "count") sp.set("sort", sortBy);
    if (sortDir !== "desc") sp.set("dir", sortDir);
    if (page > 1) sp.set("page", String(page));
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v);
      else sp.delete(k);
    });
    const qs = sp.toString();
    return `${base}/geo/coverage-table${qs ? `?${qs}` : ""}`;
  }

  function sortUrl(col: SortBy) {
    const nextDir = sortBy === col && sortDir === "desc" ? "asc" : "desc";
    return buildUrl({ sort: col, dir: nextDir, page: "1" });
  }

  function sortIndicator(col: SortBy) {
    if (sortBy !== col) return " ↕";
    return sortDir === "desc" ? " ↓" : " ↑";
  }

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Tableau croisé villes × secteur × état"
        description={`Lignes ${totalLabel} — filtrables par ville et état`}
        actions={
          <div className="flex gap-[var(--space-admin-4)]">
            <Link href={`${base}/geo/coverage-table/export.csv`} className="admin-button-ghost">
              ↓ Exporter CSV
            </Link>
            <Link href={`${base}/geo`} className="admin-button-ghost">
              ← Cockpit géo
            </Link>
          </div>
        }
      />

      {/* Filtres URL */}
      <AdminCard variant="compact" className="mb-[var(--space-admin-5)]">
        <form method="get" className="flex flex-wrap items-end gap-[var(--space-admin-4)]">
          <div className="admin-field" style={{ minWidth: 160 }}>
            <label className="admin-label" htmlFor="filter-ville">
              Ville
            </label>
            <input
              id="filter-ville"
              name="ville"
              defaultValue={filterVille}
              className="admin-input"
              placeholder="ex. paris"
            />
          </div>
          <div className="admin-field" style={{ minWidth: 160 }}>
            <label className="admin-label" htmlFor="filter-status">
              État
            </label>
            <select
              id="filter-status"
              name="status"
              defaultValue={filterStatus}
              className="admin-input"
            >
              <option value="">Tous</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" name="page" value="1" />
          <button type="submit" className="admin-button">
            Filtrer
          </button>
          {(filterStatus || filterVille) && (
            <Link href={`${base}/geo/coverage-table`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          )}
        </form>
      </AdminCard>

      <AdminCard variant="compact">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>
                  <Link href={sortUrl("ville")} className="admin-link">
                    Ville{sortIndicator("ville")}
                  </Link>
                </th>
                <th>Secteur</th>
                <th>État</th>
                <th className="text-right">
                  <Link href={sortUrl("count")} className="admin-link">
                    Articles{sortIndicator("count")}
                  </Link>
                </th>
                <th className="text-right">
                  <Link href={sortUrl("score")} className="admin-link">
                    Score moy.{sortIndicator("score")}
                  </Link>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    Aucune donnée{filterVille || filterStatus ? " pour ces filtres" : ""}. Lancez
                    des campagnes de couverture.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={`${r.anchorVilleSlug}-${r.serviceSector}-${r.status}-${i}`}>
                    <td className="font-medium">{r.anchorVilleSlug}</td>
                    <td>
                      {r.serviceSector ? (
                        <span className="admin-badge">
                          {SECTOR_LABELS[r.serviceSector] ?? r.serviceSector}
                        </span>
                      ) : (
                        <span className="admin-meta">—</span>
                      )}
                    </td>
                    <td>
                      <span className="admin-badge">{STATUS_LABELS[r.status] ?? r.status}</span>
                    </td>
                    <td className="text-right tabular-nums">{r.count}</td>
                    <td className="text-right tabular-nums">
                      {r.avgQuality != null ? r.avgQuality.toFixed(1) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-[var(--space-admin-5)] flex items-center justify-between">
          <p className="admin-meta">
            Page {page} · {rows.length} ligne{rows.length > 1 ? "s" : ""}
          </p>
          <div className="flex gap-[var(--space-admin-3)]">
            {page > 1 && (
              <Link href={buildUrl({ page: String(page - 1) })} className="admin-button-ghost">
                ← Précédent
              </Link>
            )}
            {rows.length === PAGE_SIZE && (
              <Link href={buildUrl({ page: String(page + 1) })} className="admin-button-ghost">
                Suivant →
              </Link>
            )}
          </div>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}

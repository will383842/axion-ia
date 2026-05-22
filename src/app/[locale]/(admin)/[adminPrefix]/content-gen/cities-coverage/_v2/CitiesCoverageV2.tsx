// Phase B Sprint Perfection 2026-05-22 — Console Couverture Villes 2100
//
// Page admin V2 (AdminPageShell + AdminStatCard + AdminCard + AdminBadge).
// Affiche la progression de couverture content-gen sur 2100 villes France ≥ 5000 hab.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminBadge,
} from "@/components/admin/ui";
import {
  getCitiesStats,
  listCities,
  type CityRow,
} from "@/server/actions/content-gen/cities-coverage";

interface Props {
  adminPrefix: string;
  page?: number;
  deptCode?: string;
  regionSlug?: string;
  isCovered?: boolean | null;
  search?: string;
}

function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000) return `${Math.round(n / 1000)} k`;
  return String(n);
}

function tierLabel(tier: number): string {
  switch (tier) {
    case 1: return "≥ 100 k hab";
    case 2: return "20-100 k hab";
    case 3: return "10-20 k hab";
    default: return "5-10 k hab";
  }
}

function coverageBar(covered: number, total: number): React.ReactElement {
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
  return (
    <div className="flex items-center gap-[var(--space-admin-3)]">
      <div className="flex-1 h-2 bg-[color:var(--color-admin-surface-2)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[color:var(--color-admin-accent)] rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)] whitespace-nowrap">
        {covered}/{total} ({pct}%)
      </span>
    </div>
  );
}

function cityStateIcon(city: CityRow): string {
  if (city.isCovered && city.articlesCount > 0) return "✅";
  if (city.articlesCount > 0) return "⏳";
  return "⏸️";
}

function cityStateTone(city: CityRow): "success" | "warning" | "default" {
  if (city.isCovered && city.articlesCount > 0) return "success";
  if (city.articlesCount > 0) return "warning";
  return "default";
}

export async function CitiesCoverageV2({
  adminPrefix,
  page = 1,
  deptCode,
  regionSlug,
  isCovered,
  search,
}: Props): Promise<React.ReactElement> {
  const [stats, { cities, total, totalPages }] = await Promise.all([
    getCitiesStats(),
    listCities({
      page,
      pageSize: 50,
      ...(deptCode !== undefined ? { deptCode } : {}),
      ...(regionSlug !== undefined ? { regionSlug } : {}),
      ...(isCovered !== undefined && isCovered !== null ? { isCovered } : {}),
      ...(search !== undefined ? { search } : {}),
    }),
  ]);

  const tierRows = [
    { tier: 1, label: tierLabel(1), total: stats.tier1Total, covered: stats.tier1Covered },
    { tier: 2, label: tierLabel(2), total: stats.tier2Total, covered: stats.tier2Covered },
    { tier: 3, label: tierLabel(3), total: stats.tier3Total, covered: stats.tier3Covered },
    { tier: 4, label: tierLabel(4), total: stats.tier4Total, covered: stats.tier4Covered },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Couverture villes France"
        description={`${stats.covered} / ${stats.total} villes couvertes — ${stats.coveragePercent}%`}
      />

      {/* Progress global */}
      <div className="mb-[var(--space-admin-5)] flex gap-[var(--space-admin-4)] flex-wrap">
        <AdminStatCard
          label="Villes ciblées"
          value={String(stats.total)}
        />
        <AdminStatCard
          label="Couvertes"
          value={String(stats.covered)}
          tone="success"
        />
        <AdminStatCard
          label="À couvrir"
          value={String(stats.uncovered)}
          tone={stats.uncovered > 100 ? "warning" : "default"}
        />
        <AdminStatCard
          label="Progression"
          value={`${stats.coveragePercent}%`}
          tone={stats.coveragePercent >= 50 ? "success" : stats.coveragePercent >= 10 ? "warning" : "destructive"}
        />
      </div>

      {/* Par tier population */}
      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Par tier population</h2>
        <div className="flex flex-col gap-[var(--space-admin-3)]">
          {tierRows.map((row) => (
            <div key={row.tier} className="flex items-center gap-[var(--space-admin-4)]">
              <span className="w-28 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
                Tier {row.tier} — {row.label}
              </span>
              <div className="flex-1">{coverageBar(row.covered, row.total)}</div>
            </div>
          ))}
        </div>
      </AdminCard>

      {/* Filtres */}
      <AdminCard className="mb-[var(--space-admin-4)]" variant="compact">
        <form method="GET" className="flex flex-wrap gap-[var(--space-admin-3)] items-end">
          <div>
            <label className="admin-label">Recherche</label>
            <input
              type="text"
              name="search"
              defaultValue={search ?? ""}
              placeholder="Nom de ville..."
              className="admin-input"
            />
          </div>
          <div>
            <label className="admin-label">Département</label>
            <input
              type="text"
              name="dept"
              defaultValue={deptCode ?? ""}
              placeholder="75, 69..."
              className="admin-input w-20"
            />
          </div>
          <div>
            <label className="admin-label">État</label>
            <select name="covered" className="admin-select" defaultValue={isCovered === true ? "oui" : isCovered === false ? "non" : ""}>
              <option value="">Tous</option>
              <option value="oui">Couvertes</option>
              <option value="non">À couvrir</option>
            </select>
          </div>
          <button type="submit" className="admin-btn admin-btn-primary">
            Filtrer
          </button>
          <a href={`/fr/${adminPrefix}/content-gen/cities-coverage`} className="admin-btn admin-btn-secondary">
            Réinitialiser
          </a>
        </form>
      </AdminCard>

      {/* Info résultats */}
      <p className="admin-meta-block mb-[var(--space-admin-3)]">
        {total} ville{total !== 1 ? "s" : ""} — page {page}/{totalPages}
      </p>

      {/* Table villes */}
      <AdminCard>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Rang</th>
                <th>Ville</th>
                <th>Population</th>
                <th>Dept.</th>
                <th>Région</th>
                <th>Tier</th>
                <th>État</th>
                <th>Articles</th>
              </tr>
            </thead>
            <tbody>
              {cities.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-table-empty">
                    Aucune ville ne correspond aux filtres.
                  </td>
                </tr>
              ) : (
                cities.map((city) => (
                  <tr key={city.id}>
                    <td className="text-[color:var(--color-admin-fg-soft)] tabular-nums">
                      {city.priority}
                    </td>
                    <td className="font-medium">{city.name}</td>
                    <td className="tabular-nums">{formatPop(city.population)}</td>
                    <td>{city.departmentCode}</td>
                    <td className="text-[color:var(--color-admin-fg-soft)] text-[length:var(--text-admin-xs)]">
                      {city.regionName}
                    </td>
                    <td>
                      <AdminBadge tone="neutral">{`T${city.populationTier}`}</AdminBadge>
                    </td>
                    <td>
                      <AdminBadge tone={cityStateTone(city)}>
                        {cityStateIcon(city)}{" "}
                        {city.isCovered ? "Couverte" : city.articlesCount > 0 ? "En cours" : "À faire"}
                      </AdminBadge>
                    </td>
                    <td className="tabular-nums">{city.articlesCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-[var(--space-admin-4)] flex items-center gap-[var(--space-admin-2)] flex-wrap">
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={`?page=${p}${deptCode ? `&dept=${deptCode}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                className={`admin-btn ${p === page ? "admin-btn-primary" : "admin-btn-secondary"}`}
              >
                {p}
              </a>
            ))}
            {totalPages > 10 && (
              <span className="admin-meta-block">… {totalPages} pages au total</span>
            )}
          </div>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}

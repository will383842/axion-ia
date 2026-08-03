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
  AdminTable,
  AdminEmptyState,
} from "@/components/admin/ui";
import { VillesTabsNav } from "@/components/admin/content-gen/VillesTabsNav";
import type { AdminTableColumn } from "@/components/admin/ui";
import { MapPin, CheckCircle2, Hourglass, TrendingUp } from "lucide-react";
import {
  getCitiesStats,
  getLandingIndexabilityByTier,
  listCities,
  syncCitiesUniverse,
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
    case 1:
      return "≥ 100 k hab";
    case 2:
      return "20-100 k hab";
    case 3:
      return "10-20 k hab";
    default:
      return "5-10 k hab";
  }
}

function coverageBar(covered: number, total: number): React.ReactElement {
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
  return (
    <div className="flex items-center gap-[var(--space-admin-3)]">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--color-admin-surface-2)]">
        <div
          className="h-full rounded-full bg-[color:var(--color-admin-accent)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[length:var(--text-admin-sm)] whitespace-nowrap text-[color:var(--color-admin-fg-soft)]">
        {covered}/{total} ({pct}%)
      </span>
    </div>
  );
}

function cityStateIcon(city: CityRow): string {
  if (city.isCovered && city.articlesCount > 0) return "Couverte";
  if (city.articlesCount > 0) return "⏳";
  return "⏸️";
}

function cityStateTone(city: CityRow): "success" | "warning" | "neutral" {
  if (city.isCovered && city.articlesCount > 0) return "success";
  if (city.articlesCount > 0) return "warning";
  return "neutral";
}

export async function CitiesCoverageV2({
  adminPrefix,
  page = 1,
  deptCode,
  regionSlug,
  isCovered,
  search,
}: Props): Promise<React.ReactElement> {
  async function runCitiesSync() {
    "use server";
    await syncCitiesUniverse();
  }

  const [stats, landing, { cities, total, totalPages }] = await Promise.all([
    getCitiesStats(),
    getLandingIndexabilityByTier(),
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

  const columns: ReadonlyArray<AdminTableColumn<CityRow>> = [
    {
      key: "rang",
      header: "Rang",
      cell: (city) => (
        <span className="text-[color:var(--color-admin-fg-soft)] tabular-nums">
          {city.priority}
        </span>
      ),
    },
    {
      key: "ville",
      header: "Ville",
      cell: (city) => <span className="font-medium">{city.name}</span>,
    },
    {
      key: "population",
      header: "Population",
      cell: (city) => <span className="tabular-nums">{formatPop(city.population)}</span>,
    },
    { key: "dept", header: "Dept.", cell: (city) => city.departmentCode },
    {
      key: "region",
      header: "Région",
      cell: (city) => (
        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
          {city.regionName}
        </span>
      ),
    },
    {
      key: "tier",
      header: "Tier",
      cell: (city) => <AdminBadge tone="neutral">{`T${city.populationTier}`}</AdminBadge>,
    },
    {
      key: "etat",
      header: "État",
      cell: (city) => (
        <AdminBadge tone={cityStateTone(city)}>
          {cityStateIcon(city)}{" "}
          {city.isCovered ? "Couverte" : city.articlesCount > 0 ? "En cours" : "À faire"}
        </AdminBadge>
      ),
    },
    {
      key: "articles",
      header: "Articles",
      cell: (city) => <span className="tabular-nums">{city.articlesCount}</span>,
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Couverture villes France"
        description={`${stats.covered} / ${stats.total} villes couvertes — ${stats.coveragePercent}%`}
        actions={
          <form action={runCitiesSync}>
            <button
              type="submit"
              className="admin-button"
              title="Seed idempotent des tables villes (City + ordre de génération) depuis la SSOT + recompute de la couverture depuis les articles publiés"
            >
              Synchroniser les villes
            </button>
          </form>
        }
      />
      <VillesTabsNav adminPrefix={adminPrefix} current="paliers" />

      {/* Progress global */}
      <div className="mb-[var(--space-admin-5)] flex flex-wrap gap-[var(--space-admin-4)]">
        <AdminStatCard label="Villes ciblées" value={String(stats.total)} icon={MapPin} />
        <AdminStatCard
          label="Couvertes"
          value={String(stats.covered)}
          tone="success"
          icon={CheckCircle2}
        />
        <AdminStatCard
          label="À couvrir"
          value={String(stats.uncovered)}
          tone={stats.uncovered > 100 ? "warning" : "default"}
          icon={Hourglass}
        />
        <AdminStatCard
          label="Progression"
          value={`${stats.coveragePercent}%`}
          tone={
            stats.coveragePercent >= 50
              ? "success"
              : stats.coveragePercent >= 10
                ? "warning"
                : "destructive"
          }
          icon={TrendingUp}
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

      {/* Couche A — pages villes (landing SEO) indexables par tier (P0 2026-07-03).
          Distinct de la couverture par ARTICLES content-gen ci-dessus (couche B). */}
      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Pages villes (landing SEO) — indexables par tier</h2>
        <p className="admin-meta-block mb-[var(--space-admin-3)]">
          {landing.totalIndexable} / {landing.totalCities} pages villes indexées (cap T1/T2 +
          curées). À distinguer de la couverture par articles content-gen ci-dessus : ici ce sont
          les landing pages `/implantations/…`, indexées seulement si premium (pop ≥ 20k ou réécrite
          main) — anti-doorway + concentration du crawl. Les autres restent live & crawlables mais
          `noindex`.
        </p>
        <div className="flex flex-col gap-[var(--space-admin-3)]">
          {landing.byTier.map((row) => (
            <div key={row.tier} className="flex items-center gap-[var(--space-admin-4)]">
              <span className="w-28 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
                Tier {row.tier} — {tierLabel(row.tier)}
              </span>
              <div className="flex-1">{coverageBar(row.indexable, row.total)}</div>
            </div>
          ))}
        </div>
      </AdminCard>

      {/* Filtres */}
      <AdminCard className="mb-[var(--space-admin-4)]" variant="compact">
        <form method="GET" className="flex flex-wrap items-end gap-[var(--space-admin-3)]">
          <div>
            <label htmlFor="citiescoveragev2-recherche" className="admin-label">
              Recherche
            </label>
            <input
              id="citiescoveragev2-recherche"
              type="text"
              name="search"
              defaultValue={search ?? ""}
              placeholder="Nom de ville..."
              className="admin-input"
            />
          </div>
          <div>
            <label htmlFor="citiescoveragev2-departement" className="admin-label">
              Département
            </label>
            <input
              id="citiescoveragev2-departement"
              type="text"
              name="dept"
              defaultValue={deptCode ?? ""}
              placeholder="75, 69..."
              className="admin-input admin-input-w-sm"
            />
          </div>
          <div>
            <label htmlFor="citiescoveragev2-etat" className="admin-label">
              État
            </label>
            <select
              id="citiescoveragev2-etat"
              name="covered"
              className="admin-select"
              defaultValue={isCovered === true ? "oui" : isCovered === false ? "non" : ""}
            >
              <option value="">Tous</option>
              <option value="oui">Couvertes</option>
              <option value="non">À couvrir</option>
            </select>
          </div>
          <button type="submit" className="admin-button-cta">
            Filtrer
          </button>
          <a href={`/fr/${adminPrefix}/content-gen/cities-coverage`} className="admin-button">
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
        {cities.length === 0 ? (
          <AdminEmptyState title="Aucune ville ne correspond aux filtres." />
        ) : (
          <AdminTable
            columns={columns}
            rows={cities}
            getRowId={(city) => city.id}
            caption="Liste des villes et leur couverture content-gen"
          />
        )}

        {/* Pagination — P1 fix: conserver tous les filtres actifs (covered inclus) */}
        {totalPages > 1 && (
          <div className="mt-[var(--space-admin-4)] flex flex-wrap items-center gap-[var(--space-admin-2)]">
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => {
              const coveredParam =
                isCovered === true ? "&covered=oui" : isCovered === false ? "&covered=non" : "";
              const href = `?page=${p}${deptCode ? `&dept=${encodeURIComponent(deptCode)}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}${coveredParam}`;
              return (
                <a
                  key={p}
                  href={href}
                  className={`admin-button ${p === page ? "admin-button-active" : ""}`}
                >
                  {p}
                </a>
              );
            })}
            {totalPages > 10 && (
              <span className="admin-meta-block">… {totalPages} pages au total</span>
            )}
          </div>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}

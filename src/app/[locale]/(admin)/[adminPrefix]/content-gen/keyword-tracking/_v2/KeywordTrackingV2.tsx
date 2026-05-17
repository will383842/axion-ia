// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Keyword tracking V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

function PositionTrend({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0)
    return <span className="text-[color:var(--color-admin-fg-muted)]">—</span>;
  const isUp = delta < 0;
  return (
    <span
      className={
        isUp
          ? "font-semibold text-[color:var(--color-admin-success)]"
          : "font-semibold text-[color:var(--color-admin-destructive)]"
      }
      aria-label={isUp ? "monte" : "recule"}
    >
      {isUp ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
    </span>
  );
}

interface Props {
  searchParams: { source?: string; posMin?: string; posMax?: string };
}

export async function KeywordTrackingV2({ searchParams: sp }: Props): Promise<React.ReactElement> {
  const sourceFilter =
    sp.source && ["gsc", "serpapi", "manual"].includes(sp.source) ? sp.source : null;
  const posMin = sp.posMin ? Number(sp.posMin) : null;
  const posMax = sp.posMax ? Number(sp.posMax) : null;

  const rows = await prisma.keywordTracking.findMany({
    where: {
      ...(sourceFilter ? { source: sourceFilter as "gsc" | "serpapi" | "manual" } : {}),
      ...(posMin !== null || posMax !== null
        ? {
            position: {
              ...(posMin !== null ? { gte: posMin } : {}),
              ...(posMax !== null ? { lte: posMax } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ syncedAt: "desc" }, { position: "asc" }],
    take: 200,
  });

  const keywordCounts = new Map<string, number>();
  for (const r of rows) {
    keywordCounts.set(r.keyword, (keywordCounts.get(r.keyword) ?? 0) + 1);
  }

  const isGap = (position: number, impressions: number): boolean =>
    position >= 11 && position <= 20 && impressions > 100;

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Keyword tracking"
        description={`${rows.length} mot${rows.length > 1 ? "s" : ""}-clé${rows.length > 1 ? "s" : ""} suivi${rows.length > 1 ? "s" : ""} · Source GSC + SerpAPI (sync hebdo cron Sprint 12.5 → activé quand credentials fournis).`}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form method="get">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="source" className="admin-label">
                Source
              </label>
              <select
                id="source"
                name="source"
                defaultValue={sourceFilter ?? ""}
                className="admin-input"
              >
                <option value="">Toutes</option>
                <option value="gsc">Google Search Console</option>
                <option value="serpapi">SerpAPI</option>
                <option value="manual">Manuel</option>
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="posMin" className="admin-label">
                Position min
              </label>
              <input
                id="posMin"
                name="posMin"
                type="number"
                min="1"
                max="100"
                defaultValue={posMin ?? ""}
                className="admin-input"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="posMax" className="admin-label">
                Position max
              </label>
              <input
                id="posMax"
                name="posMax"
                type="number"
                min="1"
                max="100"
                defaultValue={posMax ?? ""}
                className="admin-input"
              />
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Filtrer
            </button>
          </div>
        </form>
      </AdminCard>

      <AdminCard variant="compact">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Keyword</th>
                <th>URL</th>
                <th>Pos.</th>
                <th>Tendance</th>
                <th>CTR</th>
                <th>Imp.</th>
                <th>Source</th>
                <th>Flag</th>
                <th>Sync</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="admin-table-empty">
                    Aucun mot-clé tracké. Le worker sync GSC/SerpAPI tournera dès activation Sprint
                    10.5/12.5.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isCanib = (keywordCounts.get(r.keyword) ?? 0) > 1;
                  const gap = isGap(Number(r.position), r.impressions);
                  return (
                    <tr key={r.id}>
                      <td>{r.keyword}</td>
                      <td>
                        <code className="text-[length:var(--text-admin-xs)]">
                          {r.targetUrl.replace(/^https?:\/\//, "")}
                        </code>
                      </td>
                      <td className="tabular-nums">{Number(r.position).toFixed(1)}</td>
                      <td>
                        <PositionTrend
                          delta={r.positionDelta !== null ? Number(r.positionDelta) : null}
                        />
                      </td>
                      <td>{r.ctr !== null ? `${(Number(r.ctr) * 100).toFixed(2)}%` : "—"}</td>
                      <td className="tabular-nums">{r.impressions}</td>
                      <td>
                        <span className="admin-badge">{r.source}</span>
                      </td>
                      <td>
                        {gap ? (
                          <span className="admin-badge admin-badge-warn">opportunity</span>
                        ) : null}{" "}
                        {isCanib ? (
                          <span className="admin-badge admin-badge-danger">cannibalization</span>
                        ) : null}
                      </td>
                      <td className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {r.syncedAt.toISOString().slice(0, 10)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}

/**
 * Content Generator — Keyword tracking dashboard (Sprint 12.5 V2).
 *
 * Affiche les rows KeywordTracking (Sprint 12 migration) avec :
 *   - Filtres : source (gsc/serpapi/manual) + position range
 *   - Trending icons : flèche selon positionDelta
 *   - Gaps detection : badge "opportunity" pour position 11-20
 *   - Cannibalization : badge si > 1 article track le même keyword
 *
 * Mode shadow V1 : table vide tant que cron sync GSC/SerpAPI pas câblé
 * (Sprint 12.5 task #5). UI fonctionnelle dès qu'il y aura des rows.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { KeywordTrackingV2 } from "./_v2/KeywordTrackingV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ source?: string; posMin?: string; posMax?: string }>;
}

function PositionTrend({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0)
    return <span style={{ color: "var(--color-fg-muted)" }}>—</span>;
  const isUp = delta < 0; // position décroissante = monte SERP
  return (
    <span
      style={{
        color: isUp ? "var(--color-success, currentColor)" : "var(--color-danger, currentColor)",
        fontWeight: 600,
      }}
      aria-label={isUp ? "monte" : "recule"}
    >
      {isUp ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
    </span>
  );
}

export default async function KeywordTrackingPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <KeywordTrackingV2 searchParams={sp} />;
  }

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

  // Cannibalization detection : ≥ 2 rows pour le même keyword
  const keywordCounts = new Map<string, number>();
  for (const r of rows) {
    keywordCounts.set(r.keyword, (keywordCounts.get(r.keyword) ?? 0) + 1);
  }

  // Gap detection : position 11-20 ET impressions > 100 = opportunité tier-1
  const isGap = (position: number, impressions: number): boolean =>
    position >= 11 && position <= 20 && impressions > 100;

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Keyword tracking</h1>
          <p className="admin-meta">
            {rows.length} mot{rows.length > 1 ? "s" : ""}-clé{rows.length > 1 ? "s" : ""} suivi
            {rows.length > 1 ? "s" : ""} · Source GSC + SerpAPI (sync hebdo cron Sprint 12.5 →
            activé quand credentials fournis).
          </p>
        </div>
      </div>

      <form className="admin-card" method="get" style={{ marginBottom: "1.5rem" }}>
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

      <div className="admin-card admin-table-wrapper">
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
                <td colSpan={9} style={{ textAlign: "center", color: "var(--color-fg-muted)" }}>
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
                      <code style={{ fontSize: "0.8rem" }}>
                        {r.targetUrl.replace(/^https?:\/\//, "")}
                      </code>
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      {Number(r.position).toFixed(1)}
                    </td>
                    <td>
                      <PositionTrend
                        delta={r.positionDelta !== null ? Number(r.positionDelta) : null}
                      />
                    </td>
                    <td>{r.ctr !== null ? `${(Number(r.ctr) * 100).toFixed(2)}%` : "—"}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.impressions}</td>
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
                    <td style={{ fontSize: "0.8rem", color: "var(--color-fg-muted)" }}>
                      {r.syncedAt.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

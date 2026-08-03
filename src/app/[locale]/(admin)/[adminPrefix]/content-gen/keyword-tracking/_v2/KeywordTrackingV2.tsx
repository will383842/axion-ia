// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Keyword tracking V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badges → <AdminBadge>. Le formulaire de filtres garde les classes
// utilitaires admin.css (legit — pas de composant filtre dédié).

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import { formatDateFrShort } from "@/lib/format-date-fr";

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

const SOURCE_LABELS: Record<string, string> = {
  gsc: "Google Search Console",
  serpapi: "SerpAPI",
  manual: "Saisie manuelle",
};

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

  type KeywordRow = (typeof rows)[number] & { isCanib: boolean; gap: boolean };
  const enrichedRows: ReadonlyArray<KeywordRow> = rows.map((r) => ({
    ...r,
    isCanib: (keywordCounts.get(r.keyword) ?? 0) > 1,
    gap: isGap(Number(r.position), r.impressions),
  }));

  const columns: ReadonlyArray<AdminTableColumn<KeywordRow>> = [
    { key: "keyword", header: "Mot-clé", cell: (r) => r.keyword },
    {
      key: "url",
      header: "URL",
      cell: (r) => (
        <code className="text-[length:var(--text-admin-xs)]">
          {r.targetUrl.replace(/^https?:\/\//, "")}
        </code>
      ),
    },
    {
      key: "position",
      header: "Pos.",
      cell: (r) => <span className="tabular-nums">{Number(r.position).toFixed(1)}</span>,
    },
    {
      key: "trend",
      header: "Tendance",
      cell: (r) => (
        <PositionTrend delta={r.positionDelta !== null ? Number(r.positionDelta) : null} />
      ),
    },
    {
      key: "ctr",
      header: "CTR",
      cell: (r) => (r.ctr !== null ? `${(Number(r.ctr) * 100).toFixed(2)}%` : "—"),
    },
    {
      key: "impressions",
      header: "Imp.",
      cell: (r) => <span className="tabular-nums">{r.impressions}</span>,
    },
    {
      key: "source",
      header: "Source",
      // La cellule affichait `gsc` / `serpapi` / `manual` alors que le menu
      // de filtre, juste au-dessus, donne déjà les libellés.
      cell: (r) => <AdminBadge tone="neutral">{SOURCE_LABELS[r.source] ?? r.source}</AdminBadge>,
    },
    {
      key: "flag",
      header: "Signal",
      cell: (r) => (
        <>
          {r.gap ? <AdminBadge tone="warning">opportunity</AdminBadge> : null}{" "}
          {r.isCanib ? <AdminBadge tone="destructive">cannibalization</AdminBadge> : null}
        </>
      ),
    },
    {
      key: "sync",
      header: "Sync",
      cell: (r) => (
        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {formatDateFrShort(r.syncedAt)}
        </span>
      ),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Suivi des positions"
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
            <button type="submit" className="admin-button-secondary">
              Filtrer
            </button>
          </div>
        </form>
      </AdminCard>

      {enrichedRows.length === 0 ? (
        <AdminEmptyState title="Aucun mot-clé suivi pour l'instant. La synchronisation avec Google Search Console n'est pas encore activée." />
      ) : (
        <AdminTable
          columns={columns}
          rows={enrichedRows}
          getRowId={(r) => r.id}
          caption="Liste des mots-clés trackés"
        />
      )}
    </AdminPageShell>
  );
}

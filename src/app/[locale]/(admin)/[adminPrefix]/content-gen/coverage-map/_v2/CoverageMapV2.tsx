// Sprint v7 Phase 2 commit 2 — Client Component coverage-map.
//
// 4 zones : 4 KPI cards + filtres + carte FR départements heatmap (grid
// simplifié dept rectangles) + top dept à compléter + tableau villes
// virtualisé avec 3 compteurs distincts editorial/landings/rss.

"use client";
// use-client: filtres interactifs + virtualization tableau villes + state
// local UI — composant client-side pur, pas de SSR possible.

import { useDeferredValue, useMemo, useRef, useState } from "react";

import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckCircle2, Gauge, MapPin, TrendingUp, Pin } from "lucide-react";

import {
  AdminBadge,
  AdminCard,
  AdminPageHeader,
  AdminPageShell,
  AdminStatCard,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { VillesTabsNav } from "@/components/admin/content-gen/VillesTabsNav";
import type {
  CoverageMapCityRow,
  CoverageMapData,
  CoverageMapDeptRow,
} from "@/server/actions/content-gen/coverage-map";
import { palierLabel } from "@/server/content-gen/cities/population-tiers";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  readonly adminPrefix: string;
  readonly initialData: CoverageMapData;
}

type PipelineFilter = "all" | "editorial" | "landings" | "rss" | "combined";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000) return `${Math.round(n / 1000)} k`;
  return String(n);
}

/**
 * Tone heatmap selon coveragePct (0..100).
 * <20 = neutral (gris), 20-40 = warning (jaune), 40-70 = info (bleu),
 * ≥70 = success (vert).
 */
function pctTone(pct: number): "neutral" | "warning" | "info" | "success" {
  if (pct >= 70) return "success";
  if (pct >= 40) return "info";
  if (pct >= 20) return "warning";
  return "neutral";
}

function statusTone(
  status: "complete" | "in_progress" | "idle",
): "success" | "warning" | "neutral" {
  if (status === "complete") return "success";
  if (status === "in_progress") return "warning";
  return "neutral";
}

// ─── Composant principal ────────────────────────────────────────────────────

export function CoverageMapV2({ adminPrefix, initialData }: Props): React.ReactElement {
  // Filtres
  const [filterTier, setFilterTier] = useState<string>("");
  const [filterPipeline, setFilterPipeline] = useState<PipelineFilter>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "complete" | "in_progress" | "idle">(
    "all",
  );
  const [filterDept, setFilterDept] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const search = useDeferredValue(searchInput);

  // ByCity filtré client-side
  const visibleCities = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialData.byCity.filter((c) => {
      if (filterTier && c.tier !== filterTier) return false;
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (filterDept && c.deptCode !== filterDept) return false;
      if (filterPipeline === "editorial" && c.editorialCount === 0) return false;
      if (filterPipeline === "landings" && c.landingCount === 0) return false;
      if (filterPipeline === "rss" && c.rssCount === 0) return false;
      if (filterPipeline === "combined" && (c.editorialCount === 0 || c.landingCount === 0))
        return false;
      if (q && !c.villeSlug.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [initialData.byCity, search, filterTier, filterPipeline, filterStatus, filterDept]);

  // Top 20 dept à compléter (tri ASC % couv.)
  const topDeptsToComplete = useMemo(
    () =>
      [...initialData.byDept]
        .filter((d) => d.totalCities > 0)
        .sort((a, b) => a.coveragePct - b.coveragePct)
        .slice(0, 20),
    [initialData.byDept],
  );

  // Liste depts unique pour filtre
  const deptOptions = useMemo(
    () => initialData.byDept.map((d) => d.deptCode).sort(),
    [initialData.byDept],
  );

  // Virtualizer pour le tableau villes
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: visibleCities.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Couverture des villes"
        description={`Vue d'ensemble couverture éditoriale / landings / RSS sur ${initialData.nationalStats.totalCities} villes. Cliquez un département pour filtrer.`}
      />
      <VillesTabsNav adminPrefix={adminPrefix} current="carte" />

      {/* KPI nationaux (4 cards) */}
      <div className="mb-[var(--space-admin-6,16px)] grid grid-cols-2 gap-[var(--space-admin-4,8px)] sm:grid-cols-4">
        <AdminStatCard
          label="Villes"
          value={String(initialData.nationalStats.totalCities)}
          icon={MapPin}
        />
        <AdminStatCard
          label="% couverture"
          value={`${initialData.nationalStats.coveragePct}%`}
          tone="info"
          icon={Gauge}
        />
        <AdminStatCard
          label="Villes ≥ 50%"
          value={String(initialData.nationalStats.citiesAbove50)}
          tone="warning"
          icon={TrendingUp}
        />
        <AdminStatCard
          label="Complètes"
          value={String(initialData.nationalStats.complete)}
          tone="success"
          icon={CheckCircle2}
        />
      </div>

      {/* Filtres */}
      <AdminCard className="mb-[var(--space-admin-6,16px)]">
        <div className="grid grid-cols-1 gap-[var(--space-admin-3,6px)] sm:grid-cols-2 lg:grid-cols-5">
          <input
            type="search"
            placeholder="Rechercher slug ville…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="admin-input text-[length:var(--text-admin-sm)]"
            aria-label="Recherche slug ville"
          />
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="admin-select rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-1)] px-3 py-2 text-[length:var(--text-admin-sm)]"
            aria-label="Filtre tier"
          >
            <option value="">Tous tiers</option>
            {/* 🔴 Ces quatre bornes étaient FAUSSES et se contredisaient
                d'un écran à l'autre : « T1 (> 500k) » ici, « ≥ 100 k »
                deux pages plus loin. C'est ce second chiffre qui est le
                bon (cf. populationTier). Filtrer T1 ramenait donc
                Grenoble, et l'écran passait pour cassé alors qu'il
                disait vrai — seule son étiquette mentait. */}
            {[1, 2, 3, 4].map((t) => (
              <option key={t} value={`T${t}`}>
                {palierLabel(t)}
              </option>
            ))}
          </select>
          <select
            value={filterPipeline}
            onChange={(e) => setFilterPipeline(e.target.value as PipelineFilter)}
            className="admin-select rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-1)] px-3 py-2 text-[length:var(--text-admin-sm)]"
            aria-label="Filtre pipeline"
          >
            <option value="all">Tout pipeline</option>
            <option value="editorial">Éditorial</option>
            <option value="landings">Landings</option>
            <option value="rss">RSS</option>
            <option value="combined">Combiné (éd. + land.)</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as "all" | "complete" | "in_progress" | "idle")
            }
            className="admin-select rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-1)] px-3 py-2 text-[length:var(--text-admin-sm)]"
            aria-label="Filtre statut"
          >
            <option value="all">Tous statuts</option>
            <option value="complete">Complète</option>
            <option value="in_progress">En cours</option>
            <option value="idle">Inactif</option>
          </select>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="admin-select rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-1)] px-3 py-2 text-[length:var(--text-admin-sm)]"
            aria-label="Filtre département"
          >
            <option value="">Tous départements</option>
            {deptOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </AdminCard>

      {/* Carte FR + Top dept (2 colonnes) */}
      <div className="mb-[var(--space-admin-6,16px)] grid grid-cols-1 gap-[var(--space-admin-4,8px)] lg:grid-cols-3">
        <AdminCard className="lg:col-span-2">
          <h2 className="mb-[var(--space-admin-4,8px)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
            Carte départements (heatmap couverture)
          </h2>
          <div
            className="grid grid-cols-6 gap-[var(--space-admin-2,4px)] sm:grid-cols-8 md:grid-cols-12"
            role="grid"
            aria-label="Grille départements heatmap couverture"
          >
            {initialData.byDept.map((d) => (
              <DeptCell
                key={d.deptCode}
                dept={d}
                isActive={filterDept === d.deptCode}
                onClick={() => setFilterDept((cur) => (cur === d.deptCode ? "" : d.deptCode))}
              />
            ))}
          </div>
        </AdminCard>

        <AdminCard>
          <h2 className="mb-[var(--space-admin-4,8px)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
            Top dépts à compléter
          </h2>
          <ul className="space-y-[var(--space-admin-2,4px)]" role="list">
            {topDeptsToComplete.map((d) => (
              <li
                key={d.deptCode}
                className="flex items-center justify-between gap-2 border-b border-[color:var(--color-admin-border)] py-1 text-[length:var(--text-admin-sm)]"
                role="listitem"
              >
                <span className="font-mono text-[color:var(--color-admin-fg-soft)]">
                  {d.deptCode}
                </span>
                <span className="flex-1 truncate text-[color:var(--color-admin-fg)]">
                  {d.totalCities} villes
                </span>
                <AdminBadge tone={pctTone(d.coveragePct)}>{d.coveragePct}%</AdminBadge>
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>

      {/* Tableau villes virtualisé */}
      <AdminCard>
        <h2 className="mb-[var(--space-admin-4,8px)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Villes ({visibleCities.length}) — 3 compteurs distincts D13
        </h2>
        <div
          className="grid grid-cols-12 gap-2 border-b border-[color:var(--color-admin-border)] pb-2 text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-fg-soft)]"
          role="row"
        >
          <span className="col-span-1">Rang</span>
          <span className="col-span-3">Ville</span>
          <span className="col-span-1 text-right">Pop.</span>
          <span className="col-span-1 text-right" title="Éditorial">
            Éd.
          </span>
          <span className="col-span-1 text-right" title="Landings">
            Land.
          </span>
          <span className="col-span-1 text-right" title="RSS">
            RSS
          </span>
          <span className="col-span-2 text-right">% global</span>
          <span className="col-span-2">Statut</span>
        </div>
        <div ref={scrollRef} className="overflow-auto" style={{ height: "60vh" }} role="rowgroup">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const c = visibleCities[virtualRow.index];
              if (!c) return null;
              return (
                <CityRowRender
                  key={c.villeSlug}
                  city={c}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}

// ─── DeptCell ───────────────────────────────────────────────────────────────

interface DeptCellProps {
  readonly dept: CoverageMapDeptRow;
  readonly isActive: boolean;
  readonly onClick: () => void;
}

function DeptCell({ dept, isActive, onClick }: DeptCellProps): React.ReactElement {
  const tone = pctTone(dept.coveragePct);
  const toneBg: Record<typeof tone, string> = {
    neutral: "bg-[color:var(--color-admin-neutral-soft)]",
    warning: "bg-[color:var(--color-admin-warning-soft)]",
    info: "bg-[color:var(--color-admin-info-soft)]",
    success: "bg-[color:var(--color-admin-success-soft)]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center rounded p-1 font-mono text-[length:var(--text-admin-xs)] transition",
        toneBg[tone],
        isActive
          ? "ring-2 ring-[color:var(--color-admin-accent)]"
          : "hover:ring-1 hover:ring-[color:var(--color-admin-border)]",
      )}
      aria-label={`Département ${dept.deptCode} couverture ${dept.coveragePct}%`}
      aria-pressed={isActive}
      title={`Dept ${dept.deptCode} — ${dept.coveredCities}/${dept.totalCities} villes (${dept.coveragePct}%)`}
    >
      <span className="font-semibold text-[color:var(--color-admin-fg)]">{dept.deptCode}</span>
      <span className="text-[color:var(--color-admin-fg-soft)]">{dept.coveragePct}%</span>
    </button>
  );
}

// ─── CityRowRender ──────────────────────────────────────────────────────────

interface CityRowRenderProps {
  readonly city: CoverageMapCityRow;
  readonly style?: React.CSSProperties;
}

function CityRowRender({ city, style }: CityRowRenderProps): React.ReactElement {
  return (
    <div
      style={style}
      className="grid grid-cols-12 items-center gap-2 border-b border-[color:var(--color-admin-border)] px-1 py-2 text-[length:var(--text-admin-sm)] hover:bg-[color:var(--color-admin-surface-2)]"
      role="row"
    >
      <span className="col-span-1 text-[color:var(--color-admin-fg-soft)]">#{city.rank}</span>
      <span className="col-span-3 flex items-center gap-1 truncate font-medium text-[color:var(--color-admin-fg)]">
        {city.pinned ? (
          <Pin size={12} aria-label="Ville épinglée" className="inline align-[-1px]" />
        ) : null}
        {city.villeSlug}
      </span>
      <span className="col-span-1 text-right text-[color:var(--color-admin-fg-soft)]">
        {formatPop(city.pop)}
      </span>
      <span className="col-span-1 text-right text-[color:var(--color-admin-fg)]">
        {city.editorialCount}
      </span>
      <span className="col-span-1 text-right text-[color:var(--color-admin-fg)]">
        {city.landingCount}
      </span>
      <span className="col-span-1 text-right text-[color:var(--color-admin-fg)]">
        {city.rssCount}
      </span>
      <span className="col-span-2 text-right">
        <AdminBadge tone={pctTone(city.coveragePct)}>{city.coveragePct}%</AdminBadge>
      </span>
      <span className="col-span-2">
        <AdminBadge tone={statusTone(city.status)}>{city.status}</AdminBadge>
      </span>
    </div>
  );
}

// Sprint v7 Phase 2 commit 1 — Client Component cities-order (drag-and-drop
// virtualisé 2150 villes).
//
// Stack :
//   - @dnd-kit/core + sortable + utilities — drag-and-drop accessible (kbd)
//   - @tanstack/react-virtual — virtualization windowing (rend ~20 rows DOM
//     simultanément sur 2150 — INP gardé < 100ms)
//   - sonner — toast notifications succès/erreur
//
// Pattern : optimistic update local + revert si server action throw.

"use client";
// use-client: drag-and-drop interactif (@dnd-kit + react-virtual) + state local
// + sonner toast — composant pure client-side, pas de SSR possible.

import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, Eye, Hash, Pin } from "lucide-react";
import { toast } from "sonner";

import {
  AdminBadge,
  AdminCard,
  AdminPageHeader,
  AdminPageShell,
  AdminStatCard,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { pinCity, reorderCities } from "@/server/actions/content-gen/cities-order";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CitiesOrderRow {
  readonly villeSlug: string;
  readonly rank: number;
  readonly pinned: boolean;
  readonly pinnedAt: Date | null;
  readonly regionSlug: string;
  readonly deptCode: string;
  readonly tier: string;
  readonly pop: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface Props {
  readonly adminPrefix: string;
  readonly initialRows: ReadonlyArray<CitiesOrderRow>;
  readonly initialTotal: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000) return `${Math.round(n / 1000)} k`;
  return String(n);
}

function tierTone(tier: string): "success" | "info" | "warning" | "neutral" {
  switch (tier) {
    case "T1":
      return "success";
    case "T2":
      return "info";
    case "T3":
      return "warning";
    default:
      return "neutral";
  }
}

// ─── Composant principal ────────────────────────────────────────────────────

export function CitiesOrderV3({ initialRows, initialTotal }: Props): React.ReactElement {
  // État local — source de vérité UI (optimistic update sur drag/pin).
  const [rows, setRows] = useState<ReadonlyArray<CitiesOrderRow>>(initialRows);
  const [isReordering, setIsReordering] = useState(false);
  const [pinningSlug, setPinningSlug] = useState<string | null>(null);

  // Filtres
  const [filterRegion, setFilterRegion] = useState<string>("");
  const [filterDept, setFilterDept] = useState<string>("");
  const [filterTier, setFilterTier] = useState<string>("");
  const [filterPinned, setFilterPinned] = useState<"all" | "pinned" | "unpinned">("all");
  const [searchInput, setSearchInput] = useState<string>("");
  // useDeferredValue agit comme un debounce naturel — la recherche est appliquée
  // au repaint suivant, sans bloquer l'input (équivalent debounce ~150ms en pratique).
  const search = useDeferredValue(searchInput);

  // Stats compactes
  const stats = useMemo(() => {
    let pinned = 0;
    for (const r of rows) if (r.pinned) pinned += 1;
    return { total: rows.length, pinned };
  }, [rows]);

  // Listes de filtres (régions / depts / tiers uniques)
  const regionOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.regionSlug))).sort(),
    [rows],
  );
  const deptOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.deptCode))).sort(),
    [rows],
  );

  // Lignes filtrées affichées (préserve l'ordre rank)
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterRegion && r.regionSlug !== filterRegion) return false;
      if (filterDept && r.deptCode !== filterDept) return false;
      if (filterTier && r.tier !== filterTier) return false;
      if (filterPinned === "pinned" && !r.pinned) return false;
      if (filterPinned === "unpinned" && r.pinned) return false;
      if (q && !r.villeSlug.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filterRegion, filterDept, filterTier, filterPinned]);

  // Dnd-kit sensors (pointer + keyboard accessibility)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Virtualizer
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  // ─── Drag end handler ────────────────────────────────────────────────────

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      // Trouve les positions DANS visibleRows (filtré), puis applique le swap
      // sur les rows globales (full rank space).
      const oldIndex = rows.findIndex((r) => r.villeSlug === String(active.id));
      const newIndex = rows.findIndex((r) => r.villeSlug === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;

      const newRows = arrayMove([...rows], oldIndex, newIndex).map((r, i) => ({
        ...r,
        rank: i + 1,
      }));

      // Optimistic update
      const previousRows = rows;
      setRows(newRows);
      setIsReordering(true);

      try {
        await reorderCities({ slugs: newRows.map((r) => r.villeSlug) });
        toast.success("Ordre des villes mis à jour");
      } catch (err) {
        // Revert
        setRows(previousRows);
        const msg = err instanceof Error ? err.message : "Erreur réordonnancement";
        toast.error(`Échec du reorder : ${msg}`);
      } finally {
        setIsReordering(false);
      }
    },
    [rows],
  );

  // ─── Pin toggle handler ──────────────────────────────────────────────────

  const handleTogglePin = useCallback(
    async (slug: string, nextPinned: boolean) => {
      const previousRows = rows;
      const now = nextPinned ? new Date() : null;
      setRows(
        rows.map((r) => (r.villeSlug === slug ? { ...r, pinned: nextPinned, pinnedAt: now } : r)),
      );
      setPinningSlug(slug);

      try {
        await pinCity({ slug, pinned: nextPinned });
        toast.success(nextPinned ? `${slug} épinglé` : `${slug} désépinglé`);
      } catch (err) {
        setRows(previousRows);
        const msg = err instanceof Error ? err.message : "Erreur pin";
        toast.error(`Échec du pin : ${msg}`);
      } finally {
        setPinningSlug(null);
      }
    },
    [rows],
  );

  // ─── Rendu ───────────────────────────────────────────────────────────────

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Ordre des villes"
        description={`File globale partagée par toutes les campagnes en mode global_queue (${initialTotal} villes). Drag-and-drop pour réordonner, épinglez les villes prioritaires en tête.`}
      />

      <div className="mb-[var(--space-admin-6,16px)] grid grid-cols-2 gap-[var(--space-admin-4,8px)] sm:grid-cols-4">
        <AdminStatCard label="Total" value={String(stats.total)} icon={Hash} />
        <AdminStatCard label="Épinglées" value={String(stats.pinned)} icon={Pin} />
        <AdminStatCard label="Affichées" value={String(visibleRows.length)} icon={Eye} />
        <AdminStatCard
          label="Re-ordonnancement"
          value={isReordering ? "En cours…" : "Au repos"}
          icon={ArrowUpDown}
        />
      </div>

      <AdminCard>
        <div
          className={cn(
            "mb-[var(--space-admin-5,12px)]",
            "grid grid-cols-1 gap-[var(--space-admin-3,6px)]",
            "sm:grid-cols-2 lg:grid-cols-5",
          )}
        >
          <input
            type="search"
            placeholder="Rechercher slug…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="admin-input rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-1)] px-3 py-2 text-[length:var(--text-admin-sm)]"
            aria-label="Recherche slug ville"
          />
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="admin-select rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-1)] px-3 py-2 text-[length:var(--text-admin-sm)]"
            aria-label="Filtre région"
          >
            <option value="">Toutes les régions</option>
            {regionOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
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
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="admin-select rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-1)] px-3 py-2 text-[length:var(--text-admin-sm)]"
            aria-label="Filtre tier"
          >
            <option value="">Tous les tiers</option>
            <option value="T1">T1 (&gt; 500k)</option>
            <option value="T2">T2 (100-500k)</option>
            <option value="T3">T3 (20-100k)</option>
            <option value="T4">T4 (&lt; 20k)</option>
          </select>
          <select
            value={filterPinned}
            onChange={(e) => setFilterPinned(e.target.value as "all" | "pinned" | "unpinned")}
            className="admin-select rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-1)] px-3 py-2 text-[length:var(--text-admin-sm)]"
            aria-label="Filtre statut épinglé"
          >
            <option value="all">Toutes</option>
            <option value="pinned">Épinglées seulement</option>
            <option value="unpinned">Non épinglées</option>
          </select>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={visibleRows.map((r) => r.villeSlug)}
            strategy={verticalListSortingStrategy}
          >
            <div
              ref={scrollRef}
              className="overflow-auto rounded border border-[color:var(--color-admin-border)]"
              style={{ height: "70vh" }}
              role="list"
              aria-label="Liste des villes triable"
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const r = visibleRows[virtualRow.index];
                  if (!r) return null;
                  return (
                    <SortableRow
                      key={r.villeSlug}
                      row={r}
                      isPinning={pinningSlug === r.villeSlug}
                      onTogglePin={handleTogglePin}
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
          </SortableContext>
        </DndContext>
      </AdminCard>
    </AdminPageShell>
  );
}

// ─── Sortable row ───────────────────────────────────────────────────────────

interface SortableRowProps {
  readonly row: CitiesOrderRow;
  readonly isPinning: boolean;
  readonly onTogglePin: (slug: string, nextPinned: boolean) => void | Promise<void>;
  readonly style?: React.CSSProperties;
}

function SortableRow({ row, isPinning, onTogglePin, style }: SortableRowProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.villeSlug,
  });

  const computedStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={computedStyle}
      className={cn(
        "flex items-center gap-[var(--space-admin-4,8px)]",
        "border-b border-[color:var(--color-admin-border)]",
        "px-[var(--space-admin-4,8px)] py-[var(--space-admin-3,6px)]",
        "bg-[color:var(--color-admin-surface-1)]",
        "hover:bg-[color:var(--color-admin-surface-2)]",
        row.pinned ? "bg-[color:var(--color-admin-warning-soft)]" : "",
      )}
      role="listitem"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none px-2 text-[color:var(--color-admin-fg-soft)]"
        aria-label={`Déplacer ${row.villeSlug}`}
      >
        ⋮⋮
      </button>
      <span className="w-12 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
        #{row.rank}
      </span>
      <span className="flex-1 truncate font-medium text-[color:var(--color-admin-fg)]">
        {row.villeSlug}
      </span>
      <AdminBadge tone={tierTone(row.tier)}>{row.tier}</AdminBadge>
      <span className="w-16 text-right text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
        {formatPop(row.pop)}
      </span>
      <span className="w-14 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
        {row.deptCode}
      </span>
      <button
        type="button"
        onClick={() => onTogglePin(row.villeSlug, !row.pinned)}
        disabled={isPinning}
        className={cn(
          "rounded border px-2 py-1 text-[length:var(--text-admin-xs)]",
          row.pinned
            ? "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)] text-white"
            : "border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg-soft)]",
          isPinning ? "opacity-50" : "",
        )}
        aria-label={row.pinned ? `Désépingler ${row.villeSlug}` : `Épingler ${row.villeSlug}`}
        aria-pressed={row.pinned}
      >
        {row.pinned ? "📌 Épinglée" : "Épingler"}
      </button>
    </div>
  );
}

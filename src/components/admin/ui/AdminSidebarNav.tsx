"use client";
// use-client: usePathname pour aria-current + state collapse (browser-only).
//
// Refonte admin mai 2026 — PR 5 (ADR 0028, audit A1 findings #1/#2/#3/#5).
//
// Sidebar v2 :
// - Icônes lucide-react (vs emojis V1 — anti-pattern audit #2).
// - Active link aria-current="page" + styling visible (audit #1).
// - Sticky scroll + max-height 100vh (audit #8).
// - Collapse 64px icons-only via toggle Cmd+B (mémorisé localStorage).
// - Groupes collapsibles (UX dense — Linear / Vercel pattern).
// - Min target size WCAG 2.2 §2.5.8.
//
// La sidebar V1 (src/components/admin/AdminSidebar.tsx) reste utilisable
// derrière flag `ADMIN_V2_ENABLED=false` ; layout.tsx switchera en PR 6+.

import { useEffect, useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  FileText,
  Receipt,
  Wallet,
  CalendarClock,
  Hourglass,
  Inbox,
  BookOpenText,
  BrainCircuit,
  PenLine,
  Tag,
  Trophy,
  Quote,
  HelpCircle,
  LifeBuoy,
  Images,
  FolderOpen,
  Upload,
  PackagePlus,
  ScanSearch,
  BarChart3,
  Tags,
  Bookmark,
  Shield,
  Settings,
  Mail,
  Activity,
  Wrench,
  AlertTriangle,
  Users,
  ScrollText,
  KeyRound,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import type { AdminNavItem, AdminNavGroup } from "@/lib/admin-nav";
import { ADMIN_NAV_GROUP_LABELS, ADMIN_NAV_GROUP_ORDER } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

// Mapping label nav → icône lucide. Fallback FolderOpen si non mappé.
const ICON_MAP: Record<string, LucideIcon> = {
  "Tableau de bord": LayoutDashboard,
  Calendrier: CalendarDays,
  Réservations: ClipboardList,
  Devis: FileText,
  Factures: Receipt,
  Paiements: Wallet,
  Échéanciers: CalendarClock,
  "Options 48h": Hourglass,
  Soumissions: Inbox,
  Connaissances: BookOpenText,
  "Générateur contenus": BrainCircuit,
  Blog: PenLine,
  Catégories: Tag,
  "Cas concrets": Trophy,
  Témoignages: Quote,
  FAQ: HelpCircle,
  "Centre d'aide": LifeBuoy,
  Overview: Images,
  Library: FolderOpen,
  Upload: Upload,
  "Bulk import CSV": PackagePlus,
  "Quality queue": ScanSearch,
  Analytics: BarChart3,
  Categories: Tag,
  Tags: Tags,
  "Usage logs (RGPD)": Shield,
  Settings: Settings,
  Newsletter: Mail,
  "Analytics & SEO": BarChart3,
  "Web Vitals": Activity,
  "Infra & outils": Wrench,
  "Alertes ops": AlertTriangle,
  Utilisateurs: Users,
  "Activity logs": ScrollText,
  Paramètres: Settings,
  "2FA — sécurité": KeyRound,
  Bookmark: Bookmark, // fallback compat
};

const COLLAPSE_LS_KEY = "admin-sidebar-collapsed";
const GROUPS_COLLAPSED_LS_KEY = "admin-sidebar-groups-collapsed";

interface AdminSidebarNavProps {
  items: ReadonlyArray<AdminNavItem>;
  /** Permet l'override server-side du collapse initial (SSR). */
  defaultCollapsed?: boolean;
  className?: string;
}

export function AdminSidebarNav({
  items,
  defaultCollapsed = false,
  className,
}: AdminSidebarNavProps): React.ReactElement {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<AdminNavGroup>>(new Set());
  const [search, setSearch] = useState("");

  // Restore depuis localStorage (microtask defer pour set-state-in-effect)
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const c = window.localStorage.getItem(COLLAPSE_LS_KEY);
        if (c === "1") setCollapsed(true);
        const g = window.localStorage.getItem(GROUPS_COLLAPSED_LS_KEY);
        if (g) setCollapsedGroups(new Set(JSON.parse(g) as AdminNavGroup[]));
      } catch {
        // localStorage non disponible : ignore.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Raccourci Cmd+B / Ctrl+B
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setCollapsed((c) => {
          const next = !c;
          try {
            window.localStorage.setItem(COLLAPSE_LS_KEY, next ? "1" : "0");
          } catch {
            /* ignore */
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleGroup = (g: AdminNavGroup) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      try {
        window.localStorage.setItem(GROUPS_COLLAPSED_LS_KEY, JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((it) => it.label.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <aside
      aria-label="Navigation admin"
      className={cn(
        "admin-sidebar-v2 sticky top-0 h-screen overflow-y-auto",
        "border-r border-[color:var(--color-admin-border)]",
        "bg-[color:var(--color-admin-paper-alt)]",
        "transition-[width] duration-[var(--duration-admin-base)]",
        collapsed ? "w-[64px]" : "w-[240px]",
        className,
      )}
    >
      <div className="flex items-center justify-between px-[var(--space-admin-4)] py-[var(--space-admin-4)]">
        {!collapsed ? (
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer la nav…"
            aria-label="Filtrer la navigation admin"
            className={cn(
              "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]",
              "px-[var(--space-admin-3)] py-[var(--space-admin-2)]",
              "text-[length:var(--text-admin-sm)]",
              "focus:border-[color:var(--color-admin-info)] focus:outline-none",
            )}
          />
        ) : null}
        <button
          type="button"
          onClick={() => {
            setCollapsed((c) => {
              const next = !c;
              try {
                window.localStorage.setItem(COLLAPSE_LS_KEY, next ? "1" : "0");
              } catch {
                /* ignore */
              }
              return next;
            });
          }}
          aria-label={collapsed ? "Étendre la sidebar" : "Réduire la sidebar"}
          aria-pressed={collapsed}
          title="Cmd+B"
          className={cn(
            "shrink-0 rounded-[var(--radius-admin-sm)] p-[var(--space-admin-2)]",
            "text-[color:var(--color-admin-fg-muted)] hover:bg-[color:var(--color-admin-surface-hover)]",
            "min-h-[var(--target-admin-min-desktop)] min-w-[var(--target-admin-min-desktop)]",
          )}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {ADMIN_NAV_GROUP_ORDER.map((g) => {
        const groupItems = filtered.filter((it) => it.group === g);
        if (groupItems.length === 0) return null;
        const isCollapsed = collapsedGroups.has(g);
        return (
          <div key={g} className="px-[var(--space-admin-3)] pb-[var(--space-admin-4)]">
            {!collapsed ? (
              <button
                type="button"
                onClick={() => toggleGroup(g)}
                aria-expanded={!isCollapsed}
                className={cn(
                  "flex w-full items-center justify-between",
                  "px-[var(--space-admin-3)] py-[var(--space-admin-2)]",
                  "text-[length:var(--text-admin-xs)] font-semibold tracking-wide uppercase",
                  "text-[color:var(--color-admin-fg-muted)] hover:text-[color:var(--color-admin-fg-soft)]",
                )}
              >
                {ADMIN_NAV_GROUP_LABELS[g]}
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>
            ) : null}
            {!isCollapsed ? (
              <ul className="mt-[var(--space-admin-2)] flex flex-col gap-[var(--space-admin-1)]">
                {groupItems.map((item) => {
                  const Icon = ICON_MAP[item.label] ?? FolderOpen;
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        {...(active ? { "aria-current": "page" } : {})}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center gap-[var(--space-admin-3)]",
                          "rounded-[var(--radius-admin-sm)]",
                          "px-[var(--space-admin-3)] py-[var(--space-admin-3)]",
                          "min-h-[var(--target-admin-min-desktop)]",
                          "text-[length:var(--text-admin-sm)]",
                          "transition-colors",
                          active
                            ? "bg-[color:var(--color-admin-info-soft)] font-medium text-[color:var(--color-admin-info)]"
                            : "text-[color:var(--color-admin-fg-soft)] hover:bg-[color:var(--color-admin-surface-hover)] hover:text-[color:var(--color-admin-fg)]",
                        )}
                      >
                        <Icon size={16} aria-hidden="true" className="shrink-0" />
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </aside>
  );
}

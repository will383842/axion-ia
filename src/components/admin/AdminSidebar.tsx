"use client";
// use-client: usePathname() pour aria-current="page" + état toggle/accordéon
// (localStorage, browser-only).
//
// P2-25 audit E2E NAV+CTA 2026-05-15 — extraction du markup sidebar du
// layout admin pour : (1) clarifier 101 sections (5 groupes) en composant
// réutilisable, (2) ajouter `aria-current="page"` sur le lien actif via
// `usePathname()` côté client (manquait avant — anti-pattern a11y).
//
// Refonte UX content-gen 2026-06-16 (cf. _AUDIT/CONTENT-GEN-UX-2026/DECISION-IA.md
// §1-§4, §5 Étape C-1) :
//   - Le groupe `content_gen` est rendu en ACCORDÉON par pôle (subGroup),
//     dans l'ordre CONTENT_GEN_POLE_ORDER, avec un toggle « Simple / Avancé »
//     en tête de groupe (état persisté localStorage, défaut Simple).
//   - Mode Simple : masque les items `tier: "advanced"` ET les pôles
//     entièrement avancés (`qualite`, `reglages`). Le toggle « Avancé » révèle
//     tout. Zéro capacité perdue (la command palette voit tous les items).
//   - Les items `parent != null` (niveau 3, atteints par breadcrumbs) ne sont
//     jamais rendus en sidebar.
//   - TOUS les autres groupes gardent le rendu plat actuel (zéro régression).

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { AdminNavItem, ContentGenPole } from "@/lib/admin-nav";
import {
  ADMIN_NAV_GROUP_LABELS,
  ADMIN_NAV_GROUP_ORDER,
  CONTENT_GEN_POLE_LABELS,
  CONTENT_GEN_POLE_ORDER,
} from "@/lib/admin-nav";

// La sidebar consomme désormais le type SSOT `AdminNavItem` (group + subGroup +
// tier + parent), aligné sur `buildAdminNav()`. Plus de type `NavItem` local
// divergent (source de drift).
type NavItem = AdminNavItem;

// Clé localStorage du mode Simple/Avancé du groupe content_gen.
// Défaut = Simple (cf. DECISION-IA.md §0 : « toggle Simple/Avancé par défaut Simple »).
const CONTENT_GEN_MODE_LS_KEY = "admin-content-gen-mode";
// Clé localStorage des pôles content_gen repliés (Set sérialisé).
const CONTENT_GEN_POLES_COLLAPSED_LS_KEY = "admin-content-gen-poles-collapsed";

// Pôles entièrement avancés (masqués en mode Simple — DECISION-IA.md §1).
const ADVANCED_ONLY_POLES: ReadonlySet<ContentGenPole> = new Set<ContentGenPole>([
  "qualite",
  "reglages",
]);

interface AdminSidebarProps {
  nav: ReadonlyArray<NavItem>;
}

export function AdminSidebar({ nav }: AdminSidebarProps) {
  const pathname = usePathname();

  // ── État content-gen : mode Simple/Avancé + accordéon par pôle ──────────
  // Défaut Simple ; restauré depuis localStorage au montage (microtask defer
  // pour éviter le flash + le lint set-state-in-effect).
  const [advanced, setAdvanced] = useState(false);
  const [collapsedPoles, setCollapsedPoles] = useState<Set<ContentGenPole>>(
    () => new Set<ContentGenPole>(),
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        if (window.localStorage.getItem(CONTENT_GEN_MODE_LS_KEY) === "advanced") {
          setAdvanced(true);
        }
        const raw = window.localStorage.getItem(CONTENT_GEN_POLES_COLLAPSED_LS_KEY);
        if (raw) {
          setCollapsedPoles(new Set(JSON.parse(raw) as ContentGenPole[]));
        }
      } catch {
        // localStorage non disponible : on garde les défauts (Simple, tout ouvert).
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleAdvanced = () => {
    setAdvanced((a) => {
      const next = !a;
      try {
        window.localStorage.setItem(CONTENT_GEN_MODE_LS_KEY, next ? "advanced" : "simple");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const togglePole = (pole: ContentGenPole) => {
    setCollapsedPoles((prev) => {
      const next = new Set(prev);
      if (next.has(pole)) next.delete(pole);
      else next.add(pole);
      try {
        window.localStorage.setItem(
          CONTENT_GEN_POLES_COLLAPSED_LS_KEY,
          JSON.stringify(Array.from(next)),
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Items content-gen visibles selon le mode : en Simple, on retire les items
  // `tier: "advanced"` et les pôles entièrement avancés. Les N3 (`parent`) ne
  // sont JAMAIS rendus en sidebar.
  const contentGenItems = useMemo(
    () => nav.filter((item) => item.group === "content_gen" && item.parent == null),
    [nav],
  );

  // Pôle contenant la route active (pour auto-déplier et éviter de masquer le
  // lien courant).
  const activePole = useMemo<ContentGenPole | null>(() => {
    const hit = contentGenItems.find((it) => it.href === pathname);
    return hit?.subGroup ?? null;
  }, [contentGenItems, pathname]);

  return (
    <aside className="admin-sidebar" aria-label="Navigation admin">
      {ADMIN_NAV_GROUP_ORDER.map((g) => {
        // Le groupe content_gen a un rendu spécial (accordéon par pôle + toggle).
        if (g === "content_gen") {
          if (contentGenItems.length === 0) return null;
          return (
            <div key={g} className="admin-nav-group admin-nav-group--content-gen">
              <div className="admin-nav-group-head">
                <p className="admin-nav-group-label">{ADMIN_NAV_GROUP_LABELS[g]}</p>
                {/* Toggle Simple / Avancé — état client léger persisté localStorage */}
                <button
                  type="button"
                  onClick={toggleAdvanced}
                  className="admin-nav-mode-toggle"
                  aria-pressed={advanced}
                  title={
                    advanced
                      ? "Mode Avancé — toutes les options visibles"
                      : "Mode Simple — options essentielles"
                  }
                >
                  {advanced ? "Avancé" : "Simple"}
                </button>
              </div>

              {CONTENT_GEN_POLE_ORDER.map((pole) => {
                // En mode Simple, masquer les pôles entièrement avancés.
                if (!advanced && ADVANCED_ONLY_POLES.has(pole) && activePole !== pole) {
                  return null;
                }
                const poleItems = contentGenItems.filter((item) => {
                  if (item.subGroup !== pole) return false;
                  // En mode Simple, masquer les items avancés.
                  if (!advanced && item.tier === "advanced") return false;
                  return true;
                });
                if (poleItems.length === 0) return null;

                // Accordéon : ouvert par défaut ; le pôle actif reste toujours
                // ouvert (le lien courant ne doit jamais être masqué).
                const closed = collapsedPoles.has(pole) && activePole !== pole;
                return (
                  <div key={pole} className="admin-nav-pole">
                    <button
                      type="button"
                      onClick={() => togglePole(pole)}
                      className="admin-nav-pole-toggle"
                      aria-expanded={!closed}
                    >
                      <span className="admin-nav-pole-chevron" aria-hidden="true">
                        {closed ? "▸" : "▾"}
                      </span>
                      <span>{CONTENT_GEN_POLE_LABELS[pole]}</span>
                    </button>
                    {!closed ? (
                      <ul className="admin-nav-list">
                        {poleItems.map((item) => {
                          const isActive = pathname === item.href;
                          return (
                            <li key={item.href}>
                              <a
                                href={item.href}
                                className="admin-nav-link"
                                {...(isActive ? { "aria-current": "page" } : {})}
                              >
                                <span className="admin-nav-icon" aria-hidden="true">
                                  {item.icon}
                                </span>
                                <span>{item.label}</span>
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        }

        // ── Tous les autres groupes : rendu plat inchangé (zéro régression) ──
        const items = nav.filter((item) => item.group === g && item.parent == null);
        if (items.length === 0) return null;
        return (
          <div key={g} className="admin-nav-group">
            <p className="admin-nav-group-label">{ADMIN_NAV_GROUP_LABELS[g]}</p>
            <ul className="admin-nav-list">
              {items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="admin-nav-link"
                      {...(isActive ? { "aria-current": "page" } : {})}
                    >
                      <span className="admin-nav-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </aside>
  );
}

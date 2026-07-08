"use client";
// use-client: cmdk palette + raccourcis Cmd+K / Ctrl+K (Sprint F).
//
// Palette de commandes admin : navigation rapide + actions globales.
// Affichée en overlay modal, fermée par Esc / clic backdrop.
//
// Trigger : `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux).
//
// SSOT — fin du drift (PR5 / refonte UX content-gen 2026-06-16) :
//   Les items ne sont PLUS hardcodés ici. La palette consomme désormais
//   `buildAdminNav()` (src/lib/admin-nav.ts), la source unique de vérité
//   partagée avec la sidebar (`<AdminSidebar>`) et les breadcrumbs.
//   → plus aucune dérive possible entre la sidebar et la palette.
//
//   La palette affiche TOUS les items, quel que soit leur `tier`
//   ("simple" ET "advanced") : ainsi aucune route avancée (ex. accessible
//   uniquement via la palette en mode Simple de la sidebar) ne disparaît.
//
//   Regroupement (heading cmdk) :
//   - groupes standard → libellé clair du groupe (ADMIN_NAV_GROUP_LABELS),
//   - groupe `content_gen` → « Génération de contenu · <Pôle> » pour
//     conserver la taxonomie en 6 pôles (CONTENT_GEN_POLE_LABELS).

import { Command } from "cmdk";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildAdminNav,
  ADMIN_NAV_GROUP_LABELS,
  ADMIN_NAV_GROUP_ORDER,
  GROUP_POLE_LABELS,
  GROUP_POLE_ORDER,
  type AdminNavItem,
  type AdminNavGroup,
} from "@/lib/admin-nav";

interface PaletteItem extends AdminNavItem {
  /** Libellé du groupe affiché dans le heading cmdk (groupe ou pôle). */
  groupLabel: string;
}

/**
 * Calcule la clé d'ordre d'un groupe pour le rendu cmdk.
 * Les groupes suivent `ADMIN_NAV_GROUP_ORDER`. Au sein d'un groupe sous-divisé
 * en pôles (`content_gen`, `qualiopi`), les pôles suivent leur ordre déclaré
 * dans `GROUP_POLE_ORDER` (du plus chaud au plus froid).
 */
function groupSortKey(group: AdminNavGroup, subGroup?: AdminNavItem["subGroup"]): number {
  const groupIndex = ADMIN_NAV_GROUP_ORDER.indexOf(group);
  const poleOrder = GROUP_POLE_ORDER[group];
  const poleIndex = subGroup && poleOrder ? poleOrder.indexOf(subGroup) : 0;
  // 100 places pour le rang groupe, +rang pôle pour les groupes à pôles.
  return groupIndex * 100 + Math.max(poleIndex, 0);
}

/** Heading cmdk : « <Groupe> · <Pôle> » pour les groupes à pôles, sinon libellé groupe. */
function headingFor(group: AdminNavGroup, subGroup?: AdminNavItem["subGroup"]): string {
  const groupLabel = ADMIN_NAV_GROUP_LABELS[group];
  const poleLabel = subGroup ? GROUP_POLE_LABELS[group]?.[subGroup] : undefined;
  return poleLabel ? `${groupLabel} · ${poleLabel}` : groupLabel;
}

export function AdminCommandPalette({ adminPrefix }: { adminPrefix: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Items dérivés du SSOT — mémoïsés (recalcul uniquement si adminPrefix change).
  const items = useMemo<PaletteItem[]>(
    () =>
      buildAdminNav(adminPrefix)
        // N3 résolus par breadcrumbs uniquement (jamais en sidebar) : on les
        // expose tout de même dans la palette pour ne perdre aucune route.
        .map((item) => ({
          ...item,
          groupLabel: headingFor(item.group, item.subGroup),
        })),
    [adminPrefix],
  );

  // Raccourci global Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Group items par heading (groupe / pôle), en respectant l'ordre du SSOT.
  const groups = useMemo(() => {
    const byLabel = new Map<string, { sortKey: number; items: PaletteItem[] }>();
    for (const item of items) {
      const existing = byLabel.get(item.groupLabel);
      if (existing) {
        existing.items.push(item);
      } else {
        byLabel.set(item.groupLabel, {
          sortKey: groupSortKey(item.group, item.subGroup),
          items: [item],
        });
      }
    }
    return Array.from(byLabel.entries())
      .sort((a, b) => a[1].sortKey - b[1].sortKey)
      .map(([label, value]) => ({ label, items: value.items }));
  }, [items]);

  function select(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        className="admin-cmdk-trigger"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir la palette de commandes (Ctrl+K)"
        title="Ctrl+K / Cmd+K"
      >
        <span aria-hidden="true">⌘K</span>
      </button>
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Palette de commandes admin"
        className="admin-cmdk-dialog"
      >
        <Command.Input
          placeholder="Tapez pour filtrer — Cmd+K pour fermer…"
          className="admin-cmdk-input"
        />
        <Command.List className="admin-cmdk-list">
          <Command.Empty className="admin-cmdk-empty">Aucun résultat.</Command.Empty>
          {groups.map((group) => (
            <Command.Group key={group.label} heading={group.label} className="admin-cmdk-group">
              {group.items.map((item) => (
                <Command.Item
                  key={item.href}
                  value={`${group.label} ${item.label}`}
                  onSelect={() => select(item.href)}
                  className="admin-cmdk-item"
                >
                  <span aria-hidden="true" className="admin-cmdk-icon">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command.Dialog>
    </>
  );
}

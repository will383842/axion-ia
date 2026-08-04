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
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Handshake,
  ReceiptText,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  buildAdminNav,
  ADMIN_NAV_GROUP_LABELS,
  ADMIN_NAV_GROUP_ORDER,
  GROUP_POLE_LABELS,
  GROUP_POLE_ORDER,
  type AdminNavItem,
  type AdminNavGroup,
} from "@/lib/admin-nav";
import { navIcon } from "@/lib/admin-nav-icons";
import { rechercheGlobaleAction, type GroupeResultats } from "@/server/actions/admin-recherche";

/** Icône lucide par type de résultat « Données » (clés = GroupeResultats.type). */
const DATA_TYPE_ICONS: Record<string, LucideIcon> = {
  clients: Users,
  sessions: CalendarDays,
  factures: ReceiptText,
  devis: FileText,
  stagiaires: GraduationCap,
  formations: BookOpen,
  coaching: Handshake,
  audits: ClipboardCheck,
};

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
  // Recherche « Données » (2026-08) : saisie contrôlée + résultats serveur.
  const [search, setSearch] = useState("");
  const [resultats, setResultats] = useState<GroupeResultats[]>([]);
  const [recherchePending, setRecherchePending] = useState(false);
  // Identifiant de requête croissant : seule la DERNIÈRE réponse en vol est
  // appliquée (les réponses obsolètes — frappe rapide — sont ignorées).
  const requeteId = useRef(0);
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

  // Recherche de données debouncée (300 ms) — budget INP : aucun appel sous
  // 2 caractères, jamais de spinner bloquant, réponses obsolètes ignorées.
  // Aucun setState synchrone dans le corps de l'effet (react-hooks/
  // set-state-in-effect) : tout passe par le timeout ; sous 2 caractères on se
  // contente d'invalider les réponses en vol, le rendu étant dérivé de
  // `search` (les résultats périmés ne sont simplement plus affichés).
  useEffect(() => {
    const q = search.trim();
    requeteId.current += 1; // invalide toute réponse encore en vol
    if (q.length < 2) return;
    const id = requeteId.current;
    const timer = window.setTimeout(() => {
      if (id !== requeteId.current) return;
      setRecherchePending(true);
      rechercheGlobaleAction(q, adminPrefix)
        .then((r) => {
          if (id !== requeteId.current) return;
          setResultats("data" in r ? [...r.data] : []);
          setRecherchePending(false);
        })
        .catch(() => {
          if (id !== requeteId.current) return;
          setResultats([]);
          setRecherchePending(false);
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, adminPrefix]);

  // Dérivés de rendu : la recherche de données n'est VISIBLE qu'à partir de
  // 2 caractères — l'état conservé en-deçà est ignoré, pas réinitialisé.
  const rechercheActive = search.trim().length >= 2;
  const donnees = rechercheActive ? resultats : [];

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

  /**
   * 🔴 LE BOUTON ANNONÇAIT « ⌘K » À TOUT LE MONDE, y compris sous Windows — où
   * cette touche n'existe pas. La console s'utilise depuis un poste Windows :
   * le seul raccourci affiché était donc le seul qui ne marche pas ici, alors
   * que le gestionnaire de touches accepte bien `ctrlKey` (l. 115).
   *
   * Le serveur ignore la plateforme du visiteur : trancher au rendu produirait
   * une différence d'hydratation. `useSyncExternalStore` sert exactement à ça —
   * un instantané serveur (« Ctrl K », le bon défaut ici) et un instantané
   * client lu après montage. Un `useEffect` qui appellerait `setState` ferait
   * le même travail en deux rendus, ce que `react-hooks/set-state-in-effect`
   * refuse à juste titre.
   */
  const raccourci = useSyncExternalStore(
    () => () => {},
    () => (/Mac|iPhone|iPad/i.test(navigator.userAgent) ? "Cmd K" : "Ctrl K"),
    () => "Ctrl K",
  );

  return (
    <>
      <button
        type="button"
        className="admin-cmdk-trigger"
        onClick={() => setOpen(true)}
        aria-label={`Ouvrir la palette de commandes (${raccourci})`}
        title={`Ouvrir la palette de commandes — ${raccourci}`}
      >
        <span aria-hidden="true">{raccourci}</span>
      </button>
      <Command.Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setSearch("");
        }}
        label="Palette de commandes admin"
        className="admin-cmdk-dialog"
      >
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Tapez pour filtrer — Cmd+K pour fermer…"
          className="admin-cmdk-input"
        />
        <Command.List className="admin-cmdk-list">
          {/* L'état vide cmdk ne compte que les items filtrés (nav) : on le
              masque quand des résultats Données (forceMount) sont affichés. */}
          {donnees.length === 0 && (
            <Command.Empty className="admin-cmdk-empty">Aucun résultat.</Command.Empty>
          )}
          {rechercheActive && recherchePending && (
            <div className="admin-cmdk-empty" role="status">
              Recherche…
            </div>
          )}
          {/* Groupes « Données » — AVANT la navigation. `forceMount` : ces
              items viennent du serveur, déjà filtrés par la requête ; le
              filtre client cmdk ne doit pas les re-filtrer (leurs valeurs ne
              contiennent pas forcément le texte tapé). */}
          {donnees.map((groupe) =>
            groupe.items.length === 0 ? null : (
              <Command.Group
                key={`donnees-${groupe.type}`}
                heading={groupe.label}
                className="admin-cmdk-group"
                forceMount
              >
                {groupe.items.map((item) => {
                  const Icon = DATA_TYPE_ICONS[groupe.type] ?? FileText;
                  return (
                    <Command.Item
                      key={`${groupe.type}-${item.id}`}
                      value={`donnees ${groupe.type} ${item.id}`}
                      forceMount
                      onSelect={() => select(item.href)}
                      className="admin-cmdk-item"
                    >
                      <Icon size={16} aria-hidden="true" className="admin-cmdk-icon" />
                      <span>{item.titre}</span>
                      {item.sous ? <span className="admin-cmdk-hint">{item.sous}</span> : null}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ),
          )}
          {groups.map((group) => (
            <Command.Group key={group.label} heading={group.label} className="admin-cmdk-group">
              {group.items.map((item) => {
                // `item.icon` = nom d'export lucide (SSOT) — résolu en
                // composant côté client (refonte visuelle console 2026-08).
                // `.admin-cmdk-icon` (width 20 + flex-shrink 0) s'applique au
                // svg directement ; l'item flex align-center centre le glyphe.
                const Icon = navIcon(item.icon);
                return (
                  <Command.Item
                    key={item.href}
                    value={`${group.label} ${item.label}`}
                    onSelect={() => select(item.href)}
                    className="admin-cmdk-item"
                  >
                    <Icon size={16} aria-hidden="true" className="admin-cmdk-icon" />
                    <span>{item.label}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
      </Command.Dialog>
    </>
  );
}

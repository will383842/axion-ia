"use client";
// use-client: usePathname pour aria-current + state collapse (browser-only).
//
// Refonte admin mai 2026 — PR 5 (ADR 0028, audit A1 findings #1/#2/#3/#5).
// Refonte « rail mocha premium » juin 2026 :
//   - Rail sombre contrastant (token mocha très foncé) sur app claire — pattern Vercel /
//     Linear / Stripe. PAS un dark mode (doctrine light only respectée :
//     seul le rail de nav est sombre). Tokens `--color-admin-rail-*`.
//   - Structure colonne flex : header de marque · recherche · nav scrollable
//     (flex-1) · footer profil épinglé (avatar + email + déconnexion).
//   - Lien actif : tuile teintée + barre d'accent terracotta + icône accent.
//   - Badges unifiés (token-isés, plus de bg-red-500 brut). Mode réduit :
//     point d'alerte sur l'icône au lieu du badge plein.
//   - Micro-interactions sobres (transitions colors/opacity, easing admin).
//   - Min target size WCAG 2.2 §2.5.8. Focus ring adapté fond sombre.
//   - Mobile hamburger : translate-x (CLS=0), masqué sm/md.
//
// Sidebar v2 « rail mocha premium » = composant permanent (flag supprimé
// 2026-05-20). La V1 (src/components/admin/AdminSidebar.tsx) a été SUPPRIMÉE
// le 2026-06-27 (code mort : aucun import, aucun JSX, styles CSS dédiés morts).

import { useEffect, useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Wallet,
  Inbox,
  Images,
  FolderOpen,
  ScanSearch,
  Activity,
  ChevronRight,
  Menu,
  X,
  Search,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Newspaper,
  Sparkles,
  GraduationCap,
  Bot,
  Megaphone,
  Gauge,
  Cog,
  CircleAlert,
  BookOpen,
  Users,
  BadgeCheck,
  type LucideIcon,
  Filter,
} from "lucide-react";
import { navIcon } from "@/lib/admin-nav-icons";
import type { AdminNavItem, AdminNavGroup } from "@/lib/admin-nav";
import {
  ADMIN_NAV_GROUP_LABELS,
  ADMIN_NAV_GROUP_ORDER,
  GROUP_POLE_LABELS,
  GROUP_POLE_ORDER,
  findActiveNavHref,
} from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

// Toutes les clés de pôles, tous groupes confondus (content_gen + qualiopi).
// Les clés sont disjointes entre groupes → un seul Set<string> pilote l'état
// plié/déplié sans collision. Sert à initialiser « tous les pôles fermés ».
const ALL_POLE_KEYS: ReadonlyArray<string> = Object.values(GROUP_POLE_ORDER).flat();

// Icône d'« onglet principal » par groupe (niveau 1 de la hiérarchie).
// Les icônes d'ITEM, elles, viennent du SSOT (`item.icon` = nom d'export
// lucide) résolu par `navIcon()` — l'ancien ICON_MAP par label est supprimé
// (refonte visuelle console 2026-08, chantier icônes).
const GROUP_ICON_MAP: Record<AdminNavGroup, LucideIcon> = {
  main: Activity,
  // Groupe `rendez-vous` supprimé le 2026-07-29 : les appels réservés sont un
  // canal de la boîte de réception, pas une rubrique à part (cf. admin-nav.ts).
  contacts: Inbox,
  tunnels: Filter,
  content: Newspaper,
  content_gen: Sparkles,
  qualiopi: GraduationCap,
  finances: Wallet,
  "documents-interventions": FolderOpen,
  "coaching-1to1": GraduationCap,
  "image-bank": Images,
  presse: Newspaper,
  chatbot: Bot,
  engagement: Megaphone,
  ops: Gauge,
  system: Cog,
};

/**
 * Icône de PÔLE (niveau 2) — uniquement là où une famille métier gagne à être
 * reconnaissable d'un coup d'œil.
 *
 * 🔴 Ces six pôles portaient leur pictogramme DANS leur libellé, sous forme
 * d'emoji, depuis `src/lib/admin-nav.ts` (cf. le commentaire là-bas). Deux
 * raisons de le remonter ici plutôt que de simplement le supprimer : un module
 * de `lib` ne doit pas porter de pictogramme, et la barre latérale perdrait
 * l'aide au repérage que Will avait demandée. On garde donc l'intention, on
 * change le moyen — un composant lucide, aligné sur la grille, dont la graisse
 * ne dépend pas de la police du poste.
 *
 * Les pôles des autres groupes (content_gen, documents, image-bank) n'ont
 * jamais eu de pictogramme et n'en prennent pas : ce sont des sous-rubriques
 * d'un même métier, l'en-tête de groupe porte déjà l'icône qui les distingue.
 */
const POLE_ICON_MAP: Record<string, LucideIcon> = {
  a_traiter: CircleAlert,
  dossiers: FolderOpen,
  catalogue: BookOpen,
  intervenants: Users,
  conformite: BadgeCheck,
  reglages_suivi: Cog,
};

const COLLAPSE_LS_KEY = "admin-sidebar-collapsed";
// v2 : nouveau défaut « tous les groupes fermés » (accordéon). Clé bumpée pour
// que les utilisateurs existants repartent du nouveau comportement.
const GROUPS_COLLAPSED_LS_KEY = "admin-sidebar-groups-collapsed-v2";
// Sous-accordéon par pôle du groupe « Génération de contenu » (2026-06-27).
// Le groupe content_gen est subdivisé en 6 pôles (Lancer/Suivre/Publier/Villes/
// Qualité & Coûts/Réglages) repliables indépendamment. Set sérialisé des pôles
// FERMÉS (défaut : tous fermés sauf celui de la page courante).
const CONTENT_GEN_POLES_COLLAPSED_LS_KEY = "admin-content-gen-poles-collapsed-v1";

type BadgeTone = "danger" | "warn";

/** Calcule initiales (max 2 lettres) à partir d'un email pour l'avatar footer. */
function initialsFromEmail(email: string | undefined): string {
  if (!email) return "·";
  const local = email.split("@")[0] ?? email;
  const letters = local.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 2) return (letters[0]! + letters[1]!).toUpperCase();
  if (letters.length === 1) return letters[0]!.toUpperCase();
  return email[0]!.toUpperCase();
}

interface AdminSidebarNavProps {
  items: ReadonlyArray<AdminNavItem>;
  /** Permet l'override server-side du collapse initial (SSR). */
  defaultCollapsed?: boolean;
  className?: string;
  /** Compteur de jobs en échec pour le badge rouge. */
  failedJobsCount?: number;
  /** Compteur d'alertes ops (Sentry + UptimeRobot + Coolify) pour badge sur /alerts. */
  alertsCount?: number;
  /** Compteur anomalies Site Explorer high severity non résolues. */
  siteExplorerAnomaliesHighCount?: number;
  /** Compteur contacts sans réponse (needsAttention=true ET non archivé). */
  unreadContactsCount?: number;
  /**
   * Compteurs « à traiter » de la boîte de réception, par canal (2026-07-29).
   * Décision Will : le badge compte ce qu'il RESTE À FAIRE — il descend donc à
   * zéro, contrairement à un compteur de volume qu'on finit par ignorer.
   */
  inboxCounts?: { appel: number; message: number; candidature: number; podcast: number };
  /**
   * Compteurs « à traiter » de la console Qualiopi (refonte phase 1,
   * 2026-08-01) — signatures en attente, e-mails à valider, alertes non lues.
   * Même philosophie que `inboxCounts` : le badge compte ce qu'il RESTE À
   * FAIRE, il descend à zéro. Source : `compterQualiopiNav()` (SSOT partagé
   * avec la page « À traiter » — deux calculs divergeraient un jour).
   */
  qualiopiCounts?: {
    signatures: number;
    emails: number;
    alertes: number;
    relances: number;
    total: number;
  };
  /**
   * Compteur « offres d'emploi à republier » (fraîcheur Google for Jobs,
   * 2026-08-13) : offres publiées dont la date de publication effective dépasse
   * le seuil (45 j). Même philosophie « reste à faire » : descend à zéro après
   * republication (bouton « Republier » sur la fiche offre).
   */
  staleJobOffersCount?: number;
  /** Email de l'utilisateur connecté (footer profil). */
  userEmail?: string | null;
  /** Href base admin (ex. /fr/<adminPrefix>) — lien profil/paramètres. */
  accountHref?: string;
  /** Server Action de déconnexion (form action, POST — évite le GET → 405). */
  logoutAction?: () => void | Promise<void>;
}

export function AdminSidebarNav({
  items,
  defaultCollapsed = false,
  className,
  failedJobsCount = 0,
  alertsCount = 0,
  siteExplorerAnomaliesHighCount = 0,
  unreadContactsCount = 0,
  inboxCounts,
  qualiopiCounts,
  staleJobOffersCount = 0,
  userEmail,
  accountHref,
  logoutAction,
}: AdminSidebarNavProps): React.ReactElement {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  // Accordéon : tous les groupes FERMÉS par défaut (un groupe présent dans le
  // Set = fermé), SAUF celui contenant la page courante (ouvert d'emblée — évite
  // un flash SSR→client). Se déploie/replie ensuite au clic sur l'onglet.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<AdminNavGroup>>(() => {
    const s = new Set<AdminNavGroup>(ADMIN_NAV_GROUP_ORDER);
    const activeHref = findActiveNavHref(items, pathname);
    const hit = items.find((it) => it.href === activeHref);
    if (hit) s.delete(hit.group);
    return s;
  });
  // Sous-accordéon des pôles content_gen : tous fermés par défaut SAUF le pôle
  // contenant la page courante (évite un flash + ne masque jamais le lien actif).
  const [collapsedPoles, setCollapsedPoles] = useState<Set<string>>(() => {
    const s = new Set<string>(ALL_POLE_KEYS);
    const activeHref = findActiveNavHref(items, pathname);
    const hit = items.find((it) => it.href === activeHref);
    if (hit?.subGroup) s.delete(hit.subGroup);
    return s;
  });
  const [search, setSearch] = useState("");
  // Mobile : sidebar masquée par défaut (translate-x-full), ouverte via hamburger.
  const [mobileOpen, setMobileOpen] = useState(false);

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
        const p = window.localStorage.getItem(CONTENT_GEN_POLES_COLLAPSED_LS_KEY);
        if (p) setCollapsedPoles(new Set(JSON.parse(p) as string[]));
      } catch {
        // localStorage non disponible : ignore.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ferme automatiquement la sidebar mobile après navigation.
  // Pattern microtask pour éviter le lint set-state-in-effect (render cascade).
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setMobileOpen(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

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

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_LS_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Accordéon « une seule section ouverte à la fois » : ouvrir un onglet ferme
  // tous les autres ; recliquer l'onglet déjà ouvert referme tout.
  const toggleGroup = (g: AdminNavGroup) => {
    setCollapsedGroups((prev) => {
      const wasOpen = !prev.has(g);
      const next = new Set<AdminNavGroup>(ADMIN_NAV_GROUP_ORDER); // tout fermé
      if (!wasOpen) next.delete(g); // était fermé → ouvre g exclusivement
      try {
        window.localStorage.setItem(GROUPS_COLLAPSED_LS_KEY, JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Pliage d'un pôle content_gen — indépendant (plusieurs pôles peuvent rester
  // ouverts en même temps, contrairement à l'accordéon mono-section des groupes).
  const togglePole = (pole: string) => {
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

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((it) => it.label.toLowerCase().includes(q));
  }, [items, search]);

  // Groupe contenant la route active → toujours déplié (le lien actif ne doit
  // jamais être masqué par un groupe que l'utilisateur a replié).
  // Href actif par matching de préfixe (cf. findActiveHref) — pilote à la fois
  // le surlignage de l'item et l'ouverture du groupe parent.
  const activeHref = useMemo<string | null>(
    () => findActiveNavHref(items, pathname),
    [items, pathname],
  );
  const activeGroup = useMemo<AdminNavGroup | null>(() => {
    const hit = items.find((it) => it.href === activeHref);
    return hit ? hit.group : null;
  }, [items, activeHref]);
  // Pôle (content_gen OU qualiopi) contenant la page courante (null si l'item
  // actif n'appartient à aucun pôle).
  const activePole = useMemo<string | null>(() => {
    const hit = items.find((it) => it.href === activeHref);
    return hit?.subGroup ?? null;
  }, [items, activeHref]);

  // Auto-ouvre le pôle contenant la page courante (au montage + à chaque
  // navigation), tout en laissant l'utilisateur le replier librement ensuite.
  useEffect(() => {
    if (!activePole) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setCollapsedPoles((prev) => {
        if (!prev.has(activePole)) return prev; // déjà ouvert → no-op
        const next = new Set(prev);
        next.delete(activePole);
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [activePole]);

  // Auto-ouvre le groupe contenant la page courante (au montage + à chaque
  // navigation), MAIS laisse l'utilisateur le replier librement ensuite (l'effet
  // ne se redéclenche qu'au changement de groupe actif). Sans cela, forcer
  // l'ouverture en rendu rendait le toggle de l'onglet actif inopérant.
  // Microtask defer pour éviter le lint set-state-in-effect.
  useEffect(() => {
    if (!activeGroup) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setCollapsedGroups((prev) => {
        // Mono-section : ouvre le groupe actif et ferme tous les autres.
        // No-op si déjà dans cet état exact (évite un render inutile).
        if (prev.size === ADMIN_NAV_GROUP_ORDER.length - 1 && !prev.has(activeGroup)) {
          return prev;
        }
        const next = new Set<AdminNavGroup>(ADMIN_NAV_GROUP_ORDER);
        next.delete(activeGroup);
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [activeGroup]);

  // Badge éventuel pour un item donné (tone + count), sinon null.
  const badgeFor = (href: string): { count: number; tone: BadgeTone; label: string } | null => {
    if (failedJobsCount > 0 && href.includes("/content-gen/jobs")) {
      return { count: failedJobsCount, tone: "danger", label: "jobs en échec" };
    }
    if (alertsCount > 0 && href.includes("/alerts")) {
      return { count: alertsCount, tone: "warn", label: "alertes ops" };
    }
    if (siteExplorerAnomaliesHighCount > 0 && href.includes("/site-explorer")) {
      return {
        count: siteExplorerAnomaliesHighCount,
        tone: "danger",
        label: "anomalies critiques",
      };
    }
    // ── Boîte de réception (2026-07-29) ──────────────────────────────────
    // Ordre important : les tests d'égalité EXACTE passent avant le
    // `includes("/contacts/messages")` historique, sinon « Tout » (/contacts)
    // capterait aussi les sous-routes.
    if (inboxCounts) {
      const base = accountHref ?? "";
      const exact = (suffix: string): boolean => href === `${base}${suffix}`;
      const total =
        inboxCounts.appel + inboxCounts.message + inboxCounts.candidature + inboxCounts.podcast;
      if (exact("/contacts") && total > 0) {
        return { count: total, tone: "danger", label: "entrées à traiter" };
      }
      if (exact("/contacts/appels") && inboxCounts.appel > 0) {
        return { count: inboxCounts.appel, tone: "danger", label: "appels à compléter" };
      }
      if (exact("/contacts/messages") && inboxCounts.message > 0) {
        return { count: inboxCounts.message, tone: "danger", label: "messages sans réponse" };
      }
      if (exact("/contacts/candidatures") && inboxCounts.candidature > 0) {
        return { count: inboxCounts.candidature, tone: "danger", label: "candidatures à traiter" };
      }
      if (exact("/podcast") && inboxCounts.podcast > 0) {
        return { count: inboxCounts.podcast, tone: "warn", label: "demandes de podcast" };
      }
    }
    if (unreadContactsCount > 0 && href.includes("/contacts/messages")) {
      return { count: unreadContactsCount, tone: "danger", label: "contacts sans réponse" };
    }
    // ── Offres d'emploi à republier (fraîcheur Google for Jobs, 2026-08-13) ──
    // Égalité EXACTE : la pastille vit sur l'onglet « Offres d'emploi », pas
    // sur ses sous-routes (/new, /[id]).
    if (staleJobOffersCount > 0 && href === `${accountHref ?? ""}/offres-emploi`) {
      return { count: staleJobOffersCount, tone: "warn", label: "offres à republier" };
    }
    // ── Console Qualiopi (refonte phase 1, 2026-08-01) ───────────────────
    // Égalité EXACTE (même précaution que la boîte de réception) : sans elle,
    // « À traiter » capterait /qualiopi/a-traiter/* et « Alertes » capterait
    // les sous-routes.
    if (qualiopiCounts) {
      const base = accountHref ?? "";
      if (href === `${base}/qualiopi/a-traiter` && qualiopiCounts.total > 0) {
        return { count: qualiopiCounts.total, tone: "danger", label: "actions en attente" };
      }
      if (href === `${base}/qualiopi/emails` && qualiopiCounts.emails > 0) {
        return { count: qualiopiCounts.emails, tone: "danger", label: "e-mails à valider" };
      }
      if (href === `${base}/qualiopi/alertes` && qualiopiCounts.alertes > 0) {
        return { count: qualiopiCounts.alertes, tone: "warn", label: "alertes non lues" };
      }
      // Recouvrement : une facture échue attend un clic. Ton « danger » comme
      // les e-mails à valider — c'est de la trésorerie qui ne rentre pas.
      if (href === `${base}/qualiopi/facturation` && qualiopiCounts.relances > 0) {
        return { count: qualiopiCounts.relances, tone: "danger", label: "relances à envoyer" };
      }
    }
    return null;
  };

  // Niveau hiérarchique d'un item dérivé de la profondeur d'URL relative au
  // base admin : `/base` ou `/base/x` → 0 (sous-onglet), `/base/x/y` → 1
  // (sous-sous-onglet), `/base/x/y/z` → 2. Pilote l'indentation à droite.
  const adminBase = accountHref ?? "";
  const itemLevel = (href: string): number => {
    const rel = adminBase && href.startsWith(adminBase) ? href.slice(adminBase.length) : href;
    const segs = rel.split("/").filter(Boolean).length;
    return Math.min(Math.max(segs - 1, 0), 2);
  };

  const searchActive = search.trim().length > 0;

  // Somme des compteurs d'une liste d'items — la « bulle » d'un en-tête REPLIÉ.
  //
  // Demande Will 2026-08-01 : « lorsqu'un onglet n'est pas déployé, on puisse
  // voir aussi le nombre de nouvelles choses ». Un en-tête fermé ne doit pas
  // CACHER le travail en attente : le total remonte, comme une boîte mail dont
  // le dossier replié affiche son nombre de non-lus. Remplace l'ancien point
  // de 7 px (qui disait « il y a quelque chose » sans dire combien).
  // Tonalité : danger dès qu'UN item est danger, warn sinon.
  const badgeRollup = (
    list: ReadonlyArray<AdminNavItem>,
  ): { count: number; tone: BadgeTone } | null => {
    let count = 0;
    let tone: BadgeTone = "warn";
    for (const it of list) {
      const b = badgeFor(it.href);
      if (!b) continue;
      count += b.count;
      if (b.tone === "danger") tone = "danger";
    }
    return count > 0 ? { count, tone } : null;
  };

  const initials = initialsFromEmail(userEmail ?? undefined);

  // Rendu d'un onglet (niveaux 2 & 3) — factorisé pour servir au rendu à plat
  // (groupes standard) ET sous les pôles content_gen.
  const renderItem = (item: AdminNavItem): React.ReactElement => {
    const Icon = navIcon(item.icon);
    const active = item.href === activeHref;
    const badge = badgeFor(item.href);
    // `navLevel` prime sur la déduction par URL : une catégorie de Messages
    // vit sur une route sœur (`/contacts/presse`, `/podcast`) dont la
    // profondeur ne dit pas qu'elle est une fille.
    const level = collapsed ? 0 : (item.navLevel ?? itemLevel(item.href));
    const iconSize = level >= 1 ? 14 : 16;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          {...(active ? { "aria-current": "page" } : {})}
          title={collapsed ? item.label : undefined}
          style={
            !collapsed && level > 0
              ? { paddingLeft: `calc(var(--space-admin-3) + ${level * 13}px)` }
              : undefined
          }
          className={cn(
            "group relative flex items-center",
            "rounded-[var(--radius-admin-md)]",
            "transition-[background-color,color] duration-[var(--duration-admin-fast)] ease-[var(--easing-admin)]",
            collapsed
              ? "justify-center px-0 py-[var(--space-admin-3)]"
              : "gap-[var(--space-admin-4)] px-[var(--space-admin-3)] py-[var(--space-admin-2)]",
            "min-h-[30px] font-medium",
            level >= 2
              ? "text-[length:var(--text-admin-sm)]"
              : "text-[length:var(--text-admin-md)]",
            active
              ? "bg-[color:var(--color-admin-rail-active-bg)] font-medium text-[color:var(--color-admin-rail-active-fg)]"
              : level >= 1
                ? "text-[color:var(--color-admin-rail-fg-muted)] hover:bg-[color:var(--color-admin-rail-hover)] hover:text-[color:var(--color-admin-rail-fg)]"
                : "text-[color:var(--color-admin-rail-fg-soft)] hover:bg-[color:var(--color-admin-rail-hover)] hover:text-[color:var(--color-admin-rail-fg)]",
          )}
        >
          {/* Barre d'accent à gauche (lien actif) — recouvre la ligne-guide */}
          {active ? (
            <span
              aria-hidden="true"
              className="absolute top-1/2 left-[-1px] h-[16px] w-[2px] -translate-y-1/2 rounded-full bg-[color:var(--color-admin-rail-accent)]"
            />
          ) : null}
          <span className="relative shrink-0">
            <Icon
              size={iconSize}
              aria-hidden="true"
              className={cn(
                "transition-colors",
                active
                  ? "text-[color:var(--color-admin-rail-accent)]"
                  : "text-[color:var(--color-admin-rail-fg-muted)] group-hover:text-[color:var(--color-admin-rail-fg)]",
              )}
            />
            {/* Mode réduit : point d'alerte sur l'icône (pas de badge plein) */}
            {collapsed && badge ? (
              <span
                aria-hidden="true"
                className="absolute -top-[2px] -right-[2px] h-[7px] w-[7px] rounded-full ring-2 ring-[color:var(--color-admin-rail-bg)]"
                style={{
                  backgroundColor:
                    badge.tone === "danger"
                      ? "var(--color-admin-rail-badge-danger)"
                      : "var(--color-admin-rail-badge-warn)",
                }}
              />
            ) : null}
          </span>
          {!collapsed ? (
            <>
              <span className="truncate">{item.label}</span>
              {badge ? (
                <span
                  className={cn(
                    "ml-auto rounded-full px-[6px] py-[1px]",
                    "text-[10px] font-bold text-white tabular-nums",
                  )}
                  style={{
                    backgroundColor:
                      badge.tone === "danger"
                        ? "var(--color-admin-rail-badge-danger)"
                        : "var(--color-admin-rail-badge-warn)",
                  }}
                  aria-label={`${badge.count} ${badge.label}`}
                >
                  {badge.count > 99 ? "99+" : badge.count}
                </span>
              ) : null}
            </>
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <>
      {/* Bouton hamburger — visible uniquement mobile (< lg) */}
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label={mobileOpen ? "Fermer la navigation" : "Ouvrir la navigation"}
        aria-expanded={mobileOpen}
        aria-controls="admin-sidebar-mobile"
        className={cn(
          "fixed top-[var(--space-admin-4)] left-[var(--space-admin-4)] z-[var(--z-admin-sticky)]",
          "flex items-center justify-center",
          "rounded-[var(--radius-admin-md)] p-[var(--space-admin-2)]",
          "border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]",
          "text-[color:var(--color-admin-fg-muted)] shadow-[var(--shadow-admin-2)]",
          "hover:bg-[color:var(--color-admin-surface-hover)]",
          "min-h-[var(--target-admin-min-mobile)] min-w-[var(--target-admin-min-mobile)]",
          "lg:hidden",
        )}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Overlay mobile (backdrop) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[calc(var(--z-admin-sticky)-1)] bg-black/50 backdrop-blur-[1px] lg:hidden"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        id="admin-sidebar-mobile"
        aria-label="Navigation admin"
        className={cn(
          "admin-rail flex flex-col",
          "border-r border-[color:var(--color-admin-rail-border)]",
          "bg-[color:var(--color-admin-rail-bg)] text-[color:var(--color-admin-rail-fg)]",
          // Desktop : épinglé sous la topbar, hauteur = viewport − topbar.
          "sticky top-[var(--admin-topbar-h)] h-[calc(100svh-var(--admin-topbar-h))]",
          "transition-[width,transform] duration-[var(--duration-admin-base)] ease-[var(--easing-admin)]",
          // Largeur alignée style SOS Expat 2026-07-08 : 320px ouverte / 80px repliée.
          collapsed ? "w-[80px]" : "w-[320px]",
          // Mobile : overlay plein écran via translate-x (CLS=0, pas de reflow).
          "max-lg:fixed max-lg:top-0 max-lg:left-0 max-lg:z-[var(--z-admin-sticky)] max-lg:h-svh max-lg:w-[320px]",
          mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          className,
        )}
      >
        {/* ── Header de marque ─────────────────────────────────────────── */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-[var(--space-admin-4)]",
            "border-b border-[color:var(--color-admin-rail-border)]",
            "px-[var(--space-admin-5)] py-[var(--space-admin-5)]",
            collapsed && "justify-center px-0",
          )}
        >
          <Link
            href={accountHref ?? "#"}
            aria-label="Tableau de bord Axion-IA"
            className={cn(
              "flex items-center gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)]",
              "transition-opacity hover:opacity-90",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-[30px] w-[30px] shrink-0 items-center justify-center",
                "rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-rail-accent)]",
                "text-[length:var(--text-admin-base)] font-bold text-white",
                "shadow-[var(--shadow-admin-2)]",
              )}
            >
              A
            </span>
            {!collapsed ? (
              <span className="flex flex-col leading-none">
                <span className="text-[length:var(--text-admin-base)] font-bold tracking-tight text-[color:var(--color-admin-rail-fg)]">
                  Axion-IA
                </span>
                <span className="mt-[3px] text-[length:var(--text-admin-xs)] font-medium tracking-wide text-[color:var(--color-admin-rail-fg-muted)] uppercase">
                  Console admin
                </span>
              </span>
            ) : null}
          </Link>
          {!collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Réduire la sidebar"
              aria-pressed={collapsed}
              title="Réduire (Cmd/Ctrl+B)"
              className={cn(
                "ml-auto flex shrink-0 items-center justify-center",
                "rounded-[var(--radius-admin-md)] p-[var(--space-admin-2)]",
                "text-[color:var(--color-admin-rail-fg-muted)]",
                "transition-colors hover:bg-[color:var(--color-admin-rail-hover)] hover:text-[color:var(--color-admin-rail-fg)]",
                "min-h-[var(--target-admin-min-desktop)] min-w-[var(--target-admin-min-desktop)]",
              )}
            >
              <PanelLeftClose size={16} />
            </button>
          ) : null}
        </div>

        {/* ── Recherche / bouton étendre (mode réduit) ─────────────────── */}
        <div
          className={cn(
            "shrink-0 px-[var(--space-admin-5)] pt-[var(--space-admin-5)] pb-[var(--space-admin-3)]",
            collapsed && "flex justify-center px-0",
          )}
        >
          {!collapsed ? (
            <div className="relative">
              <Search
                size={14}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-[var(--space-admin-4)] -translate-y-1/2 text-[color:var(--color-admin-rail-fg-muted)]"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrer la navigation…"
                aria-label="Filtrer la navigation admin"
                className={cn(
                  "w-full rounded-[var(--radius-admin-md)]",
                  "border border-[color:var(--color-admin-rail-border)] bg-[color:var(--color-admin-rail-bg-elevated)]",
                  "py-[var(--space-admin-3)] pr-[var(--space-admin-4)] pl-[calc(var(--space-admin-4)+18px)]",
                  "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-rail-fg)]",
                  "placeholder:text-[color:var(--color-admin-rail-fg-muted)]",
                  "transition-colors focus:border-[color:var(--color-admin-rail-accent)] focus:outline-none",
                )}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Étendre la sidebar"
              aria-pressed={collapsed}
              title="Étendre (Cmd/Ctrl+B)"
              className={cn(
                "flex items-center justify-center",
                "rounded-[var(--radius-admin-md)] p-[var(--space-admin-3)]",
                "text-[color:var(--color-admin-rail-fg-muted)]",
                "transition-colors hover:bg-[color:var(--color-admin-rail-hover)] hover:text-[color:var(--color-admin-rail-fg)]",
                "min-h-[var(--target-admin-min-desktop)] min-w-[var(--target-admin-min-desktop)]",
              )}
            >
              <PanelLeft size={16} />
            </button>
          )}
        </div>

        {/* ── Navigation (zone scrollable) ─────────────────────────────── */}
        <nav
          aria-label="Sections admin"
          className="flex-1 overflow-x-hidden overflow-y-auto px-[var(--space-admin-4)] pb-[var(--space-admin-4)]"
        >
          {/* Accès direct à Axion CRM Pro — outil de prospection dédié (appli séparée,
              ouverte dans un nouvel onglet). La prospection se pilote là-bas. */}
          <a
            href="https://app.axion-crm-pro.com"
            target="_blank"
            rel="noopener noreferrer"
            title="Ouvrir Axion CRM Pro (outil de prospection)"
            className={cn(
              "mb-[var(--space-admin-3)] flex items-center gap-[var(--space-admin-4)]",
              "rounded-[var(--radius-admin-md)] px-[var(--space-admin-3)] py-[var(--space-admin-3)]",
              "text-[color:var(--color-admin-rail-text)] ring-1 ring-[color:var(--color-admin-rail-border)]",
              "transition-opacity hover:opacity-80",
              collapsed && "justify-center",
            )}
          >
            <ScanSearch className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden />
            {!collapsed && (
              <>
                <span className="flex-1 text-sm font-medium">Prospection</span>
                <span aria-hidden className="text-sm opacity-60">
                  ↗
                </span>
              </>
            )}
          </a>
          {ADMIN_NAV_GROUP_ORDER.map((g, gi) => {
            // Exclut les items `parent != null` : atteignables par URL/palette
            // mais volontairement masqués de la sidebar (placeholders non livrés).
            const groupItems = filtered.filter((it) => it.group === g && it.parent == null);
            if (groupItems.length === 0) return null;
            // Les groupes déclarés dans GROUP_POLE_ORDER (« Génération de
            // contenu », « Formation / Qualiopi ») sont rendus en sous-pôles
            // (accordéon) — hors mode réduit et hors recherche.
            const poleOrder = GROUP_POLE_ORDER[g];
            const poleLabels = GROUP_POLE_LABELS[g];
            const renderAsPoles = poleOrder != null && !collapsed && !searchActive;
            const GroupIcon = GROUP_ICON_MAP[g] ?? FolderOpen;
            // Accordéon : fermé par défaut. N'agit qu'en mode étendu et hors
            // recherche. Le groupe actif est auto-ouvert par effet (cf. plus
            // haut) mais reste librement repliable — d'où PAS d'override ici.
            const groupClosed = !collapsed && !searchActive && collapsedGroups.has(g);
            const containsActive = activeGroup === g;
            // Bulle-somme du groupe FERMÉ (Will 2026-08-01) : l'ancien point de
            // 7 px disait « il y a quelque chose » sans dire COMBIEN.
            const closedBadge = groupClosed ? badgeRollup(groupItems) : null;
            return (
              <div
                key={g}
                className={cn(
                  "pb-[var(--space-admin-2)]",
                  // En mode réduit, divider fin entre groupes (pas de label).
                  collapsed &&
                    gi > 0 &&
                    "mt-[var(--space-admin-3)] border-t border-[color:var(--color-admin-rail-border)] pt-[var(--space-admin-3)]",
                )}
              >
                {/* ── Onglet principal (niveau 1) — toggle accordéon ── */}
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(g)}
                    aria-expanded={!groupClosed}
                    className={cn(
                      "group/main flex w-full items-center gap-[var(--space-admin-4)]",
                      "rounded-[var(--radius-admin-md)] px-[var(--space-admin-3)] py-[var(--space-admin-3)]",
                      "min-h-[36px] text-[length:var(--text-admin-base)] font-semibold",
                      // Onglet principal en TERRACOTTA (demande Will) — distingue
                      // nettement les onglets principaux des sous-onglets ivoire.
                      "text-[color:var(--color-admin-rail-accent)]",
                      "transition-colors hover:bg-[color:var(--color-admin-rail-hover)]",
                      // Section ouverte / contenant la page active : fond teinté.
                      containsActive && "bg-[color:var(--color-admin-rail-active-bg)]",
                    )}
                  >
                    <GroupIcon
                      size={18}
                      aria-hidden="true"
                      className="shrink-0 text-[color:var(--color-admin-rail-accent)]"
                    />
                    <span className="truncate">{ADMIN_NAV_GROUP_LABELS[g]}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-[var(--space-admin-2)]">
                      {/* Bulle-somme si onglet fermé contenant des badges */}
                      {closedBadge ? (
                        <span
                          className="rounded-full px-[6px] py-[1px] text-[10px] font-bold text-white tabular-nums"
                          style={{
                            backgroundColor:
                              closedBadge.tone === "danger"
                                ? "var(--color-admin-rail-badge-danger)"
                                : "var(--color-admin-rail-badge-warn)",
                          }}
                          aria-label={`${closedBadge.count} éléments à traiter dans cet onglet`}
                        >
                          {closedBadge.count > 99 ? "99+" : closedBadge.count}
                        </span>
                      ) : null}
                      <ChevronRight
                        size={15}
                        aria-hidden="true"
                        className={cn(
                          "text-[color:var(--color-admin-rail-fg-muted)]",
                          "transition-transform duration-[var(--duration-admin-fast)]",
                          !groupClosed && "rotate-90",
                        )}
                      />
                    </span>
                  </button>
                ) : null}

                {/* ── Sous-onglets — pôles (content_gen) ou liste plate ── */}
                {!groupClosed ? (
                  renderAsPoles ? (
                    // Génération de contenu : sous-accordéon par pôle. Chaque
                    // pôle (Lancer/Suivre/…) est un en-tête repliable au-dessus
                    // de ses onglets. La page courante ouvre son pôle d'office.
                    <div className="mt-[2px] ml-[calc(var(--space-admin-3)+9px)] flex flex-col gap-[var(--space-admin-2)] border-l border-[color:var(--color-admin-rail-border)] pl-[var(--space-admin-2)]">
                      {(poleOrder ?? []).map((pole) => {
                        const poleItems = groupItems.filter((it) => it.subGroup === pole);
                        if (poleItems.length === 0) return null;
                        // 🔴 Bug signalé par Will (2026-08-01) : « certains
                        // onglets, une fois déployés, ne se referment plus ».
                        // Cause : `&& activePole !== pole` forçait ouvert le
                        // pôle de la page courante — le clic de fermeture était
                        // ENREGISTRÉ dans collapsedPoles mais ignoré au rendu.
                        // L'auto-ouverture à la navigation est déjà assurée par
                        // l'effet sur [activePole] plus haut : cette condition
                        // était une ceinture redondante qui cassait le toggle.
                        const poleClosed = collapsedPoles.has(pole);
                        return (
                          <div key={pole}>
                            <button
                              type="button"
                              onClick={() => togglePole(pole)}
                              aria-expanded={!poleClosed}
                              className={cn(
                                "flex w-full items-center gap-[var(--space-admin-3)]",
                                "rounded-[var(--radius-admin-md)] px-[var(--space-admin-3)] py-[var(--space-admin-2)]",
                                "min-h-[28px] text-[length:var(--text-admin-xs)] font-bold tracking-wide uppercase",
                                "text-[color:var(--color-admin-rail-fg-soft)]",
                                "transition-colors hover:bg-[color:var(--color-admin-rail-hover)] hover:text-[color:var(--color-admin-rail-fg)]",
                              )}
                            >
                              {(() => {
                                const PoleIcon = POLE_ICON_MAP[pole];
                                return PoleIcon ? (
                                  <PoleIcon
                                    size={13}
                                    aria-hidden="true"
                                    className="shrink-0 opacity-80"
                                  />
                                ) : null;
                              })()}
                              <span className="truncate">{poleLabels?.[pole] ?? pole}</span>
                              <span className="ml-auto flex shrink-0 items-center gap-[var(--space-admin-2)]">
                                {/* Bulle-somme sur pôle REPLIÉ (Will 2026-08-01) :
                                    fermé, il ne doit pas cacher son en-attente. */}
                                {(() => {
                                  const b = poleClosed ? badgeRollup(poleItems) : null;
                                  return b ? (
                                    <span
                                      className="rounded-full px-[6px] py-[1px] text-[10px] font-bold text-white tabular-nums"
                                      style={{
                                        backgroundColor:
                                          b.tone === "danger"
                                            ? "var(--color-admin-rail-badge-danger)"
                                            : "var(--color-admin-rail-badge-warn)",
                                      }}
                                      aria-label={`${b.count} éléments à traiter dans cette section`}
                                    >
                                      {b.count > 99 ? "99+" : b.count}
                                    </span>
                                  ) : null;
                                })()}
                                <ChevronRight
                                  size={14}
                                  aria-hidden="true"
                                  className={cn(
                                    "shrink-0 text-[color:var(--color-admin-rail-fg-muted)]",
                                    "transition-transform duration-[var(--duration-admin-fast)]",
                                    !poleClosed && "rotate-90",
                                  )}
                                />
                              </span>
                            </button>
                            {!poleClosed ? (
                              <ul className="mt-[2px] flex flex-col gap-[2px]">
                                {poleItems.map(renderItem)}
                              </ul>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <ul
                      className={cn(
                        "flex flex-col gap-[2px]",
                        !collapsed &&
                          "mt-[2px] ml-[calc(var(--space-admin-3)+9px)] border-l border-[color:var(--color-admin-rail-border)] pl-[var(--space-admin-3)]",
                      )}
                    >
                      {groupItems.map(renderItem)}
                    </ul>
                  )
                ) : null}
              </div>
            );
          })}
          {/* Aucun résultat de recherche */}
          {!collapsed && filtered.length === 0 ? (
            <p className="px-[var(--space-admin-3)] py-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-rail-fg-muted)]">
              Aucune section pour « {search} ».
            </p>
          ) : null}
        </nav>

        {/* ── Footer profil ────────────────────────────────────────────── */}
        {userEmail ? (
          <div
            className={cn(
              "shrink-0 border-t border-[color:var(--color-admin-rail-border)]",
              "bg-[color:var(--color-admin-rail-bg-elevated)]",
              "px-[var(--space-admin-4)] py-[var(--space-admin-4)]",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-[var(--space-admin-4)]",
                collapsed && "justify-center",
              )}
            >
              <Link
                href={accountHref ?? "#"}
                title={collapsed ? userEmail : "Mon compte"}
                aria-label={`Mon compte — ${userEmail}`}
                className={cn(
                  "flex min-w-0 items-center gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)]",
                  "transition-colors hover:bg-[color:var(--color-admin-rail-hover)]",
                  collapsed ? "p-[2px]" : "flex-1 p-[var(--space-admin-2)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full",
                    "bg-[color:var(--color-admin-rail-avatar-bg)]",
                    "text-[10px] font-bold text-white",
                  )}
                >
                  {initials}
                </span>
                {!collapsed ? (
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-rail-fg)]">
                      {userEmail}
                    </span>
                    <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-rail-fg-muted)]">
                      Administrateur
                    </span>
                  </span>
                ) : null}
              </Link>
              {!collapsed && logoutAction ? (
                <form action={logoutAction} className="shrink-0">
                  <button
                    type="submit"
                    aria-label="Se déconnecter"
                    title="Se déconnecter"
                    className={cn(
                      "flex items-center justify-center",
                      "rounded-[var(--radius-admin-md)] p-[var(--space-admin-2)]",
                      "text-[color:var(--color-admin-rail-fg-muted)]",
                      "transition-colors hover:bg-[color:var(--color-admin-rail-hover)] hover:text-[color:var(--color-admin-rail-badge-danger)]",
                      "min-h-[var(--target-admin-min-desktop)] min-w-[var(--target-admin-min-desktop)]",
                    )}
                  >
                    <LogOut size={16} />
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}

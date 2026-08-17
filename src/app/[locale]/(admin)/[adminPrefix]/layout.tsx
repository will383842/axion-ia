// Layout admin (Sprint 15 step 5 / M9 init + sidebar M9 extension 2026-05-10).
//
// Pattern : URL secrete configurable via ADMIN_URL_PREFIX env. Le segment
// dynamique [adminPrefix] est valide runtime contre l'env — toute valeur
// differente → 404. Cela evite de hardcoder un nom de dossier sensible
// dans le repo public.
//
// Doctrine CLAUDE.md §14 : interface admin FR uniquement. Si le user
// arrive sur /en/<prefix>/* on redirige vers /fr/<prefix>/*.
//
// Layout = header global + sidebar persistante (toutes les sections M9 +
// les pages ops /infra et /alerts) + main content. La sidebar n'est
// affichée que pour les utilisateurs authentifiés (la page /login affiche
// son propre layout simplifié via children).

// Refonte admin mai 2026 — PR 1 (ADR 0028) :
//   - Import admin.css (tokens préfixés --color-admin-* etc., cloisonné admin).
//   - Import print.css (mediaquery print pour factures/devis/échéanciers).
//   - buildNav extrait vers src/lib/admin-nav.ts (SSOT, audit A1 finding #4).
//   - Mount AdminSessionExpiryWarning (mitigation §3.6 — heartbeat 5min).
// V1 visuel intact ; les ajouts sont passifs jusqu'à la PR 5/6.

import type { Metadata } from "next";
import localFont from "next/font/local";
import { redirect, notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth, signOut } from "@/auth";
import type { Locale } from "@/i18n/routing";
import {
  AdminSessionExpiryWarning,
  AdminSidebarNav,
  AdminTopbar,
  AdminUserMenu,
  AdminNotificationsDropdown,
} from "@/components/admin/ui";
import type { AdminNotificationItem } from "@/components/admin/ui";
import { unstable_cache } from "next/cache";
import { buildAdminNav, type AdminNavItem } from "@/lib/admin-nav";
import { AdminCommandPalette } from "./AdminCommandPalette";
import { getFailedJobsCount } from "@/server/actions/content-gen/jobs";
import { prisma } from "@/lib/prisma";

// Refonte admin juin 2026 — police Inter pour TOUTE la console (lisibilité
// supérieure en petites tailles, référence des dashboards modernes). Exposée
// via la variable CSS `--font-admin`, appliquée par admin.css à
// `.admin-layout-v2 / .admin-layout` (et au rail `.admin-rail`).
// Self-host woff2 depuis `src/fonts/` ; admin = noindex/force-dynamic (hors
// budget Web Vitals des 15 pages publiques).
//
// 2026-08-16 — bascule `next/font/google` → `next/font/local` : le build ne
// dépend plus d'un fetch vivant vers fonts.gstatic.com. Voir le bandeau
// d'explication dans `src/app/[locale]/layout.tsx` et l'ADR 0027. Un seul
// fichier variable sert les quatre graisses, exactement comme le CSS que
// Google renvoyait pour `Inter:wght@400;500;600;700`.
const interAdmin = localFont({
  src: [
    { path: "../../../../fonts/inter-latin-var.woff2", weight: "400", style: "normal" },
    { path: "../../../../fonts/inter-latin-var.woff2", weight: "500", style: "normal" },
    { path: "../../../../fonts/inter-latin-var.woff2", weight: "600", style: "normal" },
    { path: "../../../../fonts/inter-latin-var.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-admin",
});

// Sprint Notif Infra 2026-05-26 / fix P1-1 audit 2026-05-27 — cache 30s du
// compteur "contacts sans réponse" pour éviter une query DB à chaque render
// SSR du layout admin (force-dynamic). Invalidation via revalidateTag
// "admin:contacts-unread" depuis les server actions reply/archive/markAttn.
const getUnreadContactsCount = unstable_cache(
  async (): Promise<number> => {
    return prisma.submission
      .count({ where: { needsAttention: true, archivedAt: null } })
      .catch(() => 0);
  },
  ["admin-contacts-unread-count"],
  { revalidate: 30, tags: ["admin:contacts-unread"] },
);

// Pastille « offres d'emploi à republier » (fraîcheur Google for Jobs,
// 2026-08-13). Cache 5 min — le compteur ne bouge qu'à la republication ou au
// vieillissement quotidien ; invalidation immédiate via revalidateTag
// "admin:job-offers-stale" depuis les server actions offres-emploi.
const getStaleJobPostingsCount = unstable_cache(
  async (): Promise<number> => {
    const { countStaleJobPostings } = await import("@/server/careers/freshness");
    return countStaleJobPostings().catch(() => 0);
  },
  // Pas de préfixe « admin- » dans la clé : le test admin-design-tokens
  // balaie toutes les chaînes `admin-*` comme des classes CSS candidates.
  ["job-offers-stale-count"],
  { revalidate: 300, tags: ["admin:job-offers-stale"] },
);

import {
  getInboxActionCounts,
  EMPTY_INBOX_COUNTS,
  type InboxActionCounts,
} from "@/features/admin-inbox/counters";
import {
  compterQualiopiNav,
  COMPTEURS_VIDES,
  type QualiopiNavCounts,
} from "@/server/admin/qualiopi-nav-counts";

import "@/app/admin.css";
import "@/app/print.css";

export const dynamic = "force-dynamic";

// P0 audit Perfection 2026 — toutes les pages admin doivent être noindex.
// Le robots.txt ne suffit pas (il bloque /admin/ générique mais pas
// /[adminPrefix]/ dynamique). Cette propagation via layout couvre les
// 109 pages enfants en une seule déclaration.
/**
 * 🔴 171 PAGES DE LA CONSOLE S'ANNONÇAIENT COMME LE SITE MARKETING.
 *
 * Vérifié dans le navigateur en production, avec les deux contrôles :
 *   - /alerts (sans metadata propre) → onglet « Axion-IA — Cabinet IA
 *     opérationnel », alors que la page titre « Alertes ops » ;
 *   - /qualiopi/stagiaires (avec metadata) → onglet correct.
 *
 * Ce layout ne déclarait que « robots ». Sans « title », la résolution
 * remontait jusqu'au titre par défaut de la locale — celui du site public.
 * Sur 262 pages d'administration, 171 n'ont pas de titre propre : leur
 * onglet, leur favori et leur historique portaient le nom d'un autre site.
 *
 * Un défaut posé ici suffit : les 91 pages qui déclarent leur titre le gardent,
 * les 171 autres héritent d'un nom d'administration. Le gabarit du site public
 * (« … · Axion-IA ») est neutralisé pour la console : un écran interne n'a pas
 * à se présenter sous la marque commerciale.
 *
 * Ça ne se voit pas en lisant une page : il faut ouvrir un onglet.
 */
export const metadata: Metadata = {
  title: { default: "Console admin | Axion-IA", template: "%s" },
  robots: { index: false, follow: false },
};

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string; adminPrefix: string }>;
}

// P2-25 audit E2E NAV+CTA 2026-05-15 — markup sidebar extrait dans
// `components/admin/AdminSidebar.tsx` (client component pour aria-current
// dynamique). Le layout reste serveur + propage la nav via prop.
//
// Refonte admin mai 2026 PR 1 — buildNav() relocalisé dans
// src/lib/admin-nav.ts (SSOT, consommé aussi par AdminCommandPalette
// après PR 5). Le wrapper local préserve la signature historique.
// Le type des items de nav = SSOT `AdminNavItem` (src/lib/admin-nav.ts). On
// réutilise directement le type source pour éviter tout drift de l'union des
// groupes (l'ancien type local listait 6 groupes et omettait notamment
// « presse », « qualiopi », etc. — source de confusion, jamais bloquante car
// `buildAdminNav` reste la SSOT runtime).
type NavItem = AdminNavItem;

function buildNav(adminPrefix: string): NavItem[] {
  // Délègue à la SSOT (src/lib/admin-nav.ts) pour éviter le drift avec
  // AdminCommandPalette qui consomme la même source. Copie mutable (la SSOT
  // renvoie un `readonly[]`).
  return [...buildAdminNav(adminPrefix)];
}

// Server Action de déconnexion exposée au footer profil de la sidebar (rail
// mocha). POST via <form action> — évite le GET → 405 sur /api/auth/signout
// (Auth.js v5 attend un POST). Même pattern que DashboardV2Wrapper.logoutAction.
async function logoutAction(): Promise<void> {
  "use server";
  await signOut({ redirect: false });
  const prefix = process.env["ADMIN_URL_PREFIX"] ?? "admin-dev-x7k2n9";
  redirect(`/fr/${prefix}/login`);
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale, adminPrefix } = await params;
  const expectedPrefix = process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9";

  // 1. Valide segment URL contre env (404 silencieux sinon — pas de fingerprint)
  if (adminPrefix !== expectedPrefix) {
    notFound();
  }

  // 2. Force FR (CLAUDE.md §14 admin doctrine FR uniquement)
  if (locale !== "fr") {
    redirect(`/fr/${expectedPrefix}`);
  }

  setRequestLocale(locale as Locale);

  // Sidebar n'apparaît que pour les sessions authentifiées (la page /login a sa
  // propre UI via children — sans session, pas de sidebar).
  // NB : cast inline (PAS de `type AdminSession` local). Turbopack dev (Next
  // 16.2) capture à tort un alias de type déclaré DANS un module à "use server"
  // comme une valeur runtime → `ReferenceError: AdminSession is not defined`
  // (500 sur TOUTE la console admin). L'inliner supprime le binding nommé.
  const session = (await auth()) as { user?: { email?: string | null } | null } | null;
  const showSidebar = Boolean(session?.user);
  const nav: NavItem[] = buildNav(adminPrefix);
  const adminBase = `/fr/${adminPrefix}`;

  // Sprint A-suite P6 — Item 2. Badge rouge failed jobs sidebar.
  // Fire-and-forget au rendu SSR ; si DB non disponible (stub) → 0, pas de badge.
  let failedJobsCount = 0;
  // A-12 SP-X3 — Notifications topbar + badge alertes sidebar.
  const notificationItems: AdminNotificationItem[] = [];
  let alertsCount = 0;
  // Vérif Site Explorer — Badge anomalies high severity (non résolues).
  let siteExplorerAnomaliesHighCount = 0;
  // Sprint Notif Infra — Badge contacts sans réponse (needsAttention=true,
  // non archivés). Filtre par défaut de l'inbox côté listing.
  let unreadContactsCount = 0;
  // Badges « à traiter » de la boîte de réception (2026-07-29).
  let inboxCounts: InboxActionCounts = EMPTY_INBOX_COUNTS;
  // Pastilles console Qualiopi (refonte phase 1, 2026-08-01) : signatures en
  // attente + e-mails à valider + alertes non lues. Fail-soft interne → 0.
  let qualiopiCounts: QualiopiNavCounts = COMPTEURS_VIDES;
  // Pastille « offres d'emploi à republier » (fraîcheur Google for Jobs).
  let staleJobOffersCount = 0;

  if (showSidebar) {
    // Fetch failedJobsCount + DB-stored anomaly alerts in parallel.
    const ANOMALY_KEYS = [
      "alert_quality_drop",
      "alert_reject_spike",
      "alert_pipeline_stall",
      "cost_cap_80_active",
    ] as const;

    const [
      failedCount,
      anomalyRows,
      siteExplorerHighCount,
      unreadCount,
      inboxActionCounts,
      qualiopiNavCounts,
      staleJobsCount,
    ] = await Promise.all([
      getFailedJobsCount().catch(() => 0),
      prisma.contentGenConfig
        .findMany({
          where: { key: { in: [...ANOMALY_KEYS] } },
          select: { key: true, value: true, updatedAt: true },
        })
        .catch(() => [] as Array<{ key: string; value: unknown; updatedAt: Date }>),
      prisma.siteRouteAnomaly
        .count({ where: { severity: "high", resolvedAt: null } })
        .catch(() => 0),
      getUnreadContactsCount(),
      getInboxActionCounts(),
      compterQualiopiNav().catch(() => COMPTEURS_VIDES),
      getStaleJobPostingsCount().catch(() => 0),
    ]);

    failedJobsCount = failedCount;
    siteExplorerAnomaliesHighCount = siteExplorerHighCount;
    unreadContactsCount = unreadCount;
    inboxCounts = inboxActionCounts;
    qualiopiCounts = qualiopiNavCounts;
    staleJobOffersCount = staleJobsCount;

    // Build notification items from DB anomaly alerts.
    for (const row of anomalyRows) {
      const val = row.value as {
        active?: boolean;
        message?: string;
        provider?: string;
        pct?: number;
      } | null;
      if (!val?.active) continue;

      if (row.key === "cost_cap_80_active") {
        const pct = val.pct ?? 0;
        const costNotif: AdminNotificationItem = {
          id: "cost_cap_80",
          title: `Coût ${pct >= 100 ? "plafond atteint" : `${pct}% du plafond`}`,
          href: `${adminBase}/content-gen/costs`,
          severity: pct >= 100 ? "destructive" : "warning",
          createdAt: row.updatedAt.toISOString(),
          ...(val.provider ? { description: `Provider : ${val.provider}` } : {}),
        };
        notificationItems.push(costNotif);
        alertsCount++; // cost cap counts as an ops alert
        continue;
      }

      const labelMap: Record<string, string> = {
        alert_quality_drop: "Chute qualité détectée",
        alert_reject_spike: "Spike de rejets",
        alert_pipeline_stall: "Pipeline bloqué",
      };
      const anomalyNotif: AdminNotificationItem = {
        id: row.key,
        title: labelMap[row.key] ?? row.key,
        href: `${adminBase}/content-gen/jobs?status=failed`,
        severity: "destructive",
        createdAt: row.updatedAt.toISOString(),
        ...(val.message ? { description: val.message } : {}),
      };
      notificationItems.push(anomalyNotif);
    }

    // Failed jobs notification (if any).
    if (failedJobsCount > 0) {
      notificationItems.push({
        id: "failed_jobs",
        title: `${failedJobsCount} job${failedJobsCount > 1 ? "s" : ""} en échec`,
        href: `${adminBase}/content-gen/jobs`,
        severity: "destructive",
        createdAt: new Date().toISOString(),
      });
    }

    // Sort: destructive first, then warning, then by date desc.
    const sevOrder: Record<AdminNotificationItem["severity"], number> = {
      destructive: 0,
      warning: 1,
      info: 2,
      success: 3,
    };
    notificationItems.sort(
      (a, b) =>
        (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  // CSS injecté côté admin (force-dynamic) pour masquer le Header/Footer publics
  // rendus par [locale]/layout.tsx. Cette approche remplace l'ancienne lecture
  // headers() dans le root layout qui forçait TOUTES les pages en dynamic (no-store),
  // cassant le BF-cache et dégradant le score Lighthouse best-practices des pages SSG.
  // bg-terracotta = classe racine unique du Header public.
  // bg-mocha-rich  = classe racine unique du Footer public.
  const adminHidePublicShellCss = `
    body:has(.admin-layout-v2) header.bg-terracotta,
    body:has(.admin-layout-v2) footer.bg-mocha-rich,
    body:has(.admin-layout) header.bg-terracotta,
    body:has(.admin-layout) footer.bg-mocha-rich { display: none !important; }
    body:has(.admin-layout-v2) #main,
    body:has(.admin-layout) #main { display: contents; }
  `.trim();

  if (showSidebar && session?.user) {
    // V2 shell permanent — feature flag supprimé 2026-05-20.
    // Le logout reste exposé par le dashboard root V2 (form action signOut).
    // L'AdminUserMenu n'a pas de logoutHref ici — éviterait un GET → 405 sur
    // /api/auth/signout (Auth.js v5 attend un POST).
    return (
      <div
        className={`admin-layout-v2 ${interAdmin.variable} min-h-screen bg-[color:var(--color-admin-bg)]`}
      >
        {}
        <style dangerouslySetInnerHTML={{ __html: adminHidePublicShellCss }} />
        <AdminTopbar
          brand={
            // Mobile uniquement : le rail (hors-écran sur mobile) porte
            // l'identité sur desktop. Décalé (pl) pour dégager le hamburger
            // flottant. Pastille « A » terracotta = écho du logo du rail.
            <span className="flex items-center gap-[var(--space-admin-3)] pl-[44px] lg:hidden">
              <span
                aria-hidden="true"
                className="flex h-[26px] w-[26px] items-center justify-center rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-rail-accent)] text-[length:var(--text-admin-sm)] font-bold text-white"
              >
                A
              </span>
              <span className="text-[length:var(--text-admin-base)] font-bold tracking-tight text-[color:var(--color-admin-fg)]">
                Axion-IA
              </span>
            </span>
          }
          commandPalette={<AdminCommandPalette adminPrefix={adminPrefix} />}
          notifications={
            <AdminNotificationsDropdown items={notificationItems} allHref={`${adminBase}/alerts`} />
          }
          userMenu={
            session.user.email ? (
              <AdminUserMenu email={session.user.email} adminBase={adminBase} />
            ) : undefined
          }
        />
        <div className="flex">
          <AdminSidebarNav
            items={nav}
            failedJobsCount={failedJobsCount}
            alertsCount={alertsCount}
            siteExplorerAnomaliesHighCount={siteExplorerAnomaliesHighCount}
            unreadContactsCount={unreadContactsCount}
            inboxCounts={inboxCounts}
            qualiopiCounts={qualiopiCounts}
            staleJobOffersCount={staleJobOffersCount}
            userEmail={session.user.email ?? null}
            accountHref={adminBase}
            logoutAction={logoutAction}
          />
          <main className="admin-main min-w-0 flex-1">{children}</main>
        </div>
        <AdminSessionExpiryWarning />
      </div>
    );
  }

  // Pas de session — page /login (children gère son propre rendu).
  return (
    <div className={`admin-layout ${interAdmin.variable}`}>
      {}
      <style dangerouslySetInnerHTML={{ __html: adminHidePublicShellCss }} />
      <main className="admin-main">{children}</main>
    </div>
  );
}

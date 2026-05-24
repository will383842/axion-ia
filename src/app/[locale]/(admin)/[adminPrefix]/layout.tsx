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
import { redirect, notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import type { Locale } from "@/i18n/routing";
import {
  AdminSessionExpiryWarning,
  AdminSidebarNav,
  AdminTopbar,
  AdminUserMenu,
  AdminNotificationsDropdown,
} from "@/components/admin/ui";
import type { AdminNotificationItem } from "@/components/admin/ui";
import { buildAdminNav } from "@/lib/admin-nav";
import { AdminCommandPalette } from "./AdminCommandPalette";
import { getFailedJobsCount } from "@/server/actions/content-gen/jobs";
import { prisma } from "@/lib/prisma";

import "@/app/admin.css";
import "@/app/print.css";

export const dynamic = "force-dynamic";

// P0 audit Perfection 2026 — toutes les pages admin doivent être noindex.
// Le robots.txt ne suffit pas (il bloque /admin/ générique mais pas
// /[adminPrefix]/ dynamique). Cette propagation via layout couvre les
// 109 pages enfants en une seule déclaration.
export const metadata: Metadata = {
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
interface NavItem {
  href: string;
  label: string;
  icon: string;
  group: "main" | "content" | "image-bank" | "engagement" | "ops" | "system";
}

function buildNav(adminPrefix: string): NavItem[] {
  // Délègue à la SSOT (src/lib/admin-nav.ts) pour éviter le drift avec
  // AdminCommandPalette qui consommera la même source en PR 5.
  return buildAdminNav(adminPrefix) as NavItem[];
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
  type AdminSession = { user?: { email?: string | null } | null } | null;
  const session = (await auth()) as AdminSession;
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

  if (showSidebar) {
    // Fetch failedJobsCount + DB-stored anomaly alerts in parallel.
    const ANOMALY_KEYS = [
      "alert_quality_drop",
      "alert_reject_spike",
      "alert_pipeline_stall",
      "cost_cap_80_active",
    ] as const;

    const [failedCount, anomalyRows, siteExplorerHighCount] = await Promise.all([
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
    ]);

    failedJobsCount = failedCount;
    siteExplorerAnomaliesHighCount = siteExplorerHighCount;

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
        href: `${adminBase}/content-gen/monitoring`,
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
      <div className="admin-layout-v2 min-h-screen bg-[color:var(--color-admin-bg)]">
        {}
        <style dangerouslySetInnerHTML={{ __html: adminHidePublicShellCss }} />
        <AdminTopbar
          brand={<strong className="admin-brand">Axion-IA · Admin</strong>}
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
          />
          <main className="admin-main min-w-0 flex-1">{children}</main>
        </div>
        <AdminSessionExpiryWarning />
      </div>
    );
  }

  // Pas de session — page /login (children gère son propre rendu).
  return (
    <div className="admin-layout">
      {}
      <style dangerouslySetInnerHTML={{ __html: adminHidePublicShellCss }} />
      <main className="admin-main">{children}</main>
    </div>
  );
}

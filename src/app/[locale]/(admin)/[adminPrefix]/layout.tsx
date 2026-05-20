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

import { redirect, notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import type { Locale } from "@/i18n/routing";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import {
  AdminSessionExpiryWarning,
  AdminSidebarNav,
  AdminTopbar,
  AdminUserMenu,
} from "@/components/admin/ui";
import { buildAdminNav } from "@/lib/admin-nav";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { AdminCommandPalette } from "./AdminCommandPalette";

import "@/app/admin.css";
import "@/app/print.css";

export const dynamic = "force-dynamic";

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
  const v2 = showSidebar ? await isAdminV2Enabled() : false;
  const adminBase = `/fr/${adminPrefix}`;

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

  if (v2 && session?.user) {
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
          userMenu={
            session.user.email ? (
              <AdminUserMenu email={session.user.email} adminBase={adminBase} />
            ) : undefined
          }
        />
        <div className="flex">
          <AdminSidebarNav items={nav} />
          <main className="admin-main min-w-0 flex-1">{children}</main>
        </div>
        <AdminSessionExpiryWarning />
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {}
      <style dangerouslySetInnerHTML={{ __html: adminHidePublicShellCss }} />
      <header className="admin-header">
        <div className="admin-header-inner">
          <strong className="admin-brand">Axion-IA · Admin</strong>
          {showSidebar && (
            <div className="admin-header-actions">
              <AdminCommandPalette adminPrefix={adminPrefix} />
              {session?.user?.email && <span className="admin-tagline">{session.user.email}</span>}
            </div>
          )}
        </div>
      </header>
      <div className={showSidebar ? "admin-shell" : "admin-shell admin-shell-noaside"}>
        {showSidebar && <AdminSidebar nav={nav} />}
        <main className="admin-main">{children}</main>
      </div>
      {/* Refonte PR 1 — mitigation §3.6 : heartbeat session 5min, modal
          non-bloquante si expiration imminente. Mount uniquement quand
          authentifié (économise un fetch sur /login). */}
      {showSidebar && <AdminSessionExpiryWarning />}
    </div>
  );
}

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

import { redirect, notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string; adminPrefix: string }>;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  group: "main" | "content" | "engagement" | "ops" | "system";
}

function buildNav(adminPrefix: string): NavItem[] {
  const base = `/fr/${adminPrefix}`;
  return [
    // ── main ─────────────────────────────────────────────────────────────
    { href: `${base}`, label: "Tableau de bord", icon: "📊", group: "main" },
    { href: `${base}/calendrier`, label: "Calendrier", icon: "📅", group: "main" },
    { href: `${base}/reservations`, label: "Réservations", icon: "📋", group: "main" },
    { href: `${base}/options`, label: "Options 48h", icon: "⏳", group: "main" },
    { href: `${base}/submissions`, label: "Soumissions", icon: "📥", group: "main" },
    // ── contenu ──────────────────────────────────────────────────────────
    { href: `${base}/connaissances`, label: "Connaissances", icon: "📚", group: "content" },
    { href: `${base}/blog`, label: "Blog", icon: "📝", group: "content" },
    { href: `${base}/categories`, label: "Catégories", icon: "🏷️", group: "content" },
    { href: `${base}/case-studies`, label: "Cas concrets", icon: "🏆", group: "content" },
    { href: `${base}/testimonials`, label: "Témoignages", icon: "💬", group: "content" },
    { href: `${base}/faq`, label: "FAQ", icon: "❓", group: "content" },
    { href: `${base}/help`, label: "Centre d'aide", icon: "❔", group: "content" },
    // ── engagement ───────────────────────────────────────────────────────
    { href: `${base}/newsletter`, label: "Newsletter", icon: "📧", group: "engagement" },
    // ── ops & monitoring ─────────────────────────────────────────────────
    { href: `${base}/analytics`, label: "Analytics & SEO", icon: "📊", group: "ops" },
    { href: `${base}/infra`, label: "Infra & outils", icon: "🔧", group: "ops" },
    { href: `${base}/alerts`, label: "Alertes ops", icon: "🚨", group: "ops" },
    // ── système ──────────────────────────────────────────────────────────
    { href: `${base}/users`, label: "Utilisateurs", icon: "👥", group: "system" },
    { href: `${base}/activity-logs`, label: "Activity logs", icon: "📜", group: "system" },
    { href: `${base}/settings`, label: "Paramètres", icon: "⚙️", group: "system" },
    { href: `${base}/2fa/setup`, label: "2FA — sécurité", icon: "🔐", group: "system" },
  ];
}

const groupLabels: Record<NavItem["group"], string> = {
  main: "Activité quotidienne",
  content: "Contenu",
  engagement: "Engagement",
  ops: "Ops & monitoring",
  system: "Système",
};

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
  const session = await auth();
  const showSidebar = Boolean(session?.user);
  const nav = buildNav(adminPrefix);
  const groups: NavItem["group"][] = ["main", "content", "engagement", "ops", "system"];

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-inner">
          <strong className="admin-brand">Axion-IA · Admin</strong>
          {showSidebar && session?.user?.email && (
            <span className="admin-tagline">{session.user.email}</span>
          )}
        </div>
      </header>
      <div className={showSidebar ? "admin-shell" : "admin-shell admin-shell-noaside"}>
        {showSidebar && (
          <aside className="admin-sidebar" aria-label="Navigation admin">
            {groups.map((g) => (
              <div key={g} className="admin-nav-group">
                <p className="admin-nav-group-label">{groupLabels[g]}</p>
                <ul className="admin-nav-list">
                  {nav
                    .filter((item) => item.group === g)
                    .map((item) => (
                      <li key={item.href}>
                        <a href={item.href} className="admin-nav-link">
                          <span className="admin-nav-icon" aria-hidden="true">
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </a>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </aside>
        )}
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}

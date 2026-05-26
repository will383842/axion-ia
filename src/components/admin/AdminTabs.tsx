// Admin tabs réutilisable — SSR-friendly (Sprint Notif Infra 2026-05-26).
//
// Composant Server Component pur : reçoit `currentPath` côté parent, calcule
// l'onglet actif côté serveur. Pas d'interactivité JS — utilise des liens
// simples qui re-rendent la page (cohérent avec admin = SSR-first + JS
// critical-path minimal pour respect Web Vitals).
//
// A11y : roles tablist/tab, `aria-current="page"`, `aria-controls` qui
// correspond à un panel SSR rendu en dessous. Navigation clavier native
// (Tab pour passer d'un lien à l'autre — pas besoin de gérer arrow keys ici
// puisqu'on est en SSR).

import Link from "next/link";

export interface AdminTabItem {
  /** Slug interne unique (utilisé pour aria-controls). */
  id: string;
  /** Label affiché. */
  label: string;
  /** Compteur optionnel (badge à droite du label). */
  count?: number;
  /** URL absolue de l'onglet. */
  href: string;
}

interface AdminTabsProps {
  /** Tous les onglets disponibles. */
  tabs: ReadonlyArray<AdminTabItem>;
  /** ID de l'onglet actif (pour aria-current + style). */
  activeTabId: string;
  /** Label optionnel du groupe (aria-label de la tablist). */
  ariaLabel?: string;
}

export function AdminTabs({
  tabs,
  activeTabId,
  ariaLabel = "Onglets",
}: AdminTabsProps): React.ReactElement {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="admin-tabs flex items-end gap-1 border-b border-[color:var(--color-admin-border-default)]"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            aria-controls={`${tab.id}-panel`}
            className={[
              "admin-tab",
              "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium",
              "-mb-px border-b-2 transition-colors",
              isActive
                ? "border-[color:var(--color-admin-terracotta)] text-[color:var(--color-admin-fg-default)]"
                : "border-transparent text-[color:var(--color-admin-fg-muted)] hover:border-[color:var(--color-admin-border-strong)] hover:text-[color:var(--color-admin-fg-default)]",
              "rounded-t focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-terracotta)] focus-visible:ring-offset-2 focus-visible:outline-none",
            ].join(" ")}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 ? (
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--color-admin-terracotta)]/10 px-1.5 text-[11px] font-semibold text-[color:var(--color-admin-terracotta)]"
                aria-label={`${tab.count} ${tab.count > 1 ? "éléments" : "élément"}`}
              >
                {tab.count > 999 ? "999+" : tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

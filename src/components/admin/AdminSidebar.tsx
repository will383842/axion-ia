"use client";
// use-client: usePathname() pour aria-current="page" sur le lien actif.
//
// P2-25 audit E2E NAV+CTA 2026-05-15 — extraction du markup sidebar du
// layout admin pour : (1) clarifier 101 sections (5 groupes) en composant
// réutilisable, (2) ajouter `aria-current="page"` sur le lien actif via
// `usePathname()` côté client (manquait avant — anti-pattern a11y).

import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  group: "main" | "content" | "image-bank" | "engagement" | "ops" | "system";
}

const GROUP_LABELS: Record<NavItem["group"], string> = {
  main: "Activité quotidienne",
  content: "Contenu",
  "image-bank": "Banque d'images",
  engagement: "Engagement",
  ops: "Ops & monitoring",
  system: "Système",
};

const GROUP_ORDER: NavItem["group"][] = [
  "main",
  "content",
  "image-bank",
  "engagement",
  "ops",
  "system",
];

interface AdminSidebarProps {
  nav: ReadonlyArray<NavItem>;
}

export function AdminSidebar({ nav }: AdminSidebarProps) {
  const pathname = usePathname();
  return (
    <aside className="admin-sidebar" aria-label="Navigation admin">
      {GROUP_ORDER.map((g) => {
        const items = nav.filter((item) => item.group === g);
        if (items.length === 0) return null;
        return (
          <div key={g} className="admin-nav-group">
            <p className="admin-nav-group-label">{GROUP_LABELS[g]}</p>
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

// Contacts admin — layout sticky tabs (Sprint Notif Infra 2026-05-26).
//
// Tabs persistants en tête de page :
//   - Messages (ancien /submissions/**)
//   - RDV Calendly (Chantier 3 — visible mais peuplé en Phase 7)
//
// Le `currentTab` est dérivé du segment d'URL côté Server Component via
// `headers()` + `x-current-path` (Next.js 16 expose `nextUrl.pathname` via
// le proxy headers en App Router). Pour rester portable, on lit le pathname
// via `headers()` `x-pathname` (header injecté par `middleware.ts` typique)
// SI dispo, sinon on tombe en fallback "messages" (default).

import type { Metadata } from "next";
import { headers } from "next/headers";
import { AdminPageShell } from "@/components/admin/ui";
import { AdminTabs, type AdminTabItem } from "@/components/admin/AdminTabs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ adminPrefix: string }>;
}

export default async function ContactsLayout({
  children,
  params,
}: LayoutProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const hdrs = await headers();
  // `x-invoke-path` est posé par Next.js sur le request internal. Fallback
  // sur referer pour les rares cas où Next ne l'expose pas.
  const path = hdrs.get("x-invoke-path") ?? hdrs.get("x-pathname") ?? hdrs.get("referer") ?? "";

  let activeTabId: "messages" | "calendly" | "commercial" = "messages";
  if (path.includes("/contacts/calendly")) {
    activeTabId = "calendly";
  } else if (path.includes("/contacts/commercial")) {
    activeTabId = "commercial";
  }

  const base = `/fr/${adminPrefix}/contacts`;
  const tabs: AdminTabItem[] = [
    { id: "messages", label: "Messages", href: `${base}/messages` },
    { id: "commercial", label: "Commercial", href: `${base}/commercial` },
    { id: "calendly", label: "RDV Calendly", href: `${base}/calendly` },
  ];

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-6)]">
        <AdminTabs tabs={tabs} activeTabId={activeTabId} ariaLabel="Contacts & messages" />
      </div>
      <div id={`${activeTabId}-panel`} role="tabpanel" aria-labelledby={`${activeTabId}-tab`}>
        {children}
      </div>
    </AdminPageShell>
  );
}

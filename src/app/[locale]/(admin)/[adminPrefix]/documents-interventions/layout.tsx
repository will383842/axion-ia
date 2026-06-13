// Documents interventions — layout à onglets (familles : Formations / 1-to-1 /
// Audits + Listes destinataires). Calqué sur le layout `contacts`. L'onglet
// actif est dérivé du pathname (Server Component, via headers()).

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

export default async function DocumentsInterventionsLayout({
  children,
  params,
}: LayoutProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const hdrs = await headers();
  const path = hdrs.get("x-invoke-path") ?? hdrs.get("x-pathname") ?? hdrs.get("referer") ?? "";

  let activeTabId = "formations";
  if (path.includes("/documents-interventions/un-a-un")) {
    activeTabId = "un-a-un";
  } else if (path.includes("/documents-interventions/audit")) {
    activeTabId = "audit";
  } else if (path.includes("/documents-interventions/destinataires")) {
    activeTabId = "destinataires";
  }

  const base = `/fr/${adminPrefix}/documents-interventions`;
  const tabs: AdminTabItem[] = [
    { id: "formations", label: "Formations", href: `${base}/formations` },
    { id: "un-a-un", label: "1-to-1", href: `${base}/un-a-un` },
    { id: "audit", label: "Audits", href: `${base}/audit` },
    { id: "destinataires", label: "Annuaire équipe", href: `${base}/destinataires` },
  ];

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-6)]">
        <AdminTabs tabs={tabs} activeTabId={activeTabId} ariaLabel="Documents interventions" />
      </div>
      <div id={`${activeTabId}-panel`} role="tabpanel" aria-labelledby={`${activeTabId}-tab`}>
        {children}
      </div>
    </AdminPageShell>
  );
}

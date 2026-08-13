// Section « Tunnels » — coquille commune et onglets.
//
//   Tunnels
//   ├── Vue d'ensemble     → les deux tunnels côte à côte
//   ├── Tunnel de prospects → de la pub au rapport : où l'on perd les gens
//   └── Tunnel de vente     → du prospect au règlement
//
// Groupe distinct de « Boîte de réception » à dessein : celle-ci montre les
// gens qui ONT écrit, celui-ci montre ceux qu'on a PERDUS en route.
//
// Onglet actif dérivé du chemin via `headers()`, comme le hub Documents.

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

export default async function TunnelsLayout({
  children,
  params,
}: LayoutProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const hdrs = await headers();
  const chemin = hdrs.get("x-invoke-path") ?? hdrs.get("x-pathname") ?? hdrs.get("referer") ?? "";

  const base = `/fr/${adminPrefix}/tunnels`;

  // Ordre des tests : le plus spécifique d'abord. `/tunnels` étant un préfixe
  // des deux autres, le tester en premier rendrait les sous-onglets inactifs.
  let actif = "ensemble";
  if (chemin.includes("/tunnels/prospects")) actif = "prospects";
  else if (chemin.includes("/tunnels/vente")) actif = "vente";

  const onglets: AdminTabItem[] = [
    { id: "ensemble", label: "Vue d'ensemble", href: base },
    { id: "prospects", label: "Tunnel de prospects", href: `${base}/prospects` },
    { id: "vente", label: "Tunnel de vente", href: `${base}/vente` },
  ];

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-6)]">
        <AdminTabs tabs={onglets} activeTabId={actif} ariaLabel="Tunnels" />
      </div>
      <div id="panneau-tunnels" role="tabpanel">
        {children}
      </div>
    </AdminPageShell>
  );
}

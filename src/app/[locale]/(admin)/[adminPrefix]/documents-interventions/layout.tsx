// Hub « Documents » — layout à 2 niveaux d'onglets (Server Component, onglet
// actif dérivé du pathname via headers()).
//
//   Documents
//   ├── Activités  → Formations · 1-to-1 · Audit · Implémentations · Sites web
//   └── Autres     → documents transverses (plaquette, pièces admin…)
//
// Formations / 1-to-1 / Audit = kits pédagogiques Qualiopi (InterventionDocument,
// route [famille]). Implémentations / Sites web / Autres = buckets de fichiers
// génériques (ConsoleDocument). « Annuaire équipe » et « Importer un kit »
// restent accessibles en actions secondaires sous les Activités.

import type { Metadata } from "next";
import Link from "next/link";
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

export default async function DocumentsLayout({
  children,
  params,
}: LayoutProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const hdrs = await headers();
  const path = hdrs.get("x-invoke-path") ?? hdrs.get("x-pathname") ?? hdrs.get("referer") ?? "";

  const base = `/fr/${adminPrefix}/documents-interventions`;

  // Niveau 1 : Activités vs Autres.
  const topActive = path.includes("/documents-interventions/autres") ? "autres" : "activites";

  // Niveau 2 (sous Activités) : famille / bucket courant.
  let subActive = "formations";
  if (path.includes("/documents-interventions/un-a-un")) subActive = "un-a-un";
  else if (path.includes("/documents-interventions/audit")) subActive = "audit";
  else if (path.includes("/documents-interventions/implementations")) subActive = "implementations";
  else if (path.includes("/documents-interventions/sites-web")) subActive = "sites-web";
  else if (path.includes("/documents-interventions/destinataires")) subActive = "";
  else if (path.includes("/documents-interventions/import")) subActive = "";

  const topTabs: AdminTabItem[] = [
    // L'onglet « Activités » pointe vers sa 1re sous-section (Formations).
    { id: "activites", label: "Activités", href: `${base}/formations` },
    { id: "autres", label: "Autres", href: `${base}/autres` },
  ];

  const subTabs: AdminTabItem[] = [
    { id: "formations", label: "Formations", href: `${base}/formations` },
    { id: "un-a-un", label: "1-to-1", href: `${base}/un-a-un` },
    { id: "audit", label: "Audit", href: `${base}/audit` },
    { id: "implementations", label: "Implémentations", href: `${base}/implementations` },
    { id: "sites-web", label: "Sites web", href: `${base}/sites-web` },
  ];

  const panelId = `${topActive === "autres" ? "autres" : subActive || "activites"}-panel`;

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <AdminTabs tabs={topTabs} activeTabId={topActive} ariaLabel="Documents" />
      </div>

      {topActive === "activites" ? (
        <div className="mb-[var(--space-admin-6)]">
          <AdminTabs tabs={subTabs} activeTabId={subActive} ariaLabel="Catégories d'activités" />
          <div className="text-fg-muted mt-2 flex flex-wrap gap-4 text-xs">
            <Link href={`${base}/destinataires`} className="hover:text-mocha underline">
              Annuaire équipe
            </Link>
            <Link href={`${base}/import`} className="hover:text-mocha underline">
              Importer un kit
            </Link>
          </div>
        </div>
      ) : null}

      <div id={panelId} role="tabpanel">
        {children}
      </div>
    </AdminPageShell>
  );
}

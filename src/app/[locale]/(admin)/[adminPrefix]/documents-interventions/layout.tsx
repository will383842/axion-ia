// Hub « Documents » — layout à 2 niveaux d'onglets (Server Component, onglet
// actif dérivé du pathname via headers()).
//
//   Documents
//   ├── Documents de prestation → Formations · 1-to-1 · Audit (kits pédagogiques)
//   └── Boîte à documents       → Implémentations · Sites web · Autres (fichiers libres)
//
// Documents de prestation = kits pédagogiques Qualiopi (InterventionDocument,
// route [famille]) : un jeu de documents structuré par prestation. « Annuaire
// équipe » et « Importer un kit » sont des utilitaires de cette section.
// Boîte à documents = buckets de fichiers génériques uploadés (ConsoleDocument) :
// implémentations, sites web, et documents transverses (plaquette, pièces admin…).

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

  // Niveau 1 : « Boîte à documents » (fichiers libres) vs « Documents de prestation ».
  const isBoite =
    path.includes("/documents-interventions/implementations") ||
    path.includes("/documents-interventions/sites-web") ||
    path.includes("/documents-interventions/autres");
  const topActive = isBoite ? "boite" : "prestation";

  // Niveau 2 : sous-section courante.
  let subActive = "";
  if (isBoite) {
    subActive = "implementations";
    if (path.includes("/documents-interventions/sites-web")) subActive = "sites-web";
    else if (path.includes("/documents-interventions/autres")) subActive = "autres";
  } else {
    subActive = "formations";
    if (path.includes("/documents-interventions/un-a-un")) subActive = "un-a-un";
    else if (path.includes("/documents-interventions/audit")) subActive = "audit";
    else if (path.includes("/documents-interventions/destinataires")) subActive = "";
    else if (path.includes("/documents-interventions/import")) subActive = "";
  }

  const topTabs: AdminTabItem[] = [
    // Chaque onglet pointe vers sa 1re sous-section.
    { id: "prestation", label: "Documents de prestation", href: `${base}/formations` },
    { id: "boite", label: "Boîte à documents", href: `${base}/autres` },
  ];

  const prestationSubTabs: AdminTabItem[] = [
    { id: "formations", label: "Formations", href: `${base}/formations` },
    { id: "un-a-un", label: "1-to-1", href: `${base}/un-a-un` },
    { id: "audit", label: "Audit", href: `${base}/audit` },
  ];

  const boiteSubTabs: AdminTabItem[] = [
    { id: "autres", label: "Autres", href: `${base}/autres` },
    { id: "implementations", label: "Implémentations", href: `${base}/implementations` },
    { id: "sites-web", label: "Sites web", href: `${base}/sites-web` },
  ];

  const subTabs = isBoite ? boiteSubTabs : prestationSubTabs;
  const panelId = `${subActive || topActive}-panel`;

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <AdminTabs tabs={topTabs} activeTabId={topActive} ariaLabel="Documents" />
      </div>

      <div className="mb-[var(--space-admin-6)]">
        <AdminTabs
          tabs={subTabs}
          activeTabId={subActive}
          ariaLabel={isBoite ? "Boîte à documents" : "Documents de prestation"}
        />
        {!isBoite ? (
          <div className="text-fg-muted mt-2 flex flex-wrap gap-4 text-xs">
            <Link href={`${base}/destinataires`} className="hover:text-mocha underline">
              Annuaire équipe
            </Link>
            <Link href={`${base}/import`} className="hover:text-mocha underline">
              Importer un kit
            </Link>
          </div>
        ) : null}
      </div>

      <div id={panelId} role="tabpanel">
        {children}
      </div>
    </AdminPageShell>
  );
}

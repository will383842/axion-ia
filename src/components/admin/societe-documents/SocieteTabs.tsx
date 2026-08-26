// Onglets de « Société & conformité » (server component).
//
// L'onglet actif est passé en PROP par la page qui le rend, pas déduit d'un
// en-tête de requête. Le hub « Documents » voisin lit `x-invoke-path`,
// `x-pathname` puis `referer` pour deviner où il se trouve — trois replis dont
// le dernier est faux dès qu'on arrive par un favori. Ici chaque page sait
// laquelle elle est ; autant qu'elle le dise.

import { AdminTabs, type AdminTabItem } from "@/components/admin/AdminTabs";
import { SOCIETE_RUBRIQUES } from "@/server/societe-documents/rubriques";

/** Identifiants d'onglet : `identite` + un segment par rubrique. */
export type SocieteTabId = "identite" | string;

export function SocieteTabs({
  adminPrefix,
  actif,
}: {
  adminPrefix: string;
  actif: SocieteTabId;
}): React.ReactElement {
  const base = `/fr/${adminPrefix}/societe`;
  const tabs: AdminTabItem[] = [
    { id: "identite", label: "Identité", href: `${base}/identite` },
    ...SOCIETE_RUBRIQUES.map((r) => ({
      id: r.segment,
      label: r.label,
      href: `${base}/${r.segment}`,
    })),
  ];
  return (
    <div className="mb-[var(--space-admin-6)]">
      <AdminTabs tabs={tabs} activeTabId={actif} ariaLabel="Société & conformité" />
    </div>
  );
}

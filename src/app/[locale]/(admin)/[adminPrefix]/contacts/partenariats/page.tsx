// Contacts admin — onglet « Partenariats » : demandes de partenariat.
// Vue filtrée de SubmissionsV2 (unifiedType = "partenariat").
// Détail → /contacts/messages/[id] (canonique).

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";

export const dynamic = "force-dynamic";

// Filtre forcé via `forcedTypes` (comme /contacts/clients) — PAS un
// `unifiedType` écrasé dans `sp` : sinon le sélecteur « Catégorie » choisit
// une valeur que la query ignore (audit UX : filtre affiché mais inopérant).
const PARTENARIAT_TYPES = ["partenariat"] as const;

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsPartenariatsPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  return (
    <SubmissionsV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      basePath="contacts/partenariats"
      forcedTypes={PARTENARIAT_TYPES}
    />
  );
}

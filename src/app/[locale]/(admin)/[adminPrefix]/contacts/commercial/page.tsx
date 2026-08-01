// Contacts admin — onglet « Commercial » : candidatures du réseau commercial
// (formulaire /devenir-commercial-ia/candidature). Réutilise SubmissionsV2 avec
// un filtre forcé sur details.unifiedType = "recrutement". Aucune duplication.

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";

export const dynamic = "force-dynamic";

// Filtre forcé : seules les candidatures recrutement (commerciaux). Passe par
// `forcedTypes` (comme /contacts/clients), PAS par un `unifiedType` écrasé
// dans `sp` — sinon le sélecteur « Catégorie » choisit une valeur que la
// query ignore (audit UX : filtre affiché mais inopérant).
const COMMERCIAL_TYPES = ["recrutement"] as const;

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsCommercialPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  return (
    <SubmissionsV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      basePath="contacts/commercial"
      forcedTypes={COMMERCIAL_TYPES}
    />
  );
}

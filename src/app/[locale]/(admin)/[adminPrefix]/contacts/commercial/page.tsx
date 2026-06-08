// Contacts admin — onglet « Commercial » : candidatures du réseau commercial
// (formulaire /devenir-commercial-ia/candidature). Réutilise SubmissionsV2 avec
// un filtre forcé sur details.unifiedType = "recrutement". Aucune duplication.

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsCommercialPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  // Filtre forcé : seules les candidatures recrutement (commerciaux).
  return (
    <SubmissionsV2
      adminPrefix={adminPrefix}
      searchParams={{ ...sp, unifiedType: "recrutement" }}
      basePath="contacts/commercial"
    />
  );
}

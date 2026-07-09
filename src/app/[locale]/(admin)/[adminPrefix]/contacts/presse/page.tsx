// Contacts admin — onglet « Presse » : demandes des journalistes / médias
// (formulaire public /presse → UnifiedContactForm defaultType="presse").
// Réutilise SubmissionsV2 avec un filtre forcé sur unifiedType = "presse".
// Aucune duplication ; le détail pointe vers /contacts/messages/[id] (canonique).

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsPressePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  // Filtre forcé : seules les demandes presse / média.
  return (
    <SubmissionsV2
      adminPrefix={adminPrefix}
      searchParams={{ ...sp, unifiedType: "presse" }}
      basePath="contacts/presse"
    />
  );
}

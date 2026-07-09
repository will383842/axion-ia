// Contacts admin — onglet « Partenariats » : demandes de partenariat.
// Vue filtrée de SubmissionsV2 (unifiedType = "partenariat").
// Détail → /contacts/messages/[id] (canonique).

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";

export const dynamic = "force-dynamic";

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
      searchParams={{ ...sp, unifiedType: "partenariat" }}
      basePath="contacts/partenariats"
    />
  );
}

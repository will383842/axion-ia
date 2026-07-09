// Contacts admin — onglet « Investisseurs » : demandes investisseur / M&A.
// Vue filtrée de SubmissionsV2 (unifiedType = "investisseur").
// Détail → /contacts/messages/[id] (canonique).

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsInvestisseursPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  return (
    <SubmissionsV2
      adminPrefix={adminPrefix}
      searchParams={{ ...sp, unifiedType: "investisseur" }}
      basePath="contacts/investisseurs"
    />
  );
}

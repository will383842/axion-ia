// Contacts admin — onglet « Clients » : demandes de prestation / projet
// (audit, intégration, formation, coaching 1-to-1, devis, support client).
// Vue filtrée multi-types de SubmissionsV2. Détail → /contacts/messages/[id].

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";

export const dynamic = "force-dynamic";

// Types unifiés considérés comme « demande client / prestation ».
const CLIENT_TYPES = [
  "audit",
  "implementation",
  "formation",
  "un_a_un",
  "devis",
  "support_client",
] as const;

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsClientsPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  return (
    <SubmissionsV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      basePath="contacts/clients"
      forcedTypes={CLIENT_TYPES}
    />
  );
}

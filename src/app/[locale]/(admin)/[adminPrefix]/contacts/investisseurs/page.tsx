// Contacts admin — onglet « Investisseurs » : demandes investisseur / M&A.
// Vue filtrée de SubmissionsV2 (unifiedType = "investisseur").
// Détail → /contacts/messages/[id] (canonique).

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

// Filtre forcé via `forcedTypes` (comme /contacts/clients) — PAS un
// `unifiedType` écrasé dans `sp` : sinon le sélecteur « Catégorie » choisit
// une valeur que la query ignore (audit UX : filtre affiché mais inopérant).
const INVESTISSEUR_TYPES = ["investisseur"] as const;

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsInvestisseursPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  }

  const sp = await searchParams;
  return (
    <SubmissionsV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      basePath="contacts/investisseurs"
      forcedTypes={INVESTISSEUR_TYPES}
    />
  );
}

// Contacts admin — onglet « Presse » : demandes des journalistes / médias
// (formulaire public /presse → UnifiedContactForm defaultType="presse").
// Réutilise SubmissionsV2 avec un filtre forcé sur unifiedType = "presse".
// Aucune duplication ; le détail pointe vers /contacts/messages/[id] (canonique).

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

// Filtre forcé : seules les demandes presse / média. Passe par `forcedTypes`
// (comme /contacts/clients), PAS par un `unifiedType` écrasé dans `sp` — sinon
// le sélecteur « Catégorie » de l'écran choisit une valeur que la query ignore
// (audit UX : filtre affiché mais inopérant).
const PRESSE_TYPES = ["presse"] as const;

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsPressePage({ params, searchParams }: PageProps) {
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
      basePath="contacts/presse"
      forcedTypes={PRESSE_TYPES}
    />
  );
}

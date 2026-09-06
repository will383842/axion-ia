// Contacts admin — catégorie « Conférences » de Messages : demandes
// d'intervention en conférence / table ronde (formulaire public →
// UnifiedContactForm defaultType="speaker").
//
// Route créée le 2026-08-14 avec la remontée des catégories dans la sidebar :
// les 6 autres catégories avaient déjà leur route, celle-ci n'existait que
// comme filtre interne à l'écran Messages. Même patron que /contacts/presse.

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

// Filtre forcé via `forcedTypes` (jamais un `unifiedType` écrasé dans `sp` —
// sinon le sélecteur « Catégorie » de l'écran propose une valeur que la
// requête ignore : filtre affiché mais inopérant).
const CONFERENCES_TYPES = ["speaker"] as const;

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsConferencesPage({ params, searchParams }: PageProps) {
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
      basePath="contacts/conferences"
      forcedTypes={CONFERENCES_TYPES}
    />
  );
}

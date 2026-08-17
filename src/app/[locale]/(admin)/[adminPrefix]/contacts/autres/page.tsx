// Contacts admin — catégorie « Autres » de Messages : les soumissions qui
// n'entrent dans aucun canal nommé (unifiedType = "autre").
//
// Route créée le 2026-08-14 avec la remontée des catégories dans la sidebar.
// Même patron que /contacts/presse.

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";

export const dynamic = "force-dynamic";

// Filtre forcé via `forcedTypes` (jamais un `unifiedType` écrasé dans `sp`).
const AUTRES_TYPES = ["autre"] as const;

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsAutresPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  return (
    <SubmissionsV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      basePath="contacts/autres"
      forcedTypes={AUTRES_TYPES}
    />
  );
}

// Contacts admin — catégorie « Conférences » de Messages : demandes
// d'intervention en conférence / table ronde (formulaire public →
// UnifiedContactForm defaultType="speaker").
//
// Route créée le 2026-08-14 avec la remontée des catégories dans la sidebar :
// les 6 autres catégories avaient déjà leur route, celle-ci n'existait que
// comme filtre interne à l'écran Messages. Même patron que /contacts/presse.

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";
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
  // 🔑 On appelle la garde pour son EFFET : sans session, elle redirige vers la
  // connexion. C'est ce que cette page doit garantir par elle-même — le proxy
  // ne peut pas être la seule couche (contournement du 2026-09-05).
  //
  // ⚠️ Pas de `<AccesRefuse>` ici, et ce n'est pas un oubli : en consultation,
  //    le seul refus possible est « rôle non reconnu », que le layout admin
  //    intercepte DÉJÀ avant de rendre ses enfants. La branche serait morte, et
  //    elle coûtait 1,64 kB gz au cliquet de bundle sur les 29 pages de ce lot
  //    (mesuré par Gate B) — `AccesRefuse` tire `next/link` et une icône.
  await gardePage("consultation", `/fr/${adminPrefix}/login`);

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

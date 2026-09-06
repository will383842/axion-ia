// Contacts admin — onglet « Presse » : demandes des journalistes / médias
// (formulaire public /presse → UnifiedContactForm defaultType="presse").
// Réutilise SubmissionsV2 avec un filtre forcé sur unifiedType = "presse".
// Aucune duplication ; le détail pointe vers /contacts/messages/[id] (canonique).

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";
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
      basePath="contacts/presse"
      forcedTypes={PRESSE_TYPES}
    />
  );
}

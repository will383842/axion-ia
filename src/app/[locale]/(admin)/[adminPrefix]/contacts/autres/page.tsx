// Contacts admin — catégorie « Autres » de Messages : les messages qui
// n'entrent dans aucun canal nommé (unifiedType = "autre"), plus, depuis le
// 2026-09-19, la rubrique « recrutement » du formulaire /contact quand ce n'est
// PAS un apporteur — typiquement quelqu'un qui cherche un poste.
//
// 🔑 Sans cette seconde moitié, retirer ces messages de la liste des apporteurs
//    les aurait fait disparaître de toutes les catégories : visibles dans
//    Messages seulement, rangés nulle part.
//
// Route créée le 2026-08-14 avec la remontée des catégories dans la sidebar.
// Même patron que /contacts/presse.

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

// Filtre forcé via `forcedTypes` (jamais un `unifiedType` écrasé dans `sp`).
// « recrutement » n'y entre qu'avec le périmètre « hors-apporteurs » : les
// apporteurs ont leur propre liste.
const AUTRES_TYPES = ["autre", "recrutement"] as const;

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsAutresPage({ params, searchParams }: PageProps) {
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
      basePath="contacts/autres"
      forcedTypes={AUTRES_TYPES}
      perimetre="hors-apporteurs"
    />
  );
}

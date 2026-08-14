// Contacts admin — canal « Messages » (Sprint Notif Infra 2026-05-26).
//
// Réutilise le composant SubmissionsV2 existant, SANS filtre : cet écran
// montre toutes les soumissions. Le tri par catégorie ne vit plus dans la
// page — ni en bloc « Catégorie » (jusqu'au 2026-08-13), ni en rangée
// d'onglets (le 2026-08-14) — mais dans la sidebar, où les 8 catégories sont
// rendues indentées sous « Messages » (demande Will 2026-08-14, cf.
// `navLevel` dans admin-nav.ts). Une catégorie = une route à part entière,
// joignable par la sidebar, ⌘K, les favoris et un lien externe.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";

export const dynamic = "force-dynamic";

// Compatibilité des liens `?cat=` produits par la rangée d'onglets déployée
// le 2026-08-14 et remplacée le jour même : on redirige vers la route de la
// catégorie, plutôt que de laisser un paramètre mort sans effet visible.
const CAT_REDIRECTS: Readonly<Record<string, string>> = {
  clients: "contacts/clients",
  presse: "contacts/presse",
  partenariats: "contacts/partenariats",
  investisseurs: "contacts/investisseurs",
  conferences: "contacts/conferences",
  recrutement: "contacts/commercial",
  podcast: "podcast",
  autre: "contacts/autres",
};

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsMessagesPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const cible = sp.cat ? CAT_REDIRECTS[sp.cat] : undefined;
  if (cible) redirect(`/fr/${adminPrefix}/${cible}`);

  return <SubmissionsV2 adminPrefix={adminPrefix} searchParams={sp} basePath="contacts/messages" />;
}

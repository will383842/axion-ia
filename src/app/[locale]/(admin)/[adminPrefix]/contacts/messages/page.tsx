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
  // Un lien ancien « ?cat=recrutement » visait la catégorie du formulaire, pas
  // les apporteurs : depuis le 2026-09-19, ces messages vivent dans Autres.
  recrutement: "contacts/autres",
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

  // 🔴 LES DEUX TIERS DE CETTE BOÎTE N'ÉTAIENT PAS DES MESSAGES (mesuré le
  //    2026-09-23 en production : 12 des 18 lignes actives). C'étaient les
  //    captures du tunnel apporteurs — « Contact enregistré à l'écran 1 du
  //    dossier » —, c'est-à-dire la trace d'un formulaire EN COURS de
  //    remplissage, pas quelque chose qui attend une réponse.
  //
  //    Un apporteur n'est pas une catégorie de courrier : il a un cycle de vie
  //    (candidature, kit, invitation, échange, contrat) et sa propre liste,
  //    `/contacts/commercial`. Le laisser ici noyait les vrais messages sous
  //    une file qui se pilote ailleurs.
  //
  // 🔑 `hors-apporteurs` nomme explicitement le cas « clé absente » au lieu
  //    d'un `NOT` sur un chemin JSON — sans quoi tous les messages sans
  //    `subType`, c'est-à-dire presque tous, disparaîtraient en silence
  //    (cf. l'en-tête de `est-apporteur.ts`).
  return (
    <SubmissionsV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      basePath="contacts/messages"
      perimetre="hors-apporteurs"
    />
  );
}

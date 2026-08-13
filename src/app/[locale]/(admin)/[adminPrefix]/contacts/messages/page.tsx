// Contacts admin — sous-onglet Messages (Sprint Notif Infra 2026-05-26).
//
// Réutilise le composant SubmissionsV2 existant. Sous-onglets « Catégorie »
// (demande Will 2026-08-13) : un onglet par type de demande (presse,
// partenariat, …) via `?cat=` — même mécanique que les routes filtrées
// /contacts/presse etc. (qui restent en place pour ⌘K), plus un onglet
// Podcast qui affiche la table PodcastRequest (modèle séparé).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminFilterTabs } from "@/components/admin/ui";
import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";
import { PodcastRequestsView } from "./PodcastRequestsView";

export const dynamic = "force-dynamic";

// Un onglet par type de demande. `types` = valeurs de details.unifiedType
// couvertes (aligné sur SubmissionFilters : Clients = groupe « Projet IA »
// + simulateur + support). Sans `types` : « Tous » (aucun filtre) ou
// « Podcast » (table à part, rendue par PodcastRequestsView).
const CATEGORIES: ReadonlyArray<{
  value: string;
  label: string;
  types?: ReadonlyArray<string>;
}> = [
  { value: "tous", label: "Tous" },
  {
    value: "clients",
    label: "Clients",
    types: [
      "audit",
      "implementation",
      "formation",
      "un_a_un",
      "devis",
      "simulateur_roi",
      "support_client",
    ],
  },
  { value: "presse", label: "Presse", types: ["presse"] },
  { value: "partenariats", label: "Partenariats", types: ["partenariat"] },
  { value: "investisseurs", label: "Investisseurs", types: ["investisseur"] },
  { value: "conferences", label: "Conférences", types: ["speaker"] },
  { value: "recrutement", label: "Recrutement", types: ["recrutement"] },
  { value: "podcast", label: "Podcast" },
  { value: "autre", label: "Autres", types: ["autre"] },
];

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsMessagesPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const category = CATEGORIES.find((c) => c.value === sp.cat) ?? CATEGORIES[0]!;
  const base = `/fr/${adminPrefix}/contacts/messages`;
  const categoryTabs = (
    <AdminFilterTabs
      label="Catégorie"
      current={category.value}
      options={CATEGORIES.map((c) => ({
        value: c.value,
        label: c.label,
        href: c.value === "tous" ? base : `${base}?cat=${c.value}`,
      }))}
    />
  );

  if (category.value === "podcast") {
    return <PodcastRequestsView adminPrefix={adminPrefix} categoryTabs={categoryTabs} />;
  }

  return (
    <SubmissionsV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      basePath="contacts/messages"
      categoryTabs={categoryTabs}
      {...(category.types ? { forcedTypes: category.types } : {})}
    />
  );
}

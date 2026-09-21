// Redirection de compatibilité — ancien onglet « RV téléphonique ».
//
// Fusionné le 2026-07-29 dans `/contacts/appels` avec « Calendrier RDV » et
// « Appels Calendly » : les trois lisaient la même table `calendly_events` et
// affichaient les mêmes lignes. La route est conservée pour les favoris et les
// liens déjà envoyés (alertes Telegram / WhatsApp notamment).
//
// 2026-09-19 : « Appels réservés » s'ouvre désormais sur la vue « Jour ». Cet
// ancien onglet était une LISTE : il y renvoie explicitement (`vue=liste`), et
// transmet le filtre Clients / Apporteurs (`public`) s'il est posé.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function RendezVousLegacyRedirect({
  params,
  searchParams,
}: PageProps): Promise<never> {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams({ vue: "liste" });
  if (sp["public"]) qs.set("public", sp["public"]);
  redirect(`/fr/${adminPrefix}/contacts/appels?${qs.toString()}`);
}

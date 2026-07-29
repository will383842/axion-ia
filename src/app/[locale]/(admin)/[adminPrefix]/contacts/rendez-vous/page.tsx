// Redirection de compatibilité — ancien onglet « RV téléphonique ».
//
// Fusionné le 2026-07-29 dans `/contacts/appels` avec « Calendrier RDV » et
// « Appels Calendly » : les trois lisaient la même table `calendly_events` et
// affichaient les mêmes lignes. La route est conservée pour les favoris et les
// liens déjà envoyés (alertes Telegram / WhatsApp notamment).

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function RendezVousLegacyRedirect({ params }: PageProps): Promise<never> {
  const { adminPrefix } = await params;
  redirect(`/fr/${adminPrefix}/contacts/appels`);
}

// Redirection de compatibilité — ancienne fiche détail d'un RDV Calendly.
//
// Déplacée le 2026-07-29 vers `/contacts/appels/[id]`. Route conservée : c'est
// l'URL qu'ont porté toutes les alertes Telegram / WhatsApp émises jusqu'ici
// (`src/server/notifications/format.ts`), et l'ancienne liste « RV
// téléphonique » y pointait déjà.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function CalendlyDetailLegacyRedirect({ params }: PageProps): Promise<never> {
  const { adminPrefix, id } = await params;
  redirect(`/fr/${adminPrefix}/contacts/appels/${id}`);
}

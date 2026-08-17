// L'ancienne adresse de la relecture des prix KDP.
//
// L'écran a déménagé sous « Imprimés › Livre KDP » le 2026-08-17, quand le
// catalogue A4 et le flyer sont venus s'ajouter et qu'un onglet isolé nommé
// « catalogue imprimé » ne pouvait plus les accueillir.
//
// On garde une redirection plutôt que de supprimer la route : cette adresse a
// pu être mise en favori, et un 404 dans sa propre console ne dit pas où aller.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function CatalogueImprimeRedirect({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  redirect(`/${locale}/${adminPrefix}/imprimes/livre-kdp`);
}

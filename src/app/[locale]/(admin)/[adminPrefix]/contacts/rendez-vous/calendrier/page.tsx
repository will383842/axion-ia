// Redirection de compatibilité — ancien onglet « Calendrier RDV ».
//
// Le calendrier n'est plus une rubrique mais une VUE de « Appels réservés »
// (fusion 2026-07-29) : on préserve donc les paramètres de navigation
// (mois affiché, jour sélectionné) au lieu de renvoyer sur le mois courant.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function RdvCalendrierLegacyRedirect({
  params,
  searchParams,
}: PageProps): Promise<never> {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams({ vue: "calendrier" });
  for (const key of ["year", "month", "date"] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }
  redirect(`/fr/${adminPrefix}/contacts/appels?${qs.toString()}`);
}

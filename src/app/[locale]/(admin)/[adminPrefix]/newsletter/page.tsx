// Listing newsletter subscribers admin (M9 Tier 3 section 1).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listSubscribersAction,
  getNewsletterStatsAction,
} from "@/features/admin-newsletter/actions";
import { lireStatistiquesLettre } from "@/server/newsletter/console";
import { NewsletterV2 } from "./_v2/NewsletterV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function NewsletterListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const [result, stats, statistiques] = await Promise.all([
    listSubscribersAction({
      status: sp.status as never,
      locale: sp.locale as never,
      source: sp.source,
      search: sp.search,
      dateFrom: sp.dateFrom,
      dateTo: sp.dateTo,
      page: sp.page ? parseInt(sp.page, 10) : 1,
    }),
    getNewsletterStatsAction(),
    lireStatistiquesLettre(),
  ]);

  // 🔴 Lot L3 : le lien d'export ne transmettait ni la recherche ni les dates —
  // l'écran filtré et le fichier ne disaient pas la même chose. Ces filtres
  // passent désormais. Le STATUT, lui, n'est PAS transmis : le fichier ne
  // contient que des inscrits éligibles, et la route refuse tout autre statut
  // (400) — transmis depuis un écran filtré sur « Désabonné », il aurait fait
  // télécharger une erreur JSON à la place du fichier.
  const csvUrl = `/api/admin/newsletter/export?${new URLSearchParams({
    ...(sp.locale ? { locale: sp.locale } : {}),
    ...(sp.source ? { source: sp.source } : {}),
    ...(sp.search ? { search: sp.search } : {}),
    ...(sp.dateFrom ? { dateFrom: sp.dateFrom } : {}),
    ...(sp.dateTo ? { dateTo: sp.dateTo } : {}),
  }).toString()}`;

  return (
    <NewsletterV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      stats={stats}
      csvUrl={csvUrl}
      statistiques={statistiques}
    />
  );
}

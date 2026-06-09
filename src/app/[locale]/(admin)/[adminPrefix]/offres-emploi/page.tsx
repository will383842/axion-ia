// Listing admin des offres d'emploi (système carrières). Calqué sur faq/page.tsx.
// Filtre catégorie / statut / recherche. Édition via lien /offres-emploi/[id].

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listJobOffersAction } from "@/features/admin-job-offers/actions";
import { JobOffersV2 } from "./_v2/JobOffersV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function JobOffersListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const result = await listJobOffersAction({
    category: sp.category as never,
    status: sp.status as never,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return (
    <JobOffersV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
    />
  );
}

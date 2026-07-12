// Listing admin des candidatures emploi. Filtre offre / statut / à traiter.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listApplicationsAction } from "@/features/admin-job-applications/actions";
import { ApplicationsV2 } from "./_v2/ApplicationsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ApplicationsListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const result = await listApplicationsAction({
    offerId: sp.offerId,
    status: sp.status as never,
    onlyAttention: sp.attention === "1",
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return (
    <ApplicationsV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
    />
  );
}

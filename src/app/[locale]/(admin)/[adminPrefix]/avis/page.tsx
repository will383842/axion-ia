// Listing + modération des avis clients (admin).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listReviewsAction } from "@/features/admin-reviews/actions";
import { AvisListV2 } from "./_v2/AvisListV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AvisListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const result = await listReviewsAction({
    status: sp.status as never,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <AvisListV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={totalPages}
      counts={result.counts}
    />
  );
}

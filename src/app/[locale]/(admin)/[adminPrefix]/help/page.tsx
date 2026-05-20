// Listing centre aide admin (M9 Tier 2 section 6).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listHelpArticlesAction } from "@/features/admin-help/actions";
import { HelpV2 } from "./_v2/HelpV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function HelpListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const result = await listHelpArticlesAction({
    status: sp.status as never,
    isTutorial: sp.isTutorial as never,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return (
    <HelpV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
    />
  );
}

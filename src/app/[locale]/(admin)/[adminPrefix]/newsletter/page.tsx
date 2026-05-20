// Listing newsletter subscribers admin (M9 Tier 3 section 1).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listSubscribersAction,
  getNewsletterStatsAction,
} from "@/features/admin-newsletter/actions";
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

  const [result, stats] = await Promise.all([
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
  ]);

  const csvUrl = `/api/admin/newsletter/export?${new URLSearchParams({
    ...(sp.status ? { status: sp.status } : {}),
    ...(sp.locale ? { locale: sp.locale } : {}),
    ...(sp.source ? { source: sp.source } : {}),
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
    />
  );
}

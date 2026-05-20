// Listing activity logs admin (M9 Tier 3 section 4 — DERNIERE, read-only).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listActivityLogsAction,
  listAdminUsersOptionsAction,
  getActivityLogStatsAction,
} from "@/features/admin-activity-logs/actions";
import { ActivityLogsV2 } from "./_v2/ActivityLogsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ActivityLogsPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const [result, users, stats] = await Promise.all([
    listActivityLogsAction({
      adminUserId: sp.adminUserId,
      action: sp.action,
      targetType: sp.targetType,
      search: sp.search,
      dateFrom: sp.dateFrom,
      dateTo: sp.dateTo,
      page: sp.page ? parseInt(sp.page, 10) : 1,
    }),
    listAdminUsersOptionsAction(),
    getActivityLogStatsAction(),
  ]);

  return (
    <ActivityLogsV2
      adminPrefix={adminPrefix}
      searchParams={sp}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      users={users}
      stats={stats}
    />
  );
}


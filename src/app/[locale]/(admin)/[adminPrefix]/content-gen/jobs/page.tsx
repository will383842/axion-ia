/**
 * Content Generator — Jobs list (§ 12.1).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { JobsListV2 } from "./_v2/JobsListV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function JobsListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <JobsListV2 adminPrefix={adminPrefix} searchParams={sp} />;
}

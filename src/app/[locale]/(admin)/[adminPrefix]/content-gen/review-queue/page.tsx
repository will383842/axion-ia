/**
 * Content Generator — Review queue list (§ 14).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ReviewQueueListV2 } from "./_v2/ReviewQueueListV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ReviewQueuePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <ReviewQueueListV2 adminPrefix={adminPrefix} searchParams={sp} />;
}

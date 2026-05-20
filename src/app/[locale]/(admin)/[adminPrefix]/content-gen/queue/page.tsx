/**
 * Content Generator — BullMQ inspection (§ 12.1).
 *
 * V1 lit Prisma table `ContentGenJob` (status = queued/running/failed). La
 * vue BullMQ in-Redis (bullmq-board) sera Sprint 6 si Will la veut.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { QueueV2 } from "./_v2/QueueV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function QueuePage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <QueueV2 adminPrefix={adminPrefix} />;
}

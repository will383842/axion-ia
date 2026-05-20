/**
 * Content Generator — Settings batches & workers (§ 12.5).
 *
 * Daily batch size, workers concurrency, retry policy. Stockés en
 * ContentGenConfig (key="batches").
 */

import { redirect } from "next/navigation";
import type { ContentType } from "../../../../../../../../prisma/generated/client";
import { auth } from "@/auth";
import {
  type DailyTargetByType,
  getBatchSettings,
  updateBatchSettings,
} from "@/server/actions/content-gen/policies";
import { CONTENT_TYPES_ALL } from "@/server/actions/content-gen/policies-constants";
import { BatchesV2 } from "./_v2/BatchesV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function BatchesSettingsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const cfg = await getBatchSettings();

  return <BatchesV2 cfg={cfg} />;
}


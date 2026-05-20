/**
 * Content Generator — Settings batches & workers (§ 12.5).
 *
 * Daily batch size, workers concurrency, retry policy. Stockés en
 * ContentGenConfig (key="batches").
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBatchSettings } from "@/server/actions/content-gen/policies";
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

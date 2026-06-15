/**
 * Content Generator — Réglages batches & workers (§ 7 V2).
 *
 * Page manquante (lien mort 404 depuis le dashboard + index settings, audit
 * console 2026-06-15). Le backend (getBatchSettings/updateBatchSettings) +
 * la config `batches` existaient déjà (lus par content-orchestrator-worker :
 * workersConcurrency, dailyTargetByType, antiBurstEnabled).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBatchSettings } from "@/server/actions/content-gen/policies";
import { BatchesV2 } from "./_v2/BatchesV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function BatchesPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const cfg = await getBatchSettings();
  return <BatchesV2 cfg={cfg} />;
}

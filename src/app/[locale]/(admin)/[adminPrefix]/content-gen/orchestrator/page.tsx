/**
 * Content Generator — Orchestrator (§ 12.1 v1.7).
 *
 * Vue globale : campagnes actives, daily plan, quota par pipeline, alertes.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OrchestratorV2 } from "./_v2/OrchestratorV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function OrchestratorPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <OrchestratorV2 adminPrefix={adminPrefix} />;
}

/**
 * Content Generator — Orchestrator (§ 12.1 v1.7).
 *
 * Vue globale : campagnes actives, daily plan, quota par pipeline, alertes.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrchestratorStats } from "@/server/actions/content-gen/geo";
import { getBatchSettings } from "@/server/actions/content-gen/policies";
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


function KpiCard({ label, value }: { readonly label: string; readonly value: string | number }) {
  return (
    <div className="admin-card admin-kpi-card">
      <p className="admin-kpi-label">{label}</p>
      <p className="admin-kpi-value">{value}</p>
    </div>
  );
}

/**
 * Content Generator — Cockpit géographique (§ 15).
 *
 * V1 = vue par région (13) + KPIs globaux. La carte React `react-simple-maps`
 * + SSE temps réel arrive Sprint 4 (composant lourd, lazy). V1 = table HTML
 * compacte + progress bars CSS.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GeoEventsBanner } from "@/components/admin/content-gen/GeoEventsBanner";
import { getGlobalGeoStats, listRegionGeoStats } from "@/server/actions/content-gen/geo";
import { GeoCockpitV2 } from "./_v2/GeoCockpitV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function GeoCockpitPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <GeoCockpitV2 adminPrefix={adminPrefix} />;
}


function KpiCard({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly tone?: "warn" | undefined;
}) {
  return (
    <div
      className="admin-card admin-kpi-card"
      style={tone === "warn" ? { borderColor: "var(--color-terracotta)" } : undefined}
    >
      <p className="admin-kpi-label">{label}</p>
      <p className="admin-kpi-value">{value}</p>
    </div>
  );
}

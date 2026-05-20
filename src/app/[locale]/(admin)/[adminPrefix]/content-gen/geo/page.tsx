/**
 * Content Generator — Cockpit géographique (§ 15).
 *
 * V1 = vue par région (13) + KPIs globaux. La carte React `react-simple-maps`
 * + SSE temps réel arrive Sprint 4 (composant lourd, lazy). V1 = table HTML
 * compacte + progress bars CSS.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
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

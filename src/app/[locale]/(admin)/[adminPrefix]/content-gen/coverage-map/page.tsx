/**
 * Console Coverage Map — Sprint v7 Phase 2 commit 2 (2026-05-23).
 *
 * Carte FR départements heatmap + tableau villes 3 compteurs distincts
 * (editorial / landings / RSS). Source unique de vérité v7 pour la décision
 * D6 (état d'avancement complet par ville + département + national).
 *
 * Route : /fr/<adminPrefix>/content-gen/coverage-map
 * Convention V2 (AdminPageShell).
 */

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getCoverageMapData } from "@/server/actions/content-gen/coverage-map";

import { CoverageMapV2 } from "./_v2/CoverageMapV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function CoverageMapPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const data = await getCoverageMapData();

  return <CoverageMapV2 adminPrefix={adminPrefix} initialData={data} />;
}

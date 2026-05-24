/**
 * Console Ordre Villes — Sprint v7 Phase 2 commit 1 (2026-05-23).
 *
 * Permet à Will de réordonner manuellement la file globale `CityGenerationOrder`
 * (2150 villes) partagée par les campagnes en mode `villeScopeMode=global_queue`.
 *
 * Fonctionnalités :
 *   - Drag-and-drop virtualisé (≤ 2200 lignes)
 *   - Pin / unpin (placé en tête de file)
 *   - Filtres région / département / tier / pinned
 *   - Recherche debounce 150ms
 *   - Stats compactes
 *
 * Route : /fr/<adminPrefix>/content-gen/cities-order
 * Convention V2 (AdminPageShell).
 */

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getCityGenerationOrder } from "@/server/actions/content-gen/cities-order";

import { CitiesOrderV3 } from "./_v3/CitiesOrderV3";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function CitiesOrderPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  // Load complet 2200 villes — virtualisation client gère le rendering.
  // Filtres et tri sont aussi côté client (debounce, drag-and-drop optimiste).
  const { rows, total } = await getCityGenerationOrder({ page: 1, pageSize: 2200 });

  return <CitiesOrderV3 adminPrefix={adminPrefix} initialRows={rows} initialTotal={total} />;
}

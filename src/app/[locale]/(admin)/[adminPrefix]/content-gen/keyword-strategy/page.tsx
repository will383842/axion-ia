/**
 * Console admin — Stratégie Keywords (Phase 7 Sprint Perfection 2026-05-22)
 *
 * Vue globale keywords : distribution verticales + intents + filtres + actions.
 * Server Component — données issues de ALL_KEYWORD_SEEDS (in-memory, pas de DB call).
 *
 * Migration A-15 audit 2026-05-22 : V1 KeywordStrategyView était `'use client'`
 * avec useState/useMemo → V2 KeywordStrategyV2 = RSC pur, filtrage URL-based
 * côté serveur, zéro JS client. Suppression fall-through V1.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { KeywordStrategyV2 } from "./_v2/KeywordStrategyV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{
    vertical?: string;
    intent?: string;
    q?: string;
    page?: string;
  }>;
}

export default async function KeywordStrategyPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <KeywordStrategyV2 searchParams={sp} adminPrefix={adminPrefix} />;
}

/**
 * Console admin — Stratégie Keywords (Phase 7 Sprint Perfection 2026-05-22)
 *
 * Vue globale keywords : distribution verticales + intents + filtres + actions.
 * Server Component — données issues de ALL_KEYWORD_SEEDS (in-memory, pas de DB call).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { KeywordStrategyView } from "./KeywordStrategyView";

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

  return <KeywordStrategyView searchParams={sp} />;
}

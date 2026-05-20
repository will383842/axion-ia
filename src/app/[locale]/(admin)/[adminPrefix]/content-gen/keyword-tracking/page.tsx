/**
 * Content Generator — Keyword tracking dashboard (Sprint 12.5 V2).
 *
 * Affiche les rows KeywordTracking (Sprint 12 migration) avec :
 *   - Filtres : source (gsc/serpapi/manual) + position range
 *   - Trending icons : flèche selon positionDelta
 *   - Gaps detection : badge "opportunity" pour position 11-20
 *   - Cannibalization : badge si > 1 article track le même keyword
 *
 * Mode shadow V1 : table vide tant que cron sync GSC/SerpAPI pas câblé
 * (Sprint 12.5 task #5). UI fonctionnelle dès qu'il y aura des rows.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { KeywordTrackingV2 } from "./_v2/KeywordTrackingV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ source?: string; posMin?: string; posMax?: string }>;
}

function PositionTrend({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0)
    return <span style={{ color: "var(--color-fg-muted)" }}>—</span>;
  const isUp = delta < 0; // position décroissante = monte SERP
  return (
    <span
      style={{
        color: isUp ? "var(--color-success, currentColor)" : "var(--color-danger, currentColor)",
        fontWeight: 600,
      }}
      aria-label={isUp ? "monte" : "recule"}
    >
      {isUp ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
    </span>
  );
}

export default async function KeywordTrackingPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <KeywordTrackingV2 searchParams={sp} />;
}


import { NextResponse } from "next/server";
import { readLatestSnapshot, readSnapshotHistory } from "@/server/observatoire/snapshot";
import {
  STUDY_NAME_FR,
  STUDY_ATTRIBUTION,
  STUDY_LICENSE_URL,
  STUDY_TEMPORAL_COVERAGE,
} from "@/content/observatoire/study";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Export JSON PUBLIC des agrégats (données ouvertes CC BY 4.0) — distributions
// globales + breakdowns par segment + historique d'évolution. On n'exporte
// JAMAIS de réponses individuelles. Sûr au build : route force-dynamic.

export async function GET() {
  const [snapshot, history] = await Promise.all([
    readLatestSnapshot(),
    readSnapshotHistory(200).catch(() => []),
  ]);

  const body = {
    study: STUDY_NAME_FR,
    attribution: STUDY_ATTRIBUTION,
    license: STUDY_LICENSE_URL,
    temporalCoverage: STUDY_TEMPORAL_COVERAGE,
    generatedAt: snapshot?.generatedAt ?? null,
    totalResponses: snapshot?.totalResponses ?? 0,
    insights: snapshot?.insights ?? {},
    distributions: snapshot?.distributions ?? {},
    segments: snapshot?.segments ?? {},
    history,
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="observatoire-ia-2026.json"',
      "cache-control": "no-store",
    },
  });
}

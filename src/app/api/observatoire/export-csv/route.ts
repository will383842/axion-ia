import { NextResponse } from "next/server";
import { readLatestSnapshot } from "@/server/observatoire/snapshot";
import { KB_SECTOR_TAGS } from "@/content/knowledge/sector-tags";
import { STUDY_REGIONS, STUDY_ATTRIBUTION } from "@/content/observatoire/study";
import { BAROMETER_QUESTIONS } from "@/content/observatoire/questions";
import frMessages from "@/messages/fr.json";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Export CSV PUBLIC des agrégats (données ouvertes CC BY 4.0). On exporte les
// distributions agrégées du snapshot (question, option, effectif, pourcentage),
// pas les réponses individuelles. Sûr au build : route force-dynamic, donc
// jamais appelée sous `stub.invalid` ; au runtime, snapshot absent → en-tête seul.

type ObsMessages = {
  observatoire: {
    questions: Record<string, { label: string; options?: Record<string, string> }>;
  };
};

const OBS = (frMessages as unknown as ObsMessages).observatoire;

function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function questionLabel(id: string): string {
  return OBS.questions[id]?.label ?? id;
}

function optionLabel(questionId: string, source: string, value: string): string {
  if (source === "sector") {
    return KB_SECTOR_TAGS.find((s) => s.slug === value)?.labelFr ?? value;
  }
  if (source === "region") {
    return STUDY_REGIONS.find((r) => r.slug === value)?.nameFr ?? value;
  }
  return OBS.questions[questionId]?.options?.[value] ?? value;
}

export async function GET() {
  const payload = await readLatestSnapshot();

  const header = ["question_id", "question_label", "option_value", "option_label", "count", "pct"];
  const lines: string[] = [header.join(",")];

  if (payload) {
    for (const q of BAROMETER_QUESTIONS) {
      const dist = payload.distributions?.[q.id] ?? [];
      for (const d of dist) {
        lines.push(
          [
            csvField(q.id),
            csvField(questionLabel(q.id)),
            csvField(d.value),
            csvField(optionLabel(q.id, q.source, d.value)),
            csvField(d.count),
            csvField(d.pct),
          ].join(","),
        );
      }
    }
  }

  // Ligne d'attribution en commentaire (CC BY 4.0).
  lines.push("");
  lines.push(`# ${STUDY_ATTRIBUTION}`);
  lines.push(`# total_responses=${payload?.totalResponses ?? 0}`);

  const csv = "﻿" + lines.join("\n"); // BOM UTF-8 pour Excel FR

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="observatoire-ia-2026.csv"',
      "cache-control": "no-store",
    },
  });
}

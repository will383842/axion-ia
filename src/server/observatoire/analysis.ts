/**
 * Observatoire IA 2026 — SYNTHÈSE rédigée par LLM, ANCRÉE sur les agrégats réels.
 *
 * Produit une analyse pro (vue d'ensemble + lecture par segment + points clés +
 * recommandations) à partir du `BarometerSnapshot` réel. Mise en cache dans
 * `BarometerAnalysis(key="latest")` et régénérée par le worker d'auto-update.
 *
 * Garde-fous (mêmes principes que `barometer-insight`) :
 * - Le modèle ne cite QUE les chiffres du bloc « DONNÉES VÉRIFIÉES » ; aucune
 *   invention de statistique ; attribution « Observatoire Axion-IA 2026 ».
 * - Refus de générer s'il n'existe AUCUNE réponse RÉELLE (hors fixture seed).
 * - Plafond de coût (`BUDGET_CAP_USD`).
 * - FR uniquement (EN désactivé sur la plateforme).
 */

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { Prisma } from "../../../prisma/generated/client";
import { generate as routerGenerate } from "../content-gen/providers/provider-router";
import { parseLlmJson } from "../content-gen/shared/parse-llm-json";
import {
  readLatestSnapshot,
  countRealResponses,
  type BarometerSnapshotPayload,
  type SegmentMetric,
} from "./snapshot";
import { STUDY_NAME_FR, STUDY_ATTRIBUTION } from "@/content/observatoire/study";
import { KB_SECTOR_TAGS } from "@/content/knowledge/sector-tags";
import { STUDY_REGIONS } from "@/content/observatoire/study";

const ANALYSIS_KEY = "latest";
const BUDGET_CAP_USD = 0.1;

export interface AnalysisSegmentComment {
  readonly dimension: "companySize" | "sector" | "region";
  readonly value: string;
  readonly label: string;
  readonly comment: string;
}

export interface BarometerAnalysisPayload {
  /** Vue d'ensemble (2-4 phrases, autoportante, citable). */
  readonly overview: string;
  /** Lecture par segment notable (taille / secteur / région). */
  readonly segments: ReadonlyArray<AnalysisSegmentComment>;
  /** Points clés à retenir (puces courtes). */
  readonly takeaways: ReadonlyArray<string>;
  /** Recommandations opérationnelles pour dirigeants de PME, ETI et grands groupes. */
  readonly recommendations: ReadonlyArray<string>;
}

export interface BarometerAnalysisRecord {
  readonly payload: BarometerAnalysisPayload;
  readonly generatedAt: string;
  readonly basedOnTotal: number;
}

// ─── Libellés FR (SSOT) ──────────────────────────────────────────────────────
const SIZE_LABEL: Record<string, string> = {
  TPE: "TPE",
  PME: "PME",
  ETI: "ETI",
  GRANDE_ENTREPRISE: "Grande entreprise",
};
function sectorLabel(slug: string): string {
  return KB_SECTOR_TAGS.find((s) => s.slug === slug)?.labelFr ?? slug;
}
function regionLabel(slug: string): string {
  return STUDY_REGIONS.find((r) => r.slug === slug)?.nameFr ?? slug;
}
function dimLabel(dimension: string, value: string): string {
  if (dimension === "companySize") return SIZE_LABEL[value] ?? value;
  if (dimension === "sector") return sectorLabel(value);
  if (dimension === "region") return regionLabel(value);
  return value;
}

const INSIGHT_SENTENCE: Record<string, string> = {
  competitors_use_ai: "pensent que leurs concurrents utilisent déjà l'IA",
  no_formal_strategy: "n'ont pas de stratégie IA formalisée",
  rgpd_concern: "sont préoccupées par la souveraineté de leurs données",
  investment_intent: "prévoient d'augmenter leur budget IA",
};

/** Construit le bloc de données vérifiées (global + segments notables). */
function buildVerifiedDataBlock(s: BarometerSnapshotPayload): string {
  const lines: string[] = [
    `Échantillon : ${s.totalResponses} répondants (entreprises françaises).`,
  ];

  for (const [key, sentence] of Object.entries(INSIGHT_SENTENCE)) {
    const v = s.insights?.[key];
    if (typeof v === "number") lines.push(`- ${v} % ${sentence}.`);
  }

  const addDist = (id: string, label: string) => {
    const dist = s.distributions?.[id];
    if (!dist || dist.length === 0) return;
    lines.push(`- Répartition ${label} : ${dist.map((d) => `${d.value}=${d.pct}%`).join(", ")}.`);
  };
  addDist("maturityLevel", "maturité IA");
  addDist("annualBudget", "budget IA annuel");
  addDist("barriers", "principaux freins");

  // Segments notables (bornés) : tri par maturité décroissante.
  const addSegments = (dimension: string, list: ReadonlyArray<SegmentMetric> | undefined) => {
    if (!list || list.length === 0) return;
    const top = [...list].sort((a, b) => b.maturityScore - a.maturityScore).slice(0, 8);
    lines.push(`\nPar ${dimension} (indice maturité /100, n = effectif) :`);
    for (const seg of top) {
      lines.push(
        `  • ${dimLabel(dimension, seg.value)} (n=${seg.total}) : maturité ${seg.maturityScore}/100, ` +
          `concurrents-IA ${seg.insights.competitors_use_ai}%, sans-stratégie ${seg.insights.no_formal_strategy}%, ` +
          `RGPD ${seg.insights.rgpd_concern}%, investir ${seg.insights.investment_intent}%.`,
      );
    }
  };
  addSegments("companySize", s.segments?.companySize);
  addSegments("sector", s.segments?.sector);
  addSegments("region", s.segments?.region);

  return [
    "=== DONNÉES VÉRIFIÉES — Observatoire Axion-IA 2026 (NE PAS MODIFIER, n'utiliser QUE ces chiffres) ===",
    ...lines,
    `Attribution obligatoire : « ${STUDY_ATTRIBUTION} ».`,
    "=== FIN DONNÉES VÉRIFIÉES ===",
  ].join("\n");
}

const SYSTEM_PROMPT = `Tu es Manon, analyste IA chez Axion-IA. Tu rédiges la SYNTHÈSE d'analyse de « ${STUDY_NAME_FR} » pour des dirigeants de PME, d'ETI et de grands groupes français.
Règles absolues :
- Tu n'utilises QUE les chiffres du bloc « DONNÉES VÉRIFIÉES ». AUCUNE invention de pourcentage, d'effectif ou de fait. Si un angle n'est pas chiffré, reste qualitatif.
- Ton professionnel, factuel, utile et concis. Pas de superlatifs creux. Français.
- 0 prix, 0 délai chiffré, 0 numéro de téléphone, 0 promesse commerciale.
- Pour les segments : commente uniquement ceux fournis, en français, en nommant le segment (ex. « Le secteur banque-finance… »).
- Output JSON STRICT, rien d'autre :
{
  "overview": "2 à 4 phrases de synthèse globale, autoportantes et citables",
  "segments": [ { "dimension": "companySize|sector|region", "value": "<slug ou valeur fournie>", "label": "<libellé lisible>", "comment": "1 à 2 phrases d'analyse de ce segment" } ],
  "takeaways": ["3 à 5 points clés courts"],
  "recommendations": ["3 à 5 recommandations opérationnelles concrètes pour un dirigeant"]
}`;

/** Lit l'analyse en cache (ou null). */
export async function readLatestAnalysis(): Promise<BarometerAnalysisRecord | null> {
  try {
    const row = await prisma.barometerAnalysis.findUnique({ where: { key: ANALYSIS_KEY } });
    if (!row) return null;
    return {
      payload: row.payload as unknown as BarometerAnalysisPayload,
      generatedAt: row.generatedAt.toISOString(),
      basedOnTotal: row.basedOnTotal,
    };
  } catch {
    return null;
  }
}

export type GenerateAnalysisResult =
  { ok: true; regenerated: boolean; basedOnTotal: number } | { ok: false; reason: string };

/**
 * (Re)génère la synthèse si nécessaire et la persiste. Par défaut, ne régénère
 * QUE si l'effectif réel a changé depuis la dernière analyse (économie de tokens) ;
 * `force` outrepasse ce garde-fou.
 */
export async function generateAndPersistAnalysis(
  opts: { force?: boolean } = {},
): Promise<GenerateAnalysisResult> {
  try {
    const [snapshot, realResponses, existing] = await Promise.all([
      readLatestSnapshot(),
      countRealResponses(),
      readLatestAnalysis(),
    ]);

    if (!snapshot || realResponses === 0) {
      return { ok: false, reason: "no-real-responses" };
    }
    // Économie : pas de régénération si l'analyse couvre déjà l'effectif courant.
    if (!opts.force && existing && existing.basedOnTotal === snapshot.totalResponses) {
      return { ok: true, regenerated: false, basedOnTotal: existing.basedOnTotal };
    }

    const verifiedData = buildVerifiedDataBlock(snapshot);
    const userPrompt = `Rédige la synthèse d'analyse de l'Observatoire de l'IA 2026.\n\n${verifiedData}\n\nProduis UNIQUEMENT l'objet JSON décrit.`;

    const res = await routerGenerate({
      jobId: `obs-analysis-${snapshot.totalResponses}`,
      contentType: "barometer_analysis",
      role: "text",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 2048,
      temperature: 0.4,
    });

    if (res.costUsd > BUDGET_CAP_USD) {
      // Continue quand même (1 seul call), mais trace l'anomalie de coût.
      Sentry.captureMessage("observatoire analysis cost over cap", {
        level: "warning",
        tags: { area: "observatoire" },
        extra: { costUsd: res.costUsd },
      });
    }

    const parsed = parseLlmJson<BarometerAnalysisPayload>(res.output);
    if (!parsed || typeof parsed.overview !== "string" || parsed.overview.trim().length < 20) {
      return { ok: false, reason: "invalid-llm-output" };
    }

    const payload: BarometerAnalysisPayload = {
      overview: parsed.overview.trim(),
      segments: Array.isArray(parsed.segments)
        ? parsed.segments
            .filter((s) => s && typeof s.comment === "string" && s.comment.trim().length > 0)
            .map((s) => ({
              dimension: s.dimension,
              value: String(s.value),
              label: s.label || dimLabel(s.dimension, String(s.value)),
              comment: s.comment.trim(),
            }))
        : [],
      takeaways: Array.isArray(parsed.takeaways)
        ? parsed.takeaways
            .filter((t) => typeof t === "string" && t.trim().length > 0)
            .map((t) => t.trim())
        : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
            .filter((r) => typeof r === "string" && r.trim().length > 0)
            .map((r) => r.trim())
        : [],
    };

    await prisma.barometerAnalysis.upsert({
      where: { key: ANALYSIS_KEY },
      create: {
        key: ANALYSIS_KEY,
        basedOnTotal: snapshot.totalResponses,
        model: res.model ?? null,
        costUsd: res.costUsd,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
      update: {
        basedOnTotal: snapshot.totalResponses,
        model: res.model ?? null,
        costUsd: res.costUsd,
        generatedAt: new Date(),
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    return { ok: true, regenerated: true, basedOnTotal: snapshot.totalResponses };
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "observatoire", action: "generateAndPersistAnalysis" },
    });
    return { ok: false, reason: "exception" };
  }
}

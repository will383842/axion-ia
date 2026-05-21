/**
 * Content Generator — Quality improver worker (§ 27 v1.7).
 *
 * Picks ContentGenJob avec `status='quality_improving'` (positionné par le
 * worker primaire `content-gen-worker` quand score < seuil). Re-prompte
 * sections ciblées + ré-évalue qualité. Si nouveau score >= target → bascule
 * `needs_review`. Sinon increment `qualityImprovementAttempts`, et au-delà du
 * cap configuré → bascule `failed` avec error doctrine.
 *
 * V1 = skeleton functional. Pipeline complet (re-prompt LLM avec system
 * prompt enrichi sections sous-performantes) arrive V2 quand on a un dataset
 * pour identifier patterns de re-prompt utiles.
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import {
  readContentGenConfig,
  writeContentGenConfig,
} from "@/server/actions/content-gen/_settings";
import { logGeneration, logStep } from "@/server/content-gen/shared/generation-log";
// B.8 P1.5 P0-3 — LLM-as-judge (Claude Sonnet reviewer multi-dim).
import { reviewArticle, type JudgeResult } from "@/server/content-gen/reviewer/llm-judge";

const QUEUE_NAME = "content-quality-improver";

interface QualityLoopMonthSpent {
  readonly usd: number;
  readonly month: string; // "YYYY-MM"
}

/** Clé ContentGenConfig pour tracker les coûts mensuels du quality_loop. */
const QUALITY_LOOP_SPENT_KEY = "quality_loop_month_spent";

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Audit 2026-05-15 P1-13 : enforcement monthlyBudgetCapUsd quality_loop.
 *
 * Lit les coûts mensuels accumulés du quality_loop dans `ContentGenConfig`.
 * Si reset mensuel détecté, remet à 0. Retourne le total USD du mois courant.
 *
 * V1 : value reste à 0 (pas de LLM call dans quality-improver V1, juste
 * increment counter). V2 incrémente cette clé à chaque re-prompt LLM.
 * Le check actuel sert de garde-fou défensif pour V2 sans casser V1.
 */
async function getQualityLoopMonthSpent(): Promise<number> {
  const month = currentMonthKey();
  const stored = await readContentGenConfig<QualityLoopMonthSpent>(QUALITY_LOOP_SPENT_KEY, {
    usd: 0,
    month,
  });
  // Reset mensuel automatique si on change de mois
  if (stored.month !== month) {
    await writeContentGenConfig(
      QUALITY_LOOP_SPENT_KEY,
      { usd: 0, month },
      "system",
      "Reset mensuel automatique quality_loop spent",
    );
    return 0;
  }
  return stored.usd;
}

export interface QualityImproveJobPayload {
  readonly contentGenJobId: string;
  readonly previousScore: number;
}

interface QualityLoopSettings {
  readonly enabled: boolean;
  readonly minScoreThreshold: number;
  readonly targetScore: number;
  readonly maxAttemptsAuto: number;
  readonly monthlyBudgetCapUsd: number;
}

async function processJob(job: Job<QualityImproveJobPayload>): Promise<void> {
  const { contentGenJobId, previousScore } = job.data;

  // Kill switch hard-gate (P1-7 fix audit opérationnel 2026-05-14).
  const killSwitch = await readContentGenConfig<{ active: boolean }>("kill_switch", {
    active: false,
  });
  if (killSwitch.active) {
    console.log(`[quality-improver-worker] kill switch active, requeue job ${contentGenJobId}`);
    throw new Error("kill_switch_active");
  }

  const settings = await readContentGenConfig<QualityLoopSettings>("quality_loop", {
    enabled: true,
    minScoreThreshold: 75,
    targetScore: 85,
    maxAttemptsAuto: 2,
    monthlyBudgetCapUsd: 100,
  });

  if (!settings.enabled) {
    await prisma.contentGenJob.update({
      where: { id: contentGenJobId },
      data: { status: "needs_review" },
    });
    return;
  }

  // Audit 2026-05-15 P1-13 : enforcement monthlyBudgetCapUsd.
  // Si le cap mensuel est atteint, bascule needs_review au lieu de re-tenter.
  const monthSpentUsd = await getQualityLoopMonthSpent();
  if (monthSpentUsd >= settings.monthlyBudgetCapUsd) {
    await prisma.contentGenJob.update({
      where: { id: contentGenJobId },
      data: { status: "needs_review" },
    });
    await logGeneration({
      jobId: contentGenJobId,
      level: "warn",
      step: "quality_loop_budget_cap_reached",
      message: `Quality loop budget cap atteint (${monthSpentUsd.toFixed(2)}/${settings.monthlyBudgetCapUsd} USD ce mois). Manual review requise.`,
    });
    return;
  }

  const dbJob = await prisma.contentGenJob.findUnique({ where: { id: contentGenJobId } });
  if (!dbJob) throw new Error(`ContentGenJob ${contentGenJobId} not found`);

  if (dbJob.qualityImprovementAttempts >= settings.maxAttemptsAuto) {
    // Cap atteint → bascule needs_review pour décision manuelle Will
    await prisma.contentGenJob.update({
      where: { id: contentGenJobId },
      data: { status: "needs_review" },
    });
    await logGeneration({
      jobId: contentGenJobId,
      level: "warn",
      step: "quality_loop_cap_reached",
      message: `Cap auto ${settings.maxAttemptsAuto} atteint (score ${previousScore}). Manual review.`,
    });
    return;
  }

  // B.8 P0-3 P1.5 — LLM-as-judge review (V2).
  // Lit l'output du job, appelle reviewArticle() Claude Sonnet, persiste le
  // editorialScore + verdict. Selon verdict :
  //  - publish : status=needs_review (review queue humain final)
  //  - improve : increment attempts, re-queue jusqu'a maxAttemptsAuto
  //  - reject : status=needs_review (escalate Will) + log P0 issues
  const output = dbJob.outputJsonRaw as Record<string, unknown> | null;
  let judge: JudgeResult | null = null;
  if (output && typeof output["title"] === "string" && typeof output["bodyHtml"] === "string") {
    try {
      judge = await reviewArticle({
        title: output["title"] as string,
        ...(typeof output["metaTitle"] === "string"
          ? { metaTitle: output["metaTitle"] as string }
          : {}),
        ...(typeof output["metaDescription"] === "string"
          ? { metaDescription: output["metaDescription"] as string }
          : {}),
        bodyHtml: output["bodyHtml"] as string,
        ...(typeof output["bodyText"] === "string"
          ? { bodyText: output["bodyText"] as string }
          : {}),
        ...(Array.isArray(output["faq"])
          ? {
              faq: (output["faq"] as ReadonlyArray<Record<string, unknown>>)
                .filter(
                  (q): q is { question: string; answer: string } =>
                    typeof q["question"] === "string" && typeof q["answer"] === "string",
                )
                .map((q) => ({ question: q.question, answer: q.answer })),
            }
          : {}),
        ...((): { primaryKeyword?: string } => {
          const ip = dbJob.inputPayload as Record<string, unknown> | null;
          const pk = ip && typeof ip["primaryKeyword"] === "string" ? ip["primaryKeyword"] : null;
          return pk ? { primaryKeyword: pk } : {};
        })(),
        jobId: contentGenJobId,
      });
    } catch (err) {
      await logGeneration({
        jobId: contentGenJobId,
        level: "error",
        step: "quality_loop_pass",
        message: `LLM-judge failed: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  const editorialScoreInt = judge ? Math.round(judge.globalScore * 10) : null; // /100
  const verdict = judge?.verdict ?? "improve";
  const reachedCap = dbJob.qualityImprovementAttempts + 1 >= settings.maxAttemptsAuto;

  // V2 = re-prompt loop : si verdict=improve ET pas cap → re-queue improve.
  // Sinon → needs_review (publish, reject, ou improve mais cap atteint).
  const nextStatus = verdict === "improve" && !reachedCap ? "quality_improving" : "needs_review";

  await prisma.contentGenJob.update({
    where: { id: contentGenJobId },
    data: {
      status: nextStatus,
      qualityImprovementAttempts: { increment: 1 },
      ...(editorialScoreInt !== null ? { editorialScore: editorialScoreInt } : {}),
    },
  });
  await logStep(
    contentGenJobId,
    "quality_loop_pass",
    `Judge verdict=${verdict} globalScore=${judge?.globalScore ?? "n/a"} attempt=${dbJob.qualityImprovementAttempts + 1}/${settings.maxAttemptsAuto} → ${nextStatus}`,
    judge
      ? {
          verdict: judge.verdict,
          global_score: judge.globalScore,
          dimensions: judge.dimensions,
          issues_count: judge.issues.length,
          p0_issues: judge.issues.filter((i) => i.severity === "P0").length,
          previous_score: previousScore,
        }
      : { previous_score: previousScore, judge_skipped: true },
  );
}

let workerInstance: Worker<QualityImproveJobPayload> | null = null;

export function startQualityImproverWorker(): Worker<QualityImproveJobPayload> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL not set — content-quality-improver-worker cannot start");
  }
  workerInstance = new Worker<QualityImproveJobPayload>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 2,
    limiter: { max: 5, duration: 60_000 },
    // P2-23 audit indexation 2026-05-18 — bornage retention Redis :
    // garde 1000 jobs completed + 5000 jobs failed max (BullMQ purge auto).
    // Évite saturation Redis long-terme sur high-volume workers.
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-quality-improver-worker] job ${job?.id} failed:`, err);
  });
  return workerInstance;
}

export async function stopQualityImproverWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}

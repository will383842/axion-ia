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

import { Queue, Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import { persistContentGenConfig } from "@/server/content-gen/config-store";
import { logGeneration, logStep } from "@/server/content-gen/shared/generation-log";
// B.8 P1.5 P0-3 — LLM-as-judge (reviewer multi-dim, gpt-4o depuis la décision
// Will 2026-07-09 « 100% OpenAI » — cf. llm-judge.ts).
import {
  reviewArticle,
  JUDGE_THRESHOLDS,
  type JudgeResult,
  type JudgeThresholds,
} from "@/server/content-gen/reviewer/llm-judge";
// Fix 2026-07-17 — routage du verdict (module pur, testable sans mock).
import {
  resolveJudgeOutcome,
  type AutoPublishPolicies,
} from "@/server/content-gen/quality/judge-outcome";
import type { ContentType, SearchIntent } from "../../../../prisma/generated/client";
// P1-3 — Sentry capture pour observabilité prod (audit S+4-C).
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { sendTelegram } from "@/lib/telegram";

const QUEUE_NAME = "content-quality-improver";

let contentGenQueue: Queue | null = null;
function getContentGenQueue(): Queue | null {
  if (contentGenQueue) return contentGenQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  contentGenQueue = new Queue("content-gen", { connection: { url: redisUrl } });
  return contentGenQueue;
}

let publishQueue: Queue | null = null;
function getPublishQueue(): Queue | null {
  if (publishQueue) return publishQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  publishQueue = new Queue("content-publish", { connection: { url: redisUrl } });
  return publishQueue;
}

/** Formate les issues du LLM-judge en feedback lisible pour le re-prompt. */
function formatJudgeFeedback(judge: JudgeResult): string {
  const p0 = judge.issues.filter((i) => i.severity === "P0");
  const p1 = judge.issues.filter((i) => i.severity === "P1");
  const lines: string[] = [`Score global : ${judge.globalScore.toFixed(1)}/10`];
  if (p0.length > 0) {
    lines.push(`Issues P0 critiques :`);
    p0.forEach((i) => lines.push(`  - [${i.section}] ${i.issue} → ${i.suggestedFix}`));
  }
  if (p1.length > 0) {
    lines.push(`Issues P1 à corriger :`);
    p1.forEach((i) => lines.push(`  - [${i.section}] ${i.issue} → ${i.suggestedFix}`));
  }
  const weakDims = Object.entries(judge.dimensions)
    .filter(([, d]) => d.score < 7)
    .map(([k, d]) => `${k} (${d.score}/10 — ${d.comment})`);
  if (weakDims.length > 0) {
    lines.push(`Dimensions faibles : ${weakDims.join(" ; ")}`);
  }
  return lines.join("\n");
}

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
    await persistContentGenConfig(
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

  // D2 (décision Will 2026-05-21) : 3 itérations pour guide_pilier + landing_ville,
  // 2 pour les autres types (cohérence coût/qualité).
  const HIGH_ITERATION_TYPES = new Set<string>(["guide_pilier", "landing_ville"]);
  const effectiveMaxAttempts = HIGH_ITERATION_TYPES.has(dbJob.contentType ?? "")
    ? Math.max(settings.maxAttemptsAuto, 3)
    : settings.maxAttemptsAuto;

  if (dbJob.qualityImprovementAttempts >= effectiveMaxAttempts) {
    // Cap atteint → bascule needs_review pour décision manuelle Will
    await prisma.contentGenJob.update({
      where: { id: contentGenJobId },
      data: { status: "needs_review" },
    });
    await logGeneration({
      jobId: contentGenJobId,
      level: "warn",
      step: "quality_loop_cap_reached",
      message: `Cap auto ${effectiveMaxAttempts} atteint (score ${previousScore}, type ${dbJob.contentType}). Manual review.`,
    });
    return;
  }

  // B.8 P0-3 P1.5 — LLM-as-judge review (V2).
  // Lit l'output du job, appelle reviewArticle() (gpt-4o), persiste le
  // editorialScore + verdict. Selon verdict :
  //  - publish : status=needs_review (review queue humain final)
  //  - improve : increment attempts, re-queue jusqu'a maxAttemptsAuto
  //  - reject : status=needs_review (escalate Will) + log P0 issues
  // Étape 5 (réglages DB) — seuils du juge LLM pilotables sans redéploiement
  // (clé ContentGenConfig `judge_thresholds`). Défaut = valeurs éditoriales Will
  // (8.5 / 6.0). Fallback sûr sur le défaut si DB indispo ou valeur absente.
  const jt = await readContentGenConfig<{ publishMin?: number; improveMin?: number }>(
    "judge_thresholds",
    {},
  );
  const clampJudge = (n: number) => Math.max(0, Math.min(10, n));
  const judgeThresholds: JudgeThresholds = {
    PUBLISH_MIN:
      typeof jt.publishMin === "number" ? clampJudge(jt.publishMin) : JUDGE_THRESHOLDS.PUBLISH_MIN,
    IMPROVE_MIN:
      typeof jt.improveMin === "number" ? clampJudge(jt.improveMin) : JUDGE_THRESHOLDS.IMPROVE_MIN,
  };

  const output = dbJob.outputJsonRaw as Record<string, unknown> | null;
  let judge: JudgeResult | null = null;
  if (output && typeof output["title"] === "string" && typeof output["bodyHtml"] === "string") {
    try {
      judge = await reviewArticle(
        {
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
        },
        judgeThresholds,
      );
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
  const reachedCap = dbJob.qualityImprovementAttempts + 1 >= effectiveMaxAttempts;

  // P0-7 fix 2026-05-21 — Distinguer REJECT (P0 violation) de cap-reached.
  // Un verdict "reject" du LLM-judge = issues P0 critiques détectées (SIREN hardcodé,
  // violation AI Act, contenu dangereux). Nécessite escalade immédiate vs simple cap.
  const isHardReject = verdict === "reject";

  const policies = await readContentGenConfig<AutoPublishPolicies>("policies", {});
  const isRss = dbJob.contentType === "blog_from_rss";

  // V2 re-prompt loop : si verdict=improve ET cap non atteint → persiste le
  // feedback judge dans outputJsonRaw + re-enqueue content-gen pour re-générer
  // avec le feedback ciblé.
  // P0-7 — REJECT P0 → quarantined_critical (violations AI Act, SIREN hardcodé…).
  // Fix 2026-07-17 — verdict `publish` → `approved` (cf. resolveJudgeOutcome).
  // Cap atteint sans P0 → needs_review (revue éditoriale standard).
  const nextStatus = resolveJudgeOutcome({
    verdict,
    judgeRan: judge !== null,
    reachedCap,
    doctrineCheckPassed: dbJob.doctrineCheckPassed,
    isRss,
    policies,
  });
  const shouldRegenerate = nextStatus === "quality_improving";
  const shouldAutoPublish = nextStatus === "approved";

  // Persiste le feedback judge dans outputJsonRaw.judgeIssues pour que le
  // content-gen-worker puisse l'injecter dans le prompt de re-génération.
  const judgeFeedback = judge ? formatJudgeFeedback(judge) : null;
  const existingOutput = (dbJob.outputJsonRaw as Record<string, unknown> | null) ?? {};
  const updatedOutput = judgeFeedback
    ? { ...existingOutput, judgeIssues: judgeFeedback }
    : existingOutput;

  await prisma.contentGenJob.update({
    where: { id: contentGenJobId },
    data: {
      status: nextStatus,
      qualityImprovementAttempts: { increment: 1 },
      ...(editorialScoreInt !== null ? { editorialScore: editorialScoreInt } : {}),
      ...(judgeFeedback ? { outputJsonRaw: updatedOutput as never } : {}),
    },
  });

  // P0-7 — Log + Telegram escalade REJECT distinct du cap-reached.
  if (isHardReject && judge) {
    const p0Issues = judge.issues.filter((i) => i.severity === "P0");
    await logGeneration({
      jobId: contentGenJobId,
      level: "error",
      step: "quality_loop_hard_reject",
      message: `LLM-judge HARD REJECT — ${p0Issues.length} P0 issue(s) critiques. Escalade manuelle requise. Score: ${judge.globalScore.toFixed(1)}/10`,
    });
    // 2026-07-20 : rétrogradé INCIDENT → MONITORING. Le rejet qualité d'UN
    // article est opérationnel (filtrage normal du content-gen), pas une panne
    // serveur → « 🔴 Incident » réservé aux vraies pannes.
    void sendTelegram({
      tag: "MONITORING",
      body:
        `*[⚠️ ARTICLE REJETÉ (qualité)]* L'IA-juge a rejeté le contenu \`${contentGenJobId}\`.\n` +
        `Score : ${judge.globalScore.toFixed(1)}/10 — ${p0Issues.length} problème(s) bloquant(s).\n` +
        p0Issues.map((i) => `• [${i.section}] ${i.issue}`).join("\n"),
    }).catch(() => {});
  }

  await logStep(
    contentGenJobId,
    "quality_loop_pass",
    `Judge verdict=${verdict}${isHardReject ? " [HARD REJECT — P0 issues]" : ""} globalScore=${judge?.globalScore ?? "n/a"} attempt=${dbJob.qualityImprovementAttempts + 1}/${settings.maxAttemptsAuto} → ${nextStatus}${shouldRegenerate ? " (re-enqueue content-gen)" : ""}`,
    judge
      ? {
          verdict: judge.verdict,
          is_hard_reject: isHardReject,
          global_score: judge.globalScore,
          dimensions: judge.dimensions,
          issues_count: judge.issues.length,
          p0_issues: judge.issues.filter((i) => i.severity === "P0").length,
          previous_score: previousScore,
          should_regenerate: shouldRegenerate,
          reached_cap: reachedCap,
        }
      : { previous_score: previousScore, judge_skipped: true },
  );

  if (shouldRegenerate) {
    // Re-enqueue content-gen avec le même payload + feedback judge intégré.
    // Le content-gen-worker lira outputJsonRaw.judgeIssues et l'injectera
    // comme improvementFeedback dans le generator.
    const queue = getContentGenQueue();
    if (queue) {
      const ip = dbJob.inputPayload as Record<string, unknown> | null;
      const attempt = dbJob.qualityImprovementAttempts + 1;
      await queue.add(
        "generate",
        {
          contentGenJobId,
          contentType: dbJob.contentType as ContentType,
          targetSearchIntent: dbJob.targetSearchIntent as SearchIntent,
          inputPayload: ip ?? {},
        },
        { jobId: `content-gen-improve-${attempt}-${contentGenJobId}` },
      );
    } else {
      // Redis absent — fail-soft : needs_review sans re-génération.
      await prisma.contentGenJob.update({
        where: { id: contentGenJobId },
        data: { status: "needs_review" },
      });
    }
  }

  if (shouldAutoPublish) {
    // Fix 2026-07-17 — le verdict `publish` déclenche la publication, au lieu de
    // dormir en `needs_review`. Chemin identique à celui du content-gen-worker
    // (§ « if (nextStatus === "approved") ») : ligne ReviewQueue approuvée puis
    // enqueue content-publish. Le job sort de la boucle SANS être passé par le
    // `nextStatus === "approved"` du gen-worker (celui-ci `return` avant la
    // création de la ReviewQueue quand il route vers `quality_improving`), donc
    // c'est bien ici qu'il faut la créer — d'où l'upsert (idempotent, `jobId` est
    // @unique) qui couvre aussi le cas d'une ligne laissée par une passe antérieure.
    const publishQ = getPublishQueue();
    if (publishQ) {
      const score = dbJob.qualityScore ?? 0;
      const autoPromoteTier1MinScore = policies.factoryAutoPromoteTier1MinScore ?? 50;
      const finalTier = (dbJob.outputJsonRaw as Record<string, unknown> | null)?.[
        "finalIndexationTier"
      ];
      // Même formule que le gen-worker : le score DÉTERMINISTE (pas l'editorialScore
      // du juge) décide de la promotion tier-1, et un contenu déclassé tier_3 par un
      // garde-fou (soft-404…) n'est jamais promu. Un article validé par le juge mais
      // sous le seuil publie donc en tier_2_noindex_follow — publié, hors index.
      const shouldPromoteTier1 =
        score >= autoPromoteTier1MinScore && finalTier !== "tier_3_noindex_nofollow";

      const review = await prisma.reviewQueue.upsert({
        where: { jobId: contentGenJobId },
        create: {
          jobId: contentGenJobId,
          status: "approved",
          reviewedAt: new Date(),
          reviewNotes: `[auto-pub juge] verdict=publish — éditorial ${judge?.globalScore.toFixed(1) ?? "?"}/10, qualité ${score}/100`,
        },
        update: {
          status: "approved",
          reviewedAt: new Date(),
          reviewNotes: `[auto-pub juge] verdict=publish — éditorial ${judge?.globalScore.toFixed(1) ?? "?"}/10, qualité ${score}/100`,
        },
        select: { id: true },
      });

      await publishQ.add(
        "publish",
        { reviewQueueId: review.id, promoteToTier1: shouldPromoteTier1 },
        { jobId: `publish-${review.id}` },
      );
      await logStep(
        contentGenJobId,
        "publish",
        `Auto-publication sur verdict juge=publish → ${shouldPromoteTier1 ? "tier_1_indexable" : "tier_2_noindex_follow"}`,
        {
          editorial_score: editorialScoreInt,
          quality_score: score,
          promote_tier1: shouldPromoteTier1,
          auto_promote_min_score: autoPromoteTier1MinScore,
        },
      );
    } else {
      // Redis absent — fail-soft : needs_review, Will publiera manuellement.
      await prisma.contentGenJob.update({
        where: { id: contentGenJobId },
        data: { status: "needs_review" },
      });
      await logGeneration({
        jobId: contentGenJobId,
        level: "warn",
        step: "quality_loop_pass",
        message: "Verdict publish mais Redis absent — bascule needs_review (publication manuelle).",
      });
    }
  }
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
    // P0-2 — lockDuration 2min : reviewArticle() (Claude Sonnet) peut dépasser 30s.
    // Sans lockDuration, BullMQ marque le job stalled → double review possible.
    lockDuration: 120_000,
    // P2-23 — bornage retention Redis.
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-quality-improver-worker] job ${job?.id} failed:`, err);
    captureWorkerError("quality-improver", QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopQualityImproverWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}

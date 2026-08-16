/**
 * Content Weekly Report Worker — Sprint A 2026-05-21 (D-P5-3).
 *
 * Cron lundi 7h00 UTC (≈ 8h CET été / 8h CET hiver).
 * Agrège les KPIs de la semaine écoulée et envoie un email récapitulatif
 * à WEEKLY_REPORT_EMAIL (défaut contact@axion-ia.com).
 *
 * KPIs inclus :
 * - Articles publiés / jobs rejetés / quarantainés
 * - Score qualité moyen (LLM-judge)
 * - Coût LLM semaine ($)
 * - Villes actives avec nouveaux jobs
 * - Anomalies détectées (checkAnomalies)
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/client";
import { cloturerJournal } from "@/server/email/email-log";
import { EmailLogStatus } from "../../../../prisma/generated/client";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

const QUEUE_NAME = "content-weekly-report";
const REPORT_TO = process.env.WEEKLY_REPORT_EMAIL ?? "contact@axion-ia.com";

async function collectWeeklyStats(since: Date): Promise<{
  published: number;
  rejected: number;
  quarantined: number;
  totalJobs: number;
  avgQualityScore: number | null;
  totalCostUsd: number;
  topVilles: Array<{ ville: string; count: number }>;
  anomalies: string[];
}> {
  const [published, rejected, quarantined, totalJobs, qualityAgg, costAgg, villeRows] =
    await Promise.all([
      prisma.article
        .count({ where: { status: "published", publishedAt: { gte: since } } })
        .catch(() => 0),

      prisma.contentGenJob
        .count({ where: { status: "failed", createdAt: { gte: since } } })
        .catch(() => 0),

      prisma.contentGenJob
        .count({
          where: {
            status: { in: ["quarantined_critical", "quarantined_factcheck"] },
            createdAt: { gte: since },
          },
        })
        .catch(() => 0),

      prisma.contentGenJob.count({ where: { createdAt: { gte: since } } }).catch(() => 0),

      prisma.contentGenJob
        .aggregate({
          _avg: { qualityScore: true },
          where: { qualityScore: { not: null }, completedAt: { gte: since } },
        })
        .catch(() => ({ _avg: { qualityScore: null } })),

      prisma.generationProvenance
        .aggregate({
          _sum: { cost: true },
          where: { timestamp: { gte: since } },
        })
        .catch(() => ({ _sum: { cost: null } })),

      // Top 5 villes via ContentGenJob (le champ anchorVilleSlug y est présent)
      prisma.contentGenJob
        .groupBy({
          by: ["anchorVilleSlug"],
          _count: { id: true },
          where: { createdAt: { gte: since }, anchorVilleSlug: { not: null } },
          orderBy: { _count: { id: "desc" } },
          take: 5,
        })
        .catch(() => [] as Array<{ anchorVilleSlug: string | null; _count: { id: number } }>),
    ]);

  const anomalies: string[] = [];
  for (const key of ["alert_quality_drop", "alert_reject_spike", "alert_pipeline_stall"]) {
    try {
      const cfg = await prisma.contentGenConfig.findUnique({ where: { key } });
      if (cfg?.value && typeof cfg.value === "object") {
        const v = cfg.value as { message?: string };
        if (v.message) anomalies.push(`${key}: ${v.message}`);
      }
    } catch {
      // fail-soft
    }
  }

  return {
    published,
    rejected,
    quarantined,
    totalJobs,
    avgQualityScore:
      qualityAgg._avg.qualityScore != null ? Number(qualityAgg._avg.qualityScore) : null,
    totalCostUsd: costAgg._sum.cost != null ? parseFloat(String(costAgg._sum.cost)) : 0,
    topVilles: villeRows.map((v) => ({
      ville: v.anchorVilleSlug ?? "unknown",
      count: v._count.id,
    })),
    anomalies,
  };
}

function buildEmailHtml(
  stats: ReturnType<typeof collectWeeklyStats> extends Promise<infer T> ? T : never,
  weekLabel: string,
): { subject: string; html: string; text: string } {
  const rejectRate = stats.totalJobs > 0 ? Math.round((stats.rejected / stats.totalJobs) * 100) : 0;
  const qualityStr =
    stats.avgQualityScore !== null ? `${stats.avgQualityScore.toFixed(1)}/100` : "N/A";
  const costStr = `$${stats.totalCostUsd.toFixed(2)}`;
  const anomalyHtml =
    stats.anomalies.length > 0
      ? `<tr><td style="color:#c24a1b;font-weight:bold">⚠️ Anomalies</td><td>${stats.anomalies.join("<br>")}</td></tr>`
      : `<tr><td>✅ Anomalies</td><td>Aucune</td></tr>`;
  const villesHtml =
    stats.topVilles.length > 0
      ? stats.topVilles.map((v) => `${v.ville} (${v.count})`).join(", ")
      : "—";

  const subject = `📊 Rapport AxionIA content-gen — ${weekLabel}`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#c24a1b">📊 Rapport hebdomadaire Content-Gen</h2>
  <p style="color:#666">${weekLabel}</p>
  <table style="width:100%;border-collapse:collapse;margin-top:20px">
    <tr style="background:#faf8f3">
      <th style="text-align:left;padding:8px;border-bottom:2px solid #c24a1b">KPI</th>
      <th style="text-align:left;padding:8px;border-bottom:2px solid #c24a1b">Valeur</th>
    </tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee">📝 Articles publiés</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">${stats.published}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee">❌ Jobs rejetés</td><td style="padding:8px;border-bottom:1px solid #eee">${stats.rejected} (${rejectRate}%)</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee">🚨 Quarantainés</td><td style="padding:8px;border-bottom:1px solid #eee">${stats.quarantined}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee">🎯 Score qualité moyen</td><td style="padding:8px;border-bottom:1px solid #eee">${qualityStr}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee">💰 Coût LLM semaine</td><td style="padding:8px;border-bottom:1px solid #eee">${costStr}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee">🌍 Top villes actives</td><td style="padding:8px;border-bottom:1px solid #eee">${villesHtml}</td></tr>
    ${anomalyHtml}
  </table>
  <p style="margin-top:30px;font-size:12px;color:#999">
    Généré automatiquement par AxionIA content-gen — axion-ia.com
  </p>
</body></html>`;
  const text = `Rapport hebdomadaire AxionIA content-gen (${weekLabel})\n\nArticles publiés: ${stats.published}\nJobs rejetés: ${stats.rejected} (${rejectRate}%)\nScore qualité: ${qualityStr}\nCoût LLM: ${costStr}\nAnomalies: ${stats.anomalies.length > 0 ? stats.anomalies.join("; ") : "aucune"}`;
  return { subject, html, text };
}

async function processJob(_job: Job<{ readonly trigger: string }>): Promise<void> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date();
  const weekLabel = `${since.toLocaleDateString("fr-FR")} → ${weekEnd.toLocaleDateString("fr-FR")}`;

  const stats = await collectWeeklyStats(since);
  const { subject, html, text } = buildEmailHtml(stats, weekLabel);

  // 🔴 Audit du 2026-08-16 — LE SEUL ENVOI QUI ÉCHAPPAIT AU JOURNAL.
  //
  // C'est l'unique appelant de `sendEmail()` hors de l'entonnoir
  // `enqueueEmail()`. Il ne peut pas y entrer : `enqueueEmail` exige un
  // `EmailJobName` du registre des 75 gabarits, or ce rapport compose son HTML
  // à la volée. Le convertir en gabarit React Email serait disproportionné pour
  // un envoi hebdomadaire à une adresse interne.
  //
  // Mais « hors de l'entonnoir » ne doit pas vouloir dire « invisible ». Sans
  // ce journal, un rapport qui cesse de partir ne laisse aucune trace : ni dans
  // la page « E-mails envoyés », ni pour `verifierSanteEmails()`. On journalise
  // donc à la main ce que le worker d'e-mails aurait journalisé.
  //
  // Le débit, lui, est déjà borné : ce chemin ne passe pas par le limiteur
  // BullMQ de la file `emails`, mais il passe par le transport, dont la soupape
  // `rateDelta`/`rateLimit` a été posée pour exactement ce cas.
  const jobId = `content-weekly-report-${weekEnd.toISOString().slice(0, 10)}`;
  try {
    const result = await sendEmail({ to: REPORT_TO, subject, html, text });
    await cloturerJournal({
      template: "content-weekly-report",
      recipient: REPORT_TO,
      locale: "fr",
      marketing: false,
      attempts: 1,
      status: EmailLogStatus.sent,
      providerMessageId: result.messageId,
      sentAt: new Date(),
      jobId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await cloturerJournal({
      template: "content-weekly-report",
      recipient: REPORT_TO,
      locale: "fr",
      marketing: false,
      attempts: 1,
      status: EmailLogStatus.failed,
      error: msg.slice(0, 2000),
      failedAt: new Date(),
      jobId,
    });
    throw err;
  }
}

let workerInstance: Worker | null = null;

export function startContentWeeklyReportWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — content-weekly-report-worker cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 120_000,
    removeOnComplete: { count: 52 },
    removeOnFail: { count: 26 },
  });
  workerInstance.on("failed", (job, err) => {
    captureWorkerError("weekly-report", QUEUE_NAME, job, err);
    console.error(`[content-weekly-report-worker] job ${job?.id} failed:`, err);
  });
  return workerInstance;
}

export async function stopContentWeeklyReportWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}

/**
 * Brand Voice — Server Actions admin (Sprint H 2026-05-22).
 *
 * recalibrateBrandVoice(articleIds) :
 *   Calcule un embedding de référence brand voice en moyennant les embeddings
 *   des articles fournis. Stocke dans ContentGenConfig.brand_voice_reference_embedding.
 *   Trace dans ContentGenAuditLog (SOC2).
 *
 * getBrandVoiceDriftStats() :
 *   Retourne les stats de dérive des 30 derniers jours depuis ContentGenAuditLog.
 *   - Nombre d'articles flaggés (similarity < 0.80)
 *   - Top 10 articles les plus dérivés (plus basse similarity)
 *   - Date du dernier run
 */

"use server";

import * as Sentry from "@sentry/nextjs";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAdminWriteRateLimited } from "./_auth";
import { BRAND_VOICE_CONFIG_KEY } from "./brand-voice-constants";

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
// `articleIds` borné à 500 pour éviter saturer pgvector / $queryRawUnsafe.
const RecalibrateBrandVoiceSchema = z
  .array(
    z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9\-_]+$/, "articleId doit être [a-zA-Z0-9-_]"),
  )
  .min(1)
  .max(500);

export interface DriftAuditEntry {
  readonly id: string;
  readonly articleId: string;
  readonly similarity: number;
  readonly level: "warn" | "needs_review";
  readonly detectedAt: string;
  readonly createdAt: Date;
}

export interface BrandVoiceDriftStats {
  readonly lastRunAt: string | null;
  readonly articlesAnalyzed: number;
  readonly articlesFlagged: number;
  readonly articlesNeedsReview: number;
  readonly recentDrifts: DriftAuditEntry[];
  readonly referenceConfigured: boolean;
}

/**
 * Recalibre l'embedding de référence brand voice en moyennant les embeddings
 * des articles fournis (via leurs IDs).
 *
 * Articles sans embedding sont ignorés. Si tous sont sans embedding → throw.
 *
 * Écrit dans :
 *  - ContentGenConfig["brand_voice_reference_embedding"] → tableau JSON nombre
 *  - ContentGenAuditLog (SOC2 audit trail)
 */
export async function recalibrateBrandVoice(articleIds: string[]): Promise<{
  success: boolean;
  embeddingDimension: number;
  articlesUsed: number;
}> {
  const session = await requireAdminWriteRateLimited("recalibrateBrandVoice", {
    limit: 10,
    windowSec: 60,
  });

  // Sprint Final P1-3 — Zod runtime validation (anti-injection $queryRawUnsafe).
  RecalibrateBrandVoiceSchema.parse(articleIds);

  if (!articleIds || articleIds.length === 0) {
    throw new Error("recalibrateBrandVoice: articleIds array cannot be empty");
  }

  try {  
    // Récupérer les embeddings pgvector via $queryRawUnsafe (champ Unsupported)
    const placeholders = articleIds.map((_, i) => `$${i + 1}::uuid`).join(", ");
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT
         a.id,
         ARRAY(SELECT unnest(a.embedding::real[])) AS embedding_arr
       FROM articles a
       WHERE a.id IN (${placeholders})
         AND a.embedding IS NOT NULL`,
      ...articleIds,
    )) as Array<{ id: string; embedding_arr: number[] | null }>;
  
    const validRows = rows.filter((r) => r.embedding_arr && r.embedding_arr.length > 0);
  
    if (validRows.length === 0) {
      throw new Error(
        "recalibrateBrandVoice: none of the provided articles have embeddings — cannot calibrate",
      );
    }
  
    // Moyenner les embeddings
    const dimension = (validRows[0]!.embedding_arr as number[]).length;
    const averaged = new Array<number>(dimension).fill(0);
    for (const row of validRows) {
      const emb = row.embedding_arr as number[];
      for (let i = 0; i < dimension; i++) {
        averaged[i] = (averaged[i] ?? 0) + (emb[i] ?? 0);
      }
    }
    for (let i = 0; i < dimension; i++) {
      averaged[i] = (averaged[i] ?? 0) / validRows.length;
    }
  
    // Normaliser L2 (cosine similarity stable)
    const norm = Math.sqrt(averaged.reduce((s, v) => s + v * v, 0)) || 1;
    const normalized = averaged.map((v) => v / norm);
  
    // Lire l'ancienne valeur pour l'audit diff
    const existingRow = await prisma.contentGenConfig.findUnique({
      where: { key: BRAND_VOICE_CONFIG_KEY },
    });
    const oldValue = existingRow?.value ?? null;
  
    // Persister dans ContentGenConfig
    await prisma.contentGenConfig.upsert({
      where: { key: BRAND_VOICE_CONFIG_KEY },
      create: {
        key: BRAND_VOICE_CONFIG_KEY,
        value: normalized as never,
        updatedBy: session.email,
      },
      update: {
        value: normalized as never,
        updatedBy: session.email,
      },
    });
  
    // SOC2 audit trail
    await prisma.contentGenAuditLog
      .create({
        data: {
          action: "recalibrateBrandVoice",
          settingKey: BRAND_VOICE_CONFIG_KEY,
          oldValue: oldValue as never,
          newValue: {
            dimension,
            articlesUsed: validRows.length,
            articleIds: validRows.map((r) => r.id),
            calibratedAt: new Date().toISOString(),
          } as never,
          actorUserId: session.userId,
          actorEmail: session.email,
          description: `Recalibration brand voice sur ${validRows.length} article(s) — dim=${dimension}`,
        },
      })
      .catch(() => {
        // fail-soft — audit trail failure non bloquant
      });
  
    return {
      success: true,
      embeddingDimension: dimension,
      articlesUsed: validRows.length,
    };
  
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "recalibrateBrandVoice" } });
    throw e;
  }
}

/**
 * Retourne les stats de dérive brand voice sur les 30 derniers jours.
 * Lit le ContentGenAuditLog (action="brand_voice_drift_flag") + ContentGenConfig last run.
 */
export async function getBrandVoiceDriftStats(): Promise<BrandVoiceDriftStats> {
  await requireAdmin();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [driftLogs, lastRunRow, referenceRow] = await Promise.all([
    prisma.contentGenAuditLog.findMany({
      where: {
        action: "brand_voice_drift_flag",
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 200, // cap pour ne pas charger trop de rows
    }),

    prisma.contentGenConfig.findUnique({
      where: { key: "brand_voice_drift_last_run" },
    }),

    prisma.contentGenConfig.findUnique({
      where: { key: BRAND_VOICE_CONFIG_KEY },
    }),
  ]);

  // Parser les entrées drift
  const parsedDrifts: DriftAuditEntry[] = [];
  for (const log of driftLogs) {
    const val = log.newValue as Record<string, unknown> | null;
    if (!val || typeof val !== "object") continue;
    const articleId = typeof val["articleId"] === "string" ? val["articleId"] : null;
    const similarity = typeof val["similarity"] === "number" ? val["similarity"] : null;
    const level = val["level"] === "needs_review" ? "needs_review" : "warn";
    const detectedAt =
      typeof val["detectedAt"] === "string" ? val["detectedAt"] : log.createdAt.toISOString();
    if (!articleId || similarity === null) continue;
    parsedDrifts.push({
      id: log.id,
      articleId,
      similarity,
      level,
      detectedAt,
      createdAt: log.createdAt,
    });
  }

  // Top 10 les plus dérivés (plus basse similarity)
  const top10Drifted = [...parsedDrifts].sort((a, b) => a.similarity - b.similarity).slice(0, 10);

  // Compter depuis les logs — dédupliquer par articleId pour éviter doublons
  const uniqueArticles = new Set(parsedDrifts.map((d) => d.articleId));
  const needsReviewSet = new Set(
    parsedDrifts.filter((d) => d.level === "needs_review").map((d) => d.articleId),
  );

  // Stats dernier run depuis ContentGenConfig
  let lastRunAt: string | null = null;
  let articlesAnalyzed = 0;
  if (lastRunRow?.value && typeof lastRunRow.value === "object") {
    const v = lastRunRow.value as Record<string, unknown>;
    if (typeof v["analyzedAt"] === "string") lastRunAt = v["analyzedAt"];
    if (typeof v["articlesAnalyzed"] === "number") articlesAnalyzed = v["articlesAnalyzed"];
  }

  return {
    lastRunAt,
    articlesAnalyzed,
    articlesFlagged: uniqueArticles.size,
    articlesNeedsReview: needsReviewSet.size,
    recentDrifts: top10Drifted,
    referenceConfigured: !!referenceRow?.value,
  };
}

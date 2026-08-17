"use server";

import * as Sentry from "@sentry/nextjs";
import { Queue } from "bullmq";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ContentType, SearchIntent } from "../../../../prisma/generated/client";
// Fix 2026-08-15 (audit e2e) — options par défaut partagées des files content-gen.
import { CONTENT_GEN_JOB_OPTIONS } from "@/server/content-gen/queue/job-options";
import { requireAdminWriteRateLimited } from "./_auth";

// `landing_ville` exclu : CLI-only, hors REGISTRY content-gen (generators/index.ts)
// → un dispatch ad-hoc sur ce type créerait un job « No generator registered ».
const CONTENT_TYPE_VALUES = [
  "blog_article",
  "blog_from_rss",
  "blog_from_keywords",
  "blog_from_title",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
] as const;

// B5 (CONTENT-GEN-UX 2026) — aligné sur l'enum DB `SearchIntent` (8 valeurs),
// comme `enqueue.ts`. Avant : `commercial` (valeur INEXISTANTE en DB) et omettait
// `commercial_investigation` + les 3 intents 2026 (voice_search/ai_overview/
// featured_snippet) → la validation Zod throwait dès qu'un de ces intents passait.
const SEARCH_INTENT_VALUES = [
  "informational",
  "commercial_investigation",
  "transactional",
  "navigational",
  "local",
  "voice_search",
  "ai_overview",
  "featured_snippet",
] as const;

const AdHocJobSchema = z.object({
  contentType: z.enum(CONTENT_TYPE_VALUES),
  anchorVilleSlug: z.string().max(100).optional(),
  searchIntent: z.enum(SEARCH_INTENT_VALUES).optional(),
  campaignId: z.string().cuid().optional(),
  // Titre / mot-clé imposé (optionnel). Si fourni, il est écrit dans
  // inputPayload.primaryKeyword → le worker NE pioche PAS dans le pool de seeds
  // et le générateur (blog_from_title en tête) l'utilise comme sujet imposé.
  // Vide → fallback historique = sélection auto d'un seed (rotation lastUsedAt).
  title: z.string().trim().min(1).max(140).optional(),
});

export type AdHocJobInput = z.infer<typeof AdHocJobSchema>;

export async function dispatchAdHocJob(input: AdHocJobInput): Promise<{ jobId: string }> {
  const session = await requireAdminWriteRateLimited("dispatch-adhoc-job", { limit: 10 });
  const data = AdHocJobSchema.parse(input);
  const correlationId = crypto.randomUUID();
  const idempotencyKey = crypto
    .createHash("sha256")
    .update(
      `adhoc::${session.userId}::${Date.now()}::${data.contentType}::${data.anchorVilleSlug ?? ""}::${data.title ?? ""}`,
    )
    .digest("hex")
    .slice(0, 32);

  try {
    const job = await prisma.contentGenJob.create({
      data: {
        idempotencyKey,
        contentType: data.contentType as ContentType,
        status: "queued",
        priority: 10,
        correlationId,
        inputPayload: {
          adhoc: true,
          dispatchedBy: session.userId,
          // Si présent → sujet imposé (court-circuite la sélection de seed du
          // worker) ; lu par content-gen-worker via inputPayload.primaryKeyword.
          ...(data.title ? { primaryKeyword: data.title } : {}),
        },
        targetLocale: "fr",
        targetSearchIntent: (data.searchIntent ?? "informational") as SearchIntent,
        primaryProvider: "openai",
        fallbackProvider: "anthropic",
        ...(data.anchorVilleSlug ? { anchorVilleSlug: data.anchorVilleSlug } : {}),
        ...(data.campaignId ? { campaignId: data.campaignId } : {}),
      },
    });

    const redisUrl = process.env.REDIS_URL;
    if (redisUrl && !redisUrl.includes("stub.invalid")) {
      // Fix 2026-08-15 (audit e2e) — `defaultJobOptions` partagées : sans elles
      // la file héritait du défaut BullMQ (1 tentative, pas de backoff).
      const q = new Queue("content-gen", {
        connection: { url: redisUrl },
        defaultJobOptions: CONTENT_GEN_JOB_OPTIONS,
      });
      await q.add(
        "generate",
        {
          contentGenJobId: job.id,
          contentType: job.contentType,
          targetSearchIntent: job.targetSearchIntent,
          inputPayload: job.inputPayload,
        },
        { jobId: `gen-${job.id}` },
      );
      await q.close();
    }

    return { jobId: job.id };
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "dispatchAdHocJob" } });
    throw e;
  }
}

"use server";

import * as Sentry from "@sentry/nextjs";
import { Queue } from "bullmq";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ContentType, SearchIntent } from "../../../../prisma/generated/client";
import { requireAdminWriteRateLimited } from "./_auth";

const CONTENT_TYPE_VALUES = [
  "landing_ville",
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
});

export type AdHocJobInput = z.infer<typeof AdHocJobSchema>;

export async function dispatchAdHocJob(input: AdHocJobInput): Promise<{ jobId: string }> {
  const session = await requireAdminWriteRateLimited("dispatch-adhoc-job", { limit: 10 });
  const data = AdHocJobSchema.parse(input);
  const correlationId = crypto.randomUUID();
  const idempotencyKey = crypto
    .createHash("sha256")
    .update(
      `adhoc::${session.userId}::${Date.now()}::${data.contentType}::${data.anchorVilleSlug ?? ""}`,
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
        inputPayload: { adhoc: true, dispatchedBy: session.userId },
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
      const q = new Queue("content-gen", { connection: { url: redisUrl } });
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

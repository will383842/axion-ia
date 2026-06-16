/**
 * Content Generator — Enqueue direct (Fix P0-5 + P0-G2 audit opérationnel
 * 2026-05-14).
 *
 * Server Action utilisée par le dashboard pour les "quick actions" § 12.2 :
 *   [Générer landing ville…] [Générer article…] [Générer comparatif…]
 *   [Générer guide pilier…] [Générer FAQ standalone…]
 *
 * Création immédiate d'un ContentGenJob row + enqueue BullMQ. Le worker
 * `content-gen-worker` picke aussitôt. Idempotency = sha256(contentType + ville
 * + keyword + intent + timestamp 60s slot) pour éviter doublons clic.
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { Queue } from "bullmq";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ContentType, SearchIntent } from "../../../../prisma/generated/client";
import { requireAdmin } from "./_auth";

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
const ContentTypeSchema = z.enum([
  "landing_ville",
  "blog_article",
  "blog_from_rss",
  "blog_from_keywords",
  "blog_from_title",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
]);
// B5 (CONTENT-GEN-UX 2026) — aligné sur l'enum DB `SearchIntent` (8 valeurs).
// Avant : la liste contenait `commercial` (valeur INEXISTANTE en DB) et omettait
// `commercial_investigation` + les 3 intents 2026 (voice_search/ai_overview/
// featured_snippet). Le dropdown « Tester » de /templates/[id] propose
// `commercial_investigation` → la validation Zod throwait. Doit lister TOUTES
// les valeurs de l'enum Prisma `SearchIntent` pour ne plus rejeter.
const SearchIntentSchema = z.enum([
  "informational",
  "commercial_investigation",
  "transactional",
  "navigational",
  "local",
  "voice_search",
  "ai_overview",
  "featured_snippet",
]);
const EnqueueDirectGenInputSchema = z
  .object({
    contentType: ContentTypeSchema,
    targetSearchIntent: SearchIntentSchema,
    anchorVilleSlug: z.string().min(1).max(120).optional(),
    anchorRegionSlug: z.string().min(1).max(120).optional(),
    anchorDepartementCode: z.string().min(2).max(5).optional(),
    primaryKeyword: z.string().max(500).optional(),
    title: z.string().max(500).optional(),
    templateId: z.string().min(1).max(64).optional(),
  })
  .strict();

let contentGenQueue: Queue | null = null;
function getContentGenQueue(): Queue | null {
  if (contentGenQueue) return contentGenQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  contentGenQueue = new Queue("content-gen", { connection: { url: redisUrl } });
  return contentGenQueue;
}

export interface EnqueueDirectGenInput {
  readonly contentType: ContentType;
  readonly targetSearchIntent: SearchIntent;
  readonly anchorVilleSlug?: string;
  readonly anchorRegionSlug?: string;
  readonly anchorDepartementCode?: string;
  readonly primaryKeyword?: string;
  readonly title?: string;
  readonly templateId?: string;
}

export interface EnqueueDirectGenResult {
  readonly jobId: string;
  readonly idempotencyKey: string;
  readonly enqueuedInBullmq: boolean;
}

/**
 * Enqueue 1 job de génération unitaire (pas via campagne).
 *
 * Utilisé pour les quick actions dashboard ET pour /templates/[id] "Tester
 * avec ce template" ET pour /geo/[villeSlug]/generate. Pas de gating par
 * `CoverageCampaign` — pipeline 1 (landings) ou pipeline 3 (one-shot).
 */
export async function enqueueDirectGen(
  input: EnqueueDirectGenInput,
): Promise<EnqueueDirectGenResult> {
  try {
    const session = await requireAdmin();
    // Sprint Final P1-3 — Zod runtime validation.
    EnqueueDirectGenInputSchema.parse(input);

    // Anti-doublon clic : slot 60s sur (type + ville + keyword + intent).
    const slot = Math.floor(Date.now() / 60_000);
    const idemSource = [
      input.contentType,
      input.anchorVilleSlug ?? "",
      input.anchorRegionSlug ?? "",
      input.primaryKeyword ?? "",
      input.title ?? "",
      input.targetSearchIntent,
      slot,
    ].join("::");
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(idemSource)
      .digest("hex")
      .slice(0, 32);

    // Si une row existe déjà avec ce key, on retourne son id (no-op insert).
    const existing = await prisma.contentGenJob.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (existing) {
      return {
        jobId: existing.id,
        idempotencyKey,
        enqueuedInBullmq: false,
      };
    }

    const inputPayload: Record<string, unknown> = {};
    if (input.primaryKeyword) inputPayload["primaryKeyword"] = input.primaryKeyword;
    if (input.title) inputPayload["title"] = input.title;

    const dbJob = await prisma.contentGenJob.create({
      data: {
        idempotencyKey,
        contentType: input.contentType,
        status: "queued",
        priority: 3, // user-initiated > campagnes (5)
        ...(input.templateId ? { templateId: input.templateId } : {}),
        ...(input.anchorVilleSlug ? { anchorVilleSlug: input.anchorVilleSlug } : {}),
        ...(input.anchorRegionSlug ? { anchorRegionSlug: input.anchorRegionSlug } : {}),
        ...(input.anchorDepartementCode
          ? { anchorDepartementCode: input.anchorDepartementCode }
          : {}),
        inputPayload: inputPayload as never,
        targetLocale: "fr",
        targetSearchIntent: input.targetSearchIntent,
        primaryProvider: "openai",
        fallbackProvider: "anthropic",
        createdBy: session.userId,
      },
      select: { id: true },
    });

    const queue = getContentGenQueue();
    let enqueuedInBullmq = false;
    if (queue) {
      await queue.add(
        "generate",
        {
          contentGenJobId: dbJob.id,
          contentType: input.contentType,
          targetSearchIntent: input.targetSearchIntent,
          inputPayload,
          // B4 (CONTENT-GEN-UX 2026) — propage le templateId choisi (bouton
          // « Tester » de /templates/[id]) pour que le worker teste CE template
          // précis (override par id) au lieu de résoudre par contentType+isActive.
          ...(input.templateId ? { templateId: input.templateId } : {}),
        },
        { jobId: `gen-${dbJob.id}` },
      );
      enqueuedInBullmq = true;
    }

    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen`);
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/jobs`);

    return {
      jobId: dbJob.id,
      idempotencyKey,
      enqueuedInBullmq,
    };
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "enqueueDirectGen" } });
    throw e;
  }
}

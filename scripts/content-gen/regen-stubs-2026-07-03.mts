/**
 * Ops one-shot (audit blog 2026-07-03) — enrichit les 5 stubs thin (avril-mai,
 * ~300-400 car., hors content-gen) via régénération content-gen IN-PLACE.
 *
 * Réplique la logique de `enqueueRegeneration` (src/server/actions/content-gen/
 * regenerate.ts), qui est privée + gardée par requireAdmin() donc non appelable
 * depuis un script. On réutilise les helpers EXPORTÉS pour rester fidèle.
 *
 * À exécuter DANS le conteneur prod (DATABASE_URL + REDIS_URL réels) :
 *   docker exec -w /app <worker> node_modules/.bin/tsx regen-stubs-2026-07-03.mts
 *
 * La régénération préserve le slug + le statut published ; le worker réécrit le
 * corps en place. Idempotent (slot 60s + garde in-flight refreshArticleId).
 */
import { Queue } from "bullmq";
import { prisma } from "@/lib/prisma";
import {
  buildRegenerationJobData,
  deriveSourceJobFromArticle,
  REGENERABLE_CONTENT_TYPES,
  type RegenSourceJob,
} from "@/server/actions/content-gen/regenerate-helpers";

// Liste corrigée alignée sur l'enum ContentGenJobStatus prod (le code déployé
// exporte une NON_TERMINAL_STATUSES buggée : generating_images/fact_checking
// inexistants → query en erreur). Fixé en parallèle dans regenerate-helpers.ts.
const NON_TERMINAL_STATUSES = [
  "queued",
  "running",
  "generating_text",
  "generating_image",
  "running_qa",
  "quality_improving",
  "needs_review",
  "approved",
  "publishing",
] as const;

const IDS = [
  "aaf3419a-781c-4b8a-b8da-f8cc6c4481ad", // pourquoi-auditer-avant-implementer
  "aa290aad-3029-4203-8560-14f458c56de2", // 3-quick-wins-2026
  "d830e9b6-f2fb-48ef-a17b-1cf3ae12d2fb", // ia-custom-quand-vraiment
  "cb7189b3-4d88-417e-ab90-85fc3ae65071", // automatisation-comptable-roi
  "aaa82a7b-fba8-474a-995e-f3f8bd46b1e7", // intervention-essentielle-jour-type
];

const redisUrl = process.env.REDIS_URL;
const queue =
  redisUrl && !redisUrl.includes("stub.invalid")
    ? new Queue("content-gen", { connection: { url: redisUrl } })
    : null;

async function enqueue(articleId: string) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      status: true,
      generatedByJobId: true,
      searchIntent: true,
      translations: { where: { locale: "fr" }, select: { slug: true, title: true } },
    },
  });
  if (!article) return { articleId, skippedReason: "article_not_found" };
  if (article.status !== "published")
    return { articleId, skippedReason: `not_published:${article.status}` };

  let sourceJob: RegenSourceJob | null = null;
  if (article.generatedByJobId) {
    const found = await prisma.contentGenJob.findUnique({
      where: { id: article.generatedByJobId },
      select: {
        contentType: true,
        targetSearchIntent: true,
        targetLocale: true,
        anchorVilleSlug: true,
        anchorRegionSlug: true,
        anchorDepartementCode: true,
        templateId: true,
        serviceSector: true,
        campaignId: true,
        primaryProvider: true,
        fallbackProvider: true,
        inputPayload: true,
      },
    });
    if (found && REGENERABLE_CONTENT_TYPES.has(found.contentType))
      sourceJob = found as RegenSourceJob;
  }
  if (!sourceJob) {
    sourceJob = deriveSourceJobFromArticle({
      searchIntent: article.searchIntent,
      title: article.translations[0]?.title ?? null,
    });
  }

  const inFlight = await prisma.contentGenJob.findFirst({
    where: {
      inputPayload: { path: ["refreshArticleId"], equals: articleId },
      status: { in: NON_TERMINAL_STATUSES as never },
    },
    select: { id: true },
  });
  if (inFlight) return { articleId, jobId: inFlight.id, skippedReason: "refresh_in_flight" };

  const { idempotencyKey, inputPayload, data } = buildRegenerationJobData({
    articleId,
    preservedSlug: article.translations[0]?.slug ?? null,
    sourceJob,
    createdBy: "audit-blog-2026-07-03",
    slotMs: Date.now(),
  });

  const existing = await prisma.contentGenJob.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) return { articleId, jobId: existing.id, enqueuedInBullmq: false };

  const dbJob = await prisma.contentGenJob.create({ data: data as never, select: { id: true } });

  let enqueuedInBullmq = false;
  if (queue) {
    await queue.add(
      "generate",
      {
        contentGenJobId: dbJob.id,
        contentType: sourceJob.contentType,
        targetSearchIntent: sourceJob.targetSearchIntent,
        inputPayload,
        ...(sourceJob.templateId ? { templateId: sourceJob.templateId } : {}),
      },
      { jobId: `gen-${dbJob.id}` },
    );
    enqueuedInBullmq = true;
  }
  return { articleId, jobId: dbJob.id, enqueuedInBullmq };
}

for (const id of IDS) {
  try {
    console.log(JSON.stringify(await enqueue(id)));
  } catch (e) {
    console.log(
      JSON.stringify({ articleId: id, error: e instanceof Error ? e.message : String(e) }),
    );
  }
}
await prisma.$disconnect();
if (queue) await queue.close();
process.exit(0);

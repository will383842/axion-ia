/**
 * Content Generator — Publish worker (§ 14.1 master prompt v1.7).
 *
 * Pick depuis queue `content-publish` les jobs déclenchés par les actions
 * `promoteToTier1()` ou `approveReview()` quand la review est approuvée.
 *
 * Pipeline :
 *  1. Lookup ContentGenJob + ReviewQueue
 *  2. Récupère outputJsonRaw du job (sortie generator)
 *  3. Insert/Update Article DB :
 *     - status: published
 *     - indexationTier: tier_1_indexable (si promoteToTier1) sinon tier_2_noindex_follow
 *     - generatedByJobId = job.id
 *     - quality scores copiés depuis job
 *     - JSON-LD wired : NewsArticle si blog_from_rss, Article sinon
 *     - searchIntent + isNews + newsSourceUrl/Name si applicable
 *  4. Insert ArticleTranslation FR (locale, title, slug, body, bodyJson, bodyText)
 *  5. Enqueue IndexNow ping pour l'URL publique
 *  6. revalidatePath() côté Next 16
 *  7. ContentGenJob.outputBlogPostId = article.id
 *
 * En cas d'erreur Prisma (slug duplicate, FK manquant), le worker log + fail
 * mais ne re-publie pas → action manuelle nécessaire.
 */

import { Queue, Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { enrichOutputWithNewsArticleJsonLd } from "@/server/content-gen/generators/blog-from-rss";
import { revalidateContent } from "@/server/content-gen/shared/revalidate-content";
import { enqueueIndexingForTier1 } from "@/server/content-gen/indexing/enqueue";
import { logStep, logStepError } from "@/server/content-gen/shared/generation-log";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import { sendTelegram } from "@/lib/telegram";

const QUEUE_NAME = "content-publish";

let factCheckQueue: Queue | null = null;
function getFactCheckQueue(): Queue {
  if (factCheckQueue) return factCheckQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set");
  factCheckQueue = new Queue("content-fact-check", { connection: { url: redisUrl } });
  return factCheckQueue;
}

export interface PublishJobPayload {
  readonly reviewQueueId: string;
  readonly promoteToTier1: boolean;
}

let qaExtractQueue: Queue | null = null;
function getQaExtractQueue(): Queue {
  if (qaExtractQueue) return qaExtractQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set");
  qaExtractQueue = new Queue("content-qa-extract", { connection: { url: redisUrl } });
  return qaExtractQueue;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function processJob(job: Job<PublishJobPayload>): Promise<void> {
  const { reviewQueueId, promoteToTier1 } = job.data;

  // Audit 2026-05-15 P1-8 — kill-switch hard-gate avant publish
  // (publish a un blast radius le plus élevé : Article inséré + IndexNow + ISR
  // revalidate + fact-check enqueue. Pause Will doit l'arrêter immédiatement).
  const killSwitch = await readContentGenConfig<{ active: boolean }>("kill_switch", {
    active: false,
  });
  if (killSwitch.active) {
    console.log(`[content-publish-worker] kill switch active, requeue review ${reviewQueueId}`);
    throw new Error("kill_switch_active");
  }

  const review = await prisma.reviewQueue.findUnique({
    where: { id: reviewQueueId },
    include: { job: true },
  });
  if (!review) throw new Error(`ReviewQueue ${reviewQueueId} not found`);
  if (review.status !== "approved" && review.status !== "promoted_t1") {
    console.warn(`[publish] review ${reviewQueueId} not approved (status=${review.status}), skip`);
    return;
  }

  const cgJob = review.job;
  const output = cgJob.outputJsonRaw as Record<string, unknown> | null;
  if (!output) {
    throw new Error(`ContentGenJob ${cgJob.id} has no outputJsonRaw`);
  }

  const title = typeof output.title === "string" ? output.title : "Sans titre";
  const metaTitle = typeof output.metaTitle === "string" ? output.metaTitle : title.slice(0, 70);
  const metaDescription = typeof output.metaDescription === "string" ? output.metaDescription : "";
  const bodyHtml = typeof output.bodyHtml === "string" ? output.bodyHtml : "";
  const bodyText = typeof output.bodyText === "string" ? output.bodyText : "";
  const directAnswer = typeof output.directAnswer === "string" ? output.directAnswer : null;
  const faqJson = output.faqJson ?? output.faq ?? null;
  const slugCandidate =
    typeof output.slug === "string" && output.slug.length > 0
      ? output.slug
      : slugify(title) || `article-${cgJob.id.slice(0, 8)}`;
  const wordCount = typeof output.wordCount === "number" ? output.wordCount : null;
  const readingTimeMinutes =
    typeof output.readingTimeMinutes === "number" ? output.readingTimeMinutes : null;

  const isNews = cgJob.contentType === "blog_from_rss";
  const rssSourceUrl =
    typeof (cgJob.inputPayload as Record<string, unknown>)?.rssLink === "string"
      ? ((cgJob.inputPayload as Record<string, unknown>).rssLink as string)
      : null;
  const rssSourceName =
    typeof (cgJob.inputPayload as Record<string, unknown>)?.rssSourceName === "string"
      ? ((cgJob.inputPayload as Record<string, unknown>).rssSourceName as string)
      : null;

  // Article + Translation insert (transaction)
  const indexationTier = promoteToTier1 ? "tier_1_indexable" : "tier_2_noindex_follow";

  await logStep(cgJob.id, "publish", "Publish pipeline start", {
    review_queue_id: reviewQueueId,
    promote_to_tier_1: promoteToTier1,
    content_type: cgJob.contentType,
    target_search_intent: cgJob.targetSearchIntent,
    is_news: isNews,
    slug_candidate: slugCandidate,
  });

  const article = await prisma.$transaction(async (tx) => {
    const a = await tx.article.create({
      data: {
        status: "published",
        publishedAt: new Date(),
        ...(readingTimeMinutes !== null ? { readingTime: readingTimeMinutes } : {}),
        indexationTier,
        ...(cgJob.qualityScore !== null ? { qualityScore: cgJob.qualityScore } : {}),
        ...(cgJob.seoScore !== null ? { seoScore: cgJob.seoScore } : {}),
        ...(cgJob.readabilityScore !== null ? { readabilityScore: cgJob.readabilityScore } : {}),
        ...(cgJob.plagiarismScore !== null ? { plagiarismScore: cgJob.plagiarismScore } : {}),
        ...(promoteToTier1 ? { promotedAt: new Date() } : {}),
        generatedByJobId: cgJob.id,
        ...(directAnswer ? { directAnswer } : {}),
        ...(faqJson ? { faqJson: faqJson as never } : {}),
        templateVariant: cgJob.templateId ?? null,
        searchIntent: cgJob.targetSearchIntent,
        isNews,
        ...(isNews && rssSourceUrl ? { newsSourceUrl: rssSourceUrl } : {}),
        ...(isNews && rssSourceName ? { newsSourceName: rssSourceName } : {}),
      },
    });

    // Translation FR (en V1 — EN exclu doctrine v1.2)
    await tx.articleTranslation.create({
      data: {
        articleId: a.id,
        locale: "fr",
        title,
        slug: slugCandidate,
        body: bodyHtml,
        ...(bodyText ? { bodyText } : {}),
        metaTitle,
        ...(metaDescription ? { metaDescription } : {}),
        ...(wordCount !== null ? { wordCount } : {}),
      },
    });

    // Lien retour ContentGenJob
    await tx.contentGenJob.update({
      where: { id: cgJob.id },
      data: {
        status: "published",
        outputBlogPostId: a.id,
        completedAt: new Date(),
      },
    });

    return a;
  });

  await logStep(cgJob.id, "article_insert", "Article + ArticleTranslation FR inserted", {
    article_id: article.id,
    tier: indexationTier,
    slug: slugCandidate,
    is_news: isNews,
  });

  // JSON-LD NewsArticle (Sprint 5 wire) — stocké pour usage downstream
  if (isNews && rssSourceUrl && rssSourceName) {
    const jsonLd = enrichOutputWithNewsArticleJsonLd({
      title,
      metaDescription,
      slug: slugCandidate,
      publishedAt: article.publishedAt ?? new Date(),
      rssSourceUrl,
      rssSourceName,
      ...(wordCount !== null ? { wordCount } : {}),
      ...(readingTimeMinutes !== null ? { readingTimeMinutes } : {}),
    });
    // V1 : log JSON-LD prêt — la page Article publique (V1.5+) le lit via
    // helper côté generateMetadata(). V1 = stocké dans GenerationLog audit trail.
    await logStep(
      cgJob.id,
      "json_ld_news_article",
      "NewsArticle JSON-LD prêt pour injection <head>",
      jsonLd as Record<string, unknown>,
    );
  }

  // Sprint 9 V2 : indexing ping centralisé (IndexNow + Google Indexing) si tier-1.
  // Le helper enqueueIndexingForTier1 dédoublonne sur jobId et gate Google
  // Indexing sur flag GOOGLE_INDEXING_API_ENABLED. Réutilisé par Sprint 10
  // tier-lifecycle-worker (auto-promote CTR > seuil) → un seul code path indexing.
  if (promoteToTier1) {
    await enqueueIndexingForTier1({
      articleId: article.id,
      slug: slugCandidate,
      isNews,
      origin: "content-gen",
    });
    await logStep(cgJob.id, "indexnow_ping", "Indexing enqueued (IndexNow + Google Indexing)", {
      article_id: article.id,
      slug: slugCandidate,
      is_news: isNews,
    });
  }

  // Sprint 12.5 V2 : fact-check Perplexity post-publish. Tous tiers, pas
  // seulement tier-1 — sert aussi à scorer les tier-2 pour décider de
  // l'auto-promote Sprint 10. Coût ~$0.005/article, idempotent.
  try {
    await getFactCheckQueue().add(
      "check",
      { articleId: article.id, contentGenJobId: cgJob.id },
      { jobId: `fact-check-${cgJob.id}` },
    );
    await logStep(cgJob.id, "fact_check_enqueue", "Fact-check Perplexity enqueued", {
      article_id: article.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[publish] fact-check enqueue failed for article ${article.id}:`, msg);
    await logStepError(cgJob.id, "fact_check_enqueue", `Enqueue failed: ${msg}`, {
      article_id: article.id,
    });
  }

  // Pass B fix P0-7 — Q/R post-process auto (§ 29 master prompt v1.7).
  // Pour chaque article publié qui contient des Q/R extraites (faqJson),
  // enqueue un job d'extraction qui crée une FAQ row par Q/R sous
  // /fr/faq/<slug>. Idempotent (upsert). Skeleton V1 — enrichment ≥ 300
  // mots V1.5+.
  const faqList = Array.isArray(faqJson)
    ? (faqJson as Array<{ question: string; answer: string }>)
    : null;
  if (faqList && faqList.length > 0) {
    const cleanFaqs = faqList.filter(
      (f) =>
        typeof f === "object" &&
        f !== null &&
        typeof f.question === "string" &&
        typeof f.answer === "string",
    );
    await getQaExtractQueue().add(
      "extract",
      {
        articleId: article.id,
        contentGenJobId: cgJob.id,
        articleSlug: slugCandidate,
        articleTitle: title,
        ...(cgJob.anchorVilleSlug ? { anchorVilleSlug: cgJob.anchorVilleSlug } : {}),
        ...(cgJob.anchorRegionSlug ? { anchorRegionSlug: cgJob.anchorRegionSlug } : {}),
        faqs: cleanFaqs,
      },
      { jobId: `qa-extract-${cgJob.id}` },
    );
    await logStep(cgJob.id, "qa_extract", "Q/R extraction enqueued post-publish", {
      article_id: article.id,
      faq_count: cleanFaqs.length,
    });
  }

  // P1-16 fix audit opérationnel 2026-05-14 — revalidate via API interne au
  // lieu de `revalidatePath()` direct (qui no-op silencieusement en worker bg
  // sans request context). Le helper revalidateContent POST sur
  // /api/internal/revalidate qui exécute le revalidate avec contexte valide.
  // Audit indexation 2026-05-18 P0-8 — ajout `/sitemap-index.xml` (route handler
  // custom dans `app/sitemap-index.xml/route.ts`, référencé par robots.txt). Sans
  // ce path explicite, l'index racine ISR pouvait servir un cache 1h obsolète
  // après publish d'un Article tier-1. `/sitemap.xml` (Next 16 metadata convention)
  // est aussi revalidé pour la propagation côté Googlebot qui peut découvrir les
  // deux (cf. audit AGENT-01-SITEMAP-INDEX §1.1).
  const paths = [
    `/fr/blog/${slugCandidate}`,
    ...(isNews ? [`/fr/actualites/${slugCandidate}`, "/fr/actualites"] : []),
    "/fr/blog",
    "/sitemap.xml",
    "/sitemap-index.xml",
    ...(isNews ? ["/sitemap-news.xml"] : []),
  ];
  await revalidateContent({ paths });
  await logStep(cgJob.id, "revalidate_path", "Revalidate paths via internal API", {
    paths,
  });

  await logStep(cgJob.id, "publish", "Publish pipeline complete", {
    article_id: article.id,
    tier: indexationTier,
    slug: slugCandidate,
    is_news: isNews,
  });
  console.log(
    `[publish] article ${article.id} published (tier=${indexationTier}, slug=${slugCandidate}, isNews=${isNews})`,
  );
}

let workerInstance: Worker<PublishJobPayload> | null = null;

export function startPublishWorker(): Worker<PublishJobPayload> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — publish-worker cannot start");
  workerInstance = new Worker<PublishJobPayload>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 3,
    limiter: { max: 20, duration: 60_000 }, // 20/min — Prisma serial safe
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-publish-worker] job ${job?.id} failed:`, err);
    // P1-12 audit indexation 2026-05-15 — alerte Telegram sur publish failed.
    // Publish a le blast radius le plus élevé du pipeline content-gen (Article
    // inséré + IndexNow + ISR revalidate + fact-check enqueue). Avant ce patch,
    // un échec restait silencieux (console.error seul). Pattern aligné sur
    // content-gen-worker / content-orchestrator-worker.
    const reviewId =
      (job?.data as { readonly reviewQueueId?: string } | undefined)?.reviewQueueId ?? "?";
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg !== "kill_switch_active") {
      void sendTelegram({
        tag: "INCIDENT",
        body:
          `*[🔴 PUBLISH FAILED]* content-publish job \`${job?.id ?? "?"}\` ` +
          `(reviewQueueId=\`${reviewId}\`).\n` +
          `Erreur : ${errMsg}.\n` +
          `Article potentiellement inséré partiellement — vérifier prisma.article + GenerationLog.`,
      }).catch(() => {
        // best-effort
      });
    }
  });
  workerInstance.on("completed", (job) => {
    console.log(`[content-publish-worker] job ${job.id} OK`);
  });
  return workerInstance;
}

export async function stopPublishWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  // IndexNow queue cleanup déplacé dans le helper enqueue-indexing (Sprint 9).
}

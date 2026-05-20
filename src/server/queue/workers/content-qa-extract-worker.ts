/**
 * Content Generator — Q/R post-process auto worker (Pass B fix P0-7).
 *
 * Implémente le hook `qa_extract_and_publish` du § 29 master prompt v1.7 :
 * pour chaque article content-gen publié (Article.faqJson ≠ null), crée
 * automatiquement une FAQ row par Q/R extraite, indexable sous
 * `/fr/faq/<slug>` (route Next existante).
 *
 * **V1 squelette** :
 * - Pas de re-prompt LLM Perplexity pour enrichissement ≥ 300 mots (V1.5+).
 *   On insère la Q/R telle quelle, marquée `tier_2_noindex_follow` par défaut
 *   (anti-doorway HCU strict — Will pourra promote tier-1 manuellement après
 *   enrichment V1.5).
 * - Pas de cosine similarity pour `similarQaIds[]` (V1.5+).
 * - revalidatePath() best-effort (no-op si pas de request context).
 *
 * **Trigger** : enqueue depuis `content-publish-worker` après insert Article DB.
 *
 * **Idempotence** : `slug` unique = `${articleSlug}-${slugifyQuestion}`. Si une
 * FAQ avec ce slug existe déjà, on `upsert` (re-publication article = refresh
 * Q/R).
 */

import { Worker, type Job } from "bullmq";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import { logStep, logStepError } from "@/server/content-gen/shared/generation-log";
import { sanitizeFaqAnswer, sanitizeFaqQuestion } from "@/server/content-gen/shared/faq-sanitizer";

const QUEUE_NAME = "content-qa-extract";

export interface QaExtractJobPayload {
  readonly articleId: string;
  readonly contentGenJobId: string;
  readonly articleSlug: string;
  readonly articleTitle: string;
  readonly anchorVilleSlug?: string;
  readonly anchorRegionSlug?: string;
  /** Q/R extraites du generator output.faq */
  readonly faqs: ReadonlyArray<{ question: string; answer: string }>;
}

/**
 * Slugify une question Q/R pour URL : kebab-case + max 80 chars + déaccentué.
 * Préfixé par le slug article parent pour cohérence + désambiguïsation.
 */
function slugifyQuestion(articleSlug: string, question: string): string {
  const base = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${articleSlug}-${base}`.slice(0, 180);
}

async function processJob(job: Job<QaExtractJobPayload>): Promise<void> {
  const { articleId, contentGenJobId, articleSlug, articleTitle, faqs } = job.data;

  // Kill switch hard-gate (P1-7 fix audit opérationnel 2026-05-14).
  // QA extract = effet de bord (insert FAQ DB + pages publiques /fr/faq/[slug]).
  // Kill switch doit le stopper aussi (sinon contenu IA continue de surfaire).
  const killSwitch = await readContentGenConfig<{ active: boolean }>("kill_switch", {
    active: false,
  });
  if (killSwitch.active) {
    console.log(`[qa-extract-worker] kill switch active, requeue job ${contentGenJobId}`);
    throw new Error("kill_switch_active");
  }

  if (!faqs || faqs.length === 0) {
    await logStep(contentGenJobId, "qa_extract", "No FAQs to extract — skipping");
    return;
  }

  await logStep(contentGenJobId, "qa_extract", `Extracting ${faqs.length} Q/R from article`, {
    articleId,
    articleSlug,
  });

  let created = 0;
  let skipped = 0;

  for (const faq of faqs) {
    const slug = slugifyQuestion(articleSlug, faq.question);
    if (slug.length < 10) {
      skipped++;
      continue; // protection contre slug dégénéré
    }

    // Sprint S+5 P2-8 + P2-9 — Sanitization + détection placeholder.
    // Le LLM peut produire de l'HTML dans les réponses (`<strong>`, `<a>`).
    // - P2-8 : DOMPurify avec whitelist FAQ stricte (8 tags) avant insert DB
    //   pour bloquer XSS persistant côté `dangerouslySetInnerHTML` public.
    // - P2-9 : si la réponse contient `[TBD]` / TODO / Lorem / placeholder
    //   → skip l'insert plutôt que polluer la DB avec du contenu bouchon.
    const questionResult = sanitizeFaqQuestion(faq.question);
    if (questionResult.skip) {
      await logStepError(
        contentGenJobId,
        "qa_extract",
        `FAQ skipped (question sanitization) slug=${slug} reason=${questionResult.reason ?? "unknown"}`,
      );
      skipped++;
      continue;
    }
    const answerResult = sanitizeFaqAnswer(faq.answer);
    if (answerResult.skip) {
      await logStepError(
        contentGenJobId,
        "qa_extract",
        `FAQ skipped (answer sanitization/placeholder) slug=${slug} reason=${answerResult.reason ?? "unknown"}`,
      );
      skipped++;
      continue;
    }

    const cleanQuestion = questionResult.html.slice(0, 500);
    const cleanAnswer = answerResult.html;

    try {
      await prisma.fAQ.upsert({
        where: { slug },
        create: {
          slug,
          category: "general",
          questionFr: cleanQuestion,
          questionEn: cleanQuestion, // V1 FR-only — clone FR (pas de placeholder TBD)
          answerFr: cleanAnswer,
          answerEn: cleanAnswer, // V1 FR-only — clone FR (pas de placeholder TBD)
          status: "published",
          publishedAt: new Date(),
          parentArticleId: articleId,
          enrichmentContext: {
            parentTitle: articleTitle,
            parentSlug: articleSlug,
            ...(job.data.anchorVilleSlug ? { ville: job.data.anchorVilleSlug } : {}),
            ...(job.data.anchorRegionSlug ? { region: job.data.anchorRegionSlug } : {}),
          },
          // Anti-doorway HCU strict : Q/R auto = tier-2 par défaut (V1).
          // Will pourra promote tier-1 manuellement après enrichment V1.5.
          indexationTier: "tier_2_noindex_follow",
          generatedByJobId: contentGenJobId,
          isAutoGenerated: true,
        },
        update: {
          questionFr: cleanQuestion,
          answerFr: cleanAnswer,
          parentArticleId: articleId,
          generatedByJobId: contentGenJobId,
          updatedAt: new Date(),
        },
      });
      created++;
    } catch (err) {
      await logStepError(
        contentGenJobId,
        "qa_extract",
        `FAQ upsert failed slug=${slug}: ${err instanceof Error ? err.message : String(err)}`,
      );
      skipped++;
    }
  }

  // Revalidate route FAQ index (best-effort no-op silencieux en worker bg)
  try {
    revalidatePath("/fr/faq");
  } catch {
    // worker bg sans request context → no-op
  }

  await logStep(contentGenJobId, "qa_extract", `Q/R post-process done`, {
    created,
    skipped,
    total: faqs.length,
  });

  console.log(
    `[content-qa-extract-worker] article ${articleId} → ${created}/${faqs.length} FAQ created (skipped=${skipped})`,
  );
}

let workerInstance: Worker<QaExtractJobPayload> | null = null;

export function startContentQaExtractWorker(): Worker<QaExtractJobPayload> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — qa-extract-worker cannot start");
  workerInstance = new Worker<QaExtractJobPayload>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 2,
    limiter: { max: 30, duration: 60_000 }, // 30/min — ne pas saturer DB
    // P2-23 audit indexation 2026-05-18 — bornage retention Redis :
    // garde 1000 jobs completed + 5000 jobs failed max (BullMQ purge auto).
    // Évite saturation Redis long-terme sur high-volume workers.
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-qa-extract-worker] job ${job?.id} failed:`, err);
  });
  workerInstance.on("completed", (job) => {
    console.log(`[content-qa-extract-worker] job ${job.id} completed`);
  });
  return workerInstance;
}

export async function stopContentQaExtractWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}

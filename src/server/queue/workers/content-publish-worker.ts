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
import { redis } from "@/lib/redis";
import { slugify } from "@/lib/slug";
import { enrichOutputWithNewsArticleJsonLd } from "@/server/content-gen/generators/blog-from-rss";
import { revalidateContent } from "@/server/content-gen/shared/revalidate-content";
import { enqueueIndexingForTier1 } from "@/server/content-gen/indexing/enqueue";
import { logStep, logStepError } from "@/server/content-gen/shared/generation-log";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import { sendTelegram } from "@/lib/telegram";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
// B.4 P1.5 — Traçabilite provenance LLM (AI Act art. 50).
import { logProvenance, hashPrompt } from "@/server/content-gen/provenance/provenance-logger";
// V-09 P6 2026-05-22 — Couche 4 dedup : embedding OpenAI text-embedding-3-large.
// Best-effort post-publish, fire-and-forget. Gate sur OPENAI_EMBEDDINGS_ENABLED.
import { persistArticleEmbedding } from "@/server/content-gen/dedup/persist-article-embedding";
// Sprint External Links Database 2026-05-22 — Validation post-publish (≥ 2 liens
// externes + détection hallucinations URL hors catalogue) + tracking usage.
import { trackExternalLinksUsage, detectHallucinations } from "@/data/external-links/helpers";
// Sprint Final P1-14 — Release global keyword lock Redis (Fl-08 multi-campagnes).
import { releaseKeywordLock } from "@/server/content-gen/lib/keyword-lock";

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

// slugify importé depuis @/lib/slug (SSOT V-10 2026-05-22).
// Anciennement défini inline ici avec maxLen 80 — comportement identique préservé.

// P1.5 QW-2 — Google Scaled Content Policy + AI Act compliance.
// MAX_PUBLISH_PER_DAY : cap journalier publications. Env override possible.
// Drip window : 8h-22h CET (Europe/Paris). Publie uniquement pendant les
// heures ouvrées → signal humain, réduit risque HCU Google.
//
// P1-6 — Rampe progressive 30→500 si env var non définie.
// Paliers basés sur le volume d'articles publiés cumulés :
//   <  60 articles publiés → cap 30/jour  (phase démarrage)
//   < 300 articles publiés → cap 100/jour (phase croissance)
//   < 600 articles publiés → cap 200/jour (phase scale)
//   ≥ 600 articles publiés → cap 500/jour (régime croisière)
// Si MAX_PUBLISH_PER_DAY env var définie → override direct (compatibilité).
async function getEffectivePublishCap(): Promise<number> {
  const envCap = process.env.MAX_PUBLISH_PER_DAY;
  if (envCap !== undefined && envCap !== "") return parseInt(envCap, 10);
  // D-P5-5 follow-up: lire depuis ContentGenConfig (priorite 2, avant rampe)
  const dbCap = await readContentGenConfig<number>("MAX_PUBLISH_PER_DAY", 0);
  if (dbCap > 0) return dbCap;
  const totalPublished = await prisma.article.count({ where: { status: "published" } });
  if (totalPublished < 60) return 30;
  if (totalPublished < 300) return 100;
  if (totalPublished < 600) return 200;
  return 500;
}

const DRIP_HOUR_START_CET = 8;
const DRIP_HOUR_END_CET = 22;

function getCetHour(): number {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  return parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
}

/** Absolute timestamp (ms epoch) for the next 8h CET drip window start. */
function msUntilDripStart(): number {
  const now = new Date();
  const cetHour = getCetHour();
  const hoursUntil =
    cetHour < DRIP_HOUR_START_CET
      ? DRIP_HOUR_START_CET - cetHour
      : 24 - cetHour + DRIP_HOUR_START_CET;
  return now.getTime() + hoursUntil * 60 * 60 * 1000;
}

async function runPublishPipeline(job: Job<PublishJobPayload>): Promise<void> {
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

  // P1.5 QW-2 — Drip window check (8h-22h CET, Europe/Paris).
  // Hors fenêtre → job retardé au prochain 8h CET. Signal publication humain.
  const cetHour = getCetHour();
  if (cetHour < DRIP_HOUR_START_CET || cetHour >= DRIP_HOUR_END_CET) {
    const nextWindowTs = msUntilDripStart();
    console.log(
      JSON.stringify({
        event: "publish_throttled",
        reason: "out_of_window",
        cetHour,
        nextRetry: new Date(nextWindowTs).toISOString(),
        reviewQueueId,
      }),
    );
    await job.moveToDelayed(nextWindowTs, job.token);
    return;
  }

  // P0-4 — Daily cap check atomique via Redis INCR (P1.5 QW-2).
  // Remplace l'ancien prisma.article.count() séquentiel (race condition possible
  // avec concurrency=3 : 3 workers pouvaient lire publishedToday=29 simultanément
  // et tous publier, dépassant le cap). Redis INCR est atomique : un seul worker
  // peut décrocher le slot n°30, les autres obtiennent 31+ et reculez.
  // TTL calé sur minuit UTC pour auto-reset quotidien.
  const maxPublishPerDay = await getEffectivePublishCap();
  const today = new Date().toISOString().split("T")[0]; // "2026-05-21"
  const redisKey = `axion:pub:${today}`;
  const countAfterIncr = await redis.incr(redisKey);
  if (countAfterIncr === 1) {
    // Premier incr du jour : poser le TTL jusqu'à minuit UTC
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    const ttl = Math.floor((midnight.getTime() - now.getTime()) / 1000);
    await redis.expire(redisKey, ttl);
  }
  if (countAfterIncr > maxPublishPerDay) {
    // Annuler l'incr pour ne pas fausser le compteur (ce job ne publiera pas)
    await redis.decr(redisKey);
    const nextWindowTs = msUntilDripStart();
    console.log(
      JSON.stringify({
        event: "publish_throttled",
        reason: "max_daily",
        countAfterIncr: countAfterIncr - 1,
        cap: maxPublishPerDay,
        nextRetry: new Date(nextWindowTs).toISOString(),
        reviewQueueId,
      }),
    );
    await job.moveToDelayed(nextWindowTs, job.token);
    return;
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

  // #1 2026-06-14 + P0-3 2026-06-15 — Idempotence remontée AVANT le gate
  // fact-check. Si un Article a déjà été créé pour ce job (re-publish / retry
  // BullMQ après échec post-insert, ou re-approbation), la publication a DÉJÀ eu
  // lieu : on l'utilise (a) pour court-circuiter le gate fact-check (sinon un
  // re-publish d'un job déjà publié + fact-checké < seuil quarantinerait à tort
  // un article pourtant EN LIGNE), (b) pour le marquage idempotent "published"
  // plus bas. Lecture seule, sûre.
  const existingArticle = await prisma.article.findFirst({
    where: { generatedByJobId: cgJob.id },
    select: { id: true },
  });

  // Sprint A-suite P6 — Item 4. Gate factCheckScore avant publication.
  // Si le score fact-check est inférieur au seuil configuré, le job passe en
  // quarantined (non publié) avec un message explicite. Si factCheckScore est
  // null (fact-check pas encore run), le gate est ignoré (non-bloquant).
  //
  // P0-3 (audit content-gen 2026-06-15) — DESIGN. Le flux nominal est
  // POST-publish (décision Will 2026-06-14 « corriger en place plutôt que
  // désindexer » — cf. content-fact-check-worker). À la 1re publication
  // `factCheckScore` est null et ce gate est volontairement passif ; le score
  // est désormais aussi écrit sur ContentGenJob (observabilité + cohérence).
  // Le gate ne s'applique QUE tant que l'article n'existe pas encore
  // (`!existingArticle`) : il ne désindexe jamais un contenu déjà publié — ça,
  // c'est le rôle du fact-check post-publish (correction en place).
  interface FactCheckGateConfig {
    enabled: boolean;
    minScore: number;
  }
  const factCheckGate = await readContentGenConfig<FactCheckGateConfig>("factcheck_gate", {
    enabled: true,
    minScore: 40,
  });
  if (
    !existingArticle &&
    factCheckGate.enabled &&
    cgJob.factCheckScore !== null &&
    cgJob.factCheckScore !== undefined &&
    cgJob.factCheckScore < factCheckGate.minScore
  ) {
    const errMsg = `factcheck_score_below_threshold:${cgJob.factCheckScore}`;
    await prisma.contentGenJob.update({
      where: { id: cgJob.id },
      data: { status: "quarantined_factcheck", errorMessage: errMsg },
    });
    captureWorkerError("publish", QUEUE_NAME, undefined, new Error(errMsg));
    console.log(
      JSON.stringify({
        event: "factcheck_gate_quarantine",
        jobId: cgJob.id,
        factCheckScore: cgJob.factCheckScore,
        minScore: factCheckGate.minScore,
      }),
    );
    return;
  }

  const output = cgJob.outputJsonRaw as Record<string, unknown> | null;
  if (!output) {
    throw new Error(`ContentGenJob ${cgJob.id} has no outputJsonRaw`);
  }

  const title = typeof output.title === "string" ? output.title : "Sans titre";
  const metaTitle = typeof output.metaTitle === "string" ? output.metaTitle : title.slice(0, 70);
  const metaDescription = typeof output.metaDescription === "string" ? output.metaDescription : "";
  const bodyHtml = typeof output.bodyHtml === "string" ? output.bodyHtml : "";
  const bodyText = typeof output.bodyText === "string" ? output.bodyText : "";

  // P1-3 P4 Sprint — Vérifier que metaTitle contient le keyword principal.
  const inputPayloadRaw = cgJob.inputPayload as Record<string, unknown> | null;
  const primaryKeyword =
    typeof inputPayloadRaw?.primaryKeyword === "string" ? inputPayloadRaw.primaryKeyword : null;
  if (primaryKeyword && !metaTitle.toLowerCase().includes(primaryKeyword.toLowerCase())) {
    await logStep(
      cgJob.id,
      "validation",
      `metaTitle manque keyword "${primaryKeyword}" — seoTitleNotOptimized`,
      {
        meta_title: metaTitle,
        primary_keyword: primaryKeyword,
        seo_title_not_optimized: true,
      },
    );
  }

  // Sprint S+2 City Domination — Phase C strat ville (audit profond hotfix
  // 2026-05-18) : extraction sécurisée du champ `mentionedCities` produit
  // par les generators (landing-ville.ts:188+). Audit indépendant a relevé
  // que le worker omettait ce field à l'insert → articles factory avaient
  // `mentioned_cities=[]` même quand le generator avait correctement extrait
  // les villes. Conséquence : hub ville `getBlogArticlesByVille` retournait
  // [] → Phase C autotag inopérante côté DB. Fix : extraction typée tolérante
  // (string[] uniquement, items string non-vides), max 20 (cap anti-spam SEO
  // cohérent avec extractMentionedCitiesFromText:maxCities default).
  const mentionedCitiesRaw = output["mentionedCities"];
  const mentionedCities: string[] = Array.isArray(mentionedCitiesRaw)
    ? mentionedCitiesRaw
        .filter((s): s is string => typeof s === "string" && s.length > 0)
        .slice(0, 20)
    : [];
  const directAnswer = typeof output.directAnswer === "string" ? output.directAnswer : null;
  const faqJson = output.faqJson ?? output.faq ?? null;
  const slugCandidate =
    typeof output.slug === "string" && output.slug.length > 0
      ? output.slug
      : slugify(title) || `article-${cgJob.id.slice(0, 8)}`;
  const wordCount = typeof output.wordCount === "number" ? output.wordCount : null;
  const readingTimeMinutes =
    typeof output.readingTimeMinutes === "number" ? output.readingTimeMinutes : null;

  // B.6 P0-4 P1.5 — Hero image assignment depuis image-bank.
  // content-gen-worker pose heroImageFilePath sur outputJsonRaw quand un match
  // image-bank existe. On le propage dans Article.featuredImage (string URL).
  // Si null → Article.featuredImage reste undefined (Will assigne via admin).
  const heroImageFilePath =
    typeof output["heroImageFilePath"] === "string"
      ? (output["heroImageFilePath"] as string)
      : null;
  // VIS-08 (audit visibilité 2026-06-05) — alt sémantique de l'image hero
  // (calculé par assign-hero-image, propagé par content-gen-worker dans
  // outputJsonRaw.heroImageAlt). Avant ce patch il n'était jamais persisté →
  // la page retombait sur alt={title} (signal Google Images faible).
  const heroImageAlt =
    typeof output["heroImageAlt"] === "string" ? (output["heroImageAlt"] as string) : null;

  // B.7 P0-6 P1.5 — Outline SimHash propage depuis content-gen-worker.
  const outlineSimhash =
    typeof output["outlineSimhash"] === "string" ? (output["outlineSimhash"] as string) : null;

  // #2 2026-06-14 — Fingerprint sémantique (topic-fingerprint) propagé depuis le
  // content-gen-worker ; persisté sur Article pour la dedup cross-entry future.
  const topicFingerprint =
    typeof output["topicFingerprint"] === "string" ? (output["topicFingerprint"] as string) : null;

  // E7 (traçabilité AI-Act) — IDs des entrées KB (KnowledgeEntry) réellement
  // injectées dans le prompt via kbRetrieve(), propagés par le generator dans
  // GeneratorOutput.kbEntryIds (cf. generators/types.ts) → spread dans
  // outputJsonRaw. Persistés tels quels dans Article.kbChunkIds (schema) pour
  // l'audit trail RAG « quels faits KB ont nourri quel article ». Garde sûre :
  // absent / non-array / items non-string → [] (jamais d'exception).
  const kbEntryIdsRaw = output["kbEntryIds"];
  const kbChunkIds: string[] = Array.isArray(kbEntryIdsRaw)
    ? kbEntryIdsRaw.filter((s): s is string => typeof s === "string" && s.length > 0)
    : [];

  const isNews = cgJob.contentType === "blog_from_rss";
  const rssSourceUrl =
    typeof (cgJob.inputPayload as Record<string, unknown>)?.rssLink === "string"
      ? ((cgJob.inputPayload as Record<string, unknown>).rssLink as string)
      : null;
  const rssSourceName =
    typeof (cgJob.inputPayload as Record<string, unknown>)?.rssSourceName === "string"
      ? ((cgJob.inputPayload as Record<string, unknown>).rssSourceName as string)
      : null;

  // #1 2026-06-14 — Idempotence : si un Article a déjà été créé pour ce job
  // (re-publish / retry BullMQ après échec partiel d'une étape post-insert), on
  // NE recrée PAS (Article.create n'est pas idempotent → violerait l'unique slug
  // et créerait un doublon). On court-circuite proprement. `existingArticle` est
  // déjà résolu en tête de pipeline (cf. gate fact-check / P0-3).
  if (existingArticle) {
    await logStep(cgJob.id, "publish", "Article déjà publié pour ce job — skip (idempotent)", {
      article_id: existingArticle.id,
    });
    await prisma.contentGenJob
      .update({
        where: { id: cgJob.id },
        data: { status: "published", outputBlogPostId: existingArticle.id },
      })
      .catch(() => undefined);
    return;
  }

  // Article + Translation insert (transaction)
  const indexationTier = promoteToTier1 ? "tier_1_indexable" : "tier_2_noindex_follow";

  // Sprint A-suite P6 — Item 3. Log correlationId pour traçabilité end-to-end.
  if (cgJob.correlationId) {
    console.log("[publish] correlationId=", cgJob.correlationId, "jobId=", cgJob.id);
  }
  await logStep(cgJob.id, "publish", "Publish pipeline start", {
    review_queue_id: reviewQueueId,
    promote_to_tier_1: promoteToTier1,
    content_type: cgJob.contentType,
    target_search_intent: cgJob.targetSearchIntent,
    is_news: isNews,
    slug_candidate: slugCandidate,
    ...(cgJob.correlationId ? { correlationId: cgJob.correlationId } : {}),
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
        // P0-6 — Traçabilité directe campagne → article.
        ...(cgJob.campaignId ? { campaignId: cgJob.campaignId } : {}),
        ...(directAnswer ? { directAnswer } : {}),
        ...(faqJson ? { faqJson: faqJson as never } : {}),
        templateVariant: cgJob.templateId ?? null,
        searchIntent: cgJob.targetSearchIntent,
        isNews,
        ...(isNews && rssSourceUrl ? { newsSourceUrl: rssSourceUrl } : {}),
        ...(isNews && rssSourceName ? { newsSourceName: rssSourceName } : {}),
        // Sprint S+2 City Domination — Phase C strat ville (hotfix audit
        // 2026-05-18). Sans ce spread, l'Article était inséré avec
        // mentioned_cities=[] (default Prisma) → hub ville getBlogArticlesByVille
        // retournait [] même pour villes explicitement mentionnées par le
        // generator (forceInclude=anchorVilleSlug landing-ville). Désormais
        // câblé : les villes extraites/forcées sont persistées en DB et
        // l'index GIN articles_mentioned_cities_idx permet le filter
        // performant côté hub ville.
        ...(mentionedCities.length > 0 ? { mentionedCities } : {}),
        // E7 (traçabilité AI-Act) — IDs des entrées KB injectées via kbRetrieve()
        // (source: GeneratorOutput.kbEntryIds). Default schema = [] si vide.
        ...(kbChunkIds.length > 0 ? { kbChunkIds } : {}),
        // B.6 P0-4 — Hero image image-bank (URL filePath ou null si pas de match).
        ...(heroImageFilePath ? { featuredImage: heroImageFilePath } : {}),
        // VIS-08 — Alt sémantique hero (FR ; EN miroir non requis, locale FR canonique).
        ...(heroImageAlt ? { featuredImageAltFr: heroImageAlt } : {}),
        // B.7 P0-6 — Outline SimHash (couche dedup 3, persiste pour future comparaison).
        ...(outlineSimhash ? { outlineSimhash } : {}),
        // #2 2026-06-14 — Fingerprint sémantique (dedup cross-entry topic).
        ...(topicFingerprint ? { topicFingerprint } : {}),
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

  // Sprint External Links Database 2026-05-22 — Validation + tracking usage.
  // Best-effort post-publish : NE BLOQUE PAS la publication même si validation échoue
  // (l'article est déjà inséré). Logge un warning + update needs_review pour Will.
  try {
    const rawSelectedIds = output["selectedExternalLinkIds"];
    const selectedIds: string[] = Array.isArray(rawSelectedIds)
      ? rawSelectedIds.filter((s): s is string => typeof s === "string" && s.length > 0)
      : [];

    const detection = detectHallucinations(bodyHtml);
    const externalLinkCount = detection.valid.length + detection.hallucinated.length;
    const hasEnoughExternalLinks = externalLinkCount >= 2;
    const noHallucinations = detection.hallucinated.length === 0;

    await logStep(
      cgJob.id,
      "external_links_validation",
      `External links : ${externalLinkCount} total (valid=${detection.valid.length}, halluciné=${detection.hallucinated.length})`,
      {
        external_link_count: externalLinkCount,
        valid_count: detection.valid.length,
        hallucinated_count: detection.hallucinated.length,
        selected_count: selectedIds.length,
        has_enough_external_links: hasEnoughExternalLinks,
        no_hallucinations: noHallucinations,
        hallucinated_sample: detection.hallucinated.slice(0, 5),
      },
    );

    // Tracking usage : on incrémente sur la base de l'union (IDs sélectionnés par
    // selectExternalLinks + IDs valides détectés dans le body). Si validation
    // partielle, on alimente la rotation tout de même (le lien a bien été cité).
    const linksToTrack = Array.from(new Set([...selectedIds, ...detection.valid]));
    if (linksToTrack.length > 0) {
      await trackExternalLinksUsage(linksToTrack);
    }
  } catch (err) {
    // Best-effort : on ne re-throw pas. Le worker continue.
    console.warn(
      "[publish] external_links_validation failed (non-blocking):",
      err instanceof Error ? err.message : String(err),
    );
  }

  // V-09 P6 2026-05-22 — Couche 4 dedup : embedding OpenAI text-embedding-3-large.
  // Best-effort post-publish : ne JAMAIS bloquer la publication sur cet appel.
  // Default OPENAI_EMBEDDINGS_ENABLED=false → no-op silent (zero cost).
  // Quand activé en prod, persiste articles.embedding (vector 1536) pour les
  // comparaisons cosine futures (similarity-monitor + dedup pre-publish v2).
  {
    const embeddingResult = await persistArticleEmbedding(prisma, {
      articleId: article.id,
      title,
      ...(metaDescription ? { metaDescription } : {}),
      ...(bodyText ? { bodyText } : {}),
    });
    await logStep(
      cgJob.id,
      "embedding_persist",
      embeddingResult.persisted
        ? `Embedding persisted (${embeddingResult.tokensUsed} tokens, ${embeddingResult.dimensions} dims)`
        : `Embedding skipped (${embeddingResult.reason})`,
      {
        persisted: embeddingResult.persisted,
        reason: embeddingResult.reason,
        ...(embeddingResult.tokensUsed !== undefined
          ? { tokens_used: embeddingResult.tokensUsed }
          : {}),
        ...(embeddingResult.dimensions !== undefined
          ? { dimensions: embeddingResult.dimensions }
          : {}),
      },
    );
  }

  // B.4 P1.5 — Log provenance LLM pour conformite AI Act art. 50.
  // Fire-and-forget : echec non-bloquant.
  {
    const totalCostUsd = typeof output.totalCostUsd === "number" ? output.totalCostUsd : 0;
    const totalTokens = typeof output.totalTokens === "number" ? output.totalTokens : 0;
    // Approximation input/output : LLM typique ~30% output / 70% input.
    const inputTokens = Math.round(totalTokens * 0.7);
    const outputTokens = totalTokens - inputTokens;
    const providerKey = typeof output.providerKey === "string" ? output.providerKey : "openai";
    const modelId = typeof output.modelId === "string" ? output.modelId : cgJob.contentType;
    // P0-3 AI Act art. 50 — Hash réel du prompt LLM (via GeneratorOutput.promptHash).
    // Fallback sur hash technique pour articles antérieurs au fix (rétrocompat).
    const rawPromptHash = (cgJob.outputJsonRaw as Record<string, unknown> | null)?.promptHash;
    const promptHash =
      typeof rawPromptHash === "string" && rawPromptHash.length === 64
        ? rawPromptHash
        : hashPrompt(`${cgJob.contentType}:${cgJob.id}:${article.id}`);
    await logProvenance({
      articleId: article.id,
      step: "publish",
      provider: providerKey,
      model: modelId,
      promptHash,
      inputTokens,
      outputTokens,
      cacheReadInputTokens: 0,
      costUsd: totalCostUsd,
    });
  }

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
  //
  // P0-10 — best-effort post-transaction : l'article est déjà en DB et publié.
  // Un échec de l'enqueue d'indexation NE doit PAS rollback ni masquer la publication.
  // On log via console.warn + logStepError pour visibilité sans blast radius.
  if (promoteToTier1) {
    try {
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[publish] enqueueIndexingForTier1 failed (best-effort) for article ${article.id}:`,
        msg,
      );
      await logStepError(
        cgJob.id,
        "indexnow_ping",
        `enqueueIndexingForTier1 failed (best-effort): ${msg}`,
        {
          article_id: article.id,
          slug: slugCandidate,
        },
      );
    }
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
  //
  // P0-10 — best-effort post-transaction : un échec revalidate NE doit PAS
  // masquer la publication. L'article reste publié et sera servi via ISR 1h
  // naturellement même si le revalidate échoue.
  // V-01 P1 revalidation cascade (suite Sprint Correctif P0 2026-05-22) — pour
  // chaque ville mentionnée dans l'article, invalide les caches ISR des 5 hubs
  // ville-spécifique qui affichent les articles factory via
  // `getBlogArticlesByVille()` (cf. implantations/[region]/[ville]/page.tsx et
  // VilleServicePageTemplate). Sans cette cascade, un article fraîchement
  // publié n'apparaît sur les hubs villes qu'après expiration ISR 24h.
  //
  // Note : import dynamique pour éviter de charger les ~2150 villes
  // au module-eval (ralentit les tests throttle qui mock le worker).
  const cityPaths: string[] = [];
  if (mentionedCities.length > 0) {
    const { getVille } = await import("@/content/villes");
    for (const citySlug of mentionedCities) {
      const ville = getVille(citySlug);
      if (!ville) continue;
      cityPaths.push(
        `/fr/implantations/${ville.region}/${ville.slug}`,
        `/fr/audit/par-ville/${ville.slug}`,
        `/fr/interventions/par-ville/${ville.slug}`,
        `/fr/implementation/par-ville/${ville.slug}`,
        `/fr/un-a-un/par-ville/${ville.slug}`,
      );
    }
  }

  const paths = [
    `/fr/blog/${slugCandidate}`,
    ...(isNews ? [`/fr/actualites/${slugCandidate}`, "/fr/actualites"] : []),
    "/fr/blog",
    "/sitemap.xml",
    "/sitemap-index.xml",
    ...(isNews ? ["/sitemap-news.xml"] : []),
    ...cityPaths,
  ];
  try {
    await revalidateContent({ paths });
    await logStep(cgJob.id, "revalidate_path", "Revalidate paths via internal API", {
      paths,
      city_cascade_count: cityPaths.length,
      mentioned_cities: mentionedCities,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[publish] revalidateContent failed (best-effort) for article ${article.id}:`,
      msg,
    );
    await logStepError(
      cgJob.id,
      "revalidate_path",
      `revalidateContent failed (best-effort): ${msg}`,
      {
        article_id: article.id,
        paths,
      },
    );
  }

  // Sprint Final P1-14 — Release global keyword lock Redis. Le lock a été
  // acquis par content-gen-worker juste avant l'appel LLM (Fl-08 multi-campagnes
  // parallèles). Best-effort : un échec release n'impacte pas la publication —
  // le TTL de 30 min garantit auto-expire de toute façon. Source du keyword :
  // outputJsonRaw.primaryKeyword (écrit par tous les generators), fallback sur
  // inputPayload.primaryKeyword (rétro-compat articles antérieurs).
  const keywordToRelease =
    typeof output["primaryKeyword"] === "string"
      ? (output["primaryKeyword"] as string)
      : primaryKeyword;
  if (keywordToRelease) {
    try {
      await releaseKeywordLock(keywordToRelease);
    } catch (err) {
      // releaseKeywordLock ne throw pas (catché en interne), mais double-safety.
      console.warn(
        `[publish] releaseKeywordLock failed (TTL will auto-expire) for "${keywordToRelease}":`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  await logStep(cgJob.id, "publish", "Publish pipeline complete", {
    article_id: article.id,
    tier: indexationTier,
    slug: slugCandidate,
    is_news: isNews,
    ...(keywordToRelease ? { keyword_lock_released: keywordToRelease } : {}),
  });
  console.log(
    `[publish] article ${article.id} published (tier=${indexationTier}, slug=${slugCandidate}, isNews=${isNews})`,
  );
}

/**
 * P1 fix audit content-gen 2026-06-05 (A-P1-03) — marque le ContentGenJob
 * `failed` quand le pipeline de publication échoue de façon inattendue.
 *
 * Avant ce patch, si la `$transaction` Article throwait (slug dupliqué, FK
 * manquant) ou si un throw survenait avant l'update final, le job restait
 * bloqué indéfiniment en `publishing` / `approved` (état fantôme compté « en
 * cours »), le handler BullMQ `failed` ne touchant jamais la DB.
 *
 * Garde-fou `updateMany` avec filtre de statut : on ne flippe QUE les états de
 * publication en cours → un job déjà `published` (race retry réussi) ou
 * `quarantined_*` n'est jamais écrasé. Un retry BullMQ ultérieur qui réussit
 * re-passe le job en `published` (transaction publish), donc l'état `failed`
 * est auto-réparant. Best-effort : un échec de ce marquage ne masque pas
 * l'erreur d'origine (re-throw conservé par l'appelant).
 *
 * Le ciblage se fait en UNE requête via la relation inverse `reviewQueue`
 * (pas de findUnique préalable) pour ne pas dupliquer la lecture déjà faite
 * par le pipeline.
 */
async function markPublishJobFailed(reviewQueueId: string, errMsg: string): Promise<void> {
  try {
    await prisma.contentGenJob.updateMany({
      where: {
        reviewQueue: { id: reviewQueueId },
        status: { in: ["approved", "publishing", "needs_review"] },
      },
      data: { status: "failed", errorMessage: errMsg.slice(0, 500) },
    });
  } catch (e) {
    console.warn(
      `[publish] could not mark job failed for review ${reviewQueueId}:`,
      e instanceof Error ? e.message : String(e),
    );
  }
}

/**
 * Wrapper de `runPublishPipeline` : tout échec inattendu marque le job `failed`
 * (cf. markPublishJobFailed) AVANT de re-throw, pour que BullMQ gère le
 * retry/backoff et déclenche le handler `failed` (Sentry + Telegram) comme
 * avant. Le throw `kill_switch_active` est volontaire (pause Will) → requeue
 * sans marquer `failed`.
 */
async function processJob(job: Job<PublishJobPayload>): Promise<void> {
  try {
    await runPublishPipeline(job);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg !== "kill_switch_active") {
      await markPublishJobFailed(job.data.reviewQueueId, errMsg);
    }
    throw err;
  }
}

let workerInstance: Worker<PublishJobPayload> | null = null;

export function startPublishWorker(): Worker<PublishJobPayload> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — publish-worker cannot start");
  workerInstance = new Worker<PublishJobPayload>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 3,
    lockDuration: 120_000, // évite stall → double-ping IndexNow si opération réseau lente
    limiter: { max: 20, duration: 60_000 }, // 20/min — Prisma serial safe
    // P2-23 audit indexation 2026-05-18 — bornage retention Redis :
    // garde 1000 jobs completed + 5000 jobs failed max (BullMQ purge auto).
    // Évite saturation Redis long-terme sur high-volume workers.
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-publish-worker] job ${job?.id} failed:`, err);
    // Sprint S+4-C (audit content-gen deep 2026-05-18 P1-7) — Sentry capture
    // additif à console.error + Telegram. Stack traces + tags + extras
    // PII-safe (sanitizeJobData) → fingerprint déterministe pour groupage
    // dashboard. NB : skip Sentry sur kill_switch_active (volontaire, pas un
    // bug — équivalent business pause par Will).
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg !== "kill_switch_active") {
      captureWorkerError("publish", QUEUE_NAME, job, err);
    }
    // P1-12 audit indexation 2026-05-15 — alerte Telegram sur publish failed.
    // Publish a le blast radius le plus élevé du pipeline content-gen (Article
    // inséré + IndexNow + ISR revalidate + fact-check enqueue). Avant ce patch,
    // un échec restait silencieux (console.error seul). Pattern aligné sur
    // content-gen-worker / content-orchestrator-worker.
    const reviewId =
      (job?.data as { readonly reviewQueueId?: string } | undefined)?.reviewQueueId ?? "?";
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

/**
 * Content Generator — BullMQ worker (Sprint 2 AGT-H).
 *
 * V1 = squelette. Pipeline (§ 13.1 master prompt + § 25.3) :
 *
 * 1. Job arrive sur queue `content-gen`
 * 2. Lookup ContentGenJob DB → status running
 * 3. Hard gate KB ready (kb-health.assertKbReady)
 * 4. Pre-IA dedup-guard check (4 couches v1.7)
 * 5. Resolve generator via getGenerator(contentType)
 * 6. Call generator.generate(input) → GeneratorOutput
 * 7. Post-process : Q/R extraction (enqueue 8 micro-jobs qa_extract_and_publish)
 * 8. Insert Article DB tier_2_noindex_follow par défaut (review-queue)
 * 9. Update ContentGenJob status → needs_review
 * 10. Publish Telegram alert (§ 12.3bis)
 *
 * Concurrency 5 par defaut (config DB ContentGenConfig.workers_concurrency).
 * Rate-limit 10/min (alignée OpenAI tier 5).
 */

import { Queue, Worker, type Job, UnrecoverableError } from "bullmq";
import { prisma } from "@/lib/prisma";
import { getGenerator } from "@/server/content-gen/generators";
import { assertKbReady, KbNotReadyError } from "@/server/content-gen/kb-health";
import { checkDedup } from "@/server/content-gen/quality/dedup-guard";
import { checkPlagiarism } from "@/server/content-gen/quality/plagiarism";
import { validateIntentAlignment } from "@/server/content-gen/quality/search-intent-validator";
import { checkDoctrine } from "@/server/content-gen/quality/doctrine-check";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import { logStep, logStepError } from "@/server/content-gen/shared/generation-log";
import {
  alertBatchFail,
  alertKbNotReady,
  alertNewReview,
} from "@/server/content-gen/shared/content-gen-alerts";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import type { ContentType, SearchIntent } from "../../../../prisma/generated/client";
// B.5 P1.5 — Rotation 747 keyword seeds.
import { selectKeyword, validateKeywordInTitle } from "@/server/content-gen/keyword-selector";
// B.6 P1.5 P0-4 — Assignment hero image depuis image-bank (read-only).
import { selectHeroImage } from "@/server/content-gen/images/select-hero-image";
// B.7 P1.5 P0-6 — Outline SimHash dedup (couche A.3 post-IA).
import { checkOutlineDedup } from "@/server/content-gen/quality/dedup-guard";
// #2 2026-06-14 — Dedup sémantique cross-entry (topic-fingerprint Voyage SimHash).
import {
  computeTopicFingerprint,
  classifyTopicDuplicate,
} from "@/server/content-gen/dedup/topic-fingerprint";
// Sprint Final P1-14 — Global keyword lock Redis (Fl-08 multi-campagnes parallèles).
import { acquireKeywordLock } from "@/server/content-gen/lib/keyword-lock";
// 2026-06-15 — Branche les ContentTemplate (console) au pipeline (override prompt).
import {
  resolveTemplateOverride,
  type TemplateOverride,
} from "@/server/content-gen/template-resolver";
import {
  resolveQualityProfile,
  QUALITY_PROFILE_GATES,
} from "@/server/content-gen/profiles/quality-profile-table";
import { evaluateBenefitConcreteness } from "@/server/content-gen/quality/benefit-concreteness-gate";
import { judgeBenefitConcreteness } from "@/server/content-gen/quality/benefit-judge-llm";
import {
  getSectorPainContext,
  type Secteur,
  type Verticale,
} from "@/server/content-gen/kb/sector-pain-matrix";
import { getVille, getRegionByDepartement } from "@/content/villes";

interface KillSwitchState {
  readonly active: boolean;
}

interface PoliciesConfig {
  readonly plagiarismJaccardInternal?: number;
  readonly plagiarismJaccardRss?: number;
  /** Score qualité minimum pour auto-publication RSS (§ 14.2 master prompt). */
  readonly rssAutoPublishMinScore?: number;
  /**
   * Audit indexation 2026-05-18 — auto-publish étendu blog_article + landing_ville.
   * Default false (safe). Active via admin policies pour scale 500/jour.
   */
  readonly factoryAutoPublishAllBlogTypes?: boolean;
  /**
   * Audit indexation 2026-05-18 — promotion tier-1 DIRECTE si score >= seuil.
   * Default 75. Articles factory >= 75 → publish direct tier_1_indexable
   * (sitemap immédiat + IndexNow + Google Indexing ping). 999 pour désactiver.
   */
  readonly factoryAutoPromoteTier1MinScore?: number;
}

interface QualityLoopConfig {
  readonly enabled?: boolean;
  readonly minScoreThreshold?: number;
  readonly maxAttemptsAuto?: number;
}

const RSS_AUTOPUBLISH_MIN_SCORE_DEFAULT = 60;
const QUALITY_LOOP_THRESHOLD_DEFAULT = 75;
const QUALITY_LOOP_MAX_ATTEMPTS_DEFAULT = 2;

const PLAGIARISM_CORPUS_SIZE = 50;
const PLAGIARISM_THRESHOLD_DEFAULT = 0.3;
const PLAGIARISM_THRESHOLD_RSS_DEFAULT = 0.1;

/**
 * Charge le corpus des derniers articles publiés (tier-1 + tier-2) pour
 * comparaison plagiarism shingling Jaccard. Limite hardcodée à 50 articles
 * pour cap latence (5-gram shingles × 50 articles ≈ 50ms en local).
 *
 * Doctrine § 10.1 master prompt — anti-plagiat 3 couches.
 */
async function loadPlagiarismCorpus(): Promise<Map<string, string>> {
  const rows = await prisma.article.findMany({
    where: {
      status: "published",
      indexationTier: { in: ["tier_1_indexable", "tier_2_noindex_follow"] },
    },
    orderBy: { publishedAt: "desc" },
    take: PLAGIARISM_CORPUS_SIZE,
    include: {
      translations: {
        where: { locale: "fr" },
        select: { slug: true, bodyText: true, body: true },
        take: 1,
      },
    },
  });
  const corpus = new Map<string, string>();
  for (const row of rows) {
    const tr = row.translations[0];
    if (!tr) continue;
    const text =
      tr.bodyText ??
      tr.body
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (text.length > 100) corpus.set(tr.slug, text);
  }
  return corpus;
}

class KillSwitchActiveError extends Error {
  constructor() {
    super("Kill switch content-gen actif — job requeue");
    this.name = "KillSwitchActiveError";
  }
}

const QUEUE_NAME = "content-gen";

let qualityImproverQueue: Queue | null = null;
function getQualityImproverQueue(): Queue | null {
  if (qualityImproverQueue) return qualityImproverQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  qualityImproverQueue = new Queue("content-quality-improver", {
    connection: { url: redisUrl },
  });
  return qualityImproverQueue;
}

let publishQueue: Queue | null = null;
function getPublishQueue(): Queue | null {
  if (publishQueue) return publishQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  publishQueue = new Queue("content-publish", { connection: { url: redisUrl } });
  return publishQueue;
}

export interface ContentGenJobPayload {
  readonly contentGenJobId: string;
  readonly contentType: ContentType;
  readonly targetSearchIntent: SearchIntent;
  readonly inputPayload: Record<string, unknown>;
  /**
   * B4 (CONTENT-GEN-UX 2026) — template explicitement choisi via le bouton
   * « Tester » de /templates/[id]. Présent → le worker applique CE template
   * précis (override par id) au lieu de résoudre par contentType+isActive.
   * Absent (campagnes, quick actions) → résolution par contentType (inchangé).
   */
  readonly templateId?: string;
}

/**
 * B4 (CONTENT-GEN-UX 2026) — Résout un ContentTemplate par son id exact (override
 * « Tester ce template »). Contrairement à `resolveTemplateOverride(contentType)`
 * (le plus récent ACTIF pour le type), on cible LE template demandé même s'il
 * n'est pas le plus récent / pas `isActive`. Garde-fou : on n'applique l'override
 * que si le template existe ET correspond au `contentType` du job (sécurité :
 * un prompt de type X ne doit pas piloter une génération de type Y).
 *
 * Fail-soft, miroir de `resolveTemplateOverride` : DB stub (build) / introuvable /
 * type incohérent / erreur → null → fallback prompt code (zéro régression).
 */
async function resolveTemplateById(
  templateId: string,
  contentType: ContentType,
): Promise<TemplateOverride | null> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return null;
  try {
    const tpl = await prisma.contentTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        contentType: true,
        systemPrompt: true,
        defaultTemperature: true,
        defaultMaxTokens: true,
      },
    });
    if (!tpl || tpl.contentType !== contentType) return null;
    const sp = tpl.systemPrompt?.trim();
    return {
      templateId: tpl.id,
      ...(sp ? { systemPrompt: sp } : {}),
      ...(tpl.defaultTemperature != null ? { temperature: Number(tpl.defaultTemperature) } : {}),
      ...(tpl.defaultMaxTokens != null ? { maxTokens: tpl.defaultMaxTokens } : {}),
    };
  } catch {
    return null;
  }
}

async function processJob(job: Job<ContentGenJobPayload>): Promise<void> {
  const { contentGenJobId, contentType, targetSearchIntent, inputPayload } = job.data;
  // B4 (CONTENT-GEN-UX 2026) — template explicitement testé : payload BullMQ en
  // priorité, sinon `ContentGenJob.templateId` (persisté par enqueueDirectGen).
  const explicitTemplateId = job.data.templateId;

  // 0. Kill switch hard-gate (§ 12 master prompt) — checked AVANT lookup DB
  // pour économiser les queries quand le switch est ON. Le worker BullMQ
  // requeue le job avec backoff exponentiel quand on throw — pas de fail.
  const killSwitch = await readContentGenConfig<KillSwitchState>("kill_switch", {
    active: false,
  });
  if (killSwitch.active) {
    await logStep(contentGenJobId, "kill_switch_check", "Kill switch active — job requeued");
    throw new KillSwitchActiveError();
  }

  // 1. Lookup ContentGenJob DB
  const dbJob = await prisma.contentGenJob.findUnique({ where: { id: contentGenJobId } });
  if (!dbJob) {
    // Pas de retry sur job introuvable — UnrecoverableError marque le job fail
    // sans backoff inutile.
    throw new UnrecoverableError(`ContentGenJob ${contentGenJobId} not found`);
  }
  // Sprint A-suite P6 — Item 3. Log correlationId pour traçabilité end-to-end.
  if (dbJob.correlationId) {
    console.log("[gen] correlationId=", dbJob.correlationId, "jobId=", contentGenJobId);
  }
  await logStep(contentGenJobId, "kb_retrieve", "Job found, starting pipeline", {
    contentType,
    targetSearchIntent,
    ...(dbJob.correlationId ? { correlationId: dbJob.correlationId } : {}),
  });

  // 2. Hard gate KB ready
  try {
    await assertKbReady();
  } catch (err) {
    if (err instanceof KbNotReadyError) {
      await logStepError(contentGenJobId, "kb_retrieve", err.message);
      await prisma.contentGenJob.update({
        where: { id: contentGenJobId },
        data: { status: "failed", errorMessage: err.message },
      });
      // P1-17 fix audit opérationnel : alerte Telegram KB pas prête.
      // Champs minChunks/canonicalRatio approximatifs (audit/log précis dans
      // generationLog). Throttle implicite côté Telegram (rate-limit BullMQ).
      void alertKbNotReady(0, 50, 0).catch(() => undefined);
      return;
    }
    throw err;
  }

  // 3. Status → running + dedup pre-IA
  await prisma.contentGenJob.update({
    where: { id: contentGenJobId },
    data: { status: "running", startedAt: new Date() },
  });

  const title = typeof inputPayload["title"] === "string" ? inputPayload["title"] : "";
  if (title) {
    const dedup = await checkDedup({
      title,
      ...(typeof inputPayload["primaryKeyword"] === "string"
        ? { primaryKeyword: inputPayload["primaryKeyword"] }
        : {}),
      ...(dbJob.anchorVilleSlug ? { anchorVilleSlug: dbJob.anchorVilleSlug } : {}),
      ...(dbJob.targetAudienceSize ? { targetAudienceSize: dbJob.targetAudienceSize } : {}),
      ...(dbJob.targetAudienceOrganisation
        ? { targetAudienceOrganisation: dbJob.targetAudienceOrganisation }
        : {}),
    });
    if (!dedup.passed) {
      await logStep(contentGenJobId, "dedup_check", `Dedup blocked: ${dedup.reason ?? "unknown"}`, {
        reason: dedup.reason,
      });
      await prisma.contentGenJob.update({
        where: { id: contentGenJobId },
        data: {
          status: "cancelled",
          errorMessage: `Dedup pre-IA: ${dedup.reason ?? "unknown"}`,
        },
      });
      return;
    }
    await logStep(contentGenJobId, "dedup_check", "Dedup passed");
  }

  // 4. Resolve generator + generate
  const generator = getGenerator(contentType);
  try {
    // B.5 P1.5 — Si aucun primaryKeyword dans le payload, selectionner depuis
    // les seeds (rotation equitable lastUsedAt ASC, fallback in-memory 747 seeds).
    // Applicable pour blog_article, blog_from_keywords, guide_pilier, landing_ville.
    let resolvedKeyword: string | undefined =
      typeof inputPayload["primaryKeyword"] === "string"
        ? inputPayload["primaryKeyword"]
        : undefined;
    if (!resolvedKeyword && contentType !== "blog_from_rss") {
      // P1 2026-06-13 — Fix bug : le vertical était lu sur un champ INEXISTANT
      // (`dbJob.campaignSector` via cast) → toujours "transversal", donc les
      // pools par vertical (audits/formations/…) n'étaient jamais ciblés. On le
      // dérive désormais du `serviceSector` de la campagne (CoverageCampaign).
      let campaignSector = "transversal";
      // Multi-axes (2026-06-21) — l'activité peut être échantillonnée PAR JOB
      // (axe 2) et portée par inputPayload.vertical. On la préfère au singleton
      // serviceSector de la campagne (qui reste le fallback rétro-compat).
      if (typeof inputPayload["vertical"] === "string") {
        campaignSector = inputPayload["vertical"];
      } else if (dbJob.campaignId) {
        const campaign = await prisma.coverageCampaign.findUnique({
          where: { id: dbJob.campaignId },
          select: { serviceSector: true },
        });
        if (campaign?.serviceSector) campaignSector = campaign.serviceSector;
      }
      // P1-3 (audit content-gen 2026-06-15) — Mode géo du keyword-selector.
      // Si le job est ancré sur une ville (campagne ville-anchored,
      // `anchorVilleSlug`), on fournit un CityRef au selector → il génère un
      // keyword GÉO ("<vertical> IA <ville/région>") via keyword-templates au
      // lieu d'un keyword transversal. Avant, `anchorVilleSlug` n'était JAMAIS
      // passé à selectKeyword → le mode géo (pourtant implémenté) restait inerte.
      const anchorVille = dbJob.anchorVilleSlug ? getVille(dbJob.anchorVilleSlug) : undefined;
      const cityRef = anchorVille
        ? {
            name: anchorVille.nameFr,
            regionName:
              getRegionByDepartement(anchorVille.departement)?.nameFr ?? anchorVille.region,
            departmentName: anchorVille.departementLabel ?? anchorVille.departement,
            inseeCode: anchorVille.inseeCode,
          }
        : undefined;
      // P1-8 — Passer campaignId pour log structuré keyword_select_exhausted
      // et préparer l'isolation future des pools par campagne.
      // Note: spread conditionnel requis (exactOptionalPropertyTypes: true).
      const selected = await selectKeyword({
        vertical: campaignSector,
        contentType,
        ...(cityRef ? { city: cityRef } : {}),
        ...(dbJob.campaignId ? { campaignId: dbJob.campaignId } : {}),
      });
      if (selected) {
        resolvedKeyword = selected;
        await logStep(contentGenJobId, "keyword_select", `Keyword selected: ${selected}`, {
          vertical: campaignSector,
          source: "keyword-selector",
        });
      }
    }

    // Sprint Final P1-14 — Global keyword lock Redis (Fl-08 multi-campagnes
    // parallèles). Audit final 23/25 — défense N+1 vs keyword-selector DB lock.
    // Évite que 3 campagnes parallèles avec un keyword commun (ex: blog-from-
    // title forçant `primaryKeyword="formation IA Paris"`) publient en double.
    // TTL 30 min = couvre gen + judge + improve + publish (typique 5-15 min).
    // Released par content-publish-worker. Auto-release via TTL si crash.
    // Stub-aware build SSG : acquire=true no-op.
    if (resolvedKeyword) {
      const locked = await acquireKeywordLock(resolvedKeyword);
      if (!locked) {
        await logStep(
          contentGenJobId,
          "keyword_lock",
          `Keyword "${resolvedKeyword}" en cours de génération par un autre worker — skip`,
          {
            keyword: resolvedKeyword,
            campaign_id: dbJob.campaignId ?? null,
            reason: "global_keyword_lock_held",
          },
        );
        // Job complété sans publication. Le keyword sera ré-éligible après
        // expiration du lock (30 min max). Le keyword-selector le repassera
        // naturellement via rotation `last_used_at ASC`. Pas d'erreur thrown :
        // le job est marqué cancelled (pas failed) pour éviter pollution
        // métriques "batch fail" Telegram (alertBatchFail).
        await prisma.contentGenJob.update({
          where: { id: contentGenJobId },
          data: {
            status: "cancelled",
            errorMessage: `Keyword lock held by another worker (concurrent campaign): ${resolvedKeyword}`,
            completedAt: new Date(),
          },
        });
        return;
      }
      await logStep(contentGenJobId, "keyword_lock", `Keyword lock acquired: ${resolvedKeyword}`, {
        keyword: resolvedKeyword,
        ttl_sec: 1800,
      });
    }

    // BUG-4 — Feedback LLM-judge : si c'est une re-génération (quality-improver
    // a persisté outputJsonRaw.judgeIssues), on l'injecte comme
    // improvementFeedback pour que le generator ré-oriente le prompt.
    const prevOutput = dbJob.outputJsonRaw as Record<string, unknown> | null;
    const improvementFeedback =
      prevOutput && typeof prevOutput["judgeIssues"] === "string"
        ? prevOutput["judgeIssues"]
        : undefined;

    // Phase A BUG-5 — Métadonnées RSS pour blog_from_rss : extraites de
    // inputPayload (rempli par content-rss-fetch-worker) et passées au
    // generator pour forcer la citation source et le ton actualité.
    const rssSourceName =
      contentType === "blog_from_rss" && typeof inputPayload["rssSourceName"] === "string"
        ? inputPayload["rssSourceName"]
        : undefined;
    const rssItemTitle =
      contentType === "blog_from_rss" && typeof inputPayload["rssTitle"] === "string"
        ? inputPayload["rssTitle"]
        : undefined;
    const rssItemSummary =
      contentType === "blog_from_rss" &&
      typeof (inputPayload["rssContent"] ?? inputPayload["rssDescription"]) === "string"
        ? String(inputPayload["rssContent"] ?? inputPayload["rssDescription"])
        : undefined;
    const rssItemLink =
      contentType === "blog_from_rss" && typeof inputPayload["rssLink"] === "string"
        ? inputPayload["rssLink"]
        : undefined;

    // 2026-06-15 — Résout un éventuel ContentTemplate (éditable console
    // /content-gen/templates) pour ce contentType. Présent → override prompt ;
    // absent / DB indispo → null → fallback prompt code (zéro régression).
    //
    // B4 (CONTENT-GEN-UX 2026) — OVERRIDE PAR ID. Si le job référence un template
    // précis (`templateId` du payload BullMQ, sinon `dbJob.templateId` persisté
    // par enqueueDirectGen) — typiquement le bouton « Tester » de /templates/[id]
    // — on résout CE template précis (même s'il n'est pas le plus récent / pas
    // `isActive`), pour que « Tester » teste bien le template affiché. Sinon
    // (campagnes, quick actions) → résolution par contentType+isActive (inchangé).
    const targetTemplateId = explicitTemplateId ?? dbJob.templateId ?? undefined;
    const templateOverride = targetTemplateId
      ? await resolveTemplateById(targetTemplateId, contentType)
      : await resolveTemplateOverride(contentType);
    if (templateOverride) {
      await logStep(contentGenJobId, "llm_call", "Template DB appliqué (override prompt)", {
        template_id: templateOverride.templateId,
        has_system_prompt: Boolean(templateOverride.systemPrompt),
        resolved_by: targetTemplateId ? "explicit_id" : "content_type",
      });
    }

    const startedAt = Date.now();
    const output = await generator.generate({
      jobId: contentGenJobId,
      contentType,
      targetSearchIntent,
      ...(templateOverride ? { templateOverride } : {}),
      ...(dbJob.anchorVilleSlug ? { anchorVilleSlug: dbJob.anchorVilleSlug } : {}),
      ...(dbJob.anchorDepartementCode
        ? { anchorDepartementCode: dbJob.anchorDepartementCode }
        : {}),
      ...(dbJob.anchorRegionSlug ? { anchorRegionSlug: dbJob.anchorRegionSlug } : {}),
      // PH3b — secteur/vertical (pain-matrix), injectés par une campagne pilote
      // via inputPayload. Absents = pas de contexte douleur (augmentation no-op).
      ...(typeof inputPayload["targetSecteur"] === "string"
        ? { targetSecteur: inputPayload["targetSecteur"] }
        : {}),
      ...(typeof inputPayload["vertical"] === "string"
        ? { vertical: inputPayload["vertical"] }
        : {}),
      ...(dbJob.targetAudienceSize ? { targetAudienceSize: dbJob.targetAudienceSize } : {}),
      ...(dbJob.targetAudienceOrganisation
        ? { targetAudienceOrganisation: dbJob.targetAudienceOrganisation }
        : {}),
      ...(resolvedKeyword ? { primaryKeyword: resolvedKeyword } : {}),
      ...(improvementFeedback ? { improvementFeedback } : {}),
      ...(rssSourceName ? { rssSourceName } : {}),
      ...(rssItemTitle ? { rssItemTitle } : {}),
      ...(rssItemSummary ? { rssItemSummary } : {}),
      ...(rssItemLink ? { rssItemLink } : {}),
    });

    // B.5 — Validation keyword dans le titre (warning si absent, pas de blocage).
    if (resolvedKeyword && output.title) {
      const kwInTitle = validateKeywordInTitle(output.title, resolvedKeyword);
      if (!kwInTitle) {
        await logStep(
          contentGenJobId,
          "keyword_validation",
          `Keyword absent du titre (non-bloquant): "${resolvedKeyword}"`,
          { keyword: resolvedKeyword, title: output.title },
        );
      }
    }

    // B.6 P0-4 — Assignment hero image depuis image-bank (doctrine 0 IA generative).
    // Pour blog_from_rss, on conserve la hero image RSS si presente (heroImageUrl).
    // Pour les autres contentTypes, on selectionne dans l'image-bank par module/city/keyword.
    const heroFromRss = contentType === "blog_from_rss" && Boolean(output.heroImage);
    // D1 fix (2026-06-15) — `campaignSector` n'existe PAS sur ContentGenJob : le
    // cast ci-dessous renvoyait TOUJOURS undefined → la hero était sélectionnée
    // sans vertical (mauvais ciblage image-bank). On dérive le vertical du
    // `serviceSector` de la campagne, comme le fait déjà la sélection keyword.
    const campaignSectorForHero = dbJob.campaignId
      ? ((
          await prisma.coverageCampaign.findUnique({
            where: { id: dbJob.campaignId },
            select: { serviceSector: true },
          })
        )?.serviceSector ?? undefined)
      : undefined;
    const hero =
      heroFromRss || !resolvedKeyword
        ? null
        : await selectHeroImage({
            jobId: contentGenJobId,
            contentType,
            ...(campaignSectorForHero ? { vertical: campaignSectorForHero } : {}),
            primaryKeyword: resolvedKeyword,
            ...(dbJob.anchorVilleSlug ? { anchorVilleSlug: dbJob.anchorVilleSlug } : {}),
            ...(dbJob.anchorRegionSlug ? { anchorRegionSlug: dbJob.anchorRegionSlug } : {}),
          });
    if (hero) {
      await logStep(contentGenJobId, "hero_image_assigned", `Hero image (${hero.source})`, {
        source: hero.source,
        asset_id: hero.assetId,
        photographer: hero.photographerName,
      });
    } else if (!heroFromRss) {
      await logStep(
        contentGenJobId,
        "hero_image_pending",
        "Aucune image-bank match — Article.featuredImage restera null (Will assigne via admin)",
        { vertical: campaignSectorForHero ?? null },
      );
    }

    await logStep(contentGenJobId, "llm_call", "Generator output ready", {
      duration_ms: Date.now() - startedAt,
      quality_score: output.qualityScore,
      seo_score: output.seoScore,
      readability_score: output.readabilityScore,
      total_tokens: output.totalTokens,
      total_cost_usd: output.totalCostUsd,
    });

    // 4bis. Anti-plagiarism shingling Jaccard (§ 10.1 master prompt v1.7).
    // Comparaison vs top 50 articles publiés récents. Seuils DB-managed via
    // ContentGenConfig.policies (plagiat 0.30 interne / 0.10 RSS).
    const policies = await readContentGenConfig<PoliciesConfig>("policies", {});
    const plagiarismThreshold =
      contentType === "blog_from_rss"
        ? (policies.plagiarismJaccardRss ?? PLAGIARISM_THRESHOLD_RSS_DEFAULT)
        : (policies.plagiarismJaccardInternal ?? PLAGIARISM_THRESHOLD_DEFAULT);
    const corpus = await loadPlagiarismCorpus();
    const plagiarism = checkPlagiarism(output.bodyText, corpus, plagiarismThreshold);
    await logStep(
      contentGenJobId,
      "plagiarism_check",
      plagiarism.passed
        ? `Plagiarism OK (max=${plagiarism.maxSimilarity.toFixed(3)} < ${plagiarismThreshold})`
        : `Plagiarism BLOCKED (max=${plagiarism.maxSimilarity.toFixed(3)} ≥ ${plagiarismThreshold})`,
      {
        max_similarity: plagiarism.maxSimilarity,
        threshold: plagiarismThreshold,
        passed: plagiarism.passed,
        top_matches: plagiarism.topMatches.map((m) => ({
          corpus_id: m.corpusId,
          similarity: m.similarity,
        })),
        corpus_size: corpus.size,
      },
    );

    // 4ter. Intent alignment validator (§ 26.3 master prompt v1.7).
    // hardFails downgrade tier → tier_3_noindex_nofollow. Warnings = info only.
    const intent = validateIntentAlignment({
      intent: targetSearchIntent,
      slug: output.slug,
      title: output.title,
      metaDescription: output.metaDescription,
      bodyHtml: output.bodyHtml,
      hasLocalBusinessJsonLd: targetSearchIntent === "local" && Boolean(dbJob.anchorVilleSlug),
      hasGeoMeta: Boolean(dbJob.anchorVilleSlug || dbJob.anchorRegionSlug),
      hasComparisonTable: /<table[\s>]/i.test(output.bodyHtml),
      hasPrimaryCta: /(href=["'][^"']*reserver|<button|cta-primary)/i.test(output.bodyHtml),
      // CORRECTIF 2026-06-20 — le tableau `output.citations` n'est rempli que si
      // le LLM remplit explicitement le champ JSON `citations` (quasi jamais), ce
      // qui faisait échouer le hard-gate « Intent informational sans citations »
      // ALORS QUE le body contient bien ≥4 liens d'autorité injectés par
      // `appendSourcesSection`/`injectExternalLinks` → demote tier_3_noindex +
      // needs_review à tort. On prend le max avec le nombre RÉEL de liens externes
      // présents dans le body rendu (aligné avec le scorer SEO + le commentaire du
      // validator « max(citationCount, liens externes) »).
      citationCount: Math.max(
        output.citations.length,
        (output.bodyHtml.match(/<a\b[^>]*href=["']https?:\/\//gi) ?? []).length,
      ),
    });
    await logStep(
      contentGenJobId,
      "intent_check",
      intent.aligned
        ? `Intent aligned (${intent.warnings.length} warnings)`
        : `Intent MISALIGNED (${intent.hardFails.length} hardFails)`,
      {
        aligned: intent.aligned,
        intent: targetSearchIntent,
        warnings: intent.warnings,
        hard_fails: intent.hardFails,
      },
    );

    // B.7 P0-6 — Couche A.3 outline SimHash dedup (post-IA pre-publish).
    // Compare outline (sequence h2/h3) vs corpus 1000 derniers publies sur 365j.
    // Verdict duplicate_template (Hamming <= 4) → flag pour review humain
    // (downgrade tier_3 + status pending). Similar (5-8) → publish OK + log warn.
    const outlineDedup = await checkOutlineDedup({ bodyHtml: output.bodyHtml });
    await logStep(
      contentGenJobId,
      "dedup_check",
      outlineDedup.verdict === "duplicate_template"
        ? `Outline DUPLICATE (Hamming ${outlineDedup.minDistance} vs ${outlineDedup.matchedArticleId})`
        : `Outline ${outlineDedup.verdict} (Hamming ${outlineDedup.minDistance})`,
      {
        verdict: outlineDedup.verdict,
        outline_simhash: outlineDedup.outlineSimhash,
        min_distance: outlineDedup.minDistance,
        matched_article_id: outlineDedup.matchedArticleId,
      },
    );
    const outlineBlockingFail = outlineDedup.verdict === "duplicate_template";

    // P0 2026-06-13 (décision Will) — Gate « fautes DURES » : un contenu avec une
    // donnée fausse ne doit PAS être publié (même en noindex), car une donnée
    // fausse indexée érode la confiance SEO du domaine entier. On RETIENT
    // l'article pour correction humaine (needs_review) au lieu de le publier.
    //
    // Fautes dures retenues :
    //   - SIREN/SIRET/RCS : un identifiant légal inventé est un problème de
    //     conformité/confiance (le vrai n'est qu'un placeholder). Quasi zéro
    //     faux-positif (9/14 chiffres consécutifs en prose = rare).
    //   - Prix non-SSOT : DÉSACTIVÉ par défaut (`hard_fault_gate.retainNonSsotPrice`)
    //     car `findNonSsotPrices` extrait le chiffre de TOUT montant € (ex.
    //     « 35 millions d'euros » → 35), omniprésent en contenu RGPD/AI Act →
    //     faux-positifs massifs. Ces prix restent en tier_3 noindex (non publié
    //     à l'index) via le generator. Flippable par Will si besoin.
    // Les autres écarts doctrine (naming, ratio, hype) gardent le comportement
    // actuel (downgrade tier, publication normale).
    const hardFaultGate = await readContentGenConfig<{ retainNonSsotPrice?: boolean }>(
      "hard_fault_gate",
      {},
    );
    const doctrine = await checkDoctrine(output.bodyText);
    const doctrineHardFaults = doctrine.blockingViolations.filter(
      (v) =>
        v.pattern === "SIREN/SIRET/RCS" ||
        (hardFaultGate.retainNonSsotPrice === true && v.pattern.startsWith("prix-non-SSOT:")),
    );
    const doctrineHardFail = doctrineHardFaults.length > 0;
    await logStep(
      contentGenJobId,
      "doctrine_check",
      doctrineHardFail
        ? `Doctrine HARD FAULT → retenu pour correction : ${doctrineHardFaults.map((v) => v.pattern).join(", ")}`
        : "Doctrine hard-fault OK (SIREN/prix)",
      { hard_fault: doctrineHardFail, faults: doctrineHardFaults.map((v) => v.pattern) },
    );

    // #2 2026-06-14 — Dedup SÉMANTIQUE cross-entry (topic-fingerprint Voyage).
    // Détecte la redondance THÉMATIQUE (même sujet, mots différents) que le
    // plagiat lexical Jaccard rate — notamment 2 sources RSS couvrant le même
    // événement, rédigées différemment. Fail-soft : sans clé Voyage / embedding
    // stub / erreur réseau → fingerprint null → aucun blocage (zéro régression).
    // Comparé aux 300 derniers articles publiés porteurs d'un fingerprint.
    const topicText = `${output.title}\n\n${output.bodyText}`.slice(0, 4000);
    const topicFingerprint = await computeTopicFingerprint(topicText);
    let topicDuplicateFail = false;
    if (topicFingerprint) {
      const recentFp = await prisma.article.findMany({
        where: {
          status: "published",
          topicFingerprint: { not: null },
          NOT: { generatedByJobId: contentGenJobId },
        },
        orderBy: { publishedAt: "desc" },
        take: 300,
        select: { topicFingerprint: true },
      });
      const fpCorpus = recentFp
        .map((r) => r.topicFingerprint)
        .filter((f): f is string => typeof f === "string");
      const topicVerdict = classifyTopicDuplicate(topicFingerprint, fpCorpus);
      topicDuplicateFail = topicVerdict.verdict === "duplicate";
      await logStep(
        contentGenJobId,
        "dedup_check",
        `Topic-fingerprint ${topicVerdict.verdict} (Hamming ${topicVerdict.minDistance})`,
        { verdict: topicVerdict.verdict, min_distance: topicVerdict.minDistance },
      );
    }

    // PH1+PH2 (plan §2/§4) — Profil qualité + benefit-gate COMMERCIAL-ONLY.
    // DORMANT par défaut : flag `QUALITY_PROFILES_ENABLED` (profil) + config
    // `benefit_gate.enabled` (gate). Les 2 OFF ⇒ qualityProfile=null ⇒ AUCUNE
    // lecture config supplémentaire ⇒ benefitFail=false ⇒ blockingFail bit-à-bit
    // identique à l'actuel. Calculé AVANT blockingFail car le benefit-gate en est
    // un membre conditionnel.
    const qualityProfile =
      process.env.QUALITY_PROFILES_ENABLED === "true"
        ? resolveQualityProfile(contentType, targetSearchIntent)
        : null;
    // Config gate lue UNIQUEMENT pour le profil commercial (zéro surcoût sinon).
    const benefitGateConfig =
      qualityProfile === "commercial"
        ? await readContentGenConfig<{ enabled: boolean; minScore?: number; llmJudge?: boolean }>(
            "benefit_gate",
            { enabled: false },
          )
        : { enabled: false, minScore: undefined as number | undefined, llmJudge: false };
    // PH2 — benefit-concreteness UNIQUEMENT commercial + gate ON. fail-open : un
    // score faible ne bloque QUE s'il a été évalué (le corpus informationnel/AEO
    // n'est jamais évalué → jamais désindexé).
    const benefitGateActive = qualityProfile === "commercial" && benefitGateConfig.enabled === true;
    const benefit = benefitGateActive ? evaluateBenefitConcreteness(output.bodyText) : null;
    const benefitMin =
      benefitGateConfig.minScore ?? QUALITY_PROFILE_GATES.commercial.benefitMin ?? 70;
    // PH3 — juge LLM COST-TRACKÉ (provider-router), DORMANT : seulement si benefit
    // évalué (commercial + gate ON) ET flag `benefit_gate.llmJudge` ON ET un
    // sectorPainContext résolu (pain-matrix) depuis le job (targetSecteur + vertical
    // que le pilote injecte). fail-open : juge null (skip/erreur réseau) → ignoré.
    const painCtx =
      benefit !== null &&
      benefitGateConfig.llmJudge === true &&
      typeof inputPayload["targetSecteur"] === "string" &&
      typeof inputPayload["vertical"] === "string"
        ? getSectorPainContext(
            inputPayload["targetSecteur"] as Secteur,
            inputPayload["vertical"] as Verticale,
          )
        : undefined;
    const benefitJudge = painCtx
      ? await judgeBenefitConcreteness({
          content: output.bodyText,
          context: {
            painStatement: painCtx.painStatement,
            benefitMeasured: painCtx.benefitMeasured,
            sectorLexicon: painCtx.sectorLexicon,
          },
          jobId: contentGenJobId,
          contentType,
        })
      : null;
    const benefitFail =
      benefit !== null &&
      (benefit.score < benefitMin || (benefitJudge !== null && !benefitJudge.passed));
    if (qualityProfile) {
      await logStep(contentGenJobId, "validation", `Quality profile: ${qualityProfile}`, {
        quality_profile: qualityProfile,
        content_type: contentType,
        search_intent: targetSearchIntent,
        benefit_gate_active: benefitGateActive,
        benefit_score: benefit?.score ?? null,
        benefit_fail: benefitFail,
      });
    }

    // Tier final : downgrade tier_3 si plagiat OR intent hardFails OR outline dup
    // OR faute dure doctrine OR doublon sémantique OR benefit-gate (commercial).
    // Sinon indexationTier generator.
    const blockingFail =
      !plagiarism.passed ||
      !intent.aligned ||
      outlineBlockingFail ||
      doctrineHardFail ||
      topicDuplicateFail ||
      benefitFail;
    const finalIndexationTier = blockingFail ? "tier_3_noindex_nofollow" : output.indexationTier;

    // 5. Update job + persist outputs (Sprint 2 Day 5 — Article DB row insert).
    // `outputJsonRaw` est la source de vérité que `content-publish-worker.ts`
    // lit pour créer la row Article. Sans ça, la publication throwait
    // « ContentGenJob has no outputJsonRaw » en prod.
    const persistedOutput = {
      ...output,
      // PH1/PH2 dormant : présents UNIQUEMENT si flag(s) ON (sinon clés ABSENTES
      // ⇒ persistedOutput bit-à-bit identique à l'actuel). `qualityProfile` et le
      // calcul benefit sont résolus plus haut (avant blockingFail).
      ...(qualityProfile ? { qualityProfile } : {}),
      ...(benefit ? { benefitConcretenessScore: benefit.score } : {}),
      finalIndexationTier,
      intentAligned: intent.aligned,
      intentWarnings: intent.warnings,
      intentHardFails: intent.hardFails,
      plagiarismMaxSimilarity: plagiarism.maxSimilarity,
      plagiarismThreshold,
      plagiarismCorpusSize: corpus.size,
      // Hero image — Unsplash primaire (Option A 2026-06-16) ou image-bank fallback.
      // content-publish-worker lit ces champs et les persiste dans Article.featuredImage
      // + featuredImagePhotographerName/Url (attribution CGU §6, Unsplash uniquement).
      heroImageAssetId: hero?.assetId ?? null,
      heroImageFilePath: hero?.url ?? null,
      heroImageAlt: hero?.alt ?? null,
      heroImageSource: hero?.source ?? null,
      heroImagePhotographerName: hero?.photographerName ?? null,
      heroImagePhotographerUrl: hero?.photographerUrl ?? null,
      // B.7 P0-6 — Outline SimHash + verdict dedup.
      outlineSimhash: outlineDedup.outlineSimhash,
      outlineDedupVerdict: outlineDedup.verdict,
      outlineDedupMatchedArticleId: outlineDedup.matchedArticleId,
      // #2 2026-06-14 — Fingerprint sémantique (persisté sur Article au publish
      // pour alimenter la dedup cross-entry des prochaines générations).
      topicFingerprint,
      // P0 2026-06-13 — Traçabilité des fautes dures (SIREN/prix non-SSOT) ayant
      // retenu l'article pour correction humaine.
      doctrineHardFaults: doctrineHardFaults.map((v) => ({
        pattern: v.pattern,
        reason: v.reason,
      })),
    };

    // 5bis. Décision orchestration post-gen (§ 14 + § 27 + § 14.2 master prompt) :
    //   - Boucle qualité (§ 27) : si score < seuil ET quality_loop.enabled ET
    //     attempts < maxAttemptsAuto → bascule `quality_improving` + enqueue
    //     worker dédié (re-prompt sections faibles). Skip auto-pub + skip review.
    //   - Auto-pub RSS (§ 14.2) : si contentType=blog_from_rss ET autoPublish
    //     ET score ≥ rssAutoPublishMinScore ET pas blockingFail → ReviewQueue
    //     direct en `approved` + enqueue content-publish (tier-2 noindex).
    //   - Sinon (cas par défaut) → `needs_review` + ReviewQueue.pending pour
    //     validation humaine Will.
    const qualityLoop = await readContentGenConfig<QualityLoopConfig>("quality_loop", {});
    const qualityLoopEnabled = qualityLoop.enabled !== false; // default ON
    const qualityThreshold = qualityLoop.minScoreThreshold ?? QUALITY_LOOP_THRESHOLD_DEFAULT;
    const qualityMaxAttempts = qualityLoop.maxAttemptsAuto ?? QUALITY_LOOP_MAX_ATTEMPTS_DEFAULT;
    const score = output.qualityScore ?? 0;
    const eligibleQualityLoop =
      qualityLoopEnabled &&
      !blockingFail &&
      score > 0 &&
      score < qualityThreshold &&
      dbJob.qualityImprovementAttempts < qualityMaxAttempts;

    const rssAutoPublishMinScore =
      policies.rssAutoPublishMinScore ?? RSS_AUTOPUBLISH_MIN_SCORE_DEFAULT;
    const rssAutoPublishRequested =
      contentType === "blog_from_rss" &&
      inputPayload["autoPublish"] === true &&
      !blockingFail &&
      score >= rssAutoPublishMinScore;

    // 2026-06-14 (décision Will « full auto ») — Publication automatique de TOUS
    // les types de contenu, sans relecture humaine, dès lors que la policy
    // `factoryAutoPublishAllBlogTypes` n'est pas explicitement désactivée
    // (défaut TRUE désormais). La policy EST l'opt-in (pas besoin du flag
    // autoPublish dans le payload). Les blocages DURS de doctrine (`blockingFail`)
    // divergent vers needs_review.
    //
    // P1-1 (audit content-gen 2026-06-15) — PLANCHER DE QUALITÉ. L'auto-publish
    // exige désormais `score >= qualityThreshold` (même seuil que la boucle
    // qualité, 60 par défaut). Sans ce plancher, deux trous laissaient passer du
    // contenu faible/indexable sans relecture :
    //   (a) `score === 0` (scorer raté/absent) : NON éligible à la boucle
    //       (qui exige score>0) → était auto-publié tel quel.
    //   (b) `0 < score < seuil` mais boucle épuisée (attempts ≥ max) : idem.
    // Ce plancher est ALIGNÉ avec l'intention de Will (« la boucle améliore
    // d'abord les contenus faibles ») : un contenu encore faible après la boucle
    // (ou non scoré) part en needs_review au lieu d'être indexé. Les contenus
    // ≥ seuil restent en full-auto (throughput préservé). RSS garde son propre
    // plancher `rssAutoPublishMinScore` (75).
    const fullAutoPublishEnabled = policies.factoryAutoPublishAllBlogTypes !== false;
    const fullAutoPublishRequested =
      fullAutoPublishEnabled && !blockingFail && score >= qualityThreshold;

    let nextStatus: "quality_improving" | "approved" | "needs_review" = "needs_review";
    if (eligibleQualityLoop) nextStatus = "quality_improving";
    else if (rssAutoPublishRequested || fullAutoPublishRequested) nextStatus = "approved";

    await prisma.contentGenJob.update({
      where: { id: contentGenJobId },
      data: {
        status: nextStatus,
        completedAt: nextStatus === "quality_improving" ? null : new Date(),
        durationMs: Date.now() - startedAt,
        qualityScore: output.qualityScore,
        seoScore: output.seoScore,
        readabilityScore: output.readabilityScore,
        plagiarismScore: plagiarism.maxSimilarity,
        doctrineCheckPassed: !blockingFail,
        tokensInput: 0, // détaillé via CostLedger
        tokensOutput: output.totalTokens,
        costUsd: output.totalCostUsd,
        outputJsonRaw: persistedOutput as never,
      },
    });
    await logStep(contentGenJobId, "validation", `Job persisted to ${nextStatus}`, {
      blocking_fail: blockingFail,
      final_tier: finalIndexationTier,
      quality_score: score,
      quality_threshold: qualityThreshold,
      quality_loop_eligible: eligibleQualityLoop,
      rss_auto_publish: rssAutoPublishRequested,
    });

    if (nextStatus === "quality_improving") {
      // Enqueue quality-improver-worker (le worker pickera, ré-évaluera ou
      // basculera vers needs_review/failed selon cap auto). § 27 master prompt.
      const queue = getQualityImproverQueue();
      if (queue) {
        await queue.add(
          "improve",
          { contentGenJobId, previousScore: score },
          { jobId: `quality-${contentGenJobId}` },
        );
        await logStep(contentGenJobId, "quality_check", "Enqueued quality-improver", {
          previous_score: score,
          target_threshold: qualityThreshold,
        });
      } else {
        // Redis absent — fail-soft : remet le job en needs_review pour ne pas
        // bloquer le pipeline (Will pourra le valider manuellement).
        await prisma.contentGenJob.update({
          where: { id: contentGenJobId },
          data: { status: "needs_review", completedAt: new Date() },
        });
        await prisma.reviewQueue
          .create({ data: { jobId: contentGenJobId, status: "pending" } })
          .catch(() => undefined);
      }
      return; // skip review-queue insert + publish
    }

    // 6. Insert ReviewQueue row (status=pending OU approved si auto-pub RSS).
    // Sans cette row, /review-queue/[id] ne trouve rien et le flow approve/promote
    // n'a pas de cible. Idempotent via unique jobId.
    const reviewStatus = nextStatus === "approved" ? "approved" : "pending";
    try {
      await prisma.reviewQueue.create({
        data: {
          jobId: contentGenJobId,
          status: reviewStatus,
          ...(nextStatus === "approved"
            ? {
                reviewedAt: new Date(),
                reviewNotes: `[auto-pub RSS] score ${score} ≥ seuil ${rssAutoPublishMinScore}`,
              }
            : {}),
        },
      });
    } catch (err) {
      // P2002 unique conflict = déjà créé (retry idempotent), no-op
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[content-gen-worker] reviewQueue create skipped (likely retry):`, err);
      }
    }

    if (nextStatus === "approved") {
      // Audit indexation 2026-05-18 — auto-pub avec promotion conditionnelle :
      //   score >= factoryAutoPromoteTier1MinScore (default 75)
      //     → publish DIRECT tier_1_indexable (sitemap immédiat + IndexNow ping)
      //   sinon → tier_2_noindex_follow (hors sitemap, attente tier-lifecycle CTR)
      // 2026-06-16 (décision Will, remplace le « 0 tout-indexable » du 2026-06-14)
      // — défaut 50 : un article n'est promu tier_1_indexable (sitemap + IndexNow)
      // que si score >= 50, APRÈS la boucle qualité (§27) qui ré-enrichit les
      // articles sous le seuil quality_loop. En dessous de 50 → tier_2
      // noindex_follow (garde-fou anti-doorway HCU, rattrapage via tier-lifecycle
      // CTR). Override via policy `factoryAutoPromoteTier1MinScore`.
      const autoPromoteTier1MinScore = policies.factoryAutoPromoteTier1MinScore ?? 50;
      // 2026-06-14 — Garde-fou soft-404 : même en « tout indexable », on n'indexe
      // PAS un contenu que le generator a jugé dégénéré/vide (soft-404 →
      // finalIndexationTier=tier_3). Ce contenu est tout de même publié, mais en
      // tier_2_noindex_follow (publié, hors index) au lieu de tier_1. Évite
      // d'envoyer du contenu junk à Google (risque HCU/thin-content).
      const shouldPromoteTier1 =
        score >= autoPromoteTier1MinScore && finalIndexationTier !== "tier_3_noindex_nofollow";

      const review = await prisma.reviewQueue.findUnique({
        where: { jobId: contentGenJobId },
        select: { id: true },
      });
      const queue = getPublishQueue();
      if (review && queue) {
        await queue.add(
          "publish",
          { reviewQueueId: review.id, promoteToTier1: shouldPromoteTier1 },
          { jobId: `publish-${review.id}` },
        );
        await logStep(
          contentGenJobId,
          "publish",
          shouldPromoteTier1
            ? `Enqueued auto-pub direct tier-1 (score ${score} >= ${autoPromoteTier1MinScore})`
            : `Enqueued auto-pub tier-2 (score ${score} < ${autoPromoteTier1MinScore})`,
          {
            review_queue_id: review.id,
            score,
            threshold_publish: rssAutoPublishMinScore,
            threshold_tier1: autoPromoteTier1MinScore,
            promote_to_tier_1: shouldPromoteTier1,
            content_type: contentType,
          },
        );
      }
    }

    // P1-17 fix audit opérationnel — Telegram alert "Nouveau contenu en review".
    // Seuil 5 (anti-spam) : on n'alerte que si pendingCount == multiple de 5.
    if (nextStatus === "needs_review") {
      const pendingCount = await prisma.reviewQueue.count({ where: { status: "pending" } });
      if (pendingCount > 0 && pendingCount % 5 === 0) {
        void alertNewReview(contentType, pendingCount).catch(() => undefined);
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await logStepError(contentGenJobId, "error", errMsg, {
      error_name: err instanceof Error ? err.name : "Unknown",
    });
    await prisma.contentGenJob.update({
      where: { id: contentGenJobId },
      data: {
        status: "failed",
        errorMessage: errMsg,
        completedAt: new Date(),
      },
    });
    // P1-17 — alerte batch fail : si 5 jobs failed consécutifs sur même type
    // (5 dernières heures), trigger Telegram pour pause manuelle Will.
    try {
      const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
      const recentFails = await prisma.contentGenJob.count({
        where: {
          contentType,
          status: "failed",
          completedAt: { gte: fiveHoursAgo },
        },
      });
      if (recentFails >= 5 && recentFails % 5 === 0) {
        void alertBatchFail(contentType, dbJob.campaignId, recentFails).catch(() => undefined);
      }
    } catch {
      // best-effort
    }
    throw err;
  }
}

let workerInstance: Worker<ContentGenJobPayload> | null = null;

/**
 * Démarre le worker BullMQ (V1 concurrency 5 hardcoded — V2 DB-managed).
 * À appeler depuis `src/server/queue/index.ts` au démarrage de l'app.
 */
export function startContentGenWorker(): Worker<ContentGenJobPayload> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL not set — content-gen-worker cannot start");
  }
  workerInstance = new Worker<ContentGenJobPayload>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 5,
    limiter: { max: 10, duration: 60_000 }, // 10/min — alignée OpenAI tier 5
    // Lock BullMQ étendu à 2min pour éviter stall sur jobs LLM long (génération
    // peut prendre 30-90s selon provider). Défaut BullMQ = 30s insuffisant.
    lockDuration: 120_000,
    // P2-23 audit indexation 2026-05-18 — bornage retention Redis :
    // garde 1000 jobs completed + 5000 jobs failed max (BullMQ purge auto).
    // Évite saturation Redis long-terme sur high-volume workers.
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-gen-worker] job ${job?.id} failed:`, err);
    // Sprint S+4-C (audit content-gen deep 2026-05-18 P1-7) — Sentry capture
    // additif. Kill-switch est volontairement skip (équivalent business pause,
    // pas un bug). KbNotReady déjà Telegram-alerted via alertKbNotReady — on
    // capture quand même côté Sentry pour suivi groupé (fréquence vs cause).
    const errMsg = err instanceof Error ? err.message : String(err);
    const errName = err instanceof Error ? err.name : "Error";
    if (
      errName !== "KillSwitchActiveError" &&
      errMsg !== "Kill switch content-gen actif — job requeue"
    ) {
      captureWorkerError("gen", QUEUE_NAME, job, err);
    }
  });
  workerInstance.on("completed", (job) => {
    console.log(`[content-gen-worker] job ${job.id} completed`);
  });
  return workerInstance;
}

export async function stopContentGenWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}

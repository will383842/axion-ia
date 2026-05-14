/**
 * Content Generator — Policies (admin /settings/policies, /settings/batches,
 * /settings/llms-txt, /settings/quality-loop, /settings/qa-policies,
 * /settings/search-intent-distribution).
 *
 * Stockage : `ContentGenConfig` table (key/value Json). § 12.5 master prompt.
 * Tous les défauts sont définis ici pour rester centralisés — modifiables admin
 * sans déploiement code.
 */

"use server";

import { revalidatePath } from "next/cache";
import type { ContentType } from "../../../../prisma/generated/client";
import { requireAdmin } from "./_auth";
import { readContentGenConfig, writeContentGenConfig } from "./_settings";

// ────────────────────────────────────────────────────────────────────
// /settings/batches
// ────────────────────────────────────────────────────────────────────

export const CONTENT_TYPES_ALL: ReadonlyArray<ContentType> = [
  "landing_ville",
  "blog_article",
  "blog_from_rss",
  "blog_from_keywords",
  "blog_from_title",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
];

/** Target/jour par type (Sprint 7 V2). 0 = type désactivé en mode V2. */
export type DailyTargetByType = Partial<Record<ContentType, number>>;

export interface BatchSettings {
  readonly dailyBatchSize: number;
  readonly workersConcurrency: number;
  readonly retryMaxAttempts: number;
  readonly retryBackoffMs: number;
  /** Sprint 7 V2 : cibles/jour par type. Vide = mode V1 (dailyBatchSize global). */
  readonly dailyTargetByType: DailyTargetByType;
  /** Sprint 7 V2 : étalement uniforme sur 24h (vs burst d'un coup). */
  readonly antiBurstEnabled: boolean;
}

const BATCH_DEFAULTS: BatchSettings = {
  dailyBatchSize: 20,
  workersConcurrency: 3,
  retryMaxAttempts: 3,
  retryBackoffMs: 30_000,
  dailyTargetByType: {},
  antiBurstEnabled: true,
};

export async function getBatchSettings(): Promise<BatchSettings> {
  const raw = await readContentGenConfig<Partial<BatchSettings>>("batches", BATCH_DEFAULTS);
  return {
    dailyBatchSize: raw.dailyBatchSize ?? BATCH_DEFAULTS.dailyBatchSize,
    workersConcurrency: raw.workersConcurrency ?? BATCH_DEFAULTS.workersConcurrency,
    retryMaxAttempts: raw.retryMaxAttempts ?? BATCH_DEFAULTS.retryMaxAttempts,
    retryBackoffMs: raw.retryBackoffMs ?? BATCH_DEFAULTS.retryBackoffMs,
    dailyTargetByType: raw.dailyTargetByType ?? BATCH_DEFAULTS.dailyTargetByType,
    antiBurstEnabled: raw.antiBurstEnabled ?? BATCH_DEFAULTS.antiBurstEnabled,
  };
}

export async function updateBatchSettings(input: BatchSettings): Promise<void> {
  const session = await requireAdmin();
  if (input.dailyBatchSize < 1 || input.dailyBatchSize > 1000) throw new Error("daily_size_range");
  if (input.workersConcurrency < 1 || input.workersConcurrency > 20)
    throw new Error("concurrency_range");
  if (input.retryMaxAttempts < 0 || input.retryMaxAttempts > 10) throw new Error("retry_range");

  // Sprint 7 V2 : validation per-type targets
  let totalByType = 0;
  for (const [type, target] of Object.entries(input.dailyTargetByType)) {
    if (!CONTENT_TYPES_ALL.includes(type as ContentType)) throw new Error("type_unknown");
    if (typeof target !== "number" || target < 0 || target > 100) throw new Error("target_range");
    totalByType += target;
  }
  if (totalByType > 500) throw new Error("total_per_type_too_high");

  await writeContentGenConfig("batches", input, session.userId, "Réglages batches & workers");
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/batches`);
}

// ────────────────────────────────────────────────────────────────────
// /settings/policies — skip-existing, RSS auto-publish, plagiat, retention
// ────────────────────────────────────────────────────────────────────

export interface ContentPolicies {
  readonly skipVilleIfCopyExists: boolean;
  readonly rssAutoPublishMinScore: number;
  readonly plagiarismJaccardInternal: number;
  readonly plagiarismJaccardRss: number;
  readonly tier3RetentionDays: number;
}

const POLICIES_DEFAULTS: ContentPolicies = {
  skipVilleIfCopyExists: true,
  rssAutoPublishMinScore: 75,
  plagiarismJaccardInternal: 0.3,
  plagiarismJaccardRss: 0.1,
  tier3RetentionDays: 90,
};

export async function getPolicies(): Promise<ContentPolicies> {
  return readContentGenConfig<ContentPolicies>("policies", POLICIES_DEFAULTS);
}

export async function updatePolicies(input: ContentPolicies): Promise<void> {
  const session = await requireAdmin();
  if (input.rssAutoPublishMinScore < 0 || input.rssAutoPublishMinScore > 100)
    throw new Error("score_range");
  if (input.plagiarismJaccardInternal < 0 || input.plagiarismJaccardInternal > 1)
    throw new Error("plagiat_internal_range");
  if (input.plagiarismJaccardRss < 0 || input.plagiarismJaccardRss > 1)
    throw new Error("plagiat_rss_range");
  if (input.tier3RetentionDays < 1 || input.tier3RetentionDays > 730)
    throw new Error("retention_range");
  await writeContentGenConfig("policies", input, session.userId, "Policies content-gen");
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/policies`);
}

// ────────────────────────────────────────────────────────────────────
// /settings/llms-txt
// ────────────────────────────────────────────────────────────────────

const LLMS_TXT_DEFAULT = `# Axion-IA — Cabinet IA opérationnel français

> Cabinet IA opérationnel français pour PME, ETI et grands comptes.
> Auteur principal : Manon (IA disclosed, doctrine éditoriale v2.1).
> Périmètre : audit IA, intervention, implémentation, conseil stratégique.

## Pages canoniques
- /fr — accueil
- /fr/interventions — taxonomie 4 familles
- /fr/audit — audit IA opérationnel
- /fr/implementation — implémentation IA
- /fr/methodologie — méthodologie 5 étapes
`;

export async function getLlmsTxt(): Promise<string> {
  return readContentGenConfig<string>("llms_txt", LLMS_TXT_DEFAULT);
}

export async function updateLlmsTxt(content: string): Promise<void> {
  const session = await requireAdmin();
  if (content.length > 50_000) throw new Error("llms_txt_too_long");
  await writeContentGenConfig("llms_txt", content, session.userId, "llms.txt édité admin");
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/llms-txt`);
  revalidatePath("/llms.txt");
}

// ────────────────────────────────────────────────────────────────────
// /settings/quality-loop
// ────────────────────────────────────────────────────────────────────

export interface QualityLoopSettings {
  readonly enabled: boolean;
  readonly minScoreThreshold: number; // ≤ score → quality_improving
  readonly targetScore: number; // arrête quand atteint
  readonly maxAttemptsAuto: number;
  readonly monthlyBudgetCapUsd: number;
}

const QUALITY_LOOP_DEFAULTS: QualityLoopSettings = {
  enabled: true,
  minScoreThreshold: 75,
  targetScore: 85,
  maxAttemptsAuto: 2,
  monthlyBudgetCapUsd: 100,
};

export async function getQualityLoop(): Promise<QualityLoopSettings> {
  return readContentGenConfig<QualityLoopSettings>("quality_loop", QUALITY_LOOP_DEFAULTS);
}

export async function updateQualityLoop(input: QualityLoopSettings): Promise<void> {
  const session = await requireAdmin();
  if (input.minScoreThreshold < 0 || input.minScoreThreshold > 100)
    throw new Error("min_score_range");
  if (input.targetScore <= input.minScoreThreshold) throw new Error("target_must_be_higher");
  if (input.maxAttemptsAuto < 0 || input.maxAttemptsAuto > 5) throw new Error("max_attempts_range");
  if (input.monthlyBudgetCapUsd < 0 || input.monthlyBudgetCapUsd > 5000)
    throw new Error("budget_range");
  await writeContentGenConfig("quality_loop", input, session.userId, "Boucle qualité v1.7");
  revalidatePath(
    `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/quality-loop`,
  );
}

// ────────────────────────────────────────────────────────────────────
// /settings/qa-policies — Q/R post-process auto
// ────────────────────────────────────────────────────────────────────

export interface QaPolicies {
  readonly autoCreatePages: boolean;
  readonly minWordsPerAnswer: number;
  readonly promoteTier1MinCtr: number;
}

const QA_DEFAULTS: QaPolicies = {
  autoCreatePages: true,
  minWordsPerAnswer: 40,
  promoteTier1MinCtr: 1.5,
};

export async function getQaPolicies(): Promise<QaPolicies> {
  return readContentGenConfig<QaPolicies>("qa_policies", QA_DEFAULTS);
}

export async function updateQaPolicies(input: QaPolicies): Promise<void> {
  const session = await requireAdmin();
  if (input.minWordsPerAnswer < 10 || input.minWordsPerAnswer > 500)
    throw new Error("min_words_range");
  if (input.promoteTier1MinCtr < 0 || input.promoteTier1MinCtr > 20) throw new Error("ctr_range");
  await writeContentGenConfig("qa_policies", input, session.userId, "Q/R post-process v1.7");
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/qa-policies`);
}

// ────────────────────────────────────────────────────────────────────
// /settings/search-intent-distribution
// ────────────────────────────────────────────────────────────────────

export interface SearchIntentDistribution {
  readonly informational: number;
  readonly commercial: number;
  readonly local: number;
  readonly transactional: number;
  readonly navigational: number;
}

const INTENT_DEFAULTS: SearchIntentDistribution = {
  informational: 50,
  commercial: 25,
  local: 15,
  transactional: 5,
  navigational: 5,
};

export async function getSearchIntentDistribution(): Promise<SearchIntentDistribution> {
  return readContentGenConfig<SearchIntentDistribution>(
    "search_intent_distribution",
    INTENT_DEFAULTS,
  );
}

export async function updateSearchIntentDistribution(
  input: SearchIntentDistribution,
): Promise<void> {
  const session = await requireAdmin();
  const sum =
    input.informational + input.commercial + input.local + input.transactional + input.navigational;
  if (Math.abs(sum - 100) > 0.5) throw new Error("sum_must_be_100");
  await writeContentGenConfig(
    "search_intent_distribution",
    input,
    session.userId,
    "Distribution intentions de recherche v1.7",
  );
  revalidatePath(
    `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/search-intent-distribution`,
  );
}

// ────────────────────────────────────────────────────────────────────
// /settings/providers — Sprint 11.5 V2 — Compete mode toggle
// ────────────────────────────────────────────────────────────────────

/**
 * Compete mode : 2 LLM (GPT-4o + Claude Sonnet 4.6) tournent en parallèle pour
 * chaque génération, on garde la sortie avec le meilleur seoScore. Coûte ~×2
 * en appels API mais améliore la qualité ~+10-15 %.
 *
 * Granularité : on peut activer compete uniquement pour certains content types
 * stratégiques (ex. blog_article + guide_pilier + comparison) et garder le
 * mode single (GPT-4o seul) pour le bulk villes pSEO.
 */
export interface CompeteModeSettings {
  /** Master switch : si false, compete jamais (même si types listés). */
  readonly enabled: boolean;
  /**
   * Liste des content types pour lesquels compete s'applique.
   * Liste vide ET enabled=true → compete sur TOUS les types.
   */
  readonly contentTypes: ReadonlyArray<ContentType>;
}

const COMPETE_DEFAULTS: CompeteModeSettings = {
  enabled: false,
  contentTypes: [],
};

export async function getCompeteMode(): Promise<CompeteModeSettings> {
  const raw = await readContentGenConfig<Partial<CompeteModeSettings>>(
    "compete_mode",
    COMPETE_DEFAULTS,
  );
  return {
    enabled: raw.enabled ?? COMPETE_DEFAULTS.enabled,
    contentTypes: raw.contentTypes ?? COMPETE_DEFAULTS.contentTypes,
  };
}

export async function updateCompeteMode(input: CompeteModeSettings): Promise<void> {
  const session = await requireAdmin();
  for (const t of input.contentTypes) {
    if (!CONTENT_TYPES_ALL.includes(t)) throw new Error("type_unknown");
  }
  await writeContentGenConfig("compete_mode", input, session.userId, "Compete mode (Sprint 11.5)");
  revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/providers`);
}

/**
 * Helper backend pour les generators : décide si on doit faire compete pour
 * un contentType donné. Lu à chaque génération (cache implicite ContentGenConfig).
 */
export async function shouldUseCompete(contentType: ContentType): Promise<boolean> {
  const cfg = await getCompeteMode();
  if (!cfg.enabled) return false;
  if (cfg.contentTypes.length === 0) return true;
  return cfg.contentTypes.includes(contentType);
}

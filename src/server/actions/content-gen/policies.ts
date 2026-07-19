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

import * as Sentry from "@sentry/nextjs";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ContentType } from "../../../../prisma/generated/client";
import { requireAdmin } from "./_auth";
import { readContentGenConfig, writeContentGenConfig } from "./_settings";
import { CONTENT_TYPES_ALL } from "./policies-constants";

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
// Schemas structurels — règles métier (somme=100, target_must_be_higher) restent
// en code applicatif après parse() pour messages d'erreur stables.
const ContentTypeKeySchema = z.enum([
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
const BatchSettingsSchema = z
  .object({
    workersConcurrency: z.number().int().min(1).max(20),
    retryMaxAttempts: z.number().int().min(0).max(10),
    retryBackoffMs: z.number().int().min(0).max(3_600_000),
    dailyTargetByType: z.record(ContentTypeKeySchema, z.number().min(0).max(100)),
    antiBurstEnabled: z.boolean(),
  })
  .strict();
const MaxPublishPerDaySchema = z.number().int().min(1).max(1000);
const ContentPoliciesSchema = z
  .object({
    // `skipVilleIfCopyExists` retiré (2026-07-18) : le réglage n'a JAMAIS été lu
    // par aucun worker — case morte en UI depuis sa création. La dédup réelle est
    // assurée par le dedup sémantique + topic-fingerprint du content-gen-worker.
    // Une clé résiduelle en DB est inoffensive (readContentGenConfig ne valide pas).
    rssAutoPublishMinScore: z.number().min(0).max(100),
    plagiarismJaccardInternal: z.number().min(0).max(1),
    plagiarismJaccardRss: z.number().min(0).max(1),
    tier3RetentionDays: z.number().int().min(1).max(730),
    // 2026-06-14 — Full auto-publish (tous types, sans relecture) + promotion
    // tier-1 directe. Exposés dans la console pour piloter/réversibiliser.
    factoryAutoPublishAllBlogTypes: z.boolean(),
    factoryAutoPromoteTier1MinScore: z.number().int().min(0).max(100),
    // 2026-06-14 — Cap journalier de news RSS (0-200). Le worker content-rss-fetch
    // n'enqueue plus au-delà de ce nombre de blog_from_rss par jour (UTC).
    rssMaxPerDay: z.number().int().min(0).max(200),
    // Fenêtre de fraîcheur (jours) : une news datée plus vieille est abandonnée
    // (jamais générée en news périmée). Sélection = la plus récente d'abord.
    rssMaxAgeDays: z.number().int().min(1).max(30),
    // 2026-07-01 — Interrupteur DÉDIÉ « publier automatiquement les news en
    // Actualités (Google News) ». Indépendant du full-auto global : gate propre
    // aux `blog_from_rss`. true = news auto-publiées tier_1 dès score ≥
    // rssAutoPublishMinScore ; false = news → review queue (modération humaine).
    newsAutoPublish: z.boolean(),
  })
  .strict();
const LlmsTxtSchema = z.string().max(50_000);
const QualityLoopSettingsSchema = z
  .object({
    enabled: z.boolean(),
    minScoreThreshold: z.number().min(0).max(100),
    targetScore: z.number().min(0).max(100),
    maxAttemptsAuto: z.number().int().min(0).max(5),
    monthlyBudgetCapUsd: z.number().min(0).max(5000),
  })
  .strict();
const QaPoliciesSchema = z
  .object({
    autoCreatePages: z.boolean(),
    minWordsPerAnswer: z.number().int().min(10).max(500),
    promoteTier1MinCtr: z.number().min(0).max(20),
  })
  .strict();
const SearchIntentDistributionSchema = z
  .object({
    informational: z.number().min(0).max(100),
    commercial: z.number().min(0).max(100),
    local: z.number().min(0).max(100),
    transactional: z.number().min(0).max(100),
    navigational: z.number().min(0).max(100),
  })
  .strict();

// ────────────────────────────────────────────────────────────────────
// /settings/batches
// ────────────────────────────────────────────────────────────────────

// `CONTENT_TYPES_ALL` déplacée dans `./policies-constants.ts` car Next.js 16+
// interdit l'export de symboles non-async dans "use server".

/** Target/jour par type (Sprint 7 V2). 0 = type désactivé en mode V2. */
export type DailyTargetByType = Partial<Record<ContentType, number>>;

export interface BatchSettings {
  readonly workersConcurrency: number;
  readonly retryMaxAttempts: number;
  readonly retryBackoffMs: number;
  /** Sprint 7 V2 : cibles/jour par type (override per-campaign dailyArticles). */
  readonly dailyTargetByType: DailyTargetByType;
  /** Sprint 7 V2 : étalement uniforme sur 24h (vs burst d'un coup). */
  readonly antiBurstEnabled: boolean;
}

const BATCH_DEFAULTS: BatchSettings = {
  workersConcurrency: 3,
  retryMaxAttempts: 3,
  retryBackoffMs: 30_000,
  dailyTargetByType: {},
  antiBurstEnabled: true,
};

export async function getBatchSettings(): Promise<BatchSettings> {
  const raw = await readContentGenConfig<Partial<BatchSettings>>("batches", BATCH_DEFAULTS);
  return {
    workersConcurrency: raw.workersConcurrency ?? BATCH_DEFAULTS.workersConcurrency,
    retryMaxAttempts: raw.retryMaxAttempts ?? BATCH_DEFAULTS.retryMaxAttempts,
    retryBackoffMs: raw.retryBackoffMs ?? BATCH_DEFAULTS.retryBackoffMs,
    dailyTargetByType: raw.dailyTargetByType ?? BATCH_DEFAULTS.dailyTargetByType,
    antiBurstEnabled: raw.antiBurstEnabled ?? BATCH_DEFAULTS.antiBurstEnabled,
  };
}

export async function updateBatchSettings(input: BatchSettings): Promise<void> {
  const session = await requireAdmin();
  BatchSettingsSchema.parse(input);
  try {
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
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "updateBatchSettings" } });
    throw e;
  }
}

// ────────────────────────────────────────────────────────────────────
// MAX_PUBLISH_PER_DAY — cap global publications/jour (D-P5-5 Sprint P5)
// ────────────────────────────────────────────────────────────────────

export async function getMaxPublishPerDay(): Promise<number> {
  return readContentGenConfig<number>("MAX_PUBLISH_PER_DAY", 30);
}

export async function updateMaxPublishPerDay(value: number): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  MaxPublishPerDaySchema.parse(value);
  try {
    if (!Number.isInteger(value) || value < 1 || value > 1000) {
      throw new Error("max_publish_range");
    }
    await writeContentGenConfig(
      "MAX_PUBLISH_PER_DAY",
      value,
      session.userId,
      `Cap articles/jour mis à jour : ${value}`,
    );
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/batches`);
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "updateMaxPublishPerDay" } });
    throw e;
  }
}

// ────────────────────────────────────────────────────────────────────
// /settings/policies — skip-existing, RSS auto-publish, plagiat, retention
// ────────────────────────────────────────────────────────────────────

export interface ContentPolicies {
  readonly rssAutoPublishMinScore: number;
  readonly plagiarismJaccardInternal: number;
  readonly plagiarismJaccardRss: number;
  readonly tier3RetentionDays: number;
  /** Full auto-publish de TOUS les types de contenu, sans relecture humaine. */
  readonly factoryAutoPublishAllBlogTypes: boolean;
  /** Score min pour promotion tier-1 indexable (0 = tout indexable). */
  readonly factoryAutoPromoteTier1MinScore: number;
  /** Cap journalier de news RSS générées (jobs blog_from_rss / jour, UTC). */
  readonly rssMaxPerDay: number;
  /** Fenêtre de fraîcheur news RSS (jours) : au-delà, la news est abandonnée. */
  readonly rssMaxAgeDays: number;
  /**
   * Interrupteur dédié « auto-publier les news en Actualités (Google News) ».
   * true → news `blog_from_rss` auto-publiées tier_1 dès score ≥
   * rssAutoPublishMinScore ; false → review queue (modération humaine avant mise
   * en ligne). Indépendant de `factoryAutoPublishAllBlogTypes` (qui ne concerne
   * plus les news).
   */
  readonly newsAutoPublish: boolean;
}

const POLICIES_DEFAULTS: ContentPolicies = {
  rssAutoPublishMinScore: 75,
  plagiarismJaccardInternal: 0.3,
  plagiarismJaccardRss: 0.1,
  tier3RetentionDays: 90,
  // 2026-06-14 (décision Will) — full auto + tout indexable par défaut.
  factoryAutoPublishAllBlogTypes: true,
  factoryAutoPromoteTier1MinScore: 0,
  // 2026-06-14 — Cap news RSS/jour + fenêtre fraîcheur (défaut 3 j).
  // 2026-07-04 (Will) — défaut abaissé 20 → 5 : le volume de news RSS/jour visé est
  // 5, pas 20. NB : ce défaut ne s'applique qu'en l'absence de config `policies`
  // persistée ; la valeur effective en prod est celle stockée (réglable dans la page
  // admin « Actualités / News RSS » /content-gen/news, champ « max/jour »).
  rssMaxPerDay: 5,
  rssMaxAgeDays: 3,
  // 2026-07-01 — Auto-publication des news activée par défaut (aligné sur la
  // stratégie « veille IA → Google News »). Réversible depuis la page Actualités.
  newsAutoPublish: true,
};

export async function getPolicies(): Promise<ContentPolicies> {
  // Fusion avec les défauts : une config `policies` persistée AVANT l'ajout d'un
  // champ (ex. `newsAutoPublish` 2026-07-01) ne le contient pas → sans merge,
  // `cfg.newsAutoPublish` serait `undefined` (case décochée en UI alors que le
  // worker le traite comme ON). Le merge garantit une valeur définie par champ.
  const stored = await readContentGenConfig<Partial<ContentPolicies>>("policies", {});
  return { ...POLICIES_DEFAULTS, ...stored };
}

export async function updatePolicies(input: ContentPolicies): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation (structurel) avant checks métier.
  ContentPoliciesSchema.parse(input);
  try {
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
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "updatePolicies" } });
    throw e;
  }
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
  // Sprint Final P1-3 — Zod runtime validation.
  LlmsTxtSchema.parse(content);
  if (content.length > 50_000) throw new Error("llms_txt_too_long");
  try {
    await writeContentGenConfig("llms_txt", content, session.userId, "llms.txt édité admin");
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/llms-txt`);
    revalidatePath("/llms.txt");
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "updateLlmsTxt" } });
    throw e;
  }
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
  minScoreThreshold: 60, // D-P5-2 Sprint P5 follow-up : 60/100 conforme décision Will
  targetScore: 80,
  maxAttemptsAuto: 2,
  monthlyBudgetCapUsd: 100,
};

export async function getQualityLoop(): Promise<QualityLoopSettings> {
  return readContentGenConfig<QualityLoopSettings>("quality_loop", QUALITY_LOOP_DEFAULTS);
}

export async function updateQualityLoop(input: QualityLoopSettings): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation (structurel) avant checks métier.
  QualityLoopSettingsSchema.parse(input);
  try {
    if (input.minScoreThreshold < 0 || input.minScoreThreshold > 100)
      throw new Error("min_score_range");
    if (input.targetScore <= input.minScoreThreshold) throw new Error("target_must_be_higher");
    if (input.maxAttemptsAuto < 0 || input.maxAttemptsAuto > 5)
      throw new Error("max_attempts_range");
    if (input.monthlyBudgetCapUsd < 0 || input.monthlyBudgetCapUsd > 5000)
      throw new Error("budget_range");
    await writeContentGenConfig("quality_loop", input, session.userId, "Boucle qualité v1.7");
    revalidatePath(
      `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/quality-loop`,
    );
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "updateQualityLoop" } });
    throw e;
  }
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
  // Sprint Final P1-3 — Zod runtime validation (structurel) avant checks métier.
  QaPoliciesSchema.parse(input);
  try {
    if (input.minWordsPerAnswer < 10 || input.minWordsPerAnswer > 500)
      throw new Error("min_words_range");
    if (input.promoteTier1MinCtr < 0 || input.promoteTier1MinCtr > 20) throw new Error("ctr_range");
    await writeContentGenConfig("qa_policies", input, session.userId, "Q/R post-process v1.7");
    revalidatePath(
      `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/settings/qa-policies`,
    );
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "updateQaPolicies" } });
    throw e;
  }
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
  // Sprint Final P1-3 — Zod runtime validation (structurel) avant check somme=100.
  SearchIntentDistributionSchema.parse(input);
  try {
    const sum =
      input.informational +
      input.commercial +
      input.local +
      input.transactional +
      input.navigational;
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
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "content-gen", action: "updateSearchIntentDistribution" },
    });
    throw e;
  }
}

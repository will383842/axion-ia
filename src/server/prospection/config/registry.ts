/**
 * Prospection — Registre de configuration (module PUR : clés + schémas Zod + défauts).
 *
 * SSOT des paramètres surchargables via `SiteSetting` (catégorie `prospection`,
 * ajoutée en T2). Aucune constante magique ailleurs : quotas, rate-limits, seuils,
 * fenêtres de fraîcheur, budgets de crawl, poids de score, rétention RGPD vivent ici.
 * L'accès DB (lecture/écriture stub-aware) est dans `site-settings.ts`.
 */

import { z } from "zod";
import { DEFAULT_SCORING_WEIGHTS } from "@/lib/prospection/scoring";
import {
  DEFAULT_CRAWL_BUDGET,
  TEAM_ENRICH_DEFAULT_SECTEURS,
} from "@/lib/prospection/crawl-targets";

/** Préfixe des clés `SiteSetting` du module (évite les collisions inter-modules). */
export const PROSPECTION_CONFIG_KEY_PREFIX = "prospection.";

const rateLimitsSchema = z.object({
  rechercheEntreprisesPerSec: z.number().positive().max(50),
  sireneApiPerMin: z.number().positive().max(1000),
  bodaccPerSec: z.number().positive().max(50),
  banPerSec: z.number().positive().max(50),
  rnePerSec: z.number().positive().max(50),
});

const crawlBudgetSchema = z.object({
  maxPagesContact: z.number().int().positive().max(10),
  maxPagesPersonnes: z.number().int().nonnegative().max(20),
  maxPagesEntreprise: z.number().int().positive().max(30),
  maxTeamAttempts: z.number().int().nonnegative().max(20),
  maxDepthPersonnes: z.number().int().nonnegative().max(4),
  pageTimeoutMs: z.number().int().positive().max(30000),
  maxBytesPerPage: z.number().int().positive(),
  defaultCrawlDelayMs: z.number().int().nonnegative().max(30000),
});

const freshnessSchema = z.object({
  refreshAfterDays: z.number().int().positive().max(3650),
  enrichmentRefreshDays: z.number().int().positive().max(3650),
});

const exploitableThresholdSchema = z.object({
  /** `exploitable` exige un email MX-OK ; téléphone = bonus (07-DECISIONS Q2). */
  requirePhone: z.boolean(),
  requireMxCheck: z.boolean(),
});

const scoringWeightsSchema = z.object({
  emailVerified: z.number().nonnegative(),
  emailUnverified: z.number().nonnegative(),
  phoneValid: z.number().nonnegative(),
  nominative: z.number().nonnegative(),
  dirigeant: z.number().nonnegative(),
  freshness: z.number().nonnegative(),
  officialSource: z.number().nonnegative(),
  targetMatch: z.number().nonnegative(),
  etablissementActif: z.number().nonnegative(),
});

const retentionSchema = z.object({
  /** Durée de conservation après dernière action (07-DECISIONS Q6 — à valider juridiquement). */
  retentionYears: z.number().int().positive().max(10),
  accessLogRetentionMonths: z.number().int().positive().max(60),
});

const quotasSchema = z.object({
  /** 0 = illimité. */
  defaultCampaignQuotaMax: z.number().int().nonnegative(),
  maxConcurrentDomainsPerWorker: z.number().int().positive().max(50),
  /** Fenêtre bornée de jobs en vol (backpressure / drip-feed). */
  inFlightWindow: z.number().int().positive().max(10000),
});

const circuitBreakerSchema = z.object({
  failuresToOpen: z.number().int().positive().max(100),
  cooldownMs: z.number().int().positive(),
  /** Fenêtre pendant laquelle une sonde half-open est « en vol » (single-probe). */
  probeTimeoutMs: z.number().int().positive(),
});

const teamPassSchema = z.object({
  maxPagesPersonnes: z.number().int().nonnegative().max(20),
  maxDepth: z.number().int().nonnegative().max(4),
  defaultEnabledSecteurs: z.array(z.string()),
});

const alertsSchema = z.object({
  /** Alerte si le débit chute de X % vs snapshot précédent. */
  debitDropPct: z.number().min(0).max(100),
  /** Alerte si une cellule reste `en_cours` plus de N heures. */
  staleCellHours: z.number().positive().max(168),
  /** Alerte si une source renvoie 0 résultat de façon anormale. */
  zeroResultAlert: z.boolean(),
});

const legalIdentitySchema = z.object({
  // Gouvernance AIPD spécifique prospection. L'IDENTITÉ légale (raison sociale,
  // SIREN, DPO) n'est PAS dupliquée ici : elle est centralisée dans le
  // SiteSetting `legal_overrides` (SSOT `src/lib/legal-identity.ts`, éditée dans
  // la console `/settings`), lue via `getProspectionControllerIdentity()`.
  aipdValidatedBy: z.string(),
  aipdValidatedAt: z.string(),
});

/**
 * Entrée de registre : schéma Zod + défaut typé + description.
 */
interface RegistryEntry<T> {
  schema: z.ZodType<T>;
  default: T;
  description: string;
}

function entry<T>(schema: z.ZodType<T>, def: T, description: string): RegistryEntry<T> {
  return { schema, default: def, description };
}

/** Registre complet (clé courte → schéma + défaut). */
export const PROSPECTION_CONFIG_REGISTRY = {
  rateLimits: entry(
    rateLimitsSchema,
    {
      rechercheEntreprisesPerSec: 7,
      sireneApiPerMin: 30,
      bodaccPerSec: 5,
      banPerSec: 10,
      rnePerSec: 5,
    },
    "Rate-limits par source (req/s ou req/min) — jamais dépassés (0 × 429 ban).",
  ),
  crawlBudget: entry(
    crawlBudgetSchema,
    {
      maxPagesContact: DEFAULT_CRAWL_BUDGET.maxPagesContact,
      maxPagesPersonnes: DEFAULT_CRAWL_BUDGET.maxPagesPersonnes,
      maxPagesEntreprise: DEFAULT_CRAWL_BUDGET.maxPagesEntreprise,
      maxTeamAttempts: DEFAULT_CRAWL_BUDGET.maxTeamAttempts,
      maxDepthPersonnes: DEFAULT_CRAWL_BUDGET.maxDepthPersonnes,
      pageTimeoutMs: DEFAULT_CRAWL_BUDGET.pageTimeoutMs,
      maxBytesPerPage: DEFAULT_CRAWL_BUDGET.maxBytesPerPage,
      defaultCrawlDelayMs: DEFAULT_CRAWL_BUDGET.defaultCrawlDelayMs,
    },
    "Budget du mini-crawl 2 passes du site public (politesse + plafonds).",
  ),
  freshness: entry(
    freshnessSchema,
    { refreshAfterDays: 90, enrichmentRefreshDays: 90 },
    "Fenêtre de fraîcheur (anti-re-scrape) : ne re-vérifier qu'au-delà de N jours.",
  ),
  exploitableThreshold: entry(
    exploitableThresholdSchema,
    { requirePhone: false, requireMxCheck: true },
    "Seuil « exploitable » = ≥ 1 email MX-OK ; téléphone = bonus.",
  ),
  scoringWeights: entry(
    scoringWeightsSchema,
    { ...DEFAULT_SCORING_WEIGHTS },
    "Poids du leadScore (aide au tri, aucune décision automatisée art. 22).",
  ),
  retention: entry(
    retentionSchema,
    { retentionYears: 3, accessLogRetentionMonths: 12 },
    "Rétention RGPD : 3 ans après dernière action ; journal d'accès 12 mois.",
  ),
  quotas: entry(
    quotasSchema,
    { defaultCampaignQuotaMax: 0, maxConcurrentDomainsPerWorker: 1, inFlightWindow: 500 },
    "Quotas & backpressure (fenêtre bornée de jobs en vol, 1 domaine à la fois).",
  ),
  circuitBreaker: entry(
    circuitBreakerSchema,
    { failuresToOpen: 5, cooldownMs: 60000, probeTimeoutMs: 30000 },
    "Circuit breaker par source (ouvre après K échecs, sonde half-open unique après cooldown).",
  ),
  teamPass: entry(
    teamPassSchema,
    {
      maxPagesPersonnes: 4,
      maxDepth: 2,
      defaultEnabledSecteurs: [...TEAM_ENRICH_DEFAULT_SECTEURS],
    },
    "Passe B (responsables) : budget + secteurs activés par défaut (07-DECISIONS Q10).",
  ),
  alerts: entry(
    alertsSchema,
    { debitDropPct: 50, staleCellHours: 6, zeroResultAlert: true },
    "Seuils de détection d'anomalies (débit, cellule stale, taux 0 anormal).",
  ),
  aipdGovernance: entry(
    legalIdentitySchema,
    { aipdValidatedBy: "", aipdValidatedAt: "" },
    "Gouvernance AIPD prospection (qui a validé / quand). Identité légale = SiteSetting `legal_overrides`.",
  ),
} as const;

export type ProspectionConfigKey = keyof typeof PROSPECTION_CONFIG_REGISTRY;

export type ProspectionConfigValue<K extends ProspectionConfigKey> = z.infer<
  (typeof PROSPECTION_CONFIG_REGISTRY)[K]["schema"]
>;

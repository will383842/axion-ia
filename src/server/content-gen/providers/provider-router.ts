/**
 * Content Generator — Provider router + circuit breaker.
 *
 * Sprint 1 Day 1 AGT-B = SQUELETTE. Implémentation complète Day 2 § 16:00 :
 * - Route selon role + primary/fallback (lecture ProviderConfig DB).
 * - Cost cap check pré-call (assertion DB atomic).
 * - Health check Redis cached 60s.
 * - Circuit breaker opossum-style (5 erreurs / 30s → ouvert 60s).
 * - État partagé Redis (tous les workers voient le même circuit).
 * - Fallback automatique : OpenAI 503 → Claude < 1s.
 *
 * Cf. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md § 7.3 + § 0.4.
 */

import {
  ProviderError,
  type GenerationRequest,
  type GenerationResponse,
  type IProvider,
} from "./IProvider";
import { openaiProvider } from "./openai";
import { anthropicProvider } from "./anthropic";
import { perplexityProvider } from "./perplexity";
import { unsplashProvider } from "./unsplash";
import type { ProviderKey, ProviderRole } from "../../../../prisma/generated/client";

// ============================================================
// Circuit breaker in-memory V0 (Sprint 1 Day 2 step 16:00)
//
// 5 erreurs / 30 s par provider → ouvert 60 s
// half-open (re-test 1 call autorisé)
// Day 5 V2 : passer à Redis-shared (BullMQ ioredis client).
// ============================================================

interface CircuitState {
  failures: ReadonlyArray<number>; // timestamps ms des 5 derniers échecs
  openedAt: number | null;
  halfOpen: boolean;
}

const FAILURE_WINDOW_MS = 30_000; // 30s
const MAX_FAILURES = 5;
const OPEN_DURATION_MS = 60_000; // 60s ouvert avant half-open

const circuits = new Map<ProviderKey, CircuitState>();

function getCircuit(key: ProviderKey): CircuitState {
  let state = circuits.get(key);
  if (!state) {
    state = { failures: [], openedAt: null, halfOpen: false };
    circuits.set(key, state);
  }
  return state;
}

function isCircuitOpen(key: ProviderKey): boolean {
  const state = getCircuit(key);
  if (state.openedAt === null) return false;
  const elapsed = Date.now() - state.openedAt;
  if (elapsed > OPEN_DURATION_MS) {
    // Passe en half-open : autorise 1 tentative
    state.halfOpen = true;
    state.openedAt = null;
    return false;
  }
  return true;
}

function recordFailure(key: ProviderKey): void {
  const state = getCircuit(key);
  const now = Date.now();
  const recentFailures = [...state.failures, now].filter((t) => now - t < FAILURE_WINDOW_MS);
  state.failures = recentFailures;
  if (recentFailures.length >= MAX_FAILURES) {
    state.openedAt = now;
    state.halfOpen = false;
    state.failures = [];
    console.warn(
      `[circuit-breaker] OPEN ${key} (${MAX_FAILURES} failures / ${FAILURE_WINDOW_MS}ms)`,
    );
  }
}

function recordSuccess(key: ProviderKey): void {
  const state = getCircuit(key);
  if (state.halfOpen) {
    state.halfOpen = false;
    state.failures = [];
    console.warn(`[circuit-breaker] CLOSED ${key} (half-open success)`);
  }
}

/** Reset utilitaire (tests). */
export function _resetCircuits(): void {
  circuits.clear();
}

/**
 * Map role → liste de providers candidats par ordre de préférence (primary → fallback).
 * Lu depuis ProviderConfig DB en Day 2 (V1 hardcodé pour squelette).
 */
const ROLE_TO_PROVIDERS = {
  // ── DÉCISION Will 2026-07-09 : génération de contenu = OpenAI UNIQUEMENT ──
  //   Le fallback Claude (ajouté A-P1-01 2026-06-05) drainait le crédit Anthropic
  //   à l'insu du propriétaire : dès qu'OpenAI renvoyait un 429 (rate-limit OU
  //   quota épuisé — les deux étaient alors mappés `rate_limited` retryable),
  //   TOUTE la génération texte basculait sur claude-sonnet-4-6 (2× plus cher).
  //   Bilan cost_ledger : 754 appels Claude = 51,75 $. Le fallback est donc RETIRÉ.
  //   Conséquence assumée : une panne/quota OpenAI fait ÉCHOUER le job (retry
  //   BullMQ attempts:3) plutôt que de dépenser sur Anthropic.
  //   ⚠️ NE PAS remettre `anthropicProvider` ici sans accord explicite de Will.
  //
  //   MISE À JOUR 2026-07-21 — le mauvais mapping décrit ci-dessus est CORRIGÉ :
  //   `insufficient_quota` produit désormais `quota_exhausted` non-retryable
  //   (cf. `openai.ts`). La confusion 429-quota/429-rate-limit n'existe donc plus.
  //   Cela ne rouvre PAS la question du fallback : la décision de ne pas dépenser
  //   sur Anthropic reste entière et indépendante de ce bug.
  text: [openaiProvider],
  image: [openaiProvider], // V1 = OpenAI image (V2 = gpt_image + fallback Unsplash)
  data: [perplexityProvider],
  stock_image: [unsplashProvider],
  rerank: [openaiProvider],
} as const;

/**
 * Génère via le provider primary du role, fallback automatique si erreur retryable.
 *
 * Day 2 ajoute :
 * - Circuit breaker per-provider (Redis-shared state).
 * - Cost cap check pré-call (CostLedger sum vs ProviderConfig.monthlyCapUsd).
 * - Retry exponentiel 10s/30s/60s sur RateLimited.
 * - Telegram alert si fallback déclenché 5+ fois en 30s.
 */
export async function generate(req: GenerationRequest): Promise<GenerationResponse> {
  const baseCandidates = ROLE_TO_PROVIDERS[req.role] as ReadonlyArray<IProvider>;
  // Sprint Quality 2026 — `preferredProvider` réordonne les candidates sans
  // casser le fallback. Si le préféré est dans les candidates → en premier.
  // Si le préféré est anthropicProvider mais pas dans `text` role par défaut,
  // on l'ajoute en tête. Le fallback OpenAI reste activé en cas d'échec.
  let candidates: ReadonlyArray<IProvider> = baseCandidates;
  if (req.preferredProvider) {
    const preferred = [
      openaiProvider,
      anthropicProvider,
      perplexityProvider,
      unsplashProvider,
    ].find((p) => p.key === req.preferredProvider);
    if (preferred) {
      const rest = baseCandidates.filter((p) => p.key !== preferred.key);
      candidates = [preferred, ...rest];
    }
  }

  let lastError: Error | null = null;
  for (const provider of candidates) {
    // Circuit breaker — skip provider si circuit ouvert
    if (isCircuitOpen(provider.key)) {
      lastError = new ProviderError(
        `Circuit breaker open for ${provider.key}`,
        "down",
        provider.key,
        true,
      );
      continue;
    }
    try {
      const result = await provider.generate(req);
      recordSuccess(provider.key);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRetryable = err instanceof ProviderError ? err.retryable : true;
      if (isRetryable) {
        recordFailure(provider.key);
      }
      // Auth failed / cost cap / content_filter → pas de fallback inutile
      if (err instanceof ProviderError && !err.retryable) {
        throw err;
      }
      // sinon : try next provider in chain (fallback automatique)
    }
  }
  throw lastError ?? new Error(`All providers failed for role '${req.role}'`);
}

/**
 * Health check global — utilisé par /api/admin/content-gen/health.
 * Day 2 : cached Redis 60s par provider.
 */
export async function healthCheckAll(): Promise<Record<string, boolean>> {
  const all = [openaiProvider, anthropicProvider, perplexityProvider, unsplashProvider];
  const results: Record<string, boolean> = {};
  await Promise.all(
    all.map(async (p) => {
      try {
        results[p.key] = await p.healthCheck();
      } catch {
        results[p.key] = false;
      }
    }),
  );
  return results;
}

/**
 * Liste des roles disponibles selon les providers actuellement health-OK.
 * Day 2 : lit ProviderConfig.enabled depuis DB en plus.
 */
export function getAvailableRoles(healthMap: Record<string, boolean>): ReadonlyArray<ProviderRole> {
  const roles = new Set<ProviderRole>();
  for (const [role, providers] of Object.entries(ROLE_TO_PROVIDERS)) {
    for (const p of providers) {
      if (healthMap[p.key]) {
        roles.add(role as ProviderRole);
        break;
      }
    }
  }
  return Array.from(roles);
}

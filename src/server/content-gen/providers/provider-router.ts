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

import { ProviderError, type GenerationRequest, type GenerationResponse } from "./IProvider";
import { openaiProvider } from "./openai";
import { anthropicProvider } from "./anthropic";
import { perplexityProvider } from "./perplexity";
import { unsplashProvider } from "./unsplash";
import type { ProviderRole } from "../../../../prisma/generated/client";

/**
 * Map role → liste de providers candidats par ordre de préférence (primary → fallback).
 * Lu depuis ProviderConfig DB en Day 2 (V1 hardcodé pour squelette).
 */
const ROLE_TO_PROVIDERS = {
  text: [openaiProvider, anthropicProvider],
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
  const candidates = ROLE_TO_PROVIDERS[req.role];

  let lastError: Error | null = null;
  for (const provider of candidates) {
    try {
      return await provider.generate(req);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Sprint 1 Day 2 : circuit breaker open + telegram alert ici si retryable
      if (err instanceof ProviderError && !err.retryable) {
        // Auth failed / cost cap → pas de fallback inutile
        throw err;
      }
      // sinon : try next provider in chain (fallback)
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

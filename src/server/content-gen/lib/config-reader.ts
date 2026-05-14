/**
 * Content Generator — Provider config DB reader (§ 7.2 master prompt).
 *
 * Lit `ProviderConfig` depuis DB + cache Redis 60s pour éviter hammering.
 * Day 2 Sprint 1. V0 transitoire : si DB pas accessible, fallback defaults
 * codés en dur (sécurité build/test).
 */

import { prisma } from "@/lib/prisma";
import type { ProviderConfig, ProviderKey } from "../../../../prisma/generated/client";

/**
 * Defaults V0 alignés sur seed `prisma/seeds/content-gen/provider-config.ts`.
 * Utilisés en mode dégradé (DB pas migrée OU row absente).
 */
const V0_DEFAULTS: Record<ProviderKey, { model: string; enabled: boolean; monthlyCapUsd: number }> =
  {
    openai: { model: "gpt-4o", enabled: true, monthlyCapUsd: 200 },
    anthropic: { model: "claude-sonnet-4-6", enabled: true, monthlyCapUsd: 100 },
    perplexity: { model: "sonar-pro", enabled: true, monthlyCapUsd: 80 },
    unsplash: { model: "unsplash-api-v1", enabled: true, monthlyCapUsd: 0 },
    gpt_image: { model: "gpt-image-1", enabled: false, monthlyCapUsd: 0 },
  };

/**
 * Lit la config d'un provider depuis DB, fallback defaults V0 si absent.
 * V1 cache simple memo (60s) — Day 5 Redis-shared.
 */
const cache = new Map<ProviderKey, { value: ProviderConfig | null; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

export async function readProviderConfig(provider: ProviderKey): Promise<{
  readonly model: string;
  readonly enabled: boolean;
  readonly monthlyCapUsd: number;
  readonly fromDb: boolean;
}> {
  const cached = cache.get(provider);
  const now = Date.now();
  let row: ProviderConfig | null;
  if (cached && cached.expiresAt > now) {
    row = cached.value;
  } else {
    try {
      row = await prisma.providerConfig.findUnique({ where: { provider } });
    } catch (err) {
      // P2021 table doesn't exist → fallback defaults
      if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2021") {
        row = null;
      } else {
        throw err;
      }
    }
    cache.set(provider, { value: row, expiresAt: now + CACHE_TTL_MS });
  }

  if (row) {
    return {
      model: row.model,
      enabled: row.enabled,
      monthlyCapUsd: Number(row.monthlyCapUsd),
      fromDb: true,
    };
  }
  const defaults = V0_DEFAULTS[provider];
  return { ...defaults, fromDb: false };
}

/**
 * Invalide le cache (à appeler après update admin /settings/providers).
 */
export function invalidateProviderConfigCache(provider?: ProviderKey): void {
  if (provider) {
    cache.delete(provider);
  } else {
    cache.clear();
  }
}

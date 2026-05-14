/**
 * Seed ProviderConfig — 5 rows (openai/anthropic/perplexity/unsplash + openai image legacy).
 *
 * Cost caps (master prompt § 24.7 — défaut autorité autopilote) :
 *   OpenAI text  $200/mois
 *   Anthropic    $100/mois
 *   Perplexity    $80/mois
 *   Unsplash       $0/mois (free tier — rate-limit per-hour à la place)
 *   Total V1   = $380/mois
 *
 * Modèles default Day 1 (master prompt Q2 option recommandée) :
 *   openai-text  : gpt-4o
 *   anthropic    : claude-sonnet-4-6
 *   perplexity   : sonar-pro
 *   unsplash     : (n/a — pas de modèle)
 */

import type { PrismaClient } from "../../generated/client";

export async function seedProviderConfig(prisma: PrismaClient): Promise<number> {
  const rows = [
    {
      provider: "openai" as const,
      role: "text" as const,
      enabled: true,
      primary: true,
      model: "gpt-4o",
      monthlyCapUsd: 200,
      apiKeyEnvVar: "OPENAI_API_KEY",
      rateLimitRpm: 500,
      rateLimitTpm: 30_000_000,
    },
    {
      provider: "anthropic" as const,
      role: "text" as const,
      enabled: true,
      primary: false, // fallback
      model: "claude-sonnet-4-6",
      monthlyCapUsd: 100,
      apiKeyEnvVar: "ANTHROPIC_API_KEY",
      rateLimitRpm: 50,
      rateLimitTpm: 100_000,
    },
    {
      provider: "perplexity" as const,
      role: "data" as const,
      enabled: true,
      primary: true,
      model: "sonar-pro",
      monthlyCapUsd: 80,
      apiKeyEnvVar: "PERPLEXITY_API_KEY",
      rateLimitRpm: 50,
    },
    {
      provider: "unsplash" as const,
      role: "stock_image" as const,
      // ✅ ACTIVÉ V1 — Décision Will 2026-05-14 v3 après ré-analyse précise CGU.
      // CGU gratuit §8 et API §12 interdisent l'usage des images "dans des
      // ensembles de données" / "à des fins d'apprentissage automatique"
      // (= training ML / datasets). Notre cas = AUTOMATISATION de sélection
      // (script API → select photo → embed dans HTML article texte généré par
      // IA) ≠ dataset ML ≠ training. Position juridique : conforme.
      // Garde-fou : filtre strict premium=false (Unsplash+ exclu — sa clause §3
      // est plus large "par/pour IA quelle qu'elle soit").
      // Voir docs/content-gen/UNSPLASH-COMPLIANCE.md v3.
      enabled: true,
      primary: true,
      model: "unsplash-api-v1",
      monthlyCapUsd: 0,
      apiKeyEnvVar: "UNSPLASH_ACCESS_KEY",
      rateLimitRpm: 50, // free tier: 50/hour
    },
    {
      provider: "openai" as const,
      role: "rerank" as const,
      enabled: false, // V2 (embeddings rerank — V1 utilise canonical boost heuristic)
      primary: false,
      model: "text-embedding-3-small",
      monthlyCapUsd: 0,
      apiKeyEnvVar: "OPENAI_API_KEY",
    },
  ];

  let count = 0;
  for (const r of rows) {
    // On garde les overrides Will sur model + caps + enabled/primary (pas écraser)
    // mais on synchronise role + apiKeyEnvVar + rate limits (doctrine SSOT).
    const updatePayload: {
      role: typeof r.role;
      apiKeyEnvVar: string;
      rateLimitRpm?: number;
      rateLimitTpm?: number;
    } = {
      role: r.role,
      apiKeyEnvVar: r.apiKeyEnvVar,
    };
    if (r.rateLimitRpm !== undefined) updatePayload.rateLimitRpm = r.rateLimitRpm;
    if (r.rateLimitTpm !== undefined) updatePayload.rateLimitTpm = r.rateLimitTpm;

    await prisma.providerConfig.upsert({
      where: { provider: r.provider },
      create: r,
      update: updatePayload,
    });
    count++;
  }
  return count;
}

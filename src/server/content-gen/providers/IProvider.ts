/**
 * Content Generator — Interface abstraite IProvider.
 *
 * Contrat commun à OpenAI / Anthropic / Perplexity / Unsplash / gpt_image.
 * Sprint 1 Day 1 AGT-B (stubs typés). Implémentations réelles Day 2-3.
 *
 * Cf. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md § 7.
 */

import type { ProviderKey, ProviderRole } from "../../../../prisma/generated/client";

/**
 * Requête générique soumise au provider via `provider-router.ts`.
 * Le router décide quelle implémentation appeler selon role + primary/fallback.
 */
export interface GenerationRequest {
  /// ID du ContentGenJob pour traçabilité cost + audit
  readonly jobId: string;
  /// Type de contenu généré (pour tagging cost + metrics)
  readonly contentType: string;
  /// Role attendu : text | image | data | stock_image | rerank
  readonly role: ProviderRole;
  /// Modèle override par-job (sinon ProviderConfig.model default).
  readonly model?: string;
  /// Provider préféré pour ce job (réordonne les candidates du router, sans casser
  /// le fallback automatique). Sprint Quality 2026 — utilisé par landing_ville
  /// generators pour forcer Claude Sonnet (verbosité + qualité éditoriale).
  readonly preferredProvider?: ProviderKey;
  /// System prompt (prefix cache-friendly Anthropic).
  readonly systemPrompt: string;
  /// User prompt (variable, pas cache).
  readonly userPrompt: string;
  /// Streaming activé (obligatoire pour LLM text — anti-waterfall § 9.11.2).
  readonly stream?: boolean;
  /// Max tokens output.
  readonly maxTokens?: number;
  /// Température 0-2.
  readonly temperature?: number;
  /// Zod schema sérialisé pour validation output (text only).
  readonly outputSchemaZod?: string;
  /// Callback streaming — déclenche early-action (image gen mid-text § 9.11.7).
  readonly onStreamChunk?: (chunk: string) => void;
  /// Timeout custom (default 30s § 0.4).
  readonly timeoutMs?: number;
  /// Search recency filter (Perplexity uniquement).
  readonly searchRecencyMonths?: number;
  /// Force une sortie JSON stricte (OpenAI `response_format: {type:"json_object"}`).
  /// À poser UNIQUEMENT sur les appels dont la sortie EST du JSON (plans/outlines),
  /// jamais sur les appels qui renvoient du HTML. Le prompt doit contenir le mot
  /// « json » (contrainte OpenAI). No-op pour les providers sans JSON mode.
  readonly responseFormatJson?: boolean;
}

/**
 * Réponse normalisée provider. Tous les champs cost/tokens sont obligatoires
 * (audit cost cap + ledger). `output` est le texte/payload brut côté provider.
 */
export interface GenerationResponse {
  readonly provider: ProviderKey;
  readonly model: string;
  readonly output: string;
  /// Tokens input (system + user prompt).
  readonly tokensInput: number;
  readonly tokensOutput: number;
  readonly costUsd: number;
  readonly durationMs: number;
  /// Citations extraites (Perplexity Sonar). Toujours `[]` pour text-only providers.
  readonly citations?: ReadonlyArray<{ url: string; title: string; publishedAt?: string }>;
  /// Cache hit Anthropic prompt caching (sinon undefined).
  readonly cacheReadInputTokens?: number;
  readonly cacheCreationInputTokens?: number;
  /// Flag content_filter (re-prompt re-routing par le router).
  readonly contentFilterTriggered?: boolean;
}

/**
 * Erreurs typées émises par chaque IProvider.
 * Le provider-router map ces erreurs vers :
 * - retry exponentiel (RateLimited)
 * - fallback automatique (Down, ContentFilter)
 * - kill switch (CostCapReached)
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "rate_limited"
      // Quota/crédit du COMPTE provider épuisé (≠ `cost_cap_reached`, qui est
      // notre plafond interne). Non-retryable par nature : réessayer ne peut
      // pas réussir tant qu'un humain n'a pas rechargé le compte.
      | "quota_exhausted"
      | "timeout"
      | "down"
      | "auth_failed"
      | "content_filter"
      | "cost_cap_reached"
      | "invalid_response"
      | "unknown",
    public readonly provider: ProviderKey,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * Interface abstraite — toutes les implémentations doivent l'honorer.
 */
export interface IProvider {
  readonly key: ProviderKey;
  /// Roles supportés par ce provider (ex: openai supports text + image + rerank).
  readonly supportedRoles: ReadonlyArray<ProviderRole>;

  /**
   * Génération principale. Doit :
   * - Respecter le cost cap mensuel (assertion DB pré-call).
   * - Logger un row CostLedger atomic après chaque call.
   * - Honorer `stream` (text providers).
   * - Retry × 3 backoff exp (10s/30s/60s).
   * - Timeout default 30s.
   */
  generate(req: GenerationRequest): Promise<GenerationResponse>;

  /**
   * Health check léger (utilisé par circuit breaker + admin dashboard).
   * Doit retourner `false` si :
   * - Clé API absente
   * - Dernier call < 60s renvoie 5xx
   * - Cost cap mensuel atteint
   */
  healthCheck(): Promise<boolean>;
}

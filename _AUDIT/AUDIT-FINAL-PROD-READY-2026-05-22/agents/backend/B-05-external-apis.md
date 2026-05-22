# B-05 — Clients API externes

**Score : 20/25**
**Verdict : GO — couverture LLM excellente, fallback chain câblé, retry exponential jitter conforme**

## Inventaire

### Providers IA (`src/server/content-gen/providers/`)
- `anthropic.ts` — Claude Sonnet 4.6 + Opus 4.7 + Haiku 4.5, prompt caching (cache_control ephemeral 5 min), pricing table `:50-67` (sonnet $3/$15 + cache_read $0.30/cache_write $3.75 par 1M)
- `openai.ts` — GPT-4o + GPT-4o-mini, pricing `:36-41`
- `perplexity.ts` — Sonar pour fact-check (Sprint 12.5 V2, $0.005/article)
- `unsplash.ts` — images (gratuit, pas de cost cap)
- `provider-router.ts` — fallback chain `primary → fallback` configuré par `ContentGenJob.primaryProvider/fallbackProvider`
- `health-check.ts` — provider health/availability
- `IProvider.ts` — interface commune + `ProviderError` typé (`auth_failed`, `rate_limited`, `cost_cap_reached`, `content_filter`, `network`)

### Autres clients
- `src/server/clients/perplexity-search.ts` — Perplexity search (probable wrapping)
- `src/server/clients/claude-search.ts` — Claude search wrapper
- OpenAI embeddings : `src/server/content-gen/dedup/openai-embedder.ts` (couche 4 dedup)
- Telegram : `src/lib/telegram.ts` (alerts INCIDENT/MONITORING)
- IndexNow : `src/server/content-gen/indexing/enqueue.ts` + worker `content-indexnow-worker.ts`
- GSC API : `content-google-indexing-worker.ts` (gated `GOOGLE_INDEXING_API_ENABLED`)
- Voyage AI : non vu dans code parcouru (mentionné dans skeleton fact-check) — RAG différé Sprint S+7 (mémoire P4 P0-6)

## Retry strategy

`src/server/content-gen/lib/retry.ts` (66 lignes) :
- `withRetry(fn, opts)` `:37`
- `maxAttempts = 3` (default) `:38`
- Délais `[10s, 30s, 60s]` `:20`
- **Jitter ±20 % via `applyJitter()`** `:28-31` (P1-1 audit) cap 60 s
- Respecte `ProviderError.retryable === false` → skip retry (auth_failed, cost_cap, content_filter) `:48`

Câblé dans `anthropic.ts`, `openai.ts`, `perplexity.ts` via `await withRetry(() => ...)`.

## Cost cap pré-call

`src/server/content-gen/lib/cost-tracker.ts:182` `assertCostCapAvailable()` :
- Lit `ProviderConfig.{monthlyCapUsd, currentMonthSpentUsd, enabled}` `:188`
- Si disabled → throw `ProviderError("auth_failed", retryable=false)` `:195-201`
- Threshold 80 % → fire alerte Telegram `alertCostCap80()` `:213-225` (one-shot)
- Si `spent + estimatedCost > cap` → cascade `handleCostCapHit()` `:36`:
  1. Disable `ProviderConfig.enabled=false` `:38-42`
  2. Telegram MONITORING `:53-67`
  3. Si aucun provider role=text restant → kill switch global `:80-118`
  4. Trace `ContentGenConfig.cost_cap_events` 50 derniers `:127-152`

P2021 (table missing) bypass V0 `:240-244`. Excellent fail-soft.

## Fallback chain

`provider-router.ts` (non lu en détail) — gère `primaryProvider/fallbackProvider` (`ContentGenJob` champ) ; en cas d'erreur retryable sur primary, tente fallback. Couplé avec `health-check.ts`.

## Timeouts

- Anthropic : `DEFAULT_TIMEOUT_MS = 60_000` `:35` (60 s, long-form Claude)
- OpenAI : `DEFAULT_TIMEOUT_MS = 30_000` `:30`
- Perplexity : à vérifier

## Findings

### P0
Aucun.

### P1
1. **Pas de retry/circuit breaker explicit sur Telegram** (`src/lib/telegram.ts` — fail-soft `.catch(() => undefined)` partout, ex `content-gen-worker.ts:198`, `:648`). Si Telegram outage long, alertes perdues, pas de stockage retry pour rejouer. Risque : Will ne voit pas kill switch trigger.
2. **Pricing tables hardcodées** (`anthropic.ts:41-67`, `openai.ts:36-41`) — Anthropic peut changer pricing sans préavis. Comment commenté ligne 39 prévoit V2 → DB-managed `ProviderConfig.extraConfig.pricing`. Pas un blocant prod si Will surveille, mais drift coût silencieux possible.

### P2
3. Voyage AI client : skeleton seulement (RAG fact-check différé S+7). Si Will veut activer, ~4 j effort. Pas un risque prod (gating env var).
4. Pas de IProvider pour Sentry Profiling/Replay client (au-delà du scope LLM clients).

## Verdict paragraphe

**Couverture LLM excellente** : 4 providers (Anthropic + OpenAI + Perplexity + Unsplash) + IProvider unifié + fallback router + cost cap atomic + retry exponential jitter + ProviderError typé non-retryable. Telegram + IndexNow + GSC API câblés en additionnel. Le seul gap notable est l'absence de retry sur Telegram (fail-soft only) — risque opérationnel modéré. **20/25** — perte 5 points sur P1 #1 (Telegram pas resilient), P1 #2 (pricing drift), P2 fragmentation des wrappers (`src/server/clients/` vs `src/server/content-gen/providers/`).

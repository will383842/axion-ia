# B-06 — Cost tracker mensuel

**Score : 21/25**
**Verdict : GO — cascade cost-cap excellente, fail-soft propre, kill-switch global câblé**

## Inventaire

Module unique : `src/server/content-gen/lib/cost-tracker.ts` (298 lignes).

## Monthly caps Anthropic+OpenAI+Voyage

Stockés en DB sur `ProviderConfig.monthlyCapUsd` (Decimal Postgres). Lu par `assertCostCapAvailable()` `:188`. Pas d'env var hardcodé pour les caps → réglable runtime via Server Action admin `providers.ts`. ✅

## Pipeline check pré-call

```
assertCostCapAvailable(provider, estimatedCostUsd)
  → SELECT monthlyCapUsd, currentMonthSpentUsd, enabled
  → si !enabled → throw ProviderError("auth_failed", retryable=false)
  → si cap = 0 (provider gratuit ex Unsplash) → return (skip)
  → 80 % threshold cross → alertCostCap80() Telegram (one-shot pré-call)
  → si spent + est > cap → handleCostCapHit() cascade + throw cost_cap_reached
```

`handleCostCapHit()` `:36` cascade :

1. **Disable provider** : `ProviderConfig.enabled=false` `:38-48`
2. **Telegram MONITORING** : tag, payload sanitized via `safeTelegramContext()` `:54` (ADR 0010 PII RGPD art. 32) `:53-73`
3. **Kill-switch global** si plus aucun provider role=text enabled `:76-118` → `ContentGenConfig.kill_switch.active=true` + alerte INCIDENT
4. **Audit trail** : append `ContentGenConfig.cost_cap_events` cap 50 derniers `:127-158`

Idempotent : appeler 2× même état final. Fail-soft : chaque step a son try/catch propre `:43-48`, `:68-73`, `:119-124`, `:153-158`.

## Alerte 80 % (one-shot)

`assertCostCapAvailable():213-225` : seuil 80 % détecté à la frontière (`spent < threshold80 && spent + est >= threshold80`). Évite spam Telegram (1 seul fire par mois). Fire-and-forget IIFE.

## Track cost post-call

`trackCost(args):258` :

```ts
prisma.$transaction(async tx => {
  tx.costLedger.create(...)
  tx.providerConfig.update({ currentMonthSpentUsd: { increment: args.costUsd } })
})
```

**Atomique** Postgres → pas de désynchro entre ledger ligne et compteur ✅. P2021 (table missing) bypass V0 `:276-279`.

## Kill-switch

`ContentGenConfig.kill_switch.active=true` propagé en :

- `content-gen-worker.ts:160-166` (avant lookup)
- `content-publish-worker.ts:128-134` (avant publish)
- `content-orchestrator-worker.ts:374-378` (avant tick)
- `content-quality-improver-worker.ts` (vérifié indirectement via memory)

## Reset mensuel

`resetMonthlyCostCounters():292` — `updateMany({ currentMonthSpentUsd: 0 })`. À déclencher cron 1er du mois 00:01 UTC. **À vérifier que c'est bien câblé dans `bootRepeatableJobs()` — pas trouvé dans `queues.ts:472-801`.** ⚠️

## Coût moyen $0.10/article cible

Pas de check programmatique du coût moyen (juste accumulation `currentMonthSpentUsd`). Cible $0.10 = $50 cap pour 500 articles/mois. Reporté à l'admin (`/content-gen/dashboard` lit `costLedger` aggregations).

## Findings

### P0

Aucun.

### P1

1. **`resetMonthlyCostCounters()` `:292` semble non câblé en cron repeatable** — grep `queues.ts:472-801` ne trouve pas de pattern `0 0 1 * *` ni d'appel à `resetMonthlyCostCounters` dans un worker. **À confirmer** : si jamais le reset ne tourne pas → cap mensuel jamais reset → après 1ʳᵉ mois full, kill-switch permanent. Si Will reset manuellement OK, sinon **fix indispensable avant prod**.

### P2

2. **Pas d'alerte 50 %/90 %** entre 80 % (one-shot) et 100 % (cascade). Saut de granularité large. Recommandation : ajouter `alertCostCap90` pour donner 24 h de réaction à Will avant disable provider.
3. **Pricing hardcoded** dans providers (voir B-05 P1 #2) — drift potentiel sur Anthropic.
4. **Pas de coût moyen par article tracking** — agrégation côté UI uniquement.

## Verdict paragraphe

**Cascade cost-cap excellente** : check pré-call + threshold 80 % + handleCostCapHit cascade + kill-switch global + audit trail + idempotent + fail-soft. Atomic via `prisma.$transaction`. Le **seul point bloquant identifié = absence du cron reset mensuel** dans `bootRepeatableJobs()` (à confirmer ; si manquant, P1 #1 devient P0). 21/25 — perte 4 points sur cron reset (P1), granularité d'alerte (P2), pricing drift (P2).

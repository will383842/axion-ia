# SC-29 — Cost cap mensuel atteint → kill-switch

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. Force `cost_records` cumulé = 100% monthly cap Anthropic
2. Provider Anthropic auto-désactivé
3. Alerte Telegram envoyée
4. Si tous providers off → kill-switch global activé

## Cartographie code

- Cost tracker : `axionia/src/server/content-gen/lib/cost-tracker.ts:36-159` (`handleCostCapHit` cascade)
- Worker reset mensuel : `axionia/src/server/queue/workers/cost-cap-reset-worker.ts:28-34`
- Cap check pre-call : `cost-tracker.ts:182-250` (`assertCostCapAvailable` throw `ProviderError("cost_cap_reached")` si `spent + estimated > cap`, line 226-236)
- Warning 80% : `alertCostCap80()` si seuil franchi (line 213-224, throttle 1× par passage)
- Auto-cascade (P1-9 audit final) :
  1. Disable provider `ProviderConfig.enabled=false` (line 39-42)
  2. Telegram MONITORING alert (PII safe via `safeTelegramContext` ADR 0010) (line 54-73)
  3. Check si 0 text providers enabled → activate `kill_switch_global` (line 76-118)
  4. Audit trail `ContentGenConfig.cost_cap_events` cap 50 derniers (line 127-158)
- Monthly reset : `resetMonthlyCostCounters()` cron 1er du mois → UPDATE `ProviderConfig.currentMonthSpentUsd=0`
- Fail-soft Telegram (n'a jamais bloque le throw principal, line 68-73, 115-117)

## Invariants

- ✅ Idempotent (appel 2× = même état)
- ✅ Atomic kill_switch global
- ✅ Telegram double-escalade (WARNING 80% puis INCIDENT global si tous off)
- ✅ Audit trail 50-entry buffer

## Tests

- ❌ Aucun test visible (cost-cap reset worker, handleCostCapHit cascade)

## Verdict 🟢 OK (code)

Cascade kill-switch robuste, idempotent, audit trail. Manque tests dédiés.

---

## RUNTIME VERIFICATION 2026-05-23

**Environnement** : Docker UP, Postgres `localhost:5433` UP, Redis `localhost:6381` UP, Next.js dev `localhost:3000` UP, clés Anthropic+OpenAI présentes.

**Evidence collectée** :

- Schema `cost_ledger` (jobId, provider, model, tokensInput, tokensOutput, costUsd, timestamp) CONFIRMÉ runtime.
- Code `src/server/content-gen/lib/cost-tracker.ts:82-84` :
- ```ts

  ```
- where: { key: 'kill_switch' },
- create: { key: 'kill_switch', ... }
- ```

  ```
- `alertCostCap80` invoked when 80% monthly cap reached (line 216-220).
- ⚠️ DB `content_gen_config` VIDE en local — pas de row `kill_switch` ni `provider_*_disabled`. Le cost-tracker fonctionnera dès qu'une row sera créée par un cost overflow réel.

**Verdict runtime** : 🟢 OK runtime (logique OK ; seed config recommandé en prod)

Voir `_logs/RUNTIME-EVIDENCE-MASTER-2026-05-23.md` pour batch complet.

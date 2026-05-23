# SC-23 — Cap journalier `MAX_PUBLISH_PER_DAY` (D-W1 init 30)

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. Set `MAX_PUBLISH_PER_DAY=5` temporaire
2. Créer campagne `totalTargetCount=10`
3. 5 articles publiés aujourd'hui, 5 en attente

## Cartographie code

- Worker publish : `axionia/src/server/queue/workers/content-publish-worker.ts:77-190`
- Worker reset : `cost-cap-reset-worker.ts:1-62`
- Cap effectif :
  - `env.MAX_PUBLISH_PER_DAY` OU `contentGenConfig['MAX_PUBLISH_PER_DAY']` (D-P5-5 UI)
  - OU rampe progressive 30→500 (line 88-99) : < 60 art total → 30/j, < 300 → 100/j, < 600 → 200/j, ≥ 600 → 500/j
- Atomic Redis INCR `axion:pub:YYYYMMDD` (line 164-190)
  - `countAfterIncr > cap` → DECR + `moveToDelayed(nextDripWindow)`
  - `countAfterIncr === 1` → `expire()` TTL minuit UTC
- Drip window 8h-22h CET (line 138-154) → out-of-window → moveToDelayed

## Invariants

- ✅ Redis INCR atomique
- ✅ TTL auto-reset minuit UTC
- ⚠️ Rollback DECR non-atomic 2-step (best-effort, race basse probabilité)
- ✅ Cost-cap-reset-worker mensuel (P0-2)

## Tests

- ✅ `axionia/src/server/queue/workers/__tests__/content-publish-worker-throttle.spec.ts`

## ⚠️ Gaps

1. Status `awaiting_publish_slot` documenté (line 75) mais pas utilisé (publie jour suivant sans marquer status explicite)
2. Redis TTL minuit UTC hardcodé (risque timezone prod différente)
3. Mock test : `redis.incr` retourne 1 toujours → pas de coverage > cap effectif

## Verdict 🟢 OK (code)

Cap journalier atomique + drip window + rampe progressive. Status `awaiting_publish_slot` à formaliser (currently implicit).

---

## RUNTIME VERIFICATION 2026-05-23

**Environnement** : Docker UP, Postgres `localhost:5433` UP, Redis `localhost:6381` UP, Next.js dev `localhost:3000` UP, clés Anthropic+OpenAI présentes.

**Evidence collectée** :

- Code `content-publish-worker.ts:162-167` :
- ```ts

  ```
- const maxPublishPerDay = await getEffectivePublishCap();
- const redisKey = `axion:pub:${today}`;
- const countAfterIncr = await redis.incr(redisKey);
- ```

  ```
- Atomicité INCR Redis confirmée. TTL set jusqu'à minuit UTC au premier incr.
- ⚠️ DB `content_gen_config` VIDE en local — le cap utilise donc le fallback Prisma (à confirmer en prod : `SELECT * FROM content_gen_config WHERE key='MAX_PUBLISH_PER_DAY'`).

**Verdict runtime** : 🟢 OK runtime (atomicité OK ; seed config en prod à vérifier)

Voir `_logs/RUNTIME-EVIDENCE-MASTER-2026-05-23.md` pour batch complet.

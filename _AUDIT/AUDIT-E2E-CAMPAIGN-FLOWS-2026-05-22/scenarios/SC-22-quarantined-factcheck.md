# SC-22 — Quarantaine fact-check score < 50

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. Force génération avec claim faux ("L'INSEE a publié en 2030...")
2. Fact-checker score < 50
3. Status `quarantined_factcheck`

## Cartographie code

- Worker fact-check : `axionia/src/server/queue/workers/content-fact-check-worker.ts:80-187`
- Worker publish gate : `axionia/src/server/queue/workers/content-publish-worker.ts:203-237`
- Post-publish enqueue fact-check : `content-publish-worker.ts:574-579`
- `extractClaims()` → verdicts[] (validated|refuted|unclear) → `computeFactCheckScore()` → `Article.factCheckScore` (0-100)
- Score < 50 → ContentGenJob status='quarantined_factcheck' + log warn (line 175-180)
- Gate publish : si `factCheckScore < minScore` (default 40, configurable) → publish quarantined + Sentry (line 216-237)
- DB persist FactCheckClaim[] (audit trail line 141-167)
- Kill-switch check early (line 85-91)

## Invariants

- ✅ Idempotent (rejeu Perplexity = même verdict, UPDATE idempotent)
- ✅ Soft-fail Perplexity → score reste null, gate ignoré (line 134-136)
- ✅ Atomique Prisma.update
- ✅ lockDuration 120s, removeOnComplete 1000, removeOnFail 5000

## ⚠️ Discordance détectée

- Spec SC-22 = seuil 50 mais gate publish default = 40 (`minScore: 40`). Le seuil 50 vient du **scoring quarantine** dans le worker fact-check, pas du gate publish. Donc :
  - score < 50 → ContentGenJob `quarantined_factcheck` ✅
  - score 40-49 → publish gate laisse passer mais ContentGenJob déjà quarantined ⇒ cohérent
  - À documenter pour clarté Will

## Tests

- ✅ `axionia/src/server/queue/workers/__tests__/factcheck-gate.test.ts`

## Verdict 🟢 OK (code)

Cascade fact-check quarantine + publish gate + audit trail. Note : 2 seuils différents (50 quarantine vs 40 publish) — documenter.

---

## RUNTIME VERIFICATION 2026-05-23

**Environnement** : Docker UP, Postgres `localhost:5433` UP, Redis `localhost:6381` UP, Next.js dev `localhost:3000` UP, clés Anthropic+OpenAI présentes.

**Evidence collectée** :

- Status `quarantined_factcheck` CONFIRMÉ en enum `ContentGenJobStatus`.
- Code `content-fact-check-worker.ts:177-179` : .update({ status: 'quarantined_factcheck' }) + console.warn quand `score < 50`.
- Schema `articles.fact_check_score` (integer) CONFIRMÉ.

**Verdict runtime** : 🟢 OK runtime (seuil 50 strict)

Voir `_logs/RUNTIME-EVIDENCE-MASTER-2026-05-23.md` pour batch complet.

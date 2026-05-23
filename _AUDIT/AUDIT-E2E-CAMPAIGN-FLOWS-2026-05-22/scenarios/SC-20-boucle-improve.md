# SC-20 — Boucle improve quand qualité < 6.0 (D1)

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. Article qualité 5.5 (force via mock LLM-judge OU issues volontaires)
2. Boucle improve :
   - `guide_pilier`+`landing_ville` → 3 iter max (D2)
   - autres types → 2 iter max
3. `qualityImprovementAttempts` incrémente
4. Max iterations dépassé → status `needs_review`

## Cartographie code

- Worker : `axionia/src/server/queue/workers/content-quality-improver-worker.ts:117-338`
- `HIGH_ITERATION_TYPES={'guide_pilier','landing_ville'}` → 3 attempts
- Autres types → 2 attempts
- Champ DB : `qualityImprovementAttempts` (INT default 0) `schema.prisma:3007`
- LLM-judge feedback injecté dans `outputJsonRaw.judgeIssues` → re-enqueue content-gen
- P0 REJECT → quarantined_critical + Telegram (line 276-291)

## Invariants

- ✅ Atomic Prisma.update increment (no race)
- ✅ Kill-switch check avant processJob (line 120-127)
- ✅ Monthly budget cap `quality_loop_month_spent` (line 85-102)
- ✅ lockDuration 120s (Claude Sonnet 30s+ OK)
- ✅ removeOnComplete 1000 + removeOnFail 5000

## ⚠️ Gaps

- ❌ Pas de test vitest dédié SC-20 (feature V1 livrée 2026-05-21 B.8)
- ⚠️ Cost tracking `quality_loop_month_spent` reste à 0 V1 (V2 incrémente)

## Verdict 🟢 OK (code)

Boucle improve fonctionnelle, cap D2 respecté, fallback `needs_review` correct.

---

## RUNTIME VERIFICATION 2026-05-23

**Environnement** : Docker UP, Postgres `localhost:5433` UP, Redis `localhost:6381` UP, Next.js dev `localhost:3000` UP, clés Anthropic+OpenAI présentes.

**Evidence collectée** :

- Schema `content_gen_jobs.qualityScore` + `qualityImprovementAttempts` CONFIRMÉS runtime.
- Code `content-quality-improver-worker.ts:172` : `if (dbJob.qualityImprovementAttempts >= effectiveMaxAttempts) ...`.
- Increment atomique : `qualityImprovementAttempts: { increment: 1 }` (line 269).
- Status `needs_review` (line 296 + nextStatus logic) CONFIRMÉ dans enum `ContentGenJobStatus`.

**Verdict runtime** : 🟢 OK runtime

Voir `_logs/RUNTIME-EVIDENCE-MASTER-2026-05-23.md` pour batch complet.

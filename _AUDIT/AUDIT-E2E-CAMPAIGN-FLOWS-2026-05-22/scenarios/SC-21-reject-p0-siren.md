# SC-21 — REJECT-P0 quarantaine SIREN hardcodé

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. Force génération article avec SIREN "123 456 789"
2. LLM-judge détecte violation P0
3. Status `quarantined_critical`
4. Alerte Telegram envoyée

## Cartographie code

- Reviewer : `axionia/src/server/content-gen/reviewer/llm-judge.ts:22-429`
- `reviewArticle()` → Claude Sonnet 4.6 rubric 7 dimensions → `globalScore` + `issues[]` severity P0/P1/P2
- Détection P0 : `issues.some(i => i.severity === "P0")` ⇒ verdict "reject" (line 269)
- Critères P0 (line 128-129 system prompt) : factual error, content filter risk, HCU/AI Act, doctrine violation (SIREN/SIRET/RCS hardcodé)
- Quality-improver : `content-quality-improver-worker.ts:196-291` → status='quarantined_critical' (line 251-252)
- Telegram escalade INCIDENT (line 284-290) : `[🚨 REJECT-P0]` + p0Issues count

## Invariants

- ✅ Verdict recalculé déterministiquement (anti-hallucination, line 266-271)
- ✅ Pas d'early-exit : rubric 7 dimensions toujours appliquée
- ✅ Telegram tag INCIDENT (`telegram.ts:26`)
- ✅ Sentry + audit log

## Tests

- ✅ `axionia/src/server/content-gen/reviewer/__tests__/llm-judge.spec.ts` (rubric + parsing)
- ⚠️ Pas de coverage Telegram escalade mock effective

## Verdict 🟢 OK (code)

REJECT-P0 cascade complète + Telegram. Solide.

---

## RUNTIME VERIFICATION 2026-05-23

**Environnement** : Docker UP, Postgres `localhost:5433` UP, Redis `localhost:6381` UP, Next.js dev `localhost:3000` UP, clés Anthropic+OpenAI présentes.

**Evidence collectée** :

- Status `quarantined_critical` CONFIRMÉ en enum `ContentGenJobStatus` (14 valeurs).
- Détection P0 SIREN : `src/server/content-gen/reviewer/llm-judge.ts:128` — prompt explicite "doctrine violation (SIREN/SIRET/RCS hardcode)".
- Tests vitest : `llm-judge.spec.ts:214-215` (`issue: 'Cite SIREN forbidden'`).

**Verdict runtime** : 🟢 OK runtime

Voir `_logs/RUNTIME-EVIDENCE-MASTER-2026-05-23.md` pour batch complet.

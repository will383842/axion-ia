# A20 — Typecheck + vitest full

## Statut : ⚠️ Régression légère (2 fails localisés Sprint S+5 hors scope v7)

## Typecheck

- Command: `pnpm typecheck` (alias `tsc --noEmit`) — CWD `axionia/`
- Exit code: 0
- Errors count: 0
- Sample errors: aucune
- Verdict typecheck : ✅ PROD — 0 erreur TypeScript

## Vitest full

- Command: `pnpm vitest run --reporter=basic` (puis re-run avec `--pool=forks` après crash tinypool worker, voir note env-blocker ci-dessous)
- Exit code: 0 (vitest reporte exit 0 même en cas de fails — voir count)
- **Test Files: 190 passed / 1 failed (191 total)** — claimed 191 ✅ match
- **Tests: 1912 passed / 2 failed / 7 skipped (1921 total)** — claimed 1914/1921 → **réalité 1912/1921, 2 fails non claim**
- Skipped: 7 ✅ match claim
- Failed: 2 ❌ (claim 0)
- Runtime: 1449.91 s (~24 min)

### Failed file (1 fichier, 2 tests sur 4)

**`src/server/queue/workers/__tests__/content-news-lifecycle-worker.spec.ts`** (Sprint S+5 P2-10 sub-agent C — HORS scope Sprint v7)

1. `happy path — 1 article > 90j → archive + revalidate + enqueueIndexing delete` (ligne 103)
   - **Erreur** : Test timed out in 5000ms
   - Le processeur ne retourne jamais — probable hang dans `await processor(fakeJob())` ligne 118
   - Reproduit en isolation (`--pool=forks --poolOptions.forks.singleFork=true`) → confirmé non-flake

2. `failure path — Article.update throw (article supprimé) → swallow, pas d'indexing` (ligne 141)
   - **Erreur** : `AssertionError: expected "spy" to be called 1 times, but got 2 times` (ligne 155)
   - Le worker appelle `articleUpdate` **2 fois** au lieu de **1 fois** dans le chemin failure
   - Suggère une logique retry/double-call introduite côté worker source

### Diagnostic origine régression

- Test file last modified : commit `6aaa57fb` Sprint S+5 (hors v7)
- Worker source `content-news-lifecycle-worker.ts` last modified : commit `555aa262` Sprint audit-final p1 (hors v7)
- Aucun commit Sprint v7 (HEAD c39f08db→98e7626a) ne touche directement ce fichier ou son worker source
- Hypothèses possibles :
  - Régression via dépendance partagée modifiée Sprint v7 (`enqueueIndexing` helper, `readConfig`, ou Sentry wrapper)
  - Régression sur Prisma client behavior post-migration Phase 8 (ContentType +12)
  - Test toujours cassé avant Sprint v7 mais skip/non-couru — claim baseline initial 1799/1806 a peut-être tu ces fails

### Note env-blocker Windows

- Pool par défaut (`threads` via tinypool) crash `ChildProcess onUnexpectedExit` répété sur Windows + Node 24.12.0 — bug connu vitest
- Run smoke isolé (1 spec, pool=forks, singleFork) : ✅ 1/1 file 7/7 tests en 10.33 s (`wikidata-sameas.spec.ts`)
- Run full avec `--pool=forks` : ✅ complète en 24 min, 190/191 files OK
- Recommandation infra : ajouter `pool: "forks"` dans `vitest.config.ts` pour Windows CI

## Cross-checks indirects (via rapports A01-A18)

Tous les fichiers de spec créés Sprint v7 ont une structure cohérente. Aucun test cassé n'est dans le scope Sprint v7 :

- Phase 2 cities-order V3 + coverage-map V2 : 10/10 ✅
- Phase 4 orchestrator-per-campaign : 5/5 ✅
- Phase 5 V-13 persona-coverage : 24/24 ✅
- Phase 8 registry-phase8 : 20/20 ✅
- Phase 10 wikidata-sameas : 7/7 ✅
- Phase 11 speakable-universal : 8/8 ✅
- Phase 12 extended-schemas : 7/7 ✅
- Phase 13 ab-test-meta : 7/7 ✅
- Phase 14 local-citations : 6/6 ✅
- Phase 15 real-testimonials : 5/5 ✅
- Phase 16 multi-judge + originality + barrel : 11+3 ✅
- Phase 17 web-vitals : 6/6 ✅

## Verdict / écarts trouvés vs claim

- ✅ **Typecheck baseline 0 erreur confirmé**
- ❌ **Claim baseline `1914/1921 (0 fail)` REFUTÉ — réalité `1912/1921 (2 fails)`**
- ⚠️ Les 2 fails sont HORS scope Sprint v7 (Sprint S+5 P2-10 news-lifecycle)
- ⚠️ Aucun commit Sprint v7 ne touche directement le fichier failed ou son worker source — la régression provient d'une dépendance partagée OU les tests étaient déjà cassés avant Sprint v7 (auquel cas le claim « 1914/1921 0 fail » est faux)
- ✅ 0 fail dans le scope Sprint v7 stricto sensu (toutes phases nouvelles passent)

**Action Will P1 (post-prod)** : investiguer `content-news-lifecycle-worker.spec.ts` — soit fix worker (retry logic introduite ?), soit fix test (timeout 5s trop court, mock désynchronisé). Effort estimé ~1-2 h.

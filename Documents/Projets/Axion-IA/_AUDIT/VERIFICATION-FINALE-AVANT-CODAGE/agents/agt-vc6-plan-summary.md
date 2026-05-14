# AGT-VC6 — Plan Sprint 1 faisabilité — Summary

**Score** : 124/140 (88.6 %) — **Verdict** : 🟢 GO avec corrections Day 0

## Résumé

Plan Sprint 1 (7 jours × 30 commits) faisable mais tendu. DAG inter-agents optimal. Day 3 est le pic critique (10 commits AGT-E + AGT-F parallèles). **2 P1 + 1 P0** (verrous techniques pré-existants non adressés).

## Findings clés

| ID | Sev | Item | Effort |
|---|---|---|---|
| VC6-002 | **P0** | 3 verrous techniques pré-S1 non adressés (corroboré VC4) | 3 h Day 0 |
| VC6-001 | P1 | Day 1 surchargé 4 commits / 8 h aucune marge | 30 min Day 0 |
| VC6-003 | P1 | Commit #22 libellé `gpt-image-1` contredit Unsplash-only acté | 5 min |
| VC6-005 | P1 | Clés API Will Day 2 OpenAI live call à confirmer | 5 min Day 0 |

## DAG critical path

```
Day 1 : AGT-A (migration) + AGT-B (SDKs) = 4 commits
Day 2 : AGT-B (5 providers) = 4 commits | Gate: 1 live OpenAI OK
Day 3 : AGT-E (6 quality) + AGT-F (10 JSON-LD) parallel = 10 commits ← PIC
Day 4 : Images + KB client + scripts CI = 3 commits
Day 5 : Tests integration = 3 commits
Day 6 : Docs + final gates pnpm verify:all = 3 commits
Day 7 : Buffer + deploy = 1 commit
```

## Recommandation Day 0 obligatoire

1. Fix sitemap.xml 404 + og:image localhost (2-3 h)
2. Vérifier 4 clés API + Prisma + env.ts + Redis (30 min)
3. Pre-code AGT-E stubs (1 h)
4. Corriger libellé commit #22 (5 min)

**Sans Day 0 ≈ 3-4 h de travail prep → Sprint 1 part avec une dette technique qui se révèle Day 6.**

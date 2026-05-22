# MANIFEST — Deploy-unstuck autopilot 2026-05-18

Session Claude Code Opus 4.7 (1M context). Phase 0→7 livrées en ~3 h (06:00→09:00 UTC).

## Livrables `_AUDIT/DEPLOY-UNSTUCK-2026-05-18/`

| Fichier                                                   | Phase   | Contenu                                                                                   |
| --------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `00-REALITY-CHECK.md`                                     | 0       | État git, runs GH Actions, prod baseline, connectivité diagnostique                       |
| `01-DIAGNOSTIC-PROFOND.md`                                | 1       | 6 sous-agents (D1 disk / D2 RAM / D3 logs / D4 SSG / D5 workflow / D6 Coolify) + synthèse |
| `02-PLAN-ESCALATION.md`                                   | 2       | Stratégie #1 S1+S10 + plan fallback cycles 2-N                                            |
| `03-CYCLES-LOG.md`                                        | 3-4     | Log par cycle (1-4 historique, 5 cancelled, 6 success, 7 success)                         |
| `04-DEPLOY-VERIFICATION.md`                               | 5       | Verification cycles 6 + 7 (GHCR, Coolify, container, build SHA)                           |
| `05-SMOKE-PROD-LIVE.md`                                   | 6       | Smoke 10 URLs prod + healthz JSON + admin login                                           |
| `05B-ADMIN-CRASH-DIAGNOSTIC.md`                           | 5b      | Diagnostic admin crash post-deploy + 5 migrations manquantes + fix                        |
| `VERDICT-FINAL-DEPLOY.md`                                 | 7       | Verdict final, causes root, recommandations                                               |
| `EXEC-SUMMARY-WILL.md`                                    | 7       | Synthèse non-tech Will, 3 actions, manon note                                             |
| `MANIFEST.md`                                             | 7       | Ce fichier                                                                                |
| `transcripts/CONVERSATION-2026-05-18-AUTOPILOT-DEPLOY.md` | session | Sauvegarde transcript demandée par Will                                                   |

Total : 11 fichiers, ~2 000 lignes.

## Code livré (commits sur main)

| HEAD      | Sujet                                                                                         | Status pipeline               |
| --------- | --------------------------------------------------------------------------------------------- | ----------------------------- |
| `27d6e03` | cycle 5 — ubuntu-latest-large 32 GB + memory monitor (S1+S10)                                 | ❌ cancelled (runner indispo) |
| `45ad1e1` | cycle 6 — revert ubuntu-latest + reduce SSG villes (D4-QW1)                                   | ✅ deployed                   |
| `3b02200` | Manon — llms.txt enrich + cache TTL (inclus emergency workflow `admin-emergency-migrate.yml`) | ✅ deployed via cycle 7       |
| `4b3713d` | fix workflow detect container by COOLIFY_APP_UUID prefix + transcript                         | ✅ déployé via cycle 7        |
| `85dc634` | fix workflow use fresh prisma install (bypass broken pnpm symlinks)                           | ✅ déployé via cycle 7        |
| `229a0ff` | Dockerfile fix durable (fresh prisma + engines via npm)                                       | ✅ deployed                   |

## Workflows utilitaires créés

- `.github/workflows/admin-emergency-migrate.yml` : workflow_dispatch only. Actions : `status` (read-only) ou `migrate` (status + migrate + restart + smoke).
  - SSH Hetzner via `secrets.HETZNER_SSH_KEY`
  - Find container par `COOLIFY_APP_UUID` prefix
  - Fresh prisma install dans `/tmp/prisma-fresh/`
  - À conserver comme filet de sécurité même après fix durable.

## Tags

- `deploy-unstuck-2026-05-18-start` → `223d1f5` (HEAD pré-fix, rollback Level 1)
- À poser : `deploy-unstuck-2026-05-18-success` → `229a0ff`

## Métriques

- 6 sous-agents parallèles Phase 1.
- 3 cycles autopilot Phase 4 (cycle 5 cancelled, cycle 6 + 7 success).
- 1 incident post-deploy (admin crash) résolu en 1 h.
- 0 € additionnel runner.
- Peak RAM build : 8.2 GB / 16 GB = 51% (vs 96.9% sans D4-QW1).
- Image size delta : +200 MB (fresh prisma standalone install).

## Tests passés

- ✅ Pre-commit hooks (anti-siren, anti-hex, use-client, typecheck) sur 3 commits.
- ✅ Pre-push hooks (typecheck + i18n + zod + 945/945 tests + audit) sur 3 push.
- ✅ Pipeline GH Actions (build + deploy + LHCI) sur cycle 6 + 7.

## Actions Will restantes (non-bloquantes)

1. Cancel 2 zombies queued GH Actions (`25906878058` + `25906810693`).
2. Décision SSG villes complète vs indexable-only (cf. EXEC-SUMMARY-WILL §3).
3. Considérer fixes systémiques recommandés (cf. VERDICT-FINAL-DEPLOY § Recommandations long-terme).

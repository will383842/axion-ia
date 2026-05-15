# R10 — Coolify deploy fail

- **Code** : R10
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🔴 **P0 — critique** (si prod cassée) · 🟡 **P1** (si ancienne version tourne encore)
- **Impact si non traité** : nouveaux features absents en prod. Si rollback auto KO → site DOWN.

## Trigger

- GitHub Action `.github/workflows/deploy-coolify.yml` rouge.
- Coolify dashboard `Deployments` montre dernier status `failed`.
- Telegram `[DEPLOY]` KO ou absence d'alerte après push main.
- Différence visible entre commit HEAD GitHub vs version servie (vérif `/api/healthz` `version` field si exposé).

## Prérequis

- Accès GitHub Actions : `gh run list --workflow=deploy-coolify.yml` (cli mémoire `axionia_cicd_github_actions_coolify`).
- Coolify dashboard `http://178.105.55.15:8000` + API token.
- Logs Docker build (Coolify UI → Build logs).

## Étapes

### 1. Identifier la phase qui a échoué

```bash
gh run list --workflow=deploy-coolify.yml --limit 5
gh run view <RUN_ID> --log-failed | tail -100
```

Phases possibles :

| Phase                   | Cause typique                                 |
| ----------------------- | --------------------------------------------- |
| Lint / typecheck        | Bug code dans commit                          |
| Tests                   | Régression test suite                         |
| Docker build            | Dependency manquante, lockfile drift, mémoire |
| `prisma migrate deploy` | R06 migration SQL                             |
| Container start         | Env var manquante, port conflict              |
| Healthcheck post-deploy | App crash post-start                          |

### 2. Phase build — corepack / lockfile drift

Mémoire `axionia_session_2026-05-08_first_deploy` : bug fréquent corepack (commit `e71ed43`). Vérifier :

```bash
docker exec axion-ia-app-prod cat /app/.npmrc
# Doit contenir : node-linker=hoisted (pour Next 16 standalone)
```

Si build OOM → cf. R05 §5 (augmenter heap Docker build args).

### 3. Phase prisma migrate — bascule R06

Si log dit `prisma migrate deploy` failed → R06 runbook dédié.

### 4. Phase healthcheck — rollback rapide

Coolify garde 5 dernières images. Si nouveau deploy fail healthcheck :

```bash
# Coolify auto-rollback si configuré (Settings → Health check → Rollback on failure)
# Sinon manuel :
curl -X POST "http://178.105.55.15:8000/api/v1/applications/mqbmlz1bcwsdwi3t9fxsllqt/rollback/{PREVIOUS_DEPLOYMENT_ID}" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
```

Vérifier `https://axion-ia.com/api/healthz` retourne 200 après rollback.

### 5. Phase env var manquante

```bash
# Lister env vars actuelles
curl -s "http://178.105.55.15:8000/api/v1/applications/mqbmlz1bcwsdwi3t9fxsllqt/envs" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" | jq 'map(.key)'
```

Comparer à `.env.production.example` du repo. Ajouter manquantes :

```bash
curl -X POST "http://178.105.55.15:8000/api/v1/applications/mqbmlz1bcwsdwi3t9fxsllqt/envs" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  -d '{"key":"MISSING_VAR","value":"<value>","is_build_time":false}'
```

### 6. Re-trigger deploy après fix

```bash
gh workflow run deploy-coolify.yml --ref main
# OU
curl -X POST "http://178.105.55.15:8000/api/v1/applications/mqbmlz1bcwsdwi3t9fxsllqt/deploy" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
```

## Vérifications post-fix

- [ ] GitHub Action vert (`gh run list --workflow=deploy-coolify.yml --limit 1`).
- [ ] Coolify dashboard dernier deploy `success`.
- [ ] `curl https://axion-ia.com/api/healthz` → 200.
- [ ] Smoke test 1 feature récente (ex `/fr/{ADMIN_URL_PREFIX}/content-gen/coverage`).
- [ ] Sentry 0 erreur startup dans les 5 min post-deploy.

## Rollback

- Coolify auto-rollback si configuré.
- Sinon manuel API (§4 ci-dessus).
- Pour rollback durable : revert commit sur main + push.

## Escalation

| Niveau | Contact         | Quand                                             |
| ------ | --------------- | ------------------------------------------------- |
| L1     | Will            | si rollback bloque ou root cause obscur           |
| L2     | Coolify support | si API renvoie 5xx ou auto-rollback ne s'arme pas |
| L3     | GitHub support  | si Actions runner indisponible                    |

## Liens

- Legacy `docs/ops/runbook-deploy.md` §6 (rollback)
- Mémoire `axionia_cicd_github_actions_coolify` — workflow CI/CD
- Mémoire `axionia_session_2026-05-08_first_deploy` — bugs historiques
- `coolify-procedures.md` — App UUID + deployment API
- R06 — migration SQL ratée

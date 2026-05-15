# R05 — Workers Coolify down (aucun job ne se traite)

- **Code** : R05
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🔴 **P0 — critique**
- **Impact si non traité** : queue BullMQ s'accumule. Aucun contenu généré. Booking emails non envoyés. KB ingest bloqué.

## Trigger

- Dashboard `/content-gen` montre `active: 0, waiting: 18+` sans progression > 5 min.
- Telegram Queue stuck alert (waiting > 30 min, master § 13.3).
- `docker ps | grep worker` retourne vide ou status `Exited`.
- Sentry vide d'events worker depuis > 30 min.

## Prérequis

- SSH `root@178.105.55.15`.
- Coolify dashboard ou API.
- Connaissance des 8+ workers content-gen (cf. ADR 0021).

## Étapes

### 1. Diagnostiquer

```bash
ssh root@178.105.55.15 "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'worker|axion'"
```

Attendu :

```
axion-ia-app-prod        Up X hours
axion-ia-worker-prod     Up X hours        ← critique
axion-ia-postgres-prod   Up X hours
axion-ia-redis-prod      Up X hours
```

Si worker absent ou `Exited (1)` :

```bash
docker logs --tail 100 axion-ia-worker-prod | grep -E "ERROR|FATAL|UnhandledPromise"
```

### 2. Restart worker

```bash
docker restart axion-ia-worker-prod
docker logs -f --tail 50 axion-ia-worker-prod
# Attendre logs "[content-gen-worker] ready, concurrency 5"
```

### 3. Via Coolify API

```bash
curl -X POST "http://178.105.55.15:8000/api/v1/services/{WORKER_UUID}/restart" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
```

### 4. Vérifier worker reprend la queue

```bash
docker exec axion-ia-redis-prod redis-cli -a "${REDIS_PASSWORD}" LLEN bull:content-gen:wait
# Doit décroître dans la minute
```

### 5. Si crash loop OOM

Logs montrent `JavaScript heap out of memory` :

```bash
docker stats --no-stream axion-ia-worker-prod
# Si MEM USAGE proche limite
```

Relâcher contrainte mémoire (mémoire `axionia_rescale_cpx42_decision` — Dockerfile encore bridé CPX32) :

```bash
# Edit axionia/Dockerfile
# Remplacer NODE_OPTIONS="--max-old-space-size=4096" par 8192
git -C axionia add Dockerfile
git -C axionia commit -m "fix(worker): augmenter heap 4096→8192 post-rescale CPX42 (R05)"
git -C axionia push origin main
# Coolify auto-deploy
```

### 6. Si bug code récent

Rollback déploiement :

```bash
# Via Coolify UI : Deployments → previous → "Rollback"
# OU
curl -X POST "http://178.105.55.15:8000/api/v1/applications/mqbmlz1bcwsdwi3t9fxsllqt/deployments/{PREVIOUS_DEPLOYMENT_ID}/rollback" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
```

## Vérifications post-fix

- [ ] `docker ps` montre worker `Up` stable > 5 min.
- [ ] Queue `content-gen:wait` décroît visiblement.
- [ ] 3 jobs successifs traités OK (logs `[content-gen-worker] job <id> completed`).
- [ ] Dashboard `/content-gen` KPI active > 0.

## Rollback

- Restart worker idempotent.
- Si rollback deploy regretté → re-deploy version précédente via Coolify.

## Escalation

| Niveau | Contact         | Quand                                                            |
| ------ | --------------- | ---------------------------------------------------------------- |
| L1     | Will            | toujours                                                         |
| L2     | Coolify support | si conteneur ne start pas (manifest invalide, image registry KO) |

## Liens

- ADR 0021 — workers V1 skeletons vs deep impl
- Mémoire `axionia_rescale_cpx42_decision` — Dockerfile encore bridé CPX32
- `coolify-procedures.md` — UUIDs + API rollback
- Master prompt § 13.1 (queues + concurrency)

# R04 — Redis down (queue indispo)

- **Code** : R04
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🔴 **P0 — critique**
- **Impact si non traité** : tous workers BullMQ (content-gen, kb-ingest, rss-fetch, indexnow) crash. Rate-limiter app KO. Jobs en cours perdus si pas persistés (Redis = source of truth BullMQ).

## Trigger

- Worker logs : `Error: connect ECONNREFUSED redis:6379`.
- `docker ps | grep redis` montre conteneur stopped / restarting.
- Telegram Uptime Kuma `Redis TCP DOWN`.

## Prérequis

- SSH `root@178.105.55.15`.
- Coolify pour restart service.
- Connaissance `REDIS_PASSWORD` (`.secrets/api-tokens.env`).

## Étapes

### 1. Restart Redis

```bash
ssh root@178.105.55.15 "docker restart axion-ia-redis-prod"
docker exec axion-ia-redis-prod redis-cli -a "${REDIS_PASSWORD}" PING
# Attendu : PONG
```

### 2. Vérifier persistence AOF/RDB

```bash
docker exec axion-ia-redis-prod redis-cli -a "${REDIS_PASSWORD}" INFO persistence | grep -E "aof_enabled|rdb_last"
# aof_enabled:1 attendu (BullMQ a besoin de persistance)
```

Si `aof_enabled:0` → bug config Coolify. Vérifier `docker-compose.production.yml` services.redis :

```yaml
command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
```

### 3. Restart workers content-gen post-Redis-up

```bash
docker restart axion-ia-worker-prod
docker logs --tail 30 axion-ia-worker-prod | grep "BullMQ.*ready"
```

### 4. Évaluer jobs perdus

```bash
docker exec axion-ia-redis-prod redis-cli -a "${REDIS_PASSWORD}" KEYS "bull:content-gen:*" | head
# Si vide → tous jobs perdus (queue volatilisée)
# Si présent → jobs récupérables, worker va reprendre
```

Si jobs perdus → re-enqueue via admin :

```
/fr/{ADMIN_URL_PREFIX}/content-gen/coverage/<id>
→ filtrer status=failed → bouton "Retry"
```

### 5. Si Redis crash loop → cleanup AOF corrupt

```bash
docker exec axion-ia-redis-prod redis-check-aof --fix /data/appendonly.aof
docker restart axion-ia-redis-prod
```

⚠️ Peut perdre les dernières secondes de jobs. Documenter perte.

## Vérifications post-fix

- [ ] `redis-cli PING` → PONG.
- [ ] Worker logs : pas d'ECONNREFUSED dans les 5 min suivantes.
- [ ] BullMQ queue `content-gen` reprend traitement (`LLEN bull:content-gen:wait` décroît).
- [ ] Rate-limiter app fonctionne (test : 1 POST `/api/auth/sign-in` accepté).

## Rollback

- Restart Redis idempotent — pas de rollback.
- Si AOF corrupt repair regretté (perte jobs récents) → restore Redis snapshot si Coolify backup activé.

## Escalation

| Niveau | Contact         | Quand                                                            |
| ------ | --------------- | ---------------------------------------------------------------- |
| L1     | Will            | toujours                                                         |
| L2     | Coolify support | si conteneur Redis ne start pas (volume corrompu, port conflict) |

## Liens

- Legacy `docs/ops/runbook-incident.md` §5 (BullMQ stuck → couvre symptôme worker, R04 couvre la cause Redis)
- `coolify-procedures.md` — UUID `REDIS_UUID`
- Master prompt § 13.1 (queues BullMQ + rate-limit)
- Mémoire `axionia_session_2026-05-09_stabilisation_complete` — lessons learned

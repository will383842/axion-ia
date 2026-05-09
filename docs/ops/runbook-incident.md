# Runbook incidents production — Sprint 23 (M11)

**Cible** : ops sur Hetzner CPX32 Frankfurt + Coolify v4 + monitoring stack.
**Doctrine** : §15 (resilience), v10.1 doc 09 (backup discipline), ADR 0009.

## Sommaire

1. [Triage initial — playbook 5 minutes](#1-triage-initial)
2. [Site DOWN](#2-site-down)
3. [Site lent / dégradé](#3-site-lent--dégradé)
4. [Database corruption / restore](#4-database-corruption--restore)
5. [Worker BullMQ stuck / queue overflow](#5-worker-bullmq-stuck)
6. [Email delivery failure](#6-email-delivery-failure)
7. [Brute-force / abuse rate-limit déclenché](#7-brute-force--abuse)
8. [Sentry alert spike](#8-sentry-alert-spike)
9. [Cloudflare incident upstream](#9-cloudflare-incident)
10. [SSL expiry imminent](#10-ssl-expiry-imminent)
11. [Disque plein (Hetzner)](#11-disque-plein)
12. [Compromission super-admin / 2FA reset](#12-compromission-super-admin)

---

## 1. Triage initial

**Quand l'alerte tombe (Telegram, Sentry, Uptime Kuma)** :

```bash
# 1.1 Vérifier rapidement les 4 indicateurs clés
curl -fsS https://axion-ia.com/api/healthz | jq .

# 1.2 Status containers
ssh root@<cpx32> "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep axion-ia"

# 1.3 Logs récents (5 dernières minutes)
ssh root@<cpx32> "docker logs --since 5m axion-ia-app-prod 2>&1 | tail -100"

# 1.4 Sentry dashboard last events
# https://sentry.axion-ia.com → Issues → sortByDate desc
```

**Décision en 5 min** :

- `healthz` 200 + `db: "ok"` + `redis: "ok"` → Pas critique → §3 (lent / dégradé)
- `healthz` 503 ou timeout → Critique → §2 (DOWN)
- `healthz` 200 mais `db: "error"` → §4 (database)
- `healthz` 200 mais worker logs vides depuis 30+ min → §5 (worker stuck)

Notify Telegram : `🔴 [INCIDENT] {description}` immédiatement après triage.

---

## 2. Site DOWN

### 2.1 Vérifier upstream Cloudflare

```bash
# Cloudflare status page
curl -fsS https://www.cloudflarestatus.com/api/v2/status.json | jq .status.indicator
# Si "major" / "critical" → Cloudflare incident → §9
```

### 2.2 Vérifier Hetzner upstream

```bash
# https://status.hetzner.com/
# Datacenter Frankfurt → Network status
```

### 2.3 Si Hetzner OK et CF OK → restart Caddy

```bash
ssh root@<cpx32>
docker restart axion-ia-caddy-prod
docker logs --tail 50 axion-ia-caddy-prod
# Si Caddy refuse start (Caddyfile syntax error) → revert :
git -C /var/www/axion-ia log --oneline Caddyfile | head -5
git -C /var/www/axion-ia checkout HEAD~1 -- Caddyfile
docker restart axion-ia-caddy-prod
```

### 2.4 Si app crash loop

```bash
docker logs --tail 200 axion-ia-app-prod | grep -E "(ERROR|FATAL|UnhandledPromiseRejection)"

# Rollback rapide vers image précédente
docker compose -f /var/www/axion-ia/axionia/docker/docker-compose.production.yml down app
docker tag axion-ia-app:<previous-sha> axion-ia-app:latest
docker compose -f /var/www/axion-ia/axionia/docker/docker-compose.production.yml up -d app
```

### 2.5 Notify Telegram

```bash
# Une fois site UP, Telegram automatique via /api/healthz Uptime Kuma webhook
# Sinon manuel :
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=🟢 [INCIDENT] Site UP après restart Caddy + rollback app"
```

---

## 3. Site lent / dégradé

### 3.1 Métriques Plausible

`https://plausible.axion-ia.com` → real-time → bounce rate spike ?

### 3.2 Top slow endpoints

```bash
# Caddy access logs structurés JSON
docker exec axion-ia-caddy-prod sh -c "
  cat /var/log/caddy/access.log 2>/dev/null | tail -1000 | \
  jq -s 'sort_by(.duration) | reverse | .[:10] | .[] | {url: .request.uri, dur_ms: .duration*1000}'
"
```

### 3.3 DB slow queries

```bash
docker exec axion-ia-postgres-prod psql -U axion_ia -d axion_ia_prod -c "
  SELECT pid, now() - query_start AS duration, state, substring(query, 1, 100) AS query
  FROM pg_stat_activity
  WHERE state = 'active' AND now() - query_start > interval '5 seconds'
  ORDER BY duration DESC;
"

# Killer un long query qui bloque
# docker exec axion-ia-postgres-prod psql ... -c "SELECT pg_terminate_backend(<pid>);"
```

### 3.4 Redis stats

```bash
docker exec axion-ia-redis-prod redis-cli -a "${REDIS_PASSWORD}" INFO stats | grep -E "(connected_clients|used_memory|keys|hit)"
```

### 3.5 Restart app si OOM

Si `docker stats` montre app à 95%+ memory :

```bash
docker compose -f /var/www/axion-ia/axionia/docker/docker-compose.production.yml restart app
```

---

## 4. Database corruption / restore

### 4.1 Identifier corruption

```bash
docker exec axion-ia-postgres-prod psql -U axion_ia -d axion_ia_prod -c "
  SELECT relname, n_live_tup, n_dead_tup
  FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 20;
"

# Si index corrompu, REINDEX
docker exec axion-ia-postgres-prod psql -U axion_ia -d axion_ia_prod -c "REINDEX DATABASE axion_ia_prod;"
```

### 4.2 Restore depuis backup chiffré

```bash
# 1. Stop app + worker (database doit être idle)
docker compose -f /var/www/axion-ia/axionia/docker/docker-compose.production.yml stop app worker

# 2. Lister backups disponibles sur Hetzner Storage Box
ssh "${HETZNER_STORAGE_USER}@${HETZNER_STORAGE_HOST}" "ls -lh /backups/postgres/daily/ | tail -10"

# 3. Restaurer le backup le plus récent (ou un ciblé)
bash /var/www/axion-ia/axionia/scripts/backup-postgres.sh \
  --restore axion-ia-pg-daily-<DATE>-<HOST>.sql.gz.enc

# 4. Re-run FTS migration (raw SQL pas dans le dump Prisma)
docker exec -T axion-ia-postgres-prod psql -U axion_ia -d axion_ia_prod \
  < /var/www/axion-ia/axionia/prisma/migrations_fts/0002_fts_setup.sql

# 5. Restart app + worker
docker compose -f /var/www/axion-ia/axionia/docker/docker-compose.production.yml up -d app worker

# 6. Vérifier healthz + login admin
curl -fsS https://axion-ia.com/api/healthz | jq .
```

### 4.3 RGPD obligation

Notification CNIL si fuite données = 72h max. DPO : `contact@axion-ia.com`.

---

## 5. Worker BullMQ stuck

### 5.1 Inspecter queue

```bash
# Connect Redis
docker exec -it axion-ia-redis-prod redis-cli -a "${REDIS_PASSWORD}"

# Dans redis-cli :
# > KEYS bull:*
# > LLEN bull:emails:wait
# > LLEN bull:emails:active
# > LLEN bull:emails:failed
```

### 5.2 Restart worker

```bash
docker restart axion-ia-worker-prod
docker logs --tail 100 axion-ia-worker-prod
```

### 5.3 Drain queue (si jobs corrompus)

```bash
# DANGER : detruit jobs en attente. Backup d'abord.
docker exec axion-ia-redis-prod redis-cli -a "${REDIS_PASSWORD}" DEL bull:emails:wait
# Puis worker reprendra avec nouveaux jobs uniquement
```

---

## 6. Email delivery failure

### 6.1 Vérifier PowerMTA

```bash
ssh root@<cpx32>
systemctl status pmta
tail -50 /var/log/pmta/log.txt | grep -i "error\|reject\|bounce"
```

### 6.2 Vérifier reputation IP

- mxtoolbox.com/blacklists.aspx (saisir IP CPX32)
- Si IP blacklistée → suspendre envois → ouvrir ticket Hetzner pour clean IP ou route via relais
- Sender Score : senderscore.org/lookup.php?ip=<CPX32>

### 6.3 Vérifier SPF/DKIM/DMARC

```bash
dig +short TXT axion-ia.com
dig +short TXT _dmarc.axion-ia.com
dig +short TXT default._domainkey.axion-ia.com
# Tester un envoi vers check-auth@verifier.port25.com → reçoit rapport SPF/DKIM/DMARC
```

---

## 7. Brute-force / abuse

### 7.1 Identifier IPs sources

```bash
docker exec axion-ia-redis-prod redis-cli -a "${REDIS_PASSWORD}" \
  --scan --pattern "rl:*" | head -20
# Inspecter compteurs sliding window pour repérer IPs avec >50 req/min
```

### 7.2 Bloquer via Cloudflare WAF

Cloudflare dashboard → Security → WAF → Custom rule :

```
(http.request.uri.path contains "/api/auth/sign-in" and ip.src eq <BAD_IP>) → Block
```

Ou rule générique :

```
(http.request.uri.path contains "/api/" and rate(1m) > 100) → Challenge (managed)
```

### 7.3 Notify Sentry + Telegram

Auto via `[SECURITY]` tag — voir alertOps dans `src/lib/telegram.ts`.

---

## 8. Sentry alert spike

### 8.1 Top issues last hour

`https://sentry.axion-ia.com` → Issues → Filter `seen:1h` → Sort by `events`.

### 8.2 Si bug récent (release ≤ 1h)

Rollback rapide via Coolify UI → Deployments → previous → Rollback.

### 8.3 Si bug ancien — créer issue GitHub

```bash
gh issue create --title "[INC-$(date +%Y%m%d)] {summary}" \
  --body "Sentry : <link>\nFirst seen: ...\nUsers affected: ...\nReproducer: ..." \
  --label "bug,production,P0"
```

---

## 9. Cloudflare incident

### 9.1 Bypass Cloudflare temporaire

DNS Cloudflare → toggle `proxy` OFF sur le record A apex → DNS-only.
SSL bascule automatique sur Caddy Let's Encrypt direct.

### 9.2 Restaurer après fin incident

Re-toggle proxy ON. Vérifier SSL Full strict toujours actif.

---

## 10. SSL expiry imminent

Caddy renouvelle automatiquement. Si bug :

```bash
docker exec axion-ia-caddy-prod caddy reload --config /etc/caddy/Caddyfile
docker exec axion-ia-caddy-prod ls /data/caddy/certificates/
```

Si Let's Encrypt rate-limit (5 fails/jour/domaine) :

- Attendre 1h ou utiliser ZeroSSL fallback dans Caddyfile

---

## 11. Disque plein

### 11.1 Identifier consommateurs

```bash
ssh root@<cpx32>
df -h
docker system df
du -sh /var/lib/docker/volumes/*
```

### 11.2 Cleanup

```bash
# Images Docker orphelines
docker image prune -af

# Logs Docker > 100MB par container (rotation)
truncate -s 0 $(docker inspect --format='{{.LogPath}}' axion-ia-app-prod)

# Postgres WAL excessive (rare — vérifier checkpoint)
docker exec axion-ia-postgres-prod psql -U axion_ia -c "CHECKPOINT;"
```

---

## 12. Compromission super-admin

### 12.1 Disable user immédiatement

```bash
docker exec axion-ia-postgres-prod psql -U axion_ia -d axion_ia_prod -c "
  UPDATE admin_users SET disabled_at = NOW() WHERE email = '<COMPROMISED_EMAIL>';
"
```

### 12.2 Reset 2FA

```bash
docker exec axion-ia-postgres-prod psql -U axion_ia -d axion_ia_prod -c "
  UPDATE admin_users SET totp_secret = NULL, totp_enabled = false WHERE email = '<EMAIL>';
"
# Le user devra re-setup 2FA via /admin/2fa/setup au prochain login
```

### 12.3 Audit trail

```bash
docker exec axion-ia-postgres-prod psql -U axion_ia -d axion_ia_prod -c "
  SELECT created_at, actor_email, action, target_type, ip_address
  FROM activity_logs
  WHERE actor_email = '<COMPROMISED_EMAIL>' AND created_at > NOW() - INTERVAL '24 hours'
  ORDER BY created_at DESC;
"
```

### 12.4 Notify CNIL si données utilisateurs touchées

DPO `contact@axion-ia.com` doit déclarer sous 72h via `notifications.cnil.fr`.

---

## Annexes

### Contacts ops

| Rôle            | Contact                                |
| --------------- | -------------------------------------- |
| Tech lead       | Will (williamsjullin@gmail.com)        |
| DPO             | contact@axion-ia.com                   |
| Hetzner support | https://console.hetzner.cloud → ticket |
| Cloudflare      | https://dash.cloudflare.com → support  |

### SLAs internes (engagement Will)

- P0 (site DOWN) : ack 15 min, fix 1h
- P1 (degraded ≥10% users) : ack 30 min, fix 4h
- P2 (bug isolé) : ack 4h, fix 24h
- P3 (cosmetique) : 7 jours

### Post-mortem

Tout incident P0/P1 → post-mortem dans `docs/post-mortems/<date>-<slug>.md` :

1. Timeline
2. Root cause
3. Detection time vs resolution time
4. User impact
5. Prevention actions

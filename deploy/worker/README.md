# Déploiement Worker BullMQ sur Coolify

Sprint X.12 — Booking V1 (ADR 0009 hosting Hetzner CPX32 + Coolify).

Le worker BullMQ tourne en **process séparé** de l'app Next.js pour isoler
le throughput email/cron du request handling web. Même image Docker à
partir du même repo GitHub, mais commande de démarrage différente
(`Dockerfile.worker` au lieu de `Dockerfile`).

---

## Pourquoi un service séparé ?

- **Isolation CPU** : un cron retention-purge qui mouline 10k purges RGPD
  ne ralentit pas la home page
- **Restart safe** : redémarrer l'app web ne casse pas les jobs in-flight
  côté worker (et inversement)
- **Scaling indépendant** : si le throughput email explose, on bump le
  worker en CPX32 → CPX42 sans toucher au web
- **Graceful shutdown** : le worker a son propre handler SIGTERM avec
  drain 25s (cf. `src/server/queue/worker.ts`)

## Architecture cible

```
                          ┌──────────────────┐
                          │  Redis Coolify   │
                          │ (BullMQ broker)  │
                          └────────┬─────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
       ┌──────▼──────┐      ┌──────▼──────┐     ┌───────▼─────┐
       │  Web App    │      │   Worker    │     │ Workers (V2) │
       │  axion-ia   │      │  axion-ia-  │     │  (autoscale  │
       │  (Next 16)  │      │   worker    │     │   future)    │
       └─────────────┘      └─────────────┘     └─────────────┘
       Server Actions       4 BullMQ workers
       enqueue jobs          + 3 cron jobs
```

Les workers actuellement implémentés (V1) :

| Worker                     | Queue consumée      | Concurrence | Trigger                         |
| -------------------------- | ------------------- | ----------- | ------------------------------- |
| `email-worker`             | `emails`            | 8           | Server Actions `enqueueEmail()` |
| `option-expiration-worker` | `option-expiration` | 1           | Cron repeatable 5 min           |
| `option-reminder-worker`   | `option-reminder`   | 1           | Cron repeatable 1 h             |
| `retention-purge-worker`   | `retention-purge`   | 1           | Cron repeatable daily 03:00 UTC |

---

## Étape 1 — Créer la 2e application Coolify (5 min)

1. `http://178.105.55.15:8000` (Coolify UI)
2. **Project** `axion-ia` → onglet **Resources** → **+ New** → **Application**
3. Type : **Public Repository** (ou Private si privé)
4. **Repository URL** : `https://github.com/will383842/axion-ia`
5. **Branch** : `main`
6. **Build Pack** : `Dockerfile`
7. **Name** : `axion-ia-worker`
8. **Description** : `BullMQ worker — emails + crons (Sprint X.12)`
9. **Save**

## Étape 2 — Configurer le Dockerfile path (1 min)

Onglet **Configuration** → **General** :

- **Dockerfile Location** : `./Dockerfile.worker`
- **Base Directory** : `/` (root du repo)
- **Ports Exposes** : laisse **vide** (worker = pas de HTTP)
- **Custom Internal Port** : laisse vide
- **Domain** : laisse **vide** (pas de FQDN public)

**Save**.

## Étape 3 — Copier les env vars depuis l'app web (5 min)

Le worker a besoin des **mêmes** env vars que l'app web (DATABASE_URL,
REDIS_URL, etc.) car il partage la même base + Redis broker.

Le plus rapide :

1. Va sur l'app `axion-ia` (UUID `mqbmlz1bcwsdwi3t9fxsllqt`) → **Environment Variables**
2. Note les valeurs clés (au minimum) :
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `REDIS_URL`
   - `STRIPE_SECRET_KEY` (pour worker email avec payload booking)
   - `RESEND_API_KEY` ou config SMTP utilisé par email-worker
   - `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`
   - `NODE_ENV=production`
   - `AUTH_SECRET` (peut être nécessaire si worker importe auth helpers)

3. Va sur `axion-ia-worker` → **Environment Variables**
4. Colle les mêmes valeurs.
5. **Ajoute** spécifiquement (différent de l'app web) :
   ```
   BULLMQ_DISABLED=false
   ```
   (false = explicite — l'app web peut être true en local mais le worker
   doit toujours tourner en prod)

**Save**.

## Étape 4 — Disable Healthcheck (1 min)

Le worker n'expose pas de port HTTP. Le healthcheck par défaut Coolify
(curl localhost) va échouer → restart en boucle.

Onglet **Healthchecks** :

- **Health Check Enabled** : **OFF**

**Save**.

Alternative future (V2) : exposer un endpoint `/internal/healthz` côté
worker via un petit HTTP server interne qui répond `200` si la queue
BullMQ est joignable. Optional V1.

## Étape 5 — Mémoire / CPU (1 min)

Onglet **Configuration** → **Resource Limits** :

- **Memory Limit** : `512m` (le worker + Prisma client ~ 200-400 MB en
  régime établi, cap 512 anti-OOM)
- **CPU Limit** : laisse par défaut (pas critique)

**Save**.

## Étape 6 — Deploy (5-8 min build initial)

1. Onglet **Deployments** → bouton **Deploy** vert
2. Suis les logs : pull base image Node 20.18, deps install via pnpm,
   prisma generate, build runner stage, container démarre
3. Vérifie les logs du container :
   ```
   → Axion-IA · BullMQ workers booting…
   ✓ 4 workers running. Cron jobs scheduled.
   ```
   → C'est bon, le worker tourne.

## Étape 7 — Vérification end-to-end (5 min)

```bash
# 1. Container axion-ia-worker tourne
ssh root@178.105.55.15 'docker ps --filter "name=axion-ia-worker" --format "{{.Names}} {{.Status}}"'
# Attendu : axion-ia-worker-xxx Up X minutes

# 2. Worker consomme les emails enqueued par les Server Actions
# Test : trigger une submission /contact en local ou prod
# → check Redis queue 'emails' diminue
ssh root@178.105.55.15 \
  'docker exec coolify-redis-XXX redis-cli -a "$REDIS_PASSWORD" LLEN bull:emails:wait'
# Attendu : 0 (consommé) ou petit nombre transient

# 3. Cron jobs scheduled (repeatable)
ssh root@178.105.55.15 \
  'docker exec coolify-redis-XXX redis-cli -a "$REDIS_PASSWORD" ZCARD bull:option-expiration:repeat'
# Attendu : 1 (le job repeatable scheduled)
```

---

## Rollback

Si quelque chose foire :

1. Coolify UI → app `axion-ia-worker` → **Stop**
2. Code-side : tout fonctionne sans worker grâce à `BULLMQ_DISABLED`
   et au fail-soft enqueue dans les Server Actions (catch → warn). Les
   emails ne partent juste pas tant que le worker est down — l'app
   reste UP.
3. Pour purger : **Delete** l'app Coolify (le code GitHub n'est pas touché).

---

## Logs & monitoring

- **Logs container** : Coolify UI → **Logs** tab → live tail
- **Logs Telegram** : tag `[DEPLOY]` envoyé via `alertOps()` sur deploy/restart
- **Queue depth** : à wirer sur dashboard `/admin/observability` (Sprint X.14 admin UI)
- **Alerte queue stuck** : à ajouter (V2) — UptimeRobot peut surveiller un
  endpoint `/api/admin/queue-stats` qui retourne 503 si queue depth >500
  pendant 10 min

---

## Maintenance

- **Auto-deploy** : ⚠️ depuis ADR 0026 (2026-05-16), `deploy-coolify.yml` ne
  POST que sur l'app **web** (`COOLIFY_APP_UUID`). Le worker a sa propre étape
  `POST /api/v1/deploy (worker BullMQ)` ajoutée le 2026-06-13, **conditionnée au
  secret `COOLIFY_WORKER_APP_UUID`**. Tant que ce secret n'est pas posé, un push
  main NE redéploie PAS le worker → le code worker reste figé en prod.
  **Action requise** : `gh secret set COOLIFY_WORKER_APP_UUID --body "<uuid>"`
  (UUID de l'app Coolify `axion-ia-worker`). Une fois posé : push main →
  redeploy web **et** worker.
- **Mise à jour deps BullMQ** : Dependabot auto-PR — review breaking changes
  release notes BullMQ v5.x
- **Rotation Redis password** : worker redémarre auto à chaque change env via
  Coolify → reconnect ioredis avec nouveau credentials
- **Persistence jobs** : Redis Coolify a déjà la persistence AOF activée
  par défaut. Les jobs in-flight survivent un restart Redis (BullMQ idempotent).

---

## Sprint X.12 status

- ✅ 4 workers TS implémentés (`src/server/queue/workers/`)
- ✅ Dockerfile.worker prêt
- ✅ Redis Coolify déjà UP (cf. ADR 0009)
- ✅ Toggle `BULLMQ_DISABLED` résilience
- ⏳ Action Will : suivre étapes 1-7 ci-dessus pour provisionner l'app
  Coolify `axion-ia-worker`
- ⏳ Action Will : copier les env vars depuis app axion-ia

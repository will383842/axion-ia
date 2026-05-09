# Runbook déploiement Axion-IA — Sprint 22 (M11)

**Stack** : Hetzner Cloud CPX32 Frankfurt (8 vCPU AMD + 16 GB RAM + 240 GB NVMe)

- Coolify v4 + Caddy 2 + Cloudflare Free + PostgreSQL 16 + Redis 7 + Next 16.

**Architecture cible** :

```
Internet
   ↓
Cloudflare (Free, proxied) — DDoS basic + caching statique
   ↓ HTTPS (Full strict)
Hetzner CPX32 (Frankfurt)
   ├── Caddy 2 (80/443) — SSL Let's Encrypt + reverse-proxy
   │       ↓
   ├── Next 16 standalone (3000) — web + admin + API
   ├── BullMQ workers — emails / cron expiration / cron reminder
   ├── PostgreSQL 16 — DB (volume persistent)
   ├── Redis 7 — BullMQ + rate-limit (volume persistent)
   ├── PowerMTA + MailWizz (Sprint 19) — email maison localhost:2525
   ├── Sentry self-hosted (Sprint 23) — sentry.axion-ia.com
   ├── Plausible self-hosted (Sprint 23) — plausible.axion-ia.com
   └── Uptime Kuma (Sprint 23) — uptime.axion-ia.com
```

## 1. Prérequis serveur

- VPS Hetzner Cloud CPX32 Frankfurt provisionné (€11,90/mois HT)
- Ubuntu 24.04 LTS
- Docker 24+ + Docker Compose v2 installés
- Coolify v4 installé (`curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash`)
- Domaine `axion-ia.com` enregistré (registrar OVH/Namecheap/etc.)

## 2. Configuration DNS Cloudflare

Voir `docs/ops/dns-records.md` pour la liste exhaustive. Records principaux :

```
A     axion-ia.com           → <IP-CPX32>     (proxied)
A     www.axion-ia.com       → <IP-CPX32>     (proxied)
A     admin.axion-ia.com     → <IP-CPX32>     (proxied — pour Coolify UI)
A     mail.axion-ia.com      → <IP-CPX32>     (DNS-only, pas proxied — SMTP)
A     mailwizz.axion-ia.com  → <IP-CPX32>     (proxied)
A     sentry.axion-ia.com    → <IP-CPX32>     (proxied)
A     plausible.axion-ia.com → <IP-CPX32>     (proxied)
A     uptime.axion-ia.com    → <IP-CPX32>     (proxied)
TXT   axion-ia.com           → "v=spf1 mx -all"
TXT   _dmarc.axion-ia.com    → "v=DMARC1; p=quarantine; rua=mailto:contact@axion-ia.com; ruf=mailto:contact@axion-ia.com"
TXT   default._domainkey.axion-ia.com → "v=DKIM1; k=rsa; p=<dkim-public-key-2048-bits>"
```

Cloudflare SSL/TLS mode : **Full (strict)**.
Cloudflare Speed → Always Use HTTPS : **On**.
Cloudflare Security → Bot Fight Mode : **Off** (bypassed Turnstile pour formulaires Server Actions).

## 3. Coolify setup

1. Connect Hetzner CPX32 dans Coolify (SSH key)
2. Créer projet "Axion-IA" → Resource → Docker Compose Empty → upload `docker-compose.production.yml`
3. Coolify détecte les 4 services (postgres, redis, app, worker, caddy)
4. Settings → Environment Variables : copier toutes les clés de `.env.production.example` avec valeurs réelles
5. Connect GitHub repo `will383842/axion-ia` (auto-deploy sur push main)

## 4. Premier déploiement

```bash
# Sur le VPS, depuis /var/www/axion-ia
git clone https://github.com/will383842/axion-ia.git
cd axion-ia/axionia

# Initialise les secrets via Coolify (UI ou .env.production)
# Coolify lance docker compose up -d automatiquement après save env

# Vérifier services up
docker ps | grep axion-ia

# Première migration (zero-downtime depuis app container)
docker compose -f docker/docker-compose.production.yml exec app pnpm prisma migrate deploy

# FTS migration (raw SQL non gérée par Prisma)
docker compose -f docker/docker-compose.production.yml exec -T postgres psql -U axion_ia -d axion_ia_prod < prisma/migrations_fts/0002_fts_setup.sql

# Seed initial (1 super-admin + categories)
docker compose -f docker/docker-compose.production.yml exec app pnpm db:seed
```

## 5. Déploiements suivants (auto via Coolify)

Coolify détecte chaque push sur `main` → rebuild image → rolling update :

```
push main → GitHub Action (CI typecheck/test/lint) → si vert → Coolify webhook
                                                              ↓
                                                   docker compose pull/build
                                                              ↓
                                                   prisma migrate deploy
                                                              ↓
                                                   docker compose up -d --force-recreate app worker
                                                              ↓
                                                   wait /api/healthz 200
                                                              ↓
                                                   notify Telegram [DEPLOY] OK
```

Override manuel via SSH :

```bash
ssh root@<cpx32-ip>
cd /var/www/axion-ia/axionia
bash scripts/deploy-prod.sh
```

## 6. Rollback

Coolify garde les 5 dernières images Docker. Rollback :

```bash
# Via Coolify UI : Project → Deployments → Click previous → "Rollback"
# OU via CLI :
docker compose -f docker/docker-compose.production.yml down app worker
docker tag axion-ia-app:<previous-sha> axion-ia-app:latest
docker compose -f docker/docker-compose.production.yml up -d app worker
```

Si rollback nécessite migration DB inverse : impossible automatiquement (Prisma pas de down-migration). Restaurer depuis backup PostgreSQL (Sprint 23 runbook-incident.md).

## 7. Healthcheck en continu

- Caddy passive health check : `/api/healthz` toutes les 30s
- Uptime Kuma external : ping `https://axion-ia.com/api/healthz` toutes les 60s, alerte Telegram si down >2 cycles
- Sentry capture les exceptions runtime app + worker

## 8. Logs

- Coolify aggregates logs container
- Caddy logs JSON sur stdout → Coolify
- App logs via pino structured JSON
- Worker logs `[email-worker]` `[option-expiration-worker]` etc.

Accès :

```bash
docker logs --tail=200 -f axion-ia-app-prod
docker logs --tail=200 -f axion-ia-worker-prod
docker logs --tail=200 -f axion-ia-caddy-prod
```

## 9. Backup

Voir `docs/ops/runbook-incident.md` (Sprint 23) section "Restauration sauvegarde".

- Postgres dump quotidien automatique → Hetzner Storage Box (chiffré AES-256)
- Rétention : 7 quotidiens + 4 hebdomadaires + 12 mensuels
- Test mensuel obligatoire restoration (cf. doctrine §15 + doc 09 dossier v10.1)

## 10. Checklist pre-prod (avant le 1er deploy public)

- [ ] DNS records Cloudflare configurés + propagés
- [ ] SSL Let's Encrypt actif (Caddy auto)
- [ ] Cloudflare SSL/TLS = Full (strict)
- [ ] PowerMTA installé + DKIM 2048 + SPF/DMARC validés (mxtoolbox)
- [ ] MailWizz UI accessible https://mailwizz.axion-ia.com
- [ ] Warmup IP démarré (10/jour S1 → 50 → 200 → 500 → 1000+)
- [ ] Turnstile prod keys configurées (pas dev keys 1x000…)
- [ ] AUTH*SECRET généré 32+ chars random (pas dev*\*)
- [ ] ADMIN_URL_PREFIX généré random (pas admin-dev-x7k2n9)
- [ ] Super-admin créé via seed avec password initial sécurisé
- [ ] 2FA TOTP super-admin activé via /admin/2fa/setup
- [ ] Sentry self-hosted up + DSN configuré
- [ ] Plausible self-hosted up + script tracking dans `<head>`
- [ ] Uptime Kuma monitor `/api/healthz` configuré
- [ ] Telegram bot configuré + premiers messages [DEPLOY] reçus
- [ ] Lighthouse production ≥95 perf/a11y/BP, =100 SEO sur 16 URLs (pnpm lhci)
- [ ] Playwright E2E flows passent en CI
- [ ] Backup PG quotidien configuré + 1er test restauration validé

GO public uniquement après les 17 cases cochées.

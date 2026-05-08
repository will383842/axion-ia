# Runbook monitoring — Sprint 23 (M11)

**Stack** : Sentry self-hosted + Plausible self-hosted + Uptime Kuma + Telegram alerts.

## 1. Sentry self-hosted

Le SDK `@sentry/nextjs` est déjà intégré (`src/sentry.server.config.ts`,
`src/sentry.edge.config.ts`, `src/instrumentation-client.ts`). Reste à
provisionner Sentry self-hosted sur le VPS.

### Installation

Pas géré par notre `docker-compose.monitoring.yml` (Sentry self-hosted requiert
son propre installateur multi-conteneurs avec Snuba/Kafka/Symbolicator).

```bash
ssh root@<cpx32>
cd /var/www
git clone https://github.com/getsentry/self-hosted.git sentry-onpremise
cd sentry-onpremise
git checkout 25.x.x  # version stable
./install.sh --skip-user-prompt
docker compose up -d

# Premier login : créer super-user via prompt
# Puis créer projet "axion-ia" → JS / Next.js
# Récupérer DSN → variable env SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN
```

### DNS + Caddy reverse-proxy

Ajouter dans `/var/www/axion-ia/axionia/Caddyfile` :

```caddy
sentry.axion-ia.com {
    encode zstd br gzip
    reverse_proxy localhost:9000 {
        flush_interval -1
    }
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options DENY
        X-Content-Type-Options nosniff
    }
}
```

### Vérifier capture

```bash
# Force une exception côté serveur pour valider que Sentry capture
curl -X POST https://axion-ia.com/api/test-sentry  # créer route si besoin
# → erreur visible https://sentry.axion-ia.com/issues/
```

### Alerts Telegram via Sentry webhook

Sentry → Project → Alerts → Create rule :

- Conditions : `Issues seen by 10+ users in 1h` OR `Tag environment=production AND level=fatal`
- Action : Webhook → URL `https://api.telegram.org/bot<TOKEN>/sendMessage` avec body :

```json
{
  "chat_id": "<CHAT_ID>",
  "parse_mode": "Markdown",
  "text": "*[INCIDENT]* Sentry alert\n{{ project_name }}\n{{ event.title }}\n{{ event.url }}"
}
```

## 2. Plausible self-hosted

Déjà couvert par `docker/monitoring/docker-compose.monitoring.yml`.

### Premier setup

```bash
ssh root@<cpx32>
cd /var/www/axion-ia/axionia
docker compose -f docker/monitoring/docker-compose.monitoring.yml up -d \
  plausible-postgres plausible-clickhouse plausible

# Attendre que migrations Plausible se terminent (20-30s)
docker logs -f axion-ia-plausible | grep "Running"

# Créer compte super-admin via web UI à plausible.axion-ia.com
# (DISABLE_REGISTRATION=invite_only → 1er user devient owner)
```

### Caddyfile

```caddy
plausible.axion-ia.com {
    encode zstd br gzip
    reverse_proxy localhost:8000
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    }
}
```

### Côté front Next

Variables env requises :

- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=axion-ia.com`
- `NEXT_PUBLIC_PLAUSIBLE_API_URL=https://plausible.axion-ia.com`

Component `<Plausible />` déjà branché dans `src/app/[locale]/layout.tsx`.

CSP : ajouter `https://plausible.axion-ia.com` dans `script-src` + `connect-src` du `next.config.ts`.

### Tracking goals custom

Dans Plausible UI → Site Settings → Goals :

- `Booking Submitted`
- `Audit Submitted`
- `Implementation Submitted`
- `Newsletter Subscribed`
- `Option 48h Created`
- `Option 48h Confirmed`

Côté code, helper `trackEvent()` dans `src/components/analytics/Plausible.tsx` :

```ts
import { trackEvent } from "@/components/analytics/Plausible";
trackEvent("Booking Submitted", { props: { intervention: "essentielle" } });
```

## 3. Uptime Kuma

Déjà dans `docker/monitoring/docker-compose.monitoring.yml`.

### Setup monitors

Web UI à `https://uptime.axion-ia.com` (créer admin user au 1er login) :

| Monitor       | Type                | URL/Host                                             | Interval | Notification |
| ------------- | ------------------- | ---------------------------------------------------- | -------- | ------------ |
| Site main     | HTTP(s)             | https://axion-ia.com/api/healthz                     | 60s      | Telegram     |
| Sitemap       | HTTP(s)             | https://axion-ia.com/sitemap.xml                     | 5min     | Telegram     |
| Robots        | HTTP(s)             | https://axion-ia.com/robots.txt                      | 10min    | Telegram     |
| Reserve form  | HTTP(s) - Keyword   | https://axion-ia.com/fr/reserver, keyword=`Réserver` | 5min     | Telegram     |
| Postgres      | TCP                 | <cpx32>:5432 (interne, via VPN ou local exec)        | 60s      | Telegram     |
| Sentry        | HTTP(s)             | https://sentry.axion-ia.com/_health/                 | 5min     | Telegram     |
| Plausible     | HTTP(s)             | https://plausible.axion-ia.com/api/health            | 5min     | Telegram     |
| SSL cert main | HTTPS - Cert expiry | https://axion-ia.com                                 | daily    | Telegram     |
| SSL cert mail | HTTPS - Cert expiry | https://mail.axion-ia.com                            | daily    | Telegram     |

### Notification Telegram

Settings → Notifications → New :

- Type : Telegram
- Bot token + chat ID (les mêmes que app)
- Test → "Hello from Uptime Kuma"

### Status page publique

(Optionnel) Status page publique à `https://uptime.axion-ia.com/status/main`
pour transparence customers.

## 4. Telegram alert hub

Le bot Telegram unique reçoit toutes alertes sur le même chat ID :

| Source         | Tag                                     | Exemple body                                         |
| -------------- | --------------------------------------- | ---------------------------------------------------- |
| Server Action  | `[INTERVENTION]` `[OPTION]` `[CONTACT]` | "Nouveau booking Will / 5 participants / 2026-06-15" |
| Worker BullMQ  | `[OPTION CONFIRMÉE]` `[OPTION EXPIRÉE]` | "Option ACME confirmée"                              |
| Backup script  | `[BACKUP]`                              | "Daily OK 245MB en 12s"                              |
| Deploy script  | `[DEPLOY]`                              | "Deploy OK commit abc123"                            |
| Sentry webhook | `[INCIDENT]`                            | "Fatal exception in /api/auth"                       |
| Uptime Kuma    | `[MONITORING]`                          | "axion-ia.com DOWN since 5min"                       |

**Filtrage côté Telegram** : utiliser des canaux séparés si volume :

- `@axion-ia-ops` : DEPLOY/BACKUP/MONITORING (low volume, opérationnel)
- `@axion-ia-business` : INTERVENTION/OPTION/CONTACT/AUDIT/NEWSLETTER (lead/sales)
- `@axion-ia-incidents` : INCIDENT/SECURITY (high signal, on-call)

V1 : 1 chat unique. Splitter en V2 si bruit.

## 5. Logs aggregation

Coolify aggregates par défaut chaque container. Pour chercher :

```bash
# Recherche full-text dans logs Caddy
docker logs axion-ia-caddy-prod 2>&1 | grep -E "status\":5(0|2|3)"

# Recherche erreurs app dernière heure
docker logs --since 1h axion-ia-app-prod 2>&1 | grep -E "ERROR|FATAL"

# Tail live multi-containers
docker compose -f docker/docker-compose.production.yml logs -f --tail=20 app worker
```

V2+ : ajouter Vector ou Promtail → Grafana Loki si volume justifie.

## 6. SLO / SLI

| SLI                  | SLO V1       | SLO V2   | Mesure                       |
| -------------------- | ------------ | -------- | ---------------------------- |
| Availability         | 99.5% / mois | 99.9%    | Uptime Kuma                  |
| LCP p75              | ≤ 2500ms     | ≤ 1800ms | Plausible web vitals         |
| INP p75              | ≤ 200ms      | ≤ 100ms  | Plausible web vitals         |
| Booking success rate | 95%          | 99%      | Plausible goals              |
| Email delivery rate  | 95%          | 99%      | PowerMTA logs + bounce table |

Review trimestriel SLO → Will, ajustements.

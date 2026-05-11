# Runbook monitoring — Sprint 23 (M11) + révision Audit E2E 2026-05-11

**Stack effectif V1** : Sentry **SaaS EU** + Plausible self-hosted + Uptime Kuma + Telegram alerts.

> Audit E2E 2026-05-11 P0-CONF-08 — Précédente version de ce runbook annonçait
> "Sentry self-hosted" mais le compose `docker/monitoring/docker-compose.monitoring.yml`
> n'a jamais inclus Sentry. Décision V1 : **Sentry SaaS EU** (DSN
> `ingest.de.sentry.io`, hébergement Allemagne) couvre les besoins sans le coût
> infra de la self-host (~8 GB RAM + 6 services + Kafka/Snuba/Symbolicator).
> À reconsidérer Sprint 17+ si volume d'events justifie le coût ou pour
> souveraineté renforcée.

## 1. Sentry SaaS EU

Le SDK `@sentry/nextjs` est intégré dans :

- `src/sentry.server.config.ts` (runtime Node serverless functions)
- `src/sentry.edge.config.ts` (runtime Edge proxy + middlewares)
- `src/instrumentation-client.ts` (runtime browser)

PII scrub global via `src/lib/observability/sentry-pii-scrub.ts` (audit E2E
2026-05-11 P0-CONF-06 — RGPD Art. 32).

### Configuration env (Coolify)

| Variable                 | Valeur                  | Où                        |
| ------------------------ | ----------------------- | ------------------------- |
| `SENTRY_DSN`             | DSN privé serveur       | Coolify env runtime       |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN client (= server)   | Coolify env build+runtime |
| `SENTRY_AUTH_TOKEN`      | Token upload sourcemaps | Coolify env build-only    |
| `SENTRY_ORG`             | slug org Sentry         | Coolify env build-only    |
| `SENTRY_PROJECT`         | slug projet Sentry      | Coolify env build-only    |

→ Sans `SENTRY_AUTH_TOKEN`, `withSentryConfig` (audit E2E P0-CONF-05 réintégré
2026-05-11) skip l'upload des sourcemaps. Stacks prod restent minifiées.

### Sous-domaine `sentry.axion-ia.com`

**N'existe plus** (P0-CONF-08). Accès au dashboard via `https://sentry.io/...`
SaaS direct.

### Vérifier capture

```bash
# Force une exception côté serveur via /api/healthz (à modifier ponctuel)
# ou crée une route /api/test-sentry temporaire pour valider.
# → erreur visible dans dashboard Sentry SaaS
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
| Sentry SaaS   | HTTP(s)             | https://sentry.io/api/0/                             | 5min     | Telegram     |
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

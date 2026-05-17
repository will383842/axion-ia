# Env vars — CI vs Prod vs Dev

> Source de vérité par environnement :
>
> - **Prod** : `.env.production.example` (template) + Coolify Application env vars (live)
> - **Dev** : `.env.dev.example` (template) + `.env.local` (override perso, gitignored)
> - **CI** : `.env.ci.example` (template) + job-level `env:` dans `.github/workflows/ci.yml`
>
> Doctrine Phase 8.bis Point 5 — runbook deploy recovery 2026-05-17.

## Tableau de référence

| Variable                        | Prod source                     | CI value                                        | Required for | Notes                                                                |
| ------------------------------- | ------------------------------- | ----------------------------------------------- | ------------ | -------------------------------------------------------------------- |
| `SKIP_ENV_VALIDATION`           | non set (Zod actif)             | `true`                                          | build CI     | Skippe Zod validation des 8 secrets prod absents en GHA              |
| `BULLMQ_DISABLED`               | non set                         | `true`                                          | build CI     | Empêche BullMQ d'init une connexion Redis au SSG                     |
| `DATABASE_URL`                  | Coolify env (Postgres CPX42)    | `postgresql://stub:stub@stub.invalid:5432/stub` | build CI     | Magic string — proxy no-op, voir AGENTS.md ADR 0026                  |
| `REDIS_URL`                     | Coolify env (Redis CPX42)       | `redis://stub.invalid:6379`                     | build CI     | Idem, no-op proxy                                                    |
| `AUTH_SECRET`                   | Coolify env (32+ chars)         | dummy 32+ chars                                 | build CI     | NextAuth secret — non utilisé en build, requis pour Zod              |
| `ADMIN_URL_PREFIX`              | Coolify env                     | `admin-ci-build`                                | build CI     | Préfixe URL admin (sécurité by obscurity)                            |
| `STRIPE_SECRET_KEY`             | Coolify env (sk*live*...)       | dummy `sk_test_`                                | build CI     | Pas d'appel Stripe au build SSG                                      |
| `STRIPE_PUBLISHABLE_KEY`        | Coolify env (pk*live*...)       | dummy `pk_test_`                                | build CI     | Idem                                                                 |
| `STRIPE_WEBHOOK_SECRET`         | Coolify env (whsec\_...)        | dummy `whsec_`                                  | build CI     | Idem                                                                 |
| `BACKUP_ENCRYPTION_PASSPHRASE`  | Coolify env (32+ chars)         | dummy                                           | build CI     | Pas d'opération backup au build                                      |
| `IP_HASH_SALT`                  | Coolify env (32+ chars, secret) | dummy 32+ chars                                 | build CI     | RGPD : utilisé par `src/lib/security/ip-hash.ts` — runtime seulement |
| `PII_ENCRYPTION_KEY`            | Coolify env (32+ chars, secret) | dummy 32+ chars                                 | build CI     | RGPD : encryption PII Telegram/logs — runtime seulement              |
| `INDEXNOW_INTERNAL_HMAC_SECRET` | Coolify env (32+ chars, secret) | dummy                                           | build CI     | Auth des endpoints IndexNow internes                                 |
| `DOCUSEAL_STRICT_HMAC`          | Coolify env (32+ chars, secret) | dummy                                           | build CI     | Auth des callbacks DocuSeal stricts                                  |
| `NEXT_PUBLIC_SITE_URL`          | `https://axion-ia.com`          | identique                                       | build CI     | URL canonique — utilisée pour og:image, sitemap, hreflang            |
| `NEXT_PUBLIC_APP_ENV`           | `production`                    | identique                                       | build CI     | Toggle Sentry sample rate + logs                                     |

## Procédure d'ajout d'une nouvelle env var

1. **Ajouter en prod** d'abord (Coolify Application → Env vars → New).
2. **Documenter dans `.env.production.example`** avec commentaire explicatif.
3. **Ajouter au validateur Zod** (`src/env.ts`) si requise au runtime.
4. **Ajouter dummy dans `.env.ci.example`** + ligne dans CE tableau.
5. **Ajouter au job-level env de `.github/workflows/ci.yml` gate-b** si requise pour le build.
6. **Ajouter aux build-args du `Dockerfile`** si requise au build SSG.
7. **Ajouter aux build-args du `.github/workflows/deploy-coolify.yml`** (job `build`) si la valeur publique change entre envs.

## Procédure de checkup d'env vars prod manquantes

Quand un déploiement échoue en healthcheck post-deploy, suspecter
une env var manquante côté Coolify. Procédure :

1. Comparer `.env.production.example` (source) vs `axionia/Coolify UI →
App axion-ia → Env vars` (live).
2. Identifier les keys présentes dans `.env.production.example` mais
   absentes côté Coolify.
3. Set via Coolify UI : New → key/value → scope=RUN (ou BUILD selon doc).
4. Restart container (Coolify → Restart).
5. Re-vérifier `/api/healthz` 200 + smoke 30+ routes.

**Note** : il n'existe pas (encore) d'endpoint Coolify API pour lister
les env vars d'une app, donc cette comparaison reste manuelle pour
l'instant. Anti-récidive prévue Phase 4.bis follow-up : créer un script
`scripts/ops/coolify-env-diff.sh` qui parse `.env.production.example` +
ssh + `docker inspect axion-ia` pour comparer (nécessite `HETZNER_SSH_KEY`
secret).

## Pointeurs

- Stack runtime : voir `AGENTS.md`
- ADR 0026 (build externalisé) : voir `docs/adr/0026-*.md`
- Runbook deploy recovery : voir `_AUDIT/DEPLOY-RECOVERY-2026-05-17/`

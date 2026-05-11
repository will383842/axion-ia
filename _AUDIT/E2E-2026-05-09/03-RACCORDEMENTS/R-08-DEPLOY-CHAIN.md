# R-08 — DEPLOY CHAIN

## Diagramme ASCII

```
Developer push main
        │
        ▼
┌────────────────────────────────────┐
│ .github/workflows/                 │
│  ci.yml (lint+typecheck+test+lhci  │
│         continue-on-error 🟡)      │
│  deploy-coolify.yml                │
│  nightly.yml (Gate D 5/7 if:false ⚠️)│
│  release.yml (legacy webhook 🟡)   │
└────────────────┬───────────────────┘
                 │ POST Coolify API (token)
                 ▼
┌────────────────────────────────────┐
│ Coolify 4.0.0 @ 178.105.55.15      │
│ App UUID mqbmlz1bcwsdwi3t9fxsllqt  │
│ Pull main + Docker build           │
│ Dockerfile multi-stage standalone  │
│ ⚠️ pas de cache-mount (M9 WIP)     │
└────────────────┬───────────────────┘
                 │ postbuild
                 ▼
┌────────────────────────────────────┐
│ scripts/indexnow-ping.ts           │
│ (skippable INDEXNOW_DISABLED=true) │
│ ⚠️ withSentryConfig ABSENT         │
│   → sourcemaps NON UPLOADÉES       │
│   → stacks prod minifiées illisibles│
└────────────────┬───────────────────┘
                 ▼
┌────────────────────────────────────┐
│ Coolify swap + healthcheck         │
│ /api/healthz {db:ok, redis:ok}     │
│ Caddy 2 reverse proxy (TLS/HSTS)   │
└────────────────┬───────────────────┘
                 ▼
┌────────────────────────────────────┐
│ Cloudflare orange proxy            │
│ CF Cache Rules 6 → SSG → user      │
│ ⚠️ pas de purge automatique deploy │
└────────────────────────────────────┘
```

## Findings clés (AGT-12)

1. **AGT-12 P0-1** `withSentryConfig` absent de `next.config.ts:140` → Sentry init runtime OK mais sourcemaps non uploadées → croisé AGT-14 P0-M1. **P0 CONFIRMÉ Pass B**.
2. **AGT-12 P0-2** `nightly.yml` Gate D fantôme : 5/7 steps `if: false` (Playwright/ZAP/mail-tester/backup-drill/Lighthouse). `restore-postgres-test.sh` existe mais pas câblé → croisé AGT-11 + AGT-13.
3. **AGT-12 P0-3** Drift HSTS code 2 ans vs prod 1 an (CF réécrit) → croisé AGT-08 P1-S3.
4. **AGT-12 P1** DNSSEC `pending` (DS record pas chez Namecheap) — flag connu mémoire `axionia_session_2026-05-09_cloudflare_phase5`.
5. **AGT-12 P1** 9 vars manquent de `.env.example` (BACKUP*ENCRYPTION_PASSPHRASE critique, HETZNER_STORAGE_USER/HOST, RETENTION*\*, GOOGLE/BING_SITE_VERIFICATION).
6. **AGT-12 P1** `scripts/backup-postgres-r2.sh` utilise `R2_*` vars absentes de `src/env.ts` ET `.env.example` → mort code ? ou actif sans validation ?

## Cohérence chaîne

✅ deploy-coolify.yml fonctionnel (mémoire `axionia_cicd_github_actions_coolify`).
✅ Healthcheck Coolify OK (`/api/healthz` 200).
✅ Caddy + CF + HTTP/3 + Brotli OK.
✅ CSP nonce posé par proxy.ts compatible cache CDN.
⚠️ Pas d'observabilité bout-en-bout : sourcemaps absentes + nightly Gate D fantôme = aveugle en prod.
⚠️ Pas de smoke post-deploy + purge CF.

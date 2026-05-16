# Agent 5.A — Env vars + Secrets + Config

**SHA HEAD** : `4cdfbe4` · **Date** : 2026-05-16 · **Mode** : AUDIT-ONLY strict
**Working dir** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
**Scope** : `src/env.ts` Zod schema · `.env.example` parité · `process.env` fallback risk · magic string `stub.invalid` · gitleaks · rotation tokens · secrets hardcodés scripts/seeds

---

## 1. Verdict synthèse

| Axe                                          | Score | Statut                             |
| -------------------------------------------- | ----- | ---------------------------------- |
| `env.ts` Zod schema (couverture + strict)    | 18/20 | Très bon                           |
| `.env.example` parité + descriptions         | 11/15 | Drift modéré, 8 vars manquantes    |
| `.env.production.example` parité prod        | 12/15 | Drift OPENAI / DocuSeal / IP_HASH  |
| `process.env.X` sans fallback (risque crash) | 12/15 | Workers Redis tolèrent absence     |
| Magic string `stub.invalid` propagation      | 10/10 | Pattern doctrine respecté          |
| Secrets hardcodés repo (gitleaks)            | 9/10  | 0 vrai secret, fallback dev exposé |
| Rotation tokens API                          | 4/10  | Aucune date rotation documentée    |
| Seeds / scripts secret-free                  | 5/5   | OK                                 |

**Total : 81/100** 🟡 **CONDITIONAL — Drift `.env.example`, rotation tokens absente, 8 P1.**

---

## 2. Diff `env.ts` (66 server vars + 8 client vars) vs `.env.example` (67 vars)

### 2.1 Vars définies dans `env.ts` mais ABSENTES de `.env.example`

| Var manquante                       | Source `env.ts`           | Sévérité | Action     |
| ----------------------------------- | ------------------------- | -------- | ---------- |
| `HETZNER_STORAGE_USER`              | L170 (P0-OPS-1 backup)    | P1       | Ajouter    |
| `HETZNER_STORAGE_HOST`              | L171 (P0-OPS-1 backup)    | P1       | Ajouter    |
| `BACKUP_ENCRYPTION_PASSPHRASE`      | L174 (P0-OPS-2 AES-256)   | P0       | Ajouter    |
| `GOOGLE_PSI_API_KEY`                | L212 (PSI monitor worker) | P2       | Ajouter    |
| `RETENTION_LOGS_MONTHS` (+4 autres) | L232-239 (D3)             | P2       | Documenter |
| `RETENTION_GENERATION_LOGS_MONTHS`  | L237 (audit B5 P0-7)      | P2       | Ajouter    |
| `RETENTION_COST_LEDGER_MONTHS`      | L238                      | P2       | Ajouter    |
| `RETENTION_WEB_VITALS_MONTHS`       | L239                      | P2       | Ajouter    |
| `IP_HASH_SALT`                      | L276 (image-bank RGPD)    | **P0**   | Ajouter    |
| `IMAGE_AUTO_PUBLISH_SCORE`          | L299                      | P2       | Ajouter    |
| `RETENTION_IMAGE_LOGS_MONTHS`       | L302                      | P2       | Ajouter    |
| `PII_ENCRYPTION_KEY`                | L313 (AGENT 12 P0 OWASP)  | **P0**   | Ajouter    |
| `KB_BYPASS`                         | L263 (V0 transitoire)     | P2       | Ajouter    |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID`    | L340                      | P1       | Ajouter    |

**Total : 14 vars dans `env.ts` non documentées dans `.env.example`** dont 3 P0 critiques RGPD/sécurité (`IP_HASH_SALT`, `PII_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_PASSPHRASE`).

### 2.2 Vars dans `.env.example` mais ABSENTES du schema Zod `env.ts`

| Var                           | Source `.env.example`     | Statut                                          |
| ----------------------------- | ------------------------- | ----------------------------------------------- |
| `BULLMQ_DISABLED`             | L22                       | Utilisée mais non Zod-validée (lecture directe) |
| `OPENAI_ORG_ID`               | L86                       | Non utilisée dans le code (grep 0 hit)          |
| `UNSPLASH_SECRET_KEY`         | L96                       | Non utilisée (uniquement ACCESS_KEY)            |
| `GOOGLE_INDEXING_API_ENABLED` | L113                      | Lue via `process.env` direct                    |
| `GOOGLE_INDEXING_SA_JSON`     | L114                      | Lue via `process.env` direct                    |
| `NOMINATIM_USER_AGENT`        | L169                      | Non Zod-validée                                 |
| `NOMINATIM_BASE_URL`          | L170                      | Non Zod-validée                                 |
| `POSTGRES_USER/PASSWORD/DB`   | `.env.production.example` | Coolify-only (compose interne)                  |

**Total : 7 vars `.env.example` hors schema Zod** → bypass silencieux validation.

### 2.3 Vars `process.env.X` utilisées dans le code SANS définition `env.ts`

Grep `process.env.*` exhaustif (200+ occurrences, 154 server-side hors tests) :

| Var                       | Fichier                                             | Risque |
| ------------------------- | --------------------------------------------------- | ------ |
| `REVALIDATE_SECRET`       | `app/api/internal/revalidate/route.ts:22`           | **P0** |
| `PREVIEW_TOKEN_SECRET`    | `server/content-gen/shared/preview-token.ts:23`     | P1     |
| `GSC_PROPERTY_URL`        | `server/content-gen/lifecycle/analytics-clients.ts` | P2     |
| `PLAUSIBLE_API_KEY`       | idem L73                                            | P1     |
| `PLAUSIBLE_SITE_ID`       | idem L74                                            | P1     |
| `KB_LOCALE`               | `lib/knowledge/locale-policy.ts:22`                 | P2     |
| `KB_INGEST_KILL_SWITCH`   | `lib/knowledge/kill-switch.test.ts`                 | P2     |
| `KB_BACKEND_UNIFIED`      | `lib/knowledge/feature-flag.ts:4`                   | P2     |
| `IMAGE_BANK_CDN_URL`      | `components/galerie/GalleryGrid.tsx:25`             | P1     |
| `IMAGE_BANK_STORAGE_PATH` | `server/image-bank/utils/paths.ts:69`               | P1     |
| `EN_LOCALE_ENABLED`       | `proxy.ts` (cf. AGENTS.md re-enable EN)             | P2     |
| `BUILD_TIME`              | `lib/seo.ts:28` (injecté Dockerfile ARG)            | P2     |

**Total : 12 vars `process.env` hors schema Zod** → contournent validation au boot.

---

## 3. Top 10 `process.env.X` sans fallback à risque crash prod

| #   | Var                        | Fichier:ligne                                            | Comportement si absent                                                          | Risque |
| --- | -------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| 1   | `REVALIDATE_SECRET`        | `app/api/internal/revalidate/route.ts:22`                | `secret` undefined → revalidate publique, **bypass auth**                       | **P0** |
| 2   | `AUTH_SECRET` (gdpr-token) | `lib/gdpr-token.ts:41`                                   | throw → endpoint GDPR export 500                                                | P1     |
| 3   | `PREVIEW_TOKEN_SECRET`     | `server/content-gen/shared/preview-token.ts:23`          | fallback `AUTH_SECRET` L31 OK                                                   | P2     |
| 4   | `STRIPE_SECRET_KEY`        | `features/payment/actions.ts` (via lib/stripe.ts)        | env.ts superRefine fail-fast boot prod                                          | P1     |
| 5   | `TURNSTILE_SECRET_KEY`     | `lib/turnstile.ts:23`                                    | const undefined → `verifyToken()` rate-limit bypass                             | P1     |
| 6   | `TELEGRAM_BOT_TOKEN`       | `lib/telegram.ts:49`                                     | `sendTelegram()` silent skip OK                                                 | P2     |
| 7   | `REDIS_URL` (workers ×17)  | tous workers `content-*-worker.ts`                       | const undefined → `new Worker(name, …, { connection: undefined })` BullMQ throw | **P0** |
| 8   | `INDEXNOW_KEY`             | `server/queue/workers/content-indexnow-worker.ts:80`     | `if (!key) return skip` OK                                                      | P3     |
| 9   | `KB_INGEST_SECRET`         | `lib/knowledge/hmac.ts:38`                               | throw runtime, accepté V1 (skip)                                                | P2     |
| 10  | `GOOGLE_PSI_API_KEY`       | `server/queue/workers/content-psi-monitor-worker.ts:204` | `if (!apiKey) skip` OK                                                          | P3     |

**P0 = 2** : `REVALIDATE_SECRET` (bypass auth), `REDIS_URL` workers (boot crash si manquante en prod, mais bloquée par superRefine indirect via `connection.ts:15` fallback `redis://localhost:6381`).

---

## 4. Magic string `stub.invalid` — matrice propagation

Fichiers déclarés doctrine `AGENTS.md` :

| Fichier                                     | Lignes                                                                           | Statut | Test                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------- | ------ | -------------------------------------- |
| `src/lib/prisma.ts`                         | L79 `isBuildStub`                                                                | ✅     | Proxy short-circuit findMany/findFirst |
| `src/lib/redis.ts`                          | L66 `isBuildStub`                                                                | ✅     | Proxy null no-op all commands          |
| `src/server/exporters/knowledge-rss.ts`     | L42                                                                              | ✅     | Early-exit `return []`                 |
| `src/server/exporters/knowledge-sitemap.ts` | L55, L224                                                                        | ✅     | Early-exit + count `0`                 |
| `Dockerfile`                                | L87 `${DATABASE_URL:-postgresql://stub:stub@stub.invalid:5432/stub}` + L88 redis | ✅     | ARG/ENV stubs                          |
| `.github/workflows/deploy-coolify.yml`      | L178-179                                                                         | ✅     | build-args injectés                    |
| `src/server/queue/queues.ts`                | L308 (commentaire)                                                               | ✅     | `enqueueImageBankEnrich` no-op         |

Bonus discoveries (3 fichiers absents de la doctrine mais qui ont auto-adopté le pattern) :

- `src/app/sitemaps/images-fr.xml/route.ts:77` early-exit ✅
- `src/app/sitemaps/images-en.xml/route.ts:48` early-exit ✅
- `scripts/indexnow-ping.ts:94` early-exit ✅ (collectImageBankUrls)

**Matrice complète : 10/10 fichiers propagent correctement la magic string. ADR 0026 respectée.**

---

## 5. Secrets hardcodés — analyse repo

### 5.1 `.gitleaks.toml` analysis

```toml
[extend] useDefault = true
[allowlist] paths = [.env.example, README.md, docs/*.md, _AUDIT/*.md]
regexes = [your_api_key, placeholder, xxxx+, <.*?>]
```

Verdict : **config minimaliste mais correcte**. Allowlist couvre les faux positifs templates. Aucune custom rule pour patterns Axion-IA spécifiques (Stripe `sk_live_`, Anthropic `sk-ant-`, OpenAI `sk-proj-`).

**Recommandation P2** : ajouter rules custom :

```toml
[[rules]]
id = "axion-stripe-live"
regex = '''sk_live_[0-9a-zA-Z]{24,}'''
[[rules]]
id = "axion-anthropic"
regex = '''sk-ant-api03-[A-Za-z0-9_-]{40,}'''
```

### 5.2 Grep secrets hardcodés

```
sk_live_|sk_test_|whsec_|pk_live_|pk_test_  → 0 match hors _AUDIT
AKIA[A-Z0-9]{16}                            → 0 match
ghp_|github_pat_                            → 0 match
```

✅ **Aucun secret réel committé.**

### 5.3 Fallbacks dev exposés dans repo

| Valeur                   | Fichiers (5)                                                                       | Statut prod                           |
| ------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------- |
| `admin-dev-x7k2n9`       | `auth.config.ts:17,47`, `app/.../layout.tsx:120`, `csp.ts:150`, `admin-path.ts:21` | env.ts L51 superRefine refuse en prod |
| `redis://localhost:6381` | `lib/redis.ts:13`, `server/queue/connection.ts:15`                                 | OK dev — prod via Coolify             |
| `dev-insecure-salt`      | (commenté env.ts L289)                                                             | superRefine refuse en prod            |

Verdict : **fallbacks dev correctement gardés par superRefine prod**. Le fallback `admin-dev-x7k2n9` répété 5× dans le code est un anti-DRY (P2) mais ne fuite aucun secret prod.

### 5.4 Scripts / seeds

| Fichier                                 | Hardcoded secret |
| --------------------------------------- | ---------------- |
| `prisma/seed.ts`                        | ❌ aucun         |
| `prisma/seeds/image-bank/seed-*.ts` (3) | ❌ aucun         |
| `scripts/generate-prod-secrets.sh`      | ❌ openssl rand  |
| `scripts/backup-postgres.sh`            | ❌ env-based     |
| `scripts/docker-entrypoint.sh`          | ❌ env-based     |
| `scripts/indexnow-ping.ts`              | ❌ env-based     |

✅ **0 secret hardcodé.**

---

## 6. Rotation tokens API — état documentation

Tokens utilisés en prod (cf. `.env.production.example` + Coolify cutover) :

| Token                          | Source                | Date génération | Date rotation | Périodicité |
| ------------------------------ | --------------------- | --------------- | ------------- | ----------- |
| `AUTH_SECRET`                  | openssl rand          | inconnue        | ❌            | ❌          |
| `STRIPE_SECRET_KEY` LIVE       | dashboard.stripe.com  | inconnue        | ❌            | ❌          |
| `STRIPE_WEBHOOK_SECRET`        | dashboard.stripe.com  | 2026-05-15      | ❌            | ❌          |
| `DOCUSEAL_API_KEY`             | DocuSeal UI           | 2026-05-15      | ❌            | ❌          |
| `DOCUSEAL_WEBHOOK_SECRET`      | DocuSeal UI           | 2026-05-15      | ❌            | ❌          |
| `TELEGRAM_BOT_TOKEN`           | @BotFather            | inconnue        | ❌            | ❌          |
| `COOLIFY_API_TOKEN`            | Sanctum Coolify       | inconnue        | ❌            | ❌          |
| `CLOUDFLARE_API_TOKEN`         | CF dash               | inconnue        | ❌            | ❌          |
| `OPENAI_API_KEY`               | platform.openai.com   | inconnue        | ❌            | ❌          |
| `ANTHROPIC_API_KEY`            | console.anthropic.com | inconnue        | ❌            | ❌          |
| `BACKUP_ENCRYPTION_PASSPHRASE` | openssl rand          | inconnue        | ❌            | ❌          |
| `IP_HASH_SALT`                 | openssl rand          | inconnue        | ❌            | ❌          |
| `PII_ENCRYPTION_KEY`           | openssl rand -hex 32  | inconnue        | ❌            | ❌          |
| `KB_INGEST_SECRET`             | openssl rand          | inconnue        | ❌            | ❌          |
| `INDEXNOW_KEY`                 | openssl rand -hex 16  | 2026-05-15      | ❌            | ❌          |
| `HETZNER_STORAGE_KEY/SECRET`   | Hetzner Storage Box   | inconnue        | ❌            | ❌          |
| `MAILWIZZ_API_KEY`             | MailWizz UI           | inconnue        | ❌            | ❌          |
| `PMTA_API_KEY`                 | PowerMTA              | inconnue        | ❌            | ❌          |

**Verdict : 0/18 tokens avec date rotation documentée. Aucun calendrier rotation.**

**Recommandation P1** : créer `_AUDIT/SECRETS-ROTATION-REGISTER.md` avec :

- Date génération initiale
- Date dernière rotation
- Périodicité cible (Stripe = 12 mois, autres = 6 mois)
- Procédure rotation step-by-step
- Owner (Will / DPO)

---

## 7. Validation Zod — points forts

✅ **superRefine prod-strict** pour 7 vars critiques :

- `AUTH_SECRET` : min 32 + refus `dev_*` en prod
- `ADMIN_URL_PREFIX` : min 16 + refus `admin-dev-x7k2n9` en prod
- `STRIPE_SECRET_KEY` : regex `sk_(live|test)_` + LIVE_MODE check
- `STRIPE_PUBLISHABLE_KEY` : regex `pk_(live|test)_` + LIVE_MODE check
- `STRIPE_WEBHOOK_SECRET` : regex `whsec_` + min 20
- `BACKUP_ENCRYPTION_PASSPHRASE` : min 32 + refus `dev_*` en prod
- `IP_HASH_SALT` : min 32 + refus `dev-insecure-salt` en prod
- `PII_ENCRYPTION_KEY` : regex hex 64 chars + required prod

✅ **`SKIP_ENV_VALIDATION` bypass build-only** : ligne 428 `skipValidation: process.env.SKIP_ENV_VALIDATION === "true"`.

✅ **`emptyStringAsUndefined`** : ligne 427, évite faux positifs Coolify (champ vide vs unset).

---

## 8. P0 / P1 / P2 backlog

### P0 (bloquants conditional GO)

1. **Drift `.env.example` ←→ `env.ts`** : 14 vars manquantes dont 3 P0 RGPD/sécurité (`IP_HASH_SALT`, `PII_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_PASSPHRASE`). Risque : un nouveau dev / un nouvel admin Coolify ne sait pas que ces vars existent → boot fail prod silencieux.

2. **`REVALIDATE_SECRET` non documentée + sans superRefine** : `app/api/internal/revalidate/route.ts:22` lit `process.env.REVALIDATE_SECRET` directement, pas dans `env.ts`. Si absent → endpoint revalidate sans auth = poison cache externe.

3. **Aucun registre rotation tokens** : 18 tokens prod, 0 date rotation documentée. Risque compliance ISO 27001 + DPA Stripe/Anthropic (typique = rotation annuelle).

### P1

4. **`process.env.X` hors schema Zod** : 12 vars (Plausible API, IMAGE_BANK_CDN, KB_LOCALE, etc.) → ajouter au schema avec defaults documentés.
5. **`.env.example` n'a pas `BULLMQ_DISABLED` description claire** : ligne 22 mentionne `false` en prod mais Dockerfile L93 force `BULLMQ_DISABLED=true` au build → confusion.
6. **`.gitleaks.toml` n'a pas de rules custom** : Stripe live, Anthropic, OpenAI patterns absents.
7. **Hardcoded `admin-dev-x7k2n9` répété 5×** : 1 SSOT `lib/admin-path.ts:21` suffit, les 4 autres devraient importer le helper.
8. **Pas de CI gate `gitleaks`** : `.gitleaks.toml` existe mais grep CI `.github/workflows/` ne trouve aucun job gitleaks. Risque commit accidentel.

### P2

9. Ajouter `BUILD_TIME`, `BULLMQ_DISABLED`, `EN_LOCALE_ENABLED` au schema Zod (vars techniques mais utilisées).
10. Documenter `OPENAI_ORG_ID` et `UNSPLASH_SECRET_KEY` — present `.env.example` mais 0 usage code → soit ajouter usage soit retirer.
11. Doc procedure rotation pour chaque token avec link UI provider.

---

## 9. Recommandations actions (≤ 2h dev)

1. Patcher `.env.example` + `.env.production.example` avec les 14 vars manquantes (+ descriptions).
2. Ajouter `REVALIDATE_SECRET` dans `env.ts` Zod schema avec superRefine prod-strict min 32.
3. Créer `_AUDIT/SECRETS-ROTATION-REGISTER.md` (template prêt §6).
4. Ajouter job gitleaks CI dans `.github/workflows/ci.yml` (`zricethezav/gitleaks-action@v2`).
5. Étendre `.gitleaks.toml` avec 3 rules custom (Stripe live, Anthropic, OpenAI).
6. Refactor `admin-dev-x7k2n9` → import `getAdminPath()` SSOT dans 4 callers.

---

## 10. Verdict final

**Score : 81/100** 🟡 **CONDITIONAL GO**

Force : Zod schema robuste avec superRefine prod-strict sur les 7 vars critiques, magic string `stub.invalid` propagée à 10/10 fichiers (3 bonus auto-adoption pattern), 0 secret hardcodé en clair, scripts/seeds clean.

Faiblesses : `.env.example` accuse 14 vars de retard dont 3 P0 sécurité, `REVALIDATE_SECRET` lue hors Zod (vulnérabilité auth potentielle), 18 tokens prod sans calendrier rotation, gitleaks pas câblé en CI.

**Top 3 P0 à fixer avant prod-public** :

1. Synchroniser `.env.example` ←→ `env.ts` (+ 14 vars dont IP_HASH_SALT, PII_ENCRYPTION_KEY, BACKUP_ENCRYPTION_PASSPHRASE)
2. Ajouter `REVALIDATE_SECRET` au schema Zod avec superRefine prod-strict
3. Créer registre rotation tokens (18 tokens à doc / périodicité 12 mois)

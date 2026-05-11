# PROMPT — DEPLOY RELIABILITY AUDIT 2026

**Version** : 1.1
**Créé** : 2026-05-09 (v1.0), upgradé même jour (v1.1)
**Auteur** : déclenchement post-session de débuggage prod du 2026-05-09 (V1 → V2 deploy, 5h+ de debug, ~10 commits-fix)
**Cible** : Axion-IA (Next.js 16 standalone + Postgres + Redis + BullMQ + Sentry + Hetzner CPX32 + Coolify 4.0)
**Objectif** : transformer un stack qui « marche par chance après 4h de patches » en un stack qui **boote en < 30 s, pas de surprises, pas de bugs muets, observable, sécurisé, recoverable**.

**Changelog v1.0 → v1.1** :

- ➕ Agent 6 — Security & Supply Chain
- ➕ Budgets perf concrets (cold start, image size, build time, latency, memory)
- ➕ Disaster Recovery + backup restore verification (Agent 5)
- ➕ Chaos & load testing (Phase 4)
- ➕ Effort estimates par agent (hours)
- ➕ Re-audit cadence (rituel /6 mois)
- ➕ Hadolint Dockerfile lint (Agent 3)
- ➕ Cost per deploy + bandwidth budget

---

## 🎯 OBJECTIF UNIQUE

Refactor + outillage tels que **chaque deploy futur doit** :

1. ✅ Réussir ou échouer **explicitement en moins de 15 min**, jamais en mode « ça boucle silencieux »
2. ✅ Être **détecté en CI** avant Coolify si le code casse le boot (gate-c-docker du commit `daaef32`)
3. ✅ Survivre à une **panne ponctuelle de Redis / Postgres / SMTP / Sentry** : le serveur HTTP doit rester UP, seules les requêtes qui touchent la dépendance morte échouent proprement
4. ✅ Émettre des **logs structurés** identifiables (pino JSON) avec niveau INFO/WARN/ERROR pour qu'on puisse grep
5. ✅ S'arrêter proprement sur SIGTERM (drain queues, close connexions, exit 0)

Pas une refonte. Un **durcissement chirurgical** des points faibles révélés aujourd'hui.

---

## 📜 CONTEXTE — CE QUI S'EST PASSÉ LE 2026-05-09

Pour que l'agent qui exécute ce prompt comprenne pourquoi on fait ça :

| Bug                       | Symptôme                                                           | Cause racine                                                                                                                                   | Fix appliqué                                                                       |
| ------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Crash Node au boot        | `wget: Connection refused` localhost:3000 dans healthcheck Coolify | `lib/redis.ts` ligne 25 : `export const redis = new Redis(...)` au top-level. ioredis émet `error` event sans listener → Node crash silencieux | `lazyConnect: true` ajouté (commit `daaef32`). Reste : refactor en factory pattern |
| 11 550 ECONNREFUSED build | SSG fait des connexions Redis pendant `next build`                 | `queues.ts` instancie 6 `new Queue(...)` au top-level → chaque page importée trigger les Queue events → tentatives connexion                   | `lazyConnect: true` masque le symptôme. Reste : refactor lazy factories            |
| Healthcheck Coolify cassé | `curl: not found` + `wget` busybox unreliable                      | Image `node:20.18.0-alpine` sans curl, Coolify s'attend à curl                                                                                 | `apk add curl` + `HEALTHCHECK` natif Dockerfile (commit `daaef32`)                 |
| OOM build                 | Build mort en 32 sec à `Running TypeScript ...`                    | CPX32 8 GB sans swap, 17 532 SSG pages saturent                                                                                                | 8 GB swap persistant ajouté                                                        |
| Env vars manquantes       | 4 builds échoués sur Zod superRefine                               | `BACKUP_ENCRYPTION_PASSPHRASE` introduit sans CI catch                                                                                         | Var ajoutée Coolify. Reste : CI valide toutes vars requises                        |
| Image 8.58 GB             | COPY standalone prend 137s                                         | 17 532 SSG pages × HTML × bundles                                                                                                              | Pas fixé. Optimisation à étudier                                                   |
| Build cache 29 GB orphan  | `docker system df` montre 29 GB recoverable                        | Pas de garbage collection auto Docker                                                                                                          | Pas fixé. Cron `docker builder prune` à programmer                                 |

**Status à l'instant T (2026-05-09 11:45)** :

- Commit `daaef32` poussé : lazyConnect Redis + Dockerfile HEALTHCHECK + CI gate-c-docker
- V1 (commit `ea387a77`) toujours en prod sur sslip.io
- HTTPS sur axion-ia.com pas encore actif (V2 deploy en cours)
- Service Redis Coolify provisioned, REDIS_URL à mettre à jour avec password correct

**Ce prompt prend le relais POST-deploy V2 réussi**. Il assume HTTPS axion-ia.com up.

---

## 🚫 INTOUCHABLES (NE PAS REMETTRE EN CAUSE)

L'agent ne doit PAS :

1. **Changer le stack** : Next 16 / Postgres / Redis / BullMQ / Sentry / Hetzner / Coolify sont décidés (ADR 0001, 0009)
2. **Migrer vers Vercel/AWS/Fly** : décision prod = Hetzner self-hosted, immuable
3. **Changer Postgres → SQLite, Redis → in-mem** : besoins multi-process (worker + web) imposent les deux
4. **Refondre l'architecture des features** : queues = BullMQ, sessions = Auth.js, c'est OK
5. **Toucher au pSEO villes** : 17 532 SSG pages = volumétrie acceptée, optimisation oui (ISR pour tier-2) mais pas suppression
6. **Modifier les contraintes business** : société OÜ Estonie, jamais SIREN, doctrine éditoriale v3 (Editorial Premium Light), etc.
7. **Désactiver Sentry / Plausible / monitoring** : self-hosted décidé, on les garde
8. **Bypasser les Gates CI existants** (gate-a, gate-b, gate-c) : on les renforce, on ne les contourne pas

---

## 🤖 MÉTHODOLOGIE — 6 AGENTS PARALLÈLES

Chaque agent rend un livrable Markdown numéroté dans `_AUDIT/RELIABILITY-2026/`. Les 6 tournent en parallèle, sans ordre, lecture-seule sur le code (pas de modif tant que la phase synthèse n'a pas validé).

**Effort estimé total** : 8-14 heures de travail (1 LLM + 1 humain pour synthèse). Détail par agent ci-dessous.

### Agent 1 — Eager Inits & Boot Blockers

**Mission** : trouver TOUS les `export const X = new Y()` ou top-level `await` qui peuvent bloquer le boot Node.

**Cibles** :

- `src/lib/*.ts` (redis déjà fixé, mais quoi d'autre ?)
- `src/server/**/*.ts` (queues, workers, jobs)
- `src/app/**/route.ts` (route handlers)
- `next.config.ts`, `instrumentation.ts`, `instrumentation-client.ts`
- `sentry.*.config.ts`
- Tout fichier importé par `app/layout.tsx` (chaîne d'imports SSR)

**Méthode** :

1. Grep `export const \w+ = new` → lister tous les hits
2. Pour chacun : tester si le constructor a side-effect réseau/DB/FS
3. Classer P0 (bloquant boot), P1 (lent boot), P2 (lazy déjà ou inoffensif)
4. Proposer refactor en factory `getX()` lazy pour P0 + P1

**Anti-patterns à flagger** :

- `export const client = new MongoClient(...).connect()` → eager + bloquant
- `await import("./heavy-init")` au top-level
- `setInterval(...)` ou `setTimeout(...)` au top-level avec side-effects
- Singleton qui appelle `process.exit(1)` sur erreur init

**Livrable** : `_AUDIT/RELIABILITY-2026/01-eager-inits.md`

- Tableau : fichier:ligne / constructor / side-effect / classification P0-P2 / fix proposé
- Patches diff prêts pour les P0 (à appliquer en Phase 3)
- Score : nombre de P0 fixés / nombre de P0 trouvés

**Effort estimé** : 1.5-2h.

---

### Agent 2 — Resilience aux Pannes Externes

**Mission** : pour chaque dép externe (Redis, Postgres, SMTP/PMTA, MailWizz, Sentry, Telegram, Hetzner Storage, Cloudflare Turnstile), répondre :

1. Que se passe-t-il si elle est **down** ?
   - Le serveur HTTP reste-t-il up ?
   - Quelles routes deviennent 5xx ?
   - Quelles routes restent OK ?
2. Y a-t-il un **circuit breaker** ou un **fallback** ?
3. Les erreurs sont-elles **catchées** + **loggées** + **monitorées** ?
4. Y a-t-il un **healthz détaillé** (`/api/healthz` indique chaque dép : up/down/skipped) ?

**Méthode** :

1. Lister chaque dép avec son `process.env.X_URL`
2. Trouver tous les `import` de chaque client
3. Vérifier patterns : `try/catch`, `.catch()`, `error` event, timeout, retry
4. Vérifier que les Server Actions qui touchent une dép retournent un Result type (`{ ok: true } | { ok: false, error }`) plutôt que de throw
5. Vérifier `/api/healthz` : doit checker chaque dép individuellement avec timeout < 500 ms

**Anti-patterns à flagger** :

- `await client.connect()` en module top-level sans timeout
- `client.query(...)` sans `.catch()`
- Server Action qui throw (Next 16 rend une 500 muette en prod)
- Healthz qui retourne 200 même si Redis/DB down (faux positif)
- Pas de Sentry capture sur les erreurs réseau/DB

**Best practices 2026** :

- Healthz à 3 niveaux : `/api/healthz` (liveness, toujours 200 si Node up), `/api/readyz` (readiness, 200 ssi toutes deps OK), `/api/healthz?deep=1` (status par dép)
- Circuit breaker via `opossum` ou pattern `Promise.race + timeout`
- Retry exponentiel avec jitter (jamais retry pure car thundering herd)
- Bulkheads : pool de connexions séparés par criticité (auth-critical / non-critical)

**Livrable** : `_AUDIT/RELIABILITY-2026/02-resilience.md`

- Tableau : dépendance / impact si down / circuit breaker / log / monitor
- Patches : healthz multi-niveaux, error wrapping Server Actions
- Score : 1 point par dép correctement gérée / N déps total

**Effort estimé** : 2-3h.

---

### Agent 3 — Container & Infrastructure

**Mission** : durcir le Dockerfile, l'image, et la config Coolify pour que le runtime soit prévisible.

**Sujets** :

#### 3a. Image size optimization

- Image actuelle : **8.58 GB** (anormalement gros)
- Cible 2026 : < 1.5 GB pour standalone Next 16 production
- Audit : qu'est-ce qui prend la place ? `.next/standalone` ? `.next/server/app/**` (17 532 pages HTML) ? `node_modules` qui ne devrait pas y être ?
- Méthode : `docker history <image>` + `dive` pour breakdown layer-par-layer

#### 3b. Build performance

- Build actuel : 12-15 min cold cache, ~6-8 min warm
- Cible : < 5 min warm
- Pistes : cache `.next/cache` mount, multi-stage agressif, COPY plus précis

#### 3c. Healthcheck strategy

- État actuel : `HEALTHCHECK` natif Dockerfile (commit `daaef32`)
- Vérifier : start-period 120s suffit ? interval 30s OK ? retries 3 OK ?
- Tester : `docker run` + `docker inspect` pour voir Health.Status évoluer

#### 3d. Graceful shutdown

- État actuel : pas de SIGTERM handler
- Cible : sur SIGTERM, drain queues, fermer pool DB, fermer Redis, exit 0 dans un délai < 30s
- Implémenter : `process.on('SIGTERM', ...)` dans `server.js` ou via Next instrumentation

#### 3e. Coolify config

- Vérifier les env vars Build Time vs Runtime (chaque var requise présente ?)
- Vérifier `Resource Limits` (mémoire / CPU caps cohérents avec swap 8 GB)
- Vérifier auto-deploy ON/OFF selon stratégie souhaitée
- Documenter dans `docs/ops/coolify-config.md`

**Anti-patterns à flagger** :

- `RUN apt-get update && apt-get install ... && rm -rf /var/lib/apt/lists/*` mal fait → cache layer balloon
- COPY de fichiers inutiles (tests, docs, \_AUDIT/) dans l'image runtime
- Pas de `USER nextjs` (exécution en root → risque sécurité)
- Pas de `EXPOSE 3000` documenté

**Best practices 2026** :

- Multi-stage : deps → builder → runner avec **rien d'autre** dans runner que `.next/standalone` + `public` + `static`
- `--mount=type=cache` pour pnpm-store et `.next/cache`
- `chown=nextjs:nodejs` sur tous les COPY pour éviter chmod runtime
- Image base : `node:20-alpine` est OK ; envisager `gcr.io/distroless/nodejs20-debian12` pour minimum (plus de attack surface)
- `.dockerignore` exhaustif (tests, \_AUDIT, docs, .git, .github)

**Livrable** : `_AUDIT/RELIABILITY-2026/03-container.md`

- Breakdown image actuelle (layers + size) via `dive`
- Patches Dockerfile pour réduire à <1.5 GB
- Patches `server.js` ou wrapper pour SIGTERM handler
- Doc `docs/ops/coolify-config.md`
- Output `hadolint Dockerfile` (lint Docker — installable via `npm i -g dockerfile-utils` ou Docker image)
- Score : MB actuel - MB cible / × ratio improvement

#### 📊 BUDGETS PERF CONCRETS (cibles à hit)

| Métrique                                     | Cible 2026 | État actuel             | Gap              |
| -------------------------------------------- | ---------- | ----------------------- | ---------------- |
| **Image size (compressed)**                  | < 1.5 GB   | 8.58 GB                 | -7 GB            |
| **Build time (warm cache)**                  | < 5 min    | 6-8 min                 | -2-3 min         |
| **Build time (cold)**                        | < 12 min   | 14-15 min               | -3 min           |
| **Cold start (container → port 3000 bound)** | < 8 s      | inconnu (jamais mesuré) | À mesurer        |
| **`/api/healthz` p95 latency**               | < 50 ms    | inconnu                 | À mesurer        |
| **`/fr` (homepage) TTFB p95**                | < 200 ms   | inconnu                 | À mesurer        |
| **Memory baseline (idle, RSS)**              | < 350 MB   | inconnu                 | À mesurer        |
| **Memory under load (1k req/s 5 min)**       | < 800 MB   | jamais testé            | Load test requis |
| **CPU baseline (idle)**                      | < 5%       | inconnu                 | À mesurer        |

L'agent doit instrumenter ces mesures (curl + time + docker stats), les inclure dans `03-container.md`, et flagger tout métrique au-dessus de la cible comme P0 ou P1.

**Hadolint rules à enforcer** :

- DL3008 : pin apt versions (n/a Alpine, mais équivalent `apk add --no-cache` → vérifier)
- DL3009 : `apt-get clean` (n/a Alpine)
- DL3018 : pin Alpine package versions (`apk add curl=8.x.y` — recommandé pas obligatoire)
- DL3025 : `CMD` en JSON array (✅ déjà OK)
- DL4006 : `SHELL ["/bin/sh", "-c", "-o", "pipefail"]` pour pipes
- Custom : pas de `RUN cd` (use `WORKDIR`), pas de `COPY .` (whitelist explicit)

**Effort estimé** : 2-3h.

---

### Agent 4 — CI/CD Pipeline

**Mission** : étendre `gate-c-docker` (commit `daaef32`) avec tous les checks qui auraient évité aujourd'hui.

**Sujets** :

#### 4a. Env vars validation

- Lire `src/env.ts` → extraire toutes les vars `.string()` non-`.optional()` → générer test qui les valide
- gate-c-docker doit FAIL si une var requise n'est pas dans le smoke test (sinon on passe à côté du `BACKUP_ENCRYPTION_PASSPHRASE` du jour)
- Mécanisme : script `scripts/check-env-coverage.ts` qui parse `env.ts` + `.github/workflows/ci.yml` + `.secrets-coolify/axion-ia-prod-env.txt`

#### 4b. Boot smoke tests étendus

- Ne pas juste tester `/api/healthz` → tester aussi :
  - `/fr` (200 OK)
  - `/en` (200 OK)
  - `/api/healthz?deep=1` (chaque dép individuelle)
  - `/sitemap.xml` (200 OK + non vide)
  - `/robots.txt` (200 OK)
- Tester avec **Redis up** ET **Redis down** (deux scénarios) → confirme que Node bind 3000 dans les deux cas

#### 4c. Build smoke

- Vérifier que l'image build < 1.5 GB (size-limit Docker)
- Vérifier que l'image build en < 8 min sur runner GitHub
- Régression detection : si build prend > +20% vs baseline, alerter

#### 4d. Production-like staging

- Si pas de VPS staging dédié : `gate-c-docker` doit être le seul filet
- Si budget : provisionner Hetzner CX21 (€4,90/mois), `staging.axion-ia.com`, auto-deploy `develop` branch
- Workflow `staging.yml` existe déjà — auditer son état

#### 4e. Rollback automation

- En cas de healthcheck qui fail post-deploy : Coolify doit rollback (déjà OK)
- Mais Coolify ne **notifie pas** : ajouter Telegram/email alert sur deployment failure
- Implémenter : webhook Coolify → endpoint Next `/api/admin/deploy-event` → log + Telegram

**Anti-patterns à flagger** :

- Tests CI qui passent en local mais pas en CI (env diff)
- Smoke test qui mocque trop (loupe les bugs réels)
- Pas de timeout sur les jobs CI → blocage runner si bug

**Best practices 2026** :

- GitHub Actions : `concurrency.group: deploy-${{ github.ref }}` pour annuler les jobs obsolètes
- `pull-requests: write` permission pour commenter les PR avec résultats smoke
- `actions/upload-artifact` pour les logs container en cas de fail
- Caching strategie : `actions/cache` pour pnpm-store + .next/cache
- `if: failure() && github.event_name == 'push'` pour déclencher alertes

**Livrable** : `_AUDIT/RELIABILITY-2026/04-ci-cd.md`

- Tableau : check / présent (oui/non) / patch proposé
- Diffs `.github/workflows/ci.yml` étendu
- Diff `.github/workflows/staging.yml` audité
- Script `scripts/check-env-coverage.ts`
- Score : checks couverts / checks idéaux

**Effort estimé** : 1.5-2h.

---

### Agent 5 — Observability & Operations

**Mission** : sans observabilité, on ne peut pas opérer. Aujourd'hui, Will a découvert un bug par mauvais hasard (log Coolify) — ça ne doit pas être la norme.

**Sujets** :

#### 5a. Logs structurés

- État actuel : `pino` 10.3.1 dans deps, mais utilisé partout ? Niveaux cohérents ? Format JSON en prod ?
- Cible : tous les logs prod en JSON Lines, niveau INFO/WARN/ERROR/FATAL, request-id propagé
- Audit : grep `console.log` / `console.error` → remplacer par `logger.info` / `logger.error`

#### 5b. Sentry config

- État actuel : `@sentry/nextjs` 10.51.0 dans deps, `sentry.*.config.ts` présents
- Vérifier : DSN configurée prod ? Sample rate (errors 100%, traces 10%) ? PII filtering ?
- Vérifier : alertes Sentry → Telegram / email (rule "rate > 10/min")

#### 5c. Health monitoring externe

- Aujourd'hui : pas de uptime monitoring externe (pas de Better Uptime / Uptime Kuma / etc.)
- Cible : 1 sonde externe qui pingue `/api/healthz` toutes les 60s
- Pistes : self-hosted Uptime Kuma sur même VPS (~free), ou betteruptime.com (gratuit jusqu'à 10 monitors)

#### 5d. Metrics (Prometheus)

- Optionnel mais bon pour 2026 : exposer `/api/metrics` Prometheus avec :
  - HTTP latence p50/p95/p99 par route
  - Queue depth BullMQ
  - DB pool connections
  - Redis pool connections
- Scraper externe : Grafana Cloud Free (10k series gratuit) ou self-host

#### 5e. Runbook

- Doc `docs/ops/runbook.md` avec :
  - « Si HTTPS down 5 min : checklist débuggage »
  - « Si build deploy fail : checklist (env vars / Redis / disk / RAM) »
  - « Si Redis down : impact, comment reconnecter »
  - « Comment scale horizontalement (ajouter une instance worker) »

**Anti-patterns à flagger** :

- `console.log` qui leak des PII (emails, tokens) en prod
- Sentry qui n'a pas de filter avant `beforeSend`
- Healthz détaillé public sans auth (info disclosure)
- Logs sans correlation-id (impossible de tracer une requête)

**Best practices 2026** :

- OpenTelemetry pour traces (compatible Sentry, Grafana, Jaeger)
- Logs immuables : append-only, jamais éditer
- Métriques RED (Rate, Errors, Duration) par endpoint
- SLI / SLO documentés (« 99.5% uptime mensuel », « p95 latency < 500 ms »)

#### 5f. Disaster Recovery & backup verification

**État actuel** :

- `BACKUP_ENCRYPTION_PASSPHRASE` set (P0-OPS-2 fix), backup script `scripts/backup-postgres.sh` existe
- Mais : **JAMAIS testé un restore réel sur staging/test DB**
- Cron quotidien Hetzner Storage (HETZNER*STORAGE*\*) présumé OK mais à vérifier

**Cible 2026** :

- **RTO** (Recovery Time Objective) : < 1h pour ramener le site UP après destruction VPS
- **RPO** (Recovery Point Objective) : < 24h de data loss max (backup quotidien)
- **Restore test** : automatisé tous les 7 jours sur container éphémère + assertion data integrity

**Méthode de l'agent** :

1. Auditer `scripts/backup-postgres.sh` + `restore-postgres-test.sh` (existent ?)
2. Vérifier que cron Hetzner Storage tourne réellement (logs)
3. Spec un test restore : pull dernier backup S3 Hetzner → décrypter avec passphrase → restore sur Postgres temporaire → vérifier `SELECT count(*) FROM users` cohérent
4. Documenter dans `docs/ops/disaster-recovery.md` :
   - Scénarios : DB corruption, VPS dead, region outage Hetzner Nuremberg, ransomware
   - Playbook étape-par-étape pour chacun
   - Coordonnées contacts Hetzner support, Cloudflare support

**Anti-patterns à flagger** :

- Backup mais jamais restore-tested → faux sentiment de sécurité
- Backup chiffré avec passphrase non backupée hors-ligne (hardware key, gestionnaire mots de passe) → si VPS perdu, perte de la passphrase = perte définitive des données
- Pas de off-site backup (tout sur Hetzner Frankfurt) → outage régionale = data loss

**Best practices 2026** :

- 3-2-1 rule : 3 copies, 2 médias différents, 1 off-site
- Versioning S3 (objets immutable) → protection ransomware
- Chiffrement client-side avant upload (jamais confier au provider)
- Test restore mensuel automatisé en CI

**Livrable** : `_AUDIT/RELIABILITY-2026/05-observability.md`

- Tableau : signal / collecté / monitoré / alerté
- Patches code : pino logger universel, Sentry config audit
- Doc `docs/ops/runbook.md` ébauche
- Doc `docs/ops/disaster-recovery.md` (RTO/RPO + playbooks)
- Setup Uptime Kuma / similaire (instructions pas-à-pas)
- Script CI restore-test (run hebdo)
- Score : signaux observables / signaux idéaux + 1 point pour DR test passant

**Effort estimé** : 2-3h.

---

### Agent 6 — Security & Supply Chain (NEW v1.1)

**Mission** : prod 2026 sans security audit = vulnérable. Cet agent couvre tout ce qui touche à la sécurité runtime, supply chain, et conformité.

**Sujets** :

#### 6a. Supply chain security

- État : `package.json` avec ~40 deps directes, ~1300 transitives
- Cibles :
  - **Renovate** ou **Dependabot** activé pour PR auto sur deps (security + minor)
  - **`pnpm audit`** propre (0 high/critical) — gate CI obligatoire
  - **Snyk** ou **Socket** pour analyse supply chain (typosquatting, malicious code)
  - **SBOM** (Software Bill of Materials) généré au build : `cyclonedx-pnpm` ou `syft`
  - **License audit** : pas de GPL en prod, vérifier compat MIT/Apache/ISC

#### 6b. OWASP runtime hardening

- **Headers HTTP sécurité** : audit current `next.config.ts` headers vs OWASP recommendations
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `Content-Security-Policy` strict (déjà sprint 24 phase 3 fait CSP nonce)
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` ou CSP `frame-ancestors`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Cross-Origin-Embedder-Policy: require-corp` (Sprint 24 phase 3 fait COEP)
- **Rate limiting** : routes `/api/*` doivent rate-limit par IP + par user (Redis backend)
- **CSRF** : Auth.js v5 a built-in CSRF tokens — vérifier que les Server Actions sont bien wrappées
- **CORS** : strict (`origin: 'https://axion-ia.com'`) sur toutes les routes API

#### 6c. Auth.js v5 beta hardening

- v5 est en **beta** : audit la matrice maturité (https://authjs.dev/getting-started/migrating-to-v5#warning)
- **2FA** : TOTP existe (`otplib`), WebAuthn existe — vérifier obligatoire pour comptes admin
- **JWT revocation** : Sprint 24 phase 3 introduit JWT revocation check — vérifier que ça tourne sur tous les endpoints sensibles
- **Session expiry** : cookies `Max-Age` raisonnable (idle 1h, absolute 7 jours), `SameSite: Lax`, `Secure: true`, `HttpOnly: true`
- **Brute force protection** : rate-limit signin attempts (Redis), exponential backoff, lockout après N échecs

#### 6d. Secrets management

- État : env vars Coolify, secrets backupés dans `.secrets-coolify/` local (gitignore)
- Évaluer :
  - **Rotation policy** : tous les secrets (`AUTH_SECRET`, `BACKUP_ENCRYPTION_PASSPHRASE`, etc.) rotation /90 jours documentée
  - **Vault solution** : pour 2026+, intégrer **HashiCorp Vault** ou **Doppler** ou **Bitwarden Secrets Manager** plutôt que env vars Coolify cleartext
  - **Pre-commit hook** : `gitleaks` runs (déjà OK dans `gate-a`) + ajouter `pre-commit-detect-secrets`
  - **Audit log** : qui a vu/modifié quel secret, quand

#### 6e. RGPD / privacy compliance

- Sprint 24 phase 4+5 a fait gros boulot RGPD (privacy + erase + gdpr-export + retention) — auditer ce qui reste :
  - **Cookie consent** : banner avant tracking ? Non-EU users opt-in/out ?
  - **Data minimization** : Sprint 24.1 a touché ça — vérifier audit logs n'enregistrent pas PII
  - **Audit trail** : changements admin tracés ? Logs immutables ?
  - **Data residency** : Hetzner Frankfurt = EU ✅. Mais Sentry self-hosted ? Plausible self-hosted ? Vérifier qu'aucun donnée user transite hors EU
  - **DPA papier** : 1 P0 du verdict 2026-05-09 → action Will (pas codable)

#### 6f. Container & runtime security

- **User non-root** ✅ (`USER nextjs` déjà dans Dockerfile)
- **Read-only root filesystem** : Coolify peut-il monter `/` en RO ? Tester
- **Capabilities** : drop tout sauf `NET_BIND_SERVICE` (Docker `--cap-drop=ALL`)
- **Seccomp profile** : default Docker OK, optionnel custom
- **No new privileges** : `--security-opt=no-new-privileges`
- **Resource limits** : `--memory`, `--cpus` cohérents avec Coolify config
- **Image scanning** : `trivy` ou `grype` sur l'image avant push → 0 critical vulns gate CI

#### 6g. Network security

- **Firewall Hetzner** : déjà configuré ? Ports 80/443/SSH only ?
- **fail2ban** sur SSH ✅ (Sprint 0 hardening)
- **DDoS protection** : Cloudflare Free niveau Layer 7 — vérifier rules en place (Bot Fight Mode, rate limit, challenge)
- **TLS** : config Traefik sur Coolify → TLS 1.2 min, ciphers modernes, OCSP stapling
- **HTTPS everywhere** : redirect 80 → 443, HSTS preload list submission

**Anti-patterns à flagger** :

- Secrets en clair dans logs Sentry/pino (PII filter manquant)
- Endpoints admin sans rate limit ni 2FA (compte admin compromis = game over)
- `pnpm install` sans `--frozen-lockfile` (supply chain risk)
- Image build sans scan vuln (trivy/grype)
- Cookies sans `Secure` ou `HttpOnly`
- CSP `unsafe-inline` ou `unsafe-eval` (sauf justifié + nonce)
- CORS `*` ou origin wildcards
- Endpoints publics qui leak info (stack traces en prod, healthz détaillé sans auth)

**Best practices 2026** :

- **Zero Trust** : ne fais confiance à personne, même au réseau interne. Tous les calls auth.
- **Least privilege** : prod accounts read-only sauf migrations explicites
- **Defense in depth** : si 1 couche tombe, 5 autres protègent
- **CIS Benchmarks** : checklist Docker + Linux server (script automatisable)
- **Pentest régulier** : 1×/an minimum (manuel ou tool)
- **Bug bounty** : public ou private, à mettre en place quand on a du trafic

**Livrable** : `_AUDIT/RELIABILITY-2026/06-security.md`

- Tableau : contrôle / standard 2026 / état actuel / gap / patch
- Output `pnpm audit` + `trivy image axion-ia:latest` + `hadolint Dockerfile`
- Patches : headers HTTP sécurité (next.config.ts), rate limit middleware, secrets rotation script
- Doc `docs/ops/security-runbook.md` (incident response)
- Doc `docs/ops/secrets-rotation.md` (procédure /90j)
- Score : contrôles passés / contrôles 2026

**Effort estimé** : 2.5-3.5h.

---

## 📊 PHASE 2 — SYNTHÈSE

Une fois les 5 agents finis, **un agent de synthèse** consolide :

**Livrable** : `_AUDIT/RELIABILITY-2026/00-synthese.md`

Contenu :

- Résumé exécutif 1 page (état actuel / écart / effort estimé / impact business)
- Score consolidé /500 (5 agents × 100)
- Top 10 P0 (à fixer maintenant) avec patch + ETA
- Top 10 P1 (à planifier ce mois) avec ticket à créer
- Top 10 P2 (long terme, backlog)
- Schéma architecture cible (Mermaid)
- Roadmap 4 semaines (S1 P0, S2 P0+P1, S3 P1, S4 P2 + audit re-run)

**STOP & ASK** : avant de passer en Phase 3 (patches), Will valide :

- Le scope (tout / juste P0 / juste un agent)
- La fenêtre de déploiement (incrément continu vs big bang)
- Les tradeoffs (ex : Distroless vs Alpine, OpenTelemetry vs juste Sentry)

---

## 🛠️ PHASE 3 — PATCHES

L'agent applique **uniquement les P0 validés** par Will. Pour chaque patch :

1. Branche dédiée `chore/reliability-2026-XX` (XX = numéro patch)
2. Diff minimal (ne pas mélanger plusieurs P0)
3. Pre-push hooks doivent passer (typecheck, eslint, tests, anti-siren, anti-hex, use-client, zod)
4. PR vers `main` avec description :
   - Quelle dette résolue
   - Référence agent/livrable
   - Impact (boot, runtime, ops)
   - Comment tester
5. **Pas de merge auto** : Will review + merge

**Patches typiques attendus** :

- `chore/reliability-2026-01` : refactor `queues.ts` en lazy factories
- `chore/reliability-2026-02` : healthz multi-niveaux (liveness/readiness/deep)
- `chore/reliability-2026-03` : SIGTERM handler dans server.js
- `chore/reliability-2026-04` : Dockerfile slim (image < 1.5 GB)
- `chore/reliability-2026-05` : `scripts/check-env-coverage.ts` + intégration CI
- `chore/reliability-2026-06` : pino logger universel (remplace console.\*)
- `chore/reliability-2026-07` : Coolify webhook → Telegram alert sur deploy fail
- `chore/reliability-2026-08` : Uptime Kuma deployment + monitor /api/healthz
- `chore/reliability-2026-09` : Renovate config + Dependabot + `pnpm audit` gate CI
- `chore/reliability-2026-10` : Headers HTTP sécurité OWASP 2026
- `chore/reliability-2026-11` : `trivy` scan image dans gate-c-docker
- `chore/reliability-2026-12` : Restore test backup automatisé (cron CI hebdo)
- `chore/reliability-2026-13` : Hadolint Dockerfile + size-limit Docker
- `chore/reliability-2026-14` : Rate limit middleware Redis-backed sur /api/\*

---

## ✅ PHASE 4 — VÉRIFICATION

Après merge des P0 :

### 4.1 Boot & Deploy

1. **Re-run gate-c-docker** sur main → must pass
2. **Deploy V3 sur prod** Coolify → mesurer temps total deploy + boot
3. **Mesures perf** : verifier que les budgets de la table § Agent 3 sont hit (image, build, cold start, latency, memory)

### 4.2 Test panne simulée (chaos engineering basique)

- **Stop Redis** → `/api/healthz` 200, `/api/readyz` 503, site SSG sert OK, Server Actions Redis échouent proprement
- **Stop Postgres** → mêmes attentes
- **Restart Redis** → reconnect < 30 s, queues reprennent
- **Network partition** (Coolify → Redis via `iptables -A OUTPUT -p tcp --dport 6379 -j DROP` 30 sec) → comportement gracieux
- **SIGTERM** : `docker stop --time 30 <container>` → exit 0 dans le délai, queues drainées
- **OOM simulé** : `docker run --memory 100m` → process killed proprement, Coolify rollback

### 4.3 Load test (NEW v1.1)

- Tool : `k6` ou `bombardier`
- Scénario : 1 000 req/s pendant 5 min sur mix routes (`/fr`, `/api/healthz`, `/fr/par-ville/paris`)
- Cibles :
  - p95 latency < 500 ms
  - error rate < 0.1%
  - memory < 800 MB sustained
  - CPU < 80% sustained
- Si fail : profiling + optimisation (cache, ISR, pool tuning)

### 4.4 Recovery test

- Kill l'image active : `docker rm -f <container>` → Coolify doit rollback < 60 s
- VPS reboot complet (Hetzner Cloud → Reset) → site UP < 5 min
- **DR drill** (NEW v1.1) : simuler perte VPS complète → suivre playbook `docs/ops/disaster-recovery.md` → site UP sur nouveau VPS < 1h (RTO target)

### 4.5 Observabilité validation

- **Log shipping** : générer 1 erreur volontaire → apparaît dans Sentry + Telegram dans < 60 s
- **Metrics** : dashboard montre p50/p95/p99 latency, queue depth, error rate
- **Uptime monitor** : 1 ping externe toutes les 60 s, alerte si 2 fails consécutifs

### 4.6 Security validation (NEW v1.1)

- `trivy image axion-ia:latest` → 0 critical, < 5 high
- `pnpm audit` → 0 critical, 0 high
- Headers `securityheaders.com` → grade A+ minimum
- `ssllabs.com` → grade A+ minimum (TLS, HSTS, etc.)
- Rate limit : burst 100 req/s test → block kicks in

**Livrable** : `_AUDIT/RELIABILITY-2026/99-verdict.md`

- Score post-patches /600
- Liste P0 fixés ✅ / P0 reportés ⏳ / P0 abandonnés ❌
- Comparatif perf : temps build / boot / image size / latency avant/après
- Résultats chaos + load test
- Résultats security scan (trivy + headers + ssllabs)
- Sign-off Will (« GO ROBUSTE 2026 »)

---

## 🔢 SCORING — /600 GLOBAL

| Agent     | Catégorie               | Score    |
| --------- | ----------------------- | -------- |
| 1         | Eager Inits & Boot      | /100     |
| 2         | Resilience Externe      | /100     |
| 3         | Container & Infra       | /100     |
| 4         | CI/CD Pipeline          | /100     |
| 5         | Observability & Ops     | /100     |
| 6         | Security & Supply Chain | /100     |
| **Total** |                         | **/600** |

Verdict :

- **0-240** : non production-ready, à NE PAS DÉPLOYER
- **240-420** : production-acceptable mais fragile, P0 à fixer ASAP
- **420-540** : robuste, P1 à planifier
- **540-600** : best-in-class 2026 ✨

État estimé actuel **après commit `daaef32`** : ~280/600 (lazyConnect + Dockerfile HEALTHCHECK + CI gate-c-docker = ~+60 pts vs avant la session, mais reste 6 agents à dérouler).

Cible post-audit : **480/600** minimum (80%).

---

## 🔄 RE-AUDIT CADENCE (NEW v1.1)

Cet audit n'est PAS one-shot. Il doit être **re-run** à intervalles réguliers pour rester à niveau.

| Trigger                                                   | Action                                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Tous les 6 mois**                                       | Re-run complet 6 agents — détecte la dérive (deps obsolètes, nouveaux anti-patterns, perf regression) |
| **Avant Sprint majeur** (15+, ex: nouveau module produit) | Re-run Agents 1, 2, 6 — focus boot, résilience, sécurité                                              |
| **Après incident prod** (P0 ou P1)                        | Re-run agent concerné + post-mortem dans `_AUDIT/POSTMORTEMS/YYYY-MM-DD.md`                           |
| **Major upgrade Next.js / Node** (16 → 17)                | Re-run Agents 1, 3 — souvent les patterns changent                                                    |
| **Audit pen-test annuel**                                 | Re-run Agent 6 + tests externes (OWASP ZAP, Burp Suite)                                               |

**Documenter chaque run** dans `_AUDIT/RELIABILITY-2026/HISTORY.md` :

```
2026-05-09 v1.1 — first run (post déploy V2 painful) — score X/600
2026-11-XX v1.x — re-audit /6 mois — score Y/600 — drift +/-
2027-XX-XX v2.0 — major bump (Next 17 ?) — score Z/600
```

**Owner** : Will (single dev) jusqu'à scaling team. Quand l'équipe grandit, créer rôle « Reliability Champion » qui owns ce prompt et le runbook.

---

## ⚙️ CONTRAINTES D'EXÉCUTION

- **Lecture-seule du code en Phase 1** (pas de modif tant que synthèse pas validée)
- **5 agents en parallèle**, pas en série (gain temps)
- **Tous les livrables en Markdown** dans `_AUDIT/RELIABILITY-2026/`, conventionnés
- **Pas de bypass** des hooks pre-commit / pre-push
- **STOP & ASK** entre Phase 2 (synthèse) et Phase 3 (patches)
- **STOP & ASK** entre Phase 3 (patches) et Phase 4 (vérif)
- **Aucun secret en clair dans les livrables** (REDIS_URL, AUTH_SECRET, etc. → toujours `<REDACTED>`)
- **Respecter la doctrine v3** (Editorial Premium Light, Axion-IA naming, OÜ Estonie, etc.) — voir `axionia/CLAUDE.md` et mémoires existantes

---

## 🚀 PHRASE D'INVOCATION

Pour lancer cet audit dans une session future :

> Lance l'audit deploy reliability `_AUDIT/PROMPT-DEPLOY-RELIABILITY-2026.md`. 6 agents parallèles Phase 1, synthèse Phase 2, STOP & ASK avant patches.

Ou si tu veux un seul agent ciblé :

> Lance l'agent N de `_AUDIT/PROMPT-DEPLOY-RELIABILITY-2026.md` (où N = 1, 2, 3, 4, 5 ou 6). Livrable seul, pas de synthèse, pas de patches.

Ou pour re-audit /6 mois :

> Re-run audit deploy reliability `_AUDIT/PROMPT-DEPLOY-RELIABILITY-2026.md` (cadence /6 mois). Compare score avec dernière entrée `_AUDIT/RELIABILITY-2026/HISTORY.md`, flag toute régression P0.

---

## 📚 RÉFÉRENCES BEST PRACTICES 2026

- **Twelve-Factor App** : https://12factor.net/ (config, deps, processes, port binding, etc.)
- **Cloud Native Patterns** : Kubernetes patterns mais applicables Docker single-host (probes, init containers, sidecars)
- **OWASP Top 10 Runtime** : injection, broken auth, sensitive data exposure, XXE, etc.
- **Next.js 16 Production Checklist** : https://nextjs.org/docs/pages/building-your-application/deploying/production-checklist
- **Sentry Best Practices 2026** : sample rate, beforeSend, PII scrubbing, release tracking
- **Docker Best Practices** : multi-stage, .dockerignore, USER non-root, HEALTHCHECK, distroless
- **GitHub Actions** : concurrency, secrets, caching, matrix builds, workflow_dispatch
- **Observability Engineering** (Charity Majors) : 3 pillars metrics/logs/traces, SLO/SLI, error budgets

---

## 🏁 OUTPUT FINAL ATTENDU

```
_AUDIT/RELIABILITY-2026/
├── HISTORY.md                  ← log des runs (re-audit cadence)
├── 00-synthese.md              ← consolidation 6 agents
├── 01-eager-inits.md           ← Agent 1
├── 02-resilience.md            ← Agent 2
├── 03-container.md             ← Agent 3 (+ budgets perf + hadolint)
├── 04-ci-cd.md                 ← Agent 4
├── 05-observability.md         ← Agent 5 (+ DR & restore test)
├── 06-security.md              ← Agent 6 (NEW v1.1)
├── 99-verdict.md               ← post-patches sign-off
└── patches/
    ├── chore-reliability-2026-01.diff
    ├── chore-reliability-2026-02.diff
    └── ... (jusqu'à 14)
```

Plus :

- `docs/ops/runbook.md` (créé/mis à jour par Agent 5)
- `docs/ops/coolify-config.md` (créé par Agent 3)
- `docs/ops/disaster-recovery.md` (créé par Agent 5)
- `docs/ops/security-runbook.md` (créé par Agent 6)
- `docs/ops/secrets-rotation.md` (créé par Agent 6)
- `scripts/check-env-coverage.ts` (créé par Agent 4)
- `scripts/sigterm-test.sh` (créé par Agent 3)
- `scripts/restore-test.sh` (créé par Agent 5)
- `scripts/load-test.js` k6 scenario (créé par Phase 4)

---

## 💰 COÛTS ESTIMÉS (NEW v1.1)

**Coûts d'exécution de l'audit** :

- 6 agents × ~2-3h LLM = 12-18h LLM cumulé (~$5-15 sur Claude API si exécuté programmatiquement)
- - ~3-5h humain (review synthèse + valider patches + tester en local)

**Coûts post-implémentation des patches** (mensuel récurrent) :

- Hetzner CPX32 : 13.99 €/mois (déjà payé)
- Cloudflare Free : 0 € (déjà)
- Sentry self-hosted : 0 € (sur même VPS, ~100 MB RAM extra)
- Plausible self-hosted : 0 € (sur même VPS)
- Uptime Kuma : 0 € (sur même VPS, ~50 MB RAM extra)
- Renovate : 0 € (gratuit pour repos publics, $25/mois pour privés sur Mend)
- Snyk : 0 € (gratuit jusqu'à 200 tests/mois)
- BetterUptime : 0 € (jusqu'à 10 monitors)
- **Total nouveau coût : 0 €/mois** (tout self-hosted ou tier gratuit)

**Coûts de NON-implémentation** (downtime cost) :

- 1h downtime axion-ia.com = perte SEO + trust + leads commerciaux
- Aujourd'hui : pas de monitoring → un downtime peut durer **des heures** avant détection
- ROI patches reliability : prévention 1 incident /6 mois = >100h économisées

---

**FIN DU PROMPT v1.1.**

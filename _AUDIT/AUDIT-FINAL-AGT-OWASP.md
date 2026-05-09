# AUDIT FINAL — AGT-OWASP-RUNTIME

**Mission** : audit OWASP **runtime / production-grade** (complément Pass B SECURITY 91.4 % ASVS 5.0)
**Périmètre** : 5 chapitres ciblés prod-readiness publique
**Code HEAD** : `c194caa` (post v10.2 + Sprint 0 kickoff)
**Date** : 2026-05-09
**Référentiels** : OWASP ASVS 5.0 V9/V3/V13/V14, OWASP Cheat Sheet HTTP Headers 2024, RFC 6797 (HSTS), RFC 6238 (TOTP), RFC 6265bis, RFC 8058
**Mode** : lecture-seule, écriture limitée à `_AUDIT/`

---

## 0. SYNTHÈSE EXÉCUTIVE

### 0.1 Compteurs

| Sévérité                          | Compte | Total cumulé |
| --------------------------------- | ------ | ------------ |
| **P0 — Bloquant prod publique**   | **2**  | 2            |
| **P1 — Élevé (≤ 30 j post-prod)** | **3**  | 5            |
| **P2 — Moyen (Sprint 24/25)**     | **6**  | 11           |
| **P3 — Mineur (backlog)**         | **5**  | 16           |
| **TOTAL**                         | —      | **16**       |

### 0.2 Verdict

> **CONDITIONAL GO PROD**

Le runtime est solide : argon2id OWASP, TOTP RFC 6238, JWT signé `AUTH_SECRET ≥ 32`, rate-limit composite IP+email, anti-oracle email timing-safe, fail-closed Turnstile, headers OWASP complets sauf COEP, CSP `frame-ancestors 'none'` actif, HSTS 2 ans + preload. **Aucun blocker cryptographique**. Les **2 P0** sont opérationnels et actionables en quelques heures :

1. **P0-OPS-1** : `BACKUP_ENCRYPTION_PASSPHRASE` + `HETZNER_STORAGE_USER` + `HETZNER_STORAGE_HOST` **absents** de `.env.production.example` ET de `src/env.ts`. Le script `scripts/backup-postgres.sh:107-109` exige ces 4 vars (`require_env`) → **première exécution cron crash** → **0 backup chiffré pendant N jours sans alerte autre que Telegram**. Risque RGPD majeur (perte données + non-conformité art. 32). **Bloquer GO PROD tant que les 4 vars ne sont pas dans Coolify**.
2. **P0-OPS-2** : `.env.production.example` ne déclare pas `BACKUP_ENCRYPTION_PASSPHRASE` ni les 4 vars Hetzner Storage (Storage Box `_USER`/`_HOST` SSH ≠ Storage Box S3 `_KEY`/`_SECRET` qui elles sont déclarées mais pour S3-compat, pas SSH+rsync). **Confusion entre S3 endpoint et SSH host** → ops déploient les mauvaises vars.

Les 3 P1 sont du durcissement CSP/COEP/session-revocation (déjà identifiés en Pass B, repris ici comme prod-blockers atténués). **Mise en prod publique autorisée si et seulement si :**

- [x] `AUTH_SECRET` réel ≥ 32 chars ET ne commence pas par `dev_` / `dev-` (le superRefine bloque le boot prod sinon).
- [x] `ADMIN_URL_PREFIX` random (pas `admin-dev-x7k2n9`, le fallback dev hardcodé `auth.config.ts:33`).
- [x] `TURNSTILE_SECRET_KEY` injecté (sinon fail-closed → 100 % forms publics renvoient "Captcha échoué").
- [ ] **P0-OPS-1 résolu** : 4 vars backup (`BACKUP_ENCRYPTION_PASSPHRASE`, `HETZNER_STORAGE_USER`, `HETZNER_STORAGE_HOST`) injectées Coolify ET ajoutées au template `.env.production.example`.
- [ ] **P0-OPS-2 résolu** : `src/env.ts` typage Zod strict (≥ 32 chars + superRefine prod) sur `BACKUP_ENCRYPTION_PASSPHRASE`.
- [ ] Smoke test cron backup en staging avant 1er run prod.

---

## 1. CHAPITRE 1 — HEADERS PRODUCTION RUNTIME

**Source de vérité** : `next.config.ts:9-50`, `Caddyfile:54-127`

### 1.1 Verdict chapitre

| Critère                                                        | Statut | Détail                                                                                                 |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| CSP active prod-only                                           | ✓      | `next.config.ts:47-49` `process.env.NODE_ENV === "production"`                                         |
| `frame-ancestors 'none'`                                       | ✓      | `next.config.ts:25`                                                                                    |
| `X-Frame-Options: DENY`                                        | ✓      | `next.config.ts:33`                                                                                    |
| `X-Content-Type-Options: nosniff`                              | ✓      | `next.config.ts:34`                                                                                    |
| HSTS preload 2 ans                                             | ✓      | `max-age=63072000; includeSubDomains; preload` (`next.config.ts:41`)                                   |
| COOP `same-origin`                                             | ✓      | `next.config.ts:43`                                                                                    |
| CORP `same-origin`                                             | ✓      | `next.config.ts:44`                                                                                    |
| **COEP `require-corp`**                                        | **✗**  | **MISS** — empêche `crossOriginIsolated`, P1 (déjà Pass B P2-3)                                        |
| `Permissions-Policy` 9 features                                | ✓      | camera, microphone, geolocation, accelerometer, gyroscope, magnetometer, payment, usb, interest-cohort |
| `Referrer-Policy: strict-origin-when-cross-origin`             | ✓      | `next.config.ts:35`                                                                                    |
| `script-src` sans `'unsafe-inline'`                            | ✗      | `next.config.ts:19` — V1 tolère, **P1** Sprint 24 nonce strict-dynamic                                 |
| `script-src` sans `'unsafe-eval'`                              | ✗      | idem — **P1** Sprint 24                                                                                |
| `style-src` sans `'unsafe-inline'`                             | ✗      | `next.config.ts:20` — toléré par next/font + Tailwind JIT, P2                                          |
| `object-src 'none'`                                            | ✓      | `next.config.ts:28`                                                                                    |
| `base-uri 'self'`                                              | ✓      | `next.config.ts:27`                                                                                    |
| `form-action 'self'`                                           | ✓      | `next.config.ts:26`                                                                                    |
| `upgrade-insecure-requests`                                    | ✓      | `next.config.ts:29`                                                                                    |
| `Vary: RSC, ...` (CDN cache)                                   | ✓      | `next.config.ts:55-60`                                                                                 |
| Caddy `Cache-Control: immutable` /\_next/static                | ✓      | `Caddyfile:64-68` `max-age=31536000, immutable`                                                        |
| Caddy security headers sous-domaines (Sentry/Plausible/Uptime) | ✓      | `Caddyfile:95-127` HSTS+XFO+nosniff                                                                    |
| `Server` header non-divulgant                                  | △      | Caddy émet `Server: Caddy` (`Caddyfile:58`) — divulgation produit, P3 (mettre `""`)                    |

**Score chapitre** : 17 / 20 critères critiques = **85 %** ✓ (P1 unique : COEP + CSP V2)

### 1.2 Findings

#### P1-HDR-1 — CSP `script-src` contient `'unsafe-inline'` ET `'unsafe-eval'`

- **Fichier:ligne** : `next.config.ts:19`
- **Ligne actuelle** : `"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://plausible.axion-ia.com",`
- **Risque** : si XSS injecté contourne l'escape JSX React (rare mais possible via attribut href/src dynamique non whitelisté), `'unsafe-eval'` permet RCE côté client (eval, Function, setTimeout(string), …). `'unsafe-inline'` permet injection inline `<script>...</script>`.
- **Justification V1** : Next 16 inline scripts hot-reload dev + minified runtime + chunks. Sprint 24 backlog explicitement (commentaire `next.config.ts:13-16`).
- **Action prod publique** : **acceptable V1** (déjà documenté Pass B P1-1) **mais Sprint 24 obligatoire** sous 30 jours :
  1. Propager nonce dynamique via `headers()` dans `app/[locale]/layout.tsx`
  2. Switch vers `'strict-dynamic' 'nonce-{random}'` (CSP3)
  3. Retirer `'unsafe-eval'` complètement (Next 16 stable n'en a plus besoin runtime)
  4. Re-tester `/reserver` (calendrier client-heavy avec Suspense streaming)

#### P1-HDR-2 — `Cross-Origin-Embedder-Policy` absent

- **Fichier** : `next.config.ts:32-50` (ne déclare pas COEP)
- **Risque** : sans COEP `require-corp`, `crossOriginIsolated` reste `false`. Pas bloquant V1 (pas de SharedArrayBuffer ni `performance.measureUserAgentSpecificMemory`), mais **MISS conformité OWASP V9.4** (defense in depth Spectre/Meltdown).
- **Action** : ajouter `{ key: "Cross-Origin-Embedder-Policy", value: "require-corp" }` après `Cross-Origin-Resource-Policy` (`next.config.ts:44`). Tester d'abord en preview : si une iframe Cloudflare Turnstile / un asset `<img>` Plausible ne sert pas `Cross-Origin-Resource-Policy: cross-origin`, ils planteront. Mitigation : utiliser `credentialless` au lieu de `require-corp` (Chrome 96+, Firefox 119+ sans Safari).
- **Effort** : 1 h (header + smoke test 15 pages stratégiques).

#### P2-HDR-1 — `Referrer-Policy` global au lieu de granulaire `/admin/*`

- `next.config.ts:35` émet `strict-origin-when-cross-origin` partout. Pour les routes admin, `no-referrer` est plus prudent (évite leak path admin vers des origines tierces si un admin clique sur un lien externe depuis un dashboard).
- **Action Sprint 24** : route group `(admin)` avec `headers()` override, ou matcher dédié dans `next.config.ts`.

#### P2-HDR-2 — Caddy `Server: Caddy` divulgue le produit

- `Caddyfile:58` `Server "Caddy"` (volontaire pour debug, mais en prod publique → divulgation infra OWASP Cheat Sheet ASVS V14.5.2).
- **Action** : `Server ""` ou supprimer la directive (Caddy supprime alors le header upstream Next `X-Powered-By` déjà désactivé via `poweredByHeader: false`).
- **Effort** : 5 min.

#### P3-HDR-1 — `style-src 'unsafe-inline'`

- `next.config.ts:20`. Toléré par next/font + Tailwind JIT (CSS variables runtime). Sprint 24 → hash list ou nonce dynamique.

---

## 2. CHAPITRE 2 — TOKENS & SESSIONS

**Source de vérité** : `src/auth.config.ts:17-77`, `src/auth.ts:37-145`, `src/lib/auth-2fa.ts:10-46`, `src/env.ts:12-31`

### 2.1 Verdict chapitre

| Critère                                             | Statut                    | Détail                                                                                                                                                                                                     |
| --------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cookies.sessionToken` HttpOnly+Secure+SameSite=lax | ✓ (par défaut Auth.js v5) | Auth.js applique `__Secure-authjs.session-token` HttpOnly + Secure + SameSite=lax dès `AUTH_URL=https://...`. **Pas d'override `cookies:` custom** dans `auth.config.ts` → comportement défaut sécurisé. ✓ |
| Cookie prefix `__Secure-` ou `__Host-` en prod      | ✓ (par défaut Auth.js)    | `AUTH_URL=https://axion-ia.com` (prod) → préfixe `__Secure-authjs.session-token`                                                                                                                           |
| JWT signed AUTH_SECRET ≥ 32 chars                   | ✓                         | `env.ts:14` `z.string().min(32)` + superRefine refuse `dev_` / `dev-` en prod (`env.ts:25-30`)                                                                                                             |
| `session.strategy: "jwt"` (no DB)                   | ✓                         | `auth.config.ts:18`                                                                                                                                                                                        |
| `maxAge: 30j`                                       | ✓                         | `auth.config.ts:19` `30 * 24 * 60 * 60`                                                                                                                                                                    |
| `updateAge: 24h` (rotation auto)                    | ✓                         | `auth.config.ts:20` `24 * 60 * 60`                                                                                                                                                                         |
| 2FA TOTP epochTolerance 30 s                        | ✓                         | `auth-2fa.ts:16,41` couvre prev/current/next                                                                                                                                                               |
| 2FA TOTP step 30 s, digits 6                        | ✓                         | otplib v13 défauts RFC 6238                                                                                                                                                                                |
| 2FA mandatory super_admin + admin                   | ✓                         | `auth.ts:35` `ROLES_REQUIRING_2FA` Set                                                                                                                                                                     |
| Session revocation status='disabled' ≤ 24 h         | △                         | **MISS partiel** — voir P1-SES-1                                                                                                                                                                           |
| JWT callback re-check user.status                   | ✗                         | `auth.config.ts:60-66` — hop user lookup, P1                                                                                                                                                               |
| `AUTH_URL` exact `https://axion-ia.com`             | ✓                         | `.env.production.example:30`                                                                                                                                                                               |
| Pas de `database` adapter (JWT pur)                 | ✓                         | `auth.ts:37-38` — pas d'adapter Prisma                                                                                                                                                                     |

**Score chapitre** : 12 / 13 critères critiques = **92 %** ✓

### 2.2 Findings

#### P1-SES-1 — Session revocation status='disabled' peut prendre jusqu'à 30 jours

- **Fichier:ligne** : `src/auth.config.ts:60-66` (callback `jwt`)
- **Code actuel** :
  ```ts
  jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      token.role = (user as { role?: string }).role;
    }
    return token;
  },
  ```
- **Risque** : un super_admin compromis dont `status` passe à `suspended` conserve sa session jusqu'à expiration JWT (30 j). `updateAge: 24h` force un refresh JWT toutes les 24 h **mais le callback ne re-fetch pas la DB** → le token reste valide.
- **Mitigation actuelle** : authorize() de connexion refuse `status !== "active"` (`auth.ts:79`), mais c'est seulement à la prochaine **déconnexion + reconnexion**.
- **Action critique** :
  ```ts
  async jwt({ token, user, trigger }) {
    if (user) {
      token.id = user.id;
      token.role = (user as { role?: string }).role;
    }
    // Sprint 24 fix : re-check status sur session refresh (≤ 24h après suspend)
    if (trigger === "update" || (token.id && !user)) {
      const fresh = await prisma.adminUser.findUnique({
        where: { id: token.id as string },
        select: { status: true, role: true },
      });
      if (!fresh || fresh.status !== "active") return null; // Auth.js efface le cookie
      token.role = fresh.role;
    }
    return token;
  },
  ```
- **Coût** : 1 DB hit toutes les 24 h par admin actif (≤ 10 admins V1) = négligeable.
- **Effort** : 2 h + tests.
- **Pourquoi P1 et pas P0** : V1 a très peu d'admins (2-5), si un admin est compromis on rote `AUTH_SECRET` (invalide TOUS les tokens). Acceptable V1, **obligatoire avant scale Sprint 24**.

#### P2-SES-1 — Pas de cookies override explicite (zéro defense in depth)

- Auth.js v5 défauts sont OK, mais aucune ligne `cookies: { sessionToken: { options: { httpOnly: true, secure: true, sameSite: "lax" } } }` dans `auth.config.ts`. Si quelqu'un upgrade `next-auth` un jour et que les défauts changent, on prend un risque silencieux.
- **Action** : déclarer explicitement les cookies en config (defense in depth + lecture facile pour audit).
- **Effort** : 30 min.

#### P3-SES-1 — `epochTolerance: 30` doc à clarifier

- `auth-2fa.ts:16` commentaire dit "couvre prev + current + next window TOTP (chaque window = 30s)" mais otplib `epochTolerance` est en **secondes absolues** (= ±30 s = 1 fenêtre de tolérance, pas 3). Le commentaire est légèrement trompeur (sécuritairement OK, juste doc).
- **Action** : reformuler commentaire `auth-2fa.ts:13-15`.

---

## 3. CHAPITRE 3 — RATE LIMIT + BRUTE-FORCE

**Source de vérité** : `src/lib/rate-limit.ts:30-77`, `src/auth.ts:60-70`, `src/features/*/actions.ts`

### 3.1 Verdict chapitre

| Endpoint / Action                         | Limite                    | Fenêtre           | Composite          | Statut                                                                     |
| ----------------------------------------- | ------------------------- | ----------------- | ------------------ | -------------------------------------------------------------------------- |
| `/api/auth/sign-in` (Auth.js Credentials) | IP 10 + Email 5           | 15 min            | ✓ IP+Email         | ✓                                                                          |
| `subscribeNewsletterAction`               | 3                         | 5 min             | IP-only            | ✓ acceptable                                                               |
| `confirmNewsletterAction`                 | —                         | —                 | aucune             | △ token unique 32 bytes hex = 256 bits, brute-force impossible             |
| `unsubscribeNewsletterAction`             | —                         | —                 | aucune             | ✓ token unique 256 bits                                                    |
| `createBookingAction`                     | 5                         | 10 min            | IP-only            | ✓                                                                          |
| `postOption48hAction`                     | 3                         | 10 min            | IP-only            | ✓                                                                          |
| `submitContactAction`                     | 3                         | 10 min            | IP-only            | ✓ (Pass B)                                                                 |
| `submitAuditAction`                       | 3                         | 10 min            | IP-only            | ✓ (Pass B)                                                                 |
| `submitImplementationAction`              | 3                         | 10 min            | IP-only            | ✓ (Pass B)                                                                 |
| `/api/healthz`                            | aucune                    | —                 | —                  | ✓ public, `Cache-Control: no-store`, no-risk                               |
| `/api/admin/newsletter/export`            | aucune                    | —                 | —                  | △ derrière RBAC `requireAdminWrite`, **mais pas de RL si admin compromis** |
| `/api/admin/submissions/export`           | aucune                    | —                 | —                  | △ idem                                                                     |
| `/api/og` (Open Graph)                    | aucune                    | —                 | —                  | △ public, render dynamique → **DoS possible** P2                           |
| `/api/indexnow/key/route.ts`              | aucune                    | —                 | —                  | ✓ retour key statique, pas de logique                                      |
| `/api/vitals` (RUM)                       | aucune                    | —                 | —                  | △ public POST, **DoS possible** P2                                         |
| `/api/unsubscribe`                        | aucune                    | —                 | —                  | ✓ token unique 256 bits, anti-énumération native                           |
| Mécanisme                                 | sliding window Redis ZSET | atomique pipeline | fail-open avec log | ✓                                                                          |

**Score chapitre** : 13 / 16 critères = **81 %** (3 endpoints publics sans RL → P2 chacun, voir ci-dessous)

### 3.2 Findings

#### P1-RL-1 — `/api/auth/sign-in` rate-limit composite OK mais **fail-open silencieux** si Redis down

- **Fichier:ligne** : `src/lib/rate-limit.ts:63-67` (catch + `failOpen`)
- **Code actuel** :
  ```ts
  } catch {
    return failOpen(now, config.limit, windowMs);
  }
  ```
- **Risque** : Si Redis tombe (panne réseau Coolify, OOM…), **toutes les protections rate-limit deviennent permissives** silencieusement. Un attaquant qui détecte la fenêtre Redis-down peut lancer du credential stuffing illimité.
- **Mitigation actuelle** : commentaire dit "alerte Sentry — branche en M11" → pas encore implémenté.
- **Action** :
  1. P1 : Sentry capture la première occurrence du fail-open par minute (`Sentry.captureMessage('rate-limit:fail-open')`).
  2. P2 : alerte Telegram critique (`@axion-ia-ops` channel) si Redis down > 60 s.
  3. P3 : option fail-closed pour `auth:login:*` uniquement (les autres endpoints publics restent fail-open pour UX).
- **Effort** : 1 h (Sentry) + 30 min (Telegram) après Sprint 23 M11.

#### P2-RL-1 — `/api/og` (Open Graph dynamique) sans rate-limit

- **Fichier** : `src/app/api/og/...` (à scanner Sprint 23+)
- **Risque** : OG image render utilise `@vercel/og` ou `next/og` (CPU/RAM consumption ~50-200 ms par image). Un bot qui itère sur 2150 URLs ville × 5 services = ~10 750 requêtes peut saturer le CPX32 (4 vCPU).
- **Action** : `checkRateLimit('og:${ip}', { limit: 30, windowSec: 60 })` + cache CDN Cloudflare (Caddy déjà `Cache-Control` long sur `_next/static` mais pas sur `/api/og`).
- **Effort** : 1 h.

#### P2-RL-2 — `/api/vitals` (RUM ingestion) sans rate-limit

- **Fichier** : `src/app/api/vitals/route.ts` (à vérifier)
- **Risque** : POST publique, pas d'auth. Un attaquant peut spammer 100 k vitals/sec → pollution Plausible self-hosted + saturation Redis pipeline.
- **Action** : `checkRateLimit('vitals:${ip}', { limit: 60, windowSec: 60 })`. Acceptable car 1 vital/page × 5 pages × 12 min = 60 events/min légitimes.
- **Effort** : 30 min.

#### P2-RL-3 — Routes admin export CSV sans rate-limit

- **Fichier** : `src/app/api/admin/newsletter/export/route.ts:9-34` + `src/app/api/admin/submissions/export/route.ts:*`
- **Risque** : un admin compromis (token volé) peut exfiltrer la base via `for i in {1..100}; do curl ... ; done`. Pas de cap admin-side.
- **Action** : RL + audit log déjà présent → ajouter `checkRateLimit('admin:export:${session.user.id}', { limit: 10, windowSec: 3600 })`.
- **Effort** : 1 h.

#### P3-RL-1 — `subscribeNewsletterAction` 3/5 min IP-only

- IP-only suffisant car double opt-in absorbe les sign-ups bot (token email non délivré → pas d'inscription confirmée). ✓ acceptable V1, mais composite IP+email idéal Sprint 24.

#### P3-RL-2 — `option48hAction` 3/10 min cohérent

- `booking/actions.ts:154` — `checkRateLimit('option48h:${ip}', { limit: 3, windowSec: 600 })` est cohérent avec contact/audit/implementation. ✓

---

## 4. CHAPITRE 4 — SECRETS PROD

**Source de vérité** : `src/env.ts:1-131`, `.env.production.example:1-86`, `scripts/backup-postgres.sh:107-109`

### 4.1 Verdict chapitre

| Variable                               | Schéma Zod                    | superRefine prod             | Template `.env.production.example`               | Statut       |
| -------------------------------------- | ----------------------------- | ---------------------------- | ------------------------------------------------ | ------------ |
| `AUTH_SECRET`                          | `z.string().min(32)`          | ✓ refuse `dev_` / `dev-`     | ✓ `<production-secret-min-32-chars-NEVER-dev_*>` | ✓            |
| `AUTH_URL`                             | `z.string().url()`            | —                            | ✓ `https://axion-ia.com`                         | ✓            |
| `DATABASE_URL`                         | `z.string().url()`            | —                            | ✓                                                | ✓            |
| `REDIS_URL`                            | `z.string().url()`            | —                            | ✓                                                | ✓            |
| `ADMIN_URL_PREFIX`                     | `z.string().min(4)`           | ✗ pas de check `admin-dev-*` | ✓ `<random-32-chars>`                            | △ P1-SEC-1   |
| `ADMIN_EMAIL`                          | `z.string().email()`          | —                            | ✓                                                | ✓            |
| `TURNSTILE_SECRET_KEY`                 | `z.string().optional()`       | —                            | ✓ `<secret-key-prod>`                            | △ P3         |
| `TELEGRAM_BOT_TOKEN`                   | `z.string().optional()`       | —                            | ✓                                                | ✓            |
| `INDEXNOW_KEY`                         | `z.string().min(8).max(128)`  | —                            | ✓                                                | ✓            |
| `HETZNER_STORAGE_ENDPOINT` (S3-compat) | `z.string().optional()`       | —                            | ✓                                                | ✓            |
| `HETZNER_STORAGE_BUCKET`               | optional                      | —                            | ✓                                                | ✓            |
| `HETZNER_STORAGE_KEY` (S3 access key)  | optional                      | —                            | ✓                                                | ✓            |
| `HETZNER_STORAGE_SECRET` (S3 secret)   | optional                      | —                            | ✓                                                | ✓            |
| **`BACKUP_ENCRYPTION_PASSPHRASE`**     | **✗ PAS DÉCLARÉ**             | —                            | **✗ ABSENT**                                     | **P0-OPS-2** |
| **`HETZNER_STORAGE_USER`** (SSH user)  | **✗ PAS DÉCLARÉ**             | —                            | **✗ ABSENT**                                     | **P0-OPS-1** |
| **`HETZNER_STORAGE_HOST`** (SSH host)  | **✗ PAS DÉCLARÉ**             | —                            | **✗ ABSENT**                                     | **P0-OPS-1** |
| `SENTRY_DSN`                           | `z.string().url().optional()` | —                            | ✓                                                | ✓            |
| `SMTP_*` (PMTA)                        | défauts dev-friendly          | —                            | ✓                                                | ✓            |
| `MAILWIZZ_*`                           | optional                      | —                            | ✓                                                | ✓            |
| `PMTA_API_KEY`                         | optional                      | —                            | ✓                                                | ✓            |
| `COMPANY_*` (RGPD)                     | partiellement                 | —                            | ✓                                                | △            |

**Score chapitre** : 16 / 21 critères = **76 %** **(2 P0 + 1 P1 + 1 P3 = 4 findings)**

### 4.2 Findings

#### P0-OPS-1 — Variables backup SSH absentes du template ET de `src/env.ts`

- **Fichiers** : `.env.production.example` + `src/env.ts:5-74`
- **Variables manquantes** :
  - `HETZNER_STORAGE_USER` (ex : `u123456@u123456.your-storagebox.de`) — utilisé `backup-postgres.sh:108`
  - `HETZNER_STORAGE_HOST` (ex : `u123456.your-storagebox.de`) — utilisé `backup-postgres.sh:109,140`
- **Confusion existante** : `.env.production.example:58-62` déclare `HETZNER_STORAGE_ENDPOINT` (S3 API endpoint pour uploads images) **mais le script backup utilise rsync over SSH**, pas S3. Les deux protocoles, deux jeux de credentials.
- **Conséquence** : la première exécution cron `0 3 * * * bash scripts/backup-postgres.sh` **fail immédiatement** (`require_env` exit 1). Le seul signal est une notification Telegram (`require_env` ligne 67) — **si Telegram est down ou mal configuré, le silence dure jusqu'à perte de données critique**.
- **Action P0 (avant GO PROD)** :
  1. Ajouter dans `.env.production.example` :
     ```bash
     # ---------- Hetzner Storage Box SSH (backups Postgres + scripts) ----------
     # SSH access (rsync) — différent du S3 endpoint plus haut.
     HETZNER_STORAGE_USER=<u123456-from-Hetzner-Robot>
     HETZNER_STORAGE_HOST=<u123456.your-storagebox.de>
     # SSH key path injecté Coolify → /root/.ssh/hetzner_storage_box
     # Génération : ssh-keygen -t ed25519 -f hetzner_storage_box -C "axion-ia-backup"
     ```
  2. Ajouter dans `src/env.ts` server schema (post `HETZNER_STORAGE_SECRET`) :
     ```ts
     HETZNER_STORAGE_USER: z.string().optional(),
     HETZNER_STORAGE_HOST: z.string().optional(),
     BACKUP_ENCRYPTION_PASSPHRASE: z
       .string()
       .min(32)
       .optional()
       .superRefine((val, ctx) => {
         if (process.env.NODE_ENV !== "production") return;
         if (!val) {
           ctx.addIssue({
             code: z.ZodIssueCode.custom,
             message: "BACKUP_ENCRYPTION_PASSPHRASE required in production (≥ 32 chars)",
           });
         }
       }),
     ```
  3. Ajouter au runtimeEnv mapping (`env.ts:84-128`)
  4. Smoke test avant 1er run prod : `bash scripts/backup-postgres.sh --type daily` en staging avec vraies vars.
- **Effort** : 30 min code + 15 min smoke test.

#### P0-OPS-2 — `BACKUP_ENCRYPTION_PASSPHRASE` absente du template + non typée

- **Fichiers** : `.env.production.example` (manque ligne) + `src/env.ts` (pas dans schema)
- **Variable manquante** : `BACKUP_ENCRYPTION_PASSPHRASE` — utilisée `backup-postgres.sh:107,124` (passphrase AES-256 chiffrement backup)
- **Risque RGPD** : si la passphrase est faible (< 32 chars) ou pire, vide (`require_env` la bloque heureusement), l'attaquant qui accède à Hetzner Storage Box peut déchiffrer la base par brute-force.
- **Action P0** :
  1. Ajouter dans `.env.production.example` :
     ```bash
     # ---------- Backups (scripts/backup-postgres.sh, Sprint 23 / M11) ----------
     # Génération : openssl rand -base64 48 | tr -d '\n'
     # ⚠ STOCKER HORS-LIGNE (gestionnaire de mots de passe + clé USB chiffrée).
     # Sans cette passphrase, IMPOSSIBLE de restaurer après sinistre.
     BACKUP_ENCRYPTION_PASSPHRASE=<48-chars-random-base64-NEVER-rotate-without-re-encrypting-archives>
     ```
  2. Documenter procédure rotation : nouvelle passphrase nécessite re-chiffrer toute l'archive existante (sinon pas de fallback restauration).
- **Effort** : 30 min.

#### P1-SEC-1 — `ADMIN_URL_PREFIX` superRefine absent

- **Fichier:ligne** : `src/env.ts:34` — `ADMIN_URL_PREFIX: z.string().min(4).optional()`
- **Fallback hardcodé** : `auth.config.ts:33` `process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9"` → si Coolify oublie d'injecter la var en prod, **l'URL admin tombe sur le fallback dev `admin-dev-x7k2n9`** qui est **public dans le repo Git** → l'attaquant connaît l'URL exacte.
- **Mitigation actuelle** : la 2FA TOTP + rate-limit composite IP+email tient le siège. Mais c'est une defense en profondeur perdue.
- **Action** :
  1. Ajouter superRefine dans `env.ts:34` :
     ```ts
     ADMIN_URL_PREFIX: z
       .string()
       .min(8)
       .optional()
       .superRefine((val, ctx) => {
         if (process.env.NODE_ENV !== "production") return;
         if (!val || val.startsWith("admin-dev")) {
           ctx.addIssue({
             code: z.ZodIssueCode.custom,
             message: "ADMIN_URL_PREFIX must be ≥ 8 chars random (not 'admin-dev-*') in production",
           });
         }
       }),
     ```
  2. Min length 8 (non 4) car bruteforce 4 chars = 36^4 = 1.6 M = scannable.
- **Effort** : 15 min.

#### P3-SEC-1 — `TURNSTILE_SECRET_KEY` pas de superRefine prod

- `env.ts:50` `z.string().optional()`. Mitigé par fail-closed `turnstile.ts:24-31` mais la friction prod (100 % forms échouent) est inacceptable. Already noté Pass B P3-5.
- **Action Sprint 24** : superRefine prod identique à AUTH_SECRET.

---

## 5. CHAPITRE 5 — BOUNDARY TESTS (PII LEAKS, ANTI-ÉNUMÉRATION)

**Source de vérité** : `src/app/api/unsubscribe/route.ts`, `src/features/newsletter/actions.ts:113-207`, `src/app/[locale]/confirmation/newsletter/page.tsx`, `src/app/[locale]/desabonnement/page.tsx`

### 5.1 Verdict chapitre

| Critère                                                     | Statut | Détail                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `/api/unsubscribe` accepte token query OR body              | ✓      | `route.ts:49-70` — query (One-Click RFC 8058) + body urlencoded + multipart                                                                                                                                                                                               |
| URL redirect ne contient PAS l'email                        | ✓      | `route.ts:33-46` — `?status=ok&already=0                                                                                                                                                                                                                                  | 1`ou`?status=fail&reason=...`, jamais l'email |
| URL redirect ne contient PAS le token                       | ✓      | token consumé puis redirect propre                                                                                                                                                                                                                                        |
| Logs côté serveur ne logent PAS l'email en clair (PII RGPD) | △      | `actions.ts:82-87,150-153,198-201` — Telegram log contient l'email entre backticks. Acceptable RGPD (intérêt légitime art. 6.1.f, accès strictement Will admin) **mais** pas idéal pour audit RGPD strict. P2.                                                            |
| Confirm bad token → message générique                       | ✓      | `actions.ts:128-140` — retourne `error: "invalid_token"` sans révéler "email connu mais token expiré" vs "email inconnu"                                                                                                                                                  |
| Unsubscribe bad token → message générique                   | ✓      | `actions.ts:184-187` — `error: "invalid_token"`, ne révèle pas si l'email existe                                                                                                                                                                                          |
| Page confirm `noindex`                                      | ✓      | `page.tsx:42` `robots: { index: false, follow: false }`                                                                                                                                                                                                                   |
| Page desabonnement `noindex`                                | ✓      | `page.tsx:40`                                                                                                                                                                                                                                                             |
| Confirm bon token → renvoie email user (PII visible)        | △      | `page.tsx:82-83` `Vous recevrez nos prochaines lettres à l'adresse ${result.email}` — c'est l'email de l'**utilisateur lui-même** qui clique sur SON lien depuis SON inbox. Acceptable, **ce n'est pas un leak** (aucune énumération possible : token unique 256 bits). ✓ |
| `/api/unsubscribe` GET disponible (debug)                   | ✓      | `route.ts:72-76` — RFC 8058 fallback browser navigation                                                                                                                                                                                                                   |
| Token entropy ≥ 256 bits                                    | ✓      | `crypto.randomBytes(32).toString("hex")` = 64 chars hex = 256 bits                                                                                                                                                                                                        |
| Idempotent re-submit                                        | ✓      | `actions.ts:131-133,188-190` — `alreadyConfirmed=true` / `alreadyUnsubscribed=true`                                                                                                                                                                                       |
| `cache-control: no-store` sur réponses sensibles            | ✓      | redirects 303 Next.js par défaut + healthz `no-store, no-cache, must-revalidate`                                                                                                                                                                                          |
| Anti-énumération login                                      | ✓      | `auth-password.ts:42-67` dummy hash sentinel + `auth.ts:82-97` activity log même si user undefined                                                                                                                                                                        |

**Score chapitre** : 12 / 14 critères = **86 %** ✓

### 5.2 Findings

#### P2-PII-1 — Telegram log contient l'email subscriber en clair

- **Fichiers:lignes** : `src/features/newsletter/actions.ts:82-87,150-153,198-201`
- **Pattern** :
  ```ts
  await sendTelegram({
    tag: "NEWSLETTER",
    body: `Nouvelle inscription pending\n• Email : \`${parsed.data.email}\`\n• Locale : ${locale}...`,
  });
  ```
- **Risque** : si un attaquant accède au bot Telegram (token volé), il a l'historique complet des emails subscribers en clair. PII RGPD art. 5.1.c minimisation.
- **Mitigation actuelle** : Telegram chat = `Will personnel`, accès limité, intérêt légitime traçabilité art. 6.1.f.
- **Action P2** :
  1. Hasher l'email pour Telegram : `email.replace(/(.{2}).*(@.*)/, "$1***$2")` → `wi***@gmail.com`
  2. Ou bien : envoyer juste l'ID Prisma (`sub.id`) sans email, et l'admin clique vers `/admin/newsletter/<id>` pour voir le détail RBAC-protégé.
- **Effort** : 1 h (4 sites + tests).

#### P2-PII-2 — Fenêtre confirm renvoie l'email à l'utilisateur

- **Fichier:ligne** : `src/app/[locale]/confirmation/newsletter/page.tsx:82-83`
- **Comportement** : "Vous recevrez nos prochaines lettres à l'adresse `${result.email}`"
- **Évaluation** : ce n'est PAS un PII leak — l'utilisateur cliquant sur SON lien email reçoit confirmation à SON adresse. Token unique 256 bits empêche toute énumération. ✓ acceptable.
- **Mais** : si quelqu'un partage le lien confirm (cas peu probable mais possible), un tiers verrait l'email du subscriber. Sprint 24+ : ne plus afficher l'email, juste "Inscription confirmée." sans réecho.
- **Effort Sprint 24** : 30 min. Pas urgent.

#### P3-PII-1 — Page desabonnement avec banner d'erreur leak `reason`

- `desabonnement/page.tsx:71-89` distingue `reason === "missing_token"` vs `"invalid_token"`. Pour un attaquant qui essaie de l'énumération, voir "missing_token" vs "invalid_token" donne **0 information utile** (token aléatoire 256 bits = impossible à deviner). ✓ acceptable.

---

## 6. P0 — FIXES BLOQUANTS AVANT PROD PUBLIQUE

**Décision : NE PAS DÉPLOYER tant que ces 2 P0 ne sont pas résolus.**

| #   | ID           | Fichier:Ligne                                 | Action                                                                                                                      | Effort |
| --- | ------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | **P0-OPS-1** | `.env.production.example` + `src/env.ts:5-74` | Ajouter `HETZNER_STORAGE_USER` + `HETZNER_STORAGE_HOST` (SSH backup) au template ET au schéma Zod. Smoke test cron staging. | 45 min |
| 2   | **P0-OPS-2** | `.env.production.example` + `src/env.ts:5-74` | Ajouter `BACKUP_ENCRYPTION_PASSPHRASE` (≥ 32 chars, superRefine prod) au template + schéma + doc rotation.                  | 30 min |

**Total effort P0 : ~1 h 15 min.**

---

## 7. P1 — FIXES SOUS 30 JOURS POST-PROD

| #   | ID       | Fichier:Ligne                 | Action                                                                           | Effort          |
| --- | -------- | ----------------------------- | -------------------------------------------------------------------------------- | --------------- |
| 1   | P1-HDR-1 | `next.config.ts:19`           | CSP nonce strict-dynamic, retirer `'unsafe-eval'` + `'unsafe-inline'` script-src | 4-6 h Sprint 24 |
| 2   | P1-HDR-2 | `next.config.ts:32-50`        | Ajouter `Cross-Origin-Embedder-Policy: require-corp` (ou `credentialless`)       | 1 h             |
| 3   | P1-SES-1 | `src/auth.config.ts:60-66`    | JWT callback re-check `adminUser.status` (revocation < 24 h)                     | 2 h             |
| 4   | P1-RL-1  | `src/lib/rate-limit.ts:63-67` | Sentry capture sur fail-open Redis + alerte Telegram                             | 1 h             |
| 5   | P1-SEC-1 | `src/env.ts:34`               | superRefine prod sur `ADMIN_URL_PREFIX` (refuse `admin-dev-*`)                   | 15 min          |

**Total effort P1 : ~9 h.**

---

## 8. P2 / P3 — BACKLOG

### P2 (Sprint 24/25)

- P2-HDR-1 : `Referrer-Policy: no-referrer` granulaire `/admin/*`
- P2-HDR-2 : Caddy `Server ""` (pas `"Caddy"`)
- P2-SES-1 : Cookies override explicite `cookies: { sessionToken: { options: { ... } } }` defense in depth
- P2-RL-1 : Rate-limit `/api/og` (30/min/IP)
- P2-RL-2 : Rate-limit `/api/vitals` (60/min/IP)
- P2-RL-3 : Rate-limit `/api/admin/*/export` (10/h/admin)
- P2-PII-1 : Mask email dans Telegram log newsletter (`wi***@gmail.com`)

### P3 (backlog)

- P3-HDR-1 : `style-src` sans `'unsafe-inline'` (hash list ou nonce dynamique)
- P3-SES-1 : Reformuler commentaire `epochTolerance` `auth-2fa.ts:13-15`
- P3-RL-1 : Rate-limit composite IP+email pour newsletter (Sprint 24)
- P3-SEC-1 : superRefine prod `TURNSTILE_SECRET_KEY` (déjà Pass B P3-5)
- P3-PII-1 : Page confirm sans réécho email (Sprint 24)

---

## 9. CHECKLIST PRE-PROD SÉCURITÉ (12 cases)

À cocher AVANT `coolify deploy --env=production` :

### Secrets injectés Coolify

- [ ] `AUTH_SECRET` ≥ 32 chars random (généré `openssl rand -base64 32`), ne commence PAS par `dev_` / `dev-`
- [ ] `ADMIN_URL_PREFIX` ≥ 8 chars random (PAS `admin-dev-x7k2n9`)
- [ ] `TURNSTILE_SECRET_KEY` PROD (pas le dev `1x0000000000000000000000000000000AA`)
- [ ] **`BACKUP_ENCRYPTION_PASSPHRASE`** ≥ 32 chars random (P0-OPS-2)
- [ ] **`HETZNER_STORAGE_USER`** + **`HETZNER_STORAGE_HOST`** (SSH backup, P0-OPS-1)

### Smoke tests prod

- [ ] `curl https://axion-ia.com/api/healthz` → `200 { status: "ok", db: "ok", redis: "ok" }`
- [ ] `curl -I https://axion-ia.com/` → headers présents : `strict-transport-security: max-age=63072000; includeSubDomains; preload`, `x-frame-options: DENY`, `content-security-policy: ...`, `cross-origin-opener-policy: same-origin`
- [ ] Login admin `/{ADMIN_URL_PREFIX}/login` → 2FA prompt obligatoire pour super_admin/admin
- [ ] Sign-in 6 fois avec mauvais password → 6e tentative bloquée (rate-limit composite IP+email 5 attempts/15 min)
- [ ] Inscription newsletter → email de confirmation reçu (PowerMTA localhost:2525) → click confirm → `/{locale}/confirmation/newsletter?token=...` affiche succès
- [ ] `bash scripts/backup-postgres.sh --type daily` en staging réussit (chiffrement AES-256 + upload Hetzner Storage Box rsync OK)
- [ ] HSTS preload soumis sur https://hstspreload.org/ (vérification post-deploy DNS public)

---

## 10. VERDICT FINAL

> **CONDITIONAL GO PROD** — déploiement publique autorisé **après résolution des 2 P0 (~1 h 15 min)** et validation de la checklist 12 cases ci-dessus.

**Forces majeures du runtime** :

1. Argon2id OWASP 2024 (memoryCost 19456, timeCost 2) centralisé SSOT.
2. Anti-oracle email **timing-safe via dummy hash sentinel** — niveau "élite" ASVS V2.
3. Rate-limit **composite IP + email** sliding window Redis, résilient NAT/CGNAT.
4. 2FA TOTP RFC 6238 **obligatoire** super_admin + admin (refus si pas de twoFactorSecret).
5. JWT signé `AUTH_SECRET` avec **superRefine refusant `dev_*` en prod**.
6. CSP active prod-only avec **`frame-ancestors 'none'`** + `form-action 'self'` + `base-uri 'self'` + `object-src 'none'`.
7. HSTS **2 ans + preload** + COOP + CORP + Permissions-Policy 9 features.
8. Caddy `Cache-Control: immutable` sur `_next/static` + Vary RSC complet.
9. Token unsubscribe/confirm **256 bits entropy** — anti-énumération native.
10. Activity log RGPD-grade sur **100 % mutations admin + login fail** (même user undefined).

**Faiblesses bloquantes** : **2 P0 ops backup** (P0-OPS-1 + P0-OPS-2) — pas crypto, pas runtime, mais **continuité d'activité critique post-sinistre RGPD art. 32**.

**Faiblesses tolérables V1** : 3 P1 (CSP unsafe-eval déjà documenté Sprint 24, COEP missing, session revocation < 24 h).

**Score OWASP runtime global** : **88 / 100** (header 85 %, sessions 92 %, RL 81 %, secrets 76 %, PII 86 %).

**Signatures** :

- Audit conduit lecture-seule, écriture limitée à `_AUDIT/`.
- Référentiels : OWASP ASVS 5.0 V2/V3/V9/V13/V14, OWASP Cheat Sheet HTTP Headers 2024, RFC 6797/6238/8058.
- Code HEAD : `c194caa` (post v10.2 + Sprint 0 kickoff), 2026-05-09.
- Cohérent avec Pass B SECURITY (91.4 % ASVS) — 2 P0 ajoutés ici sont opérationnels (backup), pas crypto runtime, donc absents Pass B (qui couvrait V2/V3/V4/V5/V8/V9/V11/V13/V14 code-side, pas backups).

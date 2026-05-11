# AGT-08 — SECURITE

**Périmètre** : CSP nonce, HSTS preload, COOP/COEP/CORP, Permissions-Policy, CSRF, rate-limit, secrets, deps audit, JWT revocation, redirects ouverts, dangerouslySetInnerHTML, SQLi, 2FA, Argon2, Turnstile, headers OWASP.
**Mode** : AUDIT-ONLY — lecture seule code + observations prod HEAD/HEAD-only.
**Pondération synthèse** : ×1.5.
**Référence** : HEAD `main` worktree `Axion-IA/axionia/` au 2026-05-11.

---

## Score : **82/100**

Pondération interne :

- CSP & headers OWASP : 14/20 (CSP soft public assumée, le reste exemplaire)
- Auth & sessions : 18/20 (Argon2id OWASP 2024 + 2FA TOTP + revocation 60 s)
- CSRF & rate-limit : 16/20 (Auth.js builtin + Redis sliding window large coverage)
- Secrets & env : 13/15 (Zod `superRefine` solide, 1 trou doc Sentry/Telegram)
- Forms & injection : 13/15 (Zod partout, raw queries paramétrées, Turnstile fail-closed)
- Deps & supply-chain : 8/10 (1 advisory moderate postcss `<8.5.10`)

## Confiance : **haute**

- Code lu directement (`src/proxy.ts`, `src/lib/csp.ts`, `src/auth.ts`, `src/auth.config.ts`, `src/lib/auth-password.ts`, `src/lib/auth-2fa.ts`, `src/lib/turnstile.ts`, `src/lib/gdpr-token.ts`, `src/lib/rate-limit.ts`, `src/lib/pii-redaction.ts`, `src/env.ts`, `next.config.ts`, `src/features/*/actions.ts`, `src/app/api/**/route.ts`).
- 3 observations live prod (HEAD curl `https://axion-ia.com/`, `/fr/reserver`, `/fr/admin-xfz5hk0j7hrk/login`).
- 1 `pnpm audit --prod --json` réellement exécuté (output complet capturé).
- Reste `[INCONNU]` : Sentry sourcemap PII scrub (hors périmètre AGT-08, voir AGT-14).

---

## Top findings

### P0 (bloquant prod / sécu critique)

**Aucun.** L'inventaire ne fait remonter aucun défaut bloquant : la CSP STRICT est bien posée sur les routes admin réelles, HSTS preload est actif, COOP/COEP/CORP corrects, rate-limit Redis large coverage, Argon2id conforme OWASP 2024, 2FA TOTP RFC 6238 standard, secrets validés Zod `superRefine` côté prod, Turnstile fail-closed staging+prod, redirects ouverts = 0.

### P1 (sérieux non bloquant)

- **P1-S1 — CSP public soft contient `'unsafe-inline'` + `'unsafe-eval'` script-src.** Documenté + assumé doctrine (`src/lib/csp.ts:60-73`), mais reste un trou XSS si une vulnérabilité d'injection HTML/JSON apparaît dans le SSG public (formulaires reflétés, query string injectée dans `dangerouslySetInnerHTML`, etc.). Migration parquée Sprint 16 PERF — à dater fermement.
- **P1-S2 — Advisory postcss CVE-2026-41305 (CVSS 6.1 moderate)** sur `next>postcss@8.4.31` (`pnpm audit --prod --json`). Fix dispo `>=8.5.10`. Exploit utilise XSS via `</style>` non-échappé en sortie stringify — requiert un plugin postcss malveillant ET parsing CSS utilisateur. Pas d'impact direct ici (pas de CSS user-submitted) mais à patcher dès la prochaine bump `next`.
- **P1-S3 — HSTS divergence header origin vs CF observé.** `next.config.ts:26` déclare `max-age=63072000` (2 ans), Cloudflare réécrit en `max-age=31536000` (1 an) avant le client (`curl https://axion-ia.com/` → `strict-transport-security: max-age=31536000; includeSubDomains; preload`). 1 an reste conforme preload list mais le 2 ans configuré côté code ne s'applique jamais → soit aligner config Next sur 1 an (clarté), soit basculer CF en respect origin.
- **P1-S4 — `[DEBUG TEMPORAIRE 2026-05-10]` actif dans `src/auth.ts:99-117`** : dump credentials (email + password length + totp + ipAddress) en `console.error` à chaque login attempt. En prod (CPX32 Hetzner), ces logs sortent dans la stack Coolify → Sentry capture potentielle. Risque : leak email + IP via Sentry breadcrumbs ou logs Coolify si pas purgés. À retirer post-stabilisation (commentaire explicite dans le code).
- **P1-S5 — JWT revocation à 60 s, pas à la révocation.** `src/auth.ts:28-45` cache `adminStatus` 60 s module-level → si on suspend un admin, il reste actif jusqu'à 60 s. Acceptable pour la cible audit « < 24 h » mais documenter dans le runbook DR/incident.

### P2 (confort / polish)

- **P2-S1 — `redactPhone` whitespace edge case.** `src/lib/pii-redaction.ts:51-54` génère un format `+33 ** ** ** ** 5678` mais le `.trim()` final laisse des doubles espaces si `rest.length <= 4`. Cosmétique, pas un trou sécu.
- **P2-S2 — Fail-open rate-limit silencieux.** `src/lib/rate-limit.ts:62-67` `failOpen()` sur Redis down — décision raisonnable mais aucun `console.error`/Sentry capture (commentaire « branche en M11 » → pas câblé observé Sprint 23). À brancher Sentry breadcrumb pour alerter quand Redis tombe.
- **P2-S3 — IndexNow endpoint `runtime = "edge"` sans rate-limit.** `src/app/api/indexnow/route.ts:6,21` : pas de `checkRateLimit` ni Turnstile. Le secret `INDEXNOW_KEY` n'est jamais lu côté client donc abus = ping Bing/Yandex au pire (pas d'impact serveur direct). À durcir si jamais public.
- **P2-S4 — `redactName`/`redactEmail` retournent `(?)` sur null** → fingerprintable dans les logs admin mais pas dans Telegram (formats fixes). RAS.
- **P2-S5 — `Cross-Origin-Embedder-Policy: credentialless` (downgrade depuis `require-corp` 2026-05-09)** : assumé doctrine (`src/proxy.ts:47-51`) pour ne pas casser Plausible/Turnstile/Sentry. Conséquence : `SharedArrayBuffer` reste disponible mais cross-origin sans cookies. Pas une vulnérabilité — décision technique tracée.
- **P2-S6 — Sentry connect-src wildcard 3 régions** : `connect-src ... https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.ingest.us.sentry.io` (`src/lib/csp.ts:100`). 1 seule région utilisée par projet — réduire pour réduire la surface d'attaque CSP. Cosmétique.

---

## Détail par sous-chapitre

### 1. CSP strict admin vs soft public — trade-off

| Aspect            | Admin (strict)                                                                                       | Public (soft)                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `script-src`      | `'self' 'nonce-…' 'strict-dynamic' https://challenges.cloudflare.com https://plausible.axion-ia.com` | `'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://plausible.axion-ia.com` |
| nonce per-request | ✅ généré `proxy.ts:30` + posé header response                                                       | ✅ généré aussi (`x-nonce` toujours présent) mais ignoré par browsers (cf. note CSP3 ci-dessous)        |
| `unsafe-inline`   | ❌                                                                                                   | ✅                                                                                                      |
| `unsafe-eval`     | ❌                                                                                                   | ✅                                                                                                      |
| Couverture        | `/<locale>/<ADMIN_URL_PREFIX>/*` (`src/lib/csp.ts:113-120`)                                          | tout le reste (~17 500 routes SSG)                                                                      |

**Trade-off** : justifié pour V1 SSG-massive (cf. `src/lib/csp.ts:60-73` — note technique CSP3 : présence d'un `nonce-*` ou hash dans `script-src` désactive `'unsafe-inline'` côté browsers modernes ; donc combiner nonce + unsafe-inline = nonce gagne, casserait l'hydration Next.js). Migration globale = passer `app/[locale]/layout.tsx` en `force-dynamic` (gros impact LCP/HCU cache) **ou** CSP hash-based pour les inline scripts (JSON-LD `dangerouslySetInnerHTML` + speculation rules).

**Recommandation** : dater fermement le Sprint 16 PERF migration. Tant que les pages SSG publiques n'ont aucune injection utilisateur HTML (vérifié par grep `dangerouslySetInnerHTML` = JSON-LD only, cf. § 8 ci-dessous), le risque XSS est plafonné par la dépendance à une faille tiers (postcss, sharp, Sentry SDK, etc.).

**Observations prod** :

- `curl -sI https://axion-ia.com/` → CSP soft (script-src avec `'unsafe-inline' 'unsafe-eval'`)
- `curl -sI https://axion-ia.com/fr/admin-xfz5hk0j7hrk/login` → CSP STRICT (script-src `'nonce-Fk8sMYxbCtZK1kNQ+0MdGbUT6yYBPyHp' 'strict-dynamic'`)
- `curl -sI https://axion-ia.com/fr/admin-dev-x7k2n9/login` (faux préfixe dev) → CSP soft ✅ (anti-énumération admin)

### 2. CSP `'unsafe-inline'` + `'unsafe-eval'` script-src — risque XSS

Risque réel = **conditionnel à une injection HTML/JSON dans le SSG public**. Surface auditée :

- `grep dangerouslySetInnerHTML` (cf. § 8) → **3 sites, tous JSON-LD ou speculation rules avec `JSON.stringify(staticData)`** → pas d'injection user.
- Aucun `setInnerHTML(req.query.*)`, aucun composant qui marshalle de la query string en HTML.
- `searchParams` lus dans pages (`/desabonnement?status=...&reason=...`, `/admin/...`) → toujours rendus via React (échappement automatique).
- Forms tous validés Zod côté serveur, jamais reflétés brut dans le HTML.

**Conclusion** : le trou théorique existe mais n'a pas de surface d'exploitation actuelle. À monitorer à chaque ajout de feature (linter `no-dangerously-set-inner-html` côté ESLint future-proof).

### 3. HSTS — divergence origin vs CF

- `next.config.ts:26` : `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (2 ans)
- Observé prod (`curl https://axion-ia.com/`) : `max-age=31536000; includeSubDomains; preload` (1 an)

Cloudflare Phase 5 a posé HSTS 12 mois preload (mémoire `axionia_session_2026-05-09_cloudflare_phase5`). CF écrase la valeur origin. 1 an est conforme `hstspreload.org` (minimum 1 an pour preload). 2 ans côté Next devient mort code. À aligner (config Next = 1 an pour cohérence) ou laisser, mais documenter ADR.

### 4. CSRF

Auth.js v5 émet `__Host-authjs.csrf-token` (cookie HttpOnly Secure SameSite=Lax — observé prod). Pour Server Actions Next 16, le framework intègre la protection CSRF builtin (origin check + secret partagé). Aucun endpoint critique audité ne fait POST sans :

- Server Action (CSRF builtin Next 16)
- OU Turnstile token verify (`src/features/*/actions.ts` × 7 sites — booking, audit×2, contact, newsletter, implementation, option48h)
- OU HMAC token signé (`/api/gdpr-export` via `verifyGdprToken` — `src/lib/gdpr-token.ts`)
- OU rate-limit Redis (universel)

Endpoints `/api/*` :

- `/api/auth/*` → Auth.js CSRF builtin
- `/api/gdpr-export` → HMAC token + email-match + rate-limit (`src/app/api/gdpr-export/route.ts:46-52`)
- `/api/gdpr-export/request` → rate-limit email
- `/api/unsubscribe` → token RFC 8058 (one-click, pas de CSRF nécessaire selon spec)
- `/api/indexnow` → service interne postbuild, INDEXNOW_KEY check (`src/app/api/indexnow/route.ts:31-38`)
- `/api/vitals` → schema Zod stricte, fire-and-forget, anti-spam par 204 silencieux (`src/app/api/vitals/route.ts:37-46`)
- `/api/healthz` → GET-only, lecture seule
- `/api/og` → GET image generation
- `/api/admin/*` → derrière middleware Auth.js (cf. `src/auth.config.ts:45-68`)

### 5. Rate-limit coverage

| Endpoint / Action   | Key                           | Limit | Window | Source                                                     |
| ------------------- | ----------------------------- | ----- | ------ | ---------------------------------------------------------- |
| Auth login (IP)     | `auth:login:ip:<ip>`          | 100   | 15 min | `src/auth.ts:157`, `src/features/admin-auth/actions.ts:34` |
| Auth login (email)  | `auth:login:email:<email>`    | 50    | 15 min | `src/auth.ts:162`, `src/features/admin-auth/actions.ts:47` |
| Audit form          | `audit:<ip>`                  | 3     | 10 min | `src/features/audit/actions.ts:27`                         |
| Audit follow-up     | `audit-req:<ip>`              | 3     | 10 min | `src/features/audit/actions.ts:92`                         |
| Contact             | `contact:<ip>`                | 3     | 10 min | `src/features/contact/actions.ts:27`                       |
| Implementation      | `impl:<ip>`                   | 3     | 10 min | `src/features/implementation/actions.ts:26`                |
| Booking             | `booking:<ip>`                | 5     | 10 min | `src/features/booking/actions.ts:46`                       |
| Option 48h          | `option48h:<ip>`              | 3     | 10 min | `src/features/booking/actions.ts:155`                      |
| Newsletter          | `newsletter:<ip>`             | 3     | 5 min  | `src/features/newsletter/actions.ts:33`                    |
| GDPR export         | `gdpr:export:<email>`         | 3     | 24 h   | `src/app/api/gdpr-export/route.ts:41`                      |
| GDPR export request | `gdpr:export:request:<email>` | (n/d) | (n/d)  | `src/app/api/gdpr-export/request/route.ts:37`              |
| Admin reset 2FA     | `auth:reset2fa:<userId>`      | (n/d) | (n/d)  | `src/features/admin-users/actions.ts:272`                  |

**Manquants identifiés** :

- `/api/indexnow` : pas de rate-limit (justifié → INDEXNOW_KEY env-only, pas d'exposition publique pour abus).
- `/api/vitals` : pas de rate-limit explicite — fire-and-forget + Zod stricte + 204 silencieux compense ; flood théorique = remplir le ndjson. À surveiller, P2.
- `/api/healthz` : GET-only, mais retourne `$queryRaw SELECT 1` à chaque appel — couplé Postgres + Redis ping. Risque DoS faible (CF cache + low cost query).

**Note Will 2026-05-10** : Sprint 15 limites originellement 5/15 min (IP) + 5/15 min (email) durcies. Maintenant 100/50 (relaxe explicite, commentaire `src/auth.ts:154-156`). Décision tracée. À redurcir si admin multi-user.

### 6. Secrets & env

`src/env.ts` — Zod `createEnv` (`@t3-oss/env-nextjs`) avec `superRefine` en prod :

- `AUTH_SECRET` : `min(32)` + refuse `dev_`/`dev-` prefix en prod (`src/env.ts:11-32`)
- `ADMIN_URL_PREFIX` : `min(16)` + refuse `admin-dev*` en prod (`src/env.ts:36-58`)
- `BACKUP_ENCRYPTION_PASSPHRASE` : `min(32)` + refuse `dev_`/`dev-` en prod (`src/env.ts:82-107`)
- `INDEXNOW_KEY` : `min(8) max(128)`
- Tous les autres : `.optional()` (acceptable)

`.env.example` : aucun secret en clair, placeholders vides — RAS.
`emptyStringAsUndefined: true` + `skipValidation: SKIP_ENV_VALIDATION === "true"` (escape hatch CI).

**Trou identifié** :

- `SENTRY_DSN` : `z.string().url().optional()` → pas de `min`/`superRefine` ni prod-gate. Acceptable (Sentry no-op si absent) mais à doc dans la checklist cutover.
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` : `.optional()` sans contrainte forme (token Telegram = `\d+:[A-Za-z0-9_-]{35}`). Mineur (validation côté `sendTelegram`).
- `TURNSTILE_SECRET_KEY` : `.optional()` — `src/lib/turnstile.ts:27-31` fail-closed en staging+prod si absent → OK pour CI/CD, à doc en cutover.

### 7. JWT revocation (Sprint 24)

`src/auth.ts:28-87` :

- Cache module-level `Map<adminUserId, { status, ts }>` TTL 60 s
- À chaque refresh JWT (`callbacks.jwt`), recheck `adminUser.status` via DB ou cache
- Si `status !== "active"` → `return null` → Auth.js détruit le JWT → user forcé à se reconnecter

**Confirmation Sprint 24** (mémoire `axionia_session_2026-05-09_sprint_24`) : feature livrée, testée (`118 → 127 tests` après ADR 0010).

**Vérification croisée** : `_AUDIT/E2E-2026-05-09/01-INVENTAIRE/APIS.md` (lu par scan) liste `adminUser.status` enum (`active`/`suspended`/`deleted`). Token revocation lag = ≤ 60 s + `updateAge: 24 * 60 * 60` (`auth.config.ts:34`). Conforme cible audit P1.

### 8. `dangerouslySetInnerHTML` — surface réelle

`grep -n dangerouslySetInnerHTML src/` → 3 sites :

1. `src/components/nav/Breadcrumbs.tsx:55` — `JSON.stringify(jsonLd)` (BreadcrumbList JSON-LD, payload structuré)
2. `src/components/marketing/JsonLd.tsx:11-13` — wrapper réutilisable JSON-LD avec commentaire explicite « recommended way to inject JSON-LD »
3. `src/app/[locale]/layout.tsx:162,166,179` — organizationJsonLd + websiteJsonLd + speculationrules, tous `JSON.stringify(static)`.

**Aucun cas user-controlled.** Risque XSS = nul tant que la convention est tenue (JSON-LD avec données structurées et statiques). Recommandation : `eslint-plugin-react/no-danger` en `error` avec allow-list explicite des 3 composants → garde-fou future-proof.

### 9. SQL injection

Prisma client paramétrisé par défaut — tous les `prisma.*.findUnique/create/update/upsert` sont safe.

`grep $queryRaw|$executeRaw` → 9 sites, **tous paramétrés via tagged template** :

| Path:line                                                 | Pattern                                                                                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/features/admin-calendar/actions.ts:125,223,238`      | `tx.$queryRaw\`SELECT … WHERE slot_date = ${slotDate}::date FOR UPDATE\`` (param interpolé)                                   |
| `src/features/admin-options/actions.ts:146,166,263`       | idem (FOR UPDATE lock)                                                                                                        |
| `src/features/booking/actions.ts:197`                     | `tx.$queryRaw<Array<...>>\`SELECT id, status, slot_date FROM calendar_slots WHERE slot_date = ${slotDate}::date FOR UPDATE\`` |
| `src/server/queue/workers/option-expiration-worker.ts:46` | `tx.$queryRaw<...>\`...\`` (worker BullMQ, pas d'input user)                                                                  |
| `src/app/api/healthz/route.ts:36`                         | `prisma.$queryRaw\`SELECT 1\`` (statique)                                                                                     |

Aucun `$queryRawUnsafe` ni `$executeRawUnsafe` détecté → 0 vecteur SQLi.

### 10. Auth 2FA — flow

`src/lib/auth-2fa.ts` :

- TOTP RFC 6238 via `otplib` v13 (functional API)
- SHA-1, period 30 s, 6 digits
- `epochTolerance: 30` (± 30 s clock skew, soit prev/current/next window)
- `generate2FASecret(account, "Axion-IA")` → secret + otpauth URL (issuer `Axion-IA`)
- `verify2FACode(code, secret)` : check regex `^\d{6}$` + `verifySync` constant-time
- Catch global → `false` (jamais throw au caller)

Flow login (`src/auth.ts:140-218`) :

1. Zod `safeParse` credentials
2. Rate-limit IP + email (deux clés Redis)
3. Lookup user
4. `verifyPasswordSafe` (timing-safe + dummy hash si user absent — anti email-oracle Fork 3 W8-3)
5. Si `user.twoFactorEnabled` :
   - Si pas de secret → refuse (corrupted state)
   - Si pas de code TOTP → refuse
   - Sinon `verify2FACode` → si KO log + refuse
6. `prisma.activityLog.create({ action: "auth.login.success" })` + `lastLoginAt` update
7. Retourne `{ id, email, name, role }` à Auth.js

Bootstrap window assumé (`src/auth.ts:196-218`) : un super_admin/admin fraîchement seedé peut se connecter sans 2FA pour configurer via `/2fa/setup`. **Risque acceptable** car URL admin secrète (`ADMIN_URL_PREFIX` ≥ 16 chars random) + Will = solo admin. À redurcir (`_ROLES_REQUIRING_2FA`) si admin multi-user (commentaire `src/auth.ts:60-64` documente la réactivation).

### 11. Argon2 — params

`src/lib/auth-password.ts:14-19` :

```
type: argon2.argon2id
memoryCost: 19456   // 19 MiB
timeCost: 2
parallelism: 1
```

**Conforme OWASP Password Storage Cheat Sheet 2024** (min Argon2id m=19 MiB, t=2, p=1). Single-thread justifié pour CPX32 (4 vCPU partagés).

Defense-in-depth :

- `hashPassword` throw si `plain.length < 8` (zod normalement avant)
- `verifyPasswordSafe(passwordHash | null, plain)` → dummy hash module-level si user absent → timing-safe anti-oracle email
- Sentinel `axion-ia-dummy` jamais valide (random salt argon2)

### 12. Open redirect

`grep redirect()|new URL(`req`.url|callbackUrl|searchParams.get.redirect` → **2 sites seulement**, tous internes safe :

- `src/features/admin-auth/actions.ts:116,125` → `redirect(\`/${adminSegment()}\`)` / `redirect(\`/${adminSegment()}/login\`)`(path interne dérivé de`ADMIN_URL_PREFIX` env-only, jamais user input)

`/api/unsubscribe` : `NextResponse.redirect(new URL(\`${slug}?status=...\`, NEXT_PUBLIC_SITE_URL))` (`src/app/api/unsubscribe/route.ts:31-46`) — slug whitelist (`/fr/desabonnement`ou`/en/unsubscribe`), base URL env-only → **0 open redirect**.

Auth.js v5 callbackUrl handling : non utilisé dans le code (pas de `signIn(..., { callbackUrl })` côté action). RAS.

### 13. Dependency audit

```
$ pnpm audit --prod --json
{
  "actions": [],
  "advisories": { "1117015": { ... postcss <8.5.10 / CVE-2026-41305 ... } },
  "metadata": {
    "vulnerabilities": { "info": 0, "low": 0, "moderate": 1, "high": 0, "critical": 0 },
    "dependencies": 596
  }
}
```

**1 advisory moderate** :

- `postcss@8.4.31` (via `next>postcss`) — XSS via unescaped `</style>` en stringify (CVSS 6.1)
- Fix : `>=8.5.10`. Bloqué par la version de `next` actuelle (peer dep) → patch via bump Next 16 minor ou pnpm override.

**Aucune high/critical.** Surface réduite : devDependencies pas auditées ici (`--prod` only), à compléter en CI (`pnpm audit` full).

### 14. Turnstile fail-open vs fail-close

`src/lib/turnstile.ts:23-31` :

```
const secret = process.env.TURNSTILE_SECRET_KEY;
if (!secret) {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? "development";
  if (appEnv === "development") return true;  // fail-OPEN
  return false;                                // fail-CLOSED staging + prod
}
```

**Fail-closed en prod + staging** dès que `TURNSTILE_SECRET_KEY` absent. Fix Sprint 15 Fork 3 C2-3 (commentaire `:25-28`). Dev keys publiques (`1x...AA`, `2x...AA`, `3x...AA`) → bypass intentionnel.

Timeout fetch 5 s (`AbortController`). Si CF API down → `return false` (fail-closed) → user bloqué. Trade-off acceptable (CF disponibilité ≈ 100 %).

### 15. Admin URL anti-énumération

- `ADMIN_URL_PREFIX` ≥ 16 chars random alphanumériques (entropie ~96 bits)
- Refus prod si valeur publique `admin-dev-x7k2n9` ou `admin-dev*` (`src/env.ts:46-58`)
- Match dans middleware (`src/auth.config.ts:48`) + CSP (`src/lib/csp.ts:117-119`)

Observation prod :

- `curl /fr/admin-dev-x7k2n9/login` → CSP soft (admin pas détecté → public). Pas de 404 explicite (next-intl rewrite → page existe peut-être en SSG, mais sans auth derrière).
- `curl /fr/admin-xfz5hk0j7hrk/login` → CSP STRICT + nonce. C'est le vrai préfixe (mémoire `axionia_domain_hosting`).

**Anti-énumération solide.** Couplé à rate-limit auth, robots.txt n'expose pas le segment, sitemap-index ne contient pas `/admin-*` (à vérifier P-04 ROBOTS-SITEMAP). Pas de leak dans `llms.txt` non plus (audit séparé AGT-04 SEO).

### 16. Headers OWASP — récap

| Header                         | Valeur observée prod (`curl https://axion-ia.com/`)                                                                                 | Verdict                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `Strict-Transport-Security`    | `max-age=31536000; includeSubDomains; preload`                                                                                      | ✅ (1 an preload OK, divergence config 2 ans → P1-S3) |
| `Content-Security-Policy`      | strict (admin) / soft (public) selon path                                                                                           | ✅ + 🟡 P1-S1 sur public                              |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                                                                                                       | ✅                                                    |
| `Cross-Origin-Embedder-Policy` | `credentialless`                                                                                                                    | ✅ (downgrade tracé)                                  |
| `Cross-Origin-Resource-Policy` | `same-origin`                                                                                                                       | ✅                                                    |
| `Permissions-Policy`           | `camera=(), microphone=(), geolocation=(), interest-cohort=(), accelerometer=(), gyroscope=(), magnetometer=(), payment=(), usb=()` | ✅                                                    |
| `X-Frame-Options`              | `DENY`                                                                                                                              | ✅                                                    |
| `X-Content-Type-Options`       | `nosniff`                                                                                                                           | ✅                                                    |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`                                                                                                   | ✅                                                    |
| `X-DNS-Prefetch-Control`       | `on`                                                                                                                                | ✅                                                    |
| `frame-ancestors 'none'` (CSP) | ✅                                                                                                                                  | ✅                                                    |
| `form-action 'self'` (CSP)     | ✅                                                                                                                                  | ✅                                                    |
| `base-uri 'self'` (CSP)        | ✅                                                                                                                                  | ✅                                                    |
| `object-src 'none'` (CSP)      | ✅                                                                                                                                  | ✅                                                    |

---

## Citations

### Code (path:line)

- `src/proxy.ts:21,30,34,40-53` — CSP nonce per-request + COEP credentialless
- `src/lib/csp.ts:60-73,75-108,113-120` — buildCspHeader strict vs soft, isStrictCspPath
- `next.config.ts:17-30,26` — securityHeaders OWASP, HSTS 63072000
- `src/auth.ts:14-242` — Credentials provider, 2FA, rate-limit, timing-safe verify
- `src/auth.ts:28-87` — JWT revocation cache 60 s
- `src/auth.config.ts:17,45-68` — middleware authorized callback, adminUrlPrefix
- `src/lib/auth-password.ts:14-19,40-67` — Argon2id OWASP params + dummy hash
- `src/lib/auth-2fa.ts:10,16,38-46` — TOTP RFC 6238, epochTolerance 30
- `src/lib/turnstile.ts:23-31,37-54` — fail-closed prod+staging, timeout 5s
- `src/lib/rate-limit.ts:30-77` — sliding window Redis sorted set, fail-open
- `src/lib/gdpr-token.ts:65-117` — HMAC-SHA256 token signing/verify, exp 24 h
- `src/lib/pii-redaction.ts:22-66` — email/name/phone redaction
- `src/lib/admin-path.ts:27-42` — adminSegment env-driven helper
- `src/env.ts:11-32,36-58,82-107` — Zod superRefine prod gate AUTH_SECRET + ADMIN_URL_PREFIX + BACKUP_ENCRYPTION_PASSPHRASE
- `src/components/marketing/JsonLd.tsx:11-13`, `src/components/nav/Breadcrumbs.tsx:55`, `src/app/[locale]/layout.tsx:162,166,179` — dangerouslySetInnerHTML (JSON-LD only)
- `src/features/admin-calendar/actions.ts:125,223,238` ; `src/features/admin-options/actions.ts:146,166,263` ; `src/features/booking/actions.ts:197` ; `src/server/queue/workers/option-expiration-worker.ts:46` ; `src/app/api/healthz/route.ts:36` — $queryRaw tagged template paramétrés
- `src/features/admin-auth/actions.ts:116,125` — redirect interne adminSegment

### Prod (curl observations 2026-05-11 12:34 UTC)

- `curl -sI -A "AxionIA-Audit/1.0" https://axion-ia.com/` → CSP soft + HSTS 1 an + COOP/COEP/CORP + Permissions-Policy + Set-Cookie `__Host-authjs.csrf-token`
- `curl -sI .../fr/reserver` → CSP soft + `cf-cache-status: HIT` + `x-nextjs-prerender: 1`
- `curl -sI .../fr/admin-xfz5hk0j7hrk/login` → CSP STRICT (`nonce-…` + `strict-dynamic`)
- `curl -sI .../fr/admin-dev-x7k2n9/login` → CSP soft ✅ (faux préfixe = pas admin)

### Cmd

- `pnpm audit --prod --json` → 596 deps prod, 1 moderate (postcss 8.4.31), 0 high/critical

---

## [INCONNU]

- **Sentry PII scrub config** : non audité ici (AGT-14 MONITORING-DR). `[DEBUG TEMPORAIRE]` `src/auth.ts:99-117` peut envoyer email + IP dans Sentry breadcrumbs si pas filtré côté `sentry.server.config.ts`.
- **CF Cache Rules détaillées** (5 règles Phase 5) : non auditées ici (AGT-12 INFRA-CICD).
- **DNSSEC status** : reporté ~16 mai (mémoire `axionia_session_2026-05-09_cloudflare_phase5`) → `[ACTION WILL]`.
- **DPA Hetzner papier** : hors code (AGT-09 RGPD).
- **Sentry sourcemap protection** : non testé ici.
- **Bot Fight / WAF rules count** : `[ACTION WILL]` ou AGT-12 via API CF.
- **Rate-limit `GDPR export request`** : limit/window non lus en détail (vu seulement `checkRateLimit` call site `src/app/api/gdpr-export/request/route.ts:37`).
- **Rate-limit `admin reset 2FA`** : idem (`src/features/admin-users/actions.ts:272`).

---

## Recommandations (≤ 10, classées effort × impact)

| #   | Reco                                                                                                                                                              | Effort | Impact                               | Priorité         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------ | ---------------- |
| 1   | Retirer `[DEBUG TEMPORAIRE 2026-05-10]` dump credentials `src/auth.ts:99-117` ; remplacer par log structuré PII-scrubbed (email hash + ipAddress présent oui/non) | 15 min | Évite leak Sentry/logs               | P1-S4 immédiat   |
| 2   | Patch postcss CVE-2026-41305 via bump `next` minor OU `pnpm overrides` `"postcss": "^8.5.10"`                                                                     | 30 min | Ferme 1 moderate CVE                 | P1-S2 court      |
| 3   | Aligner HSTS Next config sur 1 an (CF impose 12 mois) OU basculer CF `respect origin` pour appliquer 2 ans                                                        | 15 min | Cohérence config                     | P1-S3 cosmétique |
| 4   | Sprint 16 PERF — dater fermement la migration CSP public vers nonce/hash + `force-dynamic` ou layout strategy ; sortir `'unsafe-inline'` + `'unsafe-eval'`        | 2-3 j  | Élimine surface XSS publique latente | P1-S1 sérieux    |
| 5   | Brancher Sentry breadcrumb dans `rate-limit.ts:62-67` `failOpen()` pour alerter Redis down                                                                        | 30 min | Observabilité M11                    | P2-S2            |
| 6   | Activer ESLint `react/no-danger` avec allowlist explicite `JsonLd.tsx` + `Breadcrumbs.tsx` + `layout.tsx`                                                         | 30 min | Garde-fou future-proof               | P2               |
| 7   | Documenter dans runbook la fenêtre revocation JWT 60 s (incident response)                                                                                        | 15 min | Clarté DR                            | P1-S5 doc        |
| 8   | Réduire CSP `connect-src` Sentry à la seule région utilisée (1 wildcard au lieu de 3)                                                                             | 5 min  | Surface CSP                          | P2-S6            |
| 9   | Ajouter `pnpm audit --audit-level=high` en CI bloquant (PR check)                                                                                                 | 1 h    | Future-proof                         | P2               |
| 10  | Compléter env.ts : pattern Telegram token + min Sentry DSN ; ajouter validation `NEXT_PUBLIC_TURNSTILE_SITE_KEY` couplée `TURNSTILE_SECRET_KEY`                   | 30 min | Defense in depth                     | P2               |

---

## STOP & ASK consolidés (questions ouvertes pour Will)

- **Q-08-1** — Sprint 16 PERF est-il toujours parqué ? Date cible CSP migration public → strict ? Sans, le P1-S1 reste indéfiniment ouvert.
- **Q-08-2** — `[DEBUG TEMPORAIRE 2026-05-10]` `src/auth.ts:99-117` : login Will validé en prod (mémoire `axionia_session_2026-05-09_sprint_24`). Peut-on retirer ce dump immédiatement ?
- **Q-08-3** — Argon2id m=19 MiB est conforme OWASP min 2024. Veux-tu durcir à m=46 MiB (recommandé OWASP « si possible ») ? Impact ~2.5× CPU/login.
- **Q-08-4** — Rate-limit auth 100/15 min IP + 50/15 min email (admin solo). Quand redurcir ? Cible cutover (admin multi-user) ou décision data-driven sur activity_log ?
- **Q-08-5** — JWT revocation cache 60 s. Acceptable pour V1 ou veux-tu cache 5 s (round-trip DB chaque hit ~3× plus) ?
- **Q-08-6** — Confirmer que `INDEXNOW_KEY` ne nécessite pas rate-limit `/api/indexnow` (endpoint Edge runtime, abus = ping Bing dépensable).
- **Q-08-7** — HSTS 2 ans config Next vs 1 an Cloudflare : aligner sur 1 an (CF maître) ou basculer CF en respect origin pour faire passer 2 ans bout-en-bout ?
- **Q-08-8** — Sentry connect-src 3 régions ingest : quelle région est réellement utilisée pour le projet OÜ estonienne ? Réduire pour minimiser CSP surface.

---

**FIN AGT-08-SECURITE.md** — Score 82/100, 0 P0, 5 P1, 6 P2, confiance haute.

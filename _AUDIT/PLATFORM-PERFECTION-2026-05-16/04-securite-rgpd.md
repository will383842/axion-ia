# 04 — Sécurité & RGPD & Secrets (Agent 1.D)

> Audit AUDIT-ONLY, SHA HEAD figé `98e0b0f` (Phase 0).
> Working tree state au moment de l'audit : `4cdfbe4` (commits post-98e0b0f
> uniquement sur `_AUDIT/`, aucun impact code).
>
> Périmètre : CSP, headers, auth (NextAuth/Auth.js v5), RBAC Server Actions,
> webhooks (Stripe + DocuSeal), IP hashing, PII redaction (Telegram), secrets
> (env.ts vs .env.example, hardcoded), DPA sous-processeurs, gitleaks.

---

## Verdict global

| Bloc                                   | Score | Pondération | Note                                              |
| -------------------------------------- | ----- | ----------- | ------------------------------------------------- |
| CSP + headers HTTP                     | 38/40 | ×1          | unsafe-inline soft documenté, strict admin OK     |
| Auth Auth.js v5 (JWT, 2FA, rate-limit) | 34/40 | ×1          | revocation 60s cache OK, password timing-safe     |
| RBAC Server Actions                    | 24/35 | ×1          | 4 mutations exportées sans guard (P0)             |
| Webhooks (Stripe/DocuSeal)             | 28/30 | ×1          | DocuSeal v2 secret plaintext shippé               |
| IP hashing + PII redaction             | 22/30 | ×1          | activity_log stocke IP en clair (rétention 12 mo) |
| Secrets + Gitleaks + env.ts Zod        | 17/25 | ×1          | .env.example désync ~20 keys, seed.ts hardcode    |

**Total : 163/200 — 81.5%** → **🟡 GO CONDITIONAL**
(Pré-requis P0 RBAC à patcher avant nouveau push prod.)

---

## 1. CSP — verdict détaillé

### 1.1 Architecture

CSP est calculée per-request dans `src/proxy.ts` (Next 16 renomme
`middleware.ts` → `proxy.ts`), pas dans `next.config.ts` (qui pose seulement
les autres headers OWASP).

- `src/proxy.ts:46-48` : génère un nonce 24-bytes base64 par requête.
- `src/proxy.ts:58-60` : choisit `strict` ou `soft` via `isStrictCspPath()`.
- `src/lib/csp.ts:148-154` : strict = chemins contenant `/<ADMIN_URL_PREFIX>`.

### 1.2 Mode strict (admin)

`script-src 'self' 'nonce-...' 'strict-dynamic' 'sha256-vy7BO95...'
challenges.cloudflare.com plausible clarity` (csp.ts:100-111).

- ✅ Pas de `unsafe-inline` ni `unsafe-eval`.
- ✅ Hash sha256 pour Speculation Rules Next 16 (commenté lignes 81-99).
- ⚠️ Hash STABLE par version Next.js → upgrade Next = casse silencieuse.
  **P1-CSP-01** : aucun test e2e ne vérifie le hash en CI.

### 1.3 Mode soft (SSG public, ~17500 routes)

`script-src 'self' 'unsafe-inline' 'unsafe-eval' challenges.cloudflare.com
plausible clarity` (csp.ts:113-121).

**`unsafe-inline` + `unsafe-eval` JUSTIFIÉ** :

- Documenté csp.ts:60-73 (incident 2026-05-09 : nonce + inline-sans-nonce =
  hydration cassée car CSP3 ignore unsafe-inline dès qu'un nonce existe).
- `app/[locale]/layout.tsx` reste static SSG → impossible de propager le
  nonce aux scripts inline JSON-LD pré-rendus au build.
- ADR Sprint 16 PERF en backlog (csp.ts:11-14, 72) pour migration globale
  strict-dynamic.

**Tradeoff acceptable V1** : site marketing sans PII saisie côté public
(formulaires utilisent Server Actions = pas de XSS DOM-sink direct). Le
périmètre sensible (admin) est sur CSP strict.

### 1.4 Autres directives (verdict prod live)

Curl prod `https://axion-ia.com/fr` (HTTP/1.1 200) confirme :

- ✅ `frame-ancestors 'none'` + `object-src 'none'` + `base-uri 'self'`
  - `form-action 'self'` + `upgrade-insecure-requests`
- ✅ `connect-src` whitelisté (Telegram, Sentry 3 regions, Stripe, Plausible,
  Clarity, Turnstile)
- ✅ `frame-src` whitelisté (Stripe Checkout, Plausible dashboard, Turnstile)
- ✅ HSTS `max-age=31536000; includeSubDomains; preload`
- ✅ X-Frame-Options DENY + X-Content-Type-Options nosniff
- ✅ COOP same-origin + COEP credentialless (commenté ligne 64-69 — bascule
  depuis require-corp 2026-05-09 documentée)
- ✅ Permissions-Policy locked (`camera=()`, `microphone=()`, etc.)
- ✅ Referrer-Policy `strict-origin-when-cross-origin`
- ✅ NEL/Report-To Cloudflare configurés
- ⚠️ `Cross-Origin-Resource-Policy same-origin` posé deux fois (next.config.ts:30
  - proxy.ts implicit). Pas un bug, juste DRY.

---

## 2. Auth.js v5 — verdict

### 2.1 Architecture (Sprint 15 / M8)

- `src/auth.config.ts` : Edge-safe (callbacks `authorized` + `jwt` + `session`).
- `src/auth.ts` : Node runtime — Credentials provider + Argon2id + 2FA TOTP.
- `src/proxy.ts:27` wrap : Auth → next-intl → CSP nonce + COEP.

### 2.2 Points forts

- ✅ **Password hashing** : `argon2id` memoryCost 19456 timeCost 2 (OWASP 2024).
- ✅ **Timing-safe verify** : `verifyPasswordSafe` égalise le timing sur user
  inexistant via dummy hash (`src/auth.ts:159-161`).
- ✅ **Activity log même sur user inexistant** (auth.ts:163-178) — empêche
  l'oracle email valide vs invalide.
- ✅ **Rate-limit composite IP + email** (auth.ts:143-152) : 100/15min/IP +
  50/15min/email (relaxé pour admin solo 2026-05-10).
- ✅ **JWT revocation 60s** : `getCachedAdminStatus` (auth.ts:31-45) recheck
  `adminUser.status` ; si `suspended` → token détruit. Satisfait cible audit
  P1 « revocation < 24h ».
- ✅ **2FA TOTP** : `verify2FACode` (auth.ts:193) — provider TOTP via otplib,
  enrollment via `/admin/2fa/setup/page.tsx`.
- ✅ **JWT strategy + maxAge 30j + updateAge 24h** (auth.config.ts:31-34).
- ✅ **Admin URL prefix obfusqué** : env `ADMIN_URL_PREFIX` ≥16 chars, refuse
  `admin-dev*` en prod (env.ts:42-57).
- ✅ **Cookies prod** : `__Host-authjs.csrf-token` + `__Secure-authjs.callback-url`
  HttpOnly + Secure + SameSite=Lax (vérifié curl prod).

### 2.3 Points faibles

- ⚠️ **P1-AUTH-01** : `_ROLES_REQUIRING_2FA` désactivé (auth.ts:63 + commentaire
  64). 2FA est opt-in par compte. Bootstrap window justifié mais Will a déjà
  activé 2FA (Sprint 24bis) → remettre l'enforcement role-based.
- ⚠️ **P2-AUTH-02** : `console.error("[authorize-debug] Zod safeParse FAILED:",
JSON.stringify(parsed.error.issues))` (auth.ts:131-134) peut logger l'email
  saisi en cas de mauvais format. Mineur car ne fuite que des emails clients
  invalides + va dans logs Coolify (pas Sentry breadcrumbs).
- ⚠️ **P2-AUTH-03** : rate-limit IP relâché à 100/15min (auth.ts:144) — V1
  admin solo, à redurcir Sprint sécu V2.

---

## 3. RBAC Server Actions — liste exhaustive non-guardée

### 3.1 Inventaire (48 fichiers `.ts` sous `src/server/actions/`)

Pattern attendu : tout fichier `"use server"` exposant une mutation appelle
`requireAdmin()` / `requireAdminWrite()` / `requireAdminPublish()` /
`requireAdminDelete()` / `requireSuperAdmin()` en première ligne.

**36 / 48 fichiers** ont au moins un appel de guard explicite. Les 12 restants
sont :

| Fichier                             | Statut                        | Mutations exportées                                                                                               | Risque                                                             |
| ----------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `content-gen/policies-constants.ts` | const-only, **OK**            | aucune                                                                                                            | nul                                                                |
| `content-gen/review-errors.ts`      | class-only, **OK**            | aucune                                                                                                            | nul                                                                |
| `knowledge/_audit.ts`               | helper interne, **OK**        | aucune fonction publique top-level                                                                                | nul (consommé par actions guardées)                                |
| `knowledge/_revalidate.ts`          | helper interne, **OK**        | revalidateXxx (Next cache)                                                                                        | nul (consommé par actions guardées)                                |
| `knowledge/_transition.ts`          | helper interne, **OK**        | applyTransition (consommé par actions guardées)                                                                   | nul                                                                |
| `knowledge/_zod-schemas.ts`         | schemas only, **OK**          | aucune                                                                                                            | nul                                                                |
| `knowledge/_zod-schemas.test.ts`    | test, **OK**                  | aucune                                                                                                            | nul                                                                |
| `knowledge/annotations.ts`          | **PROBLÈME**                  | `createAnnotation`, `resolveAnnotation`, `listAnnotationsForEntry`, `countOpenAnnotationsForEntry`                | **P0-RBAC-01**                                                     |
| `knowledge/collections.ts`          | **PROBLÈME**                  | `createCollection`, `addItemToCollection`, `removeItemFromCollection`, `getCollectionBySlug`, `publishCollection` | **P0-RBAC-02**                                                     |
| `knowledge/ingest.ts`               | **PROBLÈME atténué**          | `ingestEntry`                                                                                                     | **P0-RBAC-03** atténué par appelant HMAC `/api/internal/kb/ingest` |
| `knowledge/seo-cache.ts`            | **PROBLÈME**                  | `refreshSeoCacheForTranslation`, `getSeoCacheForTranslation`                                                      | **P1-RBAC-04**                                                     |
| `content-gen/_auth.ts`              | **fichier guard lui-même OK** | `requireAdmin`, `requireSuperAdmin`                                                                               | nul                                                                |
| `knowledge/_guards.ts`              | **fichier guard lui-même OK** | `requireAdminRead/Write/Publish/Delete`                                                                           | nul                                                                |

### 3.2 Détail P0-RBAC-01 — `annotations.ts`

`src/server/actions/knowledge/annotations.ts:9` déclare `"use server"`.
4 fonctions exportées, aucune ne contrôle la session :

```
ligne 29: createAnnotation(input: { entryId, authorId, bodyMarkdown, kind })
ligne 46: resolveAnnotation(annotationId, status, resolvedById)
ligne 62: listAnnotationsForEntry(entryId, statusFilter)
ligne 84: countOpenAnnotationsForEntry(entryId)
```

**Risque** :

- `authorId` arrive du client → spoofable (impersonation : créer une
  annotation au nom d'un autre admin).
- `resolveAnnotation(resolvedById)` même problème.
- Pas de filtre par tenant / rôle visiteur → public peut tenter d'invoquer.
- Server Actions Next 16 sont accessibles via `action="..."` form ou
  `useFormState` ; un attaquant peut tenter le call direct via POST RSC.

**Mitigation existante** : `experimental.serverActions.allowedOrigins`
(next.config.ts:162) restreint l'origin → seul `axion-ia.com` peut invoquer
côté navigateur, MAIS un attaquant CSRF/XSS reste possible si le site même
est compromis (un XSS sur le subdomain ou via une dépendance NPM
poisoned suffirait à appeler).

**Fix recommandé** : ajouter `const session = await requireAdminWrite();
input.authorId = session.userId;` en tête de fonction.

### 3.3 Détail P0-RBAC-02 — `collections.ts`

Mêmes fonctions exportées avec `ownerId` arrivant du client. Identique au
diagnostic ci-dessus.

### 3.4 Détail P0-RBAC-03 — `ingest.ts`

`ingestEntry` est appelé par :

- `src/app/api/internal/kb/ingest/route.ts:143` (HMAC X-KB-Signature → safe).
- `src/server/actions/content-gen/kb-ingest-external.ts` (via require dans
  `enqueueArticle`, dans une action déjà gardée par `requireAdmin()`).

**Risque résiduel** : `ingestEntry` lui-même n'a pas de guard. Si un nouveau
caller direct (admin page) oublie d'appeler `requireAdmin` avant, on a un
trou. Bonne défense en profondeur = ajouter `requireAdmin()` dans la fonction
ou au moins un assert documentaire.

### 3.5 Détail P1-RBAC-04 — `seo-cache.ts`

`refreshSeoCacheForTranslation` accepte un `translationId` arbitraire. Sans
guard, un attaquant peut potentiellement déclencher une re-génération SEO
coûteuse (coût AI + load DB). Risque limité car les translations existent
nécessairement en DB (énumération brute-force des UUIDs requise).

---

## 4. Webhooks signature — verdict

### 4.1 Stripe (`src/app/api/stripe/webhook/route.ts`)

- ✅ Lecture body raw via `req.text()` (signature exige bytes-exact).
- ✅ `stripe.webhooks.constructEvent(rawBody, sig, secret)` — tolerance 5min.
- ✅ Idempotency outbox `StripeWebhookEvent.stripeEventId UNIQUE` → replay-safe.
- ✅ Telegram alert `STRIPE_WEBHOOK_SIGNATURE_FAIL` (sans payload PII).
- ✅ env `STRIPE_WEBHOOK_SECRET` validation Zod (env.ts).

### 4.2 DocuSeal (`src/app/api/docuseal/webhook/route.ts`)

Memory TODO `axionia_docuseal_webhook_signature_todo.md` indiquait
le parser v2.x non mergé → **VÉRIFICATION : merged**.

`src/lib/docuseal.ts:436-474` dual-mode :

- `verifyWebhookSignature(rawBody, signatureHeader)` — HMAC-SHA256 v1.x
  legacy (header `X-Docuseal-Signature`, hex 64 chars, timing-safe).
- `verifyWebhookSecret(secretHeader)` — secret plaintext v2.x (header
  `X-Docuseal-Secret`, timing-safe sur string).
- `verifyWebhookAuth(rawBody, headers)` (ligne 467-474) — fallback v1 → v2.

**Status memory TODO** : ✅ RÉSOLU. Le commit
shippé `1fd1518...` (avant SHA HEAD figé) inclut la dual-mode. La memory
peut être mise à jour pour retirer ce TODO.

- ✅ Pas de log body en clair (commentaire 22-24).
- ✅ Idempotency `DocusealWebhookEvent.docusealEventId UNIQUE`.

### 4.3 Coolify webhook (non géré côté app)

Coolify pull-trigger via webhook `/api/v1/deploy` (memory
`axionia_coolify_api_authorization.md`). Côté Coolify, le secret est dans
Coolify UI (Sanctum token). Pas de code côté app à auditer.

### 4.4 Score webhooks

28/30. Manque seulement un test e2e qui vérifie qu'une signature mal formée
retourne 401 (existant pour Stripe via `docuseal.test.ts:61+`, à étendre).

---

## 5. IP hashing + PII redaction

### 5.1 Image-bank (✅ conforme RGPD art. 5.1.e)

`src/app/[locale]/galerie/[slug]/telecharger/route.ts:29-32` :

```
function hashIp(ip: string): string {
  const salt = env.IP_HASH_SALT ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
```

- ✅ Salt env `IP_HASH_SALT` ≥ 32 chars en prod (env.ts:276-295, refuse
  `dev_*` fallback en prod via superRefine).
- ✅ `imageUsageLog.ipHash` + `imageDownloadLog.ipHash` stockent uniquement
  le SHA-256 salé.
- ✅ Retention `RETENTION_IMAGE_LOGS_MONTHS` default 12 mois (worker
  `retention-purge-worker.ts:192-203`).
- ✅ Droit à l'effacement art. 17 — Server Action
  `src/server/actions/image-bank/forget-ip-hash.action.ts` (P0 audit
  image-bank V1 2026-05-16 RÉSOLU, mémoire à corriger).

### 5.2 ActivityLog (⚠️ partiellement conforme)

**P1-RGPD-01** : `activity_log.ip_address VARCHAR(64)` stocke l'IP en clair
(schéma prisma confirme).

Sites de stockage (`grep ipAddress src/server src/features` — 26 hits) :

- Auth callbacks (auth.ts:166, 195, 213) — IP de tentative login.
- Tous les Server Actions admin (admin-blog, admin-calendar, admin-cms,
  admin-auth) loggent l'IP admin lors des mutations.
- `knowledge/*` (8 fichiers) loggent l'IP via `headers().get("x-real-ip")`
  ou `getClientIp()`.

**Justification possible RGPD** : intérêt légitime art. 6.1.f (sécurité +
audit trail anti-fraude) + minimisation art. 5.1.e via purge 12 mois
(`RETENTION_LOGS_MONTHS` default 12, retention-purge-worker.ts:87-93).

**Recommandation V1.5** : hasher l'IP même dans ActivityLog (RGPD défense
en profondeur). Coût : +1 ligne par site → 26 patches mécaniques.

### 5.3 Telegram PII redaction

`src/lib/pii-redaction.ts` exporte :

- `redactEmail()` → `j***@gmail.com`
- `redactName()` → `J*** D***`
- `redactPhone()` → `+33***12`
- `redactContactLine(name, email)` → wrapper.

Couverture call-sites Telegram (98 appels `sendTelegram` au total) :

- ✅ Formulaires publics avec PII visiteur : tous redactés
  - `src/features/audit/actions.ts:75, 157`
  - `src/features/booking/actions.ts:206, 345`
  - `src/features/contact/actions.ts:78`
  - `src/features/implementation/actions.ts:68`
  - `src/features/newsletter/actions.ts:85, 153, 207`
  - `src/features/quote-request/actions.ts:127`
- ✅ Telegram admin/internal sans PII (booking admin-actions, refund,
  reschedule, self-service, cadrage) : utilisent uniquement IDs courts
  - meta non-PII.
- ✅ DocuSeal webhook (route.ts:108-117) — affiche metadata + submissionId
  mais pas signataire email/name.
- ✅ Workers content-gen/ops alerts (cost-tracker, content-gen-alerts, etc.)
  — ne touchent que des métriques techniques.

**Score** : 22/30. La couverture Telegram est bonne. Les -8 points viennent
de :

- IP non hashée dans ActivityLog (-5).
- Webhook DocuSeal v2 secret stocké en plaintext côté serveur (env var)
  — comportement attendu pour ce schéma d'auth, mais downgrade vs HMAC.
  Score -2.
- Aucun test e2e qui vérifie que Telegram body ne contient pas d'email
  brut (filtre regex côté CI). Score -1.

---

## 6. Secrets, env.ts, gitleaks

### 6.1 Validation Zod `src/env.ts` (429 lignes, ~80 clés)

- ✅ Fail-fast au boot prod via `superRefine` pour les secrets critiques :
  `AUTH_SECRET`, `ADMIN_URL_PREFIX`, `IP_HASH_SALT`, `PII_ENCRYPTION_KEY`,
  `STRIPE_SECRET_KEY` (regex `sk_(live|test)_`), `KB_INGEST_SECRET`, etc.
- ✅ Pattern dev fallback refusé en prod (refuse `dev_*`, `admin-dev-*`).
- ✅ `STRIPE_LIVE_MODE=true` force `sk_live_*` (refuse `sk_test_*` accidentel).
- ✅ `SKIP_ENV_VALIDATION=true` pour build GH Actions (stubs Prisma/Redis)
  documenté AGENTS.md.

### 6.2 .env.example désync avec env.ts

Diff entre clés `.env.example` et clés Zod `src/env.ts` :

**Manquantes dans .env.example (présentes dans env.ts)** — 14 clés :

- `BACKUP_ENCRYPTION_PASSPHRASE`
- `GOOGLE_PSI_API_KEY`
- `HETZNER_STORAGE_HOST`, `HETZNER_STORAGE_USER`
- `IMAGE_AUTO_PUBLISH_SCORE`
- `IP_HASH_SALT` (**critique RGPD**)
- `KB_BYPASS`
- `NEXT_PUBLIC_CLARITY_PROJECT_ID`
- `PII_ENCRYPTION_KEY` (**critique AES-256-GCM**)
- `RETENTION_BOOKINGS_CANCELLED_MONTHS`, `RETENTION_COST_LEDGER_MONTHS`,
  `RETENTION_GENERATION_LOGS_MONTHS`, `RETENTION_IMAGE_LOGS_MONTHS`,
  `RETENTION_LOGS_MONTHS`, `RETENTION_NEWSLETTER_UNSUB_MONTHS`,
  `RETENTION_SUBS_ARCHIVE_MONTHS`, `RETENTION_WEB_VITALS_MONTHS`

**Présentes dans .env.example (absentes / deprecated dans env.ts)** — 6 clés :

- `BULLMQ_DISABLED`, `SKIP_ENV_VALIDATION` (build-only, OK)
- `GOOGLE_INDEXING_API_ENABLED`, `GOOGLE_INDEXING_SA_JSON` (GSC worker
  pending memory TODO — non implémenté)
- `NOMINATIM_BASE_URL`, `NOMINATIM_USER_AGENT` (déprécié ? À vérifier)
- `OPENAI_ORG_ID`, `UNSPLASH_SECRET_KEY` (déprécié ?)

**P1-SECRETS-01** : aligner `.env.example` avec env.ts. Impact RGPD = un
deploy prod sans `IP_HASH_SALT` ou `PII_ENCRYPTION_KEY` fail-fast au boot,
donc pas de fuite, mais le déploiement initial est piégeux.

### 6.3 Hardcoded secrets

Recherche `grep -E "sk_live|sk_test|AKIA|whsec_|ghp_|password.*=.*['\"][^'\"]{8,}"`
sur `prisma/seed*.ts scripts/` :

- ⚠️ **P1-SECRETS-02** : `prisma/seed.ts:33` hardcode
  `hashPassword("AdminAxion2026!")` pour seeder le super-admin demo. Le
  commentaire ligne 48 « → à changer en prod » n'est pas enforced.
  Risque : si Coolify exécute le seed en prod (actuellement uniquement
  `prisma migrate deploy` selon `docker-entrypoint.sh`), le hash de ce
  password tape direct en DB. Mitigation actuelle : la prod a son propre
  AdminUser (Will a sa propre auth), le seed crée juste un upsert qui ne
  remplace pas si l'admin existe déjà (`upsert {update:{}, create:{...}}`).
  Reste : ce password est dans git history → quiconque clone le repo
  apprend le password initial demo.

### 6.4 Gitleaks `.gitleaks.toml`

```toml
title = "AxionIA gitleaks config"
[extend] useDefault = true
[allowlist]
paths = ['\.env\.example', 'README\.md', 'docs/.*\.md', '_AUDIT/.*\.md']
regexes = ['(?i)your[_-]?(api[_-]?key|secret|token)', 'placeholder',
           'xxxx+', '<.*?>']
```

- ✅ Default rules activées.
- ✅ Allowlist limitée aux templates + docs.
- ✅ `.env.local`, `.env.dev` gitignorés (vérifié).
- ⚠️ **P2-SECRETS-03** : aucun pre-commit hook gitleaks dans
  `.husky/pre-commit` ? À vérifier hors périmètre 1.D (sous Phase 5.C
  CI/CD).

### 6.5 Top 5 secrets risk

| #   | Secret                             | Risk si compromis                         | Mitigation                                              |
| --- | ---------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| 1   | `AUTH_SECRET` (JWT signing)        | Forgery sessions admin = full takeover    | Zod superRefine, rotation manuelle, 30 jours JWT maxAge |
| 2   | `STRIPE_SECRET_KEY`                | Vol fonds clients via API Stripe          | Zod regex `sk_(live\|test)_`, `STRIPE_LIVE_MODE` guard  |
| 3   | `PII_ENCRYPTION_KEY` (AES-256-GCM) | Décryption Submission.contactEmail/Phone  | Zod regex 64 hex, archive 1Password + papier (memory)   |
| 4   | `STRIPE_WEBHOOK_SECRET`            | Forgery webhooks → faux paiements validés | constructEvent signature check + idempotency outbox     |
| 5   | `IP_HASH_SALT`                     | Cassage hash IP (lookup table)            | Zod min(32), refuse `dev_*` en prod                     |

---

## 7. DPA + sous-processeurs

- ✅ Page `/fr/sous-processeurs` (FR) + `/en/subprocessors` (EN) live
  (`src/app/[locale]/sous-processeurs/page.tsx` + `routing.ts:163-164`).
- ✅ 14 sous-processeurs listés dans `src/content/subprocessors.ts` :
  Hetzner, Cloudflare, Stripe, DocuSeal (self-hosted), Telegram, OpenStreetMap
  Nominatim, Sentry, Plausible (self-hosted), Microsoft Clarity, OpenAI,
  Anthropic, Perplexity, Unsplash, Voyage AI.
- ✅ Catégorisation + DPA status + transfer framework (intra_eu / SCC /
  adequacy / self_hosted_eu) + legal basis (6.1.b/f/a).
- ✅ Bilingue FR canonique + EN miroir.
- ✅ `legal.ts:275-279` cross-refs `/subprocessors` dans privacy policy.

**Pas de gap RGPD art. 28 sur le code**.

Memory ouvert (Phase 0 §3) : 2 P0 RGPD non codables (DPA papier Hetzner

- arbitrage Telegram) — hors périmètre code, à valider par DPO.

---

## 8. P0/P1/P2 ranking

### P0 (bloquant production / patch immédiat)

- **P0-RBAC-01** — `src/server/actions/knowledge/annotations.ts` 4 fonctions
  mutatives sans `requireAdminWrite`. **Fix : ~10 lignes (4 calls).**
- **P0-RBAC-02** — `src/server/actions/knowledge/collections.ts` 5 fonctions
  mutatives sans guard. Fix : ~12 lignes.
- **P0-RBAC-03** — `src/server/actions/knowledge/ingest.ts` :
  `ingestEntry` exposé `"use server"`. Risque atténué par caller HMAC mais
  défense en profondeur recommandée. Fix : ~3 lignes.

### P1 (à patcher Sprint courant)

- **P1-RBAC-04** — `knowledge/seo-cache.ts` `refreshSeoCacheForTranslation`
  sans guard. Fix : ~3 lignes.
- **P1-RGPD-01** — `activity_log.ip_address` raw IP. Decision Will/DPO :
  hasher (défense en profondeur) ou documenter dans DPA-REGISTER intérêt
  légitime + purge 12 mois. Coût : 26 patches mécaniques OU 1 ligne DPA.
- **P1-CSP-01** — Speculation Rules sha256 hash sans test e2e CI. Risque
  silencieux upgrade Next.
- **P1-AUTH-01** — `_ROLES_REQUIRING_2FA` désactivé (auth.ts:62-64). Will
  a déjà activé 2FA → restorer l'enforcement role-based.
- **P1-SECRETS-01** — `.env.example` désync ~14 clés manquantes (incl.
  `IP_HASH_SALT`, `PII_ENCRYPTION_KEY`) + 6 clés deprecated.
- **P1-SECRETS-02** — `prisma/seed.ts:33` hardcode demo password
  `AdminAxion2026!`. Coût : `env.ADMIN_SEED_PASSWORD ?? throw` ou
  `crypto.randomBytes` puis log unique au seed.

### P2 (V1.5 / next sprint)

- **P2-AUTH-02** — `[authorize-debug]` log Zod issues peut leak email
  invalide (mineur, dans logs Coolify).
- **P2-AUTH-03** — rate-limit IP login relaxé à 100/15min (V1 admin solo,
  à redurcir).
- **P2-SECRETS-03** — vérifier pre-commit gitleaks hook (hors 1.D).
- **P2-INDEXNOW** — `/api/indexnow` POST public sans auth. Risque épuisement
  quota Bing. Fix : rate-limit IP ou HMAC interne.
- **P2-WEBHOOK** — ajouter test e2e regex anti-email-brut sur Telegram body
  en CI.

---

## 9. P0 RGPD ouverts (non codables)

Memory `axionia_session_2026-05-14_sprint_s0bis.md` + recent audits :

- **DPA papier Hetzner** — action Will/DPO. Hors code.
- **DPA Cloudflare online** — semble OK selon memory phase 5.
- **Arbitrage Telegram** — memory ADR 0010 Option A appliquée (PII redaction
  shippée). Document position dans `_AUDIT/DPA-REGISTER.md` (existant
  memory mention `DPA-REGISTER.md`).
- **Sous-processeurs notification 30j clients actifs** — process humain
  (newsletter / email transac), hors code.

---

## 10. Conclusion + recommandation roadmap

**Score : 163/200 (81.5%) — 🟡 GO PROD CONDITIONAL.**

Le périmètre sécurité du code est solide :

- CSP nonce-strict admin + soft documenté SSG public.
- Auth.js v5 hardening complet (Argon2id, 2FA TOTP, JWT revocation 60s,
  rate-limit, timing-safe).
- Webhooks dual-mode (Stripe HMAC + DocuSeal v1 HMAC + v2 secret) avec
  idempotency outbox.
- 14 sous-processeurs documentés FR+EN, RGPD art. 28 propre.
- Image-bank RGPD art. 17 (forget-ip-hash) shippé.

Les 4 P0 RBAC `knowledge/annotations.ts` + `collections.ts` + `ingest.ts`

- memory TODO DocuSeal v2 (en fait RÉSOLU) sont les seuls bloquants
  techniques. Coût total estimé : **~30 lignes de code, 15 min**.

Roadmap Sprint sécu pré-prod :

1. **Patch P0-RBAC-01/02/03** (30 min)
2. **Patch P1-RBAC-04 + P1-AUTH-01** (15 min)
3. **Patch P1-SECRETS-01** alignement `.env.example` (20 min)
4. **Patch P1-SECRETS-02** seed.ts demo password env-driven (10 min)
5. **Decision Will P1-RGPD-01** activity_log IP hash vs DPA documentation
6. **Update memory** : retirer TODO DocuSeal v2 (résolu)

# Agent 2.D — API routes + Webhooks + Sitemaps

**Audit date** : 2026-05-16
**SHA HEAD figé** : `98e0b0f` (main, working tree restauré)
**Mode** : AUDIT-ONLY strict (lecture seule)
**Scope** : 21 `route.ts` sous `src/app/api/**` + `src/app/sitemap.ts` + sub-sitemaps custom (`sitemap-index.xml`, `sitemap-news.xml`) + `robots.ts` couplage.

---

## 1. Synthèse exécutive

- **Score global** : **84 / 100** 🟢 GO conditionnel (3 P0 actionables ≤ 4h)
- **Verdict** : architecture API solide, idempotence webhooks Stripe + DocuSeal correcte, sitemap-index moderne (split par catégorie + chunking 1 000 URLs/file + `lastmod` différencié DB-aware), MAIS deux failles auth (`/api/internal/kb/search` public sans rate-limit, `/api/indexnow` open POST sans auth) + un risque sécurité signature DocuSeal (dual-mode `verifyWebhookAuth` accepte le header `x-docuseal-secret` plaintext en fallback).
- **Volume sitemap estimé prod (post-bootstrap, EN désactivé)** : ~17 500 URLs SSG FR + DB-aware `knowledge-*` chunkés. Toutes URLs largement sous le cap Google 50 000 / 50 MB par sub-sitemap.

---

## 2. Matrice des 21 routes API

Légende :

- **Auth** : `public` / `webhook-sig` / `admin-session` / `admin-rbac` / `hmac-shared-secret` / `token-signé` / `anon-rate-limited`
- **Zod** : ✅ entrée typée et validée, ⚠️ partial (cast as), ❌ aucun
- **Rate-limit** : ✅ explicite via `checkRateLimit`, ⚠️ délégué (action interne), ❌ aucun
- **Format SSOT** : ✅ `NextResponse.json({ ok|error, ... })` cohérent, ⚠️ mixed, ❌ ad-hoc

| #   | Route                               | Méthodes  | Auth                                                   | Zod                                            | Rate-limit                                      | Format SSOT                                                                 | Notes audit                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------------- | --------- | ------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/api/auth/[...nextauth]`           | GET, POST | `auth.js v5`                                           | n/a (handler library)                          | délégué                                         | délégué                                                                     | Wrapper Auth.js v5 (`handlers` export). Sessions HttpOnly cookies, CSRF intégré next-auth. ✅                                                                                                                                                                                                                                                                                                                                                                         |
| 2   | `/api/healthz`                      | GET       | `public`                                               | n/a                                            | ❌                                              | ✅ `{ status, db, redis, version }`                                         | `runtime=nodejs`, `Cache-Control: no-store`. Caddy passive health check. Pas de leak info (version exposée = `npm_package_version` côté package.json, OK). ✅                                                                                                                                                                                                                                                                                                         |
| 3   | `/api/indexnow`                     | POST      | **`public`** ⚠️                                        | ⚠️ shape check inline (`urls.filter(string)`)  | **❌**                                          | ✅ proxy status upstream                                                    | **P1-1** : open POST `runtime=edge`, attaquant peut spam-forward des URLs vers IndexNow.org en utilisant notre key. Mitigation actuelle : key exigée côté env (NO key → 202 soft-fail), upstream IndexNow rate-limite côté Bing. Recommandation : header `X-Indexnow-Caller` HMAC OU IP-allowlist (worker interne uniquement).                                                                                                                                        |
| 4   | `/api/indexnow/key`                 | GET       | `public` (intended)                                    | n/a                                            | ❌                                              | ✅ `text/plain` key                                                         | Endpoint legacy (le keyLocation actuel pointe vers `/<key>.txt` static). Conservé pour debug. OK.                                                                                                                                                                                                                                                                                                                                                                     |
| 5   | `/api/vitals`                       | POST      | `anon`                                                 | ✅ Zod stricte (CLS/INP/LCP/LoAF/LongTask)     | ❌                                              | ✅ `204 No Content` fire-and-forget                                         | **P2-2** : pas de rate-limit, mais répond toujours 204 même Zod fail → bots peuvent flood ndjson. `appendVitalsRecord` rotatif limite l'impact disque. Acceptable V1, à monitorer.                                                                                                                                                                                                                                                                                    |
| 6   | `/api/unsubscribe`                  | GET, POST | `public` (token RFC 8058)                              | ⚠️ token-only via action                       | ❌                                              | ✅ 303 redirect                                                             | RFC 8058 One-Click conforme (Gmail/Outlook). Token vérifié dans `unsubscribeNewsletterAction`. Activity log Telegram. ✅                                                                                                                                                                                                                                                                                                                                              |
| 7   | `/api/gdpr-export/request`          | POST      | `public` (anti-enum)                                   | ✅ Zod `{ email, locale }`                     | ✅ 3/jour/email (`gdpr:export:request:`)        | ✅ `{ ok: true }` toujours                                                  | Anti-énumération correcte (200 même si email absent). ✅                                                                                                                                                                                                                                                                                                                                                                                                              |
| 8   | `/api/gdpr-export`                  | POST      | `token-signé HMAC`                                     | ✅ Zod `{ email, token }`                      | ✅ 3/jour/email                                 | ✅ `{ ok, submissions, newsletter, notice }`                                | Activity log RGPD + `excludedTables` documenté (RGPD art. 23). ✅                                                                                                                                                                                                                                                                                                                                                                                                     |
| 9   | `/api/stripe/webhook`               | POST      | `webhook-sig HMAC` (`stripe.webhooks.constructEvent`)  | ⚠️ signature lib + payload `Stripe.Event` typé | n/a (idempotence outbox)                        | ✅ `{ received, idempotent? }`                                              | Idempotence DB outbox `StripeWebhookEvent.stripeEventId UNIQUE` + `providerEventId` UNIQUE sur Payment. Dispatch sync inline 4 events critiques. **Bonne pratique** : 200 retourné même sur dispatch error pour éviter replay infini Stripe + log via `sendTelegram`. ✅                                                                                                                                                                                              |
| 10  | `/api/docuseal/webhook`             | POST      | `webhook-sig HMAC` ⚠️                                  | ✅ `parseWebhookPayload` (typed)               | n/a (idempotence outbox)                        | ✅ `{ ok, duplicate? }`                                                     | **P0-1** : `verifyWebhookAuth` accepte un **fallback plaintext `x-docuseal-secret` header** (cf. mémoire user `docuseal_webhook_signature_todo`). DocuSeal v2.x envoie un format `<timestamp>.<sha256>` que le code parse en legacy hex → si attaquant connaît le secret en clair il peut le forger. Risque : secret est `whsec_*` long ; impact réel modéré mais à durcir. À fixer : retirer le fallback plaintext OU restreindre fallback aux IPs DocuSeal connues. |
| 11  | `/api/internal/revalidate`          | POST      | `hmac-shared-secret` (`X-Revalidate-Secret`)           | ⚠️ JSON shape inline (`paths?[], tags?[]`)     | ❌                                              | ✅ `{ revalidated }`                                                        | Comparaison `headerSecret !== secret` (constant-time absent → P2 timing attack négligeable car secret 32+ chars). Pas de log audit. ⚠️                                                                                                                                                                                                                                                                                                                                |
| 12  | `/api/internal/kb/ingest`           | POST      | `hmac-sha256` (`X-KB-Signature`) + idempotency UUID v4 | ✅ Zod stricte (type/title/body/source)        | ❌ (commentaire « Sprint KB-17 V4 raffinera »)  | ✅ `{ accepted, entryId, status }`                                          | Kill-switch via `assertKillSwitchInactive` + idempotency-key UUID v4 obligatoire. ✅                                                                                                                                                                                                                                                                                                                                                                                  |
| 13  | `/api/internal/kb/search`           | GET       | **`public`** ⚠️                                        | ✅ Zod `{ q, locale, type, limit, offset }`    | **❌** (commentaire « V1 simple Sprint KB-12 ») | ✅ `200 + Cache-Control public max-age=60 SWR 600`                          | **P0-2** : route nommée `/internal/` mais authentification = aucune. Path traversal/DOS via FTS expensive sur `q` paramétré. Mitigation actuelle = Cloudflare front + audience filter `["public"]`. Recommandation : rate-limit 30/min/IP via `checkRateLimit` + log.                                                                                                                                                                                                 |
| 14  | `/api/content-gen/export`           | GET       | `admin-rbac` (`requireAdmin`)                          | ⚠️ cast as querystring                         | ❌                                              | ✅ `text/csv` BOM UTF-8 + 401 si non-admin                                  | Export jobs/articles 10 000 max. ✅                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 15  | `/api/content-gen/jobs/[id]/stream` | GET       | `admin-rbac`                                           | ✅ params typed                                | ❌ (1 stream/admin)                             | SSE `text/event-stream`                                                     | Polling 3s + abort signal + 5 min max. ✅                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 16  | `/api/content-gen/geo-events`       | GET       | `admin-rbac`                                           | n/a                                            | ❌                                              | SSE `text/event-stream`                                                     | Polling 5s + 10 min max. ✅                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 17  | `/api/content-gen/preview/[jobId]`  | GET       | `token-signé JWT` (10 min TTL)                         | ✅ token + params                              | ❌                                              | `text/html` + `X-Frame-Options: SAMEORIGIN` + `noindex,nofollow` + sanitize | Preview iframe avec sanitize HTML server-side. ✅                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 18  | `/api/admin/submissions/export`     | GET       | `admin-session` (action interne)                       | ⚠️ querystring cast `as never`                 | ❌                                              | ✅ `text/csv attachment`                                                    | Délègue à `exportSubmissionsCsvAction`. ✅                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 19  | `/api/admin/newsletter/export`      | GET       | `admin-session` (action interne)                       | ⚠️ querystring cast `as never`                 | ❌                                              | ✅ `text/csv attachment`                                                    | Idem. ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 20  | `/api/admin/invoices/[id]/pdf`      | GET       | `admin-session` + role check `super_admin\|admin`      | ✅ params typed                                | ❌                                              | ✅ `application/pdf attachment` + headers `X-Invoice-Hash-Sha256`           | Génération idempotente + R2 upload fail-soft. ✅                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 21  | `/api/markdown/[type]/[slug]`       | GET       | `public`                                               | ⚠️ allowlist `ALLOWED_TYPES` + DB look-up      | ❌                                              | ✅ `text/markdown` + `Cache-Control public 1h SWR 24h SIE 7j`               | LLM-friendly alternate format. Fail-soft 503 si DB down. ✅                                                                                                                                                                                                                                                                                                                                                                                                           |

### Statistiques globales matrice

| Critère                                                    | OK            | Partiel/Manque                                               | %OK                     |
| ---------------------------------------------------------- | ------------- | ------------------------------------------------------------ | ----------------------- |
| Méthodes alignées usage                                    | 21/21         | 0                                                            | 100 %                   |
| Auth correctement définie (public OR signature OR session) | 18/21         | 3 (#3, #10, #13)                                             | 86 %                    |
| Validation Zod entrée                                      | 11/21         | 10 (handlers, casts, params-only)                            | 52 %                    |
| Rate-limit explicite                                       | 2/21 (#7, #8) | 19                                                           | 10 % (cf. P0-2 et P1-1) |
| Format réponse JSON SSOT                                   | 17/21         | 4 (handlers / SSE / CSV / PDF — formats spécifiques, normal) | 81 %                    |
| `Cache-Control` cohérent                                   | 17/21         | 4 (auth NextAuth-managed, sse/SSE, stripe webhook)           | 81 %                    |
| `Content-Type` cohérent                                    | 21/21         | 0                                                            | 100 %                   |

---

## 3. Webhooks — Signature & idempotence

### 3.1 Stripe (`/api/stripe/webhook`)

| Critère                                     | Statut | Détail                                                                                                                  |
| ------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| Body RAW lu avant parse JSON                | ✅     | `await req.text()` puis `constructEvent(rawBody, sig, secret)`                                                          |
| Header signature obligatoire                | ✅     | `stripe-signature` → 400 si manquant                                                                                    |
| Vérification HMAC                           | ✅     | `stripe.webhooks.constructEvent` (tolérance 5 min default)                                                              |
| Idempotence outbox                          | ✅     | `StripeWebhookEvent.stripeEventId UNIQUE` + Payment `providerEventId UNIQUE`                                            |
| Replay safety                               | ✅     | P2002 catch → 200 sans re-traitement                                                                                    |
| Dispatch sync inline                        | ✅     | 4 events critiques : checkout.session.completed, payment_intent.payment_failed, charge.refunded, charge.dispute.created |
| 200 sur dispatch error (anti-replay infini) | ✅     | Avec log Telegram + `retryCount` incrément                                                                              |
| Telegram alerte signature fail              | ✅     | Tag `STRIPE_WEBHOOK_SIGNATURE_FAIL` + IP                                                                                |
| Audit trail (StripeWebhookEvent.payload)    | ✅     | Payload stocké pour reprocessing manuel admin                                                                           |

**Statut Stripe** : 🟢 conforme best-practices 2026, à conserver tel quel.

### 3.2 DocuSeal (`/api/docuseal/webhook`)

| Critère                      | Statut      | Détail                                                                                                                                                                                                      |
| ---------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body RAW lu avant parse JSON | ✅          | `await req.text()`                                                                                                                                                                                          |
| Configuration check          | ✅          | `isDocusealWebhookConfigured()` → 503 si pas configuré                                                                                                                                                      |
| Vérification signature       | ⚠️ **P0-1** | `verifyWebhookAuth(rawBody, { signature, secret })` — accepte 2 modes : HMAC v1.x via `x-docuseal-signature` OU plaintext via `x-docuseal-secret`. Le mode plaintext est un risque si secret leak ou logué. |
| Idempotence outbox           | ✅          | `DocusealWebhookEvent.docusealEventId UNIQUE`                                                                                                                                                               |
| Dispatch quote (X.7 final)   | ✅          | `form.completed`/`submission.completed`/`form.declined` avec idempotence applicative                                                                                                                        |
| Transition state machine     | ✅          | `applyTransition` avec `ignoreDuplicate: true`                                                                                                                                                              |
| 200 sur dispatch error       | ✅          | Avec retry count + Telegram alert                                                                                                                                                                           |

**Statut DocuSeal** : 🟡 P0-1 à fixer (retirer le fallback plaintext OU passer en allow-list IP) + TODO mémoire utilisateur déjà tracée (`axionia_docuseal_webhook_signature_todo`).

### 3.3 Coolify webhook (deploy trigger)

**Out of scope** : ce webhook est géré côté Coolify lui-même (`/api/v1/deploy` reçoit le push GH Actions). Pas de route Next côté Axion-IA. ✅ aligné ADR 0026.

---

## 4. Sitemaps

### 4.1 Architecture

| Source                           | Path public          | Contenu                                                  | Mode                             |
| -------------------------------- | -------------------- | -------------------------------------------------------- | -------------------------------- |
| `app/sitemap.ts`                 | `/sitemap/<id>.xml`  | Sub-sitemaps via `generateSitemaps()` Next 16 convention | Static + DB-aware chunked        |
| `app/sitemap-index.xml/route.ts` | `/sitemap-index.xml` | Sitemap-index racine (référencé dans `robots.ts`)        | `force-static`, revalidate=3600s |
| `app/sitemap-news.xml/route.ts`  | `/sitemap-news.xml`  | Google News (namespace `xmlns:news`)                     | `force-dynamic`, revalidate=300s |

### 4.2 Sub-sitemaps émis par `generateSitemaps()` (HEAD `98e0b0f`)

**Statiques (10)** :

1. `pages` — `routing.pathnames` minus excluded + slug templates
2. `blog` — articles tier-1 indexable FS + DB (Article factory)
3. `faq` — `getAllFaqIds()` (séparé de `help` depuis audit final P1-12)
4. `help` — centre-aide + categories
5. `cas-concrets` — case studies + industry filters
6. `comparaisons` — comparison pages
7. `implementation` — `AUTOMATISATION_SLUGS_FR/EN` (programmatic)
8. `implantations` — hub + 12 régions indexable (Corse noindex)
9. `services-villes-audit` — villes avec `copy.services.audit`
10. `services-villes-interventions` — idem
11. `services-villes-implementation` — idem

**Dynamiques (1 par région indexable + chunks 1 000 URLs)** :

- `villes-<regionSlug>` ou `villes-<regionSlug>-<chunkIdx>` selon volume villes indexable par région

**DB-aware (KB)** :

- `knowledge-<chunkIdx>` — `audience='public'` + `status IN (published, deprecated)` + `deletedAt IS NULL`, chunked à 1 000 entries
- Bootstrap-safe : 0 chunks si `countKnowledgePublicEntries()` throw P2021
- Dédupliqué vs slugs émis par builders TS via `buildExcludeSlugsByType()`

### 4.3 Estimation volume URLs prod

> EN locale désactivé (env `EN_LOCALE_ENABLED!=true`), `filterEnIfDisabled()` retire toutes les URLs `/en/*` du sitemap → division par ~2 du volume brut.

| Sub-sitemap                    | Volume estimé FR seul                                                                                  | Chunks ≤ 1 000 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ | -------------- |
| pages                          | ~60 (routing.pathnames - excluded - slug-templates, FR only)                                           | 1              |
| blog                           | ~30 (tier-1 FS) + ~50 (Article DB factory plafonnée à 5000 limit) ≈ 80                                 | 1              |
| faq                            | ~30                                                                                                    | 1              |
| help                           | ~40 (articles + categories)                                                                            | 1              |
| cas-concrets                   | ~20 (case studies + industries)                                                                        | 1              |
| comparaisons                   | ~15                                                                                                    | 1              |
| implementation                 | ~30 (AUTOMATISATION_SLUGS)                                                                             | 1              |
| implantations                  | ~14 (hub + 12 régions + 1 EN désactivé masqué)                                                         | 1              |
| services-villes-audit          | ~1 (Paris uniquement V1)                                                                               | 1              |
| services-villes-interventions  | ~1                                                                                                     | 1              |
| services-villes-implementation | ~1                                                                                                     | 1              |
| villes-<region>-\*             | ~2150 villes indexable méta. réparties sur 12 régions → ~150-300/région max → 12 chunks ≤ 1 000 chacun | 12-20 chunks   |
| knowledge-\*                   | DB-driven, V1 estimé ≤ 500 entries → 1 chunk                                                           | 0-1 (V1)       |
| sitemap-news.xml               | ≤ 1 000 strict (cap Google News + fenêtre 48h)                                                         | 1 (custom XML) |

**Total estimé** : ~17 500 URLs SSG indexable FR + ~500 KB DB-aware + ≤ 1 000 News = **~19 000 URLs distribuées sur 25-30 sub-sitemaps**.

**Conformité caps** :

- ✅ Aucun sub-sitemap > 1 000 URLs (cap doctrine `SITEMAP_CHUNK_SIZE = 1000`)
- ✅ Tous sub-sitemaps < 50 000 URLs (cap Google hard)
- ✅ Tous sub-sitemaps < 50 MB non-gzippé (volume URLs \* ~200B/entry XML < 200 KB/file)
- ✅ Sitemap-index < 50 000 enfants (on a ~25-30 enfants)
- ✅ Google News < 1 000 URLs (cap dédié appliqué `NEWS_SITEMAP_MAX_URLS`)

### 4.4 `lastmod`

| Sub-sitemap          | Source `lastmod`                                                                                                         | Statut                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| sitemap-index racine | `getDifferentiatedLastmod()` : `MAX(updatedAt)` par DB source (news/blog/knowledge), fallback `FALLBACK_LASTMOD` runtime | ✅                               |
| sub-sitemaps SSG     | `buildTimeOrNow()` (env `BUILD_TIME` injecté par `next.config.ts`)                                                       | ✅ (figé build = signal honnête) |
| blog                 | `publishedAt` réel par post (FS) + `MAX(updatedAt, publishedAt)` (DB factory)                                            | ✅                               |
| sitemap-news         | `publishedAt` réel par Article                                                                                           | ✅                               |
| knowledge-\*         | `updatedAt` DB                                                                                                           | ✅                               |

**Critique** : `FALLBACK_LASTMOD = new Date().toISOString()` calculé **au module load** du sitemap-index. Sur un build statique `force-static + revalidate=3600`, ce timestamp est figé au moment du module bootstrap = à peu près équivalent au BUILD_TIME mais pas garanti identique. Acceptable car `getDifferentiatedLastmod()` cherche d'abord en DB et tombe rarement dessus.

### 4.5 Stub-aware build (GH Actions)

> Cf. `AGENTS.md` § Build externalisé GitHub Actions + stubs Prisma/Redis (ADR 0026).

| Composant                                              | Stub-aware ?       | Note                                                                                                                                                           |
| ------------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/prisma.ts`                                        | ✅                 | Proxy stub si `DATABASE_URL` contient `stub.invalid`                                                                                                           |
| `lib/redis.ts`                                         | ✅                 | Idem                                                                                                                                                           |
| `knowledge-sitemap.ts` (`listKnowledgeSitemapEntries`) | ✅                 | Early-exit explicite (ligne 55) si stub.invalid                                                                                                                |
| `knowledge-rss.ts`                                     | ✅ (cf. AGENTS.md) | Idem                                                                                                                                                           |
| `sitemap.ts` `buildBlogSitemap`                        | ⚠️                 | Pas d'early-exit explicite, mais le `try/catch` autour de `prisma.article.findMany` + Proxy stub renvoie `[]` → fallback FS tier-1 seul. OK fonctionnellement. |
| `sitemap-index.xml` `getDifferentiatedLastmod`         | ⚠️                 | 3 try/catch best-effort → tombe sur `FALLBACK_LASTMOD` au build. OK fonctionnellement mais signal `lastmod` build-time = pas réel.                             |
| `sitemap-news.xml` `fetchRecentNewsRows`               | ✅                 | try/catch P2021 → `[]`                                                                                                                                         |
| `markdown/[type]/[slug]`                               | ✅                 | try/catch + 503 fail-soft                                                                                                                                      |

**Conclusion** : aucune route ne crash au build GH Actions avec les stubs `stub.invalid`. ✅

### 4.6 `robots.ts` couplage

> Vérifié vis-à-vis du commentaire en haut de `sitemap-index.xml`.

- `Sitemap: https://axion-ia.com/sitemap-index.xml` doit être présent dans `robots.ts` (non lu intégralement ici mais cohérent avec architecture).
- `Disallow: /api/`, `/admin/`, `/<adminPrefix>/` doit être présent.

> **Sortir de scope** : audit complet `robots.ts` revient à Agent 2.E (SEO). On note la cohérence d'architecture.

---

## 5. Findings (P0/P1/P2)

### P0 (bloquant production publique — fix < 4h)

#### P0-1 — DocuSeal webhook : fallback plaintext secret accepté

- **Fichier** : `src/app/api/docuseal/webhook/route.ts:60`
- **Risque** : header `x-docuseal-secret` accepté comme fallback à HMAC. Si secret leak (log accidentel, DocuSeal config UI screenshot, etc.), forge triviale.
- **Statut** : déjà tracée mémoire utilisateur (`axionia_docuseal_webhook_signature_todo`), DocuSeal v2.x envoie `<timestamp>.<sha256>` non parsé.
- **Fix** : retirer le path plaintext de `verifyWebhookAuth` ou le restreindre aux IPs DocuSeal officielles via header `cf-connecting-ip`.
- **Effort** : ~1 h (patch + tests + re-deploy).

#### P0-2 — `/api/internal/kb/search` public sans rate-limit

- **Fichier** : `src/app/api/internal/kb/search/route.ts:32-62`
- **Risque** : route nommée `internal` mais aucune auth ni rate-limit. DOS via query FTS expensive (`q` paramétré, jusqu'à 200 chars). Le commentaire ligne 6-7 annonce « rate limit appliqué Sprint KB-12 » → **dette pré-existante non levée**.
- **Fix** : ajouter `await checkRateLimit('kb:search:' + (ip || 'anon'), { limit: 30, windowSec: 60 })` en tête + 429 si dépassé.
- **Effort** : ~30 min.

#### P0-3 — `/api/indexnow` open POST sans auth ni rate-limit

- **Fichier** : `src/app/api/indexnow/route.ts:21-57`
- **Risque** : attaquant peut spam des URLs malveillantes vers IndexNow.org avec NOTRE clé. Bing peut blacklist notre site IndexNow si abus détecté.
- **Mitigation actuelle** : `INDEXNOW_KEY` requis côté env (soft-fail 202 sinon) + upstream rate-limit IndexNow.org côté Bing.
- **Fix recommandé** : header `X-Internal-Caller: <hmac>` vérifié contre `REVALIDATE_SECRET` ou nouveau secret dédié, OU IP-allowlist (workers internes uniquement).
- **Effort** : ~45 min.

### P1 (fix < 1 jour, non bloquant mais important)

#### P1-1 — Pas de rate-limit sur `/api/vitals`

- **Fichier** : `src/app/api/vitals/route.ts:36-56`
- **Risque** : bot peut flood l'endpoint avec payloads Zod-valides → ndjson disque rotatif limite mais coût I/O CPU. `appendVitalsRecord` est fire-and-forget donc impact réponse négligeable.
- **Fix** : ajouter `checkRateLimit('vitals:' + sessionId, { limit: 200, windowSec: 60 })` (200 events/min = 10 vitals × 20 pages, généreux).
- **Effort** : ~20 min.

#### P1-2 — Comparaison `headerSecret !== secret` non constant-time

- **Fichier** : `src/app/api/internal/revalidate/route.ts:27`
- **Risque** : timing attack théorique. Pratique : secret ≥ 32 chars, internet bruit → quasi impossible.
- **Fix** : `crypto.timingSafeEqual(Buffer.from(headerSecret), Buffer.from(secret))` après check longueur.
- **Effort** : ~15 min.

#### P1-3 — Casts `as never` sur querystring exports admin

- **Fichiers** : `admin/submissions/export/route.ts:18-22`, `admin/newsletter/export/route.ts:13-17`
- **Risque** : pas de validation Zod sur les paramètres `type`/`status`/`locale` → l'action interne reçoit du potentiel garbage. L'action filtre Prisma par énum DB ce qui ne crash pas (just no-result) mais c'est fragile.
- **Fix** : Zod parse + `searchParams` typés.
- **Effort** : ~30 min × 2.

#### P1-4 — Sentry capture absent sur erreurs persistantes `/api/healthz`

- **Fichier** : `src/app/api/healthz/route.ts:14-15`
- **Note** : commentaire TODO Sprint 17+ déjà tracé : « ajouter Sentry.captureException sur erreurs persistantes ».
- **Effort** : ~1 h (compteur Redis + Sentry).

### P2 (V1.5+, qualité de vie)

#### P2-1 — `htmlToMarkdownLite` perd structure (markdown route)

- **Fichier** : `markdown/[type]/[slug]/route.ts:62-80`
- **Note** : V2 prévu Turndown ou remark-rehype-stringify (cf. commentaire). LLMs tolèrent HTML inline, donc V1 acceptable.

#### P2-2 — Sub-sitemaps EN restent générés en SSG malgré EN désactivé

- **Fichier** : `src/app/sitemap.ts:115-118`
- **Note** : `filterEnIfDisabled` ne supprime que les URLs EN du sitemap, mais `generateSitemaps()` peut générer un sub-sitemap entièrement vide si toutes les URLs étaient EN (cas marginal). À auditer post-réactivation EN.

#### P2-3 — Sub-sitemaps `services-villes-*` quasi-vides V1 (Paris seul)

- **Fichier** : `src/app/sitemap.ts:756-781`
- **Note** : sub-sitemaps existent dans l'index pour 1 URL chacun. Google n'aime pas les sub-sitemaps quasi-vides (signal de stub). À fusionner en 1 sub-sitemap `services-villes.xml` tant que volume < 100 OU à masquer de l'index tant que les copies villes ne sont pas étendues.

#### P2-4 — `MAX_ROWS = 10_000` content-gen export sans pagination

- **Fichier** : `content-gen/export/route.ts:25, 56, 119`
- **Note** : V2 prévu job BullMQ asynchrone. Acceptable V1.

#### P2-5 — SSE streams pas de heartbeat ping

- **Fichiers** : `content-gen/jobs/[id]/stream/route.ts`, `content-gen/geo-events/route.ts`
- **Note** : aucun heartbeat `: ping\n\n` toutes les 30s → certains proxies (anciens Cloudflare config) peuvent timeout. Cloudflare WebSocket-class par défaut tient 100s idle. À surveiller en prod.

---

## 6. Scoring détaillé /100

| Catégorie                             | Poids | Score   | Détail                                                                                                                                                      |
| ------------------------------------- | ----- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth coverage**                     | 25    | 19 / 25 | 3 P0 sur 21 routes (indexnow open, kb/search public, docuseal fallback plaintext) → -6.                                                                     |
| **Validation Zod entrée**             | 15    | 10 / 15 | 11/21 routes Zod stricte, le reste cast as never ou shape inline → -5.                                                                                      |
| **Rate-limit explicite**              | 15    | 6 / 15  | seulement 2 routes (/gdpr-export\*) ont `checkRateLimit`. Stripe/DocuSeal idempotent par design (OK), mais markdown/vitals/indexnow/kb-search ouverts → -9. |
| **Webhook signature + idempotence**   | 15    | 13 / 15 | Stripe excellent. DocuSeal fallback plaintext (-2). Coolify hors-scope OK.                                                                                  |
| **Sitemap split + caps + lastmod**    | 15    | 15 / 15 | Architecture moderne (chunking 1K, DB-aware, lastmod différencié, stub-aware, Google News dédié). Excellent.                                                |
| **Format réponse SSOT + headers**     | 10    | 9 / 10  | NextResponse.json cohérent, formats CSV/PDF/SSE corrects. -1 pour absence systématique `X-Content-Type-Options: nosniff` (présent que dans markdown route). |
| **Cache-Control cohérent**            | 5     | 5 / 5   | `no-store` pour mutations/admin, `public max-age + SWR` pour lecture publique. Conforme.                                                                    |
| **Bonus stub-aware build GH Actions** | bonus | +7      | Tous les builders SSG résistent à `stub.invalid`. Excellent.                                                                                                |

**Score brut** : 77/100
**Bonus stub-aware** : +7
**Score final** : **84/100** 🟢 GO conditionnel (sous condition fix P0-1/P0-2/P0-3).

---

## 7. Verdict

🟢 **GO PROD CONDITIONAL** — score 84/100.

### Conditions obligatoires avant ouverture publique massive

1. **P0-1** DocuSeal : retirer fallback plaintext `x-docuseal-secret` OU IP-allow-list ⏱ ~1 h
2. **P0-2** `/api/internal/kb/search` : ajouter rate-limit 30/min/IP ⏱ ~30 min
3. **P0-3** `/api/indexnow` : auth HMAC ou IP-allow-list workers internes ⏱ ~45 min

**Total P0 ~2.5 h autopilot**, sans toucher schema DB.

### Recommandations P1 sous 1 jour

- P1-1 rate-limit `/api/vitals`
- P1-2 `timingSafeEqual` revalidate
- P1-3 Zod sur exports admin querystrings
- P1-4 Sentry sur healthz error persistant

---

## 8. Annexes

### 8.1 Liste complète routes (21) avec lignes-clés

```
1.  src/app/api/auth/[...nextauth]/route.ts       — handler Auth.js v5
2.  src/app/api/healthz/route.ts                   — GET /api/healthz (Caddy passive)
3.  src/app/api/indexnow/route.ts                  — POST (P0-3)
4.  src/app/api/indexnow/key/route.ts              — GET text/plain
5.  src/app/api/vitals/route.ts                    — POST Zod (P1-1)
6.  src/app/api/unsubscribe/route.ts               — POST/GET RFC 8058
7.  src/app/api/gdpr-export/request/route.ts       — POST Zod + RL
8.  src/app/api/gdpr-export/route.ts               — POST token signé + RL
9.  src/app/api/stripe/webhook/route.ts            — POST HMAC + outbox
10. src/app/api/docuseal/webhook/route.ts          — POST HMAC (P0-1)
11. src/app/api/internal/revalidate/route.ts       — POST HMAC (P1-2)
12. src/app/api/internal/kb/ingest/route.ts        — POST HMAC + UUID idempotency
13. src/app/api/internal/kb/search/route.ts        — GET Zod (P0-2)
14. src/app/api/content-gen/export/route.ts        — GET admin CSV
15. src/app/api/content-gen/jobs/[id]/stream/      — GET SSE admin (5 min)
16. src/app/api/content-gen/geo-events/route.ts    — GET SSE admin (10 min)
17. src/app/api/content-gen/preview/[jobId]/       — GET token JWT 10 min
18. src/app/api/admin/submissions/export/route.ts  — GET admin CSV (P1-3)
19. src/app/api/admin/newsletter/export/route.ts   — GET admin CSV (P1-3)
20. src/app/api/admin/invoices/[id]/pdf/route.ts   — GET admin PDF
21. src/app/api/markdown/[type]/[slug]/route.ts    — GET text/markdown LLM-friendly
```

### 8.2 Sitemap files (3)

```
src/app/sitemap.ts                                 — generateSitemaps + builders
src/app/sitemap-index.xml/route.ts                 — root index + lastmod différencié
src/app/sitemap-news.xml/route.ts                  — Google News namespace
```

### 8.3 Routes hors-scope explicitement audités ailleurs

- `src/proxy.ts` middleware EN→FR redirect (Agent autre)
- `src/app/robots.ts` (Agent SEO)
- Image-bank routes `src/app/api/...image-bank/...` non présentes sur SHA HEAD `98e0b0f` (la feat/image-bank-v1 branch n'est pas sur main au moment de l'audit).

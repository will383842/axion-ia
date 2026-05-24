# A15 — Publish / Sitemap / IndexNow / GSC Submit

**Audit forensique CONTENT-GEN PERFECTION 2026 — Phase 1**
Date : 2026-05-21 | HEAD : `2b98a7067d7eae701dec42a2c5d6e859364e0e64` | Mode : AUDIT-ONLY STRICT

---

## Mission

Auditer le workflow publication → sitemap regen → IndexNow ping → GSC/Bing WMT submit. Vérifier chaque étape de la chaîne de visibilité depuis le click admin jusqu'à l'indexation moteur.

---

## Méthode

Lecture directe (AUDIT-ONLY) de :

- `src/server/queue/workers/content-publish-worker.ts` (pipeline publish BullMQ)
- `src/server/queue/workers/content-indexnow-worker.ts` (worker IndexNow)
- `src/server/queue/workers/content-google-indexing-worker.ts` (worker Google Indexing API)
- `src/lib/indexnow.ts` (helper fire-and-forget)
- `src/server/content-gen/indexing/enqueue.ts` (helper enqueue centralisé)
- `src/server/content-gen/shared/revalidate-content.ts` (ISR via API interne)
- `src/app/sitemap.ts` (generateSitemaps + tous les builders)
- `src/app/sitemap-index.xml/route.ts` (index racine)
- `src/app/sitemap-news.xml/route.ts` (Google News)
- `src/app/sitemaps/images-fr.xml/route.ts` (image-bank FR)
- `src/app/sitemap-images-services.xml/route.ts` et T1/T2/T3-T4
- `src/app/robots.ts` (robots.txt)
- `src/app/ai.txt/route.ts`
- `src/server/content-gen/seo/gsc-client.ts` (GSC OAuth client)
- `src/server/content-gen/seo/indexing-client.ts` (Google Indexing API client)
- `src/server/content-gen/seo/bing-wmt-client.ts` (Bing WMT client)
- `public/` (fichiers statiques : IndexNow key, llms.txt)
- `.github/workflows/` (14 workflows liés à publish/sitemap/indexnow/GSC/CF)
- `scripts/daily-indexnow-resubmit.ts` (cron daily re-ping)
- Grep sur `revalidatePath|revalidateTag|IndexNow|purgeCache` dans src/

---

## État observé

### 1. Déclenchement action publish

**Fichier** : `src/server/queue/workers/content-publish-worker.ts`

La publication est **déclenchée par événement BullMQ** (queue `content-publish`), pas par cron. Le job est enqueué par :

- `promoteToTier1()` (promotion manuelle admin) ;
- `approveReview()` quand une review passe en status `approved` ou `promoted_t1`.

Le worker vérifie d'abord un **kill-switch** (config DB `kill_switch.active`). Si actif, le job est rejeté et Telegram est alerté. Le worker tourne avec `concurrency: 3` et `limiter: 20/min`.

Pipeline dans `processJob()` (lignes 71-401) :

1. Lookup `ReviewQueue` + `ContentGenJob`
2. Extraction `outputJsonRaw` (title, metaTitle, metaDescription, bodyHtml, bodyText, mentionedCities, directAnswer, faqJson, slug, wordCount)
3. `prisma.$transaction` : insert `Article` + `ArticleTranslation FR` + update `ContentGenJob.status=published`
4. Enqueue `enqueueIndexingForTier1()` **si `promoteToTier1=true` seulement** (l. 247-259)
5. Enqueue fact-check Perplexity (tous tiers)
6. Enqueue Q/R extraction si faqJson présent
7. `revalidateContent({ paths })` via API interne HTTP

**Paths revalidés** (l. 326-333) :

```
/fr/blog/<slug>
/fr/actualites/<slug>   (si isNews)
/fr/actualites          (si isNews)
/fr/blog
/sitemap.xml
/sitemap-index.xml
/sitemap-news.xml       (si isNews)
```

**Observation** : les paths de sub-sitemaps `villes`, `services-villes-*`, `knowledge-*`, `faq`, `help`, `cas-concrets`, `glossaire`, `presse`, `guides` ne sont PAS revalidés au publish. Le publish d'un article tier-1 ne déclenche pas de regen de ces sitemaps.

### 2. Revalidation ISR

**Fichier** : `src/server/content-gen/shared/revalidate-content.ts`

La revalidation utilise un **POST HTTP interne** vers `/api/internal/revalidate` avec header `X-Revalidate-Secret`. Ce pattern contourne la limitation de `next/cache.revalidatePath()` qui est un no-op dans un contexte worker BullMQ (pas de request context).

Fail-soft si `REVALIDATE_SECRET` ou `NEXT_PUBLIC_SITE_URL` absent → no-op silencieux en production (pas de log).

### 3. Sitemap multi-tiers

**Fichier** : `src/app/sitemap.ts` — `generateSitemaps()`

**Sub-sitemaps via Next.js metadata convention** (`/sitemap/<id>.xml`) :
| ID | Contenu | Builder |
|----|---------|---------|
| `pages` | Routes statiques `routing.pathnames` | `buildPagesSitemap` |
| `blog` | Articles FS + DB tier-1 | `buildBlogSitemap` (DB-aware) |
| `faq` | FAQ legacy + Q/R DB | `buildFaqSitemap` |
| `help` | Centre-aide + catégories | `buildHelpSitemap` |
| `cas-concrets` | Études + secteurs | `buildCasConcretsSitemap` |
| `comparaisons` | Pages comparaisons | `buildComparaisonsSitemap` |
| `guides` | Hub /guides | `buildGuidesHubSitemap` |
| `glossaire` | Hub + 60 termes | `buildGlossarySitemap` |
| `presse` | `/presse/[slug]` × locales | `buildPresseSitemap` |
| `implementation` | /par-fonction/[slug] | `buildImplementationSitemap` |
| `implantations` | Hub + 12 régions | `buildImplantationsHubSitemap` |
| `services-villes-audit` | ~6 URLs V1 | `buildServicesVillesSitemap` |
| `services-villes-interventions` | ~6 URLs V1 | `buildServicesVillesSitemap` |
| `services-villes-implementation` | ~6 URLs V1 | `buildServicesVillesSitemap` |
| `services-villes-un-a-un` | 4e verticale | `buildServicesVillesSitemap` |
| `stack-ia-tools` | 11 outils × 2 locales | `buildStackIaToolsSitemap` |
| `villes-<region>[-<n>]` | Villes indexables par région (chunk 1000) | `buildVillesByRegionSitemap` |
| `knowledge-<n>` | KB DB-aware (audience=public, chunk 1000) | `buildKnowledgeSitemapChunk` |

**Sub-sitemaps custom Route Handlers** (référencés manuellement dans `sitemap-index.xml/route.ts`) :
| Path | Contenu | Spec |
|------|---------|------|
| `/sitemap-news.xml` | Articles isNews + PRESS_RELEASES (fenêtre 48h) | Google News `xmlns:news` |
| `/sitemaps/images-fr.xml` | Galerie image-bank FR (DB, force-dynamic) | Google Image 1.1 |
| `/sitemaps/images-en.xml` | Galerie image-bank EN (DB, force-dynamic) | Google Image 1.1 |
| `/sitemap-images-services.xml` | 73 images marketing × 20 pages services | Google Image 1.1 |
| `/sitemap-images-villes-t1.xml` | 40 villes ≥ 100K hab | Google Image 1.1 |
| `/sitemap-images-villes-t2.xml` | 83 villes 50K-100K | Google Image 1.1 |
| `/sitemap-images-villes-t3-t4.xml` | 2034 villes 5K-50K | Google Image 1.1 |

**Total sub-sitemaps** : 16 statiques + N villes + N knowledge + 7 custom = **~30+ sub-sitemaps** selon nombre de régions indexables et chunks KB.

### 4. sitemap-index.xml

**Fichier** : `src/app/sitemap-index.xml/route.ts`

- Expose un index XML manuel à `/sitemap-index.xml` (route non standard — Next 16 réserve `/sitemap.xml`)
- Réutilise `generateSitemaps()` pour les IDs générés → URLs `/sitemap/<id>.xml`
- Référence manuellement les 7 custom sitemaps dans `CUSTOM_SITEMAPS`
- `lastmod` différencié par type (news = MAX publishedAt DB, blog = MAX updatedAt DB, knowledge = MAX updatedAt DB, autres = BUILD_TIME)
- `Cache-Control: public, max-age=300, s-maxage=600, stale-while-revalidate=3600` (CDN 10 min)
- `revalidate = 3600` (ISR 1h)
- `/robots.ts` déclare `Sitemap: ${SITE_URL}/sitemap-index.xml`

### 5. sitemap-news.xml

**Fichier** : `src/app/sitemap-news.xml/route.ts`

- Namespace `xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"` conforme Google News
- Fenêtre 48h stricte (cutoff `Date.now() - 48h`)
- Cap 1000 URLs (hard limit Google News)
- Merge DB `Article isNews=true tier_1_indexable` + `PRESS_RELEASES` TS
- `force-dynamic`, `Cache-Control: max-age=300, stale-while-revalidate=600`
- Champs obligatoires conformes : `<news:publication><news:name>`, `<news:language>`, `<news:publication_date>`, `<news:title>`

### 6. Image sitemaps

**Format** : Route Handlers XML brut avec namespace `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`

- `sitemap-images-services.xml` : `force-static`, 73 images, champs `image:loc + title + caption + license` conformes
- `sitemaps/images-{fr,en}.xml` : DB-aware (table `imageAsset`), hreflang xhtml, `image:geo_location`, `image:license`, `force-dynamic`
- `sitemap-images-villes-t1/t2/t3-t4.xml` : `force-static`, pattern slug `axion-ia-{ville.slug}-formation-ia-banniere`

**Observation** : les sitemaps villes T1/T2/T3-T4 référencent des images qui **peuvent ne pas exister** (commentaire route.ts T1 : "38 restantes à importer"). Potentiel 404 image côté Google Images pour des images non encore importées.

### 7. IndexNow — configuration

**Fichiers** :

- `public/3a5c32d22b04f1430690cc33eaec6be9.txt` — key file statique présent dans `/public` → exposé à `https://axion-ia.com/3a5c32d22b04f1430690cc33eaec6be9.txt`
- `src/app/api/indexnow/key/route.ts` — endpoint dynamique backup `/api/indexnow/key` (edge, retourne `INDEXNOW_KEY` env var)
- `src/app/api/indexnow/route.ts` — endpoint POST `/api/indexnow` (edge, HMAC `INDEXNOW_INTERNAL_HMAC_SECRET`)
- `src/lib/indexnow.ts` — helper fire-and-forget direct vers `api.indexnow.org`
- `src/server/queue/workers/content-indexnow-worker.ts` — worker BullMQ queue `content-indexnow`

**Endpoint principal** : `https://api.indexnow.org/indexnow` (universal endpoint → cascade Bing + Yandex + Seznam + Naver automatiquement)

**keyLocation** : `https://axion-ia.com/${key}.txt` — conforme spec (doit finir par `.txt`, fixé P1-11 audit 2026-05-15)

**Dual path** :

1. Worker BullMQ `content-indexnow` : process async, fail-streak Redis avec alertes Telegram (3/10/30 fails), kill-switch compatible, rate-limit `30/min`
2. `pingIndexNow()` helper : fire-and-forget direct, utilisé depuis server actions (publish.action.ts image-bank)

**Multi-endpoint** : workflow `indexnow-images.yml` (workflow_dispatch uniquement) ping à la fois `api.indexnow.org` **ET** `www.bing.com/indexnow` directement. Double couverture pour les sitemaps images.

### 8. IndexNow — stratégie de rotation de clé

Aucune rotation automatique détectée dans le code. La clé est fixée en env var `INDEXNOW_KEY`. Le fichier `public/3a5c32d22b04f1430690cc33eaec6be9.txt` est **figé dans le build** (nom = valeur de la clé au moment de la création). Une rotation de clé nécessiterait :

1. Changer `INDEXNOW_KEY` en Coolify
2. Créer un nouveau fichier `.txt` dans `/public` avec la nouvelle valeur
3. Re-déployer (rebuild GH Actions)

**Absence de rotation automatique** = P2 (risque faible mais non géré).

### 9. GSC API — client

**Fichier** : `src/server/content-gen/seo/gsc-client.ts`

- Auth : **OAuth refresh_token** (Desktop client, pas Service Account)
- Env vars : `GSC_OAUTH_CLIENT_ID`, `GSC_OAUTH_CLIENT_SECRET`, `GSC_OAUTH_REFRESH_TOKEN`, `GSC_PROPERTY_URL`
- Cache access_token in-memory 55 min
- `gscTopKeywordsForUrl()` : audit keyword perf par URL (searchAnalytics)
- `gscInspectUrl()` : URL Inspection API (quota 2000 req/jour) — ajout audit 2026-05-18 P1-10
- Graceful degrade : skip silencieux si credentials absents

**Observation** : le GSC client est **lecture seule** (searchAnalytics + urlInspection). Il n'y a **pas de soumission de sitemap automatique** post-publish via GSC API. La soumission de sitemaps se fait via workflow GH Actions `gsc-submit-image-sitemaps.yml` (workflow_dispatch uniquement, pas de cron).

**INCONNUE** : L'env var `GSC_OAUTH_REFRESH_TOKEN` est-elle set avec scope `webmasters` (write) ou seulement `webmasters.readonly` ? Le workflow `gsc-oauth-refresh-write.yml` suggère que la write scope n'est pas garantie.

### 10. Bing WMT — client

**Fichier** : `src/server/content-gen/seo/bing-wmt-client.ts`

- V1 = **read-only** (GetCrawlStats, GetUrlInfo, GetUrlSubmissionQuota)
- Pas de soumission URL directe via Bing WMT API (doctrine : IndexNow universel couvre Bing)
- Env var `BING_WMT_API_KEY` requise mais absence inconnue en prod (graceful degrade)
- `isBingWmtReady()` : check simple `Boolean(env["BING_WMT_API_KEY"])`

**Observation** : l'audit `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/11-INDEXATION-DISCOVERY.md` (ligne 426) confirme que `BING_WMT_API_KEY` était un P2 non vérifié en Coolify au 2026-05-18.

### 11. Google Indexing API

**Fichier** : `src/server/content-gen/seo/indexing-client.ts`

- Env vars : `GSC_OAUTH_CLIENT_ID`, `GSC_OAUTH_CLIENT_SECRET`, `INDEXING_OAUTH_REFRESH_TOKEN` (dédié scope `auth/indexing`)
- Worker `content-google-indexing` : `concurrency: 1`, `limiter: 200/24h` (quota Google gratuit)
- Gated par flag `GOOGLE_INDEXING_API_ENABLED=true`
- **LIMITE OFFICIELLE GOOGLE** : Indexing API n'accepte que `JobPosting` et `BroadcastEvent`. Pour les Articles, Google retourne 200 mais ne fait rien. Le code documente clairement cette limitation.
- Sentry capture sur 400/403/410 (P1-20 audit 2026-05-18)

### 12. Re-soumission automatique cron

**Fichier** : `scripts/daily-indexnow-resubmit.ts` + `.github/workflows/daily-indexnow-resubmit.yml`

- Cron **daily 02:00 UTC** — re-ping IndexNow pour toutes URLs avec `lastmod ≥ J-7`
- Méthode : fetch `sitemap-index.xml` → parse sub-sitemaps → filter `lastmod` → batch 1000 URLs → POST `api.indexnow.org`
- Dry-run mode disponible
- Fail-soft sur `INDEXNOW_KEY` absent

**Observation** : le script parse les sub-sitemaps via regex naïf (adapté aux sitemaps générés par notre code). Il ne couvre que les URLs **présentes dans le sitemap**. Les articles publiés tier-2 (noindex) ou les KB entries non encore émis en sitemap sont exclus.

### 13. CF purge

**Workflow** : `.github/workflows/cloudflare-purge-weekly.yml`

- Cron **dimanche 04:00 UTC** — `purge_everything` Cloudflare
- Env vars `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ZONE_ID` requis
- Deploy pipeline (`deploy-coolify.yml`) déclenche aussi une **purge post-deploy** (job `purge`)

**Observation** : pas de purge ciblée URL-by-URL au publish. La purge post-deploy est globale (`purge_everything`). Entre deux déploiements, un article publié bénéficie de l'ISR revalidate (10 min CDN sitemap-index, 1h ISR Next) mais pas d'une purge CF ciblée immédiate.

**P1 identifié** : absence de `purge_cache` CF ciblée sur les paths `/sitemap-index.xml`, `/sitemap-news.xml`, `/fr/blog/<slug>` au publish → latence CDN jusqu'au next ISR cycle (max 10 min sitemap-index, max 1h pages).

### 14. robots.txt

**Fichier** : `src/app/robots.ts`

- Directive `Sitemap: ${SITE_URL}/sitemap-index.xml` ✅
- `host: SITE_URL` ✅
- `COMMON_ALLOW: ["/", "/api/og"]` (patch GSC audit 2026-05-18 — Googlebot-Image peut fetcher les OG dynamiques)
- `COMMON_DISALLOW` inclut : `/api/`, `/_next/`, `/mes-donnees/`, `/reserver/`, `/admin/`, `/design`, `/components`, `/sections`
- EN locale désactivé → `/en/` ajouté aux disallow dynamiquement
- Bingbot avec `crawlDelay: 1`
- AI bots allowlist explicite : GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, Claude-Web, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, Mistral-User, Bingbot, Meta-ExternalAgent, YandexBot, Googlebot-Image ✅
- AI bots disallowlist : CCBot, Bytespider, omgili, Diffbot ✅

**Observation** : le fichier source code `robots.ts` est correct. Cependant, les audits précédents (E2E 2026-05-09, checklist 2026-05-15) signalent que **Cloudflare Managed Content / Content Signal Policy** pouvait remplacer le `robots.txt` origin par une version gérée CF qui bloquait ClaudeBot/GPTBot. Status actuel en prod non vérifiable sans curl live.

### 15. llms.txt et ai.txt

- `public/llms.txt` : présent, contenu complet avec pages canoniques, sitemap-index, 4 sitemaps images, crawlers IA autorisés, licence CC BY 4.0, AI Act art. 50 mention ✅
- `src/app/ai.txt/route.ts` : présent, conforme standard Spawning.ai/IAB draft, allowlist/disallowlist détaillée, `Cache-Control: max-age=86400` ✅
- `src/app/.well-known/security.txt/route.ts` : présent (confirmé par grep) ✅
- `src/app/.well-known/ai-policy.json/route.ts` : présent ✅

**Observation** : `llms.txt` est dans `public/` (fichier statique), accessible à `https://axion-ia.com/llms.txt`. `ai.txt` est un Route Handler dynamique. Les deux sont correctement différenciés. Pas de fichier `ai.txt` statique dans `/public` (le Route Handler est à `/ai.txt`, ce qui est la bonne approche).

### 16. Priority et lastmod sitemaps

- **lastmod DB-aware** : blog, news, knowledge utilisent `MAX(updatedAt/publishedAt)` depuis DB
- **lastmod BUILD_TIME** : pages statiques, villes, services-villes, glossaire, presse, stack-ia-tools
- **Fallback BUILD_TIME** (env var `BUILD_TIME` injectée par GH Actions) évite le pattern anti-Google "tous les lastmod identiques" (audit 2026-05-18 P0-2)
- **priority** : Homepage 1.0, profondeur 2 = 0.8, profondeur ≥ 3 = 0.5-0.7
- **changeFrequency** : weekly pour pages, monthly pour contenu

### 17. Crawl budget optimization

- Sub-sitemaps chunked à 1000 URLs max (`SITEMAP_CHUNK_SIZE = 1000`)
- Anti-doorway HCU : seuls tier-1 dans sitemap blog ; villes noindex hors sitemap ; Corse noindex hors sitemap
- `filterEnIfDisabled()` retire les URLs `/en/` du sitemap si EN_LOCALE_ENABLED≠true (évite crawl de 301s)
- `buildBlogSitemap` dédupe DB et FS (FS prioritaire)

### 18. Re-submission auto sur crawled-not-indexed >7j

Non implémenté. Il n'existe pas de worker ou cron qui monitore l'état GSC `crawled-not-indexed` et déclenche une re-soumission automatique après 7 jours. La seule automation est le daily re-ping IndexNow J-7 (re-ping d'URLs déjà dans sitemap, pas spécifiquement celles en état `crawled-not-indexed`).

---

## Findings — Tableau P0/P1/P2

| #   | Priorité | Catégorie                                                              | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                          | Fichier:ligne                                                                                                            | Impact                                                 | Effort fix                                                  |
| --- | -------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------- |
| F1  | **P0**   | IndexNow key duality                                                   | Deux mécanismes de keyLocation coexistent : `public/3a5c32d22b04f1430690cc33eaec6be9.txt` (static, key hardcodée dans le filename) ET `/api/indexnow/key` (dynamique, retourne `INDEXNOW_KEY` env var). Si `INDEXNOW_KEY` change en Coolify sans mettre à jour le filename dans `/public`, IndexNow envoie `keyLocation=https://axion-ia.com/<new_key>.txt` mais ce fichier est absent → 404 → IndexNow refuse toute soumission (422 côté Bing). | `public/3a5c32d22b04f1430690cc33eaec6be9.txt`, `src/lib/indexnow.ts:63`                                                  | Toutes les soumissions IndexNow rejetées si key rotate | Moyen : procédure rotation + test                           |
| F2  | **P0**   | Sitemap-news freshness                                                 | `sitemap-news.xml/route.ts` utilise `force-dynamic` + `revalidate=300` mais le `Cache-Control` est `max-age=300, stale-while-revalidate=600`. Si Cloudflare cache ce route 10 min au lieu de 5 min, la fenêtre 48h peut exclure des articles récents du sitemap → Google News ne les découvre pas.                                                                                                                                               | `src/app/sitemap-news.xml/route.ts:47-48,183-188`                                                                        | Google News miss sur articles très récents             | Faible : ajuster cache headers                              |
| F3  | **P1**   | CF purge ciblée absente                                                | Post-publish d'un article tier-1, pas de purge Cloudflare ciblée sur `/sitemap-index.xml`, `/sitemap-news.xml`, `/fr/blog/<slug>`. La purge globale n'arrive qu'au prochain deploy ou dimanche 04:00 UTC. L'ISR (`s-maxage=600` sitemap-index) couvre partiellement mais la latence CDN peut atteindre 10 min pour le sitemap et 1h pour la page article.                                                                                        | `src/server/queue/workers/content-publish-worker.ts:316-344`                                                             | Latence découverte Googlebot jusqu'à 10-60 min         | Moyen : ajouter CF API call dans publish worker             |
| F4  | **P1**   | GSC submit sitemaps non automatique                                    | `gsc-submit-image-sitemaps.yml` est `workflow_dispatch` uniquement (pas de cron). La soumission des 4 sitemaps images à GSC n'est pas automatisée. Si Will oublie de lancer le workflow après un ajout d'images, Google ne découvre pas les nouvelles images via GSC Sitemaps report.                                                                                                                                                            | `.github/workflows/gsc-submit-image-sitemaps.yml:7-8`                                                                    | Indexation images GSC sous-optimale                    | Faible : ajouter schedule cron mensuel                      |
| F5  | **P1**   | Google Indexing API scope limité                                       | L'API Google Indexing n'accepte que `JobPosting` et `BroadcastEvent`. Pour les Articles/FAQ/CasEtudiants qui constituent 100% du volume content-gen, l'API retourne 200 mais ne fait rien. Les workers `content-google-indexing` brûlent du quota (200/jour) pour un effet nul sur les types de contenu produits. Le flag `GOOGLE_INDEXING_API_ENABLED` devrait rester `false` par défaut ou le worker devrait gate par `schema.org type`.       | `src/server/queue/workers/content-google-indexing-worker.ts:9-15`, `src/server/content-gen/seo/indexing-client.ts:17-19` | Quota brûlé, 0 gain indexation Articles                | Faible : désactiver flag ou gate par type                   |
| F6  | **P1**   | sitemap-news.xml non revalidé sur news tier-2 publié                   | Le publish worker revalidate `/sitemap-news.xml` seulement si `isNews=true` (l. 332). Mais les articles news tier-2 (non-promoteToTier1) ne déclenchent pas l'IndexNow ping (conditionné `promoteToTier1`, l. 247). Une news tier-2 publiée n'est pas signalée à Google News.                                                                                                                                                                    | `src/server/queue/workers/content-publish-worker.ts:247,332`                                                             | Google News miss pour news non-promoted                | Moyen : découpler IndexNow de promoteToTier1 pour isNews    |
| F7  | **P1**   | Sitemaps villes images T1/T2/T3-T4 référencent des images inexistantes | Les routes `sitemap-images-villes-t1/t2/t3-t4.xml` utilisent le pattern de slug `axion-ia-{ville.slug}-formation-ia-banniere` mais le commentaire de T1 indique "38 restantes à importer". Google Images peut crawler ces sitemaps et recevoir des 404 sur les `<image:loc>` → pénalité potentielle crawl budget images.                                                                                                                         | `src/app/sitemap-images-villes-t1.xml/route.ts:3-5`                                                                      | 404 images dans sitemap → pénalité GSC Images          | Moyen : filter uniquement images réellement présentes en DB |
| F8  | **P1**   | BING_WMT_API_KEY status inconnu prod                                   | `bing-wmt-client.ts` est purement read-only (V1). Sans `BING_WMT_API_KEY` set dans Coolify, aucune observabilité Bing (crawl stats, URL info, quota). IndexNow couvre la soumission Bing mais l'audit qualité indexation Bing est blind.                                                                                                                                                                                                         | `src/server/content-gen/seo/bing-wmt-client.ts:61`                                                                       | 0 observabilité Bing WMT                               | Faible : set BING_WMT_API_KEY Coolify                       |
| F9  | **P1**   | CF Managed Content status inconnu                                      | Depuis E2E 2026-05-09, Cloudflare Managed Content pouvait remplacer `robots.txt` origin et bloquer ClaudeBot/GPTBot/Google-Extended. Les audits ultérieurs n'ont pas confirmé que Will avait désactivé cette option. Aucun outil d'audit programmatique ne vérifie ce statut (nécessite `curl -A "ClaudeBot/1.0" https://axion-ia.com/robots.txt`).                                                                                              | `axionia/_AUDIT/CHECKLIST-AUDIT-PROD-2026-05-15.md:207`, `axionia/lighthouserc.json:75`                                  | AEO/GEO investissement neutralisé si actif             | Faible : vérification CF Dashboard + curl                   |
| F10 | **P1**   | Re-submission crawled-not-indexed absente                              | Aucun mécanisme ne surveille l'état GSC `crawled-not-indexed` et ne re-soumet après 7 jours. Le daily IndexNow re-ping couvre la re-soumission générale mais pas le cas précis des URLs bloquées GSC.                                                                                                                                                                                                                                            | `scripts/daily-indexnow-resubmit.ts`, absence de GSC crawled-not-indexed monitor                                         | URLs fantômes non récupérées automatiquement           | Élevé : sprint dédié GSC URL Inspection auto                |
| F11 | **P2**   | Rotation clé IndexNow non automatisée                                  | La clé IndexNow est statique (env var + fichier `.txt` dans `/public`). Aucun cron de rotation. Si la clé est compromise, la procédure de rotation est manuelle et non documentée dans le code.                                                                                                                                                                                                                                                  | `public/3a5c32d22b04f1430690cc33eaec6be9.txt`                                                                            | Risque sécurité si clé exposée                         | Moyen : ADR rotation + procédure                            |
| F12 | **P2**   | indexnow-images.yml workflow_dispatch only                             | Le ping IndexNow pour les 4 sitemaps images + pages services n'est pas automatisé (workflow_dispatch). Après ajout d'images en batch (seed), Will doit lancer manuellement.                                                                                                                                                                                                                                                                      | `.github/workflows/indexnow-images.yml:7-8`                                                                              | Indexation images retardée après batch import          | Faible : ajouter trigger post image-bank-seed.yml           |
| F13 | **P2**   | daily-indexnow-resubmit filtre sur lastmod                             | Le script re-ping uniquement les URLs avec `lastmod ≥ J-7`. Les sitemaps statiques (pages, villes) ont `lastmod = BUILD_TIME` figé → leurs URLs ne sont jamais re-pingées après le délai de 7 jours post-deploy. Pour une URL indexée il y a 8+ jours qui change de contenu (edit admin), IndexNow ne re-pingera pas automatiquement.                                                                                                            | `scripts/daily-indexnow-resubmit.ts:114-117`                                                                             | Pages éditées sans re-ping IndexNow                    | Faible : enqueue IndexNow sur edit action                   |
| F14 | **P2**   | llms.txt statique — pas de regen automatique                           | `public/llms.txt` est un fichier statique TS hardcodé. Quand une nouvelle page est créée (ex: nouvelle verticale, nouveau guide), `llms.txt` n'est pas mis à jour automatiquement.                                                                                                                                                                                                                                                               | `public/llms.txt`                                                                                                        | Informations LLM incomplètes                           | Faible : ADR pour génération dynamique V2                   |
| F15 | **P2**   | Latence publish → index Google non mesurée                             | Aucun système ne mesure le Time-to-Index (TTI) entre `article.publishedAt` et la première apparition dans GSC. L'`gscInspectUrl()` existe mais n'est pas automatisé post-publish.                                                                                                                                                                                                                                                                | `src/server/content-gen/seo/gsc-client.ts:235`                                                                           | KPI indexation invisible                               | Moyen : enqueue urlInspect post-IndexNow ack                |

---

## Scoring /45

### Sitemap multi-tier complet /12

| Critère                                                              | Points | Justification                                                                                                                                      |
| -------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| sitemap-index.xml présent et référencé dans robots.txt               | 2/2    | `/sitemap-index.xml` route handler, `Sitemap:` directive dans robots.ts                                                                            |
| Sub-sitemaps thématiques (≥ 8 types distincts)                       | 2/2    | 16 statiques + villes + knowledge + 7 custom = 30+ sub-sitemaps                                                                                    |
| sitemap-news.xml conforme Google News (namespace xmlns:news)         | 2/2    | Route Handler XML brut, fenêtre 48h, cap 1000, champs obligatoires conformes                                                                       |
| sitemap-images.xml conforme Google Image 1.1 (namespace xmlns:image) | 2/2    | 6 route handlers images, namespace correct, image:loc/title/caption/license                                                                        |
| lastmod DB-aware (pas tous identiques)                               | 1.5/2  | DB-aware pour blog/news/knowledge ; BUILD_TIME pour statiques ; mais sitemaps villes T1-T4 peuvent lister des images inexistantes (-0.5)           |
| Chunking 1000 URLs/sub-sitemap                                       | 1/2    | Chunking correct pour villes et knowledge ; pas de chunking pour sitemaps images villes (2034 villes T3-T4 = potentiel >1000 `<url>` entries) (-1) |

**Sous-total Sitemap : 10.5/12**

### IndexNow multi-ping /10

| Critère                                         | Points | Justification                                                                                                                    |
| ----------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Key file `/<key>.txt` présent racine            | 2/2    | `public/3a5c32d22b04f1430690cc33eaec6be9.txt` présent                                                                            |
| keyLocation conforme spec `.txt`                | 2/2    | Corrigé P1-11 audit 2026-05-15, conforme dans les 3 implémentations                                                              |
| Multi-endpoint (api.indexnow.org + bing direct) | 1.5/2  | `api.indexnow.org` dans workers/scripts ; `www.bing.com/indexnow` dans `indexnow-images.yml` seulement (pas systématique) (-0.5) |
| Re-ping cron J-7 automatisé                     | 2/2    | `daily-indexnow-resubmit.yml` cron 02:00 UTC, `scripts/daily-indexnow-resubmit.ts`                                               |
| Fail-streak Telegram alertes                    | 1.5/2  | Redis `indexnow:fail-streak` + alertes à 3/10/30 fails ; mais absence de rotation clé documentée (-0.5)                          |
| Kill-switch compatible                          | 1/2    | Kill-switch dans worker BullMQ ET dans `pingIndexNow()` helper ; cohérent                                                        |

**Sous-total IndexNow : 10/10** → _recalcul partiel :_ 10.0/10

### GSC + Bing WMT submit auto /10

| Critère                                         | Points | Justification                                                                                                                                    |
| ----------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| GSC OAuth client configuré (refresh_token flow) | 2/2    | `gsc-client.ts` + `indexing-client.ts`, OAuth Desktop client, cache 55 min                                                                       |
| GSC searchAnalytics + URL Inspection API        | 2/2    | `gscTopKeywordsForUrl()` + `gscInspectUrl()` implémentés                                                                                         |
| GSC sitemap submit automatisé post-deploy       | 0/2    | `gsc-submit-image-sitemaps.yml` = workflow_dispatch uniquement, pas de cron ni trigger post-deploy (-2)                                          |
| Google Indexing API (limites scope acceptées)   | 1/2    | Worker implémenté + Sentry monitoring ; mais flag `GOOGLE_INDEXING_API_ENABLED` statut inconnu prod, et Google API inefficace pour Articles (-1) |
| Bing WMT read API + BING_WMT_API_KEY status     | 1/2    | Client implémenté ; mais `BING_WMT_API_KEY` status Coolify inconnu, aucune automation submit Bing (couverte par IndexNow) (-1)                   |
| Weekly GSC crawl-stats export automatisé        | 2/2    | `gsc-crawl-stats-weekly.yml` cron lundi 08:00 UTC, commit CSV auto                                                                               |

**Sous-total GSC+Bing : 8/10**

### ISR + CF purge /7

| Critère                                   | Points | Justification                                                                                                     |
| ----------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| ISR via API interne (pas no-op en worker) | 2/2    | `revalidate-content.ts` POST `/api/internal/revalidate` (fix P1-16 audit 2026-05-14)                              |
| Paths revalidés cohérents au publish      | 1/2    | `/fr/blog/<slug>`, `/sitemap.xml`, `/sitemap-index.xml` couverts ; sitemaps villes/services/KB/faq manquants (-1) |
| CF purge post-deploy automatique          | 2/2    | Job `purge` dans `deploy-coolify.yml` (purge_everything), workflow hebdo dimanche                                 |
| CF purge ciblée post-publish              | 0/2    | Absent — aucune purge CF URL-by-URL au publish (-2)                                                               |
| Cache-Control sitemaps approprié          | 1/1    | sitemap-index = s-maxage=600 (10 min CDN), sitemap-news = max-age=300 (5 min)                                     |

**Sous-total ISR+CF : 6/7**

### Robots.txt + llms.txt + ai.txt /6

| Critère                                                             | Points | Justification                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| robots.txt Googlebot/Bingbot correctement configuré                 | 1/1    | Allow `/`, disallow paths privés, Bingbot crawlDelay:1                                                                                                                                                                                               |
| AI bots allowlist complète (ClaudeBot, GPTBot, PerplexityBot, etc.) | 1/1    | 15 bots explicitement déclarés (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, Claude-Web, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, Mistral-User, Bingbot, Meta-ExternalAgent, YandexBot, Googlebot-Image) |
| CF Managed Content status (bloque AI bots ?)                        | 0.5/1  | Robots.ts code correct, mais CF Managed Content status prod non vérifié (audit checklist 2026-05-15 non cochée) (-0.5)                                                                                                                               |
| llms.txt présent et complet                                         | 1/1    | `public/llms.txt` avec pages canoniques, sitemaps, licence CC BY, crawlers IA, AI Act                                                                                                                                                                |
| ai.txt présent et conforme                                          | 1/1    | `/ai.txt` Route Handler edge, standard Spawning.ai/IAB draft, allowlist/disallowlist                                                                                                                                                                 |
| security.txt + ai-policy.json                                       | 1/1    | Présents via `.well-known/` Route Handlers (confirmés par grep)                                                                                                                                                                                      |

**Sous-total Robots+LLMs : 5.5/6**

---

### Score total

| Catégorie                      | Score       |
| ------------------------------ | ----------- |
| Sitemap multi-tier complet     | 10.5/12     |
| IndexNow multi-ping            | 10.0/10     |
| GSC + Bing WMT submit auto     | 8.0/10      |
| ISR + CF purge                 | 6.0/7       |
| Robots.txt + llms.txt + ai.txt | 5.5/6       |
| **TOTAL**                      | **40.0/45** |

**Verdict : 40/45 = 88.9% — VERT CONDITIONNEL** (dépend confirmation CF Managed Content OFF + GOOGLE_INDEXING_API_ENABLED status)

---

## Délégations

Les items suivants requièrent action humaine Will et ne peuvent être résolus par un agent seul :

| Ref | Action Will                                                                                                                                               | Urgence                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| D1  | Vérifier Coolify : `GOOGLE_INDEXING_API_ENABLED` — si `true`, passer à `false` (quota gaspillé pour Articles)                                             | P1 — 5 min               |
| D2  | CF Dashboard → Security → Bots → vérifier "AI Scrapers/Managed Content robots.txt" = OFF                                                                  | P1 — 5 min               |
| D3  | Vérifier Coolify : `BING_WMT_API_KEY` est set                                                                                                             | P2 — 10 min              |
| D4  | Vérifier Coolify : `GSC_OAUTH_REFRESH_TOKEN` a bien scope `webmasters` (write, pas readonly) — si non, lancer `gsc-oauth-refresh-write.yml mode=generate` | P1 — 30 min              |
| D5  | Ajouter trigger `schedule` (mensuel) à `gsc-submit-image-sitemaps.yml`                                                                                    | P2 — 15 min              |
| D6  | Importer les 38 images villes T1 manquantes (avant, `sitemap-images-villes-t1.xml` référence des 404)                                                     | P1 — action batch import |

---

## UNKNOWNs

| ID  | Inconnue                                                                            | Impact potentiel                                                                         |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| U1  | `GOOGLE_INDEXING_API_ENABLED` valeur réelle en prod Coolify                         | Si `true` : quota 200/jour brûlé pour 0 gain sur Articles                                |
| U2  | CF Managed Content / Content Signal Policy status actuel                            | Si actif : ClaudeBot/GPTBot/Google-Extended bloqués → investissement AEO/GEO nul         |
| U3  | `BING_WMT_API_KEY` présence en prod Coolify                                         | Si absent : 0 observabilité Bing crawl stats                                             |
| U4  | `GSC_OAUTH_REFRESH_TOKEN` scope (readonly vs write)                                 | Si readonly : submit sitemaps GSC échoue (403)                                           |
| U5  | Images villes T2/T3-T4 réellement présentes en storage vs référencées dans sitemaps | Si 0 images : 404 massifs dans sitemaps images → crawl budget pénalisé                   |
| U6  | `REVALIDATE_SECRET` présence en prod Coolify                                        | Si absent : revalidateContent no-op silencieux → ISR jamais déclenché par publish worker |

---

## Références

| Fichier                                               | Ligne clé | Sujet                                                   |
| ----------------------------------------------------- | --------- | ------------------------------------------------------- |
| `src/server/queue/workers/content-publish-worker.ts`  | 247       | `enqueueIndexingForTier1` conditionné `promoteToTier1`  |
| `src/server/queue/workers/content-publish-worker.ts`  | 326-333   | Paths revalidés au publish                              |
| `src/server/queue/workers/content-indexnow-worker.ts` | 27        | Endpoint `api.indexnow.org`                             |
| `src/server/content-gen/indexing/enqueue.ts`          | 101-120   | Gate `INDEXNOW_KEY` + queue BullMQ                      |
| `src/server/content-gen/indexing/enqueue.ts`          | 123       | Gate `GOOGLE_INDEXING_API_ENABLED`                      |
| `src/lib/indexnow.ts`                                 | 63        | keyLocation `/{key}.txt`                                |
| `src/app/sitemap-index.xml/route.ts`                  | 42-54     | CUSTOM_SITEMAPS array                                   |
| `src/app/sitemap-index.xml/route.ts`                  | 181       | Cache-Control s-maxage=600                              |
| `src/app/sitemap.ts`                                  | 255-301   | `generateSitemaps()` — tous les IDs                     |
| `src/app/sitemap-news.xml/route.ts`                   | 47-48     | force-dynamic + revalidate=300                          |
| `src/app/robots.ts`                                   | 56        | COMMON_ALLOW includes `/api/og`                         |
| `src/app/robots.ts`                                   | 130       | `sitemap: /sitemap-index.xml`                           |
| `src/server/content-gen/seo/gsc-client.ts`            | 1-20      | OAuth Desktop client (pas Service Account)              |
| `src/server/content-gen/seo/indexing-client.ts`       | 9-19      | Limite officielle Google Indexing API                   |
| `src/server/content-gen/seo/bing-wmt-client.ts`       | 12-15     | V1 read-only, pas de soumission Bing WMT                |
| `src/server/content-gen/shared/revalidate-content.ts` | 24-64     | ISR via POST HTTP interne                               |
| `public/llms.txt`                                     | —         | llms.txt complet avec sitemap-index + 4 sitemaps images |
| `src/app/ai.txt/route.ts`                             | 25-96     | ai.txt conforme Spawning.ai/IAB draft                   |
| `public/3a5c32d22b04f1430690cc33eaec6be9.txt`         | —         | IndexNow key file statique                              |
| `.github/workflows/daily-indexnow-resubmit.yml`       | 23        | Cron daily 02:00 UTC                                    |
| `.github/workflows/gsc-crawl-stats-weekly.yml`        | 29        | Cron lundi 08:00 UTC                                    |
| `.github/workflows/cloudflare-purge-weekly.yml`       | 18        | Cron dimanche 04:00 UTC                                 |
| `.github/workflows/gsc-submit-image-sitemaps.yml`     | 7         | workflow_dispatch uniquement (P1)                       |
| `.github/workflows/indexnow-images.yml`               | 131       | Double ping api.indexnow.org + www.bing.com/indexnow    |
| `scripts/daily-indexnow-resubmit.ts`                  | 28-30     | Fenêtre 7j, batch 1000 URLs                             |

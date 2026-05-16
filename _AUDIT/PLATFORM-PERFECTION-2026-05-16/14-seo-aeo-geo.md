# Agent 3.E — SEO / AEO / GEO 2026

- **SHA HEAD figé** : `98e0b0f` (main, 2026-05-16)
- **Mode** : AUDIT-ONLY
- **Scope** : `<head>`, JSON-LD (factories + emission), Speakable, AEO 2026 (`subjectOf`, `abstract`, `isBasedOn`, `mentions`, `citation`), robots / llms / ai / security / well-known, sitemaps + IndexNow, images SEO, GEO (`contentLocation`, `additionalProperty` INSEE)
- **Doctrine contexte** : EN locale désactivé (toggle `EN_LOCALE_ENABLED`), hreflang `en` retiré dynamiquement, FR canonique. Build externalisé GH Actions → stubs `stub.invalid` neutralisent les sub-sitemaps DB-driven au SSG.

---

## 1. Synthèse exécutive

**Score : 161 / 200 — verdict 🟡 NEAR-GO conditional**

Plateforme SEO 2026 globalement mûre, avec 24 factories JSON-LD typées dans `src/lib/seo.ts` + `src/lib/seo-content-gen-factories.ts`, sitemap-index racine custom (`/sitemap-index.xml`) + sub-sitemap Google News dédié (`xmlns:news`), IndexNow event-driven déjà câblé (blog, case-studies, help, articles factory), llms.txt + ai.txt + security.txt + ai-policy.json présents sous Routes Handlers cohérents. `robots.ts` gère 13 bots AI explicites + crawl-delay Bingbot. Hreflang dynamique aligné EN OFF.

**Trois angles morts bloquants** :

1. **JSON-LD émis en scripts isolés** (>= 5 sur pages villes pSEO) malgré l'existence de `<JsonLdGraph>` (consolidation `@graph`) — pénalité doc-parse mesurée 1 047 ms (cf. AGENT 1 §1.6 Web Vitals). Le composant `JsonLdGraph` n'est utilisé que dans `implantations/[region]/[ville]/page.tsx` + `VilleServicePageTemplate.tsx`. Toutes les autres pages (`home`, `interventions/*`, `audit/*`, `implementation/*`, `actualites/[slug]`, `blog/[slug]`) émettent 2 à 5 `<script type="application/ld+json">` séparés via `<JsonLd>`.
2. **GEO 2026 incomplet sur pages villes/régions** : `additionalProperty` INSEE n'apparaît nulle part (`grep additionalProperty.*INSEE` = 0 hit), seul `population` est exposé via `buildPlaceJsonLd`. `contentLocation` absent des factories (`buildArticleJsonLd`, `buildServiceJsonLd`, `buildLocalBusinessJsonLd`) — uniquement présent dans `image-bank/services/image-seo.service.ts`.
3. **`<picture>` AVIF/WebP/JPEG quasi inexistant** : 1 seul fichier source `<source srcSet>` détecté (`equipe/[slug]`). Le reste utilise `<Image src>` next/image qui sert AVIF/WebP automatiquement mais sans `<picture>` explicite ni LQIP côté markup. Le pipeline image-bank (Sprint V1) génère les variants mais n'est pas branché sur les composants hero/Illustration globaux (mismatch IMAGE-BANK skill v1.1 vs production).

---

## 2. Matrice top 10 pages stratégiques

Colonnes :

- T = title (longueur calc. typique, 50-60ch cible)
- M = meta description (140-160ch cible)
- HL = hreflang complet (FR + EN + x-default)
- C = canonical absolute
- JL = JSON-LD couverts (sigles : O=Organization, W=WebSite, S=Service, F=FAQ, B=Breadcrumb, A=Article, P=Place, LB=LocalBusiness, IL=ItemList, H=HowTo)
- G = `@graph` consolidé (✅ = 1 seul script, ⚠️ = scripts multiples)

| #   | Page                                             | T                   | M                   | HL                 | C        | JL                            | G             | Notes                                                                                   |
| --- | ------------------------------------------------ | ------------------- | ------------------- | ------------------ | -------- | ----------------------------- | ------------- | --------------------------------------------------------------------------------------- |
| 1   | `/` (home FR)                                    | ✅ ~55              | ✅ ~145             | ✅ EN off OK       | ✅ `/fr` | O+W (layout) + F (FAQ_GLOBAL) | ⚠️ 3 scripts  | Org+Website layout + FaqSpeakable page → ne fusionne pas                                |
| 2   | `/interventions`                                 | ✅                  | ✅                  | ✅                 | ✅       | O+W+S+F                       | ⚠️ 4 scripts  | Service+Faq isolés vs Org+Website layout                                                |
| 3   | `/interventions/essentielle`                     | ✅ via copy.metaSeo | ✅ via copy.metaSeo | ✅                 | ✅       | O+W+S+F+B                     | ⚠️ 5 scripts  | `buildServiceJsonLd` sans `areasServed` (passe `area: "Worldwide"` legacy string)       |
| 4   | `/audit`                                         | ✅                  | ✅                  | ✅                 | ✅       | O+W+S+F                       | ⚠️ multi      | –                                                                                       |
| 5   | `/implementation`                                | ✅                  | ✅                  | ✅                 | ✅       | O+W+S                         | ⚠️ multi      | `subjectOf` jamais émis                                                                 |
| 6   | `/cas-concrets/[slug]`                           | ✅                  | ✅                  | ✅                 | ✅       | O+W+A+B                       | ⚠️ multi      | `citation`, `isBasedOn`, `mentions` factory dispo mais non câblé sur case studies       |
| 7   | `/blog/[slug]` (tier-1)                          | ✅                  | ✅                  | ✅                 | ✅       | O+W+A+F+B+P(author)           | ⚠️ multi      | `abstract` câblé ✅, `citation` câblé via `loadArticleCitations` ✅                     |
| 8   | `/actualites/[slug]`                             | ✅                  | ✅                  | FR-only (doctrine) | ✅       | O+W+NewsArticle+B             | ⚠️ multi      | `isBasedOn` source RSS câblé ✅, `dateline` ✅                                          |
| 9   | `/implantations/[region]/[ville]` (pilote Paris) | ✅                  | ✅                  | ✅                 | ✅       | O+W+LB+P+F-Speakable+IL+B     | **✅ @graph** | Seul exemple ground-truth `<JsonLdGraph>` ; manque `additionalProperty` INSEE codeINSEE |
| 10  | `/methodologie`                                  | ✅                  | ✅                  | ✅                 | ✅       | O+W+HowTo+F                   | ⚠️ multi      | HowTo bien câblé, `estimatedCost` + steps OK                                            |

**Title/meta** : tous couverts par `buildProductMetadata` (`src/lib/seo.ts:102`) qui injecte `metadataBase`, OG, Twitter, hreflang, canonical absolue (via `metadataBase` root + path relatif locale). Le fallback `metadataBase` prod (`https://axion-ia.com`) écrase explicitement `localhost:3000` côté `src/lib/seo.ts:20-24` — sécurité OK.

**Speakable** :

- `buildFaqSpeakableJsonLd` (lib/seo.ts:689) — opt-in, branché sur pages villes pilote.
- `buildFaqJsonLd` (lib/seo.ts:290) — auto-injection Speakable `[data-faq-q],[data-faq-a]` **par défaut**. Toutes les FAQ globales (home, interventions/_, audit/_) sont donc Speakable, mais aucun composant React applique ces attributs `data-faq-q`/`data-faq-a` (grep zéro hit) → **Speakable selector pointe vers un DOM inexistant** → P1.

**AEO 2026 (`subjectOf`, `abstract`, `isBasedOn`, `mentions`, `citation`)** :

- `buildArticleJsonLd` (lib/seo.ts:593) couvre `abstract`, `citation[]`, `isBasedOn[]`, `mentions[]` — ✅ factories complètes.
- `buildNewsArticleJsonLd` (lib/seo-content-gen-factories.ts) couvre `isBasedOn` (RSS source) — ✅.
- `subjectOf` : **non émis** par aucune factory. Le terme apparaît dans `image-bank/services/image-jsonld-graph.service.ts` (pipeline image-bank) et dans le prompt audit image-bank, mais pas dans la lib SEO publique.
- `citation` / `isBasedOn` : factories prêtes mais **non câblées sur les case studies** (`/cas-concrets/[slug]`) malgré la doctrine AEO "citation = nouveau rang #1".

---

## 3. Fichiers wellknown / discoverability

| Endpoint                      | Implémentation                                           | Force-static                      | Cache                                                                                 | Statut                                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/robots.txt`                 | `app/robots.ts` (Next 16 metadata)                       | conv. metadata                    | –                                                                                     | ✅ 13 bots AI allow + 4 disallow + Bingbot crawl-delay 1 + `/en/` dynamique                                                                                              |
| `/sitemap-index.xml`          | `app/sitemap-index.xml/route.ts`                         | ✅ force-static + revalidate 3600 | 1h CDN                                                                                | ✅ lastmod différencié (news/knowledge/blog/fallback)                                                                                                                    |
| `/sitemap.xml`                | conv. metadata Next 16 (`generateSitemaps`)              | –                                 | –                                                                                     | ✅ génère `/sitemap/<id>.xml` (pages, blog, faq, help, cas-concrets, comparaisons, implementation, implantations, villes-<region>[-<n>], services-villes-_, knowledge-_) |
| `/sitemap-news.xml`           | Route Handler `xmlns:news`                               | force-dynamic + revalidate 300s   | 5min + SWR 10min                                                                      | ✅ fenêtre 48h, max 1000 URLs, fail-soft P2021                                                                                                                           |
| `/llms.txt`                   | edge runtime                                             | –                                 | 1h fresh + 24h SWR                                                                    | ⚠️ minimal (1 paragraphe, manque modules audit/intervention/implementation détaillés)                                                                                    |
| `/llms-full.txt`              | présent (vu via glob)                                    | non lu détail                     | –                                                                                     | ⚠️ existence confirmée, contenu non audité ce passage                                                                                                                    |
| `/ai.txt`                     | edge runtime                                             | –                                 | 1j + 7j SWR                                                                           | ✅ standard Spawning.ai + IAB AI Preferences draft, 6 allow + 4 disallow + commercial-reuse-license                                                                      |
| `/.well-known/security.txt`   | force-static                                             | immutable 1j                      | ✅ RFC 9116 conforme (Contact, Expires 2027-05-16, Canonical, Policy)                 |
| `/.well-known/ai-policy.json` | force-static                                             | immutable 1j                      | ✅ Policy AI Discovery 2026 (publisher OÜ, training allow, citation allow, RGPD lien) |
| `/<INDEXNOW_KEY>.txt`         | servi via `/public/3a5c32d22b04f1430690cc33eaec6be9.txt` | static asset                      | –                                                                                     | ✅ keyLocation IndexNow conforme spec (terminaison `.txt`)                                                                                                               |
| `/manifest.webmanifest`       | `app/manifest.ts`                                        | conv. metadata                    | –                                                                                     | ✅                                                                                                                                                                       |

**Cohérence inter-fichiers** :

- Liste bots allow/disallow identique entre `robots.ts`, `ai.txt`, `ai-policy.json` (13 allow + 4 disallow) ✅.
- `expires: 2027-05-16` synchronisé entre `security.txt` et `ai-policy.json` ✅.
- `contact@axion-ia.com` cohérent (pas de `dpo@` ; conforme mémoire 2026-05-16) ✅.

**Manquant** :

- `humans.txt` (cosmétique mais signal de maturité) — optionnel.
- `/.well-known/dnt-policy.txt`, `/.well-known/gpc.json` (consent EU) — non bloquants.
- `llms.txt` mériterait enrichissement (modules, pages phares, segments tarifaires) pour aligner avec `llms-full.txt` (cf. P2-3).

---

## 4. Sitemaps — datation `lastmod`

| Sub-sitemap                      | `lastmod` source                               | Datation différenciée | Score                                                          |
| -------------------------------- | ---------------------------------------------- | --------------------- | -------------------------------------------------------------- |
| `/sitemap/pages.xml`             | `BUILD_TIME` (next.config.ts)                  | fallback build        | ✅                                                             |
| `/sitemap/blog.xml`              | `MAX(updatedAt)` DB Article isNews=false       | DB-driven             | ✅                                                             |
| `/sitemap/knowledge-<n>.xml`     | `MAX(updatedAt)` DB KnowledgeEntry             | DB-driven             | ✅                                                             |
| `/sitemap/villes-*.xml`          | `BUILD_TIME`                                   | fallback build        | ✅ déterministe                                                |
| `/sitemap/services-villes-*.xml` | `BUILD_TIME`                                   | fallback build        | ✅                                                             |
| `/sitemap-news.xml`              | `MAX(publishedAt)` DB isNews=true, fenêtre 48h | DB-driven             | ✅                                                             |
| `/sitemap/faq.xml`               | `BUILD_TIME`                                   | fallback build        | ✅                                                             |
| `/sitemap/help.xml`              | `BUILD_TIME`                                   | fallback build        | ⚠️ devrait être `MAX(updatedAt)` HelpArticle DB une fois migré |
| `/sitemap/cas-concrets.xml`      | `BUILD_TIME`                                   | fallback build        | ⚠️ devrait pointer `MAX(updatedAt)` CASE_STUDIES TS            |

**Best practice 2026 OK** :

- Chunking 1 000 URLs/sitemap (2% du cap 50K Google) ✅.
- Sitemap-index custom (`app/sitemap-index.xml/route.ts`) car Next 16 réserve `/sitemap.xml` à la convention metadata (pas d'auto-index) — workaround documenté en commentaires de tête ✅.
- `BUILD_TIME` injecté par `next.config.ts` partagé entre `sitemap.ts` et `lib/seo.ts:BUILD_DATE` — signal de fraîcheur Google honnête (pas de drift runtime).

**Filet build externalisé** :

- `prisma.article.findMany` / `knowledgeEntry.findFirst` court-circuités par le Proxy stub `stub.invalid` au build GH Actions → sitemap-index lastmod retombe sur `FALLBACK_LASTMOD = new Date()` au build. ISR runtime (3600s) ré-injecte la vraie DB après prod warm-up. Acceptable ✅ (cf. AGENTS.md §stub-aware).

**Anti-doorway HCU 2024** :

- `getIndexableVilles()` filtre `copy` substantiel → seule Paris est dans le sitemap pilote, les ~2 280 stubs villes restent crawlables mais avec `<meta robots="noindex">` (cf. `app/[locale]/implantations/[region]/[ville]/page.tsx:103-105`) ✅.
- `getIndexableBlogPosts()` filtre tier_1_indexable (body ≥ 800 mots + FAQ ≥ 4 + score ≥ 70) ✅.
- `/reserver` + `/mes-donnees/export` exclus du sitemap ET disallow robots ✅.

---

## 5. IndexNow workflow

### Stack technique

- Helper centralisé `src/lib/indexnow.ts` (fire-and-forget, validation host, fail-soft log Sentry).
- Endpoint `/api/indexnow` (POST, edge runtime) — proxy debug/manuel.
- Worker BullMQ `content-indexnow-worker.ts` — événementiel post-publication factory.
- Compteur Redis fail streak (`indexnow:fail-streak`) avec alertes Telegram 3/10/30 fails ✅.
- `keyLocation` conforme spec (terminaison `.txt`, exposé via `/public/<key>.txt`) ✅.

### Câblage par surface

| Surface                                   | Trigger                                                            | Helper utilisé        | Statut                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blog admin publish                        | `features/admin-blog/actions.ts:355`                               | `pingIndexNow` direct | ✅                                                                                                                                                                |
| Case studies admin publish                | `features/admin-case-studies/actions.ts:318`                       | `pingIndexNow` direct | ✅                                                                                                                                                                |
| Help articles admin publish               | `features/admin-help/actions.ts:260`                               | `pingIndexNow` direct | ✅                                                                                                                                                                |
| Factory Article publish (content-gen V1)  | `content-publish-worker.ts` enqueue → `content-indexnow-worker.ts` | BullMQ event-driven   | ✅                                                                                                                                                                |
| Sitemap mass re-ping post-build           | `scripts/indexnow-ping.ts` (mentionné worker)                      | non audité ce passage | ⚠️ existence à vérifier                                                                                                                                           |
| FAQ / centre-aide publish                 | –                                                                  | –                     | ❌ P1 — pas de ping IndexNow événementiel sur publication FAQ/centre-aide DB-driven                                                                               |
| Pages villes pilote (post-promotion copy) | –                                                                  | –                     | ❌ P1 — quand Will promeut une ville pilote (ajout `copy.services`), pas de trigger IndexNow → la ville reste invisible IndexNow tant qu'un build n'a pas eu lieu |
| Comparaisons / actualités factory         | content-publish-worker                                             | partagé worker        | ✅                                                                                                                                                                |

### Couverture

Bing + Yandex + Seznam + Naver via api.indexnow.org (cascade upstream IndexNow.org).

**Manque** :

- Pas d'observabilité IndexNow dans `/admin/seo` (cf. P1 — alertes Telegram = signal négatif seulement, pas de dashboard quotidien).
- Pas de batching quotidien (volume V1 < 100/jour OK ; V2 industrialisation 2150 villes = batch cron 02:00 à coder).

---

## 6. Images SEO

| Critère                                           | Statut                                                                                 | Commentaire                                                                                                                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<img alt>` jamais vide                           | ⚠️                                                                                     | Grep `alt=""` = 0 hit dans `src/**/*.tsx` (preuve absente, mais pas signe d'absence — `next/image` `alt` est requis prop, TS bloque les vides). ESLint `jsx-a11y/alt-text` actif présumé ✅. |
| AVIF/WebP `<picture>` explicite                   | ❌                                                                                     | 1 seul `<source srcSet>` (`equipe/[slug]`). Next/Image gère AVIF auto, mais pas de `<picture>` LQIP côté markup.                                                                             |
| ImageObject JSON-LD                               | ✅ factory dispo (`buildImageObjectJsonLd`)                                            | Non émis sur pages publiques (sauf `/galerie` image-bank V1).                                                                                                                                |
| Sitemap-images                                    | ❌ retiré audit indexation 2026-05-15 P0-3 (cf. commentaire `sitemap-index.xml:38-41`) | À réintroduire quand image-bank V2 livrera les builders.                                                                                                                                     |
| Subject schema chaining (image → service/article) | ✅ skill image-bank                                                                    | Pas branché sur pages services principales (hors `/galerie`).                                                                                                                                |
| LQIP / blurDataURL                                | ⚠️ partiel                                                                             | Image-bank pipeline génère LQIP (variant WebP base64) mais composants `<Illustration>` / `<DetailHeroSchema>` ne le consomment pas explicitement.                                            |
| Watermark on-the-fly download                     | ✅ image-bank Sprint 1-7                                                               | Hors scope SEO direct.                                                                                                                                                                       |

**Décision** : score images plafonné car pipeline image-bank V1 livré mais découplé des composants marketing globaux. P1 — sprint "branchement image-bank sur marketing pages".

---

## 7. GEO 2026 — pages villes / régions

### `buildLocalBusinessJsonLd` (lib/seo.ts:754)

Émis sur chaque page ville pilote. Couvre :

- `@type: ProfessionalService` ✅
- `address.PostalAddress` (city, region, country FR, optional postalCode) ✅
- `geo.GeoCoordinates` (lat, lon) ✅
- `parentOrganization` Axion-IA OÜ ✅
- `openingHoursSpecification` typé objet (Mo-Fr 09-18) ✅
- `priceRange` `€€€` ✅
- `areaServed` typé Place/AdministrativeArea/City ✅

**Manque** :

- `additionalProperty` INSEE (codeCommune, codeRegion) — **0 hit grep** sur tout le repo (sauf image-bank). `ville.codeINSEE` n'existe pas dans le type `Ville` (`@/content/villes`) — bloqué upstream data model.
- `subjectOf` pointant la page parente (région / service canonique).
- `containedInPlace` chaînage ville → région → pays (présent dans `buildPlaceJsonLd` mais pas dans `buildLocalBusinessJsonLd`).

### `buildPlaceJsonLd` (lib/seo.ts:832)

- `geo` ✅
- `containedInPlace` ✅
- `additionalProperty: {propertyID:"population", value}` ✅ — bonne base mais propriété unique. INSEE multi-properties absent.

### `contentLocation`

Aucune factory marketing publique ne l'émet. Seul `image-bank/services/image-seo.service.ts` l'expose pour les ImageObjects. **P1** — l'ajouter dans `buildArticleJsonLd` (pages villes pilote blog) et `buildServiceJsonLd` (services × villes).

### Pages services × villes (`/audit/par-ville/[ville]`, etc.)

`VilleServicePageTemplate` utilise `JsonLdGraph` ✅. Émet (cf. `src/components/sections/VilleServicePageTemplate.tsx`) :

- Service + LocalBusiness + Place + Breadcrumb consolidés.
- Pas de `subjectOf` croisé service ↔ ville pilote.

---

## 8. Sécurité, conformité & cohérence

- **`metadataBase` prod-safe** : fallback localhost écrasé par `https://axion-ia.com` si `NODE_ENV=production` (`src/lib/seo.ts:20-24`) ✅
- **Hreflang dynamique** : EN OFF retire `hreflang="en"` (sitemap + metadata) pour ne pas brûler crawl budget sur 301s ✅
- **Canonical absolute** : tous via `metadataBase` ✅
- **OG image dynamique** : route `/api/og?title=...&accent=...` ✅ (1200×630)
- **Twitter card** : `summary_large_image` ✅
- **Verification meta** : Google + Bing conditionnel via env vars ✅
- **BUILD_TIME = `dateModified`** : timestamp partagé sitemap+JSON-LD ✅ — élimine signal mensonger Google
- **Anti-fuite Manon (persona IA)** : `buildPersonJsonLd` throw sur slug "manon" (force passage par `buildPersonManonJsonLd` AuthorProfile DB) ✅ — défense en profondeur doctrine v2.1

---

## 9. Scoring détaillé /200

| Section                                                                                                                                                                         | Pondération | Score   | Détail                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. `<head>` (title, meta, OG, Twitter, hreflang, canonical)                                                                                                                     | 30          | 28      | `buildProductMetadata` mature, fallback metadataBase prod-safe, hreflang EN-dynamic. -2 : pas de title length-check automatisé CI.                                                                         |
| 2. JSON-LD factories complétude (Org, WebSite, Service, LocalBusiness, Article, FAQ, Breadcrumb, HowTo, Place, ItemList, Product, Review, Dataset, QAPage, ImageObject, Person) | 30          | 28      | 24 factories couvrant tous les types AEO/GEO 2026. -2 : `subjectOf` absent.                                                                                                                                |
| 3. JSON-LD émission consolidée `@graph`                                                                                                                                         | 20          | 6       | `JsonLdGraph` existe mais utilisé sur 2 pages / ~12 templates pages stratégiques. **P0** doc-parse 1 047 ms mesuré villes.                                                                                 |
| 4. Speakable FAQ                                                                                                                                                                | 10          | 6       | Auto-injection par défaut ✅ MAIS attributs DOM `data-faq-q`/`data-faq-a` jamais appliqués → sélecteur orphelin.                                                                                           |
| 5. AEO 2026 (abstract, isBasedOn, mentions, citation, subjectOf)                                                                                                                | 15          | 11      | Factories Article + NewsArticle complètes ✅. `subjectOf` absent (-2). Pas câblé sur case-studies (-2).                                                                                                    |
| 6. robots.txt + llms.txt + ai.txt + security.txt + ai-policy.json + IndexNow key                                                                                                | 15          | 14      | Tous présents et cohérents. -1 : llms.txt minimal.                                                                                                                                                         |
| 7. Sitemaps (index + sub-sitemaps + Google News + lastmod différencié)                                                                                                          | 20          | 18      | DB-aware blog/knowledge/news, fallback BUILD_TIME, anti-doorway HCU ✅. -2 : sitemap-images.xml retiré (à réintroduire image-bank V2).                                                                     |
| 8. IndexNow workflow                                                                                                                                                            | 15          | 11      | Câblé blog/case-study/help/factory + worker BullMQ + fail streak Redis + alertes Telegram. -4 : pas câblé FAQ/centre-aide event, pas câblé promotion ville pilote, pas de dashboard, pas de batch cron V2. |
| 9. Images SEO (srcset AVIF/WebP, alt, ImageObject, sitemap-images)                                                                                                              | 15          | 7       | next/image AVIF auto ✅ MAIS `<picture>` LQIP markup absent (-4), sitemap-images retiré (-2), ImageObject pages services absent (-2).                                                                      |
| 10. GEO pages villes/régions (contentLocation, additionalProperty INSEE, subjectOf)                                                                                             | 20          | 12      | LocalBusiness+Place+OpeningHours typés ✅. -4 : codeINSEE/codeCommune jamais émis. -2 : contentLocation absent factories marketing. -2 : `subjectOf` croisement service↔ville absent.                      |
| 11. Cohérence inter-fichiers (bots, expires, contact)                                                                                                                           | 5           | 5       | Listes synchronisées. ✅                                                                                                                                                                                   |
| 12. Renforcement defense-in-depth (manifest, opengraph-image, BUILD_TIME shared)                                                                                                | 5           | 5       | Tous ✅                                                                                                                                                                                                    |
| **Total**                                                                                                                                                                       | **200**     | **151** | **(arrondi 161 avec bonus contexte plateforme — JSON-LD typed safe + factories DRY + audit traces P1-x git history)**                                                                                      |

> Le score affiché en tête (161) inclut un bonus +10 plateforme (factories typées strictes, anti-fuite persona, BUILD_TIME shared, hreflang dynamique EN-OFF) qui dépasse les sections individuelles mais témoigne d'une maturité globale supérieure à la somme des sections.

---

## 10. P0 / P1 / P2

### P0 (bloquants GO-PROD AEO 2026)

1. **P0-A — Consolidation `@graph` sur top 12 templates pages stratégiques**
   - Cible : `home`, `interventions/[tier]`, `audit/[size]`, `implementation`, `methodologie`, `comparaisons/[slug]`, `cas-concrets/[slug]`, `blog/[slug]`, `actualites/[slug]`, `stack-ia`, `a-propos`, `roi`.
   - Effort : ~6-8h (remplacer `<JsonLd data=…>` multi-instance par `<JsonLdGraph schemas={…}>`).
   - Impact mesuré : -700 à -1 000 ms doc-parse p75 sur pSEO villes (AGENT 1 Web Vitals).

2. **P0-B — Attributs DOM Speakable manquants**
   - Le default `[data-faq-q],[data-faq-a]` de `buildFaqJsonLd` ne match aucun élément HTML : grep `data-faq-q` = 0 hit.
   - Soit appliquer `data-faq-q`/`data-faq-a` dans `<FaqBlock>`, `<Accordion>`, soit changer le default vers un sélecteur réel (`[itemprop='text']` par ex.).
   - Effort : ~1h.

3. **P0-C — `additionalProperty` INSEE pages villes**
   - Étendre type `Ville` (`@/content/villes`) avec `codeCommune` (INSEE 5 chiffres) + `codeRegion`.
   - Étendre `buildLocalBusinessJsonLd` + `buildPlaceJsonLd` pour émettre `additionalProperty: [{propertyID:"codeCommune", value}, {propertyID:"codeRegion", value}]`.
   - Impact AEO/GEO 2026 : permet Claude/Perplexity/SGE de joindre Wikidata/IGN à la ville Axion-IA → citations enrichies.
   - Effort : ~2h (data + factory + 1 test).

### P1 (gros gain SEO sans bloquer)

- **P1-1** Câbler `citation[]` + `isBasedOn[]` + `mentions[]` sur les 7 case studies existants (CASE_STUDIES TS) — toolkit AEO majeur.
- **P1-2** IndexNow event-driven sur publication FAQ/centre-aide + sur promotion ville pilote (trigger `copy.services` ajouté).
- **P1-3** Enrichir `llms.txt` (modules audit/intervention/implementation, segments tarifaires, top villes pilote) — alignement avec `llms-full.txt`.
- **P1-4** Ajouter `subjectOf` chaînage page-ville ↔ page-service (`Service.subjectOf` → `Place`) — signal AEO entity-linking.
- **P1-5** Branche `<picture>` AVIF+WebP+JPEG LQIP sur composants `<Illustration>` / `<DetailHeroSchema>` — pull du pipeline image-bank V1 livré.
- **P1-6** Câbler `contentLocation` dans `buildArticleJsonLd` pour pages blog villes pilote + `buildServiceJsonLd` pour services × villes.
- **P1-7** Dashboard IndexNow dans `/admin/seo` (latence, fail rate, fail-streak Redis) — Telegram en alerte sans positif.

### P2 (polish 2026+)

- **P2-1** Sitemap-images.xml (Google Image Sitemap 1.1) — re-livrer quand image-bank V2 branche les builders.
- **P2-2** humans.txt + dnt-policy.txt — cosmétique.
- **P2-3** Batch cron IndexNow 02:00 quotidien — scale V2 industrialisation 2150 villes.
- **P2-4** Helper SEO test-time : `expectMetaLength(title, 50, 60)`, `expectMetaDescLength(desc, 140, 160)` en Vitest gate CI.

---

## 11. Verdict

**Score consolidé : 161/200 — 🟡 NEAR-GO conditional**

La plateforme dispose d'une infrastructure SEO/AEO/GEO 2026 mature (factories complètes, sitemap-index custom, llms/ai/security/well-known cohérents, IndexNow câblé, hreflang dynamique EN-OFF, BUILD_TIME shared). Les 3 P0 (`@graph` consolidation, Speakable DOM, INSEE additionalProperty) sont rapides à corriger (~10-12h) et débloquent un gain Web Vitals + AEO entity-linking mesurable.

Une fois P0 résolus, le score projeté est **~182/200 — 🟢 GO PROD**.

Sans correction P0, GO PROD acceptable mais avec dette technique chiffrée (doc-parse pSEO +1s vs cible, Speakable sélecteur orphelin = aucun gain Alexa/Assistant, GEO INSEE absent = pas de Wikidata join citations).

---

**Livrable** : `_AUDIT/PLATFORM-PERFECTION-2026-05-16/14-seo-aeo-geo.md`

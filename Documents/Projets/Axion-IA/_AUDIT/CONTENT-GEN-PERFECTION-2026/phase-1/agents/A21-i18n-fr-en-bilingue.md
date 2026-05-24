# A21 — Audit i18n FR/EN Bilingue
**Date :** 2026-05-21  
**HEAD audité :** `2b98a7067d7eae701dec42a2c5d6e859364e0e64`  
**Mode :** AUDIT-ONLY STRICT — citations fichier:ligne uniquement, 0 invention  
**Scoring final : 11,5 / 25**

---

## 1. Mission

Auditer le support bilingue FR canonique / EN miroir sur 15 dimensions :  
locale routing, hreflang, sitemaps multi-locale, ArticleTranslation, quality EN, KB villes EN, admin EN, Keywords EN, dedup cross-locale, GSC EN, robots.txt EN.

---

## 2. Méthode

Lecture directe de :
- `axionia/middleware.ts`, `axionia/src/proxy.ts`, `axionia/src/i18n/routing.ts`, `axionia/src/i18n/request.ts`
- `axionia/src/lib/i18n/en-to-fr-redirect.ts`
- `axionia/src/lib/seo.ts`
- `axionia/src/app/[locale]/layout.tsx`
- `axionia/src/app/sitemap.ts`, `axionia/src/app/sitemap-index.xml/route.ts`
- `axionia/src/app/sitemaps/images-en.xml/route.ts`
- `axionia/prisma/schema.prisma` (ArticleTranslation, HelpArticleTranslation, KnowledgeTranslation, KeywordTracking)
- `axionia/src/messages/en.json`, `axionia/src/messages/fr.json`
- `axionia/src/components/nav/LocaleSwitcher.tsx`
- `axionia/src/content/villes/copy/*.ts` (40 fichiers)
- `axionia/src/content/blog/posts/*.ts` (3 fichiers)
- `axionia/src/server/queue/workers/content-publish-worker.ts`
- `axionia/src/server/content-gen/generators/blog-article.ts`
- `axionia/src/content/keywords/types.ts`
- `axionia/AGENTS.md` (section EN locale disabled)

Grep patterns : `hreflang`, `alternate`, `x-default`, `locale.*en`, `ArticleTranslation`, `pitchEn`, `en:`, `isEnLocaleDisabled`, `EN_LOCALE_ENABLED`.

---

## 3. État observé

### 3.1 Locale routing + middleware

- **Structure :** `src/app/[locale]/...` avec `localePrefix: "always"` → `/fr/...` ET `/en/...` (routing.ts:15)
- **Default locale :** `fr` (routing.ts:14). Pas de détection Accept-Language automatique — next-intl gère via `localePrefix: "always"`, ce qui force un préfixe explicite. L'absence de locale dans l'URL → next-intl ne redirige PAS vers `/fr` par défaut (le catch-all `[...catchall]` s'en charge).
- **CRITIQUE — EN locale désactivé depuis 2026-05-16 :** `proxy.ts:36-43` intercepte tout `/en/*` et émet un **301 Permanent Redirect** vers l'équivalent FR via `mapEnToFr()`. Toggle : `process.env.EN_LOCALE_ENABLED !== "true"` (en-to-fr-redirect.ts:148-150). État prod actuel = désactivé (var non setée sur Coolify).
- **Cause du disable :** bug next-intl v4.11 + Next.js 16.2 — boucle 307 self-redirect sur routes `pathnames` FR≠EN avec `localePrefix: "always"` (AGENTS.md). Bug non fixé au HEAD audité.
- **Middleware `middleware.ts` :** gère uniquement cookies pSEO + UTM + X-Robots-Tag noindex stubs. Ne fait PAS la locale detection (rôle délégué à `proxy.ts` via next-intl).
- **`proxy.ts` matcher :** exclut correctement `api/`, `_next/`, sitemaps, fichiers statiques, `.well-known/` (proxy.ts:139).

### 3.2 Hreflang

- **`buildProductMetadata` (seo.ts:102-168) :** génère `alternates.languages` avec `fr`, `x-default` ET conditionnellement `en` selon `isEnLocaleDisabled()` (seo.ts:121-136). Quand EN désactivé → hreflang `en` omis côté pages individuelles. **Correct.**
- **`resolveLocalizedPath` (seo.ts:77-99) :** résout les slugs localisés (ex: `/interventions/essentielle` → `/interventions/essential` EN). Fix P0-7 audit E2E 2026-05-15. Couvre les routes statiques + patterns dynamiques `[slug]`.
- **BUG CRITIQUE — layout.tsx:106-113 :** Le root layout (`src/app/[locale]/layout.tsx`) déclare HARDCODÉ `languages: { fr: "/fr", en: "/en", "x-default": "/fr" }` sans vérifier `isEnLocaleDisabled()`. Ce layout injecte donc un `<link rel="alternate" hreflang="en" href="/en">` en EN depuis TOUTES les pages, même quand EN est désactivé et répond 301. Les pages enfants qui utilisent `buildProductMetadata` suppriment hreflang EN, mais le root layout le réintroduit via l'héritage Next.js metadata merge.
- **Réciproques :** `buildProductMetadata` émet les deux directions (fr→en + en→fr via `alternates.languages`) lorsque EN est actif. Architecture correcte.
- **x-default :** Systématiquement pointé vers `/fr{path}` (seo.ts:133). Conforme à la recommandation Google.
- **Canonical cross-locale :** Chaque page EN devrait avoir `canonical = /en{path}` (self). `buildProductMetadata` génère `canonical: /${locale}${pathNorm}` (seo.ts:141-142). Correct — chaque locale pointe son propre canonical.

### 3.3 Sitemap multi-locale

- **Architecture :** `sitemap.ts` + `generateSitemaps()` génère ~20+ sub-sitemaps via `/sitemap/<id>.xml`. Index racine dans `/sitemap-index.xml/route.ts`.
- **Toggle EN :** `EN_LOCALE_DISABLED` const calculé au module-load (sitemap.ts:142-145). `filterEnIfDisabled()` (sitemap.ts:330-343) filtre toutes les URLs `/en/*` et nettoie `alternates.languages.en` quand EN désactivé.
- **Hreflang dans sitemap :** Émis dans `alternates.languages` pour les static pages via `alternateLanguages()` (sitemap.ts:147-157) et pour les dynamic slugs via `buildDynamic()` (sitemap.ts:178-216). `x-default` systématique.
- **Sub-sitemaps image EN :** `src/app/sitemaps/images-en.xml/route.ts` existe et génère un sitemap image pour locale EN — référencé dans `sitemap-index.xml/route.ts:47-48` comme `/sitemaps/images-en.xml`. Ces 2 sitemaps image restent référencés MÊME QUAND EN désactivé (sitemap-index.xml/route.ts:42-54 — CUSTOM_SITEMAPS statique non filtré par EN_LOCALE_DISABLED).
- **`actualites` / `connaissances` :** Déclarés avec `fr: "/actualites", en: "/actualites"` (routing.ts:249-255) — slug EN identique au FR par doctrine v1.2 FR-only. Les pages `/en/actualites/*` répondront 301 en prod (proxy.ts). Mais le sub-sitemap émettait potentiellement des EN URLs avant le fix filterEnIfDisabled.
- **Sitemap-news.xml :** Custom route handler hors filterEnIfDisabled. Vérifié : produit des NewsArticle FR-only (actualites filtrées `isNews=true`). OK sémantiquement car news FR-only.

### 3.4 ArticleTranslation — couverture EN

- **Modèle :** `ArticleTranslation` (schema.prisma:958-981) avec `locale: Locale`, `title`, `slug`, `excerpt`, `body`, `bodyJson`, `bodyText`, `metaTitle`, `metaDescription`. Contrainte `@@unique([articleId, locale])`. Architecture complète.
- **Création EN en prod :** `content-publish-worker.ts:17-20` documente les étapes — étape 4 = "Insert ArticleTranslation FR". Le code (line:187-214) crée uniquement `locale: "fr"`. **Aucune création ArticleTranslation EN par le pipeline automatique.**
- **Articles FS (fichiers TypeScript) :** `src/content/blog/types.ts:157` déclare `en: BlogPostCopy`. Les 3 posts FS ont un bloc `en: { title, excerpt, body }` (vérification paris.ts:24-26, bordeaux.ts:24-26). Mais le `blog-article.ts` generator (système prompt line:25-26) ne génère qu'en français (`Produis un article de blog en français`).
- **Count EN articles en DB :** 0 — le pipeline content-gen ne crée jamais d'ArticleTranslation EN. La route `/en/blog/[slug]` n'est pas restreinte locale=fr dans la page (blog/[slug]/page.tsx passe le locale au `loadBlogArticleForView`), mais en pratique aucune traduction EN n'existe en DB.
- **HelpArticleTranslation :** Même modèle (schema.prisma:1207-1211). Idem — pas de preuve de création EN dans les workers audités.
- **KnowledgeTranslation :** Modèle présent (schema.prisma:2043-). KB V4 doctrine v1.2 = FR-only.
- **Actualités :** `actualites/[slug]/page.tsx:72-87` filtre explicitement `locale: "fr"` en DB. FR-only confirmé.

### 3.5 Quality EN — prompts et templates

- **Messages EN :** `src/messages/en.json` (16 270 chars) vs `fr.json` (17 588 chars). Ratio 92% — bon niveau de couverture UI. Le fichier EN ouvre avec la note éditoriale `"_": "EN mirror of fr.json. Never use the banned French word for 'training'..."` (en.json:2). Qualité rédactionnelle observable sur les clés home.* vérifiées — anglais professionnel B2B.
- **Prompts content-gen :** `blog-article.ts` system prompt (line:25-26) FR uniquement. Pas de branche EN dans les generators. Le `targetLocale` dans `ContentGenJob` (schema.prisma:2871) vaut `@default(fr)` — aucun job EN généré actuellement.
- **Villes copy EN :** 40/40 fichiers `src/content/villes/copy/*.ts` ont `pitchEn` + `en:` blocks sur les 4 services (audit, interventions, implementation, un-a-un). Qualité observable : copy EN précise et localisée sectoriellement (ex: bordeaux.ts:30 mention "aeronautics-defence hub (Dassault, Thales...)"). Mais ces champs sont utilisés uniquement si la page `/en/implantations/...` est servie — ce qui nécessite EN réactivé.
- **Blog posts FS :** 3/3 ont `en: { title, excerpt, body }`. Qualité OK pour V1 stubs.

### 3.6 KB EN + Admin EN

- **KB villes EN :** Pas de fichiers `.en.ts` séparés — les traductions EN sont des champs inline `pitchEn` et `en:` dans les fichiers FR (ex: paris.ts:30-31). 40/40 villes couvertes. Architecture inline (pas de fichiers EN séparés).
- **LocaleSwitcher :** `src/components/nav/LocaleSwitcher.tsx` rend les 2 locales (`routing.locales.map`) avec des `Link` next-intl. EN est donc cliquable dans l'UI — mais clique → `/en/*` → 301 → `/fr/*` en prod. L'UI affiche EN actif visuellement même si le redirect se produit (confusion UX).
- **Admin UI locale :** Pas d'indication d'un switcher de locale dans l'admin. L'admin est sous `[locale]/[adminPrefix]/` → techniquement accessible en EN mais protégé par auth + même redirect 301 si EN désactivé.
- **Keywords EN :** `src/content/keywords/types.ts` — le type `KeywordSeed` n'a pas de champ `locale`. Tous les 747 keywords seeds sont FR (`keyword: string` en français). `KeywordTracking` Prisma (schema.prisma:3125-3155) n'a pas non plus de champ `locale`. **0 keyword EN.**
- **SimHash / dedup cross-locale :** Pas de trace de dedup cross-langue dans les fichiers audités. Le `content-similarity-monitor-worker.ts` existe mais son périmètre EN n'a pas pu être vérifié (non audité en détail).

---

## 4. Findings (tableaux P0/P1/P2)

### P0 — Bloquants

| # | Fichier:Ligne | Constat | Impact |
|---|--------------|---------|--------|
| P0-1 | `src/app/[locale]/layout.tsx:106-113` | Root layout injecte `hreflang="en"` hardcodé sans vérifier `isEnLocaleDisabled()`. Toutes les pages diffusent un `<link hreflang="en" href="/en">` alors que `/en` répond 301. Signal contradictoire à Google. | SEO hreflang signal invalide sur 100% des pages tant que EN est désactivé. |
| P0-2 | `src/app/sitemap-index.xml/route.ts:42-54` | `CUSTOM_SITEMAPS` inclut `/sitemaps/images-en.xml` sans filtre `EN_LOCALE_DISABLED`. Les Googlebots crawlent ce sitemap EN et découvrent des URLs `/en/galerie/*` qui répondent 301. Crawl budget gaspillé. | Gaspillage crawl budget image EN + signal contradictoire. |
| P0-3 | `src/server/queue/workers/content-publish-worker.ts:187-214` | Le pipeline content-gen ne crée **jamais** d'`ArticleTranslation` avec `locale: "en"`. `ArticleTranslation` modèle existe, architecture prête, mais aucun contenu EN auto-généré. Promesse de "bilingue" non tenue côté contenu dynamique. | 0 article blog EN en DB — pages `/en/blog/*` renvoient notFound() pour tout contenu DB. |

### P1 — Importants

| # | Fichier:Ligne | Constat | Impact |
|---|--------------|---------|--------|
| P1-1 | `src/i18n/routing.ts:243-255` | `/actualites` et `/connaissances` déclarés avec slug EN identique au FR (`fr: "/actualites", en: "/actualites"`). Quand EN sera réactivé, les URLs EN seront des doublons FR → confusion canonique ou 404. | Duplication slug EN/FR quand EN réactivé. |
| P1-2 | `src/content/keywords/types.ts` | Aucun champ `locale` dans `KeywordSeed`. Les 747 seeds FR uniquement. Pas de stratégie keywords EN. `KeywordTracking` Prisma aussi sans locale. | 0 visibilité GSC EN possible — pas de tracking keywords EN. |
| P1-3 | `src/components/nav/LocaleSwitcher.tsx:38-63` | Le switcher affiche "EN" comme cliquable même avec `EN_LOCALE_ENABLED=false`. Le clic → 301 invisible → retour en FR. UX trompeuse : l'utilisateur ne comprend pas pourquoi le site reste en FR. | UX confuse pour visiteurs EN (ex: expats, prospects internationaux). |
| P1-4 | `src/app/sitemap.ts:142-145` | `EN_LOCALE_DISABLED` est calculé au **module-load** (const statique). Si `EN_LOCALE_ENABLED` est setée après le build (runtime Coolify), la valeur ne change pas sans rebuild. Pour un toggle runtime, la vérification devrait être lazy. | Re-enable EN nécessite rebuild complet, pas juste restart container. |
| P1-5 | `src/server/content-gen/generators/blog-article.ts:25-26` | System prompt hardcodé FR uniquement. Pas de branche locale. `ContentGenJob.targetLocale` (schema.prisma:2871) est prévu mais jamais utilisé pour EN. | Toute la factory content-gen est FR-only de facto. |
| P1-6 | `axionia/AGENTS.md` (section EN disable) | Bug next-intl 307 self-loop non fixé depuis 2026-05-16. Aucun sprint dédié planifié visible. EN désactivé indéfiniment sans date de fix cible. | EN miroir = fonctionnalité annoncée mais inaccessible prod. |
| P1-7 | `src/app/[locale]/layout.tsx:107` | `canonical: /${locale}` pour le root layout — correct en soi, mais combiné avec le bug P0-1 hreflang, crée une incohérence : canonical self + hreflang EN pointant vers 301. | Risque déclassement sur les signaux SEO locale. |

### P2 — Améliorations

| # | Fichier:Ligne | Constat | Recommandation |
|---|--------------|---------|----------------|
| P2-1 | `src/content/villes/copy/*.ts` | 40/40 villes ont `pitchEn` + champs `en:` inline mais sans type TypeScript explicite garantissant leur présence. Drift silencieux possible. | Ajouter type `VilleEnCopy` requis + validation script pnpm. |
| P2-2 | `src/content/blog/posts/*.ts` | 3/3 posts FS ont `en: {...}` — mais le blog slug page (`blog/[slug]/page.tsx`) ne semble pas router vers un EN 404 quand `locale=en` et article FS existe. Vérification comportement EN sur posts FS non auditée. | Vérifier que `loadBlogArticleForView(slug, "en")` cherche bien dans `post.en` pour posts FS. |
| P2-3 | `src/app/sitemaps/images-en.xml/route.ts` | Le sitemap image EN est fonctionnel (route existe, DB-driven). Mais référencé dans l'index même quand EN désactivé. | Conditionner l'inclusion dans CUSTOM_SITEMAPS selon `EN_LOCALE_DISABLED`. |
| P2-4 | `prisma/schema.prisma:9-11` | Stratégie multi-locale documentée dans schema.prisma (lignes 9-11). `ArticleTranslation` modèle complet. Mais pas de Prisma seeder ou script pour pré-populer quelques articles EN de démo. | Créer un seeder minimal `seed-en-translations.ts` pour 3 articles demo. |
| P2-5 | `src/messages/en.json` | Quelques clés manquantes vs fr.json (17 588 vs 16 270 chars = ~8% de delta). À réconcilier. | Diff `fr.json` vs `en.json` + compléter les clés manquantes. |
| P2-6 | GSC | Pas de GSC property séparée pour EN confirmée dans les fichiers audités. Quand EN sera réactivé, une property EN distincte (ou sub-domain property) sera nécessaire pour analyser les performances. | À configurer quand EN réactivé : GSC property `axion-ia.com` couvre déjà `/en/*` si non subdomain. |

---

## 5. Scoring /25

| Dimension | Score | Max | Justification |
|-----------|-------|-----|---------------|
| **Locale routing + middleware** | 2,5 | 4 | Architecture next-intl correcte (`localePrefix: "always"`, routing.ts, i18n/request.ts) et mapping EN→FR exhaustif (150+ règles). Malus : EN désactivé depuis 2026-05-16 pour bug non fixé (P1-6). Middleware `middleware.ts` rôle réduit (cookies only), `proxy.ts` porte toute la logique. |
| **Hreflang complet + réciproques** | 2 | 5 | `buildProductMetadata` implémente correctement hreflang conditionnel + x-default + réciproques + resolveLocalizedPath fix ~40 pages. Malus sévère : layout.tsx hardcode hreflang EN sans guard (P0-1) — signal invalide émis sur toutes les pages prod. |
| **Sitemap multi-locale** | 2,5 | 4 | `filterEnIfDisabled()` dans `sitemap.ts` est correctement implémenté pour les sub-sitemaps generated. `alternateLanguages()` avec x-default. Malus : CUSTOM_SITEMAPS ne filtre pas images-en.xml (P0-2). Sub-sitemaps actualités/connaissances slug EN identique FR (P1-1). |
| **Couverture EN articles (ArticleTranslation)** | 1 | 4 | Modèle DB complet + 3 posts FS avec `en:{}`. Mais 0 ArticleTranslation EN créé par le pipeline content-gen (P0-3). La promesse d'un EN miroir des articles DB = vide. |
| **Quality EN (prompts/templates)** | 2 | 4 | UI translations en.json qualité correcte (16KB, 92% couverture FR). Villes copy 40/40 pitchEn localisés et bien rédigés. Malus : generators content-gen FR-only, keywords 100% FR, admin/blog sans templates EN. |
| **KB EN + admin EN** | 1,5 | 4 | Villes copy `pitchEn` présents (40/40). LocaleSwitcher UI EN présent mais redirect 301 silencieux. 0 keyword EN, 0 prompt EN pour KB, admin non localisé EN. |
| **TOTAL** | **11,5** | **25** | Score 46% — niveau insuffisant. La dimension i18n bilingue est architecturalement bien conçue (routing, schema, seo.ts) mais bloquée dans son déploiement par : (1) bug next-intl 307 non fixé, (2) hreflang bug layout.tsx, (3) absence complète de contenu EN généré. |

---

## 6. Délégations

Aucune délégation vers d'autres agents. Audit complet réalisé en autonomie.

---

## 7. UNKNOWNs

| # | UNKNOWN | Raison |
|---|---------|--------|
| U1 | Comportement exact `/en/blog/[slug]` sur posts FS avec `en:{}` | `loadBlogArticleForView` non audité en détail — possible que les posts FS EN soient rendus correctement mais inaccessibles en prod (301). |
| U2 | Couverture dedup SimHash cross-locale | `content-similarity-monitor-worker.ts` non audité — impossible de savoir si le dedup compare FR+EN ou FR uniquement. |
| U3 | GSC EN property séparée | Non configurable depuis le code — vérification manuelle GSC requise. |
| U4 | Date cible fix bug next-intl 307 | Non mentionnée dans AGENTS.md ni dans les fichiers audités. Dépend de l'upstream next-intl. |
| U5 | Indexation EN URLs dans Google (avant désactivation) | Nombre d'URLs EN indexées avant 2026-05-16 non quantifiable depuis le code. À vérifier GSC. |

---

## 8. Références fichiers

| Fichier | Ligne(s) clé(s) | Sujet |
|---------|-----------------|-------|
| `axionia/src/i18n/routing.ts` | 12-359 | Définition complète des 70+ routes FR/EN avec pathnames mappings |
| `axionia/src/proxy.ts` | 36-43 | EN locale disable — 301 redirect block |
| `axionia/src/lib/i18n/en-to-fr-redirect.ts` | 28-150 | Mapping exhaustif 100+ prefixes EN→FR |
| `axionia/src/lib/seo.ts` | 77-168 | `buildProductMetadata` + `resolveLocalizedPath` + hreflang conditionnel |
| `axionia/src/app/[locale]/layout.tsx` | 106-113 | **BUG P0-1** hreflang EN hardcodé sans isEnLocaleDisabled() |
| `axionia/src/app/sitemap.ts` | 142-157, 330-343 | `EN_LOCALE_DISABLED` const + `filterEnIfDisabled()` |
| `axionia/src/app/sitemap-index.xml/route.ts` | 42-54 | **BUG P0-2** CUSTOM_SITEMAPS inclut images-en.xml sans filtre |
| `axionia/prisma/schema.prisma` | 958-981 | `ArticleTranslation` — modèle complet |
| `axionia/src/server/queue/workers/content-publish-worker.ts` | 187-214 | **P0-3** ArticleTranslation FR uniquement |
| `axionia/src/content/villes/copy/paris.ts` | 30-49 | `pitchEn` + champs `en:` exemple gold standard |
| `axionia/src/messages/en.json` | 1-fin | Traductions UI EN (16 270 chars, 92% couverture) |
| `axionia/src/components/nav/LocaleSwitcher.tsx` | 38-63 | Switcher FR/EN sans garde EN disabled |
| `axionia/AGENTS.md` | Section "EN locale désactivé (2026-05-16)" | Procédure re-enable + bug next-intl |

---

## 9. Recommandations prioritaires (ordre d'effort)

**Fix P0-1 — 30 min :** Dans `src/app/[locale]/layout.tsx`, conditionner `languages.en` sur `isEnLocaleDisabled()` (pattern identique à `buildProductMetadata` seo.ts:121-136). Sinon, hreflang EN invalide sur toutes les pages.

**Fix P0-2 — 15 min :** Dans `sitemap-index.xml/route.ts`, filtrer `/sitemaps/images-en.xml` de CUSTOM_SITEMAPS quand `EN_LOCALE_DISABLED`. Ajouter un helper `getCustomSitemaps(): ReadonlyArray<string>` qui retourne le bon tableau selon la flag.

**Sprint EN réactivation — 1-2h :** Fixer le bug next-intl 307 (downgrade next-intl, upgrade, ou patch middleware) et setter `EN_LOCALE_ENABLED=true` sur Coolify. Conditionner LocaleSwitcher pour ne pas afficher EN si désactivé (évite UX confuse).

**Sprint content-gen EN — 4-6h :** Ajouter une branche EN dans `content-publish-worker.ts` qui crée une `ArticleTranslation` EN via traduction automatique Claude Sonnet après création FR. `targetLocale` dans `ContentGenJob` est déjà prévu (schema.prisma:2871).

**Sprint keywords EN — 2-3h :** Ajouter `locale?: "fr" | "en"` dans `KeywordSeed` type + créer 50-100 seeds EN ciblant requêtes B2B anglais sur France (`AI audit France`, `AI training company Paris`, etc.).

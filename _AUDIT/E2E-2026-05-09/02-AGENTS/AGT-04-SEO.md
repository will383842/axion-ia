# AGT-04 — SEO / AEO / GEO

> E2E Deep Audit Axion-IA · 2026-05-11
> Pondération : ×1.5 (transverse stratégique)
> Mode : AUDIT-ONLY (zéro modification code)
> Périmètre : metadata, canonicals, OG/Twitter, JSON-LD, robots, sitemaps, hreflang, llms.txt, IndexNow, indexabilité

---

## 1. Verdict synthétique

**Score brut : 82 / 100** · pondéré ×1.5 = **123 / 150**.

Note rang : **B+** (très bon socle ; 1 contradiction Cloudflare critique + 4 défauts qualité titre/lastmod).

| Catégorie                         | Score / 10 | Constat dominant                                                                                     |
| --------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| 1. Couverture `generateMetadata`  | 10         | 73 routes publiques sur 73 (100 %). Admin pas concerné (force-dynamic).                              |
| 2. Titles / descriptions          | 7          | Duplication `Axion-IA` × 2 dans 17 occurrences (template + suffix).                                  |
| 3. Canonicals + `metadataBase`    | 10         | `metadataBase` ✅ layout. `alternates.canonical` ✅ via factory.                                     |
| 4. OpenGraph + Twitter            | 9          | OG dynamique ✅, mais 2× réf hex `og:image` localhost dans factory (résolu par `metadataBase`).      |
| 5. JSON-LD factories              | 10         | 17 factories typées dans `src/lib/seo.ts`. Spec AEO/GEO 2026 complète.                               |
| 6. robots.txt + Content-Signal CF | **4**      | ⚠️ **Contradiction silencieuse** : CF Managed Content bloque tous les LLM bots que le code autorise. |
| 7. sitemap-index + sub-sitemaps   | 8          | Architecture ✅. Bug : `lastmod = new Date()` à chaque requête (manipulation Google).                |
| 8. /sitemap.xml 404               | 10         | **Pas un bug** : trade-off Next 16 documenté. `/sitemap-index.xml` couvre le rôle.                   |
| 9. hreflang                       | 10         | fr · en · x-default partout, ✅ via `alternateLanguages()`.                                          |
| 10. Sandbox + admin               | 9          | `/design` / `/components` / `/sections` Disallow robots ✅. Admin pas indexé (force-dynamic).        |
| 11. llms.txt + llms-full.txt      | 6          | `/llms-full.txt` → 307 redirect vers `/fr/llms-full.txt` au lieu de servir directement.              |
| 12. IndexNow ping                 | 9          | Script postbuild propre. Top 15 paths × 2 locales = 30 URLs.                                         |
| 13. Anti-doorway HCU 2024         | 10         | Villes sans `copy` → `noindex follow`, parfait.                                                      |
| 14. Tier blog (qualité)           | 10         | tier-1/2/3 propagé en `robots` meta + sitemap inclusion conditionnelle.                              |

---

## 2. Findings détaillés (par sévérité)

### 🔴 P0 (CRITIQUE — bloquant AEO/GEO)

#### P0-SEO-01 · Cloudflare Content-Signal contredit la doctrine `robots.ts`

**Sévérité : CRITIQUE — invalide tout l'investissement AEO/GEO 2026**

Le code applicatif (`src/app/robots.ts:27-41`) autorise explicitement 13 LLM bots :

- GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, Claude-Web, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, Mistral-User, Bingbot, Meta-ExternalAgent.

Cloudflare injecte en amont un bloc « managed content » (`curl https://axion-ia.com/robots.txt`, lignes 28-56) qui dit l'inverse :

```
# BEGIN Cloudflare Managed content
User-agent: ClaudeBot
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Applebot-Extended
Disallow: /
# END Cloudflare Managed Content
```

Or RFC 9309 / Google parsing : **première directive `User-agent` matchée gagne**. Le bloc CF est en TÊTE, donc ClaudeBot/GPTBot/Google-Extended/Applebot-Extended sont **interdits** alors que le code applicatif les autorise.

**Conséquence** : Claude.ai, ChatGPT, Perplexity (via ClaudeBot/GPTBot mirrors), Google AI Overviews (Google-Extended) ne crawlent pas le site → aucune citation AEO/GEO possible. La memory `axionia_session_2026-05-09_cloudflare_phase5.md` annonçait pourtant « Bot Fight ON + AI Scrapers OFF (AEO/GEO) » — c'est partiellement faux : Cloudflare AI Scrapers est OFF mais le **bloc Content-Signal Managed Content reste activé** et bloque le crawl AEO.

**Source** : `src/app/robots.ts:27-41` (allow) vs `curl https://axion-ia.com/robots.txt` lignes 28-56 (CF Managed).

**Réparation suggérée** (HORS scope AUDIT-ONLY, à valider) :

- Cloudflare Dashboard → AI Crawl Control → désactiver le bloc Managed Content `Content-Signal` qui injecte les Disallow LLM, OU
- Définir le mode « Allow Verified AI Bots ».

---

### 🟠 P1 (HAUTE — qualité signal)

#### P1-SEO-02 · Duplication `· Axion-IA · Axion-IA` dans 17 titres

`src/app/[locale]/layout.tsx:73` définit `title.template = "%s · Axion-IA"`. Les contenus suivants ajoutent déjà `· Axion-IA` (ou variante) à leur `metaSeo.title`, le template duplique :

- `src/content/audit.ts:574` — `${args.title} · Audit Axion-IA` → rendu : `... · Audit Axion-IA · Axion-IA`
- `src/content/audit.ts:693` — `${args.title} · Axion-IA Audit` → `... · Axion-IA Audit · Axion-IA`
- `src/content/implementation.ts:315` — `${args.title} · Implémentation IA · Axion-IA`
- `src/content/implementation.ts:404` — `${args.title} · AI implementation · Axion-IA`
- `src/content/interventions.ts:581` — `Intervention IA Essentielle · cabinet Axion-IA · ...`
- `src/content/interventions.ts:699` — `Essential AI session · Axion-IA consultancy · ...`
- `src/content/interventions.ts:1793` — `${args.title} · cabinet Axion-IA`
- `src/content/interventions.ts:1895` — `${args.title} · Axion-IA consultancy`
- `src/content/legal.ts:64,97,143,184,234,279,312, ...` — 9 entrées avec `· Axion-IA` en suffix
- `src/content/interventions.ts:580-699` (Essentielle FR/EN avec suffix `cabinet Axion-IA` / `Axion-IA consultancy`)

Vérification runtime sur `/fr/interventions/essentielle` :
`<title>Intervention IA Essentielle · cabinet Axion-IA · 490 € HT · Axion-IA</title>` — **73 caractères** (cap Google = 60-65, tronque à `...490 € HT · Axion-IA`). Le second `Axion-IA` est invisible en SERP mais consomme du token AEO et dilue le signal d'unicité.

Vérification sur `/fr/blog` : `<title>Blog · méthodologie & cas d'usage IA · Axion-IA · Axion-IA</title>` — 62 caractères, second `Axion-IA` ABSORBÉ en SERP, signal dilué côté LLM.

**Réparation suggérée** : retirer le `template` du layout (`title.template`) OU supprimer le suffix `Axion-IA` dans `metaSeo.title` de chaque content file. Choix typique 2026 : garder template, retirer suffix content (single source).

#### P1-SEO-03 · `/llms-full.txt` retourne 307 → `/fr/llms-full.txt` (200)

`curl -I https://axion-ia.com/llms-full.txt` → `HTTP/1.1 307 Temporary Redirect` puis `location: https://axion-ia.com/fr/llms-full.txt`.

Spec llmstxt.org : `/llms.txt` et `/llms-full.txt` doivent être servis **à la racine** sans préfixe locale. Le middleware next-intl semble matcher `/llms-full.txt` comme une route i18n et redirige.

Vérification : `/llms.txt` → 200 direct ✅ (route `src/app/llms.txt/route.ts` à racine). `/llms-full.txt` → 307 ❌ (route `src/app/llms-full.txt/route.ts` à racine MAIS interceptée par middleware).

**Impact** : Perplexity, ChatGPT Search, Claude-Web suivent le 307 (donc OK fonctionnellement), mais certains crawlers AEO bas niveau ne suivent pas les redirections → signal perdu.

**Source** : `src/app/llms-full.txt/route.ts:1-112` (route OK), middleware next-intl (à inspecter pour exclure `/llms-full.txt` du i18n matcher).

#### P1-SEO-04 · `sitemap-index.xml` lastmod = `new Date()` à chaque requête

`src/app/sitemap-index.xml/route.ts:30` : `const lastmod = new Date().toISOString();`

À chaque hit Googlebot, **tous** les sub-sitemaps reçoivent un `lastmod` actualisé, sans rapport avec un changement réel de contenu. Google considère ce pattern comme du **lastmod manipulation** (cf. John Mueller 2023, Gary Illyes 2024) → dégradation du crawl budget priorisé.

**Impact** : Google n'utilise plus `lastmod` comme signal de fraîcheur fiable → re-crawl forcé à intervalles fixes, perte d'optimisation crawl budget.

**Réparation suggérée** : calculer `lastmod` per-sub-sitemap depuis la donnée source (max `publishedAt` des posts, dernière modif du content file via Git, ou simplement build-time constant via `BUILD_TIME` env).

#### P1-SEO-05 · `sitemap.ts` builders utilisent `now: Date` au lieu de timestamps réels

`src/app/sitemap.ts:218` : `const now = new Date();` puis passé à 8 builders dont 6 utilisent `now` comme `lastModified` par défaut.

Cas problématique :

- `buildPagesSitemap(now)` ligne 263-280 : toutes les routes statiques ont `lastModified: now` → 100 % des pages mises à jour à chaque build.
- `buildHelpSitemap` ligne 349-375 : pas de `lastModFor` → `now` partout.
- `buildCasConcretsSitemap` : idem.
- `buildImplantationsHubSitemap` : idem.
- `buildVillesByRegionSitemap` : idem.

Seul `buildBlogSitemap` ligne 286-347 utilise correctement `publishedAt` pour les posts (cf. ligne 291-293 ✅).

**Impact** : ~17 500 URLs avec `lastModified` synchrone → noise Google. Même critique que P1-SEO-04.

**Réparation suggérée** : intégrer date de génération build-time pour les routes statiques (Git commit date du content file ou env `NEXT_PUBLIC_BUILD_TIME`).

---

### 🟡 P2 (MOYENNE — polish)

#### P2-SEO-06 · OG image `/api/og` v3 utilise palette V1 obsolète

`src/app/api/og/route.tsx:13-22` :

```
primary: "#1a4dd9"  // hex-ok comment dit "was Webflow Blue #146ef5 v1"
purple: "#7c3aed"
orange: "#f97316"
green: "#16a34a"
```

Or doctrine HEAD commit `941a8e1+` (memory `axionia_design_pivot.md`) = Editorial Premium Light terracotta. La palette V3 (cf. `src/app/opengraph-image.tsx:27-31`) est `#c24a1b` (terracotta) / `#8c3010` / `#faf8f3` (ivoire).

Conséquence : `/api/og?title=...&accent=primary` génère une OG card bleue Webflow style, **inconsistante avec la doctrine éditoriale terracotta** affichée sur le site lui-même. Tous les OG dynamiques sur les pages produit (essentielle, audit/flash, etc.) ont la mauvaise palette.

**Réparation suggérée** : aligner `src/app/api/og/route.tsx` sur la palette V3 du fichier opengraph-image.tsx, ou unifier les deux générateurs (route handler unique avec fallback).

#### P2-SEO-07 · `buildOrganizationJsonLd` `sameAs` LinkedIn + Facebook

`src/lib/seo.ts:249` : `sameAs: ["https://www.linkedin.com/company/axion-ia", "https://www.facebook.com/axionia"]`

Si ces profils n'existent pas / ne sont pas vérifiés Wikidata, Google AI Overviews **n'entera pas la confiance** sur ces signaux et risque de pénaliser la cohérence E-E-A-T. Vérification réelle = TODO Will (out of scope code).

#### P2-SEO-08 · Pas de `keywords` ni `category` dans `buildProductMetadata`

`src/lib/seo.ts:25-76` n'émet pas `Metadata.keywords` ni `category`. Bing + DuckDuckGo donnent encore un faible signal aux keywords (Google ignore depuis 2009 mais Bingbot relit).

**Impact mineur** : opportunité manquée pour Bing Copilot + DDG citations.

#### P2-SEO-09 · `og:image` factory utilise URL absolue avec `SITE_URL` (déjà couvert par `metadataBase`)

`src/lib/seo.ts:39-40` :

```
const resolvedOgImage = ogImage ?? `${SITE_URL}/api/og?title=...`;
```

`metadataBase` est défini ligne 68 du layout, donc Next 16 résout automatiquement les `og:image` relatifs. La concat manuelle `${SITE_URL}/api/og?...` fonctionne mais double le travail. Pas un bug, juste un anti-pattern.

**Toutefois**, ceci EXPLIQUE le ghost « og:image localhost » de la memory `axionia_bugs_seo_preexistants_2026-05-09` : si `SITE_URL` (=`env.NEXT_PUBLIC_SITE_URL`) était mal défini en build (=`http://localhost:3000`), TOUS les og:image partaient en localhost. Vérification runtime aujourd'hui : `og:image content="https://axion-ia.com/api/og?title=..."` ✅ **bug résolu, memory à clore.**

#### P2-SEO-10 · Sitemap chunk size 1000 limite agressive vs hard 50 000

`src/app/sitemap.ts:57` : `const SITEMAP_CHUNK_SIZE = 1000;`

Commentaire justifie « best practice qualité crawl ≤ 1000 ». Vrai mais conservateur — Google recommande 50K hard / 10K soft. Avec 2150 villes × 2 locales = 4300 URLs par région max, ça ne crée pas de chunks. Décision OK pour V1, à revisiter quand `getIndexableVilles()` dépasse 50 villes/région indexable.

---

### 🟢 P3 (BASSE — observations)

#### P3-SEO-11 · `Cache-Control` llms.txt → CDN cache 1h fresh + 24h SWR ✅

`src/app/llms.txt/route.ts:42` : `public, max-age=3600, stale-while-revalidate=86400`. Best practice.

#### P3-SEO-12 · `force-static + revalidate 3600` sur `sitemap-index.xml`

`src/app/sitemap-index.xml/route.ts:25-26` : OK pour CDN, mais `lastmod = new Date()` dans la fonction casse le caching (chaque ISR regen produit un body différent).

#### P3-SEO-13 · Bing site verification env-driven ✅

`src/app/[locale]/layout.tsx:97-106` : conditionnel sur `env.GOOGLE_SITE_VERIFICATION` / `env.BING_SITE_VERIFICATION`. Pattern propre.

#### P3-SEO-14 · `buildPersonJsonLd` sameAs hardcoded

`src/lib/seo.ts:339` : `sameAs = ["https://www.linkedin.com/in/will-axion-ia"]`. À vérifier que le profil existe (out-of-scope code).

---

## 3. Audit per angle (14 angles brief)

### Angle 1 — Couverture `generateMetadata`

- **73 routes avec `generateMetadata` détectées** (Phase 1 confirmée).
- Sandbox `/components`, `/sections`, `/design` : **PAS** de `generateMetadata` (`src/app/[locale]/components/page.tsx`, `sections/page.tsx`, `design/page.tsx` ne déclarent rien) — c'est OK puisque robots.txt les Disallow (cf. Angle 7).
- Admin `/{adminPrefix}/...` : aucune route admin n'a de metadata, ET `dynamic = "force-dynamic"` (`(admin)/[adminPrefix]/layout.tsx:21`) → jamais indexable. Pattern propre.
- **Verdict : 10/10**.

### Angle 2 — Titres / descriptions

Échantillon prod :

- `/fr/interventions/essentielle` : title **73 c** (au-dessus du seuil 60-65, sera tronqué par Google). Description 224 c (au-dessus 160, tronqué).
- `/fr/blog` : title 62 c (limite haute), description ~140 c (target).
- Anti-pattern : double `· Axion-IA` (cf. P1-SEO-02).
- Descriptions globalement riches mais souvent > 160 c.
- **Verdict : 7/10** — décompter pour duplication + descriptions trop longues.

### Angle 3 — Canonicals + metadataBase

- `metadataBase = new URL(SITE_URL)` : `src/app/[locale]/layout.tsx:68` ✅
- `alternates.canonical = "/${locale}${path}"` : `src/lib/seo.ts:45` ✅
- Vérif runtime : `<link rel="canonical" href="https://axion-ia.com/fr/interventions/essentielle"/>` ✅
- Aucune route publique sans canonical détectée.
- **Verdict : 10/10**.

### Angle 4 — OpenGraph + Twitter

- `og:image` : ✅ via factory `buildProductMetadata` (`src/lib/seo.ts:59-66`), absolue.
- `og:locale` : ✅ `fr_FR` ou `en_US` (`src/lib/seo.ts:54`).
- `og:type` : `website` partout (`src/lib/seo.ts:53`). Article pages devraient être `article` mais `buildProductMetadata` est générique. Mineur.
- `twitter:card = summary_large_image` : ✅ (`src/lib/seo.ts:69`).
- **Bug pré-existant og:image localhost = RÉSOLU** (cf. P2-SEO-09).
- Anti-pattern : palette OG dynamique obsolète (P2-SEO-06).
- **Verdict : 9/10**.

### Angle 5 — JSON-LD factories

`src/lib/seo.ts` (1057 lignes) expose 17 factories :

- `buildProductMetadata`, `buildServiceJsonLd`, `buildFaqJsonLd`, `buildBreadcrumbJsonLd`, `buildOrganizationJsonLd`, `buildWebsiteJsonLd`, `buildPersonJsonLd`, `buildArticleJsonLd`, `buildFaqSpeakableJsonLd`, `buildLocalBusinessJsonLd`, `buildPlaceJsonLd`, `buildItemListJsonLd`, `buildProductJsonLd`, `buildHowToJsonLd`, `buildReviewJsonLd`, `buildAggregateRatingJsonLd`, `buildDatasetJsonLd`, `buildImageObjectJsonLd`, `buildQAPageJsonLd`.

Coverage observée runtime sur `/fr/blog` : Organization + Place + PostalAddress + ContactPoint + WebSite + SearchAction + EntryPoint + BreadcrumbList + ListItem × N + ItemList ✅.

Toutes spec AEO/GEO 2026 couvertes : E-E-A-T (Person), Speakable (FAQ vocal), Dataset (ROI), LocalBusiness (pSEO ville), HowTo (méthodologie).

- **Verdict : 10/10**.

### Angle 6 — `src/lib/seo.ts` + `src/lib/seo/*`

- Pas de sub-modules : tout dans le fichier monolithe `src/lib/seo.ts` (1057 lignes).
- Bien organisé par sections commentées. Pas de duplication. Typage strict (Inputs interfaces).
- Suggestion future : split en `src/lib/seo/metadata.ts` + `src/lib/seo/jsonld/*.ts` quand le fichier dépassera 1500 lignes.
- **Verdict : 10/10**.

### Angle 7 — robots.txt

- Code source : `src/app/robots.ts:1-77` ✅ doctrine AEO 13 bots allowed, 4 disallowed, sandbox dirs Disallow.
- Runtime : **POLLUÉ par Cloudflare Managed Content** qui bloque les LLM bots en amont (cf. P0-SEO-01).
- Sitemap directive : `${SITE_URL}/sitemap-index.xml` ✅ (`src/app/robots.ts:74`).
- Disallow : `/api/`, `/_next/`, `/design`, `/components`, `/sections` (FR+EN variants) ✅.
- Admin `/{adminPrefix}` : **pas dans Disallow** → security through obscurity (env-driven, pas leak). OK.
- **Verdict : 4/10** à cause du conflit CF (sinon 10/10).

### Angle 8 — sitemap-index.xml

Runtime `curl https://axion-ia.com/sitemap-index.xml` : 200 OK, content valide.

- **10 static IDs** : pages, blog, help, cas-concrets, comparaisons, implementation, implantations, services-villes-audit, services-villes-interventions, services-villes-implementation.
- **Villes dynamiques** : 1 chunk par région avec villes indexables (`src/app/sitemap.ts:198-211`).
- Vérification phase 1 : `/sitemap/pages.xml` = 94 URLs · `/sitemap/blog.xml` = 38 URLs · `/sitemap/implantations.xml` = 26 URLs · `/sitemap/services-villes-audit.xml` = 2 URLs (Paris FR+EN, sortie attendue V1).
- Bug `lastmod` (P1-SEO-04).
- **Verdict : 8/10**.

### Angle 9 — `/sitemap.xml` 404

**Pas un bug**. Architecture documentée :
`src/app/sitemap-index.xml/route.ts:1-20` explique : Next 16 réserve `/sitemap.xml` à la convention metadata (qui ne génère que `/sitemap/<id>.xml` quand `generateSitemaps()` est défini). Tenter un Route Handler `app/sitemap.xml/route.ts` = build error « Conflicting route ». **Solution adoptée** : exposer l'index racine à `/sitemap-index.xml` et référencer ce path dans `robots.ts` Sitemap directive. Googlebot follow.

→ La memory `axionia_bugs_seo_preexistants_2026-05-09` qui mentionne `/sitemap.xml 404` doit être **mise à jour** : ce n'est pas un bug, c'est un trade-off Next 16 documenté avec contournement propre.

- **Verdict : 10/10** (avec memory à corriger).

### Angle 10 — hreflang fr / en / x-default

- Factory : `src/lib/seo.ts:47-50` → tous les meta génèrent `fr`, `en`, `x-default = fr`.
- Sitemap : `src/app/sitemap.ts:96-106` `alternateLanguages()` ✅ + `x-default = defaultLocale` ✅.
- Runtime vérifié sur `/fr/interventions/essentielle` : 3 `<link rel="alternate" hreflang="fr|en|x-default">` ✅.
- **Verdict : 10/10**.

### Angle 11 — Sandbox routes

- `/design`, `/components`, `/sections` : Disallow robots.txt FR+EN (`src/app/robots.ts:15-25`).
- Pas de `noindex` meta (les pages elles-mêmes n'ont pas de `generateMetadata`).
- Anti-pattern mineur : si un crawler ignore robots.txt et arrive sur ces pages, elles seraient indexées (fallback Disallow → noindex meta toujours plus sûr).
- **Verdict : 9/10**.

### Angle 12 — Routes admin

- `(admin)/[adminPrefix]/layout.tsx:21` : `export const dynamic = "force-dynamic"` → jamais SSG, jamais sitemap.
- Pas de `generateMetadata` sur les pages admin → héritent du layout `[locale]` default → mais comme dynamic+auth-gated, aucun crawler ne les indexe.
- `ADMIN_URL_PREFIX` env-driven (`src/env.ts:38-54`) + zod validation prod ≠ dev fallback `admin-dev-x7k2n9` ✅.
- Aucun leak dans le bundle public détecté.
- **Verdict : 9/10** (10/10 si `noindex` meta robots ajouté en defensive defense in depth).

### Angle 13 — llms.txt + llms-full.txt

- `/llms.txt` : 200 OK, contenu propre (`src/app/llms.txt/route.ts:1-46`). Pricing dérivé de `pricing.ts` SSOT.
- `/llms-full.txt` : **307 redirect** → `/fr/llms-full.txt` (cf. P1-SEO-03). Contenu OK une fois suivi.
- Spec llmstxt.org respectée pour structure (# titre, > description, sections Markdown).
- Cache-Control `1h fresh + 24h SWR` propre.
- FAQ + cas-concrets + méthodologie injectés dans `/llms-full.txt` (`src/app/llms-full.txt/route.ts:43-93`).
- **Verdict : 6/10** (10 si le 307 disparaît).

### Angle 14 — IndexNow ping

- `scripts/indexnow-ping.ts:1-87` : POST batch top 15 paths × 2 locales = 30 URLs.
- Hook : `pnpm postbuild` (à vérifier dans `package.json` mais design pattern propre).
- Conditionnel sur `INDEXNOW_KEY` + `NEXT_PUBLIC_SITE_URL` non-localhost ✅.
- Erreurs non-fatales (warn, exit 0) ✅.
- `/api/indexnow/key/route.ts` + `/api/indexnow/route.ts` : endpoints existent (cf. Phase 1 inventory).
- V2 Sprint 17 prévu : diff git changed-routes only.
- **Verdict : 9/10**.

---

## 4. Ratios statuts indexable / noindex / Disallow

Snapshot Sprint 14.10 + Phase 5 CF :

| Statut                                 | Count estimé                                  | Méthode                                                                      |
| -------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| Indexable (sitemap inclus)             | ~17 500 (Phase 1)                             | `/sitemap-index.xml` sub-sitemaps                                            |
| `noindex follow` (anti-doorway villes) | ~2280 - 2 = **2278 villes structurelles**     | `src/app/[locale]/implantations/[region]/[ville]/page.tsx:96-101`            |
| `noindex` formulaires/transactionnel   | 5 routes                                      | confirmation, desabonnement, mes-donnees, recherche, confirmation/newsletter |
| `noindex` tier-2/3 blog posts          | dépend de `getIndexableBlogPosts()` filtering | `src/app/[locale]/blog/[slug]/page.tsx:42-50`                                |
| Disallow robots (sandbox)              | 6 routes (3 × 2 locales)                      | `src/app/robots.ts:15-25`                                                    |
| Disallow robots (technical)            | `/api/`, `/_next/`                            | `src/app/robots.ts:13-14`                                                    |
| Force-dynamic (admin)                  | ~30 routes admin                              | `src/app/[locale]/(admin)/...`                                               |

**Cohérence ratio sitemap vs site total** : ~17 500 URLs sitemap pour ~20 000 SSG estimées → 87 % indexable, 13 % filtré (anti-doorway HCU 2024 + transactionnel). **Cohérent avec doctrine Sprint 14.10**.

---

## 5. Risques business

1. **Risque #1 (P0)** : tant que le bloc CF Content-Signal reste activé, l'investissement AEO/GEO 2026 (factories Person/Speakable/LocalBusiness/Dataset/QAPage) est **gaspillé** — les LLM bots Claude/GPT/Google AI sont bloqués au robots.txt. ROI proche de zéro sur ce levier stratégique.
2. **Risque #2 (P1)** : duplication `· Axion-IA · Axion-IA` visible dans la SERP réduit la lisibilité du titre et dilue 12 % de l'espace pixel SERP (estim. 9 c sur 60 c max).
3. **Risque #3 (P1)** : `lastmod = new Date()` peut déclencher un signal « low-quality lastmod » côté Google → moins de re-crawl en bursts (les rafraîchissements vrais perdent en priorité).
4. **Risque #4 (P2)** : OG dynamique palette Webflow v1 sur tous les liens partagés LinkedIn/Twitter = inconsistance marque avec le site terracotta v3.

---

## 6. Action items (HORS scope AUDIT-ONLY)

| ID        | Action                                                    | Effort          | Sprint cible |
| --------- | --------------------------------------------------------- | --------------- | ------------ |
| AI-SEO-01 | Désactiver Cloudflare Content-Signal Managed Content      | 5 min Dashboard | Immédiat     |
| AI-SEO-02 | Retirer suffixes `· Axion-IA` des 17 occurrences contenus | 15 min sed      | Polish       |
| AI-SEO-03 | Fixer `sitemap-index` `lastmod` build-time constant       | 30 min          | Polish       |
| AI-SEO-04 | Fixer middleware next-intl pour exclure `/llms-full.txt`  | 10 min          | Polish       |
| AI-SEO-05 | Aligner palette `/api/og` sur v3 terracotta               | 20 min          | Polish       |
| AI-SEO-06 | Ajouter `noindex` meta defensive sur admin pages          | 10 min          | Optionnel    |

Estim. total polish : ~1h30 pour passer 82 → 95.

---

## 7. Sources

Tous chemins absolus depuis `C:\Users\willi\Documents\Projets\Axion-IA\axionia\` (working dir).

- `src/app/robots.ts:1-77` — doctrine code 13 bots allowed
- `src/app/sitemap.ts:1-564` — sitemap-index + 10 sub-sitemaps + chunking villes
- `src/app/sitemap-index.xml/route.ts:1-52` — index racine
- `src/app/[locale]/layout.tsx:61-108` — metadataBase + title template + verification GSC/Bing + Organization+WebSite JSON-LD
- `src/lib/seo.ts:1-1057` — 17 factories metadata + JSON-LD
- `src/app/llms.txt/route.ts:1-46` — llms.txt SSOT
- `src/app/llms-full.txt/route.ts:1-112` — llms-full.txt enrichi pricing/FAQ/cases
- `scripts/indexnow-ping.ts:1-87` — postbuild IndexNow
- `src/app/opengraph-image.tsx:1-122` — OG default v3 terracotta
- `src/app/api/og/route.tsx:12-22` — OG dynamique palette v1 obsolète (P2-SEO-06)
- `src/app/[locale]/implantations/[region]/[ville]/page.tsx:60-103` — anti-doorway HCU 2024
- `src/app/[locale]/blog/[slug]/page.tsx:42-50` — tier-1/2/3 robots conditional
- `src/content/audit.ts:574,693` · `src/content/implementation.ts:315,404` · `src/content/interventions.ts:581,699,1793,1895` · `src/content/legal.ts:64,97,143,184,234,279,312` — suffixes duplicants (P1-SEO-02)

Runtime endpoints vérifiés `curl` sur `https://axion-ia.com/` le 2026-05-11 12:33 UTC :

- `/sitemap.xml` → 404 (attendu, cf. Angle 9)
- `/sitemap-index.xml` → 200 (10 entries)
- `/sitemap/pages.xml` → 200 (94 URLs)
- `/sitemap/blog.xml` → 200 (38 URLs)
- `/sitemap/implantations.xml` → 200 (26 URLs)
- `/sitemap/services-villes-audit.xml` → 200 (2 URLs Paris FR+EN, attendu V1)
- `/robots.txt` → 200 (avec CF Managed Content block AVANT directives applicatives)
- `/llms.txt` → 200 (direct)
- `/llms-full.txt` → 307 → `/fr/llms-full.txt` 200
- `/fr/interventions/essentielle` → 200, meta SEO complète + title 73 c (duplication suffix)
- `/fr/blog` → 200, meta SEO complète + title 62 c (duplication suffix)

---

## 8. Conclusion

L'architecture SEO/AEO Axion-IA est **excellente sur le papier code** (factories complètes, anti-doorway HCU 2024, hreflang propre, sitemap-index bien découpé, IndexNow auto, robots doctrine AEO 13 bots). Mais **un seul réglage Cloudflare (Content-Signal Managed Content) invalide à 90 % l'investissement AEO/GEO** : les LLM bots stratégiques (ClaudeBot, GPTBot, Google-Extended, Applebot-Extended) sont bloqués au robots.txt en amont du code applicatif.

→ **Action P0 unique** : désactiver le bloc Cloudflare Managed Content. Tout le reste (duplication titres, lastmod, llms-full.txt 307, palette OG) = polish ~1h30.

Score brut SEO **82/100**, pondéré ×1.5 = **123/150**. Sans le P0, ce serait 95/100 (143/150).

Verdict E2E : **CONDITIONAL GO** sur le SEO côté code. **NO-GO sur le runtime AEO** tant que CF Content-Signal Managed est activé.

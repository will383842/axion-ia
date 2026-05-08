# Annexe C — SEO + AEO + GEO 2026 (3 disciplines)

**Lead agent** : AGT-SEO-AEO-GEO

## C.1 — SEO classique

### Infrastructure de base

| Critère                  | Verdict | Détail                                                                                                        |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------- |
| `robots.ts`              | ✅      | `src/app/robots.ts:5-29` allow `/`, disallow `/api/`, `/_next/`, `/design`, `/components`, `/sections`        |
| `sitemap.ts` multilingue | ✅      | `src/app/sitemap.ts` (195 lignes), hreflang `x-default = FR`, alternates.languages, 9 collections dynamiques  |
| Canonical absolu         | ✅      | `src/lib/seo.ts:29` `canonical: /${locale}${path}` + `SITE_URL`                                               |
| Pathnames FR/EN traduits | ✅      | `src/i18n/routing.ts` 40+ routes (ex: `/audit/complet` ↔ `/audit/full`, `/blog/categorie` ↔ `/blog/category`) |
| 404 personnalisée        | ✅      | `src/app/[locale]/not-found.tsx` 25 lignes, traduite                                                          |
| `<h1>` unique par page   | ✅      | 36 pages, 36 occurrences `titleAs="h1"` ou `<h1>`                                                             |
| OG images dynamiques     | ✅      | `src/app/api/og/route.tsx` 124 lignes, support `accent` param, cache 15min CDN                                |
| Twitter card             | ✅      | `summary_large_image` via `buildProductMetadata` ligne 44                                                     |
| IndexNow endpoint        | ✅      | `src/app/api/indexnow/route.ts` 53 lignes, edge route POST                                                    |

### Findings P1

| ID         | Description                           | Mitigation                                                                               |
| ---------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| **C-P1-1** | `INDEXNOW_KEY` env = TODO placeholder | Générer clé 32-128 hex, placer en `.env.production`, publier `{key}.txt` racine (15 min) |

## C.2 — AEO 2026 (Answer Engine Optimization)

| Critère                      | Verdict                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `llms.txt` route             | ✅ `src/app/llms.txt/route.ts` 40 lignes, résumé MD 5 modules, cache 1h+24h SWR                                                                                                                   |
| `llms-full.txt` route        | ✅ `src/app/llms-full.txt/route.ts` 83 lignes, FAQ 5 Q&A, 5 cases, méthodologie 4-step                                                                                                            |
| RSS `/blog/feed.xml`         | ✅ RSS 2.0 + `author` + `pubDate` + `category`, cache 15min+24h SWR                                                                                                                               |
| RSS `/cas-concrets/feed.xml` | ✅ RSS 2.0 + industry category                                                                                                                                                                    |
| RSS `/faq/feed.xml`          | ✅ RSS 2.0 + answer description                                                                                                                                                                   |
| 20+ types JSON-LD            | ✅ Organization, WebSite, Article, Review, FAQPage, Question, Answer, Service, Offer, BreadcrumbList, Rating, Person, ContactPage, CollectionPage, QAPage, ProfilePage, SearchAction, DefinedTerm |

### Findings P1

| ID         | Description                                                                           | Mitigation                                     |
| ---------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **C-P1-2** | Pas de `AggregateRating` global sur `/cas-concrets` (Reviews individuelles seulement) | Ajouter agrégat 5 étoiles × 5 reviews (30 min) |

## C.3 — GEO 2026 (Generative Engine Optimization)

### E-E-A-T signals

| Signal              | Verdict       | Détail                                                                                                                                                                   |
| ------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Author bylines      | ✅            | 5/5 articles blog ont `author = "Will"`, slug `/blog/auteur/will`. RSS inclut `<author>Will</author>`                                                                    |
| Bio expert          | ⚠️ **C-P0-2** | `transversal.ts:42-43` "Will · Founder · 10 ans digital" = trop court (< 30 chars). Cible E-E-A-T = 150-200 mots avec certifications, parcours, prix                     |
| Last-modified dates | ❌ **C-P0-1** | `datePublished` présent, **aucun `dateModified`** sur articles blog ni cas-concrets. Articles 2026 affichent date publi seule. Sitemap `lastModified = now` (date build) |
| Trust OÜ estonienne | ✅            | Header logo, footer copyright, `legalName: "Axion-IA OÜ"` partout                                                                                                        |
| RGPD compliance     | ✅            | `/politique-confidentialite`, `/desabonnement` (RFC 8058 + RGPD rights), DPO email `dpo@axion-ia.com` (`legal.ts:234`)                                                   |
| Hetzner EU          | ✅            | llms-full.txt:27 "Hetzner CX32 Frankfurt", `/politique-confidentialite`                                                                                                  |
| Registrikood + VAT  | ❌ **C-P0-3** | `legal.ts:40` "à compléter" placeholder — bloquant légal Estonia + crawlers                                                                                              |

### Brand consistency

| Pattern                         | Occurrences                                                       | Verdict |
| ------------------------------- | ----------------------------------------------------------------- | ------- |
| `Axion-IA` (canonique)          | 256                                                               | ✅      |
| `Axion-IA OÜ` (legal)           | nombreuses (footer, OG, JSON-LD)                                  | ✅      |
| `Axion-IA`                      | 1 (commentaire code Header.tsx:40 décrivant le rendu visuel logo) | ✅      |
| `Axionia` / `Axion IA` (espace) | 0                                                                 | ✅      |

### Entity-based optimization

| Critère                        | Verdict                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `Organization.identifier`      | ⚠️ **C-P1-3** absent — ajouter `{"@type":"PropertyValue","name":"registrikood","value":"…"}` quand C-P0-3 résolu |
| `Service.serviceType` cohérent | ✅ "AI audit · firm/department/retail", "AI implementation · agents/chatbot/…"                                   |
| `WebSite.inLanguage`           | ✅ `layout.tsx:109`                                                                                              |

### Authority signals

| Pilier            | Sub-pages              |
| ----------------- | ---------------------- |
| `/interventions`  | 6                      |
| `/audit`          | 5 + `/demande`         |
| `/implementation` | 10                     |
| `/cas-concrets`   | 3 templates + secteurs |
| `/blog`           | 5 templates            |
| `/centre-aide`    | 3 templates            |
| `/faq`            | 3 templates            |

**Total thematic depth : 34+ pages thématiques** bien connectées via breadcrumbs JSON-LD + footer.

### Training-dataset friendly

| Critère                                                                              | Verdict                                                                                      |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| llms.txt + llms-full.txt                                                             | ✅                                                                                           |
| RSS feeds × 3                                                                        | ✅                                                                                           |
| Semantic HTML5 (`<section>`, `<article>`, `<header>`, `<main>`, `<footer>`, `<nav>`) | ✅                                                                                           |
| robots.txt allow GPTBot/ClaudeBot/CCBot/PerplexityBot explicite                      | ⚠️ **C-P1-4** : userAgent `*` allowed par défaut (= OK), mais règles explicites recommandées |
| Sitemap `lastModified` réel                                                          | ⚠️ **C-P1-5** : pas date édition, juste date build                                           |

## C.4 — Citability test (5 LLMs × 10 questions)

⚠️ **Non exécutable cette session** : pas d'accès Perplexity/ChatGPT Search/Claude/Google AIO/Mistral en runtime.

**Méthodologie documentée** dans Annexe F (10 questions cibles + protocole + grille évaluation ✅/⚠️/❌).

## C.5 — Synthèse

### Findings P0 (3)

| ID         | Description                                                                                     | Effort                           |
| ---------- | ----------------------------------------------------------------------------------------------- | -------------------------------- |
| **C-P0-1** | `dateModified` absent sur BlogPost + CaseStudy interfaces (impact : LLMs voient articles "old") | 2h                               |
| **C-P0-2** | Bio Will trop courte (< 30 chars vs 150-200 attendus E-E-A-T)                                   | 1h                               |
| **C-P0-3** | `registrikood` + VAT EE = "à compléter" (`legal.ts:40`)                                         | 10 min (après obtention numéros) |

### Findings P1 (5)

| ID         | Description                                            | Effort                   |
| ---------- | ------------------------------------------------------ | ------------------------ |
| **C-P1-1** | `INDEXNOW_KEY` env TODO                                | 15 min                   |
| **C-P1-2** | Pas de `AggregateRating` cas-concrets                  | 30 min                   |
| **C-P1-3** | `Organization.identifier` absent                       | 10 min (post C-P0-3)     |
| **C-P1-4** | robots.txt rules AI bots explicites manquantes         | 5 min                    |
| **C-P1-5** | Sitemap `lastModified = now` (pas date édition réelle) | 3h (intégration git/CMS) |

## C.6 — Verdict Partie C

# ⚠️ **GO conditionnel Sprint 15** (Partie C)

Infrastructure SEO/AEO/GEO **solide**. Mais **2 P0 contenu** (`dateModified` + bio Will) + **1 P0 légal** (registrikood) à corriger en parallèle. Effort total **3h30**, **non bloquant** pour démarrer Sprint 15 backend.

# Stratégie SEO/AEO/GEO 2026 — Axion-IA

> **Date** : 2026-05-07 (amendée même jour pour V1 amendé)
> **Cible** : devenir #1 en France dans chaque ville et chaque région sur les requêtes IA opérationnelle B2B. Lancement France-only dans un premier temps. Multi-pays (BE, CH, CA) et EN parité villes = an 2 conditionnel.
> **Statut** : référence vivante pour le chantier pSEO villes/régions.
> **Périmètre V1 amendé 2026-05-07** : **TOUTES les ~2 150 villes >5 000 hab France métropole + 5 DROM** (au lieu de la séquence 1 160 → 2 150 initialement recommandée par Agent D). Décision Will « tout ou rien ».
> **HEAD git** : à jour avec sitemap-index split (`acd8080`), factories Organization/WebSite/Person/Article/FaqSpeakable/LocalBusiness/Place/ItemList (`acd8080` + `eda574b` + `5d9d527`), cleanup SITE_URL généralisé.
> **⚠️ Note timing** : ce chantier n'est PAS le Sprint 15 historique (M8 Prisma backend). C'est un travail frontend final à exécuter avant Sprint 15 Prisma. Voir `PHASE-FRONTEND-FINAL-PSEO-VILLES-REGIONS.md`.

---

## 0. Le triptyque 2026 : SEO + AEO + GEO

### SEO (classique) — encore vivant mais déclassé

- Google capte ~85 % du marché FR mais SGE / AI Overviews **détourne 30-50 % du trafic** (zero-click answers).
- Les pages cliquées le sont surtout pour **vérifier** une réponse déjà donnée par l'IA. Le ranking SEO traditionnel reste nécessaire mais **insuffisant** comme stratégie unique.

### AEO — Answer Engine Optimization

- Vise les **answer engines** : Google AI Overviews / SGE, Bing Copilot, Brave Summarizer.
- L'IA pioche dans les pages indexées qui ont :
  - Des **direct answers** courts (40-80 mots) en haut de page.
  - Des **FAQ structurées** (`FAQPage` JSON-LD).
  - Des **breadcrumbs** ancrant la page dans une hiérarchie.
  - Un **`Article` JSON-LD complet** avec `author` (Person), `dateModified`, `articleBody`, `wordCount`.
- L'IA cite la page sous forme de carte / chip dans la réponse → **clics qualifiés**.

### GEO — Generative Engine Optimization

- Vise les **chatbots conversationnels** : Claude.ai, ChatGPT, Perplexity, Mistral Le Chat.
- Ces moteurs ont leur propre crawl (ClaudeBot, GPTBot, PerplexityBot) + scraping live via outils.
- Ils privilégient :
  - Les pages avec **`Organization` JSON-LD** stable (entité identifiable).
  - Les **`Person` schemas** pour l'E-E-A-T (qui parle, autorité).
  - Les **`llms.txt` / `llms-full.txt`** qui résument le site pour les LLMs (Anthropic le supporte officieusement, Perplexity aussi).
  - Le **contenu différencié** non-clonable.
  - Les **citations de sources externes** vérifiables (`sameAs`, `citation`, `isBasedOn`).

### Triple objectif

Sur une requête « cabinet IA opérationnel à Lyon » :

- **SEO** : ranker top 3 sur Google.fr.
- **AEO** : être cité dans la réponse IA Overview avec un lien-chip.
- **GEO** : être proposé en réponse quand un utilisateur demande à Claude / Perplexity « qui peut nous accompagner sur l'IA à Lyon ? ».

---

## 1. Diagnostic Axion-IA — état post-`acd8080`

### Ce qui est en place (✅)

| Item                                                                                                                     | Couverture                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Sitemap-index** + 6 sous-sitemaps                                                                                      | ✅ `/sitemap.xml` index + `/sitemap/{pages,blog,help,cas-concrets,comparaisons,implementation}.xml` |
| **`hreflang` complet** FR ↔ EN + `x-default`                                                                             | ✅                                                                                                  |
| **`Organization` JSON-LD enrichi** (logo + sameAs + foundingDate + foundingLocation Estonia + areaServed + contactPoint) | ✅ via `buildOrganizationJsonLd()`                                                                  |
| **`WebSite` JSON-LD + SearchAction**                                                                                     | ✅ via `buildWebsiteJsonLd()`                                                                       |
| **`FAQPage` JSON-LD**                                                                                                    | ✅ basique (`buildFaqJsonLd`)                                                                       |
| **`Service` + `Offer` JSON-LD** sur produits                                                                             | ✅ `buildServiceJsonLd()`                                                                           |
| **`BreadcrumbList`**                                                                                                     | ✅ `buildBreadcrumbJsonLd()`                                                                        |
| **`Product` JSON-LD** sur stack-ia                                                                                       | ✅                                                                                                  |
| **`llms.txt` + `llms-full.txt`**                                                                                         | ✅ Edge runtime + Cache-Control                                                                     |
| **3 RSS feeds** (blog, cas-concrets, FAQ)                                                                                | ✅                                                                                                  |
| **IndexNow protocol**                                                                                                    | ✅ Bing / Yandex / Seznam / Naver                                                                   |
| **Speculation Rules** prefetch + prerender                                                                               | ✅ production-only                                                                                  |
| **`lastModified` réel** (blog → `publishedAt`)                                                                           | ✅ depuis `acd8080`                                                                                 |

### Factories disponibles (livrées `acd8080` + extension récente)

`src/lib/seo.ts` expose maintenant :

| Factory                                               | Schema émis                                                                     | Usage                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------- |
| `buildProductMetadata`                                | `Metadata` Next.js + canonical + hreflang + OG + Twitter                        | toutes pages                                  |
| `buildServiceJsonLd`                                  | `Service` + `Offer`                                                             | interventions, audit, implementation          |
| `buildFaqJsonLd`                                      | `FAQPage`                                                                       | partout où il y a une FAQ                     |
| `buildBreadcrumbJsonLd`                               | `BreadcrumbList`                                                                | toutes pages > niveau 1                       |
| `buildOrganizationJsonLd`                             | `Organization` (10 champs)                                                      | layout-level (déjà utilisé)                   |
| `buildWebsiteJsonLd`                                  | `WebSite` + `SearchAction`                                                      | layout-level (déjà utilisé)                   |
| **`buildPersonJsonLd`** _(nouveau)_                   | `Person` + worksFor + knowsAbout + sameAs                                       | `/a-propos`, `/blog/auteur/[slug]`            |
| **`buildArticleJsonLd`** _(nouveau)_                  | `Article` + `dateModified` + `author` Person + `mainEntityOfPage` + `wordCount` | `/blog/[slug]`, `/cas-concrets/[slug]`        |
| **`buildFaqSpeakableJsonLd`** _(nouveau)_             | `FAQPage` + `speakable`                                                         | FAQs voice-friendly (Assistant Google, Alexa) |
| **`buildLocalBusinessJsonLd`** _(nouveau, Sprint 15)_ | `ProfessionalService` + areaServed + address + geo + openingHoursSpecification  | pages villes / régions                        |
| **`buildPlaceJsonLd`** _(nouveau, Sprint 15)_         | `Place` + geo + containedInPlace + population                                   | pages villes / régions                        |
| **`buildItemListJsonLd`** _(nouveau)_                 | `ItemList` + numberOfItems                                                      | catalogue stack-ia, listings villes/régions   |

### Gaps identifiés (à combler hors Sprint 15)

| Gap                                                       | Criticité AEO/GEO | Effort                                              |
| --------------------------------------------------------- | ----------------- | --------------------------------------------------- |
| `Article` JSON-LD du blog n'a pas `dateModified` distinct | 🔴 critique       | 30 min Will (utiliser `buildArticleJsonLd` nouveau) |
| `Person` Will pas exposé layout-level ou `/a-propos`      | 🟠 important      | 30 min Will                                         |
| `FAQPage` global pas en mode `Speakable`                  | 🟡 moyen          | 15 min Will (swap factory)                          |
| Pas de `dateModified` sur `Service`                       | 🟡 moyen          | extension `buildServiceJsonLd`                      |
| Pas de `mentions` / `citation` dans Articles              | 🟡 moyen          | enrichissement éditorial                            |
| `vatID` + `registrikood` Estonia                          | 🟢 mineur         | Will fournit plus tard                              |

### Gaps Sprint 15 (pages villes/régions)

| Gap                                                                                      | Status                           |
| ---------------------------------------------------------------------------------------- | -------------------------------- |
| `src/content/regions.ts` typé                                                            | ⏳ à créer                       |
| `src/content/villes.ts` typé (V1 = ~2 150 villes >5 000 hab France métropole + ~30 DROM) | ⏳ à créer                       |
| `src/lib/geo.ts` (Haversine)                                                             | ⏳ à créer                       |
| Pages `/implantations/page.tsx` + `/[region]/page.tsx` + `/[region]/[ville]/page.tsx`    | ⏳ à créer                       |
| Sitemaps `regions` + `villes-[region]` ajoutés à `generateSitemaps()`                    | ⏳ trivial une fois content créé |

---

## 2. Architecture cible #1 ville/région

### Stratégie « ville/région » — empilement sémantique

Pour qu'Axion-IA capte la requête « cabinet IA à [Ville] », chaque page ville Sprint 15 doit empiler :

```ts
<JsonLd data={buildLocalBusinessJsonLd({ locale, path, name, ... })} />
<JsonLd data={buildPlaceJsonLd({ locale, path, name, geo, containedInPlace, population })} />
<JsonLd data={buildBreadcrumbJsonLd({ locale, items: [
  { name: "Accueil", href: "/" },
  { name: "Implantations", href: "/implantations" },
  { name: "Région X", href: "/implantations/region-x" },
  { name: "Ville Y", href: "/implantations/region-x/ville-y" },
]})} />
<JsonLd data={buildFaqSpeakableJsonLd({ items: faqVille })} />
<JsonLd data={buildItemListJsonLd({ locale, path, name: "5 villes proches", items: nearbyVilles })} />
```

5 schemas par page ville → couvre les 5 angles AEO :

- **`ProfessionalService`** (LocalBusiness extension) → Google Maps + AI Overviews local pack.
- **`Place`** + `geo` + `population` → Wikipedia-style entity reconciliation.
- **`BreadcrumbList`** → ancrage hiérarchique (signal AEO).
- **`FAQPage` + `speakable`** → voice-first (Assistant, Alexa, Bixby).
- **`ItemList`** → réponse à « quelles villes proches ? » dans LLMs.

### Stratégie de différentiation (anti-doorway)

Conformément à ADR 0006 (`_AUDIT/adr-0004-pseo-villes-PROPOSITION.md` accepté en bloc 2026-05-07) :

- **Hero localisé** : « Cabinet IA opérationnel à [Ville] · [Département] ».
- **Démographie INSEE** + **top 3-5 secteurs NAF** → différentiation forcée par data publique.
- **Distance gare TGV / aéroport** → utilité concrète.
- **Cas client proche** (rayon ~50 km via Haversine) → preuve sociale géolocalisée.
- **5-8 villes proches** → maillage interne + ItemList JSON-LD.
- **FAQ géolocalisée** : « Combien coûte un audit IA à [Ville] ? » → AEO direct answer.

→ ratio « unique content » > 40-60 % par page (vs seuil HCU). Mesuré phase 1 par cosine similarity Bag-of-Words sur 100 paires aléatoires.

### Pourquoi #1 deviendra atteignable

| Concurrent type                                        | Faiblesse exploitable Axion-IA                       |
| ------------------------------------------------------ | ---------------------------------------------------- |
| Cabinets de conseil classiques (BCG/McKinsey/Deloitte) | Aucune page dédiée par ville. Trop génériques.       |
| Agences IA locales (Lyon, Paris, etc.)                 | 1-2 villes maximum, pas de stratégie nationale.      |
| Make / Zapier integrators                              | Pas un cabinet, juste des intégrateurs.              |
| Editeurs SaaS IA                                       | N'ont pas vocation à se positionner sur « cabinet ». |

→ **Axion-IA est seul à pouvoir cumuler** : (1) cabinet positionné national, (2) **2 150 pages villes V1 + 18 régions** (couverture maximale France >5 000 hab), (3) data structurée parfaite, (4) entité `Organization` Estonia stable cross-langue, (5) `Person` Will identifié E-E-A-T.

---

## 3. Roadmap par sprint

### ✅ Pré-Sprint 15 (immédiat — déjà fait)

- Sitemap-index split (commit `acd8080`).
- Factories Organization + WebSite (commit `acd8080`).
- Factories Person + Article + FaqSpeakable + LocalBusiness + Place + ItemList ajoutées.
- Cleanup `SITE_URL` 8 fichiers (commit `acd8080`).
- 4 pages orphelines réintégrées au footer (commit `e245d13`).
- Sitemap bug G5 corrigé (16 URLs `par-fonction` ré-indexées).
- Header CTA badge prix + tracking + drawer mobile étendu (commit `1626aaa`).

### ⏳ À faire AVANT Sprint 15 (frontend Will en cours)

- Brancher `buildArticleJsonLd` sur `/blog/[slug]` (au lieu du JSON-LD inline actuel) → fait-tomber `dateModified` au signal Google.
- Brancher `buildPersonJsonLd` sur `/a-propos` → E-E-A-T Will.
- Swap `buildFaqJsonLd` → `buildFaqSpeakableJsonLd` sur FAQ globale + presse + stack-ia → voice-first.
- (Optionnel) `Person` schema layout-level pour propager E-E-A-T sur toutes les pages.

### ⏳ Sprint 15 — pages villes/régions

- Créer `src/content/regions.ts` + `src/content/villes.ts` typés.
- Créer `src/lib/geo.ts` (Haversine).
- Créer pages `/implantations/page.tsx` + `[region]/page.tsx` + `[region]/[ville]/page.tsx`.
- Brancher les 5 factories par page : LocalBusiness + Place + Breadcrumb + FaqSpeakable + ItemList.
- Étendre `generateSitemaps()` avec `regions` + `villes-[region]` ids (trivial, ~5 lignes).
- Pipeline LLM Claude Sonnet 4.6 + prompt caching pour rédiger sections non-clonables (ADR 0006).
- Indexing API Google submission phase 1 top 50.

### ⏳ Sprint 16 — ⌘K + IndexNow renforcé

- Pagefind self-hosted (build-time, ~2 150 pages SSG).
- Articulation overlay → `/recherche?q=...` existante.
- IndexNow auto-ping sur publication blog (déjà en place, à étendre cas-concrets + presse).

### ⏳ Sprint 17+ — pSEO V2 + Person schemas équipe

- V2 villes 5 000-10 000 hab si Search Console signaux verts.
- `Person` schemas additionnels (consultants additionnels si recrutés).
- `Review` JSON-LD si témoignages clients structurés.
- `EducationalOccupationalCredential` si certifications IA.

---

## 4. Suivi qualité

### Outils à brancher (Sprint 16+)

- **Google Search Console** : domaine vérifié + sitemap-index soumis.
- **Bing Webmaster Tools** : sitemap-index soumis + IndexNow opérationnel.
- **Schema.org Validator** (validator.schema.org) : tester chaque sous-sitemap + chaque page type (blog post, cas concret, ville).
- **Rich Results Test** Google : valider FAQ + Article + LocalBusiness + Breadcrumb.
- **Speakable Test** (PageSpeed Insights → Speakable section).

### KPIs cible 12 mois

| KPI                                            | Baseline 2026-05-07         | Cible 2027-05                |
| ---------------------------------------------- | --------------------------- | ---------------------------- |
| Pages indexables Google                        | ~150                        | ≥ 1 200                      |
| Citations AI Overviews / mois                  | 0 (mesure baseline à faire) | ≥ 50/mois                    |
| Citations Perplexity (via parametre `&pi=`)    | 0                           | ≥ 30/mois                    |
| CTR organique (toutes requêtes)                | TBD                         | ≥ 4 %                        |
| Position moyenne sur « cabinet IA + ville » FR | TBD                         | top 3 sur 80 % des villes V1 |
| Position « cabinet IA opérationnel France »    | TBD                         | top 3                        |
| Crawl budget Google (pages/jour)               | TBD                         | ≥ 200                        |

### Garde-fous obligatoires

- **Pas de pages sans `Organization` JSON-LD** layout-level (cf. layout.tsx).
- **Pas d'`Article` sans `dateModified`** (signal AEO faible).
- **Pas de pages villes sans 5 schemas empilés** (LocalBusiness + Place + Breadcrumb + Faq + ItemList).
- **Pas de doublon JSON-LD** (Organization une seule fois par page, pas dans Header + Footer + layout).
- **Pas de `<address>` HTML sans `Organization` ou `LocalBusiness`** correspondant.
- **Hreflang `x-default` = FR** systématiquement.
- **`canonical` absolu** (jamais relatif) — déjà OK via `buildProductMetadata`.

---

## 5. Liens

- **ADR 0003** (mega-menus) : `_AUDIT/adr-0003-navigation-mega-menu-PROPOSITION.md` — accepté en bloc 2026-05-07. Sera `axionia/docs/adr/0005-navigation-mega-menu.md`.
- **ADR 0004** (pSEO villes) : `_AUDIT/adr-0004-pseo-villes-PROPOSITION.md` — accepté en bloc 2026-05-07. Sera `axionia/docs/adr/0006-pseo-villes-regions-2026.md`.
- **Audit Header & Nav** : `_AUDIT/AUDIT-HEADER-NAVIGATION-2026.md`.
- **Stratégie pSEO** : `_AUDIT/pseo-strategy.md`.
- **Audit obsolescences/conflits** : `_AUDIT/AUDIT-OBSOLESCENCES-CONFLITS-2026-05-07.md` (en cours via agent).

---

**Statut** : DRAFT 2026-05-07. À mettre à jour après l'audit obsolescences + au début de chaque Sprint.

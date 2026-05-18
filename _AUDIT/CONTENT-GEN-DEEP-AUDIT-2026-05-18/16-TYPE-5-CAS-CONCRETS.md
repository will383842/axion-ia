# 16 — TYPE 5 : Cas concrets

> Score : 72/100 — Status : 🟡 V1 partiel (source manuelle TS, page bilingue OK, liaison ville livrée, sitemap dédié, mais 5 fixtures seulement)

HEAD audité : `9c1adaa` (branche `main`). Auditeur : agent autopilot AUDIT-ONLY.

---

## 1. Description simple (Will-readable)

Les « cas concrets » sont les études de cas clients d'Axion-IA. Pas de generator LLM : Will écrit les 5 cas à la main dans un fichier TypeScript. Chaque cas a un slug, un secteur, une taille d'entreprise, une métrique chiffrée et un témoignage anonymisé. Les pages publiques `/cas-concrets` et `/cas-concrets/[slug]` sont SSG. Les pages ville peuvent afficher un bandeau « cas client proche » via les coordonnées géo facultatives.

## 2. Diagramme Mermaid (flow complet)

```mermaid
flowchart TD
  A[Will édite src/content/case-studies.ts<br/>5 fixtures manuelles] --> B[CASE_STUDIES const]
  B --> C[getAllSlugs / getCaseStudy / getAllIndustrySlugs / getCaseStudiesByIndustry]
  C --> D[generateStaticParams<br/>cas-concrets/[slug] page.tsx:45]
  D --> E[SSG /fr/cas-concrets/[slug] + /en/case-studies/[slug]]
  C --> F[/fr/cas-concrets hub + /en/case-studies hub<br/>ISR 86400s]
  C --> G[cas-concrets/feed.xml<br/>RSS 2.0 par locale]
  C --> H[cas-concrets/secteur/[slug]<br/>filtre industrie]
  B --> I[lib/geo.ts]
  I --> J[getNearbyCases<br/>haversineKm dans rayon]
  I --> K[getNearbyCasesWithFallback<br/>cascade proximity→region→sector→none]
  K --> L[VilleServicePageTemplate<br/>bandeau cas client proche]
  C --> M[buildCasConcretsSitemap<br/>sitemap.ts:602]
  M --> N[/sitemap/cas-concrets.xml]
  B --> O[buildArticleJsonLd + buildReviewJsonLd<br/>cas-concrets/[slug] page.tsx:77-97]
  B --> P[lib/knowledge/readers.ts<br/>findCaseStudyBySlug façade]
  P --> Q[lecture KnowledgeEntry si KB_BACKEND_UNIFIED_CASE_STUDY=1]
  P --> R[lecture CaseStudyTranslation Prisma si feature flag off]
  R --> S{prisma.caseStudy<br/>table existe?}
  S -->|oui| T[future migration TS → DB]
  S -->|non utilisée| U[fixtures TS = SSOT runtime]
```

## 3. Inputs / Outputs (fichier:ligne)

**Inputs**

- Source unique manuelle : `src/content/case-studies.ts:41` (`CASE_STUDIES: ReadonlyArray<CaseStudy>` — 5 fixtures, commentaire L1 « Replaced by Prisma in Sprint 15 » = **TODO non livré**).
- Type `CaseStudy` (L4-21) : `slug`, `industry`, `industryEn`, `size: "tpe"|"pme"|"mid"|"enterprise"`, `metric`, `geo?: {lat,lon}` (optionnel L16), `cityLabel?` (L18), `fr` + `en` copy (L22-39).
- Helpers TS : `getCaseStudy(slug)` (L230), `getAllSlugs()` (L234), `getAllIndustrySlugs()` (L247), `getCaseStudiesByIndustry(slug)` (L252), `getIndustryLabel(slug, locale)` (L256).
- Modèles Prisma `CaseStudy` + `CaseStudyTranslation` : utilisés par `prisma.caseStudyTranslation.findFirst` (`src/lib/knowledge/readers.ts:361-381`) MAIS uniquement lus si feature flag `KB_BACKEND_UNIFIED_CASE_STUDY` off ET seulement par `findCaseStudyBySlug` (route detail non utilisée actuellement par `/cas-concrets/[slug]` qui lit le TS direct — cf L71-72 page).
- Admin Prisma row management : `src/features/admin-case-studies/actions.ts` (existence confirmée par grep) — workflow draft/published Prisma indépendant de la fixture TS.

**Outputs**

- Hub bilingue `/{locale}/cas-concrets` : `src/app/[locale]/cas-concrets/page.tsx:61` (ISR `revalidate=86400` L37 — 24h CDN-friendly cf commentaire L33-36).
- Detail SSG `/{locale}/cas-concrets/[slug]` (et `/en/case-studies/[slug]` via pathname mapping `sitemap.ts:606`) : `src/app/[locale]/cas-concrets/[slug]/page.tsx:64` (`dynamicParams=false` L43 P0-7 anti soft-404, `generateStaticParams` L45-48 — 5 slugs × 2 locales = 10 pages SSG).
- Filter par secteur : `src/app/[locale]/cas-concrets/secteur/[slug]/page.tsx` (existence confirmée par glob).
- Client-side filtre grid : `src/app/[locale]/cas-concrets/CaseStudiesFilteredGrid.tsx` (Client Component, descriptors injectés `page.tsx:77-89`).
- RSS feed : `src/app/[locale]/cas-concrets/feed.xml/route.ts:14` (Edge runtime L8, par locale).
- Sitemap dédié : `buildCasConcretsSitemap(now)` (`src/app/sitemap.ts:602-617`) dispatché par `case "cas-concrets"` (`sitemap.ts:326`), déclaré dans `staticIds` (`sitemap.ts:244`). Routes : `/cas-concrets/:slug` (priority 0.6, monthly) + `/cas-concrets/secteur/:slug` ↔ `/case-studies/industry/:slug`.
- Liaison ville Phase F Sprint S+2 (commit `4d9efbf`) :
  - `getNearbyCases(origin, radiusKm, n=3)` : `src/lib/geo.ts:66` — filtre `CaseStudy.geo` non-null, trie par distance Haversine.
  - `getNearbyCasesWithFallback(source, options)` : `src/lib/geo.ts:200` — cascade 4 niveaux : `proximity` (50km défaut) → `region` (rayon élargi 50km autour des villes même région) → `sector` (filtrage `industry`/`sector` via `sectorHint`) → `none` (fallback ce qu'on a).
  - Type retour `NearbyCasesResult` avec `fallbackLevel: "proximity"|"region"|"sector"|"none"` (utilisé pour disclaimer « ces cas viennent de la région, pas de la commune » cf commentaire L197-198).
- JSON-LD pages :
  - `buildArticleJsonLd` (`page.tsx:77-85`) — `datePublished: "2026-05-01"` hardcodé L83 (**voir §7**).
  - `buildReviewJsonLd` (`page.tsx:88-97`) — star rating 5 forcé L91, `itemReviewed` = Service "Conseil IA opérationnel Axion-IA".
  - `buildItemListJsonLd` hub (`page.tsx:105-119`) — expose les 5 cas au crawler.
- Markdown alternate format LLM ingestion : `<link rel="alternate" type="text/markdown" href="/api/markdown/cas-concrets/${slug}" />` (`page.tsx:115`).

## 4. Quality gates (ordre)

Pour les cas concrets, les gates sont **réduits** car la source est manuelle (Will = autorité éditoriale) :

1. **Compile-time** : type `CaseStudy` strict (`case-studies.ts:4-21`) → champs obligatoires : slug, industry, industryEn, size, metric, fr.{title,excerpt,context,problem,solution,result,testimonialQuote,testimonialAuthor,testimonialRole} + en équivalent. Compilation TS bloque toute fixture incomplète.
2. **Slug unique** : pas de check explicite, mais `getCaseStudy(slug)` retourne le premier match (`L231`) — un doublon = silent override.
3. **`breadcrumbName` optionnel** ≤ 35 caractères (`case-studies.ts:28-30`) — pas de validation runtime, simplement convention documentée pour éviter cassure breadcrumb (P1-14 audit E2E NAV+CTA).
4. **Geo facultatif** : `getNearbyCases` ignore les cas sans `geo` (`geo.ts:73`) — anti-hallucination Will (« pas d'inférence depuis l'industry » cf commentaire L64).
5. **Indexation** : `dynamicParams=false` (`[slug]/page.tsx:43`) → tout slug hors fixture = 404, pas de soft-404.
6. **Sitemap dédup** : `buildExcludeSlugsByType()` exclut les slugs `case_study` du sub-sitemap KB (`sitemap.ts:398`) → pas de doublon sitemap-index si Will migre un cas TS → KB.
7. **Pricing source-of-truth** : pages utilisent `getTierById(INTERVENTION_TIERS, "intervention-essentielle")` (`page.tsx:220-221`, `[slug]/page.tsx:205-206`) — formatage centralisé, pas de hard-code €.
8. **Aucune gate Prisma** : `prisma.caseStudyTranslation.findFirst` (`readers.ts:361`) filtre uniquement `status === "published"` (L365), pas de wordCount / readability / dedup.

## 5. Tests existants (tableau)

| Fichier test                                            | Lignes | `it(`/`test(`             | Couverture                                                                                                |
| ------------------------------------------------------- | ------ | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/lib/__tests__/geo-extended.spec.ts`                | 129    | 13                        | `getNearbyVillesExtended` + `getNearbyCasesWithFallback` cascade (4 it sur fallback case studies L97-127) |
| `src/lib/knowledge/legacy-mapping-additional.test.ts`   | 330    | n/c (`CaseStudy` mention) | Mapping legacy `CaseStudy` → `KnowledgeEntry` (import migration)                                          |
| `src/lib/knowledge/prisma-helpers.test.ts`              | 301    | n/c (`caseStudy` mention) | Helpers Prisma KB legacy mapping                                                                          |
| ❌ Pas de test direct `case-studies.ts`                 | —      | 0                         | Aucun test fixtures (cohérence champs, slugs uniques, geo plausibles)                                     |
| ❌ Pas de test page `/cas-concrets`                     | —      | 0                         | Aucun test SSR/SSG hub ou detail                                                                          |
| ❌ Pas de test JSON-LD `buildReviewJsonLd` cas-concrets | —      | 0                         | Factory testée ailleurs (`seo-content-gen-factories.spec.ts`) mais pas dans contexte cas-concrets         |
| ❌ Pas de test `feed.xml` cas-concrets                  | —      | 0                         | Generator RSS non couvert                                                                                 |

**Total** : 1 fichier test direct (`geo-extended.spec.ts`, 4 it sur cascade fallback), couverture indirecte via legacy mapping et Prisma helpers. Très faible pour un type éditorial critique.

## 6. Tests manquants

- **`case-studies.ts` fixtures** :
  - Unicité des `slug` (5 actuellement, growth à 30+ planifié).
  - `breadcrumbName` ≤ 35 caractères si défini.
  - `geo.lat ∈ [-90, 90]`, `geo.lon ∈ [-180, 180]`.
  - `size ∈ {"tpe", "pme", "mid", "enterprise"}` (compile-time OK mais run-time anti-régression).
  - `industry` mappable vers `industrySlug` via `caseSlugify` réversible.
- **Page `/cas-concrets` hub** :
  - Snapshot SSG (5 cards FR, 5 cards EN).
  - JSON-LD `ItemList` contient bien les 5 cas.
  - Filter pills client (`CaseStudiesFilteredGrid`) couvre tous secteurs+tailles.
- **Page detail `/cas-concrets/[slug]`** :
  - 404 sur slug inconnu (`dynamicParams=false`).
  - JSON-LD `Review` star rating 5 toujours présent.
  - Breadcrumb fallback `copy.breadcrumbName ?? copy.title`.
  - `tldrText` non null si excerpt non vide.
- **Sitemap** : `buildCasConcretsSitemap` retourne 5 + N (industry slugs) entries × 2 locales filtrés EN si désactivé.
- **`getNearbyCases`** : pas de test direct (uniquement via `getNearbyCasesWithFallback`). Cas dégradés :
  - radius 0 → aucun.
  - n=0 → tableau vide.
  - tous cas sans `geo` → tableau vide.
- **Cohérence `CaseStudy.slug` ↔ Prisma `caseStudyTranslation.slug`** : aucun test ne vérifie que si Will ajoute un cas TS et l'admin crée le même slug en DB, il n'y a pas de conflit dans `findCaseStudyBySlug` (priorité legacy vs DB).
- **`feed.xml/route.ts`** : pas de test XML valide.

## 7. Erreurs / edge cases

- **`datePublished: "2026-05-01"` hardcodé** (`[slug]/page.tsx:83`) : toutes les fixtures publient à la même date. Google peut détecter incohérence (5 articles « publiés » exactement le même jour) → signal faible fraîcheur. Reco : ajouter `publishedAt: string` à `CaseStudy` type.
- **5 fixtures seulement** : `CASE_STUDIES.length === 5` (`case-studies.ts:41-228`). Promesse marketing « industrie, juridique, retail, banque, artisanat » couverte juste, mais aucun cas pour `tpe` autre que plombier, aucun cas SaaS/edtech/healthtech. SEO faible vs concurrents.
- **`geo` non renseigné sur 5 cas actuels** : grep `geo:` dans `case-studies.ts` = 0 résultat. Conséquence : `getNearbyCases()` retourne TOUJOURS `[]` actuellement (`geo.ts:73` ignore si pas de geo). Phase F cascade tombe direct sur `region` puis `sector` puis `none`. Le bandeau « cas client proche » sur pages ville est **silencieux**. → **P0** : ajouter `geo` aux 5 cas (Will sait où ils ont été menés).
- **Commentaire `case-studies.ts:1` « Replaced by Prisma in Sprint 15 »** : Sprint 15 = backend KB livré 2026-05-14, mais migration TS → Prisma `CaseStudy` **non faite**. Double source potentielle : TS (lue par pages publiques) + Prisma (manageable via `/admin/case-studies`). Risque incohérence si admin crée une row qui n'a pas de fixture TS → invisible publiquement (page lit `getCaseStudy()` L71-72 du TS pur).
- **EN feed.xml runtime edge** (`cas-concrets/feed.xml/route.ts:8`) : `export const runtime = "edge"` MAIS si EN désactivé, le feed `/en/cas-concrets/feed.xml` retourne quand même 200 avec items EN (pas filtré par EN_LOCALE_DISABLED). Incohérent vs sitemap qui filtre.
- **`getNearbyCasesWithFallback` distance fictive 999** (`geo.ts:252`) : fallback sectoriel injecte `distanceKm: 999` pour tri. Si on les rend dans l'UI avec affichage distance → menteur. À masquer si `fallbackLevel === "sector"`.
- **`generateStaticParams` cross-locales** (`[slug]/page.tsx:47`) : génère pour FR et EN. Mais si EN désactivé, on SSG des pages /en/case-studies/[slug] qui seront 301 → /fr/cas-concrets/[slug] via proxy.ts (cf AGENTS.md). Build pages inutiles = +5 routes SSG.
- **`prisma.caseStudy` admin actions** (`src/features/admin-case-studies/actions.ts`) : audit non lu, mais grep confirme existence. **UNKNOWN — requires fact-check** : les rows Prisma sont-elles exposées publiquement quelque part, ou pure ombre admin sans pipeline live ?
- **Bilingue copy maintenance** : chaque cas nécessite copy FR + EN main-écrite (16 champs × 5 cas = 80 champs). Aucun lien content-gen / aucune trad auto. Quand on passe à 30 cas, c'est 480 champs à maintenir manuellement.

## 8. Status global

🟡 **V1 partiel**. Pipeline fonctionnel : 5 fixtures TS, pages bilingues SSG, RSS feed, sitemap dédié dédoublonné, liaison ville Phase F cascade testée (4 it). Lacunes critiques : (1) aucune fixture n'a `geo` → bandeau ville silencieux, (2) `datePublished` hardcodé identique partout, (3) migration TS → Prisma promise Sprint 15 non livrée → double source non résolue, (4) 0 test direct sur les fixtures ou les pages. Score 72/100. P0 immédiat : `geo` sur les 5 cas, `datePublished` par-cas, snapshot test hub+detail.

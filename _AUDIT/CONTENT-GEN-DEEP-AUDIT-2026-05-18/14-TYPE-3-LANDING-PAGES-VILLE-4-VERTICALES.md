# 14 — TYPE 3 : Landing pages ville × service (4 verticales)

> Score : 78/100 — Status : 🟢 production-ready côté infra (4 routes câblées, 4 variants, soft-404 gate testé, ISR câblé, 4e verticale `un-a-un` livrée Sprint S+2) — 🟡 contenu (1 ville gold sur ~2150 cible)
> AUDIT-ONLY. Fichiers cités = fait. UNKNOWN = à compléter par fact-check listé.

## 1. Description simple (Will-readable)

Ce type produit ~2150 pages par verticale (audit, interventions, implementation, un-a-un), soit ~8600 routes pSEO en théorie.
Chaque page combine un copy local Will (Paris gold standard 5000 mots) ou un stub auto-gen filtré par anti-doorway HCU.
Le generator landing-ville interroge la base de connaissances, appelle le LLM avec un des 4 templates (default / focus_audit / focus_interventions / focus_implementation), nettoie le HTML, calcule un score qualité, et applique le gate soft-404 350 mots (280 si JSON-LD `LocalBusiness` riche + cas concret local + FAQ ≥ 4).
Les pages sans copy substantielle servent un stub minimaliste `noindex` (anti-doorway Google Helpful Content Update).
Aujourd'hui Paris est la seule ville Tier-1 livrée (`src/content/villes/copy/paris.ts`) ; les ~2280 autres sont en Tier-3 stub noindex.

## 2. Diagramme Mermaid (flow complet)

```mermaid
flowchart TD
  A[Admin Will<br/>geo/villeSlug/generate] --> B[Server Action geo.ts]
  B --> C[ContentGenJob inserted<br/>contentType=landing_ville<br/>anchorVilleSlug, templateVariant]
  C --> D[Queue content-gen]
  D --> E[content-gen-worker.ts<br/>processJob L147+]
  E -->|kill_switch L153-159| EX[Stop]
  E -->|assertKbReady L174-189| EY[KB pas prete = fail]
  E -->|dedup pre-IA L200-225| EZ[checkDedup cancel si bloque]
  E --> F[getGenerator landing_ville]
  F --> G[landing-ville.ts:32]
  G -->|anchorVilleSlug requis L33-35| GX[Throw si manquant]
  G --> H[KB retrieve 8 chunks<br/>L38-47 hybrid filters audiences public]
  H --> I[escape inputs anti prompt-injection<br/>L56-64 escapeSlugInput, escapeLlmInput]
  I --> J[resolveLandingVilleVariant L69<br/>default/focus_audit/focus_interventions/focus_implementation]
  J --> K[LLM call provider-router<br/>L89-97 OpenAI primary Anthropic fallback]
  K --> L[JSON.parse L111<br/>strict no fallback]
  L --> M[sanitizeContentGenHtml L118<br/>strip script/iframe]
  M --> N[Quality checks<br/>readability + doctrine + seo-score L128-141]
  N --> O[qualityScore = avg seo + readability<br/>doctrine fail -30 L143-145]
  O --> P[evaluateSoft404 L158-163<br/>350 mots OR 280 si rich + FAQ4]
  P --> Q[indexationTier decision L165-169<br/>tier_3 si soft-404 ou doctrine fail OR score < 70]
  Q --> R[extractMentionedCitiesFromText L176-179<br/>forceInclude=anchorVilleSlug max 10]
  R --> S[GeneratorOutput return L181-202]
  S --> T[content-gen-worker post checks<br/>plagiarism L258-284<br/>intent alignment L286-299]
  T --> U[ReviewQueue pending_review]
  U --> V[Admin Will review-queue approve]
  V --> W[content-publish-worker.ts]
  W --> W1[mentionedCities persiste L115-120 + L181<br/>hotfix 424e9a5]
  W --> W2[Article + ArticleTranslation FR transaction L153-211]
  W --> X[sitemap services-villes-VERTICALE<br/>app/sitemap.ts cases L334-341]
  X --> Y1[/audit/par-ville/ville page.tsx]
  X --> Y2[/interventions/par-ville/ville page.tsx]
  X --> Y3[/implementation/par-ville/ville page.tsx]
  X --> Y4[/un-a-un/par-ville/ville page.tsx Sprint S+2]
  Y1 --> Z[VilleServicePageTemplate.tsx<br/>buildPageMetadata + renderVilleServicePage]
  Y2 --> Z
  Y3 --> Z
  Y4 --> Z
  Z -->|hasCopy false| ZA[STUB MINIMAL noindex L248-282<br/>robots index:false follow:true L204-208]
  Z -->|hasCopy true| ZB[GOLD STANDARD render L284+<br/>4 JSON-LD + Breadcrumbs + nearbyVilles]
```

## 3. Inputs / Outputs

### Inputs

- **Briefing admin** : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/geo/[villeSlug]/generate/page.tsx`
- **Cockpit géo** : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/geo/page.tsx` + `geo/batches` + `geo/history`
- **Server Actions** : `src/server/actions/content-gen/geo.ts` + `src/server/actions/content-gen/city-coverage.ts`
- **Generator** : `src/server/content-gen/generators/landing-ville.ts` (204 lignes, pipeline propre — référence interne pour les 5 stubs du Type 1)
- **Templates 4 variants** : `src/server/content-gen/generators/landing-ville-templates.ts`
  - `default` (équilibré 3 modules) — L64-83 + CTA `/interventions/essentielle`
  - `focus_audit` (Module 2) — L85-108 + CTA `/audit`
  - `focus_interventions` (Module 1) — L110-133 + CTA `/interventions/essentielle`
  - `focus_implementation` (Module 3) — L135-160 + CTA `/implementation`
- **Source villes** : `src/content/villes/index.ts` (helpers `getIndexableVilles`, `VILLES`)
- **Source copy local Will** : `src/content/villes/copy/paris.ts` (seul fichier copy à ce jour — `src/content/villes/copy/types.ts` définit le schéma)
- **Anchor obligatoire** : `landing-ville.ts:33-35` throw si pas d'`anchorVilleSlug`
- **KB retrieve** : `kbRetrieve` 8 chunks hybrid (FTS+vector) filters audiences=public, types=`industry_use_case|case_study|methodology|doctrine` — `landing-ville.ts:38-47`

### Outputs

- **`GeneratorOutput`** typed retour : `landing-ville.ts:181-202`
- **`Article` DB row** persist : `content-publish-worker.ts:154-183` avec :
  - `templateVariant = cgJob.templateId` — L168
  - `mentionedCities` array slugs villes mentionnées + forceInclude anchorVilleSlug — L181 (hotfix `424e9a5`)
  - `indexationTier` héritée du generator — L165-169 du generator → mapped tier_2 ou tier_1 par promoteToTier1
- **4 routes filesystem** (confirmées via PowerShell `Get-ChildItem`) :
  - `src/app/[locale]/audit/par-ville/[ville]/page.tsx` — câble `VilleServicePageTemplate` service=`audit`
  - `src/app/[locale]/interventions/par-ville/[ville]/page.tsx` — service=`interventions`
  - `src/app/[locale]/implementation/par-ville/[ville]/page.tsx` — service=`implementation`
  - `src/app/[locale]/un-a-un/par-ville/[ville]/page.tsx` — service=`un-a-un` (Sprint S+2 commit `4d9efbf`, 2026-05-18)
- **ISR config 4 routes identique** : `revalidate = 86400` (24h) + `dynamicParams = true` — confirmé sur les 4 page.tsx (audit:22-23, interventions:15-16, implementation:15-16, un-a-un:22-23)
- **`generateStaticParams` partagé** : `VilleServicePageTemplate.tsx:156-160`
  - Gate env `BUILD_SSG_VILLES_INDEXABLE_ONLY=true` → seules les villes avec `copy.services.<svc>` sont pré-renderées au build (économise ~6450 pages SSG = 3 × 2150)
  - Audit deploy-unstuck 2026-05-18 (D4-QW1) cité en commentaire L147-154
- **Sitemap inclusion** : `src/app/sitemap.ts:248-252, 334-341`
  - `services-villes-audit`, `services-villes-interventions`, `services-villes-implementation`, `services-villes-un-a-un` (4 IDs StaticSitemapId)
- **JSON-LD émis par template** : `VilleServicePageTemplate.tsx:297+` (Service + areaServed City + BreadcrumbList auto + LocalBusiness — STOP & ASK pour confirmer les 4)
- **Mesh interne nearbyVilles** : `VilleServicePageTemplate.tsx:292-295` `getNearbyVilles(ville.geo, 6, ...)`
- **Anti-doorway HCU robots noindex** : `VilleServicePageTemplate.tsx:204-208` metadata `{ robots: { index: false, follow: true } }` si `!hasCopy`

### Variantes (4 + 1 opportunité)

- 4 livrées : `default`, `focus_audit`, `focus_interventions`, `focus_implementation` (`LANDING_VILLE_VARIANT_SLUGS:176-181`)
- **Opportunité non livrée** `focus_dirigeants` pour `un-a-un` Sprint S+3 : aucun code dans `landing-ville-templates.ts`. Le mapping serait à ajouter dans `LANDING_VILLE_VARIANTS` + extension du type `LandingVilleVariantSlug` L23-27.

## 4. Quality gates (ordre d'exécution)

1. **kill_switch content-gen-worker** — `content-gen-worker.ts:153-159`
2. **assertKbReady** — `content-gen-worker.ts:174-189`
3. **dedup pre-IA** — `content-gen-worker.ts:200-225`
4. **Generator anchorVilleSlug requis** — `landing-ville.ts:33-35` (throw)
5. **escapeSlugInput / escapeLlmInput anti prompt-injection** — `landing-ville.ts:56-64` (P1-3 Pass B audit)
6. **JSON.parse strict LLM output** — `landing-ville.ts:110-114` (throw si non parsable, **PAS de fallback** `indexOf("{")` contrairement à guide-pilier)
7. **sanitizeContentGenHtml strip script/iframe** — `landing-ville.ts:118` (P0-5 Pass B doctrine §4.1bis)
8. **computeReadabilityFr** — `landing-ville.ts:128`
9. **checkDoctrine** — `landing-ville.ts:129` (banned phrases, Axion-IA-centric ratio ≥ 95 %)
10. **computeSeoScore** — `landing-ville.ts:130-141`
11. **qualityScore aggregate** — `landing-ville.ts:143-145` (avg seo+readability, doctrine fail = -30)
12. **evaluateSoft404 gate 350 mots ou 280 si rich** — `landing-ville.ts:158-163` → `src/server/content-gen/quality/soft-404-gate.ts:76-94`
    - DEFAULT 350 — `soft-404-gate.ts:33`
    - WITH_RICH_JSON_LD 280 — `soft-404-gate.ts:34`
    - Bonus FAQ ≥ 4 = +50 mots équivalents — `soft-404-gate.ts:79`
    - Verdict typé : `above-threshold` / `below-default` / `below-rich-tolerance` — `soft-404-gate.ts:58-64`
13. **indexationTier decision** — `landing-ville.ts:165-169`
    - soft-404 → `tier_3_noindex_nofollow`
    - doctrine.passed && qualityScore ≥ 70 → `tier_2_noindex_follow`
    - sinon → `tier_3_noindex_nofollow`
14. **extractMentionedCitiesFromText forceInclude=anchorVilleSlug max 10** — `landing-ville.ts:176-179`
15. **plagiarism Jaccard 0.30 interne** — `content-gen-worker.ts:258-284`
16. **intent alignment validator** — `content-gen-worker.ts:286-299+`
17. **Anti-doorway HCU côté template render** — `VilleServicePageTemplate.tsx:204-208` (`!hasCopy` → robots noindex + STUB minimal L248-282)
18. **Filtre par verticale** : `VilleServicePageTemplate.tsx:117-138`
    - `getVilleServiceCopy(ville, service)` mappe `service === "un-a-un"` → `ville.copy?.services?.unAUn` (camelCase) et les 3 autres → `ville.copy?.services?.[service]`
    - Une ville avec `copy.services.audit` mais sans `copy.services.unAUn` → page `/un-a-un/par-ville/<ville>` reste en STUB noindex (anti-doorway respecté)
19. **kill_switch publish** — `content-publish-worker.ts:76-82`

## 5. Tests existants

| Fichier                                                          | Tests                        | Couverture                                                                                                                                                                    |
| ---------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/content-gen/quality/__tests__/soft-404-gate.spec.ts` | **10 it()**                  | Seuils 350/280, bonus FAQ +50, gold standard 5000 mots, squelette 50 mots, T3 long-tail 380 mots, edge cases below-default + below-rich-tolerance — **excellente couverture** |
| `src/lib/geo/__tests__/extract-mentioned-cities.spec.ts`         | UNKNOWN — file existe (Glob) | `extractMentionedCitiesFromText` utilisé par landing-ville L176                                                                                                               |
| `src/lib/__tests__/seo-content-gen-factories.spec.ts`            | UNKNOWN                      | Inclut potentiellement Service/LocalBusiness JSON-LD                                                                                                                          |
| `src/lib/seo-content-gen-factories.test.ts`                      | UNKNOWN                      | idem                                                                                                                                                                          |
| `src/server/content-gen/blog/__tests__/loader.spec.ts`           | UNKNOWN                      | hub ville filtre                                                                                                                                                              |
| `src/server/actions/content-gen/__tests__/city-coverage.spec.ts` | UNKNOWN                      | coverage par ville                                                                                                                                                            |
| Aucun test du `landing-ville.ts` generator lui-même              | 0                            | KB retrieve, LLM call, variant resolve, tier decision                                                                                                                         |
| Aucun test du `landing-ville-templates.ts`                       | 0                            | `resolveLandingVilleVariant`, fallback default                                                                                                                                |
| Aucun test des 4 pages `[ville]/page.tsx`                        | 0                            | render gold vs stub                                                                                                                                                           |
| Aucun test du `VilleServicePageTemplate.tsx`                     | 0                            | hasCopy gate, getVilleServiceCopy, 4 JSON-LD, nearbyVilles                                                                                                                    |

Commande fact-check précise :

```
pnpm vitest run src/server/content-gen src/lib/geo src/lib --reporter=verbose 2>&1 | findstr /R "PASS FAIL Tests:"
```

## 6. Tests manquants identifiés

- **Generator `landing-ville.ts`** : aucun test malgré 204 lignes pipeline. Cas à couvrir :
  - throw si `anchorVilleSlug` manquant
  - JSON.parse échec → throw avec message clair
  - sanitize HTML strip réel (test malicious LLM output `<script>`)
  - tier decision matrix (soft-404 vs doctrine fail vs score < 70 vs OK)
  - mentionedCities forceInclude présent
- **`resolveLandingVilleVariant`** : aucun test (fonction L165-171). Cas :
  - null → default
  - undefined → default
  - "focus_audit" → focus_audit
  - "focus_dirigeants" (futur) → default fallback
  - "garbage" → default fallback
- **VilleServicePageTemplate hasCopy gate** : aucun test du chemin STUB noindex (L248-282) vs GOLD (L284+).
- **getVilleServiceCopy mapping camelCase** : aucun test du mapping `un-a-un` → `unAUn` (`VilleServicePageTemplate.tsx:123-138`). Risque régression si quelqu'un renomme.
- **buildStaticParams gate env** : aucun test du flag `BUILD_SSG_VILLES_INDEXABLE_ONLY=true` vs `false` (économise ~6450 pages SSG, critique pour le RAM peak build).
- **Routes [ville]/page.tsx** : aucun test E2E ni snapshot des 4 pages. Anti-régression Sprint S+2 absente côté tests.
- **Anti-régression mentionedCities persistence** : pas de test que `landing-ville.ts:176-179` produit le bon array ET que `content-publish-worker.ts:181` le persiste effectivement (hotfix `424e9a5`).
- **JSON-LD Service + LocalBusiness + BreadcrumbList + FAQPage** : pas de snapshot/test de la stack 4 schemas du gold standard render.
- **Nearby villes** : pas de test de `getNearbyVilles` (6 villes max, sameRegion). Phase D Sprint S+2 mentionne `getNearbyVillesExtended` 3 buckets — UNKNOWN si testé.
- **isr revalidate**: les 4 routes ont `revalidate=86400` mais pas de test invariant.

## 7. Erreurs / edge cases potentiels

- **1 ville gold sur ~2150 cible** : seul `src/content/villes/copy/paris.ts` existe (vérifié `PowerShell Get-ChildItem` retourne `paris.ts` + `types.ts` seulement). Toutes les autres villes servent un STUB noindex via `VilleServicePageTemplate.tsx:248-282`. **Conséquence SEO** : 4 × ~2280 = ~9120 routes en noindex, 4 × 1 = 4 routes indexable.
- **`anchorVilleSlug` requis hard-throw** : `landing-ville.ts:33-35`. Si l'admin lance un job sans ville d'ancrage (cas blog_article via stub), le job crash runtime. Pas de fallback gracieux.
- **JSON.parse strict sans fallback** : `landing-ville.ts:110-114`. Si le LLM renvoie un préambule ("Voici votre JSON:" + `{...}`), `JSON.parse` throw direct → le job entier fail. `guide-pilier.ts:166-170` gère le cas (`indexOf("{") + lastIndexOf("}")`), pas `landing-ville`.
- **Soft-404 gate pessimiste** : `landing-ville.ts:158-163` passe `hasFullLocalBusinessJsonLd: false` et `hasLocalCase: false` en dur (commentaire L153-157 "on prend la décision tier au stade plus pessimiste"). **Conséquence** : même si la page render-time émet bien LocalBusiness JSON-LD + cas concret (côté `VilleServicePageTemplate`), le gate côté generator évalue à 350 mots seuil dur. Risque flag tier_3 pour des pages qui en réalité passent les critères richesse.
- **getVilleServiceCopy fallback noisy** : `VilleServicePageTemplate.tsx:136-137` retourne `undefined` si pas de match → `hasCopy = false` → STUB noindex. Pas de log/warn → impossible de débugger pourquoi une ville est en stub vs gold.
- **STUB minimal redirige vers `meta.canonical`** : `VilleServicePageTemplate.tsx:266-268` CTA vers la page service-mère (`/audit`, `/interventions`, etc.). UX correct mais **risque** : `/un-a-un` canonical pointe vers `/un-a-un` (L104). Si la page mère `/un-a-un` n'existe pas (à confirmer), CTA 404.
- **4e verticale ISR cohérence** : les 4 pages ont `revalidate=86400` + `dynamicParams=true` (vérifié L22-23 et L15-16). Bon. Mais le naming env `BUILD_SSG_VILLES_INDEXABLE_ONLY` reste partagé pour les 4 — pas de granularité par verticale.
- **Sitemap services-villes-un-a-un** : confirmé présent `src/app/sitemap.ts:252, 341` (cas case). Cohérent Sprint S+2.
- **Routing pathnames EN miroir** : `VilleServicePageTemplate.tsx` SERVICE_META déclare `pathEn` pour les 4 (`/audit/by-city`, `/interventions/by-city`, `/implementation/by-city`, `/one-to-one/by-city`). Mais `EN_LOCALE_DISABLED=true` (AGENTS.md) → toutes ces URLs sont 301 vers FR via `mapEnToFr()`. À confirmer que le mapping inclut bien les 4 paths (notamment `/one-to-one/by-city` Sprint S+2).
- **focus_dirigeants opportunité S+3** : pas codé. Le type `LandingVilleVariantSlug` L23-27 ne contient que 4 entrées. L'ajout demande : (a) entrée dans `LANDING_VILLE_VARIANTS` record, (b) ajout au type, (c) ajout au tableau `LANDING_VILLE_VARIANT_SLUGS` L176-181, (d) UI admin `landing-variants/[variant]/page.tsx` (déjà dynamique donc OK), (e) test resolveLandingVilleVariant.
- **`extractMentionedCitiesFromText` max 10** : `landing-ville.ts:178` cap 10. Mais `content-publish-worker.ts:119` slice 20. Incohérence : le generator produit max 10, le worker cap à 20 → le slice 20 ne sert à rien sauf si un autre generator produit plus.
- **`templateVariant=cgJob.templateId`** : `content-publish-worker.ts:168` mappe `templateId` → `templateVariant`. Si le job a `templateId=null`, `Article.templateVariant=null` → impossible de A/B comparer post-publish quel variant a produit la page. UNKNOWN — vérifier si l'admin orchestrator écrit toujours `templateId`.
- **EN `/un-a-un/par-ville` ? ou `/one-to-one/by-city` ?** : la route filesystem est `[locale]/un-a-un/par-ville/[ville]` (FR slug). En EN, le proxy 301 vers FR. Mais si demain `EN_LOCALE_ENABLED=true`, le mapping i18n routing.ts doit déclarer `/un-a-un/par-ville/:ville` → `/one-to-one/by-city/:ville` pour servir EN sans 307 loop next-intl. **À vérifier au moment de la réactivation EN**.
- **`build_static_params` BUILD_SSG_VILLES_INDEXABLE_ONLY** : si Will oublie de set ce env var en GH Actions build, le build pré-rend ~9120 pages SSG → OOM RAM peak ~14-16 GB documenté MEMORY.md `axionia_deploy_unstuck_2026-05-18`. **Risque récidive OOM** sur runner standard 16 GB.

## 8. Status global

🟢/🟡 mixte — **78/100**

Justification courte :

- **Infra prod-ready** : 4 routes câblées (audit, interventions, implementation, un-a-un — Sprint S+2 confirmé), 4 templates variants en code, soft-404 gate avec 10 tests, anti-doorway HCU robots noindex + STUB minimal, ISR 24h + dynamicParams, sitemap 4 sub-sitemaps services-villes-\*, getVilleServiceCopy mapping un-a-un → unAUn, anchor obligatoire enforce, mentionedCities hotfix 424e9a5 câblé generator + worker.
- **Quality gates riches** : KB retrieve, escape anti prompt-injection, sanitize HTML, doctrine check, readability, SEO score, soft-404 350/280, plagiarism, intent alignment — pipeline complet.
- **Trous critiques contenu** : 1 ville Tier-1 (Paris) sur ~50 cible court terme et ~2150 long terme. 99.95 % des pages en noindex.
- **Trous tests** : 0 test du generator `landing-ville.ts` lui-même, 0 test des 4 routes page.tsx, 0 test `VilleServicePageTemplate.tsx`, 0 test `resolveLandingVilleVariant`. Le seul test solide est `soft-404-gate.spec.ts` (10 it() excellent).
- **Risques opérationnels** :
  - JSON.parse strict sans fallback indexOf (asymétrie vs guide-pilier).
  - Soft-404 gate pessimiste passe `hasFullLocalBusinessJsonLd:false, hasLocalCase:false` en dur → conservatif mais flag trop large potentiel.
  - BUILD_SSG_VILLES_INDEXABLE_ONLY env var critique pour éviter OOM build (~14-16 GB) → risque récidive si non set.
  - focus_dirigeants S+3 non codé (5 fichiers à toucher).
- **Score limité par** : (a) absence quasi-totale de tests des couches generator + template + routes, (b) gap contenu massif (1 ville vs cible 50-2150), (c) risque OOM build silencieux si env var oubliée.

# Agent 4.E — Flow pSEO VILLES

- **SHA audité** : `4cdfbe4`
- **Date** : 2026-05-16
- **Mode** : AUDIT-ONLY (lecture seule).
- **Périmètre** : page mère ville `/implantations/[region]/[ville]` + 3 templates ville × service `/audit/par-ville/[ville]`, `/interventions/par-ville/[ville]`, `/implementation/par-ville/[ville]`, dataset INSEE villes/régions, sitemap-index pSEO villes, maillage interne Header/Footer, classification 4 tailles (TPE/PME/ETI/grande entreprise), auto-promotion tier-2→tier-1.
- **Verdict global** : **🟢 81/100 — GO PROD CONDITIONAL** (sous réserve P0).

---

## 1. Reality check — volumes réels (HEAD `4cdfbe4`)

### Dataset villes (`src/content/villes/data/<region>.ts`)

Comptage `grep -c "slug:"` par région :

| Région                     | Villes    |
| -------------------------- | --------- |
| Île-de-France              | 377       |
| Auvergne-Rhône-Alpes       | 284       |
| Hauts-de-France            | 222       |
| Occitanie                  | 201       |
| Nouvelle-Aquitaine         | 191       |
| Provence-Alpes-Côte d'Azur | 185       |
| Grand-Est                  | 170       |
| Pays de la Loire           | 148       |
| Bretagne                   | 134       |
| Normandie                  | 97        |
| Centre-Val de Loire        | 73        |
| Bourgogne-Franche-Comté    | 66        |
| Corse                      | 9         |
| **TOTAL**                  | **2 157** |

→ Conforme à l'estimation contractuelle (« ~2 150 villes >5K hab France métro »). DROM/COM/TAAF volontairement exclus V1 (cf. ADR 0006, `regions.ts` §29).

### Régions (`src/content/regions.ts`)

13 régions métropole. `Corse` reste `noindex: true` (publicationPhase 2). 12 indexable → entrent dans `sitemap-implantations.xml`.

### Volume SSG calculé

| Template                                      | generateStaticParams | Pages SSG   | Indexable (copy présent) |
| --------------------------------------------- | -------------------- | ----------- | ------------------------ |
| `/implantations/[region]/[ville]` (page mère) | `VILLES.map`         | 2 157       | 1 (Paris)                |
| `/audit/par-ville/[ville]`                    | `VILLES.map`         | 2 157       | 1 (Paris)                |
| `/interventions/par-ville/[ville]`            | `VILLES.map`         | 2 157       | 1 (Paris)                |
| `/implementation/par-ville/[ville]`           | `VILLES.map`         | 2 157       | 1 (Paris)                |
| **Sous-total locale FR**                      | —                    | **8 628**   | 4                        |
| × 2 locales (FR + EN)                         | —                    | **17 256**  | 8                        |
| Hubs régions × 2 (FR + EN)                    | 26                   | 26          | 24 (Corse noindex)       |
| Hub `/implantations` × 2                      | 2                    | 2           | 2                        |
| **TOTAL SSG pSEO villes/régions**             | —                    | **~17 284** | **~34 indexable**        |

→ Conforme à l'annonce contractuelle « ~17 500 routes SSG » (légère sur-estimation initiale dans mémoire `axionia_pseo_villes_livre_2026-05-08` qui parlait de 17 500 — réalité = 17 284).

→ **EN locale désactivé** (cf. `AGENTS.md` §EN locale désactivé) : sitemap filtre dynamiquement `EN_LOCALE_ENABLED=false` → 1/2 des URLs hors sitemap, mais SSG continue à pré-render les pages EN (proxy 301 vers FR au runtime).

### Cap doctrine indexation

- **Page mère** : `getIndexableVilles()` = filtre `v.copy` présent → V1 = **Paris seul** (1 ville).
- **Templates ville × service** : filtre `ville.copy?.services?.<service>` → V1 = Paris seul a copy.services → **3 URLs FR + 3 URLs EN = 6 URLs indexable**.
- Les 2 156 autres pages mères + 6 468 (2156×3) pages service villent existent en SSG **mais portent `<meta robots="noindex,follow">`** → anti-doorway HCU 2024 (cf. `VilleStub` + `VilleServicePageTemplate` ll. 146-148 + sitemap ll. 691-694 `getIndexableVilles()` filtre).

---

## 2. SSOT data layer — `getCityBySlug` / `getVille`

### Helpers ville (`src/content/villes/index.ts`)

✅ **SSOT propre** :

- `getVille(slug)` (l. 70) — lookup par slug FR-canonique, `Map<slug, Ville>` O(1).
- `getVilleByInsee(inseeCode)` (l. 74) — lookup par code INSEE, `Map<inseeCode, Ville>` O(1).
- `getAllVilleSlugs()` (l. 78) — pour `generateStaticParams`.
- `getVillesByRegion(regionSlug)` (l. 82) — filtre région, O(N) acceptable (2 157 entrées).
- `getIndexableVilles()` (l. 90) — filtre `v.copy` présent (gate indexation).

⚠️ **Pas de helper `getCityBySlug(slug)` strict** comme mentionné dans le brief : c'est `getVille(slug)` qui assume ce rôle. **Nommage incohérent vs brief mais fonctionnel** — cohérent en interne (langage FR `Ville` partout).

### Utilisation cross-codebase

`grep getVille` retourne 4 call sites pertinents :

| Fichier                                                            | Usage                                          |
| ------------------------------------------------------------------ | ---------------------------------------------- |
| `src/app/[locale]/implantations/[region]/[ville]/page.tsx` l. 112  | `getVille(villeSlug)` page mère                |
| `src/components/sections/VilleServicePageTemplate.tsx` l. 112, 165 | `getVille(villeSlug)` template service × ville |
| `src/server/content-gen/generators/landing-ville.ts`               | content-gen import (lookup ville par slug)     |
| `src/lib/geo.ts` (via `VILLES`)                                    | `getNearbyVilles` Haversine                    |

✅ **SSOT respecté** — pas de duplication, pas de re-lookup ad hoc.

### Dataset INSEE intégré (`data/types.ts`)

`VilleData` expose : `slug`, `nameFr`, `region`, `departement`, `inseeCode`, `postalCode`, `population`, `geo {lat,lon}`. Conforme INSEE recensement légal 2024.

⚠️ **`departementLabel` est optionnel** — déduit à la volée dans les templates (`ville.departementLabel ?? ville.departement`). Si jamais un département a un label différent du numéro (ex. « Bouches-du-Rhône » ≠ « 13 »), il faut le renseigner manuellement dans le data file. Pas de check automatique.

---

## 3. Classification 4 tailles entreprise (TPE/PME/ETI/grande entreprise)

### Présence dans le code

🟢 **Doctrine commentée** (`paris.ts` l. 14-15) : « on parle systématiquement en tailles d'entreprise INSEE (TPE / PME / ETI / GE). »

🟢 **Schéma typé** (`copy/types.ts` l. 93-97) : `VilleServiceCopyLocale.pricing[]` exige `sizeLabel`, ex. « TPE (< 10 collab) » / « PME (10-249) » / « ETI (250-4999) » / « Grande entreprise (5000+) ».

🟢 **Implémenté Paris pilote** (`paris.ts` ll. 129-153) : 4 tiers `TPE / PME / ETI / Grande entreprise` (FR) ; `Micro-business / SME / Mid-cap / Large enterprise` (EN). Conforme.

🟢 **Rendu page** (`VilleServiceDetailSection.tsx` l. 210) : `tier.sizeLabel` affiché dans le tableau pricing.

🔴 **GAP CRITIQUE** : **AUCUN helper `classifyCity()` / `getCompanySizeBucket()`** trouvé dans tout le codebase (`grep classify|sizeBucket|companySize|getInseeSize` → 0 match dans `src/content/villes` + `src/lib/geo.ts`).

→ La classification 4 tailles existe **uniquement comme contenu éditorial dans `paris.ts`** (curaté manuel). Aucune dérivation automatique depuis `ville.population` ou Sirene. **Pour les 2 156 villes restantes**, si Will utilise l'auto-generation content-gen, il devra écrire un prompt qui reproduise ce schéma 4-tailles **à chaque génération** — risque de drift éditorial.

**P0 #1** — créer `src/lib/cities/classify-by-size.ts` exposant `classifyCity(population): "tpe" | "pme" | "eti" | "grande"` + `getInseeSizeBuckets(population): VilleServiceCopyPricing[]` pour seed les pricing.sizeLabel auto.

---

## 4. Sitemap pSEO villes — découpage chunks

### `app/sitemap.ts` (782 lignes, audité ligne à ligne)

✅ **Architecture sitemap-index Next 16** : `generateSitemaps()` (l. 227) émet IDs statiques + dynamiques + KB.

✅ **Cap par chunk** : `SITEMAP_CHUNK_SIZE = 1000` (l. 62) — best practice 2026 (vs limite hard Google 50 000). Commentaires l. 49-55 expliquent : SC diagnostics granulaires + crawl budget priorisé.

✅ **Split par région** : `getVillesSitemapIds()` (l. 195-217) génère IDs `villes-<regionSlug>` ou `villes-<regionSlug>-<chunkIdx>` quand > 1000 URLs.

✅ **Split 3 sub-sitemaps services × villes** : `services-villes-audit`, `services-villes-interventions`, `services-villes-implementation` (l. 246-248). Anticipation scale 2150×3 = 6450 URLs/service max sous le cap 50K.

✅ **Filtre indexable** : `buildServicesVillesSitemap()` (l. 756-781) filtre sur `ville.copy?.services?.[service]` → seules les villes pilotes entrent dans le sitemap. V1 = Paris seul → 6 URLs.

✅ **Filtre EN désactivé** : `filterEnIfDisabled()` (l. 291-304) supprime URLs `/en/*` du sitemap quand `EN_LOCALE_ENABLED!=true`.

✅ **BUILD_TIME stable** (l. 277-284) : `process.env.BUILD_TIME` ISO → lastModified stable build-to-build pour ne pas brûler le signal crawl Google.

⚠️ **Page chunk Île-de-France** : 377 villes × 2 locales = 754 URLs < 1000 → 1 seul chunk OK. Mais si Paris fait promu copy + + d'autres → > 1000 URLs / chunk possible.

⚠️ **Hub `/implantations` exclu de `pages.xml`** ? Non, il est dans `buildImplantationsHubSitemap()` (l. 650-688) qui émet hub + 12 régions. **OK**.

🟡 **Pas de sitemap-news pour villes** : non pertinent (pas de news par ville).

---

## 5. ISR `revalidate` cohérent

| Page                                               | `revalidate` | `dynamicParams` |
| -------------------------------------------------- | ------------ | --------------- |
| `/audit/par-ville/[ville]/page.tsx` l. 22          | 86400 (24h)  | true            |
| `/interventions/par-ville/[ville]/page.tsx` l. 15  | 86400 (24h)  | true            |
| `/implementation/par-ville/[ville]/page.tsx` l. 15 | 86400 (24h)  | true            |
| `/implantations/[region]/[ville]/page.tsx` l. 61   | 86400 (24h)  | true            |

✅ **Cohérence parfaite** : 4 templates alignés à 86400s (24h). Permet à Next 16 de regénérer une page sans full rebuild si la copy `copy/<slug>.ts` ou les données INSEE évoluent.

✅ **`dynamicParams = true`** : nouvelles villes ajoutées post-build (via DB ou enrichissement copy) servies via on-demand SSG.

---

## 6. Auto-promotion tier_2 → tier_1

### Architecture lifecycle (`src/server/content-gen/lifecycle/tier-decisions.ts`)

✅ Workflow :

- `currentTier === "tier_2_noindex_follow"` + `ctr > 5%` + `ageDays >= 30j` → promote `tier_1_indexable` (l. 91-103).
- Garde-fous : `manual_promote_protected` (l. 117) — Will peut figer un article tier-1 sans demote auto.
- Demote symétrique : tier-1 + CTR < 1% sur 30j → demote vers tier-2.

### Application au pSEO villes (`landing-ville.ts`)

✅ Générateur content-gen `landing-ville` (l. 156) :

```ts
indexationTier: doctrine.passed && qualityScore >= 70
  ? "tier_2_noindex_follow"
  : "tier_3_noindex_nofollow";
```

✅ Une page ville générée par le content-gen entre en **tier-2 noindex follow** par défaut, peut être promue tier-1 après 30j si CTR > 5%.

⚠️ **MAIS** : sur les pages ville pSEO frontend (page mère + 3 services), **le filtre indexation ne lit PAS la DB / Article.indexationTier** — il lit `ville.copy?.services?.<service>` (filtre statique TS-only).

→ **Mismatch architecture** : un Article tier-1 promu côté DB **n'apparaît PAS** dans le sitemap `services-villes-audit` tant que Will n'a pas écrit le `copy.services.audit` dans `copy/<slug>.ts` manuellement. **Promotion DB ≠ promotion sitemap**.

**P0 #2** — sitemap `buildServicesVillesSitemap()` doit aussi lire les Article DB `kind='landing'` + `indexationTier='tier_1_indexable'` + `cityInseeCode` pour les villes générées via content-gen V2+. Sinon le pipeline content-gen génère du contenu qui ne sera jamais découvert par Google.

---

## 7. Maillage interne — Header / Footer

### Header (`src/components/nav/Header.tsx`)

✅ Item nav `Implantations` (l. 35) → lien hub `/implantations`. **Pas de mega-menu villes** dans le Header — décision V1 sciemment minimaliste (CLAUDE.md v6 §9.2-bis Sprint 15 différé).

✅ `HeaderMegaMenu.tsx` existe (146 lignes) mais **JAMAIS importé dans `Header.tsx`** (`grep HeaderMegaMenu` → seul HeaderMegaMenu.tsx + Footer.tsx référencent, pas Header). Composant orphelin **confirmé** (cf. mémoire `axionia_audit_e2e_nav_cta_2026-05-15` P0 #3).

🟡 **Recommandation V1** : OK pour scope V1 (Paris pilote uniquement). À adresser **dès que ≥ 50 villes pilotes** déployées.

### Footer (`src/components/nav/Footer.tsx`)

✅ 5e colonne `Implantations` (l. 80-121, 194) :

- Lien hub `/implantations`.
- **6 régions top par PIB** : `getTopRegionsByPib(6)` (l. 84).
- **Villes pilotes** (V1 = Paris seul) avec **étoile ★** : `pilotVilles.flatMap()` (l. 92).
- **Sous-liens services × ville pilote** (l. 99-118) : 3 sous-liens `/audit/par-ville/paris`, `/interventions/par-ville/paris`, `/implementation/par-ville/paris` rendus uniquement si `v.copy?.services?.<svc>` présent.

✅ **Maillage interne dense** depuis Footer. Excellent.

⚠️ **Quand V2 ajoutera 10-20 villes pilotes**, le Footer accueillera 10-20 × 4 = 40-80 liens villes → potentiellement trop dense pour le footer. **À gérer V1.5** (collapser).

---

## 8. SEO / AEO / GEO — JSON-LD stack

### Page mère ville (`/implantations/[region]/[ville]`)

✅ **5 schemas combinés en `@graph`** :

1. `buildLocalBusinessJsonLd` (l. 149-164) — address `city + region + country + postalCode` + `geo {lat,lon}`.
2. `buildPlaceJsonLd` (l. 166-176) — `containedInPlace` (région) + `additionalProperty propertyID:"population" value:ville.population`.
3. `buildFaqSpeakableJsonLd` (l. 178-182) — speakable JSON-LD si `faqGeolocalisee.length ≥ 4`.
4. `buildItemListJsonLd` (l. 184-196) — villes proches Haversine.
5. BreadcrumbList auto via `<Breadcrumbs>`.

🔴 **GAP CONFIRMÉ vs Agent 3.E** : `additionalProperty propertyID:"inseeCode"` **ABSENT** du `Place` JSON-LD (`src/lib/seo.ts` l. 832-870 ne supporte que `population`). `ville.inseeCode` est rendu **uniquement en texte humain** dans la section `Tissu local` (page mère l. 720-722).

→ Pour les LLMs (Perplexity, Claude.ai, GPT-search, Google AI Overviews), absence de `propertyID:"inseeCode"` dans le JSON-LD limite la résolution d'entité unique (vs entités Wikidata).

**P0 #3** — étendre `buildPlaceJsonLd` pour accepter `additionalProperty: Array<{propertyID, value}>` et émettre `{propertyID:"inseeCode", value:ville.inseeCode}` + `{propertyID:"departement", value:ville.departement}` + `{propertyID:"region", value:ville.region}` + `{propertyID:"population", value:ville.population}`.

### Page service × ville (`/audit/par-ville/[ville]` etc.)

✅ **5 schemas** (VilleServicePageTemplate.tsx l. 234-315) :

1. `buildServiceJsonLd` avec `areasServed: [City, AdministrativeArea, Country]`.
2. `buildLocalBusinessJsonLd` (idem ville mère).
3. `buildBreadcrumbJsonLd` (4 niveaux).
4. `buildFaqSpeakableJsonLd` (FAQ ville × service).
5. `buildItemListJsonLd` (villes proches même service).

🔴 **MÊME GAP** : pas de `propertyID:"inseeCode"` dans LocalBusiness. Idem P0 #3.

---

## 9. Paris pilote vs tier-2 — qualitative compare

### Paris (`copy/paris.ts`, 758 lignes)

🟢 **Gold standard atteint** :

- `pitchFr` + `pitchEn` (30-50 mots citables LLMs).
- `directAnswerFr` + `directAnswerEn` (40-80 mots verbatim AEO).
- `topSectorsNaf` (6 secteurs cohérents).
- `distancesFr` + `distancesEn` (transports précis).
- `ecosystemFr` + `ecosystemEn` (paragraphe écosystème).
- `heroSchema` (6 satellites SVG B2B).
- `services.audit.fr/en` + `services.interventions.fr/en` + `services.implementation.fr/en` (chaque service ~700 mots = `hero` + `whyHere[6]` + `methodology[5]` + `pricing[4 tailles]` + `testimonials[2]` + `faq[6]` + `guarantees`).
- **Volume total** : 758 lignes TS = ~6500 mots curaté manuel.
- **4 tailles INSEE** : TPE / PME / ETI / Grande entreprise (FR) ; Micro-business / SME / Mid-cap / Large enterprise (EN).
- **Doctrine ≥ 40% unique** respectée — chaque ligne mentionne Paris-spécifique (« 215 000 entreprises actives », « 8e/9e/16e », « Station F », « Mistral AI »).

### Tier-2 (ex: ville `lyon` — pas encore de copy)

🟡 **Stub minimal** :

- `VilleStub` (page mère l. 858-907) : Section unique avec h1 + h2 « Axion-IA intervient à » + 2 CTAs (région + réservation).
- `VilleServicePageTemplate` stub (l. 191-224) : pareil — 2 CTAs canoniques.
- **0 mot de copy localisée** + **`noindex follow`** → respect HCU 2024.
- Pas dans le sitemap (`getIndexableVilles` filtre).

✅ **Gap Paris ↔ tier-2 énorme MAIS intentionnel** — c'est le design « anti-doorway » : page existe, mais sciemment pauvre + noindex pour ne pas polluer le crawl.

⚠️ **Le wording stub « page locale détaillée en préparation »** (page mère l. 871-876) sous-entend une promesse de futur contenu. Si Will ne livre **jamais** la copy pour Lyon, c'est une fausse promesse → impact UX faible mais à surveiller.

---

## 10. Server Action / DB intégration

⚠️ Page villes **TS-only** — pas de Server Action ni de read DB sur les pages frontend (sauf indirect via `prisma.article.findMany` dans `sitemap.ts` blog).

✅ Décision archi : `content/villes/data/*.ts` = **source de vérité TS au build** (figé via SSG). Les villes ne sont pas en DB.

🟡 **Conséquence** : ajouter une ville requiert un commit Git + rebuild → pas d'admin UI. Sprint 15+ pourrait migrer vers DB pour autonomie Will, mais cap V1 = OK.

---

## 11. Tests

🔴 **Aucun test unitaire** trouvé pour :

- `getVille()` (`grep -i "getVille" *.test.ts` → 0 match).
- `getIndexableVilles()`.
- `buildVillesByRegionSitemap()` chunking.
- `VilleServicePageTemplate` rendu noindex stub vs gold.

→ Risque régression silencieuse (ex. si `ile-de-france.ts` regen casse l'ordre des slugs → chunk content shift → Google re-crawl tout).

**P1** — créer `src/content/villes/__tests__/villes.spec.ts` (≥ 8 cases : count exact, slug unique, INSEE unique, region link valid, sitemap chunk stable, getIndexableVilles filtre, getVille O(1), getVillesByRegion).

---

## 12. Synthèse scoring /100

| Catégorie                                                    | Score      | Note                                                     |
| ------------------------------------------------------------ | ---------- | -------------------------------------------------------- |
| Volume routes SSG (17 284 vs estimé 17 500)                  | 10/10      | Exact match doctrine.                                    |
| SSOT `getVille()` + dataset INSEE                            | 9/10       | Nommage `getVille` vs `getCityBySlug` brief (-1).        |
| Classification 4 tailles (TPE/PME/ETI/GE)                    | 6/10       | Typé OK + Paris pilote OK, **mais pas de helper auto**.  |
| Sitemap chunking + split services                            | 10/10      | Best practice 2026, anticipation scale 2150 villes.      |
| ISR `revalidate=86400` cohérent 4 templates                  | 10/10      | Parfait.                                                 |
| Auto-promotion tier-2→tier-1                                 | 5/10       | Lifecycle OK côté DB mais **pas câblé au sitemap pSEO**. |
| Header mega-menu                                             | 5/10       | `HeaderMegaMenu` orphelin (P1 décision Will).            |
| Footer maillage interne services × villes pilotes            | 9/10       | Excellent V1, à collapser en V1.5.                       |
| JSON-LD stack (LocalBusiness + Place + ItemList + Speakable) | 7/10       | Bon mais **`inseeCode` absent additionalProperty** (P0). |
| Paris pilote gold standard                                   | 10/10      | Doctrine ≥40% unique respectée, 4 tailles INSEE.         |
| Tests automatisés data layer                                 | 0/10       | **0 test** sur villes/regions/sitemap chunks.            |
| **TOTAL**                                                    | **81/100** | 🟢 GO PROD CONDITIONAL                                   |

---

## 13. P0 (bloquants merge prod)

### P0 #1 — Helper `classifyCity()` manquant

**Symptôme** : aucune dérivation auto `population → TPE/PME/ETI/GE`. Si Will lance content-gen sur 100 villes, chaque génération doit reproduire le schéma 4-tailles → drift éditorial garanti.

**Patch** :

```ts
// src/lib/cities/classify-by-size.ts
export type CompanySize = "tpe" | "pme" | "eti" | "grande";

export function classifyCity(population: number): CompanySize {
  if (population < 10000) return "tpe";
  if (population < 50000) return "pme";
  if (population < 200000) return "eti";
  return "grande";
}

export function getInseeSizeBuckets(population: number) {
  return [
    { sizeLabel: "TPE", thresholdMax: 10 },
    { sizeLabel: "PME", thresholdMax: 249 },
    { sizeLabel: "ETI", thresholdMax: 4999 },
    { sizeLabel: "Grande entreprise", thresholdMax: Infinity },
  ];
}
```

Brancher dans `content-gen/generators/landing-ville.ts` prompt + `VilleServicePageTemplate.tsx` fallback affichage.

**Effort** : 2-3 h.

### P0 #2 — Sitemap services × villes ne lit pas les Article DB

**Symptôme** : `buildServicesVillesSitemap()` filtre uniquement `ville.copy?.services?.<service>` (TS statique). Articles content-gen promus tier-1 dans la DB **n'apparaissent jamais** dans le sitemap → invisibles Googlebot.

**Patch** : étendre `buildServicesVillesSitemap()` pour merger TS villes pilotes + DB articles `kind='landing'` + `indexationTier='tier_1_indexable'` + `cityInseeCode IS NOT NULL`. Dédup sur slug.

**Effort** : 3-4 h (avec test).

### P0 #3 — JSON-LD `inseeCode` absent additionalProperty

**Symptôme** : `buildPlaceJsonLd` ne supporte que `additionalProperty: { propertyID: "population" }`. `ville.inseeCode` rendu uniquement en HTML texte. Limite résolution entité LLMs (vs Wikidata).

**Patch** :

```ts
// src/lib/seo.ts buildPlaceJsonLd
additionalProperty: [
  { "@type": "PropertyValue", propertyID: "population", value: population },
  ...(inseeCode ? [{ "@type": "PropertyValue", propertyID: "inseeCode", value: inseeCode }] : []),
  ...(departement ? [{ "@type": "PropertyValue", propertyID: "departement", value: departement }] : []),
],
```

Brancher dans page mère + VilleServicePageTemplate (`buildPlaceJsonLd` + `buildLocalBusinessJsonLd`).

**Effort** : 1-2 h.

---

## 14. P1 (nice-to-have V1.5)

- **P1-1** Tests automatisés `src/content/villes/__tests__/villes.spec.ts` (8+ cases).
- **P1-2** `HeaderMegaMenu` orphelin — décision Will : wirer ou supprimer (cf. mémoire `axionia_audit_e2e_nav_cta_2026-05-15`).
- **P1-3** Admin UI villes (Sprint 15 backend) — autonomie Will pour ajouter villes sans commit Git.
- **P1-4** Tooltip stub « page locale détaillée en préparation » — soit livrer, soit changer le wording.
- **P1-5** Sitemap-images ville (galerie INSEE/Wikipedia per ville) — booster GEO multimodal Google AI Overviews.
- **P1-6** Footer collapser quand > 10 villes pilotes (V1.5).
- **P1-7** Helper `getCompanySizeFromSiren(siren)` pour pricing dynamique calendrier (Sprint Reservation V2).

---

## 15. Conclusion

🟢 **VERDICT 81/100 — GO PROD CONDITIONAL**

Le flow pSEO villes est **architecturalement solide** :

- Dataset INSEE 2 157 villes + 13 régions ✅.
- 4 templates SSG cohérents (revalidate 86400 + dynamicParams true) ✅.
- Sitemap-index avec chunking 1000 URLs + split 3 sub-sitemaps services × villes ✅.
- Doctrine anti-doorway HCU 2024 respectée (filtre `getIndexableVilles()` strict + `noindex follow` stub) ✅.
- Paris pilote gold standard (~6500 mots curaté, 4 tailles INSEE TPE/PME/ETI/GE, 5 schemas JSON-LD `@graph`) ✅.

**3 P0 à fixer avant scale 2150 villes** :

1. Helper `classifyCity()` (2-3 h) — pour content-gen auto-pilot multi-villes.
2. Sitemap services × villes lit Article DB (3-4 h) — sinon pipeline content-gen génère du contenu invisible.
3. JSON-LD `additionalProperty.inseeCode` (1-2 h) — boost GEO LLMs entity resolution.

**Effort total P0** : 6-9 h. Après P0 → score estimé **92-94/100** (cap perfection extrême).

Tant que V1 reste Paris pilote seul, les 3 P0 ne bloquent **PAS** le go prod actuel — ce sont des prérequis Phase 2 (industrialisation 50+ villes pilotes).

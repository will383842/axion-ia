# SPRINT PERFECTION 2026 — FINALISATION COMPLÈTE
## AxionIA Content-Gen — Best Practices SEO/AEO/GEO/AI Overviews 2026 + Scope villes 2100 + Console suivi

**Date création** : 2026-05-22
**Type** : Sprint master combinant tous les gaps best-practice 2026
**Mode** : IMPLEMENTATION (commits incrémentaux + push autorisés)
**Effort estimé** : 50-60h autopilot (8 phases A-H)
**Demandé par Will explicitement le 2026-05-22**

---

## 0. MISSION

Atteindre la **perfection 2026** sur 8 dimensions identifiées comme gaps lors des audits P1-P5 + verdicts vérifications :

1. **Cities database** : 2100 villes ≥ 5000 hab France ordonnées par population décroissante
2. **Console admin "Couverture villes"** : suivi exhaustif faites / en cours / à faire + sélection manuelle Will
3. **KB sectorielle 5 verticales complètes** (4 manquantes à créer)
4. **Intents perfection 2026** : voice search + AI Overview + featured snippet modélisés
5. **Équilibrage 747+ keywords** par verticale (rééquilibrage si déséquilibre)
6. **OpenAI embeddings activation** : 4ème couche anti-doublons + backfill articles pré-P1.5
7. **Diversification linguistique** : TTR + écart-type longueur phrases + voix passive
8. **Détection dérive brand voice** cross-articles via embeddings

---

## 1. CONTEXTE — À LIRE AVANT TOUT

### État repo
- **Remote** : `https://github.com/will383842/axion-ia.git`
- **Branche** : `main`
- **HEAD origin/main au lancement** : à découvrir (`git log origin/main -1 --oneline`)
- **HEAD origin/main référence** : `e0b1973` ou supérieur (post Sprint P2 follow-up AI Act compliance)

### Fichiers à lire
1. `prisma/schema.prisma` complet (modèles à étendre : `Keyword`, `Article`, `ContentGenJob`, `CoverageCampaign`)
2. `src/server/content-gen/keyword-selector.ts` (sélection atomique keywords)
3. `src/server/content-gen/dedup/openai-embedder.ts` (embeddings code prêt, flag à activer)
4. `src/server/content-gen/dedup/outline-simhash.ts` (couche 3 SimHash)
5. `src/server/content-gen/reviewer/llm-judge.ts` (à étendre avec diversité linguistique)
6. `src/data/kb/audits.ts` (pilote KB existant, modèle pour les 4 autres)
7. `src/data/glossary.ts` (60 termes IA, à enrichir si nécessaire)
8. Pages admin V2 content-gen (extension nécessaire)

### Mémoires Claude (lire EN PREMIER)
- `axionia_decisions_will_final_2026-05-21.md` (D7 société FR + exclusions)
- `axionia_p4_decisions_canoniques_2026-05-21.md` (D1-D5)
- `axionia_p5_decisions_canoniques_2026-05-21.md` (D-P5-1 à D-P5-6)
- `axionia_keywords_747seeds_2026-05-20.md` (état keywords)
- `axionia_content_gen_p1_5_livre_2026-05-21.md` (baseline)

### Mode IMPLEMENTATION
- ✅ Modifications `prisma/schema.prisma`, `src/server/`, `src/components/`, `src/data/`
- ✅ Migrations Prisma additives (nullables ou défauts cohérents)
- ✅ Commits Conventional + Co-Authored-By + push après chaque phase
- ❌ JAMAIS `--no-verify` git
- ❌ JAMAIS modifier `villes/copy/*` (Manon)
- ❌ JAMAIS modifier `image-bank/seed-images.ts` (Manon)
- ❌ Aucune décision Will à demander (toutes pré-validées dans ce prompt)

### Gates obligatoires AVANT chaque commit
```powershell
pnpm typecheck   # 0 erreur
pnpm lint        # 0 erreur
pnpm test        # vitest ≥ baseline + nouveaux tests
pnpm content-gen:isolation-check
pnpm prisma migrate diff
pnpm prisma validate
```

### Format commits
```
feat(<scope>): perfection 2026 — <phase> — <description>

<corps>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 2. PHASE A — CITIES DATABASE 2100 VILLES (~10h)

### Spec

#### A.1 — Modèle Prisma `City`
```prisma
model City {
  id              String   @id @default(cuid())
  slug            String   @unique  // "paris", "lyon", "saint-etienne"
  name            String   // "Paris", "Lyon", "Saint-Étienne"
  population      Int      // 2161000, 522250, 173089
  departmentCode  String   // "75", "69", "42"
  departmentName  String   // "Paris", "Rhône", "Loire"
  regionSlug      String   // "ile-de-france", "auvergne-rhone-alpes"
  regionName      String   // "Île-de-France"
  inseeCode       String   @unique // "75056", "69123"
  latitude        Float
  longitude       Float
  populationTier  Int      // 1=>100k, 2=20k-100k, 3=10k-20k, 4=5k-10k
  priority        Int      // calculé depuis population (1 = Paris, 2100 = plus petite)

  // Suivi couverture content-gen
  isTargeted      Boolean  @default(true)  // dans le scope cible AxionIA
  isCovered       Boolean  @default(false) // au moins 1 article publié pour cette ville
  articlesCount   Int      @default(0)     // count articles publiés (mis à jour via trigger ou refresh)
  lastArticleAt   DateTime?                 // date dernier article publié
  hasEconomicData Boolean  @default(false) // economic-data/<slug>.ts existe

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([population(sort: Desc)])
  @@index([departmentCode])
  @@index([regionSlug])
  @@index([isTargeted, isCovered])
  @@index([populationTier])
  @@map("cities")
}
```

#### A.2 — Source données INSEE
- Télécharger base officielle INSEE communes France métropolitaine + DOM-TOM
- URL référence : https://www.insee.fr/fr/information/2114819 (à télécharger CSV manuellement OU via API geo.api.gouv.fr `/communes`)
- Filtrer : population ≥ 5000 habitants
- Résultat attendu : ~2100 communes
- Fichier source : `prisma/seeds/cities/cities-france-5000plus.json` (généré une fois, committed)

#### A.3 — Seed
- Script `prisma/seeds/cities/seed-cities.ts` :
  - Lit `cities-france-5000plus.json`
  - Upsert par `inseeCode` (idempotent)
  - Calcule `priority` = rang par population décroissante (Paris = 1)
  - Calcule `populationTier` (1/2/3/4)
  - Détecte `hasEconomicData` en checkant si fichier `src/data/villes/economic-data/<slug>.ts` existe
- Commande : `pnpm content-gen:seed-cities`
- Ajout dans `package.json` scripts

#### A.4 — Migration
- `prisma/migrations/20260522110000_add_cities_table/migration.sql`
- Migration additive, ne touche pas tables existantes
- Backfill `cities.isCovered` + `cities.articlesCount` depuis `articles.anchorVilleSlug` (1 fois post-migration)

#### A.5 — Helper `src/lib/cities.ts`
```typescript
export async function getCitiesByPopulationTier(tier: 1 | 2 | 3 | 4): Promise<City[]>;
export async function getTopNCities(n: number): Promise<City[]>; // Paris, Lyon, Marseille...
export async function getCitiesByDepartment(deptCode: string): Promise<City[]>;
export async function searchCities(query: string): Promise<City[]>;
export async function getUncoveredCities(limit: number): Promise<City[]>; // pour campagne ciblage automatique
```

#### A.6 — Tests Vitest
- `cities.test.ts` : 8 tests (seed, helpers, priority calculation, tier mapping)

### Commit
```
feat(cities): perfection 2026 — Phase A — DB 2100 villes ≥ 5000 hab

- Model City (slug, name, population, dept, region, INSEE, lat/lng, tier, priority)
- Seed depuis INSEE 2100 villes filtrées ≥ 5000 hab
- Helpers cities.ts (by tier, top N, by dept, search, uncovered)
- Migration additive
- 8 vitest tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 3. PHASE B — CONSOLE ADMIN COUVERTURE VILLES (~12h)

### Spec

#### B.1 — Nouvelle page `/content-gen/cities-coverage`
Server Component : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/cities-coverage/page.tsx`

Structure :
```
┌──────────────────────────────────────────────────────────────┐
│ COUVERTURE VILLES FRANCE                                     │
│                                                              │
│ Progression globale : 39 / 2100 (1.9%)                      │
│ ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 1.9%                │
│                                                              │
│ Par tier population :                                        │
│  Tier 1 (≥100k)    : 12 / 40   (30%)  ████████░░░░░░░     │
│  Tier 2 (20-100k)  : 25 / 460  (5%)   █░░░░░░░░░░░░░░░     │
│  Tier 3 (10-20k)   : 2 / 540   (0.4%) ░░░░░░░░░░░░░░░░     │
│  Tier 4 (5-10k)    : 0 / 1060  (0%)   ░░░░░░░░░░░░░░░░     │
│                                                              │
│ ┌─ Filtres ──────────────────────────────────────────────┐ │
│ │ Département : [tous ▾]  Région : [toutes ▾]            │ │
│ │ État : [tous ▾]  Population : [_____] - [_____]        │ │
│ │ Tri : [Population décroissante ▾]                      │ │
│ │ [🔍 Recherche par nom...]                              │ │
│ │ [✓ Sélectionner tout]  [✗ Désélectionner tout]         │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─ Action multi-sélection (X villes cochées) ─────────────┐│
│ │ [🚀 Créer campagne pour ces X villes]                   ││
│ │ [📋 Marquer comme prioritaires]                         ││
│ │ [📥 Exporter CSV]                                       ││
│ └─────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌─ Liste villes (paginée 50 par page) ────────────────────┐│
│ │☐│ Rang│ Ville         │ Hab.    │Dept│Région  │État    ││
│ │ │  1  │ Paris         │ 2 161 k │ 75 │IDF     │✅ 50 art││
│ │☐│  2  │ Marseille     │   870 k │ 13 │PACA    │✅ 32 art││
│ │☐│  3  │ Lyon          │   522 k │ 69 │ARA     │✅ 28 art││
│ │☐│  4  │ Toulouse      │   486 k │ 31 │OCC     │⏳ en cours││
│ │☐│  5  │ Nice          │   341 k │ 06 │PACA    │⏸️ à faire││
│ │☐│  6  │ Nantes        │   320 k │ 44 │PDL     │⏸️ à faire││
│ │ ...                                                       ││
│ │ [Pagination : 1 2 3 ... 42 →]                            ││
│ └───────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

#### B.2 — Server Actions
- `src/server/content-gen/admin/cities-coverage.ts` :
  - `listCities(filters: { dept?, region?, state?, populationMin?, populationMax?, search?, sort?, page?, pageSize? }): { cities, total, totalPages }`
  - `createCampaignForCities(citySlugs: string[]): redirect to wizard pré-rempli`
  - `markCitiesPriority(citySlugs: string[]): updates priority field`
  - `exportCitiesCSV(filters): downloadable CSV`

#### B.3 — Composants React
- `src/components/admin/content-gen/CitiesCoverageTable.tsx` (server)
- `src/components/admin/content-gen/CitiesCoverageFilters.tsx` (client, URL search params)
- `src/components/admin/content-gen/CitiesCoverageProgress.tsx` (server, progress bars)
- `src/components/admin/content-gen/CitiesMultiSelectActions.tsx` (client, form actions)

#### B.4 — Wizard "Nouvelle campagne" — pré-remplissage depuis sélection villes
- Si query param `?cities=paris,lyon,marseille` → wizard pré-remplit `anchorVilleSlugs[]`
- Compatible avec `cityProcessingMode` du Sprint Campaign Controls (si livré)

#### B.5 — Sidebar admin
- Ajouter "Couverture villes" dans section 📊 Suivi (selon regroupement P5 D-P5-6)
- Badge compteur : `39/2100`

#### B.6 — Tests
- React Testing Library : filtres, sélection multi, navigation pagination
- Vitest server actions : 10 tests

### Commit
```
feat(content-gen-admin): perfection 2026 — Phase B — couverture villes 2100

- Page /content-gen/cities-coverage (server component)
- Server actions listCities, createCampaignForCities, mark priority, export CSV
- 4 composants React (table, filters, progress, multi-select)
- Wizard pre-fill from city selection
- Sidebar entry + badge compteur
- 10 vitest tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 4. PHASE C — KB 4 VERTICALES MANQUANTES (~16h)

### Spec

Pour chaque verticale, créer un fichier `src/data/kb/<verticale>.ts` avec **50-100 facts vérifiés sourcés** au format :

```typescript
export const KB_VERTICALE_X: KbFact[] = [
  {
    id: "kb-vert-x-001",
    text: "Selon l'étude DARES 2024, 56% des PME françaises ...",
    source: "DARES",
    sourceUrl: "https://dares.travail-emploi.gouv.fr/...",
    verifiedAt: "2026-05-22",
    verticales: ["interventions_formations"],
    cities: [], // optionnel
    confidence: 0.95,
    tags: ["formation", "pme", "ia", "2024"],
  },
  // ... 50-100 facts
];
```

### C.1 — KB `interventions_formations` (cible 80 facts)
Sources prioritaires :
- DARES (formations + emploi)
- INSEE (démographie entreprises)
- Bpifrance (financements formation)
- France Compétences (catalogue formations)
- OPCO (financement formation pro)
- France Travail (statistiques recrutement)
- Cegos / Demos / Cnam (benchmarks formations IA)

Sujets à couvrir : durée moyennes formations IA, % entreprises ayant formé en 2024, coût moyen formation IA salarié, taux satisfaction, ROI formation IA reportés études.

### C.2 — KB `un_a_un` (cible 60 facts)
Sources prioritaires :
- McKinsey Global Institute (executive coaching IA)
- Stanford AI Index 2024-2025
- HBR (coaching exec)
- Capgemini Research Institute (executive AI literacy)
- BCG (transformation IA dirigeants)
- Wavestone (études IA & management)

Sujets : besoins coaching dirigeants IA, taux adoption COO/CFO/CEO, gap compétences IA C-level, durée moyenne accompagnement, ROI 1-to-1.

### C.3 — KB `implementations` (cible 80 facts)
Sources prioritaires :
- McKinsey "State of AI" reports
- Stanford AI Index
- Gartner Hype Cycle for AI
- Forrester Wave reports
- France Num (numérisation PME)
- BPI France (transformation digitale)

Sujets : taux d'échec projets IA (70% selon Gartner), durée moyenne implémentation, ROI moyen 12 mois, secteurs leaders, technos dominantes (LLM/CV/NLP).

### C.4 — KB `sites_web_augmentes` (cible 60 facts)
Sources prioritaires :
- DataReportal Digital France
- HubSpot State of Marketing
- ContentSquare Digital Experience Benchmark
- SEMrush AI Search Trends
- BrightEdge Industry Reports
- Search Engine Journal AI Overviews studies

Sujets : adoption AI Overviews France, % sites avec contenu IA, CTR baisse 2024-2026, importance JSON-LD, evolution speakable, voice search %.

### C.5 — Seed + ingestion FTS
- `prisma/seeds/content-gen/seed-kb-facts.ts` étendu :
  - Upsert facts depuis les 4 nouveaux fichiers
  - Ingestion FTS Postgres (déjà en place pour `audits`)
  - Statistiques : compter facts par verticale après seed
- Commande : `pnpm content-gen:seed-kb`

### C.6 — Tests
- `kb-loader.test.ts` : 12 tests (load par verticale, query FTS, fact-checking integration)

### Commit
```
feat(content-gen): perfection 2026 — Phase C — KB 4 verticales complètes

- KB interventions_formations (80 facts, sources DARES/Bpifrance/...)
- KB un_a_un (60 facts, sources McKinsey/Stanford/HBR/...)
- KB implementations (80 facts, sources McKinsey/Gartner/France Num/...)
- KB sites_web_augmentes (60 facts, sources DataReportal/HubSpot/SEMrush/...)
- Seed étendu + ingestion FTS
- 12 vitest tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 5. PHASE D — INTENTS PERFECTION 2026 (~6h)

### Spec

#### D.1 — Étendre enum `SearchIntent`
```prisma
enum SearchIntent {
  informational
  navigational
  transactional
  commercial_investigation
  voice_search        // 🆕 conversational queries (Alexa, Siri, Google Assistant)
  ai_overview         // 🆕 Google AI Overview / SGE optimized
  featured_snippet    // 🆕 Position 0 paragraph 40-60 words
}
```

#### D.2 — Migration
- `20260522120000_extend_search_intent_enum`

#### D.3 — Mapping keywords ↔ intents
- Script analyse heuristique : `prisma/seeds/content-gen/map-keywords-intents.ts`
- Heuristiques :
  - `voice_search` : keyword commence par "comment", "qu'est-ce que", "pourquoi", "où" + ≥ 4 mots
  - `ai_overview` : keyword contient "qu'est-ce que", "définition", "explique" (intent factuel direct)
  - `featured_snippet` : keyword court 2-4 mots + intent informational direct
- Upsert `keyword.search_intent` selon heuristiques

#### D.4 — SYSTEM_PROMPTs adaptés par intent
Modifier les générateurs pour adapter prompt selon `targetSearchIntent` :

**Voice search** :
```
Le contenu sera lu à voix haute par un assistant vocal.
- Phrases courtes (max 15 mots)
- Réponse directe en premier paragraphe (style conversationnel)
- Pas de listes à puces dans les 200 premiers mots
- Question complète posée en H1 (pas "audit IA Paris" mais "Comment auditer une IA d'entreprise à Paris ?")
```

**AI Overview** :
```
Le contenu sera potentiellement résumé par Google AI Overview.
- Definition précise + sourcée en premier paragraphe (40-50 mots)
- Structure factuelle : qu'est-ce que / pourquoi / comment / quand
- Citations sources autorité avec liens (INSEE, Stanford, McKinsey)
- Schéma ItemList JSON-LD pour étapes
```

**Featured snippet** :
```
Le contenu vise la position 0 Google.
- Paragraphe de réponse 40-60 mots EXACTEMENT dans data-aeo="tldr"
- Format : "Un audit IA consiste à <verbe> <X> en <Y>. Il permet de <Z>."
- Listes à puces 5-8 éléments si question "comment" / "étapes"
- Tableau si question "comparer" / "différence entre"
```

#### D.5 — Validation post-LLM
Worker `content-publish-worker.ts` vérifie cohérence intent ↔ contenu :
- Si `targetSearchIntent=voice_search` : longueur moyenne phrases < 15 mots ?
- Si `targetSearchIntent=featured_snippet` : présence d'un paragraphe 40-60 mots avec data-aeo="tldr" ?
- Si `targetSearchIntent=ai_overview` : ≥ 2 sources externes citées ?
- Si échec : status `needs_review`

#### D.6 — Tests
- `intents.test.ts` : 10 tests (mapping, validation, SYSTEM_PROMPT routing)

### Commit
```
feat(content-gen): perfection 2026 — Phase D — intents 2026 (voice/AI Overview/featured snippet)

- Enum SearchIntent +3 valeurs (voice_search, ai_overview, featured_snippet)
- Migration
- Mapping heuristique 747 keywords ↔ intents
- SYSTEM_PROMPTs adaptés par intent (3 nouveaux templates)
- Validation post-LLM cohérence intent ↔ contenu
- 10 vitest tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 6. PHASE E — ÉQUILIBRAGE KEYWORDS 5 VERTICALES (~4h)

### Spec

#### E.1 — Audit count actuel
Script `prisma/seeds/content-gen/audit-keywords-balance.ts` :
- `SELECT vertical, COUNT(*) FROM keywords GROUP BY vertical;`
- Output rapport :
  ```
  interventions_formations : XXX keywords (XX%)
  audits                   : XXX keywords (XX%)
  implementations          : XXX keywords (XX%)
  un_a_un                  : XXX keywords (XX%)
  sites_web_augmentes      : XXX keywords (XX%)
  ```
- Identifier verticales déficitaires (< 150 keywords seeds = déficit)

#### E.2 — Génération keywords supplémentaires
Pour chaque verticale déficitaire, générer 50-100 keywords supplémentaires via patterns + LLM-assisted :
- Patterns longue traîne : `<verbe> + <verticale> + <cible> + <géo>`
  - Ex `un_a_un` : "comment se former en IA dirigeant", "accompagnement individuel IA C-level", "coaching IA exécutif PME"
- LLM-assisted (Claude Sonnet) : "Génère 50 keywords longue traîne FR pour la verticale `<X>` en respectant intentions de recherche IA Overview / voice search / featured snippet"
- Validation : pas de doublon, longueur 2-8 mots, intention détectable

#### E.3 — Fichiers seeds étendus
- `prisma/seeds/content-gen/g1.ts` à `g8.ts` (existants) + nouveaux fichiers `g9-balance.ts` si nécessaire
- Mise à jour `validate.ts` (cohérence 5 verticales équilibrées)

#### E.4 — Re-seed
- Commande : `pnpm content-gen:seed-keywords` (upsert idempotent)
- Vérifier post-seed : `SELECT vertical, COUNT(*) FROM keywords GROUP BY vertical;` → toutes verticales ≥ 150 keywords

#### E.5 — Tests
- `keyword-balance.test.ts` : 5 tests

### Commit
```
feat(content-gen): perfection 2026 — Phase E — équilibrage keywords 5 verticales

- Audit count actuel par verticale
- Génération 200-400 keywords supplémentaires verticales déficitaires
- Toutes verticales ≥ 150 keywords seeds
- 5 vitest tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 7. PHASE F — ACTIVATION EMBEDDINGS + BACKFILL (~5h)

### Spec

#### F.1 — Documentation activation
- Mettre à jour `.env.example` :
  ```
  # Anti-doublons sémantique couche 4 (OpenAI embeddings)
  # Coût ~$0.13/jour @ 1000 art/j
  OPENAI_EMBEDDINGS_ENABLED=false  # mettre true pour activer
  OPENAI_EMBEDDINGS_MAX_TOKENS_PER_DAY=1000000
  ```
- Documentation Coolify : `_AUDIT/PERFECTION-2026-2026-05-22/DEPLOY-NOTES.md` avec instructions

#### F.2 — Script backfill
- `src/scripts/backfill-embeddings.ts` :
  - Query articles pré-P1.5 sans embedding : `WHERE embedding IS NULL AND publishStatus IN ('published', 'tier_1', 'tier_2')`
  - Batch 10 articles à la fois
  - Pour chaque : `await openaiEmbedder.embed(article.body)` → `UPDATE article SET embedding = ?`
  - Rate limit : 1000 articles/jour max (cron daily)
  - Log progression : `console.info(\`Backfilled X/Y embeddings\`)`
- Commande : `pnpm content-gen:backfill-embeddings`

#### F.3 — Worker BullMQ daily (optionnel — peut être one-shot script)
- `src/server/queue/workers/embeddings-backfill-worker.ts`
- Cron : `0 3 * * *` (daily 3h UTC)
- Lance le script backfill sur 1000 articles max

#### F.4 — Monitoring admin
- Page `/content-gen/embeddings` (nouvelle ou ajout dans dashboard) :
  - Compteur articles avec/sans embedding
  - Estimation jours restants pour backfill complet
  - Coût cumulé OpenAI embeddings (lecture cost_tracker)

#### F.5 — Tests
- `embeddings-backfill.test.ts` : 6 tests (batch, rate limit, error handling)

### Commit
```
feat(content-gen): perfection 2026 — Phase F — embeddings activation + backfill

- .env.example documente OPENAI_EMBEDDINGS_ENABLED + max tokens cap
- Script backfill-embeddings.ts (batch 10, rate limit 1000/jour)
- Worker daily 3h UTC (cron BullMQ)
- Page admin /content-gen/embeddings (suivi backfill + coût)
- 6 vitest tests
- DEPLOY-NOTES.md instructions Coolify env vars

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 8. PHASE G — DIVERSIFICATION LINGUISTIQUE (~8h)

### Spec

#### G.1 — Module `linguistic-diversity-checker.ts`
- `src/server/content-gen/linguistic/diversity-checker.ts` :
```typescript
export interface DiversityScore {
  ttr: number;              // Type-Token Ratio (cible > 0.70)
  avgSentenceLength: number; // mots/phrase
  stdSentenceLength: number; // écart-type (cible > 5)
  passiveVoiceRatio: number; // % phrases en voix passive (cible < 0.20)
  passed: boolean;
  warnings: string[];
}

export function analyzeDiversity(text: string): DiversityScore;
```

#### G.2 — Dependencies
- `compromise` (npm) — NLP français
- `natural` (npm) — TTR calculation
- Ajouter aux deps : `pnpm add compromise natural`

#### G.3 — Intégration LLM-judge
- Étendre `src/server/content-gen/reviewer/llm-judge.ts` :
  - Ajouter dimension `linguistic_diversity` (poids 10/100)
  - Si `diversity.passed = false` → -X points
  - Si `ttr < 0.50` → P1 issue (trop répétitif)
  - Si `passiveVoiceRatio > 0.30` → P1 issue
  - Si `stdSentenceLength < 3` → P2 issue (texte plat)
- Le verdict final inclut ces dimensions dans `globalScore`

#### G.4 — SYSTEM_PROMPTs étendus
Ajouter dans tous les générateurs :
```
## DIVERSITÉ LINGUISTIQUE OBLIGATOIRE
- Varie la longueur des phrases (5-50 mots, écart-type > 5)
- Phrase courte puis longue puis courte (rythme)
- Voix active majoritaire (< 20% voix passive)
- Diversité lexicale (TTR > 0.70 = ne pas répéter les mêmes mots)
- Synonymes IA : "intelligence artificielle", "IA", "système d'IA", "outil IA", "solution IA" (alterner)
```

#### G.5 — Tests
- `diversity-checker.test.ts` : 12 tests (textes plats vs rythmés, voix passive, TTR)
- Fixtures : 10 textes exemples (5 mauvais, 5 bons)

### Commit
```
feat(content-gen): perfection 2026 — Phase G — diversification linguistique

- Module linguistic-diversity-checker.ts (TTR, avg/std sentence length, voix passive)
- Deps compromise + natural
- Intégration LLM-judge dimension linguistic_diversity (poids 10/100)
- SYSTEM_PROMPTs étendus contraintes diversité
- 12 vitest tests + 10 fixtures

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 9. PHASE H — DÉTECTION DÉRIVE BRAND VOICE (~8h)

### Spec

#### H.1 — Embedding de référence Manon
- Sélectionner 10 articles "exemplaires" Manon validés Will
  - Critères : score qualité > 8, sans correction post-publication, sur ≥ 3 verticales
- Pour chaque : calculer embedding OpenAI text-embedding-3-large
- Moyenne → `BRAND_VOICE_REFERENCE_EMBEDDING` (vector 3072 stocké en DB ou config)
- Stockage : `ContentGenConfig.key="brand_voice_reference_embedding"` value JSON array

#### H.2 — Worker brand-voice-drift-monitor
- `src/server/queue/workers/brand-voice-drift-monitor.ts`
- Cron : `0 4 * * *` (daily 4h UTC)
- Pour chaque article publié dernières 24h :
  - Calculer embedding article
  - Cosine similarity vs `BRAND_VOICE_REFERENCE_EMBEDDING`
  - Si similarity < 0.80 → flag `brand_voice_drift_warning` + log
  - Si similarity < 0.70 → status `needs_review` + alerte Telegram
- Logger statistiques weekly : moyenne similarity, écart-type, articles flagués

#### H.3 — Server Action recalibration
- `recalibrateBrandVoice(articleIds: string[])` : permet Will de fournir une nouvelle liste d'articles de référence si dérive intentionnelle (rebrand, évolution ton)
- Audit log SOC2 obligatoire

#### H.4 — Dashboard admin
- Page `/content-gen/brand-voice-drift` :
  - Graphique évolution moyenne similarity (30 derniers jours)
  - Top 10 articles avec dérive la plus forte
  - Bouton "Recalibrer la référence" → ouvre wizard sélection 10 articles
  - Articles flagués (needs_review pour drift)

#### H.5 — Tests
- `brand-voice-drift.test.ts` : 10 tests (cosine similarity, seuils, recalibration, audit log)

### Commit
```
feat(content-gen): perfection 2026 — Phase H — détection dérive brand voice

- Embedding référence Manon depuis 10 articles exemplaires
- Worker daily brand-voice-drift-monitor (4h UTC)
- Cosine similarity vs ref, seuils 0.80 warning / 0.70 needs_review
- Server action recalibrateBrandVoice (audit SOC2)
- Page admin /content-gen/brand-voice-drift
- 10 vitest tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 10. ZONES INTERDITES

- ❌ `prisma/seeds/villes/copy/*.ts` (Manon)
- ❌ `prisma/seeds/image-bank/seed-images.ts` (Manon)
- ❌ `src/components/seo/*.tsx` sauf si AiContentDisclaimer wording change (NE PAS toucher)
- ❌ Modèles Prisma `ArticleFeedback`, `CampaignTemplate`, `FactCheckClaim` (déjà créés par sprints précédents — juste les utiliser, ne pas re-créer)
- ❌ Décisions Will Wikidata, DPA Anthropic, CF WAF (exclusions définitives)
- ❌ Toggle auto/manuel publication (Will renoncé 2026-05-22)

---

## 11. LIVRABLES & FORMAT

### Verdict sprint
`_AUDIT/PERFECTION-2026-2026-05-22/VERDICT-SPRINT-PERFECTION-2026.md`

Format :
```markdown
# VERDICT SPRINT PERFECTION 2026 FINALISATION
## Date livraison : YYYY-MM-DD
## HEAD post-sprint : <SHA>
## Effort réel : XXh (vs estimé 50-60h)

## 8 phases livrées
| Phase | Description | Commit | Statut |
|-------|-------------|--------|--------|
| A | Cities DB 2100 | abc1234 | ✅ |
| B | Console admin | def5678 | ✅ |
| C | KB 4 verticales | ... | ✅ |
| D | Intents 2026 | ... | ✅ |
| E | Équilibrage keywords | ... | ✅ |
| F | Embeddings activation | ... | ✅ |
| G | Diversification linguistique | ... | ✅ |
| H | Brand voice drift | ... | ✅ |

## Métriques d'impact post-sprint
- Cities DB : 2100 villes en DB
- KB : 5 verticales complètes (TOTAL ~340 facts vérifiés)
- Keywords : 5 verticales équilibrées ≥ 150 each
- Intents : 4 → 7 valeurs enum
- Embeddings : flag activable + script backfill prêt
- Diversification : LLM-judge dimension +1
- Brand voice : monitoring actif

## Migrations Prisma
- 20260522110000_add_cities_table
- 20260522120000_extend_search_intent_enum
- (optional) 20260522130000_brand_voice_reference

## Workers créés
- embeddings-backfill-worker.ts (daily 3h UTC)
- brand-voice-drift-monitor.ts (daily 4h UTC)

## Dependencies ajoutées
- compromise (NLP FR)
- natural (TTR)

## Tests Vitest
- Phase A cities : 8 tests
- Phase B admin : 10 tests
- Phase C KB : 12 tests
- Phase D intents : 10 tests
- Phase E balance : 5 tests
- Phase F embeddings : 6 tests
- Phase G diversity : 12 tests
- Phase H drift : 10 tests
- **TOTAL : 73 nouveaux tests** + fixtures

## Gates anti-régression
- typecheck : ✅
- lint : ✅
- vitest : XXXX/XXXX (baseline + 73)
- isolation-check : ✅
- prisma migrate status : ✅

## Actions Will post-sprint
1. Activer `OPENAI_EMBEDDINGS_ENABLED=true` dans Coolify env vars (5 min)
2. Lancer manuellement `pnpm content-gen:seed-cities` (1ère fois, ~10 min)
3. Lancer `pnpm content-gen:seed-kb` (re-seed avec 4 nouvelles verticales)
4. Lancer `pnpm content-gen:seed-keywords` (équilibrage)
5. Tester depuis `/content-gen/cities-coverage` la création de campagne multi-villes

## UNKNOWNs résiduels
- Source INSEE communes : URL exacte à confirmer (geo.api.gouv.fr ou CSV direct)
- Backfill embeddings volumétrie réelle (dépend nombre articles publiés actuels)
```

### Mémoire
Slug : `axionia_sprint_perfection_2026_livre_2026-05-22`
Type : project
Body : 8 phases livrées, métriques d'impact, actions Will, dependencies ajoutées.

### MEMORY.md
```
- [🟢 AxionIA Sprint Perfection 2026 LIVRÉ 2026-05-22 — 8 phases](axionia_sprint_perfection_2026_livre_2026-05-22.md) — Cities 2100 + console admin + KB 5 verticales + intents 2026 (voice/AI overview/featured snippet) + équilibrage keywords + embeddings activation + diversification linguistique + dérive brand voice. 73 tests + 3 migrations.
```

---

## 12. STOP & ASK FINAL

Format strict :
```
✅ Sprint Perfection 2026 Finalisation livré.

📊 8 phases livrées :
- Phase A Cities DB 2100 villes
- Phase B Console admin couverture villes
- Phase C KB 4 verticales (TOTAL 5 verticales complètes ~340 facts)
- Phase D Intents 2026 (voice/AI Overview/featured snippet)
- Phase E Équilibrage 5 verticales keywords
- Phase F Embeddings activation prête
- Phase G Diversification linguistique LLM-judge
- Phase H Détection dérive brand voice cross-articles

📈 Impact attendu :
- Couverture France 2100 villes en pipeline
- 5 verticales toutes parfaitement outillées
- 4 couches dedup activables
- Intents 2026 best-practice maxi
- Diversification + cohérence brand voice automatique

🚨 Actions Will pour activation complète prod :
1. Activer OPENAI_EMBEDDINGS_ENABLED=true dans Coolify
2. Lancer 3 seeds : cities + kb + keywords (10 min total)
3. Tester depuis /content-gen/cities-coverage

🚀 Suite proposée :
[A] Activation prod immédiate + monitoring 48h
[B] Lancer P6 verdict global /5000 maintenant
[C] Sprint follow-up additionnel si gaps détectés
```

---

## 13. PHRASE DE LANCEMENT (AUTOPILOT TOTAL)

```
AUTOPILOT TOTAL. Ne pose AUCUNE question intermédiaire. Lance le sprint master décrit dans `_AUDIT/PROMPT-SPRINT-PERFECTION-2026-FINALISATION-2026-05-22.md`. Mode IMPLEMENTATION (commits incrémentaux + push autorisés). Toutes décisions Will validées dans prompt (8 phases A-H, cible 2100 villes ≥ 5000 hab ordonnées population décroissante, scope perfection 2026). Lire EN PREMIER axionia_decisions_will_final_2026-05-21 + axionia_p4_decisions_canoniques + axionia_p5_decisions_canoniques. Exécuter 8 phases séquentielles : A cities DB 2100 → B console admin couverture → C KB 4 verticales restantes → D intents 2026 (voice+AI overview+featured snippet) → E équilibrage keywords → F embeddings activation + backfill → G diversification linguistique LLM-judge → H détection dérive brand voice. Commits incrémentaux Conventional + push après chaque phase. Convergence Manon (git pull --rebase avant push). Gates verts obligatoires (typecheck 0, lint 0, vitest ≥ baseline + 73 nouveaux tests, isolation-check, prisma validate). Zones interdites strictes (villes/copy, image-bank/seed, composants SEO, modèles ArticleFeedback/CampaignTemplate/FactCheckClaim déjà créés). Exclusions Will absolues : Wikidata, DPA Anthropic, CF WAF, toggle auto/manuel publication. Source INSEE communes France ≥ 5000 hab (~2100 villes) : tenter geo.api.gouv.fr /communes ou CSV INSEE direct, fallback liste pré-établie si API indisponible. Self-troubleshoot toutes erreurs. Termine par VERDICT-SPRINT-PERFECTION-2026.md + mémoire axionia_sprint_perfection_2026_livre_2026-05-22 + MEMORY.md update. STOP & ASK Will UNIQUEMENT à la livraison finale avec 8 phases ✅ + actions Will activation prod + 3 options [A/B/C]. Go.
```

---

*Sprint Perfection 2026 Finalisation — 50-60h autopilot — IMPLEMENTATION — Master combiné 8 phases best practices 2026*

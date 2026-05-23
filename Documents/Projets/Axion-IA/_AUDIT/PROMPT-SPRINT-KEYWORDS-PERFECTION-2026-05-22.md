# SPRINT KEYWORDS PERFECTION 2026 — Stratégie de mots-clés N°1 France
## AxionIA Content-Gen — Audit + Génération + Diversité sémantique + Domination concurrentielle

**Date création** : 2026-05-22
**Type** : Sprint dédié keywords (qualité + couverture + sémantique + géolocalisation)
**Mode** : IMPLEMENTATION (commits incrémentaux + push autorisés)
**Effort estimé** : 40-50h autopilot (8 phases)
**Demandé par Will explicitement le 2026-05-22** : "il faut la perfection pour les mots clés"

---

## 0. MISSION

Atteindre la **perfection mots-clés** sur 8 axes pour devenir **N°1 en France et dans chaque ville** sur les 5 verticales AxionIA :

1. **Audit qualité 747 seeds existants** (sémantique, couverture, redondance, qualité)
2. **Couverture sémantique exhaustive** par verticale (clusters thématiques complets)
3. **Équilibrage strict** : ≥ 250 keywords par verticale (cible 1250+ keywords total)
4. **Diversité intentionnelle** : informational + transactional + commercial + voice search + AI Overview + featured snippet
5. **Analyse concurrentielle** : identifier où les concurrents ranquent (axionai.fr + KPMG IA + McKinsey IA FR + Capgemini IA + Wavestone + Sia Partners + Cegos + Demos + OpenClassrooms + autres)
6. **Géolocalisation 2100 villes** : générer keywords ville-spécifiques pour les pages locales
7. **Console admin keyword strategy** : visualisation + sélection + reporting
8. **Tracking opportunités** : étendre `KeywordTracking` avec intelligence concurrentielle

---

## 1. CONTEXTE — À LIRE AVANT TOUT

### État repo
- **Remote** : `https://github.com/will383842/axion-ia.git`
- **Branche** : `main`
- **HEAD origin/main** : à découvrir
- **Pré-requis** : Sprint Perfection 2026 Finalisation (Cities DB 2100) peut être livré AVANT ce sprint (pour bénéficier de la table `City`), OU en parallèle avec coordination Prisma.

### Fichiers source à lire EN PROFONDEUR
1. `src/content/keywords/master.ts` (agrégation `ALL_KEYWORD_SEEDS`)
2. `src/content/keywords/types.ts` (interface `KeywordSeed`)
3. `src/content/keywords/validate.ts` (règles validation existantes)
4. Les 17 fichiers thématiques :
   - `g1-audit.ts` — Audits
   - `g2-interventions.ts` — Interventions/Formations
   - `g3-implementation-codage.ts` — Implémentations + Codage
   - `g3b-web-digital-augmente.ts` — Sites Web Augmentés
   - `g4-aeo.ts` — AEO (Answer Engine Optimization)
   - `g5-comparatifs-partenaires.ts` — Comparatifs
   - `g6-sectoriels-coaching.ts` — Coaching 1-to-1
   - `g7a/b/c-secteurs-*.ts` — Sectoriels
   - `g8-audiences-manquantes.ts` — Audiences
   - `h-notoriete.ts` — Brand AxionIA
   - `i-geo.ts` — Géolocalisé
   - `j-presse.ts` — Presse
   - `m-positionnements.ts` — Positionnements
   - `x-supplements.ts` — Compléments
5. `prisma/schema.prisma` modèle `Keyword` + `KeywordTracking`
6. `prisma/seeds/content-gen/seed-keywords.ts`
7. `src/server/content-gen/keyword-selector.ts`

### Mémoires Claude
- `axionia_keywords_747seeds_2026-05-20.md` (état initial)
- `axionia_keyword_strategy_audit_2026-05-19.md` (audit stratégie 2026-05-19, score 700/1600)
- `axionia_decisions_will_final_2026-05-21.md` (D7 société FR + exclusions Wikidata/DPA/CF)

### Mode IMPLEMENTATION
- ✅ Modifications `src/content/keywords/`, `prisma/schema.prisma`, `prisma/seeds/`, `src/server/content-gen/`, `src/components/admin/content-gen/`
- ✅ Migration Prisma additive
- ✅ Commits Conventional + push après chaque phase
- ❌ JAMAIS `--no-verify`
- ❌ JAMAIS modifier `villes/copy/*` (Manon)
- ❌ JAMAIS modifier `image-bank/seed-images.ts` (Manon)
- ❌ Exclusions Will : Wikidata, DPA, CF WAF

### Gates obligatoires AVANT chaque commit
```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm content-gen:isolation-check
pnpm prisma migrate diff
pnpm prisma validate
pnpm tsx src/content/keywords/validate.ts  # validation seeds keywords (règles métier)
```

---

## 2. PHASE 1 — AUDIT QUALITÉ 747 SEEDS EXISTANTS (~5h)

### Spec

#### 1.1 — Script d'audit exhaustif
Créer `src/scripts/audit-keywords-quality.ts` qui produit un rapport :

```typescript
interface KeywordAuditResult {
  total: number;
  byVertical: Record<string, number>;
  bySearchIntent: Record<string, number>;
  byLongTail: { short: number, long: number };
  byLocal: { local: number, national: number };
  duplicatesSemantic: Array<{ kw1: string, kw2: string, similarity: number }>;
  duplicatesExact: string[];
  weakKeywords: Array<{ keyword: string, reason: string }>; // ex : 1 mot, intent mal défini, etc.
  clusters: Record<string, string[]>; // groupements thématiques
  coverageGaps: Array<{ verticale: string, missingCluster: string, examples: string[] }>;
  intent2026Coverage: { voice_search: number, ai_overview: number, featured_snippet: number };
  geoCoverage: { citiesAvecKeywords: number, citiesSansKeywords: number };
  concurrentialIntelligence: Array<{ keyword: string, concurrentRank: string, axionGap: string }>;
}
```

#### 1.2 — Méthodologie d'audit
- **Doublons sémantiques** : embeddings OpenAI text-embedding-3-large + cosine similarity > 0.85 = doublon probable
- **Couverture intent** : ratio par type (informational vs transactional vs commercial_investigation vs voice vs AI overview vs featured snippet)
- **Couverture longue traîne** : ratio courte (1-2 mots) vs longue (3+ mots) — cible : 30% / 70%
- **Clusters thématiques** : K-means sur embeddings → identifier 8-15 clusters par verticale
- **Gaps couverture** : pour chaque verticale, identifier les sous-domaines manquants (ex : si `audits` n'a aucun keyword sur `audit-rgpd-ia` → gap)
- **Qualité linguistique** : keyword trop court (<2 mots), trop générique, trop technique sans contexte
- **Géolocalisation** : ratio keywords géolocalisés (avec `cityIds[]` non-vide ou `isLocal=true`) — cible : 40%

#### 1.3 — Rapport d'audit livrable
`_AUDIT/KEYWORDS-PERFECTION-2026-05-22/01-AUDIT-QUALITE-EXISTANT.md`

Format :
```markdown
# AUDIT QUALITÉ KEYWORDS — 747 seeds existants
## Date : YYYY-MM-DD
## Score global qualité : XXX/1000

## Distribution par verticale
| Verticale | Count | % du total | Verdict |
|-----------|-------|------------|---------|
| audits | XXX | XX% | ✅/⚠️/🔴 |
| ...

## Distribution par intent
...

## Top 50 doublons sémantiques détectés
...

## Top 50 keywords faibles
...

## Clusters détectés (8-15 par verticale)
...

## Gaps couverture identifiés
...

## Recommandations Top 20 actions
...
```

### Commit
```
feat(content-gen): keywords perfection — Phase 1 — audit qualité 747 seeds existants

- Script audit-keywords-quality.ts
- Embeddings semantic deduplication
- K-means clustering thématique
- Rapport 01-AUDIT-QUALITE-EXISTANT.md
- 6 tests vitest

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 3. PHASE 2 — COUVERTURE SÉMANTIQUE EXHAUSTIVE PAR VERTICALE (~10h)

### Spec

Pour CHAQUE des 5 verticales, identifier puis créer les **clusters thématiques** complets avec 15-25 keywords par cluster.

### 2.1 — Verticale `audits`
Clusters obligatoires (~12 clusters × 15-25 keywords = 200-300 keywords pour cette verticale) :

| Cluster | Exemples keywords cibles |
|---------|--------------------------|
| `audit-securite-ia` | "audit sécurité IA entreprise", "vulnérabilités IA", "audit pentest IA", "sécuriser modèle LLM" |
| `audit-rgpd-ia` | "audit RGPD intelligence artificielle", "DPIA IA", "conformité RGPD chatbot", "audit protection données IA" |
| `audit-performance-ia` | "audit performance modèle IA", "benchmark LLM entreprise", "optimisation latence IA", "audit infrastructure IA" |
| `audit-couts-ia` | "audit coût IA", "ROI intelligence artificielle PME", "réduire facture IA", "optimisation tokens LLM" |
| `audit-strategie-ia` | "audit stratégie IA entreprise", "feuille de route IA PME", "vision IA dirigeant", "roadmap transformation IA" |
| `audit-bias-ethique-ia` | "audit biais IA", "éthique intelligence artificielle entreprise", "AI bias detection", "fairness IA recrutement" |
| `audit-prompt-engineering` | "audit prompts IA", "qualité prompts LLM", "prompt engineering audit", "améliorer prompts entreprise" |
| `audit-infrastructure-ia` | "audit infra IA on-premise", "audit cloud IA", "audit GPU entreprise", "audit MLOps" |
| `audit-formation-equipe-ia` | "audit compétences IA équipe", "skill gap IA entreprise", "diagnostic formation IA salariés", "audit AI literacy" |
| `audit-roi-ia` | "audit ROI projet IA", "mesurer impact IA", "KPI IA entreprise", "audit financier IA" |
| `audit-conformite-ai-act` | "audit AI Act conformité", "audit règlement européen IA", "compliance AI Act PME", "auto-audit AI Act" |
| `audit-fournisseurs-ia` | "audit fournisseurs IA", "due diligence vendor IA", "audit prestataires LLM", "audit sous-traitants IA" |

Pour CHAQUE cluster :
- 5-7 keywords **courte traîne** (2-3 mots) — informational
- 5-7 keywords **longue traîne** (4-8 mots) — transactional/commercial
- 3-5 keywords **voice search** (style question) — voice_search intent
- 2-3 keywords **featured snippet** (étapes / définition) — featured_snippet intent
- 2-3 keywords **AI Overview** (réponse directe sourçable) — ai_overview intent
- Par cible (tpe / pme / eti) au moins 1 variation

### 2.2 — Verticale `interventions_formations`
Clusters obligatoires :
- `formation-ia-debutants`
- `formation-ia-dirigeants`
- `formation-ia-developpeurs`
- `formation-prompt-engineering`
- `formation-llm-fine-tuning`
- `formation-rag-vectoriel`
- `formation-ia-marketing`
- `formation-ia-rh`
- `formation-ia-finance`
- `formation-ia-juridique`
- `formation-ia-secteurs-publics`
- `formation-certifications-ia`

200-300 keywords pour cette verticale.

### 2.3 — Verticale `un_a_un` (coaching 1-to-1)
Clusters obligatoires :
- `coaching-ia-ceo`
- `coaching-ia-dirigeants-pme`
- `coaching-ia-comex`
- `accompagnement-ia-personnel`
- `mentoring-ia-cto`
- `coaching-transformation-digitale-ia`
- `ia-literacy-dirigeants`
- `executive-briefing-ia`
- `strategie-ia-personnel`
- `coaching-investissement-ia`

150-250 keywords.

### 2.4 — Verticale `implementations`
Clusters obligatoires :
- `implementation-chatbot-entreprise`
- `integration-llm-saas`
- `deploiement-rag-interne`
- `integration-ia-crm`
- `integration-ia-erp`
- `automation-rpa-ia`
- `agents-ia-autonomes`
- `voice-ia-entreprise`
- `vision-ia-industrie`
- `nlp-ia-juridique`
- `analyse-predictive-ia`
- `recommandation-ia-ecommerce`

200-300 keywords.

### 2.5 — Verticale `sites_web_augmentes`
Clusters obligatoires :
- `seo-ia-2026`
- `aeo-answer-engine-optimization`
- `geo-generative-engine-optimization`
- `content-generation-ia`
- `pseudoSEO-pSEO-ia`
- `personnalisation-site-ia`
- `chatbot-site-web`
- `search-vocal-site`
- `optimisation-ai-overviews`
- `featured-snippets-strategy`
- `schema-markup-ia`
- `web-vitals-ia`

150-250 keywords.

### 2.6 — Méthodologie de génération
Pour chaque cluster, Claude utilise :
1. **Templates expansion** : `<verbe action> <terme cluster> <cible> <géo>`
2. **Questions naturelles** : "comment", "pourquoi", "quel coût", "quelle durée", "où trouver"
3. **Comparatifs** : "vs", "ou", "différence entre"
4. **Sectoriels** : croiser avec secteurs (santé, finance, retail, industrie, etc.)
5. **Cas d'usage** : "pour PME industrie", "pour cabinet conseil", "pour startup"

### 2.7 — Validation qualité automatique
- Pas de doublon (exact + sémantique > 0.85)
- Longueur 2-12 mots
- Pas de fautes orthographe (validateur français)
- Recherche réaliste (heuristique : pas de combinaison improbable)
- Intent détectable (au moins 1 intent assigné)

### Livrables
- 17 nouveaux fichiers ou enrichissements `src/content/keywords/g1*` à `g3b*` + nouveaux fichiers par cluster si nécessaire
- Total : ~1000-1500 nouveaux keywords structurés
- Validation : `pnpm tsx src/content/keywords/validate.ts` doit passer

### Commit
```
feat(content-gen): keywords perfection — Phase 2 — couverture sémantique 5 verticales

- 5 verticales × 10-12 clusters chacune
- 200-300 keywords par verticale
- Total ~1250 keywords supplémentaires (5 verticales × 250)
- Tous validés (pas de doublon, intent assigné, longueur OK)
- 8 tests vitest

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 4. PHASE 3 — ÉQUILIBRAGE STRICT ≥ 250 PAR VERTICALE (~3h)

### Spec
- Après Phase 2, audit final : compter keywords par verticale
- Cible minimale : **250 keywords par verticale** (sera dépassée vu Phase 2 ~300 chacune)
- Cible totale : **1500+ keywords** (vs 747 initial)
- Si une verticale < 250 après Phase 2 : générer keywords supplémentaires (low-hanging fruit : longue traîne géo)

### Validation
```sql
SELECT vertical, COUNT(*) FROM keywords GROUP BY vertical ORDER BY COUNT(*) DESC;
-- Tous les comptes DOIVENT être ≥ 250
```

### Commit
```
feat(content-gen): keywords perfection — Phase 3 — équilibrage strict ≥ 250 par verticale

- Toutes 5 verticales ≥ 250 keywords
- Total ≥ 1500 keywords (vs 747 baseline)
- Validation SQL automatique

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 5. PHASE 4 — DIVERSITÉ INTENTIONNELLE 2026 (~5h)

### Spec

Pour chaque verticale, **distribution cible des intents** (validée best-practice 2026) :

| Intent | % cible |
|--------|---------|
| `informational` | 35% (apprendre, comprendre) |
| `transactional` | 20% (acheter, contacter, devis) |
| `commercial_investigation` | 15% (comparer, évaluer) |
| `navigational` | 5% (marque) |
| `voice_search` | 10% (questions vocales) |
| `ai_overview` | 8% (résumés IA) |
| `featured_snippet` | 7% (position 0) |

### Implémentation
- Étendre l'enum `SearchIntent` (si pas déjà fait par Sprint Perfection 2026 Phase D)
- Pour chaque keyword existant et nouveau : assigner 1 intent principal
- Heuristiques d'assignment :
  - Commence par "comment", "pourquoi", "qu'est-ce" + ≥ 4 mots → `voice_search`
  - "Définition", "explication", "qu'est-ce" + court → `ai_overview`
  - "Étapes", "comment faire", "tutoriel" → `featured_snippet`
  - "Acheter", "devis", "tarif", "prix" → `transactional`
  - "vs", "ou", "comparer", "différence" → `commercial_investigation`
  - "Axion-IA", "axion ia" → `navigational`
  - Reste → `informational`

### SYSTEM_PROMPTs étendus
Pour chaque intent, le générateur d'article reçoit instructions spécifiques (cf. Sprint Perfection 2026 Phase D si déjà livré, sinon implémenter ici).

### Commit
```
feat(content-gen): keywords perfection — Phase 4 — diversité intentionnelle 2026

- 7 intents distincts assignés à tous keywords
- Distribution cible respectée (35% info / 20% trans / 15% comm / 10% voice / 8% AI overview / 7% featured / 5% nav)
- Heuristiques assignment automatique
- 6 tests vitest

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 6. PHASE 5 — ANALYSE CONCURRENTIELLE (~5h)

### Spec

#### 5.1 — Concurrents à analyser
Liste des concurrents principaux à mapper :

**Concurrents directs** :
- `axionai.fr` (homonyme, rank #1 brand actuellement)
- KPMG France (conseil IA)
- McKinsey France (conseil IA)
- Capgemini Invent (conseil IA)
- Wavestone (conseil IA)
- Sia Partners (conseil IA)
- Onepoint (conseil IA)
- Devoteam (conseil IA)

**Formations** :
- Cegos
- Demos
- OpenClassrooms
- Le Wagon
- Cnam
- Simplon
- Datacamp

**Plateformes IA** :
- Mistral AI (cluster séparé, mais référence)
- Dust.tt (assistants entreprise)
- Crisp.chat (chatbot)
- Akkodis (intégration)

#### 5.2 — Méthodologie

**Approche pragmatique sans budget SaaS** (DPA/Ahrefs non validés Will) :

1. **Analyse manuelle Google SERP** (lecture top 10 pour 30 keywords stratégiques par verticale) — fait par Claude
2. **Analyse site concurrent** (lecture sitemap public + pages titres) — gratuit, légal
3. **Estimation heuristique** : pour chaque keyword cible AxionIA, estimer si concurrent y rank (basé sur titre/description/contenu page concurrent)
4. **API gratuites** : `google-trends-api` npm (tendances), `ubersuggest` free tier (limité)

**Output** : matrice `keyword × concurrent × estimation rank`

```typescript
interface CompetitorIntelligence {
  keyword: string;
  axionTargetRank: number; // notre cible : top 3
  competitors: Array<{
    name: string;
    estimatedRank: number | null;
    urlObserved: string | null;
    contentQualityObserved: 'thin' | 'standard' | 'rich';
    weakness: string | null; // "Pas de schema FAQ", "Pas de TOC", "Contenu < 500 mots", etc.
  }>;
  axionOpportunity: 'high' | 'medium' | 'low'; // calc : nombreux concurrents weak + keyword high-intent
  recommendedAction: string;
}
```

#### 5.3 — Livrable
`_AUDIT/KEYWORDS-PERFECTION-2026-05-22/02-ANALYSE-CONCURRENTS.md`

Format :
```markdown
# ANALYSE CONCURRENTIELLE KEYWORDS — Top 100 keywords stratégiques

## Top 100 keywords avec opportunité 'high'
| # | Keyword | Concurrents top 3 | Faiblesses observées | Action AxionIA |
|---|---------|-------------------|----------------------|----------------|
| 1 | "audit IA PME Paris" | axionai.fr, Capgemini | Capgemini = page corporate générique ; axionai.fr = thin content | Pilier 2500 mots + TOC + FAQ + LocalBusiness JSON-LD |

## Concurrents par verticale
### audits
- Top 5 concurrents : ...
- Patterns observés : ...
- Faiblesses récurrentes : ...

### interventions_formations
...

## Stratégie "battre le concurrent"
Top 50 actions prioritaires
```

#### 5.4 — Intégration DB
- Étendre modèle `KeywordTracking` Prisma :
```prisma
model KeywordTracking {
  // ... champs existants ...
  competitorTopUrl       String?   @map("competitor_top_url") // URL concurrent #1
  competitorTopName      String?   @map("competitor_top_name") // "axionai.fr", "Capgemini"
  competitorWeaknesses   String[]  @default([]) @map("competitor_weaknesses") // tags
  axionOpportunity       String?   @map("axion_opportunity") // 'high'|'medium'|'low'
  recommendedAction      String?   @db.Text @map("recommended_action")
}
```

#### 5.5 — Tests
- `competitor-intelligence.test.ts` : 8 tests

### Commit
```
feat(content-gen): keywords perfection — Phase 5 — analyse concurrentielle

- 20+ concurrents mappés (axionai.fr + KPMG + Capgemini + ... + plateformes formation)
- Top 100 keywords stratégiques avec analyse SERP manuelle
- KeywordTracking étendu (competitor* fields)
- Rapport 02-ANALYSE-CONCURRENTS.md
- 8 tests vitest

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 7. PHASE 6 — GÉOLOCALISATION 2100 VILLES (~8h)

### Spec

#### 6.1 — Approche pragmatique
Pas tout en seeds (1500 keywords × 2100 villes = 3.15M keywords = inviable).

**Approche** : Templates de génération à la volée + sélection top villes seedées en dur.

#### 6.2 — Seeds en dur (top 100 villes)
Pour les 100 plus grandes villes France (Tier 1 + Tier 2 selon Sprint Perfection 2026 Phase A), générer 5-10 keywords géo par verticale :

Exemple Paris × audits :
- "audit IA Paris"
- "audit intelligence artificielle Paris PME"
- "cabinet audit IA Paris"
- "consultant audit IA Île-de-France"
- "audit IA dans le 75"
- "auditeur IA Paris tarif"
- "diagnostic IA entreprise Paris"
- "audit RGPD IA Paris"

→ Total seeds géo : 100 villes × 5 verticales × 7 keywords = **3500 keywords géo seedés**

#### 6.3 — Templates de génération à la volée
Pour les villes 100-2100 (tier 3+4), pas de seeds en dur. Génération à la volée par le keyword-selector :

```typescript
// src/server/content-gen/keyword-templates.ts
const GEO_TEMPLATES_BY_VERTICAL: Record<string, string[]> = {
  audits: [
    "audit IA {city}",
    "audit intelligence artificielle {city} {target}",
    "cabinet audit IA {city}",
    "consultant audit IA {region}",
    "diagnostic IA entreprise {city}",
  ],
  interventions_formations: [
    "formation IA {city}",
    "formation IA {target} {city}",
    "cours IA {city}",
    "bootcamp IA {region}",
    "formation prompt engineering {city}",
  ],
  // ...
};

export function generateGeoKeywords(
  vertical: string,
  city: City,
  target?: 'tpe' | 'pme' | 'eti'
): string[] {
  const templates = GEO_TEMPLATES_BY_VERTICAL[vertical] ?? [];
  return templates.map(t =>
    t.replace('{city}', city.name)
     .replace('{region}', city.regionName)
     .replace('{target}', target ?? 'entreprise')
  );
}
```

#### 6.4 — Intégration au keyword-selector
- `selectKeyword({ vertical, contentType, cityId? })` :
  - Si `cityId` fourni : utilise `generateGeoKeywords()` PUIS check si non utilisé récemment
  - Si pas fourni : utilise seeds DB normal

#### 6.5 — Tests
- `geo-keyword-templates.test.ts` : 10 tests (5 verticales × 2 villes-types)

### Commit
```
feat(content-gen): keywords perfection — Phase 6 — géolocalisation 2100 villes

- 100 plus grandes villes : 3500 keywords géo seedés en dur
- 2000 villes restantes : templates de génération à la volée
- keyword-templates.ts (5 verticales × 5-10 templates)
- selectKeyword() étendu (paramètre cityId)
- 10 tests vitest

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 8. PHASE 7 — CONSOLE ADMIN KEYWORD STRATEGY (~8h)

### Spec

#### 7.1 — Nouvelle page `/content-gen/keyword-strategy`
Server Component avec :

```
┌─────────────────────────────────────────────────────────────┐
│ STRATÉGIE KEYWORDS — 1500+ keywords / 5 verticales         │
│                                                             │
│ Vue d'ensemble :                                            │
│  audits                : 280 keywords (18%)                 │
│  interventions_formations : 320 keywords (21%)              │
│  un_a_un               : 250 keywords (17%)                 │
│  implementations       : 290 keywords (19%)                 │
│  sites_web_augmentes   : 260 keywords (17%)                 │
│  TRANSVERSAL           : 100 keywords (8%)                  │
│                                                             │
│ Distribution intents :                                      │
│  Informational    ████████░░░░ 38%                         │
│  Transactional    ████░░░░░░░░ 22%                         │
│  Comm. Investigation ███░░░░░░░ 14%                        │
│  Voice search     ██░░░░░░░░░░ 9%                          │
│  AI Overview      ██░░░░░░░░░░ 8%                          │
│  Featured snippet █░░░░░░░░░░░ 6%                          │
│  Navigational     █░░░░░░░░░░░ 3%                          │
│                                                             │
│ [Filtres : verticale ▾] [cluster ▾] [intent ▾] [état ▾]   │
│ [🔍 Recherche]                                              │
│                                                             │
│ Liste keywords (paginée 100/page) :                         │
│ ☐│Keyword                  │Verticale│Cluster      │Intent │Util│
│ ☐│audit IA Paris           │audits   │audit-paris  │trans  │5×  │
│ ☐│formation prompt PME     │interv...│prompt-eng   │info   │2×  │
│                                                             │
│ Actions multi :                                             │
│ [🚀 Créer campagne sur ces X keywords]                     │
│ [📋 Marquer prioritaires]                                  │
│ [📥 Export CSV]                                            │
└─────────────────────────────────────────────────────────────┘
```

#### 7.2 — Page détail cluster `/content-gen/keyword-strategy/cluster/[id]`
Vue détaillée d'un cluster avec :
- Liste keywords du cluster
- Articles déjà publiés ciblant ce cluster
- Concurrents top sur ce cluster (depuis Phase 5)
- Opportunités à creuser
- Bouton "Créer pilier sur ce cluster"

#### 7.3 — Page analyse concurrentielle `/content-gen/keyword-strategy/competitors`
Vue par concurrent + matrice opportunités.

#### 7.4 — Server Actions
- `listKeywords(filters): { keywords, total, pages }`
- `createCampaignFromKeywords(keywordIds: string[]): redirect`
- `markKeywordsPriority(keywordIds: string[])`
- `exportKeywordsCSV(filters)`

#### 7.5 — Sidebar admin
Ajouter "Stratégie keywords" dans section 🛠️ Sources.

### Commit
```
feat(content-gen-admin): keywords perfection — Phase 7 — console keyword strategy

- Page /content-gen/keyword-strategy (vue globale + filtres + multi-actions)
- Page cluster detail
- Page concurrents
- Server actions complets
- 8 tests RTL + 6 tests server actions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 9. PHASE 8 — MONITORING TRACKING ÉTENDU (~6h)

### Spec

#### 8.1 — Étendre `KeywordTracking` (déjà existant pour GSC)
Ajout champs :
```prisma
model KeywordTracking {
  // ... existant ...
  competitorTopUrl       String?
  competitorTopName      String?
  competitorWeaknesses   String[]
  axionOpportunity       String?  // 'high'|'medium'|'low'
  recommendedAction      String?  @db.Text
  ourFirstRankAt         DateTime? // quand on a atteint top 10
  ourBestRank            Int?     // meilleur rank atteint
  ourCurrentRank         Int?     // rank actuel
  trendDirection         String?  // 'up'|'down'|'stable'
}
```

#### 8.2 — Worker `keyword-opportunity-detector.ts`
- Cron weekly (lundi 06:00 UTC)
- Pour chaque keyword tracké :
  - Si position > 10 + opportunity='high' + pas d'article publié → créer suggestion campaign
  - Si position drop > 5 places en 7 jours → alerte
  - Si concurrent passe devant nous → alerte Telegram
- Alertes via cost-tracker existant

#### 8.3 — Dashboard `/content-gen/keyword-strategy/tracking`
- Top 20 opportunités (high + non-rankées)
- Top 20 chutes (rank-drops)
- Top 20 victoires (rank-gains)
- Graphiques évolution 30j

### Commit
```
feat(content-gen): keywords perfection — Phase 8 — monitoring tracking étendu

- KeywordTracking 7 nouveaux champs
- Worker keyword-opportunity-detector (lundi 6h UTC)
- Dashboard tracking (opportunités + chutes + victoires)
- 8 tests vitest

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 10. ZONES INTERDITES

- ❌ `prisma/seeds/villes/copy/*.ts` (Manon)
- ❌ `prisma/seeds/image-bank/seed-images.ts` (Manon)
- ❌ Modifier composants SEO sauf si nécessaire pour intent-specific (P3 territory souple)
- ❌ Modifier `llm-judge.ts` (P4 territory) sauf intégration intent-aware
- ❌ Décisions Will : Wikidata, DPA, CF WAF (exclus)
- ❌ NE PAS supprimer les 747 keywords existants — toujours additif ou re-classifier

---

## 11. LIVRABLES & FORMAT

### Verdict sprint
`_AUDIT/KEYWORDS-PERFECTION-2026-05-22/VERDICT-SPRINT-KEYWORDS-PERFECTION.md`

Format :
```markdown
# VERDICT SPRINT KEYWORDS PERFECTION 2026
## Date livraison : YYYY-MM-DD
## HEAD post-sprint : <SHA>
## Effort réel : XXh (vs estimé 40-50h)

## 8 phases livrées
| Phase | Description | Commit | Statut |

## Métriques avant / après
| Métrique | Avant | Après |
|----------|-------|-------|
| Total keywords | 747 | XXXX |
| Verticales équilibrées (≥250) | 0/5 | 5/5 |
| Keywords par intent (7 intents) | ... | ... |
| Clusters thématiques | ~5 | 60+ |
| Géo seeds (100 villes × 5) | ~50 | 3500 |
| Concurrents mappés | 0 | 20+ |
| Couverture sémantique | 60% | 95% |
| Score qualité keywords | 700/1600 | XXXX/1600 |

## Migrations Prisma
- 20260522140000_keywords_perfection_competitor_intel

## Workers créés
- keyword-opportunity-detector.ts (cron weekly)

## Pages admin nouvelles
- /content-gen/keyword-strategy
- /content-gen/keyword-strategy/cluster/[id]
- /content-gen/keyword-strategy/competitors
- /content-gen/keyword-strategy/tracking

## Tests Vitest
- Phase 1 audit : 6 tests
- Phase 2 sémantique : 8 tests
- Phase 4 intent : 6 tests
- Phase 5 concurrents : 8 tests
- Phase 6 géo : 10 tests
- Phase 7 console : 14 tests
- Phase 8 tracking : 8 tests
- TOTAL : 60 nouveaux tests

## Gates ✅

## Actions Will post-sprint
1. Validation manuelle top 30 nouveaux keywords par verticale (rapide sanity check)
2. Re-seed prod : `pnpm content-gen:seed-keywords`
3. Activer worker keyword-opportunity-detector dans Coolify
4. Tester création campagne depuis /content-gen/keyword-strategy
```

### Mémoire
Slug : `axionia_sprint_keywords_perfection_livre_2026-05-22`

### MEMORY.md
```
- [🟢 AxionIA Sprint Keywords Perfection LIVRÉ 2026-05-22 — 1500+ keywords](axionia_sprint_keywords_perfection_livre_2026-05-22.md) — 5 verticales × 250+ keywords + 60+ clusters thématiques + 7 intents + 20 concurrents mappés + 100 villes × 5 verticales géo + console admin + worker tracking. Score qualité 700→XXXX/1600.
```

---

## 12. STOP & ASK FINAL

```
✅ Sprint Keywords Perfection livré.

📊 Métriques d'impact :
- 747 → 1500+ keywords (×2)
- 5 verticales toutes ≥ 250 keywords
- 60+ clusters thématiques organisés
- 7 intents 2026 distribués selon best-practice
- 20+ concurrents mappés avec opportunités identifiées
- 100 villes top × 5 verticales = 3500 keywords géo seedés
- 2000 villes restantes = templates de génération à la volée

🎯 Pour atteindre N°1 :
- Score qualité keywords : 700 → XXXX/1600
- Top 100 opportunités 'high' à exploiter (cf. 02-ANALYSE-CONCURRENTS.md)
- Console admin pour pilotage stratégique

🚀 Suite :
[A] Validation top 30 keywords par verticale (manuel Will, 30 min)
[B] Activation worker tracking en prod
[C] Création 5 campagnes test (1 par verticale) depuis nouvelle console keyword-strategy
[D] Continuer pipeline content-gen perfection 2026
```

---

## 13. PHRASE DE LANCEMENT (AUTOPILOT TOTAL)

```
AUTOPILOT TOTAL. Ne pose AUCUNE question intermédiaire. Lance le sprint master décrit dans `_AUDIT/PROMPT-SPRINT-KEYWORDS-PERFECTION-2026-05-22.md`. Mode IMPLEMENTATION (commits incrémentaux + push autorisés). Décisions Will déjà figées dans mémoires (D7 société FR + exclusions Wikidata/DPA/CF). Lire EN PREMIER axionia_decisions_will_final_2026-05-21 + axionia_keywords_747seeds_2026-05-20 + axionia_keyword_strategy_audit_2026-05-19. Exécuter 8 phases séquentielles : 1 audit qualité 747 existants → 2 couverture sémantique exhaustive (5 verticales × 10-12 clusters × 15-25 keywords) → 3 équilibrage ≥250 par verticale → 4 diversité 7 intents 2026 → 5 analyse concurrentielle 20+ concurrents → 6 géolocalisation 100 villes top seedées + templates à la volée 2000 autres → 7 console admin /content-gen/keyword-strategy → 8 monitoring tracking étendu. Commits incrémentaux + push après chaque phase. Convergence Manon (git pull --rebase avant push). Gates verts obligatoires (typecheck 0, lint 0, vitest ≥ baseline + 60 nouveaux tests, isolation-check, prisma validate, validate keywords). Zones interdites strictes (villes/copy, image-bank/seed, composants SEO sauf intent-specific, llm-judge sauf intent-aware). Approche concurrentielle PRAGMATIQUE sans budget SaaS (analyse manuelle SERP top 30 keywords stratégiques par verticale + sitemaps publics + google-trends-api gratuit). Self-troubleshoot toutes erreurs. Termine par VERDICT-SPRINT-KEYWORDS-PERFECTION.md + mémoire axionia_sprint_keywords_perfection_livre_2026-05-22 + MEMORY.md update. STOP & ASK Will UNIQUEMENT à la livraison finale avec métriques avant/après + actions Will optionnelles. Go.
```

---

*Sprint Keywords Perfection 2026 — 40-50h autopilot — IMPLEMENTATION — Domination N°1 France keywords*

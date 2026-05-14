# Spec Content Factory AxionIA — outil de génération massif d'articles + Q/R + guides + comparatifs

**Statut** : ✅ Validé Will (2026-05-08, 4/4 décisions critiques tranchées)
**Auteur** : Claude Opus 4.7 + Will
**Cible** : développer un outil externe qui génère ~100 contenus/jour à injecter dans `src/content/blog/posts/<slug>.ts`. Volumes cumulés cibles : 5K → 50K → 100K+ contenus selon ramp-up.
**Cap** : indexation maximale Google + LLMs (Perplexity / Claude.ai / Gemini / SearchGPT) **sans déclencher de pénalité Helpful Content Update 2024**.

---

## 0. Décisions critiques à valider AVANT codage

### Q1 — Volume cible global ?

| Tier | Volume | Stockage recommandé | Build time estimé |
|---|---|---|---|
| V1 court terme | 1-5 K contenus | Fichiers TS dans `src/content/blog/posts/` | < 2 min |
| V2 Phase 1 | 5-20 K | Idem fichiers TS, splitté par catégorie | 2-5 min |
| V3 Phase 2 | 20-100 K | **Migration Prisma DB obligatoire** (Sprint 15+) | < 30 s (DB-driven, pas SSG) |
| V4 Phase 3 | 100 K+ | Prisma + ISR + cache CDN aggressif | < 30 s |

→ **À valider** : Will vise quel tier d'ici 6 mois ? 12 mois ? 24 mois ?

### Q2 — Indexation : tout indexable individuellement, vraiment ?

Will a dit « tout indexable individuellement ». **Risque majeur HCU 2024** : Google détecte les sites avec >50K pages générées en masse et sanctionne tout le domaine. Solution = **pyramide d'indexation** :

```
┌─────────────────────────────────────────────┐
│ TIER 1 — INDEXABLE PUBLIC (10-20% volume)   │
│ • Articles validés Will                     │
│ • Score qualité ≥ X (à définir)             │
│ • Demande SEO confirmée (Search Console)    │
│ → Sitemap + meta robots index               │
├─────────────────────────────────────────────┤
│ TIER 2 — NOINDEX FOLLOW (60-70% volume)     │
│ • Génération bulk avant validation          │
│ • Crawlable pour maillage interne mais pas  │
│   indexé tant que pas validé                │
│ → Pas dans sitemap, meta robots noindex,    │
│   liens internes follow                     │
├─────────────────────────────────────────────┤
│ TIER 3 — NOINDEX NOFOLLOW (10-20% volume)   │
│ • Drafts, contenu low-quality détecté       │
│ • À déprioriser ou supprimer                │
│ → Pas dans sitemap, meta robots noindex,    │
│   pas de liens entrants                     │
└─────────────────────────────────────────────┘
```

→ **À valider** : ratios cibles ? Ou plan plus simple = tout en TIER 2 par défaut, promotion manuelle vers TIER 1 quand validé Will ?

### Q3 — URL structure ?

3 options :

**Option A — Plat sémantique (RECOMMANDÉ)**
```
/blog/<slug>                          ← article canonique unique
/blog/categorie/<slug>                ← page index catégorie (existing)
/blog/tag/<slug>                      ← page index tag (existing)
/blog/auteur/<slug>                   ← page index auteur (existing)
```
+ Filtres URL : `/blog?type=audit&taille=eti&ville=paris` (canonical = `/blog`, hreflang FR/EN)

→ Avantage : URL canonique simple, pas de duplicate, scale-friendly.

**Option B — Hiérarchique sémantique**
```
/blog/<type>/<slug>                   ← /blog/audit/comment-...
/blog/<type>/<taille>/<slug>          ← /blog/audit/eti/comment-...
```
→ Avantage : URLs riches en mots-clés. Inconvénient : risque duplicate si même slug dans plusieurs hiérarchies.

**Option C — Multi-canonique par dimension (à éviter)**
```
/audit-ia/<slug>     /interventions-ia/<slug>     /implementation-ia/<slug>
```
→ Avantage SEO théorique. Inconvénient : doorway farm classique, Google sanctionne.

→ **À valider** : Option A vs B ?

### Q4 — Q/R atomiques individuellement indexables ?

Will a dit « Q/R généré (tout indexable individuellement) ». **Trade-off** :

**Option A — Q/R = page propre `/faq/<slug>`** (existing)
- Existant : `/faq/<slug>` rend une QAPage Schema.org indexable
- Possible mais à scale 50K Q/R = 50K pages thin content (HCU 2024 risque max)
- Recommandation : limiter à ~500-2000 Q/R réellement substantielles (>120 mots/réponse)

**Option B — Q/R groupées dans articles** (RECOMMANDÉ pour scale)
- 1 article = 5-15 Q/R en section FAQ → 1 FAQPage Speakable JSON-LD par article
- Chaque Q/R apparaît dans Google AI Overviews / Perplexity sans page dédiée
- Volume scale-friendly : 50K Q/R groupées dans 5K articles = parfait

→ **À valider** : page par Q/R (max indexation théorique mais HCU 2024 risque) ou Q/R groupées dans articles (recommandé) ?

---

## 1. Modèle data — 4 entités canoniques

### 1.1 `BlogPost` (article long-form, 800-2500 mots)

```ts
export interface BlogPost {
  // === Identification ===
  slug: string;                        // kebab-case ASCII unique
  publishedAt: string;                 // ISO date
  updatedAt?: string;                  // ISO date — incrémenté à chaque révision substantielle
  readingTime: string;                 // "8 min"
  author: string;                      // "Will" | future: multi-auteurs
  category: string;                    // "Audit IA" | "Interventions" | "Implémentation" | "Cas d'usage" | "Méthodologie" | "Stratégie" | "Outils" | "Tendances"

  // === Taxonomies ===
  /** Tags libres pour groupage transversal (~3-8 par article). */
  tags: ReadonlyArray<string>;

  /** Dimension verticale métier — secteurs ciblés (NAF). */
  sectors?: ReadonlyArray<
    | "industrie" | "comptabilite" | "juridique" | "banque-finance"
    | "conseil" | "sante" | "retail" | "ecommerce" | "logistique"
    | "agro-alimentaire" | "tech" | "saas" | "tourisme" | "education"
    | "immobilier" | "autre"
  >;

  /** Dimension taille entreprise. */
  /**
   * Tailles d'entreprise — classification INSEE officielle (4 catégories) :
   *   tpe (< 10) · pme (10-249) · eti (250-4999) · grande-entreprise (5000+)
   */
  companySizes?: ReadonlyArray<"tpe" | "pme" | "eti" | "grande-entreprise">;

  /** Dimension type de prestation AxionIA. */
  serviceTypes?: ReadonlyArray<"audit" | "interventions" | "implementation">;

  /** Dimension géographique — slugs villes (cf. src/content/villes/). */
  relatedCities?: ReadonlyArray<string>;

  /** Dimension géographique — slugs régions (cf. src/content/regions.ts). */
  relatedRegions?: ReadonlyArray<string>;

  /** Format éditorial. */
  format: "article" | "comparatif" | "guide" | "cas-pratique" | "interview" | "veille" | "tribune";

  // === Indexation ===
  /** Tier d'indexation (cf. §0 Q2). Default = "tier-2-noindex-follow". */
  indexationTier?: "tier-1-indexable" | "tier-2-noindex-follow" | "tier-3-noindex-nofollow";

  /** Score qualité automatique 0-100 (calculé par l'outil de génération). */
  qualityScore?: number;

  /** Date de promotion vers tier-1 (validation Will). Si absente, l'article reste tier-2 par défaut. */
  promotedAt?: string;

  // === Contenu localisé FR + EN ===
  fr: BlogPostCopy;
  en: BlogPostCopy;
}

export interface BlogPostCopy {
  /** Titre 50-70 chars optimisé SEO (Google tronque à ~60). */
  title: string;

  /** Excerpt 120-180 chars optimisé meta description. */
  excerpt: string;

  /** Direct answer 40-80 mots citable LLMs (signal AEO/GEO). Apparait après le H1. */
  directAnswer: string;

  /** Body markdown ou structured (à choisir). 800-2500 mots. */
  body: string;

  /** FAQ embed — 4-12 Q/R atomiques (FAQPage Speakable JSON-LD). */
  faq?: ReadonlyArray<{
    q: string;     // Question 8-15 mots
    a: string;     // Réponse 30-100 mots
  }>;

  /** Hero image alt-text (a11y + SEO). */
  heroAlt?: string;

  /** Mots-clés primaires (max 3, dont 1 city ou 1 type service de préférence). */
  primaryKeywords?: ReadonlyArray<string>;
}
```

### 1.2 `Comparison` (déjà existant — `src/content/comparaisons.ts`)

Étendu pour supporter génération massive :

```ts
export interface Comparison {
  slug: string;
  publishedAt: string;
  updatedAt?: string;

  /** Type de comparatif. */
  type: "outils-ia" | "service-axion" | "alternative-saas" | "build-vs-buy";

  /** Items comparés (2-6). */
  items: ReadonlyArray<{
    name: string;
    vendor: string;
    /** URL externe ou interne (/stack-ia/<tool>). */
    url?: string;
    pricing?: string;
    pros: ReadonlyArray<string>;
    cons: ReadonlyArray<string>;
  }>;

  // Mêmes taxonomies que BlogPost
  tags: ReadonlyArray<string>;
  sectors?: ReadonlyArray<string>;
  companySizes?: ReadonlyArray<string>;
  relatedCities?: ReadonlyArray<string>;
  serviceTypes?: ReadonlyArray<string>;

  indexationTier?: "tier-1-indexable" | "tier-2-noindex-follow" | "tier-3-noindex-nofollow";
  qualityScore?: number;

  fr: ComparisonCopy;
  en: ComparisonCopy;
}
```

### 1.3 `Guide` (long-form 2000-5000 mots, pillar content)

```ts
export interface Guide {
  slug: string;
  publishedAt: string;
  updatedAt?: string;

  /** Niveau d'expertise du lecteur cible. */
  audience: "debutant" | "intermediaire" | "avance";

  /** Estimation lecture. */
  readingTime: string;

  /** Sections (Table of Contents auto-générée). */
  sections: ReadonlyArray<{
    id: string;          // anchor slug
    title: string;
    body: string;        // markdown
  }>;

  // Mêmes taxonomies que BlogPost
  tags: ReadonlyArray<string>;
  sectors?: ReadonlyArray<string>;
  companySizes?: ReadonlyArray<string>;
  relatedCities?: ReadonlyArray<string>;
  serviceTypes?: ReadonlyArray<string>;

  indexationTier?: "tier-1-indexable" | "tier-2-noindex-follow" | "tier-3-noindex-nofollow";
  qualityScore?: number;

  fr: { title: string; excerpt: string; directAnswer: string; faq?: ReadonlyArray<{ q: string; a: string }> };
  en: { title: string; excerpt: string; directAnswer: string; faq?: ReadonlyArray<{ q: string; a: string }> };
}
```

### 1.4 `QAItem` (Q/R atomique — UNIQUEMENT si Q4 = Option A validée)

```ts
export interface QAItem {
  slug: string;
  publishedAt: string;

  /** Catégorie thématique. */
  category: "audit" | "interventions" | "implementation" | "tarifs" | "methodologie" | "outils" | "rgpd" | "secteurs";

  // Mêmes taxonomies que BlogPost (mais relatedCities ou serviceTypes au moins UN required)
  tags: ReadonlyArray<string>;
  relatedCities?: ReadonlyArray<string>;
  serviceTypes?: ReadonlyArray<string>;

  /** **OBLIGATOIRE** : seuil minimum 120 mots/réponse pour échapper au thin-content HCU 2024. */
  minimumAnswerWords: 120;

  indexationTier?: "tier-1-indexable" | "tier-2-noindex-follow" | "tier-3-noindex-nofollow";
  qualityScore?: number;

  fr: { question: string; answer: string };
  en: { question: string; answer: string };
}
```

---

## 2. Taxonomies — 5 dimensions

| Dimension | Valeurs | Volume | URL filter |
|---|---|---|---|
| **format** | article · comparatif · guide · cas-pratique · interview · veille · tribune | 7 | `/blog?format=...` |
| **category** | Audit IA · Interventions · Implémentation · Cas d'usage · Méthodologie · Stratégie · Outils · Tendances | 8 | `/blog/categorie/<slug>` |
| **sectors** | industrie · comptabilité · juridique · banque-finance · conseil · santé · retail · ecommerce · logistique · agro-alimentaire · tech · saas · tourisme · education · immobilier · autre | 16 | `/blog/secteur/<slug>` (NEW) |
| **companySizes** | tpe · pme · eti · grande-entreprise (4 tailles INSEE) | 4 | `/blog/taille/<slug>` (NEW) |
| **serviceTypes** | audit · interventions · implementation | 3 | `/blog/service/<slug>` (NEW) |
| **relatedCities** | ~2150 villes | 2150 | Filtre seul, **pas de page index dédiée** (anti-doorway HCU 2024) |
| **relatedRegions** | 13 régions | 13 | Filtre seul, **pas de page index dédiée** |
| **tags** | libres | unbounded | `/blog/tag/<slug>` (existing) |

**Combinatoire pages taxonomies** : 7 + 8 + 16 + 5 + 3 + N tags = ~50 pages index taxonomies (gérables).

**Combinatoire pages articles** : 100/jour × 365 = 36 500/an. À 5 ans = 182 500 articles (dont seulement 10-20% en TIER 1 = 18K-36K indexables).

---

## 3. URL structure (Option A recommandée)

```
/blog                                 ← index global (pagination 24/page)
/blog/<slug>                          ← article canonique (article + comparatif + cas-pratique + interview + veille + tribune)
/blog/categorie/<slug>                ← page catégorie (8 categories)
/blog/secteur/<slug>                  ← page secteur (16) — NEW
/blog/taille/<slug>                   ← page taille (4 INSEE) — NEW
/blog/service/<slug>                  ← page service (3) — NEW
/blog/tag/<slug>                      ← page tag (existing)
/blog/auteur/<slug>                   ← page auteur (existing)

/guides                               ← index guides (NEW — séparé du blog car pillar content)
/guides/<slug>                        ← guide canonique

/faq                                  ← index FAQ globale (existing)
/faq/<slug>                           ← Q/R individuelle (existing) — UNIQUEMENT pour Q/R substantielles ≥ 120 mots
```

**Filtres URL** sans modification du canonical :
```
/blog?service=audit&taille=eti&secteur=industrie
→ canonical = /blog
→ hreflang = FR + EN
→ description meta dynamique selon filtres actifs
```

**Sitemap** :
```
sitemap-index.xml
├── sitemap/blog.xml                  ← top 1K articles tier-1 + index/categories/tags
├── sitemap/blog-2.xml                ← chunked si > 1K
├── sitemap/guides.xml                ← guides tier-1
├── sitemap/faq.xml                   ← Q/R tier-1 only
└── ... (existing)
```

---

## 4. JSON-LD obligatoire par type

| Entité | Schemas émis automatiquement |
|---|---|
| **BlogPost** (`/blog/<slug>`) | `Article` ou `NewsArticle` ou `BlogPosting` (selon format) + `BreadcrumbList` + `FAQPage Speakable` (si faq) + `Person` (auteur) + `Organization` (publisher) |
| **Comparison** | `Article` + `ComparisonTable` (custom JSON-LD) + items en `Product` ou `Service` |
| **Guide** | `HowTo` + `BreadcrumbList` + sections en `HowToSection` + `FAQPage Speakable` (si faq) |
| **QAItem** | `QAPage` + `Question` + `Answer` + `BreadcrumbList` |
| Index **/blog** | `CollectionPage` + `ItemList` (top 24 articles) + `BreadcrumbList` |
| Index taxonomie | `CollectionPage` + `ItemList` (articles filtrés) + `BreadcrumbList` |

**Aucune page sans JSON-LD** : règle stricte. Si l'outil de génération ne fournit pas un signal nécessaire, fallback automatique à un placeholder validé (ex. auteur défaut « Will »).

---

## 5. Format I/O — outil de génération

### 5.1 Output attendu (1 fichier par contenu)

```
src/content/blog/posts/
  audit-ia-cabinets-comptables-paris-lyon.ts
  comparatif-mistral-vs-claude-pour-pme.ts
  guide-implementation-ia-eti-industrielle.ts
  ... 1 fichier par article
```

Chaque fichier exporte UN seul `BlogPost` typé :

```ts
import type { BlogPost } from "../types";

export const POST: BlogPost = {
  slug: "audit-ia-cabinets-comptables-paris-lyon",
  publishedAt: "2026-05-15",
  // ... (tous les champs §1.1)
};
```

L'outil **n'a pas à éditer** :
- Le barrel `src/content/blog/index.ts` (généré par script `pnpm posts:index`)
- Les pages `/blog/*` (templates fixes)
- Le sitemap, routing, helpers (infra)

### 5.2 Pipeline ingestion (côté repo AxionIA)

```
1. Outil de Will génère → output/<slug>.ts
2. Will copie dans src/content/blog/posts/
3. pnpm posts:index             ← regénère index.ts barrel + types
4. pnpm posts:validate          ← lint qualité (mots, JSON-LD, taxonomies)
5. pnpm verify:all              ← typecheck + tests + checks doctrine
6. git commit + push
7. Build Coolify → SSG ou ISR
```

### 5.3 Validation auto (script `pnpm posts:validate`)

Bloque le commit si :
- `slug` collision avec article existant
- `body` < 600 mots (article) / 2000 mots (guide) → tier-3 forcé
- `directAnswer` < 40 mots ou > 80 mots (anti-AEO)
- `faq` items < 4 si tier-1
- `relatedCities` contient slug ville inexistant
- `category` n'est pas dans les 8 valeurs autorisées
- `qualityScore` < 70 → tier-2 forcé
- `qualityScore` < 40 → tier-3 forcé
- Mots bannis : « SIREN », « SIRET », « RCS » (déjà dans `anti-siren:check`)
- Mots à éviter (warning) : « unique », « le meilleur », « révolutionnaire » (anti-spammy)

---

## 6. Pyramide indexation détaillée

### Tier 1 — Indexable public (cible 10-20% du volume)

**Critères automatiques** :
- `qualityScore` ≥ 70
- `body` ≥ 800 mots (article) / 2000 mots (guide) / 120 mots (Q/R)
- `faq` ≥ 4 items
- `directAnswer` 40-80 mots
- Au moins 1 dimension taxonomie remplie (sectors OR companySizes OR serviceTypes)
- Relecture Will = `promotedAt` rempli

**Effets** :
- `<meta robots="index, follow">`
- Inclus dans sitemap
- Lié depuis `/blog` index, pages taxonomies, pages villes pertinentes
- Émet tous les schemas JSON-LD obligatoires
- Soumis à Google Indexing API au déploiement

### Tier 2 — noindex follow (cible 60-70% du volume)

**Critères** :
- `qualityScore` 40-69
- Pas encore relu par Will
- Genre « contenu généré bulk en attente de validation »

**Effets** :
- `<meta robots="noindex, follow">`
- **Pas dans le sitemap**
- Lié depuis pages internes (pour densifier le maillage interne sans surcharger l'indexation)
- Schema JSON-LD émis (au cas où promotion ultérieure)
- **Promotion vers Tier 1 = 1 commit qui ajoute `promotedAt`**

### Tier 3 — noindex nofollow (cible 10-20% du volume)

**Critères** :
- `qualityScore` < 40
- Body < 600 mots
- Drafts manifestes

**Effets** :
- `<meta robots="noindex, nofollow">`
- **Pas dans le sitemap**
- **Pas de liens entrants** (pas affiché dans `/blog`, pas dans pages taxonomies, pas dans pages villes)
- À supprimer après 90 jours sans promotion

---

## 7. Monitoring & lifecycle (Sprint 20+)

Dashboard `/admin/content-stats` (à coder Sprint 20) :

| Signal | Action automatique recommandée |
|---|---|
| Tier-1 article CTR > 5 % depuis Search Console | Promotion priorité crawl, ajouter en lien hub |
| Tier-1 CTR < 1 % après 3 mois | Rétrogradation vers Tier-2 (perd index Google) |
| Tier-2 « crawled but not indexed » > 30 % | Diagnostic massif quality |
| Tier-3 stagnant 90 jours | Suppression (Will valide) |
| Volume tier-1 > 30K | Activation cache CDN agressif (Cloudflare Workers) |
| Volume total > 50K | **Migration Prisma DB obligatoire** |

---

## 8. Format de prompt pour ton outil de génération

### 8.1 Input attendu

```json
{
  "type": "article",
  "topic": "Audit IA pour cabinets comptables",
  "primaryKeyword": "audit ia cabinet comptable",
  "secondaryKeywords": ["expert-comptable IA", "automatisation cabinet comptable"],
  "audience": "expert-comptable PME 5-50 collaborateurs",
  "format": "article",
  "category": "Audit IA",
  "sectors": ["comptabilite"],
  "companySizes": ["tpe", "pme"],
  "serviceTypes": ["audit"],
  "relatedCities": ["paris", "lyon", "bordeaux", "marseille", "toulouse"],
  "targetWordCount": 1500,
  "includeFaq": 6,
  "tone": "expert mais accessible"
}
```

### 8.2 Output attendu (TS file ou JSON équivalent)

```ts
import type { BlogPost } from "../types";

export const POST: BlogPost = {
  slug: "audit-ia-cabinets-comptables-2026",
  publishedAt: "2026-05-15",
  updatedAt: "2026-05-15",
  readingTime: "8 min",
  author: "Will",
  category: "Audit IA",
  tags: ["audit", "comptabilité", "expert-comptable", "automatisation"],
  sectors: ["comptabilite"],
  companySizes: ["tpe", "pme"],
  serviceTypes: ["audit"],
  relatedCities: ["paris", "lyon", "bordeaux", "marseille", "toulouse"],
  format: "article",
  qualityScore: 78,
  // indexationTier non rempli → calcul auto à partir de qualityScore + body length
  fr: {
    title: "Audit IA pour cabinets comptables : 5 cas d'usage 2026",
    excerpt: "Lecture de factures, automatisation des saisies, prédiction de trésorerie... 5 cas d'audit IA validés sur cabinets comptables 5-50 collaborateurs.",
    directAnswer: "L'audit IA en cabinet comptable identifie en 5 jours les workflows à fort potentiel d'automatisation : saisie OCR, rapprochement bancaire, génération de fiches client, prédiction de trésorerie. AxionIA livre un plan d'attaque chiffré dès 490 € HT, avec ROI moyen documenté de 30-50 % sur les tâches administratives.",
    body: "## Pourquoi auditer son cabinet comptable en 2026 ?\n\n[1500 mots de contenu structuré]",
    faq: [
      { q: "Combien de temps dure un audit IA en cabinet comptable ?", a: "5 à 10 jours ouvrés selon le niveau retenu : Flash 1 jour, Ciblé 3 jours, Stratégique PME 5 jours. À Paris, Lyon, Bordeaux, Marseille et Toulouse, le délai moyen entre signature et kick-off est de 7 jours ouvrés." },
      { q: "Quel ROI pour un cabinet de 10 collaborateurs ?", a: "..." },
      // ... 4-12 Q/R
    ],
    primaryKeywords: ["audit ia cabinet comptable", "cabinet comptable ia", "audit ia expert-comptable"],
  },
  en: { /* miroir EN */ },
};
```

### 8.3 Garde-fous outil

L'outil DOIT :
- Refuser de générer si `relatedCities` contient une ville inexistante (vérif contre `villes/index.ts`)
- Refuser si `category` hors des 8 valeurs autorisées
- Garantir un slug unique (vérif via `posts:list` script avant génération)
- Auto-calculer `qualityScore` selon une grille : longueur body, présence FAQ, présence directAnswer 40-80 mots, mots-clés primaires dans h2/h3, ratio mots originaux vs templates
- Bannir les mots SIREN/SIRET/RCS (anti-siren existing)
- Émettre exactement 1 fichier `posts/<slug>.ts` par article généré

---

## 9. Refonte structurelle nécessaire (à coder maintenant)

### Avant Will lance son outil :

1. ✅ **Splitter `src/content/blog/` en pattern villes** :
   ```
   src/content/blog/
     index.ts              ← barrel + helpers (existing helpers déplacés depuis transversal.ts)
     types.ts              ← BlogPost interface (étendue avec taxonomies)
     posts/
       <slug>.ts           ← 1 fichier par article (3 V1 → scaling)
   ```

2. ✅ **Étendre `BlogPost`** avec : sectors, companySizes, serviceTypes, format, indexationTier, qualityScore, promotedAt, directAnswer, faq, primaryKeywords.

3. ✅ **Créer pages taxonomies manquantes** :
   - `/blog/secteur/<slug>` (16 secteurs)
   - `/blog/taille/<slug>` (5 tailles)
   - `/blog/service/<slug>` (3 services)

4. ✅ **Créer template Guide** (`/guides/<slug>`).

5. ✅ **Étendre `QAItem`** dans `src/content/transversal.ts` (FAQ existing) avec taxonomies.

6. ✅ **Script `pnpm posts:index`** : régénère `blog/index.ts` barrel à partir des fichiers `posts/*.ts`.

7. ✅ **Script `pnpm posts:validate`** : check qualité + slugs + taxonomies + word count + interdits.

8. ✅ **Sitemap split** : `blog.xml` chunked à 1000 URLs, ne contient que tier-1.

9. ✅ **Métadonnées robots conditionnelles** : `<meta robots>` selon tier dans le template article.

10. ✅ **Helper `resolveTier(post)`** : calcule tier auto à partir de qualityScore + body length + faq count + promotedAt.

### Volume effort estimé

| Item | Effort |
|---|---|
| Refonte structurelle 1-9 | ~6-8 h dev |
| Documentation finale (ce doc) | ~2 h Will + Claude |
| Tests + verify + build | ~1 h |
| **Total** | **~9-11 h** |

---

## 10. Ce que le pattern apporte concrètement (résumé non-technique)

> **Avec ce pattern, ton outil peut produire 100 articles/jour, qui se classent automatiquement dans :**
>
> 1. **L'index `/blog`** (page principale) — pagination naturelle.
> 2. **8 catégories** (Audit IA, Interventions, etc.) — pages auto-listées.
> 3. **16 pages secteurs** (`/blog/secteur/comptabilite`, etc.) — auto-listées.
> 4. **4 pages tailles INSEE** (`/blog/taille/tpe` · `/blog/taille/pme` · `/blog/taille/eti` · `/blog/taille/grande-entreprise`) — auto-listées.
> 5. **3 pages services** (`/blog/service/audit`, etc.) — auto-listées.
> 6. **N pages tags** (libres) — auto-listées.
> 7. **2150 pages villes pilotes** — section « Articles & ressources » sur chaque page ville mentionnée dans `relatedCities`.
> 8. **13 pages régions** — section similaire.
> 9. **Sitemap Google** — uniquement tier-1 (qualité validée).
> 10. **RSS feed** — tier-1 seulement.
> 11. **Indexing API Google** (Sprint 22) — soumission auto tier-1.
>
> **1 article = 11 endroits de visibilité automatique. 100 articles/jour = 1100 nouveaux affichages/jour sur le site.**
>
> **Pas de doorway risk** car :
> - URL canonique unique par article
> - Tier-2 noindex pour le bulk en attente de validation
> - Tier-3 noindex+nofollow pour low-quality
> - Word count minimum strict
> - Anti-doorway HCU 2024 préservé

---

## 11. ✅ Décisions actées Will 2026-05-08

| # | Question | Décision Will |
|---|---|---|
| Q1 | Volume cible 24 mois | **100 K+ articles** — anticipation Prisma DB + ISR + cache CDN dès architecture |
| Q2 | Stratégie indexation | **Pyramide 3 tiers** — tier-1 (10-20%) / tier-2 (60-70%) / tier-3 (10-20%) |
| Q3 | URL structure | **Plat avec filtres** — `/blog/<slug>` canonique + filtres `?service=...&taille=...` |
| Q4 | Q/R atomiques | **Q/R groupées dans articles** — FAQ embed + Speakable JSON-LD par article |

**Conséquences architecturales** :
- V1 fichiers TS (jusqu'à ~5-10K), V2 migration Prisma DB obligatoire (Sprint 15+ backend, déjà prévu).
- ISR (Incremental Static Regeneration) Next 16 dès que volume > 5K (ne pas SSG les 100K à chaque build).
- Cache CDN Cloudflare Free agressif sur `/blog/<slug>` (revalidation 1h tier-1, 24h tier-2).
- Sitemap blog uniquement tier-1, chunked à 1000 URLs/file.

---

## Annexe A — Contraintes intouchables

- **Doctrine v3.2** : `.hero-schema` carré 576×576, palette tokens uniquement (anti-hex), titleEm Fraunces italique terracotta.
- **Header** : `bg-terracotta` figé, logo intouchable.
- **OÜ estonienne** : 0 mention SIREN/SIRET/RCS (`pnpm anti-siren:check`).
- **Cabinet IA opérationnel** (FR) / **operational AI consultancy** (EN) : naming brand intouchable.
- **i18n parité FR/EN** : tout article DOIT avoir les 2 locales (`pnpm i18n:check`).
- **Mobile-first** : tout doit être lisible sur 375×667.
- **WCAG 2.2 AA** : contraste 4.5:1, focus-visible, ARIA correct.

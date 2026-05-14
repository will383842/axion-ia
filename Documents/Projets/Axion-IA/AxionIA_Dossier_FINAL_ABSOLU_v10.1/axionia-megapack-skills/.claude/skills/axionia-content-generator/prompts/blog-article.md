# Sub-prompt : blog article (4 sources)

> **SLO** : 1 500 mots — p50 ≤ 40 s, p95 ≤ 70 s. 800 mots (gpt-4o-mini) — p50 ≤ 25 s.
>
> **Patch S0ter v2.5** : KB consommée via `searchKnowledge()` + `generateEmbedding()` (Voyage AI dim 1024). KB ingest via `POST /api/internal/kb/ingest` HMAC type=`article` (legacy) ou `news_brief` (RSS V4). Web Vitals gate pre-publish (LCP ≤ 1800ms / INP ≤ 150ms exception cache CF 24h / CLS = 0). Triple body Tiptap obligatoire.
> Couvre les 4 ContentType : `blog_from_title`, `blog_from_keywords`, `blog_from_rss`, `blog_from_pillar`. System prompt commun, user prompt variant par source.
>
> **Contraintes pilier v1.7** :
> - `targetSearchIntent` requis (input) — aligne slug + meta title + meta description + structure H1/H2 + CTA + JSON-LD (§ 26 spec maître)
> - Variant `blog_from_rss` → **JSON-LD `NewsArticle`** (pas `Article`), URL `/fr/actualites/[slug]`, sitemap `sitemap-news.xml` séparé (§ 28)
> - Post-process Q/R auto activé : la FAQ embed déclenche automatiquement 8 pages indexables `/fr/faq/[slug]` (§ 29). Ne pas générer Q/R séparément.
> - Éligible boucle qualité (§ 27) si score 40-74 → repassage automatique ciblé (max 2× auto, économie tokens)
> - Ancrage géographique (`anchorVilleSlug` ou `anchorDepartementCode`) requis sauf si variant RSS

## System prompt (cacheable prefix)

```
{{include references/doctrine-axionia.md}}

Tu es Manon (cf. references/manon-person.md). Tu écris un article de blog AxionIA.

CONTEXTE AXIONIA :
{{kb_chunks_top_8}}

DONNÉES TEMPS RÉEL (Perplexity Sonar — si toggle ON) :
{{perplexity_data_with_citations}}

CONTRAINTES STYLE & STRUCTURE — cf. § 9.7 + § 9.9.2 de la spec maître :
- 1 H1 (50-70 chars, primary KW début, aligné searchIntent)
- TL;DR encadré + Direct Answer 40-80 mots + Key Facts 3-7 bullets + TOC
- 3-7 H2, chaque H2 commence par une réponse extractible (1-2 phrases) puis détail
- FAQ embed 8 items (Speakable JSON-LD) — déclenche 8 pages /fr/faq/[slug] automatiques
- Byline Manon + author-card en bas
- Word count cible : selon {{targetWordCount}} (défaut 1500)
- Insère 1 opinion forte, 1 prédiction datée, 1 chiffre interne, 1 phrase « D'après notre intervention chez {secteur anonymisé} {taille anonymisée} »

⚠️ PILIER V1.7 — searchIntent = {{searchIntent}} doit aligner :
- Slug pattern (informational : "comment-..." | commercial : "...-vs-..." | local : "audit-ia-{ville}")
- Meta title (verbe ou structure spécifique à l'intent)
- Structure body (info : guide long ; commercial : tableau ; local : LocalBusiness)
- CTA (info : doux ; commercial : fort ; local : réservation)

JSON-LD attendus (variant-spécifique cf. § 28 pour RSS) :
- Variants `blog_from_title` / `blog_from_keywords` / `blog_from_pillar` : `Article` (ou `BlogPosting` / `TechArticle` selon format)
- **Variant `blog_from_rss` : `NewsArticle`** (dateline + articleSection + citation[] obligatoire + isBasedOn + wasDerivedFrom)
- Toujours : BreadcrumbList + FAQPage + Speakable + Person Manon (@id) + Organization (@id) + WebPage

CONTRAINTES SORTIE : JSON strict suivant Zod schema `BlogArticleOutputSchema`.
```

## User prompt — variant `blog_from_title`

```
Génère un article de blog AxionIA depuis le titre suivant :

Titre : {{title}}
Format : {{format | default: "article"}}  // article | guide | cas-pratique | interview | veille | tribune | comparatif
searchIntent : {{searchIntent | default: "informational"}}  // ⚠️ v1.7 pilier
Catégorie : {{category}}
Tags : {{tags}}
Secteurs : {{sectors}}
Tailles d'entreprise INSEE : {{companySizes}}  // tpe | pme | eti | grande_entreprise
Type d'organisation : {{organisationType | default: "entreprise_privee"}}
Services AxionIA : {{serviceTypes}}
Ancrage géographique (v1.7 systématique) : {{anchorVilleSlug || anchorDepartementCode}}
Word count cible : {{targetWordCount | default: 1500}}
FAQ items cible : 8 (défaut v1.7 — déclenche 8 pages post-process)
Tonalité : {{tone | default: "expert mais accessible"}}
```

## User prompt — variant `blog_from_keywords`

```
Génère un article de blog AxionIA optimisé pour les mots-clés suivants :

Primary keyword : {{primaryKeyword}}
Secondary keywords : {{secondaryKeywords}}
searchIntent : {{searchIntent}}  // ⚠️ v1.7 — DÉDUIT du primaryKeyword si non fourni
Audience cible : {{targetAudienceSize}} + {{targetAudienceOrganisation}}
Ancrage géographique : {{anchorVilleSlug || anchorDepartementCode}}
Format suggéré (basé sur analyse SERP) : {{suggestedFormat}}
Word count suggéré (moyenne top 10 SERP) : {{suggestedWordCount}}
Outline proposée (à valider Will avant gen finale — Q5 OUI) :
{{outline_8_to_15_sections}}

⚠️ MODE STOP : envoie l'outline d'abord, attends approval Will (24h auto-approve sinon).
```

## User prompt — variant `blog_from_rss` (actualités — § 28 v1.7)

```
Génère un article ACTUALITÉ AxionIA INSPIRÉ (pas copié) d'une source RSS.

Source RSS originale :
- URL : {{rssItem.link}}
- Titre original : {{rssItem.title}}
- Résumé / contenu : {{rssItem.summary || rssItem.content}}
- Date publication source : {{rssItem.publishedAt}}
- Dateline (ville source) : {{rssItem.dateline | default: "Paris"}}

⚠️ CONTRAINTES SPÉCIFIQUES ACTUALITÉS v1.7 (§ 28) :
- URL cible : `/fr/actualites/[slug]` (PAS `/fr/blog/`)
- JSON-LD principal : **`NewsArticle`** (PAS `Article`) avec dateline + articleSection: "Actualité IA" + printSection optional
- Catégorie : "actualite-ia"
- searchIntent : `informational` par défaut
- Tier-2 par défaut auto-publié si score ≥ 60 (Q7 OUI confirmé)
- Cycle de vie : rétrogradation auto tier-2 à J+30 si CTR < 2 %
- Citation source OBLIGATOIRE : `citation[]` + `isBasedOn` + `wasDerivedFrom` + lien externe `rel="external"`
- Anti-plagiat strict : Jaccard < 10 % vs source
- Output champ : `isNews: true`

Tâche :
1. Identifie 5 angles propres à AxionIA pas couverts dans l'article source.
2. Reformule profondément (paraphrase + critique éditoriale AxionIA + ajout contexte).
3. Aucun copier-coller.
4. Le contenu DOIT apporter une plus-value éditoriale propre, sinon STOP.
```

## User prompt — variant `blog_from_pillar`

```
Génère un article de blog AxionIA dérivé d'un guide pilier existant.

Guide pilier source :
- ID : {{pillarGuideId}}
- Titre : {{pillarGuide.title}}
- Sections : {{pillarGuide.sections}}

searchIntent : {{searchIntent | default: "informational"}}  // ⚠️ v1.7
Ancrage géographique : {{anchorVilleSlug || anchorDepartementCode}}

Tâche :
- Extrais 1 angle spécifique du pilier (section ou Q/R particulière)
- Approfondis cet angle en article 800-1200 mots autonome
- Liens internes obligatoires : vers le pilier parent + vers 2-3 sections sœurs
- Pas de redite du pilier — l'article doit être lisible seul
```

## Output Zod schema (commun aux 4 variants, étendu v1.7)

```ts
export const BlogArticleOutputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  format: z.enum(["article","comparatif","guide","cas-pratique","interview","veille","tribune","actualite"]),
  category: z.string(),
  searchIntent: z.enum(["informational","commercial_investigation","transactional","navigational","local"]),
  tags: z.array(z.string()).min(2).max(8),
  sectors: z.array(z.string()).optional(),
  companySizes: z.array(z.enum(["tpe","pme","eti","grande_entreprise"])).optional(),
  organisationTypes: z.array(z.enum([
    "entreprise_privee","ecole","universite","mairie","collectivite","hopital",
    "association","comite_entreprise","opco","carsat","etablissement_public","autre"
  ])).optional(),
  serviceTypes: z.array(z.enum(["audit","interventions","implementation"])).optional(),
  anchorVilleSlug: z.string().optional(),
  anchorDepartementCode: z.string().optional(),
  relatedCities: z.array(z.string()).optional(),

  // v1.7 RSS spécifique
  isNews: z.boolean().default(false),
  newsDateline: z.string().optional(),       // "Paris, 2026-05-13"
  newsSourceUrl: z.string().url().optional(),
  newsSourceName: z.string().optional(),

  // Contenu
  h1: z.string().min(30).max(80),
  metaTitle: z.string().min(50).max(60),
  metaDescription: z.string().min(140).max(160),
  tldr: z.string().min(80).max(300),
  directAnswer: z.string().refine(s => s.split(/\s+/).length >= 40 && s.split(/\s+/).length <= 80),
  keyFacts: z.array(z.string()).min(3).max(7),
  sections: z.array(z.object({
    h2: z.string().min(15).max(70),
    anchor: z.string(),
    bodyHtml: z.string().min(200),
  })).min(3).max(8),
  faq: z.array(z.object({
    q: z.string().min(15).max(150),
    a: z.string().refine(s => s.split(/\s+/).length >= 30 && s.split(/\s+/).length <= 120),
  })).length(8),  // 8 items v1.7 → 8 pages post-process auto
  heroAlt: z.string(),
  heroImagePrompt: z.string(),
  citations: z.array(z.object({ url: z.string().url(), title: z.string(), date: z.string().optional() })).optional(),
  jsonLdBlocks: z.array(z.record(z.unknown())).min(4),  // ≥ 4 schemas, NewsArticle si RSS
});
```

## SLO

- Time-to-first-token ≤ 1 s
- Bout-en-bout 1500 mots : p50 ≤ 40 s, p95 ≤ 70 s
- Bout-en-bout 800 mots (gpt-4o-mini) : p50 ≤ 25 s, p95 ≤ 45 s
- Variant RSS NewsArticle : p50 ≤ 35 s (article plus court)

# PROMPT P3 — AUDIT SEO/AEO/GEO/AI OVERVIEWS — AXION-IA CONTENT-GEN PERFECTION 2026
## Prompt self-contained — exécutable sans contexte de conversation préalable

---

## 1. CONTEXTE PROJET COMPLET

### Identité site
- **Site canonique** : https://axion-ia.com (FR) / miroir EN : https://axion-ia.com/en
- **Concurrent homonyme** : axionai.fr — rank #1 actuellement sur les requêtes brand "Axion IA"
- **Entité légale** : Axion-IA OÜ (Estonie) — 0 SIREN FR, adresse FR non décidée
- **Repo GitHub** : will383842/axion-ia (branche main)
- **Date audit** : 2026-05-21

### Stack technique
- Next.js 16 App Router (SSR/SSG hybride)
- Prisma 5.22 + PostgreSQL + pgvector
- BullMQ workers (content-gen pipeline)
- Coolify déploiement (Hetzner CPX42)
- Cloudflare CDN + WAF

### Score d'entrée P3
- **HEAD commit** : 37ca0147
- **Score P1.5 estimé** : ~770-820/1000 (post Phase A sprint compliance)
- **Agent A06 SEO/AEO/GEO Phase 1** : gap majeur identifié (75 pts, le plus pondéré)
- **Visibilité organique** : 0% HEAD (audit keyword strategy 2026-05-19)

### Verticales produit (5)
1. `interventions_formations` — formations IA entreprises
2. `un_a_un` — coaching 1-to-1 (naming validé : `un-a-un`)
3. `audits` — audit IA stratégique
4. `implementations` — intégration IA sur-mesure
5. `sites_web_augmentes` — web & digital IA (/codage-developpement)

### Cibles business (3)
- `tpe` — TPE < 10 salariés
- `pme` — PME 10-250 salariés
- `eti` — ETI 250-5000 salariés

### Types de contenus générés (7)
1. `blog` — articles blog FR + EN
2. `cas-concret` — case studies métier
3. `landing` — landing pages verticale×ville
4. `faq` — FAQ globale + par verticale
5. `comparatif` — comparatifs outils IA
6. `pilier` — pages piliers thématiques
7. `Q/R auto` — questions/réponses automatiques AEO

### État géographique
- **39 villes pilote indexables** : Paris, Lyon, Marseille, Toulouse, Nice, Nantes, Montpellier, Strasbourg, Bordeaux, Lille, Rennes, Reims, Le Havre, Saint-Étienne, Toulon, Grenoble, Dijon, Angers, Nîmes, Villeurbanne, Le Mans, Aix-en-Provence, Clermont-Ferrand, Brest, Tours, Amiens, Limoges, Perpignan, Metz, Besançon, Orléans, Caen, Mulhouse, Rouen, Nancy (+ 4 autres selon scoring)
- **Cible 12 mois** : 120 villes

### Ce qui a été livré (déjà implémenté — ne pas re-tester en P3)
- `aiGenerated: true` JSON-LD sur BlogPosting + CaseStudy
- `AiContentDisclaimer` composant (AI Act art. 50)
- `GenerationProvenance` metadata
- `MAX_PUBLISH_PER_DAY = 30` drip schedule 8h-22h CET
- 747 keyword seeds connectés (29/29 secteurs)
- FAQ 30Q globale (livrée P1 agent A05)
- IndexNow ping workers
- Sitemap-index.xml + 4+ sub-sitemaps
- Speakable markup partiel (drift P1 identifié)

### Ce qui MANQUE (gaps confirmés entrant en P3)
- Wikidata Q-ID AxionIA : **non créé** (action Will pending)
- Adresse FR Local SEO : **non décidée** (WeWork Paris ~300€/mo option ouverte)
- GSC service account JSON : **non configuré**
- llms.txt : **absent** (mentionné audit P1 A06)
- ai.txt : **absent**
- Knowledge Panel Google : **inexistant**
- Brand queries : axionai.fr rank #1 (pas axion-ia.com)
- Backlinks domaines autorité FR : très peu

### Fichiers clés à auditer
```
src/
  app/[locale]/
    blog/[slug]/page.tsx
    cas-concret/[slug]/page.tsx
    faq/page.tsx
    landing/[verticale]/[ville]/page.tsx
    comparatifs/[slug]/page.tsx
  components/
    seo/
    json-ld/
    content/
  server/
    content-gen/
      workers/
      services/
    sitemap/
    indexnow/
public/
  sitemap*.xml
  llms.txt (absent — à vérifier)
  ai.txt (absent — à vérifier)
  robots.txt
lighthouserc.json
next.config.ts
src/lib/seo/
src/lib/structured-data/
```

---

## 2. MODE OPÉRATOIRE

### AUDIT-ONLY STRICT
```
INTERDICTION ABSOLUE :
  - Aucun git commit
  - Aucune modification de fichier
  - Aucun git add / git stash / git push
  - Aucune écriture en dehors de _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/
  - Aucun appel API externe (GSC, IndexNow, etc.)

AUTORISÉ :
  - Lecture de tous les fichiers du repo
  - Création de fichiers .md dans _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/
  - Exécution de commandes read-only (git log, git show, grep, find, cat)
  - Analyse statique du code (TypeScript, JSON, YAML)
```

### Architecture d'exécution — 10 agents parallèles
```
Orchestrateur
├── A3-01 JSON-LD Schema Coverage          → /100
├── A3-02 Featured Snippets & Position 0   → /80
├── A3-03 AI Overviews / SGE               → /100
├── A3-04 Knowledge Graph & Wikidata       → /80
├── A3-05 AEO Answer Engine Optimization   → /80
├── A3-06 Sitemap & IndexNow               → /70
├── A3-07 Local SEO & Villes               → /90
├── A3-08 E-E-A-T Signals                  → /80
├── A3-09 Core Web Vitals & Mobile         → /70
└── A3-10 Anti-concurrence Homonyme        → /50 (bonus)

TOTAL : /800 agents + /200 cross-cuttings orchestrateur = /1000
```

### Répertoire de livraison
```
_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/
  PHASE-3-VERDICT.md          ← orchestrateur (synthèse + scoring global)
  CROSS-CUTTING.md            ← patterns transverses + décisions Will
  agents/
    A3-01-jsonld-schema.md
    A3-02-featured-snippets.md
    A3-03-ai-overviews.md
    A3-04-knowledge-graph.md
    A3-05-aeo.md
    A3-06-sitemap-indexnow.md
    A3-07-local-seo.md
    A3-08-eeat.md
    A3-09-web-vitals.md
    A3-10-anti-concurrence.md
```

### Convention de scoring par agent
```markdown
## Score : XX/YY

### Points obtenus
- [OK] Description — +N pts
- [PARTIEL] Description — +N pts (max M)
- [MANQUANT] Description — 0 pts (max M)
- [CRITIQUE] Description — 0 pts + impact systémique

### Points perdus
- [P0] Bloquant — N pts perdus — impact : ...
- [P1] Important — N pts perdus — impact : ...
- [P2] Mineur — N pts perdus — impact : ...

### Recommandations ordonnées par ROI
1. Quick win (<2h) : ...
2. Sprint (<1j) : ...
3. Projet (>1j) : ...
```

---

## 3. AGENTS DÉTAILLÉS

---

### AGENT A3-01 — JSON-LD Schema Coverage
**Score maximum : /100**
**Fichier sortie** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/agents/A3-01-jsonld-schema.md`

#### Mission
Auditer l'exhaustivité et la validité de tous les schémas JSON-LD produits par le système content-gen. L'objectif est de maximiser les rich results Google (2026) et les citations AI Overviews.

#### Périmètre de contrôle — schemas attendus par type de page

**BlogPosting / Article** (pages blog)
```json
{
  "@type": "BlogPosting",
  "headline": "< 110 chars",
  "description": "< 160 chars",
  "datePublished": "ISO 8601",
  "dateModified": "ISO 8601",
  "author": { "@type": "Person", "name": "...", "url": "..." },
  "publisher": { "@type": "Organization", "name": "Axion-IA", "logo": {...} },
  "image": { "@type": "ImageObject", "url": "...", "width": 1200, "height": 630 },
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://axion-ia.com/fr/blog/..." },
  "inLanguage": "fr",
  "aiGenerated": true,
  "isAccessibleForFree": true,
  "speakable": { "@type": "SpeakableSpecification", "cssSelector": [...] },
  "about": [...],
  "mentions": [...],
  "isBasedOn": [...],
  "abstract": "< 250 chars"
}
```

**CaseStudy / Article** (pages cas-concret)
```json
{
  "@type": "Article",
  "articleSection": "Cas concret",
  "aiGenerated": true,
  "subjectOf": { "@type": "Event" },
  "contentLocation": { "@type": "Place", "name": "..." },
  "audience": { "@type": "Audience", "audienceType": "PME|TPE|ETI" }
}
```

**FAQPage** (toutes pages avec accordion FAQ)
```json
{
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Question exacte ?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Réponse directe 40-60 mots..."
      }
    }
  ]
}
```

**HowTo** (guides étape par étape)
```json
{
  "@type": "HowTo",
  "name": "...",
  "step": [
    { "@type": "HowToStep", "name": "...", "text": "...", "position": 1 }
  ],
  "totalTime": "PT30M",
  "estimatedCost": { "@type": "MonetaryAmount" }
}
```

**Product / Service** (verticales implémentation/audit)
```json
{
  "@type": "Product",
  "name": "Audit IA Stratégique",
  "description": "...",
  "brand": { "@type": "Brand", "name": "Axion-IA" },
  "offers": { "@type": "Offer", "priceCurrency": "EUR", "price": "...", "availability": "..." },
  "aggregateRating": { "@type": "AggregateRating" }
}
```

**Person** (personas auteurs content-gen)
```json
{
  "@type": "Person",
  "name": "...",
  "jobTitle": "Consultant IA",
  "affiliation": { "@type": "Organization", "name": "Axion-IA" },
  "sameAs": ["https://linkedin.com/...", "https://twitter.com/..."]
}
```

**Organization** (page home + à propos)
```json
{
  "@type": "Organization",
  "name": "Axion-IA",
  "url": "https://axion-ia.com",
  "logo": "...",
  "sameAs": [
    "https://www.linkedin.com/company/axion-ia",
    "https://twitter.com/axion_ia",
    "https://www.wikidata.org/wiki/Q..." // MANQUANT
  ],
  "address": { "@type": "PostalAddress", "addressCountry": "FR" }, // MANQUANT
  "foundingDate": "...",
  "numberOfEmployees": {...}
}
```

**BreadcrumbList** (toutes pages)
```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://axion-ia.com/fr" },
    { "@type": "ListItem", "position": 2, "name": "...", "item": "..." }
  ]
}
```

**SpeakableSpecification** (blog + faq + piliers)
```json
{
  "@type": "SpeakableSpecification",
  "cssSelector": [".article-intro", ".faq-answer", "h1", ".key-takeaway"]
}
```

**ImageObject** (toutes images principales)
```json
{
  "@type": "ImageObject",
  "url": "...",
  "contentUrl": "...",
  "width": 1200,
  "height": 630,
  "caption": "...",
  "license": "https://creativecommons.org/licenses/by/4.0/",
  "creator": { "@type": "Organization", "name": "Axion-IA" }
}
```

**DefinedTerm** (glossaire IA)
```json
{
  "@type": "DefinedTerm",
  "name": "Machine Learning",
  "description": "...",
  "inDefinedTermSet": { "@type": "DefinedTermSet", "name": "Glossaire IA Axion-IA" }
}
```

#### Grille de notation A3-01
| Critère | Points max | Points accordés |
|---------|-----------|----------------|
| BlogPosting complet (tous champs requis 2026) | 15 | ? |
| CaseStudy / Article complet | 10 | ? |
| FAQPage présent sur toutes pages FAQ | 12 | ? |
| HowTo sur guides étape | 8 | ? |
| Product/Service sur landing verticales | 10 | ? |
| Person auteur (persona réel ou composite) | 8 | ? |
| Organization sameAs + adresse (gap) | 10 | ? |
| BreadcrumbList sur 100% des pages | 8 | ? |
| SpeakableSpecification (drift à vérifier) | 10 | ? |
| ImageObject licence CC | 5 | ? |
| DefinedTerm glossaire | 4 | ? |
| **TOTAL** | **100** | **?** |

#### Commandes d'investigation suggérées (read-only)
```bash
# Trouver tous les fichiers JSON-LD générateurs
grep -r "application/ld+json" src/ --include="*.tsx" --include="*.ts" -l
grep -r "BlogPosting\|FAQPage\|HowTo\|Product\|Person\|Organization" src/ --include="*.tsx" --include="*.ts" -l
grep -r "aiGenerated" src/ --include="*.tsx" --include="*.ts" -l
grep -r "SpeakableSpecification\|speakable" src/ --include="*.tsx" --include="*.ts" -l
grep -r "sameAs" src/ --include="*.tsx" --include="*.ts" -l
grep -r "BreadcrumbList" src/ --include="*.tsx" --include="*.ts" -l
# Vérifier champs manquants
grep -r "abstract\|isBasedOn\|mentions\|about" src/ --include="*.tsx" --include="*.ts" -l
# Vérifier Organization adresse
grep -r "PostalAddress\|addressCountry\|streetAddress" src/ --include="*.tsx" --include="*.ts" -l
```

#### Points de vigilance spécifiques
1. `aiGenerated: true` — validé P1 sur BlogPosting/CaseStudy, vérifier propagation sur `landing` et `pilier`
2. `SpeakableSpecification` — drift signalé P1 agent QW-2, vérifier si patch Phase A appliqué correctement
3. `Organization.sameAs` — doit inclure Wikidata URL dès que Q-ID créé
4. `FAQPage` — vérifier que l'accordion React utilise le bon `@id` pour chaque Question
5. Champs 2026 nouveaux : `abstract`, `isBasedOn`, `mentions` (AEO boost)

---

### AGENT A3-02 — Featured Snippets & Position 0
**Score maximum : /80**
**Fichier sortie** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/agents/A3-02-featured-snippets.md`

#### Mission
Analyser la structure du contenu généré pour maximiser les chances d'obtenir des Featured Snippets (position zéro) Google. Audit par type de contenu.

#### Critères par type de contenu

**Paragraphe snippet (définitions / "Qu'est-ce que")**
- Réponse directe en 40-60 mots dans le premier paragraphe après H1
- Commence par une phrase affirmative complète (pas "Oui, ...")
- Inclut le mot-clé exact en début de phrase
- Pas de jargon non défini

**Liste snippet (étapes / "Comment")**
- `<ol>` ou `<ul>` avec items concis (< 10 mots chacun)
- Titre H2 formulé "Comment [verbe] [sujet]"
- 4 à 8 items max
- Chaque item = action concrète

**Tableau snippet (comparaisons / tarifs)**
- `<table>` avec `<thead>` explicite
- Colonnes : Outil / Prix / Points forts / Limites
- Max 5 colonnes
- Titre H2 formulé "Comparaison [sujet] [année]"
- Pas de fusion de cellules complexe

**FAQ snippet (questions directes)**
- Balise `<details>/<summary>` OU `<div role="region">` avec aria-label
- Question = texte exact de la requête utilisateur
- Réponse : 40-60 mots, phrase complète
- Schema FAQPage synchronisé (même texte)

**Accordéon d'ancrage (longform)**
- Table des matières (TOC) présente sur articles > 1500 mots
- Liens d'ancrage `#id` cohérents
- H2/H3 formulés comme questions ou tasks

#### Grille de notation A3-02
| Critère | Points max | Points accordés |
|---------|-----------|----------------|
| Structure paragraphe snippet (blog / pilier) | 15 | ? |
| Structure liste snippet (HowTo / guides) | 12 | ? |
| Structure tableau snippet (comparatifs) | 12 | ? |
| FAQ accordion correct + longueur réponse | 12 | ? |
| TOC présent sur articles > 1500 mots | 8 | ? |
| H2/H3 formulés en questions (intent matching) | 8 | ? |
| Longueur introduction 100-150 mots clé-riche | 8 | ? |
| Meta description 150-160 chars, CTA inclus | 5 | ? |
| **TOTAL** | **80** | **?** |

#### Commandes d'investigation suggérées
```bash
# Vérifier structure des templates de contenu
grep -r "featured\|snippet\|position-0\|toc\|table-of-contents" src/ --include="*.tsx" --include="*.ts" -l
# Analyser les templates de génération de contenu
find src/ -name "*.prompt.ts" -o -name "*template*.ts" -o -name "*prompt*.ts" 2>/dev/null
grep -r "H2\|H3\|heading.*question\|FAQ\|accordion" src/server/content-gen/ --include="*.ts" -l
# Vérifier longueurs de génération
grep -r "maxTokens\|max_tokens\|wordCount\|minLength\|maxLength" src/server/content-gen/ --include="*.ts"
# Templates comparatifs
find src/ -path "*/comparatif*" -o -path "*/comparaisons*" 2>/dev/null | head -20
```

#### Points de vigilance
1. Les prompts Claude de génération incluent-ils des directives "snippet-friendly" ?
2. Les articles générés ont-ils un paragraphe intro de 40-60 mots ?
3. Les FAQ sont-elles générées avec des vraies questions utilisateur (keyword seeds) ?
4. Y a-t-il une directive de longueur max par réponse FAQ ?

---

### AGENT A3-03 — AI Overviews / SGE Optimization
**Score maximum : /100**
**Fichier sortie** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/agents/A3-03-ai-overviews.md`

#### Mission
Auditer l'optimisation du contenu pour les AI Overviews de Google (SGE), Perplexity, ChatGPT Browse, Gemini Advanced et les autres LLM search engines. Ces moteurs citent des sources selon des critères distincts des snippets traditionnels.

#### Critères AI Overviews 2026

**Citabilité par les LLMs**
- Contenu factuel dense (stats, chiffres, dates, sources)
- Phrases courtes et assertives (< 20 mots idéalement)
- Définitions précises en début de section
- Exemples concrets avec données réelles
- Pas de langage promotionnel pur (filtre LLM)

**Fichiers d'indexation IA**
- `public/llms.txt` — fichier listing des contenus pour LLMs (format Anthropic/OpenAI)
- `public/ai.txt` — permissions crawlers IA
- `robots.txt` — ClaudeBot, GPTBot, PerplexityBot non bloqués (CF WAF issue P1 audit antérieur)

**Speakable markup** (Google Assistant + SGE audio)
```json
{
  "@type": "SpeakableSpecification",
  "cssSelector": [
    ".article-summary",
    ".key-points",
    ".faq-answer",
    "h1",
    ".definition-block"
  ]
}
```

**Sources externes fiables**
- Minimum 2-3 liens externes par article vers sources autorité (INSEE, DARES, rapport McKinsey, etc.)
- `rel="noopener"` correct
- Pas de liens brisés (vérification statique)
- Sources datées < 24 mois

**isBasedOn / citations**
```json
{
  "isBasedOn": [
    {
      "@type": "Article",
      "name": "Rapport AI Index 2025 Stanford",
      "url": "https://aiindex.stanford.edu/...",
      "datePublished": "2025-04-15"
    }
  ]
}
```

**Contenu unique vs synthétique**
- Le contenu généré cite-t-il des données propriétaires (cas clients, benchmarks internes) ?
- Y a-t-il des perspectives IA originales ("Selon notre analyse de 500 PME...")
- Données locales FR (INSEE, BPI France) intégrées ?

#### Vérification robots.txt / crawlers IA
```
Doit être PRESENT (non bloqué) :
  User-agent: ClaudeBot         → Allow: /
  User-agent: GPTBot            → Allow: /
  User-agent: PerplexityBot     → Allow: /
  User-agent: Googlebot-Extended → Allow: /
  User-agent: CCBot             → Allow: /

Doit être ABSENT ou Allow: / :
  Disallow: / pour les bots ci-dessus
```

#### llms.txt format attendu
```
# Axion-IA — Formation et Conseil IA pour entreprises françaises

> Axion-IA accompagne les TPE, PME et ETI dans leur transformation par l'IA.
> 5 verticales : formations, coaching 1-to-1, audits, implémentations, sites web augmentés.

## Contenus principaux
- https://axion-ia.com/fr/blog/[slug] — Articles blog FR
- https://axion-ia.com/fr/faq — FAQ 30 questions
- https://axion-ia.com/fr/glossaire — Glossaire 60+ termes IA
- https://axion-ia.com/fr/guides/[slug] — Guides pratiques
- https://axion-ia.com/fr/cas-concret/[slug] — Cas clients

## Optionnel
- https://axion-ia.com/fr/comparaisons/[slug] — Comparatifs outils IA
```

#### Grille de notation A3-03
| Critère | Points max | Points accordés |
|---------|-----------|----------------|
| llms.txt présent et structuré | 15 | ? |
| ai.txt présent | 8 | ? |
| robots.txt — IA crawlers non bloqués | 12 | ? |
| SpeakableSpecification (qualité sélecteurs) | 12 | ? |
| Sources externes fiables linkées (≥ 2/article) | 10 | ? |
| isBasedOn / citations JSON-LD | 8 | ? |
| Contenu factuel dense (stats, chiffres) | 10 | ? |
| Données propriétaires / perspectives originales | 10 | ? |
| Phrases assertives < 20 mots (ton citabilité) | 8 | ? |
| CF WAF — bots IA non bloqués (vérif config) | 7 | ? |
| **TOTAL** | **100** | **?** |

#### Commandes d'investigation suggérées
```bash
# Vérifier existence llms.txt et ai.txt
ls public/llms.txt public/ai.txt 2>/dev/null || echo "ABSENT"
cat public/robots.txt 2>/dev/null | grep -i "ClaudeBot\|GPTBot\|PerplexityBot\|CCBot"
# Vérifier Speakable dans templates
grep -r "SpeakableSpecification\|speakable\|cssSelector" src/ --include="*.tsx" --include="*.ts"
# Vérifier isBasedOn dans générateurs
grep -r "isBasedOn\|citations\|sources_externes" src/server/content-gen/ --include="*.ts"
# Vérifier external links dans templates de génération
grep -r "external.*link\|lien.*externe\|source.*url\|rel.*noopener" src/server/content-gen/ --include="*.ts" -l
# CF WAF config
find . -name "*.yaml" -o -name "*.yml" | xargs grep -l "cloudflare\|CF_WAF\|managed.*rules" 2>/dev/null | head -10
```

#### Points de vigilance
1. CF Managed Content OFF — audit antérieur P1 signalait ClaudeBot/GPTBot bloqués par règle CF → **impact critique sur AI Overviews**
2. llms.txt absent — confirmé dans gaps entrants P3
3. SpeakableSpecification drift — signalé P1, vérifier si patch Phase A (QW-2) est bien en production

---

### AGENT A3-04 — Knowledge Graph & Wikidata
**Score maximum : /80**
**Fichier sortie** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/agents/A3-04-knowledge-graph.md`

#### Mission
Auditer la stratégie Knowledge Graph de Google pour Axion-IA et l'impact de l'absence de Q-ID Wikidata. Analyser la confusion entité vs axionai.fr et les signaux sameAs disponibles.

#### Contexte entité
- **Axion-IA** (axion-ia.com) = notre site
- **Axionai.fr** = concurrent homonyme rank #1 brand — risque de confusion entité Google
- **Wikidata Q-ID** : NON CRÉÉ — action critique pending depuis audit keyword strategy 2026-05-19
- **Knowledge Panel** : inexistant pour axion-ia.com actuellement

#### Checklist Knowledge Graph

**sameAs signals disponibles (à vérifier dans Organization schema)**
```json
"sameAs": [
  "https://www.linkedin.com/company/axion-ia",
  "https://twitter.com/axion_ia",
  "https://www.crunchbase.com/organization/axion-ia",
  "https://www.wikidata.org/wiki/Q..." // MANQUANT
]
```

**Données structurées Organization à vérifier**
- `foundingDate` présent ?
- `numberOfEmployees` ou `size` ?
- `areaServed` → France (ou EU) ?
- `knowsAbout` → topics IA ?
- `hasOfferCatalog` → 5 verticales ?

**Entity disambiguation**
- Le schema Organization inclut-il assez de signaux pour distinguer Axion-IA d'Axionai.fr ?
- Description Organisation explicite "formation IA" vs services génériques ?
- URL canonique `https://axion-ia.com` bien dans `@id` ?

**Google Business Profile**
- Fiche GBP existante ? (adresse FR manquante = fiche impossible ou incomplète)
- NAP cohérence (Name, Address, Phone) entre site et GBP ?
- LocalBusiness schema sur page contact/about ?

**Impact Wikidata absent**
- Google ne peut pas créer de Knowledge Panel fiable sans Wikidata ou fiche officielle
- Risque : Panel affiché pour axionai.fr (concurrent) quand on cherche "Axion IA"
- Wikidata Q-ID = signal tiers de confiance majeur pour SGE

**Mentions presse / citations tierces**
- Sites FR d'autorité citant axion-ia.com ?
- Communiqués de presse indexés ?
- Interviews / podcasts avec transcription indexée ?

#### Grille de notation A3-04
| Critère | Points max | Points accordés |
|---------|-----------|----------------|
| sameAs complet dans Organization schema | 12 | ? |
| Wikidata Q-ID (absent = P0 critique) | 20 | ? |
| Organization schema complet (founding, employees...) | 10 | ? |
| Entity disambiguation vs axionai.fr | 12 | ? |
| Google Business Profile / LocalBusiness | 10 | ? |
| Mentions presse / citations tierces indexées | 8 | ? |
| knowsAbout + hasOfferCatalog | 8 | ? |
| **TOTAL** | **80** | **?** |

#### Commandes d'investigation suggérées
```bash
# Organization schema
grep -r "Organization\|sameAs\|foundingDate\|knowsAbout\|hasOfferCatalog" src/ --include="*.tsx" --include="*.ts"
# LocalBusiness
grep -r "LocalBusiness\|PostalAddress\|GBP\|businessProfile" src/ --include="*.tsx" --include="*.ts"
# Mentions presse
grep -r "presse\|communique\|press-release\|media" src/ --include="*.tsx" --include="*.ts" -l
# Vérifier page À propos / contact
find src/app -name "page.tsx" | xargs grep -l "about\|contact\|apropos" 2>/dev/null | head -10
```

#### Livrables attendus dans A3-04.md
1. Score détaillé avec justification par critère
2. Liste exacte des sameAs présents vs manquants
3. Analyse disambiguation vs axionai.fr
4. Instructions Wikidata Q-ID (qui crée, comment, contenu minimal)
5. Recommandation GBP avec/sans adresse FR
6. Priorisation : P0 (Wikidata urgent) / P1 / P2

---

### AGENT A3-05 — AEO Answer Engine Optimization
**Score maximum : /80**
**Fichier sortie** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/agents/A3-05-aeo.md`

#### Mission
Auditer l'optimisation pour les moteurs de réponse (AEO) — Google, Perplexity, ChatGPT, Gemini, Bing AI. Vérifier la couverture d'intent, les 30 questions FAQ globales, et la préparation voice search.

#### Checklist AEO

**FAQ 30Q globale (livrée P1 — vérifier implémentation)**
```
Structure attendue :
  - 30 questions couvrant toutes les verticales + cibles
  - Intent mix : 40% informatif / 35% commercial / 25% transactionnel
  - Réponses 40-60 mots (snippet-optimized)
  - FAQPage JSON-LD synchronisé
  - Ancres navigables (#faq-q01 → #faq-q30)
  - Hreflang FR/EN sur /faq et /en/faq
```

**Couverture d'intent par verticale**

| Verticale | Informatif | Commercial | Transactionnel |
|-----------|-----------|-----------|---------------|
| interventions_formations | "qu'est-ce que la formation IA" | "formation IA pour PME" | "réserver formation IA Paris" |
| un_a_un | "coaching IA individuel" | "coaching IA prix" | "prendre RDV coach IA" |
| audits | "audit IA entreprise" | "audit IA PME avantages" | "demander audit IA gratuit" |
| implementations | "implémenter IA dans mon entreprise" | "intégrateur IA prix" | "devis implémentation IA" |
| sites_web_augmentes | "site web avec IA" | "site IA développement" | "créer site web IA devis" |

**Voice search readiness**
- Questions formulées en langage naturel ("Comment...?", "Qu'est-ce que...?", "Quel est...?")
- Réponses commençant par formulation directe ("Le coût d'un audit IA est...")
- Micro-format adaptatif : définition en 1 phrase, explication en 2-3 phrases

**Q/R auto (type contenu #7)**
- Le système génère-t-il des pages Q/R automatiques ?
- Format : 1 question = 1 URL = 1 réponse optimisée
- Sitemap dédié ?
- Volume : combien générées vs cible ?

**Longtail semantic coverage**
- Questions 4-7 mots couverts ?
- Questions en français naturel (avec fautes d'orthographe tolérées ?) 
- Questions voix (assistants vocaux) différenciées des questions texte ?
- Questions locales ("formation IA Lyon", "audit IA Bordeaux") ?

**Perplexity / ChatGPT citability factors**
- Contenu lisible en décontextualisé (chunk-proof)
- Chaque section autonome (intro + corps + conclusion)
- Pas d'anaphores sans antécédents ("il", "elle", "ce dernier" → non citables)
- Sources datées et checkables

#### Grille de notation A3-05
| Critère | Points max | Points accordés |
|---------|-----------|----------------|
| FAQ 30Q globale — présence et qualité | 15 | ? |
| FAQPage JSON-LD synchronisé sur /faq | 10 | ? |
| Couverture intent informatif/commercial/transactionnel | 12 | ? |
| Voice search readiness (formulation naturelle) | 8 | ? |
| Q/R auto — pages générées et sitemap | 10 | ? |
| Longtail sémantique villes × verticales | 8 | ? |
| Chunk-proof / citabilité décontextualisée | 10 | ? |
| Hreflang sur /faq FR/EN | 7 | ? |
| **TOTAL** | **80** | **?** |

#### Commandes d'investigation suggérées
```bash
# FAQ globale
find src/app -path "*/faq*" | head -20
grep -r "30.*question\|faq.*global\|FAQ_GLOBAL" src/ --include="*.tsx" --include="*.ts" -l
# Q/R auto pages
find src/app -path "*/qr*" -o -path "*/qa*" -o -path "*/questions*" 2>/dev/null | head -20
grep -r "auto.*qa\|qr-auto\|question.*reponse" src/server/content-gen/ --include="*.ts" -l
# Couverture intent
grep -r "informational\|commercial\|transactionnal\|intent" src/server/content-gen/ --include="*.ts" -l
# Voice search
grep -r "voice.*search\|speakable\|assistant.*vocal" src/ --include="*.ts" -l
# Vérifier hreflang FAQ
grep -r "hreflang\|alternate.*fr\|alternate.*en" src/app/\[locale\]/faq/ --include="*.tsx" 2>/dev/null
```

---

### AGENT A3-06 — Sitemap & IndexNow
**Score maximum : /70**
**Fichier sortie** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/agents/A3-06-sitemap-indexnow.md`

#### Mission
Auditer l'infrastructure sitemap (sitemap-index.xml + sub-sitemaps) et le pipeline IndexNow pour la découverte rapide du contenu généré. GSC soumission status.

#### Checklist sitemap

**sitemap-index.xml**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://axion-ia.com/sitemap-pages.xml</loc></sitemap>
  <sitemap><loc>https://axion-ia.com/sitemap-blog.xml</loc></sitemap>
  <sitemap><loc>https://axion-ia.com/sitemap-villes.xml</loc></sitemap>
  <sitemap><loc>https://axion-ia.com/sitemap-cas-concrets.xml</loc></sitemap>
  <sitemap><loc>https://axion-ia.com/sitemap-faq.xml</loc></sitemap>
  <sitemap><loc>https://axion-ia.com/sitemap-glossaire.xml</loc></sitemap>
  <sitemap><loc>https://axion-ia.com/sitemap-guides.xml</loc></sitemap>
  <sitemap><loc>https://axion-ia.com/sitemap-images.xml</loc></sitemap>
  <sitemap><loc>https://axion-ia.com/sitemap-news.xml</loc></sitemap>
</sitemapindex>
```

**Priorité/changefreq cohérence**
| Type | priority | changefreq |
|------|----------|-----------|
| Homepage | 1.0 | daily |
| Landing verticales | 0.9 | weekly |
| Blog récent (< 30 jours) | 0.8 | daily |
| Blog ancien (> 30 jours) | 0.7 | monthly |
| FAQ | 0.8 | weekly |
| Villes | 0.8 | weekly |
| Comparatifs | 0.7 | monthly |
| Glossaire | 0.6 | monthly |

**Images sitemap (Google Images)**
```xml
<url>
  <loc>https://axion-ia.com/fr/blog/slug</loc>
  <image:image>
    <image:loc>https://axion-ia.com/images/blog/slug-1200x630.webp</image:loc>
    <image:title>Formation IA pour PME — Axion-IA</image:title>
    <image:caption>...</image:caption>
  </image:image>
</url>
```

**Hreflang dans sitemaps**
```xml
<url>
  <loc>https://axion-ia.com/fr/blog/slug</loc>
  <xhtml:link rel="alternate" hreflang="fr" href="https://axion-ia.com/fr/blog/slug"/>
  <xhtml:link rel="alternate" hreflang="en" href="https://axion-ia.com/en/blog/slug"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://axion-ia.com/fr/blog/slug"/>
</url>
```

**IndexNow pipeline**
- Ping déclenché à chaque publication ? (BlogPosting, CaseStudy, Landing)
- Clé IndexNow valide dans `public/[key].txt` ?
- INDEXNOW_KEY rotation (recommandé > 6 mois)
- Endpoints : Bing, Yandex (Google ne supporte pas encore IndexNow officiellement)
- Worker BullMQ : délai < 60s après publication ?
- Retry logic en cas d'échec ?

**GSC soumission**
- GSC service account configuré ? (NON — gap entrant P3)
- Sitemap-index.xml soumis manuellement à GSC ?
- Soumission Bing Webmaster Tools ?
- Erreurs d'exploration GSC ? (crawl budget)
- Pages orphelines non sitemappées ?

#### Grille de notation A3-06
| Critère | Points max | Points accordés |
|---------|-----------|----------------|
| sitemap-index.xml présent et valide | 10 | ? |
| 4+ sub-sitemaps couvrant tous types contenus | 10 | ? |
| Images sitemap (Google Images) | 8 | ? |
| Hreflang FR/EN dans sitemaps | 8 | ? |
| Priorité/changefreq cohérents | 5 | ? |
| IndexNow ping < 60s post-publication | 10 | ? |
| IndexNow retry + clé valide | 5 | ? |
| GSC soumission (status) | 8 | ? |
| Pages orphelines (non sitemappées) | 6 | ? |
| **TOTAL** | **70** | **?** |

#### Commandes d'investigation suggérées
```bash
# Sitemaps
find public/ -name "sitemap*" | head -20
find src/app -path "*sitemap*" | head -20
cat public/sitemap*.xml 2>/dev/null | head -50
# IndexNow
grep -r "indexnow\|INDEXNOW_KEY\|indexNow" src/ --include="*.ts" -l
grep -r "IndexNow\|ping.*indexnow" src/server/ --include="*.ts"
ls public/*.txt 2>/dev/null # clé IndexNow
# Hreflang dans sitemaps
grep -r "hreflang\|xhtml:link\|alternate" src/app/ --include="*.ts" --include="*.tsx" -l
# Workers publication
grep -r "publishContent\|content.*publish\|IndexNow.*worker" src/server/queue/ --include="*.ts" -l
```

---

### AGENT A3-07 — Local SEO & Villes
**Score maximum : /90**
**Fichier sortie** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/agents/A3-07-local-seo.md`

#### Mission
Auditer la stratégie Local SEO pour les 39 villes pilote indexables et la préparation pour 120 villes à 12 mois. Vérifier les schémas LocalBusiness, la cohérence NAP, les liens internes inter-villes.

#### Checklist Local SEO

**Architecture landing villes**
```
URL pattern : https://axion-ia.com/fr/[verticale]/[ville]
Exemples :
  /fr/formation-ia/paris
  /fr/audit-ia/lyon
  /fr/implementation-ia/bordeaux
  
Chaque landing doit avoir :
  - Title : "[Verticale] [Ville] — Axion-IA | [Année]"
  - Meta description unique mentionnant la ville
  - H1 avec ville explicite
  - Contenu > 800 mots avec données locales
  - LocalBusiness JSON-LD
  - BreadcrumbList
  - Liens vers autres villes (rayon 30-50km)
```

**LocalBusiness JSON-LD attendu**
```json
{
  "@type": ["LocalBusiness", "ProfessionalService"],
  "name": "Axion-IA — Formation IA Paris",
  "description": "Formation et conseil en Intelligence Artificielle à Paris...",
  "url": "https://axion-ia.com/fr/formation-ia/paris",
  "telephone": "+33...",
  "areaServed": {
    "@type": "City",
    "name": "Paris",
    "sameAs": "https://www.wikidata.org/wiki/Q90"
  },
  "priceRange": "€€-€€€",
  "openingHoursSpecification": [...],
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 48.8566,
    "longitude": 2.3522
  }
}
```

**Adresse FR manquante — impact local SEO**
- Sans adresse physique FR → impossible d'activer Google Business Profile complet
- Schema LocalBusiness sans `address` → signal faible
- Alternatives analysées :
  1. WeWork Paris (~300€/mo) → adresse réelle, eligible GBP
  2. Domiciliation légale (~20-50€/mo) → adresse postale uniquement
  3. Sans adresse → GBP "zone de service" possible mais limité
  4. Bureau Estonie (Axion-IA OÜ) → eligible mais moins d'autorité FR

**NAP cohérence**
- Name : "Axion-IA" uniforme (pas "Axion IA" ou "AxionIA")
- Address : cohérent entre site, GBP, annuaires
- Phone : format +33 unifié

**Liens internes inter-villes**
```
Paris → [Lyon, Marseille, Bordeaux, Nantes, Lille] // 5 villes proches majeures
Lyon → [Grenoble, Dijon, Saint-Étienne, Clermont-Ferrand] // rayon 150km
Marseille → [Nice, Toulon, Montpellier, Aix-en-Provence]
```
- Chaque page ville contient-elle un bloc "Autres villes" ?
- Maillage en étoile (hub Paris → rayons) ou mesh complet ?

**Données locales dans le contenu**
- INSEE data par ville intégré (economic-data/<slug>.ts)
- Statistiques TPE/PME locales ?
- Secteurs économiques dominants par ville ?
- Références spécifiques à l'écosystème IA local (incubateurs, French Tech) ?

**39 villes — couverture scoring**
- Vérifier que les 39 villes ont bien une landing pour chaque verticale (5 × 39 = 195 landings)
- Score moyen de qualité des pages villes ?
- Pages villes EN miroir générées ?

#### Grille de notation A3-07
| Critère | Points max | Points accordés |
|---------|-----------|----------------|
| Architecture URL villes cohérente | 8 | ? |
| LocalBusiness JSON-LD par page ville | 15 | ? |
| Adresse FR — impact et alternative recommandée | 12 | ? |
| NAP cohérence site + schémas | 8 | ? |
| Liens internes inter-villes (rayon géo) | 10 | ? |
| Données locales INSEE / économiques intégrées | 12 | ? |
| 39 villes couvertes (5 verticales chacune) | 12 | ? |
| Sitemap villes auto-scalable | 8 | ? |
| GBP status et recommandation | 5 | ? |
| **TOTAL** | **90** | **?** |

#### Commandes d'investigation suggérées
```bash
# Architecture villes
find src/app -path "*/\[ville\]*" -o -path "*/\[city\]*" 2>/dev/null | head -20
find src/app -path "*/\[verticale\]*" 2>/dev/null | head -20
# LocalBusiness
grep -r "LocalBusiness\|ProfessionalService\|GeoCoordinates\|areaServed" src/ --include="*.tsx" --include="*.ts"
# Données économiques villes
find src/ -path "*/economic-data*" | head -10
ls src/server/content-gen/data/villes/ 2>/dev/null || find src/ -name "economic-data" -type d 2>/dev/null
# Liens inter-villes
grep -r "nearby.*villes\|villes.*proches\|inter.*villes\|rayon" src/ --include="*.tsx" --include="*.ts" -l
# NAP
grep -r "NAP\|tel:\|telephone\|phone.*+33" src/ --include="*.tsx" --include="*.ts" | head -20
```

---

### AGENT A3-08 — E-E-A-T Signals
**Score maximum : /80**
**Fichier sortie** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/agents/A3-08-eeat.md`

#### Mission
Auditer les signaux E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) pour le contenu généré. Critical pour éviter la pénalité "helpful content" sur contenu IA.

#### Framework E-E-A-T Google 2026

**Experience (Expérience)**
- Contenu basé sur expérience réelle ? (cas clients, benchmarks)
- Données propriétaires citées (X clients accompagnés, Y% ROI moyen) ?
- Témoignages clients avec attributions réelles ?
- Mentions de projets concrets (avec accord client) ?

**Expertise (Expertise)**
- Personas auteurs crédibles et vérifiables ?
- Credentials affichés (années XP, certifications) ?
- Contenu technique précis (pas de généralités) ?
- Profondeur de traitement (> 1500 mots pour sujets techniques) ?

**Authoritativeness (Autorité)**
- Backlinks depuis sites d'autorité FR (BFM Business, Les Echos, JDN, etc.) ?
- Citations dans d'autres sources IA/tech ?
- Experts tiers cités avec attribution ?
- Mentions presse / awards ?

**Trustworthiness (Fiabilité)**
- HTTPS + certificat valide
- Mentions légales / CGV / Politique confidentialité accessibles
- `aiGenerated: true` → transparence IA (AI Act art. 50)
- `AiContentDisclaimer` visible sur contenu généré
- Dates de publication et mise à jour affichées
- Corrections/updates changelog visible ?

**Persona auteur (content-gen)**
- Les articles générés ont-ils un auteur assigné ?
- L'auteur a-t-il une page profil `/fr/equipe/[slug]` ?
- Person JSON-LD avec sameAs LinkedIn ?
- Photo auteur ?
- Bio 100-150 mots avec credentials ?

**Fraîcheur du contenu**
- `dateModified` mis à jour à chaque refresh contenu ?
- Articles > 12 mois revus régulièrement ?
- Dates ISO 8601 dans JSON-LD ?
- Affichage "Mis à jour le [date]" visible côté utilisateur ?

**External links autorité**
- Liens sortants vers sources primaires (DARES, INSEE, McKinsey, Stanford AI Index) ?
- Pas de liens cassés (vérification statique)
- `rel="noopener noreferrer"` correct

#### Grille de notation A3-08
| Critère | Points max | Points accordés |
|---------|-----------|----------------|
| Experience — données propriétaires / cas réels | 10 | ? |
| Expertise — personas auteurs crédibles | 12 | ? |
| Autorité — backlinks FR autorité (vérification meta) | 10 | ? |
| Fiabilité — AI Act disclaimer visible | 10 | ? |
| Fiabilité — mentions légales / CGV accessibles | 5 | ? |
| Fraîcheur — dateModified JSON-LD + affichage | 10 | ? |
| Person JSON-LD auteur complet + sameAs | 12 | ? |
| External links autorité (≥ 2/article) | 8 | ? |
| HTTPS + certificat (check config) | 3 | ? |
| **TOTAL** | **80** | **?** |

#### Commandes d'investigation suggérées
```bash
# Personas auteurs
find src/app -path "*/equipe*" -o -path "*/team*" -o -path "*/auteur*" -o -path "*/author*" 2>/dev/null | head -20
grep -r "Person.*author\|author.*Person\|auteur.*json" src/ --include="*.tsx" --include="*.ts" -l
# AI Disclaimer
grep -r "AiContentDisclaimer\|aiGenerated\|ai.*disclaimer\|IA.*disclaimer" src/ --include="*.tsx" --include="*.ts" -l
# dateModified
grep -r "dateModified\|date.*modified\|updatedAt\|lastModified" src/server/content-gen/ --include="*.ts" | head -20
# External links
grep -r "external.*link\|outbound\|noopener\|noreferrer" src/server/content-gen/ --include="*.ts" -l
# Mentions légales
find src/app -path "*/mentions-legales*" -o -path "*/legal*" -o -path "*/cgv*" 2>/dev/null | head -10
# Backlinks (vérification statique partielle)
grep -r "bfmtv\|lesechos\|journaldunet\|siècle-digital\|01net" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10
```

---

### AGENT A3-09 — Core Web Vitals & Mobile
**Score maximum : /70**
**Fichier sortie** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/agents/A3-09-web-vitals.md`

#### Mission
Vérifier que les cibles Web Vitals définies dans lighthouserc.json sont maintenues après les ajouts P1.5. Analyser l'impact des nouveaux composants (AiContentDisclaimer, GenerationProvenance, etc.) sur les performances.

#### Cibles lighthouserc.json (reference)
```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.85}],
        "first-contentful-paint": ["warn", {"maxNumericValue": 2000}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 1800}],
        "interaction-to-next-paint": ["error", {"maxNumericValue": 80}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.05}],
        "total-blocking-time": ["warn", {"maxNumericValue": 200}]
      }
    }
  }
}
```

**Cibles Web Vitals P3**
| Métrique | Cible | Seuil critique |
|---------|-------|---------------|
| LCP | ≤ 1800ms | > 2500ms = rouge |
| INP | ≤ 80ms | > 200ms = rouge |
| CLS | ≤ 0.05 | > 0.25 = rouge |
| JS bundle gz | ≤ 75 KB | > 100 KB = blocant |
| FCP | ≤ 2000ms | > 3000ms = rouge |
| TBT | ≤ 200ms | > 600ms = rouge |

#### Impact composants P1.5 à analyser
1. `AiContentDisclaimer` — composant ajouté sur chaque article → layout shift risk ?
2. `GenerationProvenance` metadata → weight JS ?
3. FAQ accordion 30Q — JS hydration sur page /faq → INP ?
4. Nouveaux JSON-LD volumineux (isBasedOn, mentions) → TTFB ?
5. ImageObject avec licence — lazy loading correct ?

#### Checklist technique performance
**JavaScript**
```bash
# Bundle analysis (lecture seule)
cat .next/build-manifest.json 2>/dev/null | grep "size" | head -20
find .next/static/chunks/ -name "*.js" -exec wc -c {} \; 2>/dev/null | sort -rn | head -20
# lighthouserc
cat lighthouserc.json 2>/dev/null
```

**Images**
- Format WebP/AVIF utilisé ? (next/image)
- Lazy loading par défaut ?
- Taille < 100 KB pour images above-fold ?
- LCP image pré-chargée ?

**CSS**
- CLS potentiel : skeleton loaders sur contenu dynamique ?
- Font loading strategy (swap) ?
- Viewport meta correct ?

**Server-side**
- `generateStaticParams` sur pages villes ? (SSG vs SSR)
- `cache()` / `unstable_cache` utilisé ?
- TTFB < 800ms sur CF edge ?

**Mobile**
- Viewport mobile 375px testé ?
- Touch targets ≥ 44px (WCAG 2.5.5) ?
- Tap delay 0 (FastClick ou meta viewport) ?
- Media queries mobile-first ?

#### Grille de notation A3-09
| Critère | Points max | Points accordés |
|---------|-----------|----------------|
| lighthouserc.json cibles maintenues (analyse statique) | 15 | ? |
| JS bundle ≤ 75 KB gz (vérification build) | 12 | ? |
| LCP ≤ 1800ms — stratégie SSG/cache | 10 | ? |
| CLS ≤ 0.05 — skeleton loaders + no layout shift | 10 | ? |
| INP ≤ 80ms — hydration light (accordion, FAQ) | 10 | ? |
| Images WebP/AVIF + lazy loading | 8 | ? |
| Mobile — viewport, touch targets | 5 | ? |
| **TOTAL** | **70** | **?** |

#### Commandes d'investigation suggérées
```bash
# lighthouserc
cat lighthouserc.json 2>/dev/null
cat .lighthouserc.json 2>/dev/null
find . -name "lighthouserc*" 2>/dev/null | head -5
# next.config
cat next.config.ts 2>/dev/null | head -80
# Bundle sizes (si .next/ disponible)
find .next/static/chunks/ -name "*.js" -size +50k 2>/dev/null | head -10
# Images config
grep -r "next/image\|Image.*priority\|loading.*lazy\|fetchPriority" src/ --include="*.tsx" | head -20
# generateStaticParams villes
grep -r "generateStaticParams\|getStaticPaths" src/app/ --include="*.tsx" -l
# Cache strategies
grep -r "unstable_cache\|revalidate\|cache.*'force-cache'\|cache.*'no-store'" src/ --include="*.ts" --include="*.tsx" | head -20
# AiContentDisclaimer weight
find src/ -name "AiContentDisclaimer*" | head -5
grep -r "AiContentDisclaimer" src/ --include="*.tsx" | head -10
```

---

### AGENT A3-10 — Stratégie Anti-concurrence Homonyme
**Score maximum : /50 (BONUS)**
**Fichier sortie** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/agents/A3-10-anti-concurrence.md`

#### Mission
Analyser la menace concurrentielle de axionai.fr (rank #1 sur "Axion IA") et recommander une stratégie de différenciation via rich results, brand queries, Wikidata, presse, et schémas d'entité.

#### Analyse de la situation
- **axionai.fr** = concurrent homonyme, rank #1 sur "Axion IA" actuellement
- **axion-ia.com** = notre site, 0% visibilité organique HEAD
- Risque : confusion entité Google → Knowledge Panel affiché pour le mauvais site
- Risque : SERP brand queries capturées par axionai.fr
- Risque : AI Overviews citent axionai.fr quand on parle d'Axion-IA

#### Checklist différenciation

**1. Différenciation schémas**
- Organization `@id` = `https://axion-ia.com` (pas ambiguë)
- `alternateName` : "Axion IA" ET "AxionIA" → reconnu comme variantes
- `legalName` : "Axion-IA OÜ" → distinctif
- `description` : mentionne explicitement l'OÜ estonien et le focus FR PME/ETI

**2. Brand queries SEO**
- Pages optimisées pour "Axion IA formation", "Axion IA avis", "Axion IA prix"
- FAQ : "Quelle est la différence entre Axion-IA et axionai.fr ?"
- Sitelinks Google : homepage structure (min 6 liens de qualité)

**3. Rich results avantage**
- Axion-ia.com peut obtenir : FAQPage, HowTo, Product, BreadcrumbList, SpeakableSpecification
- Chaque rich result = avantage visuel SERP vs axionai.fr (vérifier leur schema.org)
- SiteLinksSearchBox pour brand query Google

**4. Wikidata urgence (P0)**
- Créer Q-ID Wikidata `Axion-IA` avec description précise
- Sameás : axion-ia.com (pas axionai.fr)
- Descriptions en FR + EN + OÜ estonien
- Impact : Knowledge Panel Google exclusif → différenciation immédiate

**5. Mentions presse et autorité**
- 1 seule interview ou mention dans Journal du Net, BFM Business, etc. = signal fort
- Guest posts sur sites IA FR (LeMagIT, Silicon.fr) avec lien dofollow
- Contribution rapports sectoriels (France Num, Bpifrance)

**6. SiteLinksSearchBox**
```json
{
  "@type": "WebSite",
  "@id": "https://axion-ia.com/#website",
  "name": "Axion-IA",
  "url": "https://axion-ia.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://axion-ia.com/fr/recherche?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

**7. Monitoring concurrent**
- Alertes Google Alerts sur "Axion IA"
- Tracking rank SERP brand queries
- Veille Knowledge Panel

#### Grille de notation A3-10 (bonus)
| Critère | Points max | Points accordés |
|---------|-----------|----------------|
| Organization schema différenciation (legalName, OÜ) | 10 | ? |
| SiteLinksSearchBox implémenté | 8 | ? |
| Pages brand queries optimisées | 8 | ? |
| Wikidata stratégie documentée (urgence P0) | 12 | ? |
| Rich results avantage vs concurrent | 8 | ? |
| Analyse réelle schema axionai.fr (read-only) | 4 | ? |
| **TOTAL** | **50** | **?** |

#### Commandes d'investigation suggérées
```bash
# SiteLinksSearchBox
grep -r "SearchAction\|SiteLinksSearchBox\|potentialAction\|search_term_string" src/ --include="*.tsx" --include="*.ts"
# Organization legalName / alternateName
grep -r "legalName\|alternateName\|Axion-IA OÜ" src/ --include="*.tsx" --include="*.ts"
# Brand queries pages
find src/app -path "*axion*" | head -20
grep -r "brand.*query\|brand.*faq\|avis.*axion\|prix.*axion" src/ --include="*.tsx" --include="*.ts" -l
# WebSite schema
grep -r "@type.*WebSite\|WebSite.*@type" src/ --include="*.tsx" --include="*.ts"
```

---

## 4. SCORING GLOBAL /1000

### Répartition des points
```
Agents (800 pts max) :
  A3-01 JSON-LD Schema Coverage         /100
  A3-02 Featured Snippets & Position 0   /80
  A3-03 AI Overviews / SGE               /100
  A3-04 Knowledge Graph & Wikidata        /80
  A3-05 AEO Answer Engine                 /80
  A3-06 Sitemap & IndexNow                /70
  A3-07 Local SEO & Villes                /90
  A3-08 E-E-A-T Signals                   /80
  A3-09 Core Web Vitals & Mobile          /70
  A3-10 Anti-concurrence Homonyme        /50 (bonus)
  Sous-total agents                      /800

Cross-cuttings orchestrateur (200 pts max) :
  Cohérence inter-agents (pas de contradictions)  /40
  Priorisation P0/P1/P2 rigoureuse               /40
  Décisions Will identifiées clairement           /40
  Quick wins identifiés (< 2h chacun)             /40
  Roadmap 30/60/90 jours réaliste                 /40
  Sous-total cross-cuttings                      /200

TOTAL PHASE 3                                   /1000
```

### Seuils de décision
```
VERT  — GO          ≥ 900/1000  → Phase 4 peut démarrer
JAUNE — CONDITIONNEL 750-899    → Corriger P0 avant Phase 4
ROUGE — NO-GO       < 750       → Sprint correctif P0+P1 obligatoire
```

### Template de verdict dans PHASE-3-VERDICT.md
```markdown
# PHASE 3 VERDICT — SEO/AEO/GEO/AI OVERVIEWS
## Date : [DATE]
## HEAD commit : [HASH]

## Scores par agent
| Agent | Score | Max | % | Verdict |
|-------|-------|-----|---|---------|
| A3-01 JSON-LD Schema | XX | 100 | XX% | 🟢/🟡/🔴 |
| A3-02 Featured Snippets | XX | 80 | XX% | ... |
| A3-03 AI Overviews | XX | 100 | XX% | ... |
| A3-04 Knowledge Graph | XX | 80 | XX% | ... |
| A3-05 AEO | XX | 80 | XX% | ... |
| A3-06 Sitemap IndexNow | XX | 70 | XX% | ... |
| A3-07 Local SEO | XX | 90 | XX% | ... |
| A3-08 E-E-A-T | XX | 80 | XX% | ... |
| A3-09 Web Vitals | XX | 70 | XX% | ... |
| A3-10 Anti-concurrence | XX | 50 | XX% | ... |
| **Cross-cuttings** | XX | 200 | XX% | ... |
| **TOTAL** | **XXX** | **1000** | **XX%** | **🟢/🟡/🔴** |

## Verdict global
[GO / CONDITIONNEL / NO-GO]

## Top 5 issues critiques (P0)
1. [description — impact — correction]
2. ...

## Top 5 quick wins (< 2h)
1. [description — gain estimé — fichier à modifier]
2. ...

## Décisions Will requises
[Voir CROSS-CUTTING.md]
```

---

## 5. LIVRAISON

### Arborescence complète
```
C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\CONTENT-GEN-PERFECTION-2026\phase-3\
├── PHASE-3-VERDICT.md                    ← synthèse globale + scoring
├── CROSS-CUTTING.md                      ← patterns transverses + décisions Will
└── agents\
    ├── A3-01-jsonld-schema.md
    ├── A3-02-featured-snippets.md
    ├── A3-03-ai-overviews.md
    ├── A3-04-knowledge-graph.md
    ├── A3-05-aeo.md
    ├── A3-06-sitemap-indexnow.md
    ├── A3-07-local-seo.md
    ├── A3-08-eeat.md
    ├── A3-09-web-vitals.md
    └── A3-10-anti-concurrence.md
```

### Contenu de CROSS-CUTTING.md (template)
```markdown
# CROSS-CUTTING — Phase 3 SEO/AEO/GEO/AI Overviews

## Patterns transverses détectés
### Pattern 1 : [Description]
- Impact sur : [A3-01, A3-03, A3-08]
- Priorité : P0/P1/P2
- Fix : [description]

## Quick wins (< 2h) — Top 10
| Rang | Action | Gain estimé | Fichier |
|------|--------|-------------|---------|
| 1 | ... | +XX pts | src/... |

## Décisions Will — Blocantes
| ID | Décision | Deadline | Impact |
|----|---------|---------|--------|
| DW-3-01 | Créer Wikidata Q-ID Axion-IA | URGENT (<48h) | A3-04 P0, A3-10 |
| DW-3-02 | Adresse FR (WeWork/domiciliation/rien) | < 7 jours | A3-07, A3-04 |
| DW-3-03 | GSC service account JSON setup | < 7 jours | A3-06 |
| DW-3-04 | llms.txt — contenu à valider | < 48h | A3-03 P0 |
| DW-3-05 | CF WAF — débloquer bots IA | < 24h | A3-03 P0 |

## Roadmap correctifs
### 0-24h (P0 critiques)
- [ ] llms.txt + ai.txt création
- [ ] CF WAF — débloquer ClaudeBot/GPTBot/PerplexityBot
- [ ] robots.txt — vérifier Allow: / bots IA

### 0-7 jours (P1 importants)
- [ ] Wikidata Q-ID Axion-IA (Will)
- [ ] SiteLinksSearchBox WebSite schema
- [ ] isBasedOn + abstract + mentions sur BlogPosting
- [ ] SpeakableSpecification drift fix

### 8-30 jours (P2 amélioration)
- [ ] Adresse FR → LocalBusiness complet
- [ ] GSC service account + soumission programmatique
- [ ] Person JSON-LD auteurs (personas complets)
- [ ] Images sitemap Google Images
- [ ] Liens inter-villes rayon géographique

### 31-90 jours (P3 roadmap)
- [ ] Knowledge Panel obtenu (Wikidata + GBP + presse)
- [ ] 120 villes couvertes
- [ ] Featured Snippets obtenus (monitoring)
- [ ] AI Overviews citations confirmées (Perplexity)
```

---

## 6. STOP & ASK WILL — DÉCISIONS CANONIQUES

Après livraison complète des 12 fichiers dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/`, l'orchestrateur doit afficher le message suivant à Will :

---

```
╔══════════════════════════════════════════════════════════════════╗
║           PHASE 3 AUDIT TERMINÉ — DÉCISIONS REQUIRED            ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  SCORE : XXX/1000 → [GO / CONDITIONNEL / NO-GO]                ║
║                                                                  ║
║  4 DÉCISIONS CANONIQUES WILL REQUISES :                         ║
║                                                                  ║
║  [DW-3-01] WIKIDATA Q-ID URGENCE (P0)                          ║
║  → Créer https://www.wikidata.org/wiki/Q[ID] pour Axion-IA     ║
║  → Impact : Knowledge Panel Google + SGE disambiguation         ║
║  → Toi seul peux créer/valider l'entrée Wikidata               ║
║  → Délai recommandé : < 48h                                     ║
║                                                                  ║
║  [DW-3-02] ADRESSE FR LOCAL SEO                                 ║
║  Options :                                                       ║
║    A) WeWork Paris ~300€/mo → GBP complet + LocalBusiness      ║
║    B) Domiciliation ~30€/mo → adresse postale seule            ║
║    C) Zone de service sans adresse → GBP limité                ║
║    D) Adresse Estonie → GBP EU mais faible signal FR           ║
║  → Ta décision débloque 12 pts en A3-07                        ║
║                                                                  ║
║  [DW-3-03] GSC SERVICE ACCOUNT JSON                             ║
║  → Créer service account Google Cloud Console                   ║
║  → Ajouter JSON key en secret Coolify                          ║
║  → Délai : < 7 jours (débloque soumission auto sitemaps)       ║
║                                                                  ║
║  [DW-3-04] CF WAF — BOTS IA BLOQUÉS ?                          ║
║  → Vérifier Cloudflare Dashboard > Security > WAF              ║
║  → Managed Rules > CF Bot Management                           ║
║  → S'assurer ClaudeBot/GPTBot/PerplexityBot = Allow           ║
║  → Impact : -15 pts A3-03 si bloqués                           ║
║                                                                  ║
║  Réponds : "OUI [décisions]" ou détaille tes choix.            ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 7. PHRASE DE LANCEMENT SELF-CONTAINED

Copie-colle exactement ce bloc pour lancer l'audit P3 :

```
Tu es un agent d'audit SEO/AEO/GEO/AI Overviews pour le projet Axion-IA.

RÉPERTOIRE PROJET : C:\Users\willi\Documents\Projets\Axion-IA
RÉPERTOIRE SORTIE : C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\CONTENT-GEN-PERFECTION-2026\phase-3\

MISSION : Audit complet de visibilité SEO/AEO/GEO/AI Overviews du système content-gen d'Axion-IA. Mode AUDIT-ONLY (zéro commit, lecture seule). Score /1000.

CONTEXTE : Lis d'abord C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\PROMPT-3-SEO-AEO-GEO-AI-OVERVIEWS-2026.md pour les instructions complètes. Ce fichier contient tout le contexte nécessaire, les 10 agents, les grilles de notation et les templates de sortie.

EXÉCUTION : Lance 10 agents parallèles (A3-01 à A3-10) selon les instructions du prompt. Crée tous les fichiers de sortie dans le répertoire phase-3/. Termine par PHASE-3-VERDICT.md + CROSS-CUTTING.md + message STOP & ASK Will.

CONTRAINTES :
- AUDIT-ONLY : aucun git commit, aucune modification de code
- Tous les fichiers de sortie dans _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-3/
- Chaque agent produit son fichier agents/A3-0X-*.md avec score justifié
- L'orchestrateur produit PHASE-3-VERDICT.md avec score global /1000
- Afficher le message STOP & ASK Will à la fin avec les 4 décisions canoniques

Lance maintenant.
```

---

## ANNEXE — RÉFÉRENCE RAPIDE

### Fichiers source prioritaires à auditer
```
src/lib/structured-data/           → JSON-LD generators
src/lib/seo/                       → SEO utilities
src/server/content-gen/            → Pipeline content
src/server/sitemap/                → Sitemap generators
src/server/indexnow/               → IndexNow workers
src/app/[locale]/faq/              → FAQ page
src/app/[locale]/blog/[slug]/      → Blog post page
src/app/[locale]/cas-concret/[slug]/ → Case study
public/robots.txt                  → Crawl rules
public/sitemap-index.xml           → Sitemap root
public/llms.txt                    → LLMs indexing (ABSENT)
lighthouserc.json                  → Perf thresholds
next.config.ts                     → Next.js config
```

### Scores de référence P1 agent A06 SEO/AEO/GEO
(Phase 1 audit content-gen 2026-05-21 — 531.5/1000 global)
- Agent A06 SEO/AEO/GEO : gap majeur identifié (75 pts, le plus pondéré)
- Drift Speakable signalé
- llms.txt absent
- Knowledge Graph inexistant
- Wikidata Q-ID manquant

### Commits de référence
- HEAD P3 : 37ca0147
- P1.5 Phase A : ffdb49a6
- QW-1 (aiGenerated JSON-LD) : dans ffdb49a6
- QW-2 (Speakable fix) : dans ffdb49a6
- QW-6 (AiContentDisclaimer) : dans ffdb49a6
- QW-7 (GenerationProvenance) : dans ffdb49a6

### Contacts techniques
- Repo : https://github.com/will383842/axion-ia
- Owner : will383842 / beeeditions@gmail.com
- Coolify prod : Hetzner CPX42
- Site : https://axion-ia.com
```

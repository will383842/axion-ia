# A4-06 : Brand Voice & Persona — Cohérence Cross-Articles
**Audit Phase 4 — 2026-05-21**
**Auditeur** : Agent A4-06 (AUDIT-ONLY STRICT — 0 commit, 0 modification)

---

## Score : 46/70

---

### 1. Définition brand voice — 9/15

#### Fichiers trouvés

| Fichier | Rôle | Contenu |
|---|---|---|
| `src/lib/brand.ts` | SSOT branding | Nom, tagline FR/EN, slogan, URL — **zéro définition de ton/voix** |
| `src/server/content-gen/generators/landing-ville-templates.ts` | Doctrine commune | `DOCTRINE_INTOUCHABLE` — constante partagée 4 variants |
| `src/server/content-gen/reviewer/llm-judge.ts` | LLM-judge B.8 | Dimension `tone_axionia_alignment` (0-10) |
| `src/server/content-gen/quality/doctrine-check.ts` | Doctrine check | Anti-SIREN, naming, banned-phrases |

#### Analyse

**Aucun fichier `brand-voice.ts`, `tone-guide.ts` ou `persona.ts` dédié n'existe.**

Le fichier `src/lib/brand.ts` est un SSOT de nommage (nom canonique, tagline, slogan), pas un guide de ton éditorial. Il ne contient aucune règle sur le registre de langue, le niveau de technicité, les formules récurrentes, ou l'angle rhétorique.

La définition de ton est fragmentée dans trois artefacts distincts :

1. **`DOCTRINE_INTOUCHABLE`** (landing-ville-templates.ts ligne 53) — 7 lignes de règles de positionnement brand : "cabinet IA opérationnel", Axion-IA-centric ≥ 95 %, anti-doorway. Aucune instruction sur le registre lexical.

2. **`SYSTEM_PROMPT` dans chaque générateur** — règles éditoriales intégrées directement dans les instructions LLM. Cf. détail section 2.

3. **`JUDGE_SYSTEM_PROMPT`** (llm-judge.ts) — rubrique `tone_axionia_alignment` définie comme "ton consultatif précis sans sur-promesses. Pas de 'magique'/'révolutionnaire'. Axion-IA = cabinet opérationnel, pas usine à contenu."

**Points positifs :**
- La constante `DOCTRINE_INTOUCHABLE` garantit une base commune à tous les variants landing-ville
- Le `doctrine-check.ts` valide anti-hype (révolutionnaire, garanti, incroyable...) en post-génération
- Le LLM-judge mesure l'alignement ton à chaque article

**Déficits :**
- Pas de fiche brand voice unifiée (registre, lexique autorisé/proscrit, formules types, exemples bons/mauvais)
- Le ton "expert IA accessible PME" n'est pas spécifié avec des critères mesurables (Flesch cible, densité technique, ratio acronymes)
- La persona "Manon" est définie côté JSON-LD (plume éditoriale) mais son profil éditorial (style, voix propre, registre) n'est pas formalisé dans un fichier de référence

**Verdict : [P1] — Le ton est partiellement défini dans les system prompts mais sans guide centralisé formalisé.**

---

### 2. Cohérence ton cross-générateurs — 13/20

#### Comparaison des system prompts (200 premiers mots)

| Générateur | Persona LLM | Ton déclaré | Règles spécifiques | hasPersonManonJsonLd |
|---|---|---|---|---|
| `blog-article.ts` | "expert contenu d'Axion-IA" | SEO/AEO 2026 | Angle opérationnel, cas réels, 600 mots min, FAQ 6-8 | false |
| `blog-from-keywords.ts` | "expert contenu d'Axion-IA" | SEO/AEO 2026 | Identique blog-article, 500 mots min | false |
| `faq-standalone.ts` | "expert contenu d'Axion-IA" | AEO/SEO 2026 | "sans jargon inutile", 10-15 Q/A, dirigeants PME | false |
| `guide-pilier.ts` (outline) | "Manon, plume éditoriale d'Axion-IA" | Doctrine v2.5 | Formation BANNI, FR uniquement, Axion-IA-centric | true |
| `guide-pilier.ts` (section) | "Manon, plume éditoriale d'Axion-IA" | "ton expert-accessible" | Sans sur-promesses, 250-450 mots/section | true |
| `landing-ville.ts` | `DOCTRINE_INTOUCHABLE` + variant | Par variant | Manon, 4 variants distinctifs (default/audit/interventions/implementation) | true |
| `comparison.ts` | Délègue landing-ville | Idem landing-ville | Squelette seul | true |
| `blog-from-rss.ts` | Délègue landing-ville | Idem landing-ville | Squelette V1 | true |
| `blog-from-title.ts` | Délègue landing-ville | Idem landing-ville | Squelette V1 | true |
| `qa-derived.ts` | Délègue landing-ville | Idem landing-ville | Squelette V1 | true |

#### Problèmes de cohérence identifiés

**Fracture persona LLM :**
- `blog-article.ts` et `blog-from-keywords.ts` assignent la persona "**expert contenu d'Axion-IA**" (générique anonyme)
- `guide-pilier.ts` et `landing-ville.ts` assignent "**Manon, plume éditoriale d'Axion-IA**" (persona nommée)
- `faq-standalone.ts` utilise "**expert contenu d'Axion-IA**" sans mention de Manon
- Résultat : le lecteur lira des articles blog signés "Manon" en byline DB (loader.ts ligne 80 : `author: "Manon"`) mais le LLM qui les a générés n'a pas la persona Manon — incohérence E-E-A-T potentielle.

**4 générateurs squelettes (comparison, blog-from-rss, blog-from-title, qa-derived) délèguent intégralement au pipeline landing-ville** — ils héritent du `systemPromptOverride` variant landing, qui n'est pas adapté à leur type de contenu (un comparatif n'a pas le même ton qu'une landing ville).

**Niveau de jargon non harmonisé :**
- `faq-standalone.ts` prescrit "sans jargon inutile" mais ne définit pas la liste des termes techniques à expliquer systématiquement
- `blog-article.ts` prescrit "angle opérationnel, cas réels" sans règle sur l'expansion des acronymes
- `guide-pilier.ts` (section) prescrit "ton expert-accessible" sans seuil Flesch ou règle acronymes

**Pas de règle universelle "IA expliqué à première mention" dans les system prompts.** Le glossaire existe (glossary-extension.ts, 60 termes) mais il n'est pas injecté dans les prompts générateurs. Aucun mécanisme ne force l'expansion "LLM = Large Language Model" à première occurrence.

**Points positifs :**
- La `DOCTRINE_INTOUCHABLE` est partagée entre 4 variants landing via import direct (un seul point de vérité)
- Le `doctrine-check.ts` valide post-génération les violations de naming et banned phrases
- Le LLM-judge `toneAxioniaAlignment` capture les dérives de ton

---

### 3. AI Act compliance — Mention humaine — 14/20

#### AiContentDisclaimer — Présence et couverture

**Composant :** `src/components/marketing/AiContentDisclaimer.tsx` — server component pur, bilingue FR/EN, positionnement : fin d'article avant CtaBlock.

**Routes couvertes (avec AiContentDisclaimer)** :

| Route | Disclaimer présent | Positionnement |
|---|---|---|
| `/blog/[slug]` | Oui | Après body, avant articles connexes |
| `/guides/[slug]` | Oui | `className="mt-10"`, après body |
| `/centre-aide/[slug]` | Oui | Dans section dédiée |
| `/actualites/[slug]` | Oui | Après body |
| `/glossaire/[slug]` | Oui | En bas de page |
| `/cas-concrets/[slug]` | Oui | En bas de page |

**Routes SANS AiContentDisclaimer** :

| Route | Type de contenu | Statut |
|---|---|---|
| `/implantations/[region]/[ville]` | Landing ville IA-générée (si copie existante) | **MANQUANT** |
| `/audit/par-ville/[ville]` | Page audit par ville IA-générée | **MANQUANT** |
| `/faq` | FAQ globale | Non applicable (page statique manuelle) |
| `/presse/[slug]` | Communiqués de presse | Exclu intentionnellement (humain) |

**Lacune principale :** Les pages `/implantations/[region]/[ville]` avec `isPilot = true` (copy éditorial existant, indexées) sont générées par le pipeline `landing-ville` mais **ne montrent pas d'AiContentDisclaimer**. Avec 39 villes pilotes actives (score mémoire), ce sont ~39 pages indexées contenant du contenu IA-assisté sans disclosure visible.

#### Wording légal — Analyse

Le wording du composant est :

> "Cet article a été rédigé avec l'assistance de modèles d'IA générative (OpenAI GPT-4o, Anthropic Claude, Perplexity Sonar) puis supervisé par l'équipe Axion-IA avant publication. Conformément à l'article 50 du Règlement européen sur l'IA (AI Act 2024/1689)."

**Conformité AI Act art. 50 :** Satisfaisant.
- "rédigé avec l'assistance de modèles d'IA générative" = disclosure explicite
- "supervisé par l'équipe Axion-IA avant publication" = mention supervision humaine présente
- Référence légale explicite (art. 50, 2024/1689) = conforme

**Ce qui manque dans le wording :**
- La date de génération n'est pas affichée dans le disclaimer lui-même. Elle est disponible via `publishedAt` dans les métadonnées de la page (date visible dans les articles blog), mais le composant `AiContentDisclaimer` ne la mentionne pas.
- Le nom du modèle exact varie selon le job (OpenAI GPT-4o vs Anthropic Claude selon routing provider), mais le wording liste les 3 providers de façon statique — acceptable car c'est une liste potentielle.

#### Log de conformité

La table `generation_provenance` (provenance-logger.ts B.4) trace chaque appel LLM avec `articleId`, `provider`, `model`, `promptHash`, coût USD — hash chaîné SHA-256. Ce log existe mais **il est interne** (non exposé à l'utilisateur). La page `/transparence` explique le mécanisme mais l'accès à un log article-par-article n'est pas public.

La page `/charte-editoriale` détaille le pipeline 6 étapes et la politique IA Act en prose — complément utile mais non technique.

**Bilan compliance :** 6 types de pages ont le disclaimer, 2 types de pages IA-générées indexées en manquent (landings villes pilotes, audit par ville). Charte et page transparence existent.

---

### 4. Jargon & accessibilité — 10/15

#### Glossaire termes techniques

**Fichiers trouvés :**
- `src/content/glossary-extension.ts` — 60 termes enrichis (12 legacy + 48 nouveaux, Sprint S+4-A)
- `src/lib/knowledge/legacy-mapping-glossary-hardcode.ts` — 12 termes legacy

**Couverture des 60 termes par catégorie :**
- foundational : llm, rag, fine-tuning, tokens, context-window, prompt-engineering, inference, tokenization, temperature, top-k-top-p, streaming, system-prompt, guardrails
- agents : agent, mcp, react-pattern, tool-use, function-calling, multi-agent
- rag : vectorisation, embedding, semantic-search, chunking, re-ranking, vector-database
- models : (inférés dans les nouveaux termes)
- security : hallucination, jailbreak, prompt-injection, guardrails
- evaluation : llm-as-judge, eval-suite
- infra : latency-p95, throughput, batching

**Problème d'injection :** Le glossaire existe comme SSOT côté front-end (`/glossaire/[slug]`) mais il **n'est pas injecté dans les system prompts des générateurs**. Aucun mécanisme ne contraint le LLM à expliquer "LLM", "RAG", "NLP", "API" à première occurrence dans un article.

#### Règles explicites dans les system prompts

- `faq-standalone.ts` ligne 27 : "sans jargon inutile" — règle molle, non normée
- `guide-pilier.ts` section ligne 79 : "ton expert-accessible" — non quantifié
- `blog-article.ts` : aucune règle jargon explicite
- `blog-from-keywords.ts` : aucune règle jargon explicite

#### Ratio acronymes non expliqués — risque estimé

Sans injection du glossaire dans les prompts, un LLM peut librement écrire "utilisez RAG pour votre base de connaissances" sans définir RAG. La FAQ standalone prescrit "sans jargon inutile" mais le LLM-judge ne dispose pas d'une dimension dédiée "jargon non expliqué" dans sa rubrique 7 dimensions. La dimension `readability` demande "jargon expliqué ?" mais sans seuil quantifié.

**Signal positif :** Le LLM-judge rubrique 4 (`readability`) inclut "jargon expliqué ?" comme critère. Les articles rejetés ou améliorés sur ce critère bénéficient d'un re-prompt ciblé. Mais ce garde-fou est post-génération et qualitatif, pas préventif.

**Lecture PME non-technicienne :** La doctrine "PME/ETI françaises" est ancrée dans tous les system prompts comme audience cible. Les exemples du glossaire (`examples[]`) utilisent un registre pédagogique ("En pratique : un chatbot juridique qui cite vos contrats...") — bon signal d'accessibilité. Mais ces exemples ne sont pas injectés dans les prompts de génération.

---

### Recommandations

#### P0 — Bloquant AI Act

**P0-1 : AiContentDisclaimer manquant sur pages landing ville pilotes**
- Route : `/implantations/[region]/[ville]` avec `isPilot = true` (39 villes actives)
- Route : `/audit/par-ville/[ville]` si contenu IA-généré
- Risque : non-conformité AI Act art. 50 sur contenu public IA-assisté indexé
- Fix : ajouter `<AiContentDisclaimer locale={loc} />` après le body des pages pilotes
- Effort : 30 min

#### P1 — Qualité éditoriale

**P1-1 : Créer un fichier `brand-voice.ts` centralisé**
- Emplacement suggéré : `src/lib/brand-voice.ts` (adjacent à `brand.ts`)
- Contenu : registre (B2B expert-accessible), lexique prescrit/proscrit, formules CTA types, règle acronymes (développement à première occurrence), seuil Flesch cible (≥ 60), persona Manon en 5 lignes
- Ce fichier doit être importé par les générateurs comme constante de référence
- Effort : 2-3h

**P1-2 : Harmoniser la persona LLM dans blog-article.ts et blog-from-keywords.ts**
- Ces deux générateurs utilisent "expert contenu d'Axion-IA" au lieu de "Manon, plume éditoriale d'Axion-IA"
- Or le loader blog assigne `author: "Manon"` en DB — incohérence E-E-A-T
- Fix : aligner le `SYSTEM_PROMPT` de ces deux générateurs avec la persona Manon
- Effort : 30 min
- Note : mettre `hasPersonManonJsonLd: true` en cohérence

**P1-3 : Injecter la règle "acronyme = développement à première occurrence" dans les system prompts**
- Ajouter une ligne dans chaque `SYSTEM_PROMPT` : "Développer tout acronyme technique (LLM, RAG, API, KPI, NLP) à sa première apparition dans le texte : LLM (Large Language Model), RAG (Retrieval-Augmented Generation), etc."
- Effort : 30 min par générateur (8 générateurs actifs)

**P1-4 : Ajouter une dimension "jargon_accessibility" dans le LLM-judge**
- Rubrique actuelle : 7 dimensions, dont `readability` contient "jargon expliqué ?" mais de façon implicite
- Ajouter une 8e dimension dédiée ou enrichir la rubrique readability avec critère explicite : "≥ 1 acronyme par article développé à première occurrence"
- Effort : 1h

#### P2 — Optimisations

**P2-1 : Développer les 4 générateurs squelettes (comparison, blog-from-rss, blog-from-title, qa-derived)**
- Ces générateurs délèguent au pipeline landing-ville mais leur `contentType` est différent
- Un comparatif nécessite un system prompt dédié (table obligatoire, ton analytique, angle build-vs-buy)
- Un blog-from-rss nécessite un ton "actualité" distinct du ton landing ville
- Effort : 3-4h par générateur (P2 car V2 planifié)

**P2-2 : Exposer la date de génération dans le wording AiContentDisclaimer**
- Ajouter optionnellement `generatedAt?: string` au composant et l'afficher sous forme "Généré le {date}, supervisé avant publication"
- Renforce la traçabilité article-par-article pour l'utilisateur
- Effort : 2h (composant + wire côté pages)

**P2-3 : Injecter des extraits du glossaire (5-8 termes pertinents) dans les prompts génération**
- Pour chaque `contentType`, injecter les définitions des termes du glossaire les plus susceptibles d'apparaître
- Cela forcerait le LLM à calquer ses définitions sur le SSOT glossaire (cohérence cross-articles)
- Effort : 4-6h (sélection termes par type + injection + tests)

---

### Synthèse des scores par sous-critère

| Critère | Score | Max | Commentaire |
|---|---|---|---|
| Fichier brand voice dédié | 0 | 5 | Absent — `brand.ts` = nommage seulement |
| Ton défini dans les prompts | 6 | 5 | Présent mais fragmenté (bonus pour DOCTRINE_INTOUCHABLE + LLM-judge) |
| Persona auteur cohérente | 3 | 5 | Fracture "expert contenu" vs "Manon" selon type |
| **Sous-total Définition brand voice** | **9** | **15** | |
| Persona Manon définie et utilisée | 6 | 8 | JSON-LD complet, DB AuthorProfile, mais incohérence blog vs guide |
| Niveau jargon cohérent cross-types | 4 | 7 | "Sans jargon inutile" dans FAQ seulement, pas de règle universelle |
| Formules CTA présentes | 3 | 5 | CTAs SSOT dans variants landing, absents des blogs/guides |
| **Sous-total Cohérence ton** | **13** | **20** | |
| Disclaimer présent routes éditoriales | 11 | 12 | 6/8 routes couvertes — manque landings villes pilotes |
| Wording légal AI Act art. 50 | 7 | 8 | Conforme sauf date de génération absente |
| Log provenance et supervision | 4 | 6 | Interne (fire-and-forget), non exposé utilisateur |
| Lien /transparence fonctionnel | 2 | 4 | Page existe mais disclaimer manque sur 2 types de routes indexées |
| **Sous-total AI Act compliance** | **14** | **20** | |
| Glossaire termes IA existant | 5 | 5 | 60 termes, catégorisés, exemples — excellent |
| Règle acronymes dans prompts | 0 | 5 | Absente dans tous les générateurs |
| Glossaire injecté dans génération | 0 | 3 | Zéro injection des définitions dans les prompts |
| LLM-judge couvre jargon | 5 | 7 | Dimension readability partielle — pas de critère dédié acronymes |
| **Sous-total Jargon & accessibilité** | **10** | **15** | |
| **TOTAL** | **46** | **70** | |

---

*Audit réalisé en mode AUDIT-ONLY STRICT — aucun fichier source modifié.*
*Fichiers lus : 16 fichiers source (générateurs, composants, lib, app routes).*
*Date d'audit : 2026-05-21*

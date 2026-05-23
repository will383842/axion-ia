# PROMPT P4 — AUDIT QUALITÉ ÉDITORIALE & TEMPLATES CONTENT-GEN AXION-IA
## Version 1.0 — 2026-05-21 — AUDIT-ONLY — Score /1000

---

## 0. CONTEXTE PROJET (self-contained — aucun contexte préalable requis)

### Projet
**Axion-IA** — Cabinet conseil IA B2B, site bilingue FR canonique / EN miroir.
- URL production : https://axion-ia.com
- Stack : Next.js 16 App Router + Prisma 5.22 + BullMQ + PostgreSQL + Coolify (Hetzner CPX42)
- Repo GitHub : `will383842/axion-ia` branche `main`
- Répertoire local Windows : `C:\Users\willi\Documents\Projets\Axion-IA`
- HEAD de référence pour cet audit : `37ca0147` (score P1.5 ~770-820/1000)

### Brand & Design System
- Couleur principale : terracotta `#c24a1b`
- Couleur pointe : bleu `#1a4dd9` (usage limité)
- Fond : ivoire `#faf8f3`
- Ton : "expert IA accessible PME" — jamais de jargon sans explication immédiate
- RÈGLE ABSOLUE : 0 image générée par IA (DALL-E, Midjourney, Stable Diffusion, etc.) — toutes les images sont importées manuellement par Will

### 5 Verticales métier
| Slug interne | Label affiché |
|---|---|
| `interventions_formations` | Interventions & Formations |
| `un_a_un` | 1-to-1 coaching IA |
| `audits` | Audits IA |
| `implementations` | Implémentations IA |
| `sites_web_augmentes` | Sites Web Augmentés |

### 3 Cibles clients
- `tpe` : TPE (< 10 salariés)
- `pme` : PME (10-250 salariés)
- `eti` : ETI (250-5 000 salariés)

### 7 Types de contenus générés
1. **blog** — article longue traîne SEO (1 200-2 500 mots)
2. **cas-concret** — étude de cas comparatif + témoignage (1 500-3 000 mots)
3. **landing** — page pilier verticale × ville (2 000-4 000 mots)
4. **faq** — questions/réponses automatisées (500-1 500 mots, schema FAQPage)
5. **comparatif** — tableau comparatif outils/offres (1 000-2 000 mots)
6. **pilier** — hub & spoke thématique (3 000-5 000 mots)
7. **rss-based** — article basé sur flux RSS source tierce (800-1 500 mots)

### Ce qui est déjà livré (P1.5)
- LLM-as-judge Claude Sonnet 4.6 : reviewer 7 dimensions (originalité, pertinence keyword, lisibilité, densité liens, brand voice, AI Act disclaimer, longueur)
- Boucle improve max 2 itérations avant rejet
- KB (Knowledge Base) zéro invention enforced — tout contenu ancré dans sources réelles ou KB
- 747 keyword seeds connectés via `selectKeyword` + `validateKeywordInTitle`
- `AiContentDisclaimer` obligatoire sur tout contenu généré (AI Act art. 50)
- Agents P1.5 Phase A : QW-1/2/6/7 livrés (commit `ffdb49a6`)
- Score D-État actuel : ~770-820/1000

### Gaps identifiés avant cet audit P4
- **A03 Quality** (65 pts) : templates "corrects mais pas au niveau best practices mai 2026"
- **A05 Templates** (45 pts) : structure H1/H2/H3 non systématique, longueurs non contrôlées par type
- LLM-as-judge calibration non vérifiée sur corpus réel
- Liens internes effectivement injectés ? (incertain)
- Bilingue EN : copie FR ou traduction réelle ? (incertain)

### Priorités Will
1. QUALITÉ des contenus (#1 absolu)
2. SUIVI pointu avec reporting hebdomadaire (#2)
3. Légalité / conformité AI Act (#3)

---

## 1. MODE OPÉRATOIRE

### AUDIT-ONLY STRICT
- **0 commit**, **0 modification** de fichier source, **0 écriture** en dehors du dossier `_AUDIT/`
- Lecture seule du codebase via outils Read, Grep, Glob
- Les livrables sont créés uniquement dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-4/`
- Si un fichier source est ambigu, documenter l'ambiguïté — ne pas supposer
- Toute recommandation est étiquetée [P0], [P1] ou [P2] selon criticité

### 10 AGENTS PARALLÈLES
Lancer exactement 10 sous-agents simultanément, chacun avec un scope délimité ci-dessous.
Chaque agent produit **un fichier Markdown autonome** dans le dossier de livraison.
L'orchestrateur attend la fin des 10 agents, puis produit `PHASE-4-VERDICT.md` et `CROSS-CUTTING.md`.

### Dossier de livraison
```
C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\CONTENT-GEN-PERFECTION-2026\phase-4\
├── A4-01-TEMPLATES.md
├── A4-02-QUALITE-TEXTUELLE.md
├── A4-03-KEYWORD-TITRE.md
├── A4-04-KB-FACTCHECKING.md
├── A4-05-LIENS.md
├── A4-06-BRAND-VOICE.md
├── A4-07-LLM-JUDGE-CALIBRATION.md
├── A4-08-IMAGE-HERO.md
├── A4-09-BILINGUE.md
├── A4-10-FEEDBACK-LOOP.md
├── CROSS-CUTTING.md
└── PHASE-4-VERDICT.md
```

---

## 2. CHEMINS CLÉS DU CODEBASE

Avant de lancer les agents, l'orchestrateur doit confirmer l'existence de ces chemins :

```
src/server/content-gen/
src/server/content-gen/generators/
src/server/content-gen/generators/blog-generator.ts
src/server/content-gen/generators/cas-concret-generator.ts
src/server/content-gen/generators/landing-generator.ts
src/server/content-gen/generators/faq-generator.ts
src/server/content-gen/generators/comparatif-generator.ts
src/server/content-gen/generators/pilier-generator.ts
src/server/content-gen/generators/rss-generator.ts
src/server/content-gen/quality/
src/server/content-gen/quality/llm-reviewer.ts
src/server/content-gen/kb/
src/server/content-gen/keywords/
src/server/content-gen/keywords/select-keyword.ts
src/server/content-gen/keywords/validate-keyword-in-title.ts
src/server/content-gen/images/
src/server/content-gen/images/assign-hero-image.ts
src/server/content-gen/i18n/
src/server/content-gen/links/
src/components/content/AiContentDisclaimer.tsx
prisma/schema.prisma
```

Si un chemin n'existe pas, l'agent doit chercher l'équivalent via Glob et documenter la localisation réelle.

---

## 3. AGENTS — DÉFINITIONS COMPLÈTES

---

### A4-01 : Templates 7 types — Best Practices Mai 2026
**Fichier de sortie :** `A4-01-TEMPLATES.md`
**Score maximal :** /120

#### Mission
Auditer la structure de chacun des 7 générateurs de contenu contre les best practices éditorielles et SEO de mai 2026. Comparer la structure générée contre les référentiels Google SGE/AIO, HubSpot Content Model 2026, et les standards AEO (Answer Engine Optimization).

#### Grille d'évaluation par générateur

**Blog** (H-max: 18 pts)
- H1 unique, keyword exact ou proche en position 1-7 mots — 3 pts
- H2 tous les 300-400 mots maximum — 2 pts
- H3 utilisés pour sous-points (pas de H4+ sauf pilier) — 2 pts
- Intro : accroche < 60 mots + problème identifié + promesse — 3 pts
- Corps : au moins 3 sections H2 avec exemples concrets — 3 pts
- Conclusion : synthèse + CTA unique + lien interne — 3 pts
- CTA placement : fin d'intro ET fin d'article — 2 pts

**Cas-concret** (H-max: 18 pts)
- Structure narrative : Contexte → Problème → Solution → Résultat — 4 pts
- Tableau comparatif Avant/Après présent — 3 pts
- Citation témoignage formatée (schema `Review` ou `Testimonial`) — 3 pts
- Métriques chiffrées (% gain, délai, ROI) — 4 pts
- H1 contient le nom du cas + secteur — 2 pts
- Disclosure "résultats individuels" présente — 2 pts

**Landing** (H-max: 20 pts)
- H1 : verticale + ville + cible explicites — 4 pts
- Section hero : valeur proposition < 150 mots — 3 pts
- Section preuves sociales (témoignages ou chiffres clés) — 3 pts
- Section FAQ locale (≥ 5 Q/R) — 3 pts
- CTA principal au-dessus de la ligne de flottaison — 3 pts
- Footer links : pilier parent + villes voisines + verticale hub — 2 pts
- Schema `LocalBusiness` ou `Service` + `areaServed` — 2 pts

**FAQ** (H-max: 15 pts)
- Schema `FAQPage` avec `Question` + `Answer` complets — 4 pts
- Format accordion implémenté côté rendu — 3 pts
- Questions en langage naturel (pas de jargon) — 3 pts
- Réponses entre 40-160 mots (ni trop courtes ni trop longues) — 3 pts
- Lien vers ressource approfondie sur chaque Q — 2 pts

**Comparatif** (H-max: 15 pts)
- Tableau HTML/MDX avec en-têtes clairs + légende — 4 pts
- Critères de comparaison explicites en introduction — 3 pts
- Verdict synthétique pour chaque profil cible — 3 pts
- Date de mise à jour visible (contenu périssable) — 3 pts
- Sources des données de comparaison citées — 2 pts

**Pilier** (H-max: 22 pts)
- Hub & spoke : liens vers ≥ 5 articles enfants — 5 pts
- Table des matières (TOC) générée automatiquement — 4 pts
- Intro longue (> 200 mots) positionnant l'autorité — 3 pts
- Sections distinctes par sous-thème (H2 × ≥ 6) — 4 pts
- CTA intermédiaires (un par grande section) — 3 pts
- Image hero obligatoire + ≥ 2 images secondaires — 3 pts

**RSS-based** (H-max: 12 pts)
- Attribution source originale en début d'article — 3 pts
- Valeur ajoutée explicite vs source (analyse, contexte local FR) — 4 pts
- Longueur ≥ 800 mots (pas de simple résumé) — 3 pts
- Lien `rel="canonical"` vers source si syndication — 2 pts

#### Instructions pour A4-01
1. Lire chacun des 7 fichiers générateurs (`src/server/content-gen/generators/`)
2. Extraire le prompt système et/ou les templates Handlebars/markdown utilisés
3. Vérifier point par point contre la grille ci-dessus
4. Pour chaque critère manquant : écrire la correction recommandée (extrait de code ou formulation prompt)
5. Chercher via Grep si un fichier `templates/` ou `prompts/` centralisé existe
6. Vérifier si les longueurs cibles sont hardcodées ou dynamiques
7. Identifier les templates identiques entre types (factorisation manquante)

#### Format de sortie A4-01
```markdown
# A4-01 : Templates 7 types — Best Practices Mai 2026
## Score : XX/120

### Blog — XX/18
[Tableau: critère | statut ✅/⚠️/❌ | pts obtenus | commentaire]
...

### Recommandations P0 (bloquant qualité)
...

### Recommandations P1 (amélioration significative)
...

### Recommandations P2 (polish)
...
```

---

### A4-02 : Qualité Textuelle Mesurable
**Fichier de sortie :** `A4-02-QUALITE-TEXTUELLE.md`
**Score maximal :** /100

#### Mission
Mesurer la qualité textuelle objective des contenus générés via métriques computables. Identifier si le pipeline produit des textes à haute valeur ou du contenu générique.

#### Métriques à auditer

**Originalité — 25 pts**
- Le pipeline calcule-t-il un score cosine similarity vs corpus existant ? — 10 pts
  - Si oui : seuil de rejet documenté ? valeur cible (<0.85) ?
  - Si non : [P0] — risque duplicate content Google Panda
- Présence d'un module `originality-check.ts` ou équivalent — 5 pts
- Mécanisme de déduplication avant publication — 5 pts
- Log des rejets pour originalité faible (traçabilité) — 5 pts

**Lexical Diversity — 20 pts**
- TTR (Type-Token Ratio) calculé sur le contenu généré ? — 8 pts
  - Seuil cible TTR > 0.70 (en dessous = texte répétitif)
- Fréquence des mots "IA" / "intelligence artificielle" / "solution" (sur-utilisation détectée ?) — 6 pts
- Variation longueur des phrases (15-35 mots cible, écart-type > 5) — 6 pts

**Lisibilité — 20 pts**
- Score Flesch-Kincaid ou équivalent FR (Senter score ?) calculé — 8 pts
  - Cible : niveau lycée/B2 (score Flesch 40-60 FR ou équivalent)
- Voix passive < 20% des phrases — 6 pts
- Phrases > 40 mots signalées ou rejetées — 6 pts

**Cohérence inter-sections — 20 pts**
- Transitions entre H2 sections vérifiées (pas de rupture thématique) — 8 pts
- Rappel du keyword principal dans les 100 derniers mots (conclusion) — 6 pts
- Absence de contradictions internes (claim A puis claim ¬A) — 6 pts

**Ratio counterfactual — 15 pts**
- Le contenu inclut-il des nuances / contre-exemples / limites ? — 8 pts
  - Un contenu 100% positif sur l'IA est suspect (biais promotionnel)
  - Cible : ≥ 1 nuance ou limite par 500 mots
- Wording conditionnel détecté ("dans la plupart des cas", "selon le contexte") — 7 pts

#### Instructions pour A4-02
1. Chercher dans `src/server/content-gen/quality/` tous les fichiers de mesure textuelle
2. Chercher via Grep : `TTR`, `cosine`, `flesch`, `readability`, `similarity`, `counterfactual`
3. Si aucun module trouvé, évaluer le prompt du reviewer LLM sur ces dimensions
4. Chercher des logs d'articles générés dans `_AUDIT/` ou dossiers de samples pour analyse manuelle
5. Vérifier si `llm-reviewer.ts` couvre ces métriques ou si elles sont absentes
6. Pour chaque métrique absente : proposer une implémentation concrète (librairie, algorithme, code snippet)

#### Librairies recommandées à suggérer si absent
- `natural` (npm) : TTR, tokenization
- `compromise` (npm) : POS tagging, voix passive
- `readability-scores` (npm) : Flesch FR
- API Claude lui-même pour cohérence sémantique (prompt audit interne)

#### Format de sortie A4-02
```markdown
# A4-02 : Qualité Textuelle Mesurable
## Score : XX/100

### Métriques présentes dans le pipeline
[Liste avec localisation fichier + ligne]

### Métriques absentes — recommandations
[P0/P1/P2 + implémentation suggérée]

### Sample analysis (si articles disponibles)
[Analyse manuelle sur 3-5 articles échantillon trouvés dans le repo]
```

---

### A4-03 : Keyword dans le Titre — Test Réel
**Fichier de sortie :** `A4-03-KEYWORD-TITRE.md`
**Score maximal :** /80

#### Mission
Vérifier que `validateKeywordInTitle` fonctionne réellement et que le keyword ciblé (exact ou variation sémantique proche) apparaît dans le H1 ET dans le meta title — pas seulement quelque part dans le corps de l'article.

#### Périmètre d'audit

**Audit du code** — 30 pts
- Lire `src/server/content-gen/keywords/validate-keyword-in-title.ts` entièrement — 10 pts
  - La fonction vérifie-t-elle H1 OU meta title OU les deux ?
  - Détecte-t-elle les variations morphologiques (pluriel, conjugué) ?
  - Détecte-t-elle les synonymes sémantiques proches ?
  - Que se passe-t-il si la validation échoue ? (retry ? override ? log seulement ?)
- Lire `src/server/content-gen/keywords/select-keyword.ts` — 10 pts
  - Comment le keyword est-il sélectionné parmi les 747 seeds ?
  - Score de difficulté pris en compte ?
  - Évitement des doublons (keyword déjà utilisé récemment) ?
- Vérifier le passage du keyword au générateur (injection dans le prompt) — 10 pts
  - Le keyword est-il dans le system prompt ? user prompt ? les deux ?
  - Instructions explicites "le keyword DOIT apparaître dans le H1" ?

**Test sur sample d'articles** — 30 pts
- Chercher des articles générés dans le repo (dossier `content/`, `public/`, DB seeds, fixtures, `_AUDIT/`) — 10 pts
- Pour chaque article trouvé (cible : 20 articles minimum) :
  - Extraire le H1
  - Extraire le keyword ciblé (metadata ou filename)
  - Calculer : keyword exact dans H1 ? variation ? absent ? — 10 pts
- Calculer le taux de succès : X/20 articles avec keyword dans H1 — 10 pts
  - ≥ 19/20 (≥ 95%) = 10 pts
  - 16-18/20 (80-94%) = 7 pts
  - 12-15/20 (60-79%) = 4 pts
  - < 12/20 (< 60%) = 0 pt [P0 critique]

**Meta title audit** — 20 pts
- La génération du meta title inclut-elle systématiquement le keyword ? — 10 pts
  - Chercher : `meta title`, `pageTitle`, `seoTitle`, `<title>` dans les générateurs
  - Le keyword est-il en position 1-3 du meta title (avant le pipe) ?
- Longueur meta title contrôlée (50-60 caractères) ? — 5 pts
- Meta description générée séparément du contenu (pas tronquée) ? — 5 pts

#### Instructions pour A4-03
1. Lire les fichiers keyword en entier (ils sont probablement courts)
2. Tracer le flux : `selectKeyword` → injection prompt → `validateKeywordInTitle` → résultat
3. Chercher des fixtures ou seeds d'articles dans tout le repo via Glob `**/*.{json,ts,md}` avec pattern `keyword` ou `targetKeyword`
4. Si aucun article sample trouvé : documenter l'impossibilité et proposer un plan de test
5. Chercher si le reviewer LLM valide aussi le keyword dans le titre (dimension "pertinence keyword")

#### Format de sortie A4-03
```markdown
# A4-03 : Keyword dans le Titre
## Score : XX/80

### Audit code validateKeywordInTitle
[Analyse ligne par ligne de la fonction]

### Flux keyword : sélection → injection → validation
[Schéma textuel du flux complet]

### Sample test : XX articles analysés
| Article | Keyword cible | H1 | Match | Type match |
|---|---|---|---|---|
...
Taux de succès : X/XX (XX%)

### Meta title audit
...

### Recommandations
[P0/P1/P2]
```

---

### A4-04 : KB & Fact-Checking — Zéro Invention
**Fichier de sortie :** `A4-04-KB-FACTCHECKING.md`
**Score maximal :** /100

#### Mission
Vérifier que la doctrine "zéro invention" est effectivement appliquée — que chaque claim factuel dans un article généré est ancré dans la KB ou dans une source externe vérifiable, et qu'aucune hallucination n'est publiée.

#### Périmètre

**Architecture KB** — 25 pts
- Lire entièrement `src/server/content-gen/kb/` (tous les fichiers) — 10 pts
  - Quelles sources constituent la KB ? (fichiers .ts, DB Prisma, API ?)
  - Volume estimé de la KB (nombre d'entrées, sujets couverts)
  - KB versionnée ? mise à jour automatique ou manuelle ?
- Comment la KB est-elle injectée dans les prompts de génération ? — 10 pts
  - RAG (Retrieval Augmented Generation) ? Embedding search ? Injection directe ?
  - Le contexte KB dépasse-t-il la fenêtre de contexte du modèle ?
- Mécanisme d'alerte si KB vide ou insuffisante pour un sujet — 5 pts

**Hallucination detection** — 35 pts
- Existe-t-il un module de vérification post-génération des claims ? — 15 pts
  - Si oui : localiser le fichier, décrire le mécanisme
  - Si non : [P0] risque critique — proposer une implémentation
- Le reviewer LLM vérifie-t-il les claims contre la KB ? — 10 pts
  - Ou vérifie-t-il seulement le style/forme ?
  - Peut-il détecter une statistique inventée ?
- Log des claims rejetés pour hallucination — 5 pts
- Quarantaine des articles suspects avant publication — 5 pts

**Sources externes citées** — 25 pts
- Les générateurs incluent-ils des liens vers sources primaires ? — 10 pts
  - INSEE, INAO, rapports officiels, études sectorielles
  - Domaines d'autorité (DA > 40 recommandé)
- Format de citation standardisé (inline, footnote, section sources) — 8 pts
- Vérification de la disponibilité des URLs citées (404 check) — 7 pts

**Sample fact-check** — 15 pts
- Extraire 50 claims factuels depuis articles samples disponibles — 8 pts
  - Exemple de claims : statistiques (X% des PME...), dates, noms propres, citations
  - Classer : vérifiable KB / vérifiable source externe / invérifiable
- Taux de claims vérifiables : — 7 pts
  - ≥ 90% vérifiables = 7 pts
  - 75-89% = 5 pts
  - 50-74% = 3 pts
  - < 50% = 0 pt [P0]

#### Instructions pour A4-04
1. Lire tous les fichiers dans `src/server/content-gen/kb/`
2. Chercher via Grep : `hallucination`, `fact-check`, `claim`, `source`, `verify`, `invention`
3. Chercher dans les prompts des générateurs les instructions relatives à l'ancrage factuel
4. Chercher des articles avec citations dans le repo
5. Si articles disponibles : extraire 50 claims et les classer manuellement
6. Évaluer si la KB actuelle est suffisante pour les 5 verticales × 3 cibles × 7 types

#### Format de sortie A4-04
```markdown
# A4-04 : KB & Fact-Checking
## Score : XX/100

### Architecture KB
[Description complète : sources, volume, mécanisme d'injection]

### Hallucination detection
[Analyse du mécanisme existant ou absence documentée]

### Sample : XX claims analysés
| Claim | Type | Vérifiable | Source | Verdict |
|---|---|---|---|---|
...
Taux vérifiable : XX%

### Recommandations critiques
[P0 : mécanisme manquant / P1 : amélioration / P2 : polish]
```

---

### A4-05 : Liens Internes / Externes / Suggested Content
**Fichier de sortie :** `A4-05-LIENS.md`
**Score maximal :** /80

#### Mission
Vérifier que les liens internes, externes et le "suggested content" de bas de page sont effectivement générés ET injectés dans le contenu HTML final — pas seulement mentionnés dans les métadonnées.

#### Périmètre

**Liens internes** — 30 pts
- Localiser le module qui gère `internalLinkCount` dans les générateurs — 8 pts
  - Chercher : `internalLinks`, `internalLinkCount`, `addInternalLinks`, `linkInsertion`
- L'injection se fait-elle dans le HTML/Markdown final ou seulement dans les métadonnées ? — 10 pts
  - Inspecter le contenu généré : les `<a href="/fr/...">` sont-ils présents ?
  - Les liens pointent-ils vers des pages réellement existantes ?
- Stratégie de sélection des liens internes — 7 pts
  - Basée sur la similarité sémantique ? Clustering vertical ? Aléatoire ?
  - Nombre minimum de liens internes par type de contenu respecté ?
    - Blog : ≥ 3 liens internes
    - Landing : ≥ 5 liens internes
    - Pilier : ≥ 8 liens internes (hub & spoke)
- Liens internes en contexte (texte d'ancre pertinent) vs liens orphelins — 5 pts

**Liens externes** — 25 pts
- Génération de liens externes vers sources d'autorité — 10 pts
  - DA > 40 ciblé ? (Moz, Ahrefs, ou équivalent utilisé ?)
  - Sources typiques : INSEE, Bpifrance, ADEME, rapports officiels, publications sectorielles
- `rel="nofollow"` ou `rel="noopener noreferrer"` appliqué correctement — 5 pts
- Vérification que les URLs externes ne sont pas expirées (404 check) — 5 pts
- Nombre minimum par type (blog : ≥ 2, pilier : ≥ 5) — 5 pts

**Suggested Content (bas de page)** — 25 pts
- Module de recommandation "Articles suggérés" présent — 8 pts
  - Chercher : `suggested`, `recommendations`, `related`, `readNext`
- Logique de suggestion — 10 pts
  - Même verticale prioritaire ?
  - Même cible client (TPE/PME/ETI) ?
  - Évitement de l'article courant ?
  - Limitation à 3-4 suggestions maximum ?
- Rendu frontend du bloc suggestions — 7 pts
  - Composant React présent dans `src/components/content/` ?
  - Image miniature + titre + CTA "Lire la suite" ?
  - Schema `ItemList` ou `Article` isPartOf ?

#### Instructions pour A4-05
1. Grep sur `internalLink`, `externalLink`, `suggested`, `related`, `readNext` dans `src/server/content-gen/`
2. Lire les fichiers générateurs pour comprendre comment les liens sont construits
3. Chercher un article sample pour inspecter le HTML généré (liens réels présents ?)
4. Vérifier dans Prisma schema si une table `ContentLink` ou `ContentRelation` existe
5. Chercher le composant frontend qui affiche les suggestions

#### Format de sortie A4-05
```markdown
# A4-05 : Liens Internes / Externes / Suggested Content
## Score : XX/80

### Liens internes — XX/30
[Analyse avec localisation code]

### Liens externes — XX/25
[Analyse avec localisation code]

### Suggested content — XX/25
[Analyse avec localisation code + composant frontend]

### Flux complet liens : génération → injection → rendu
[Schéma textuel]

### Recommandations
[P0/P1/P2 avec extraits de code si pertinent]
```

---

### A4-06 : Brand Voice & Persona — Cohérence Cross-Articles
**Fichier de sortie :** `A4-06-BRAND-VOICE.md`
**Score maximal :** /70

#### Mission
Vérifier que tous les articles générés par les 7 générateurs utilisent la même voix éditoriale "expert IA accessible PME" — sans jargon inexpliqué, avec une posture d'autorité bienveillante, et une mention humaine conforme AI Act.

#### Périmètre

**Définition brand voice** — 15 pts
- Existe-t-il un fichier `brand-voice.ts`, `tone-guide.ts`, ou `persona.ts` ? — 8 pts
  - Si oui : contenu, niveau de détail, respect par les générateurs
  - Si non : [P1] — le ton est-il défini dans le system prompt de chaque générateur ?
- Les 7 générateurs ont-ils le même system prompt de ton, ou chacun a le sien ? — 7 pts
  - Si différents : risque de dérive inter-types

**Cohérence ton** — 20 pts
- Persona auteur : nom, titre, crédibilité E-E-A-T définis ? — 8 pts
  - Chercher : `author`, `byline`, `authorName`, `expertBio`
  - Un expert fictif cohérent (Axion-IA) vs inventé par le modèle à chaque fois ?
- Niveau de langage cohérent cross-types — 7 pts
  - Blog ≠ Landing ≠ FAQ en ton mais pas en niveau de jargon
  - "IA" toujours expliqué à première mention dans chaque article ?
- Formules signature Axion-IA présentes — 5 pts
  - CTA récurrents ("Découvrez comment", "Demandez votre audit", etc.)
  - Pas de formulations génériques ("Contactez-nous dès aujourd'hui")

**AI Act compliance — Mention humaine** — 20 pts
- `AiContentDisclaimer` présent sur tous les articles — 8 pts
  - Chercher le composant `src/components/content/AiContentDisclaimer.tsx`
  - Rendu conditionnel ou systématique ?
  - Position dans la page (header, footer, inline) ?
- Wording légal de la mention — 7 pts
  - Conforme AI Act art. 50 : "cet article a été généré avec l'aide de l'IA"
  - Mention de supervision humaine présente ?
  - Date de génération visible ?
- Log de conformité : preuve que 100% des articles ont le disclaimer — 5 pts

**Jargon & accessibilité** — 15 pts
- Liste de termes techniques dont l'explication est obligatoire — 5 pts
  - Chercher : `glossary`, `termDefinition`, `acronymExpansion`
- Ratio acronymes non expliqués détecté ? — 5 pts
  - LLM / RAG / NLP / API / KPI mentionnés sans définition = signal négatif
- Lecture par une PME non-technicienne : compréhensible ? — 5 pts
  - Évaluer sur 2-3 articles samples

#### Instructions pour A4-06
1. Chercher via Grep : `brand`, `voice`, `tone`, `persona`, `author`, `disclaimer`, `AI Act`
2. Comparer les system prompts des 7 générateurs (extraire les 200 premiers mots de chaque)
3. Lire `AiContentDisclaimer.tsx` entièrement
4. Chercher si un fichier de glossaire termes IA existe dans la KB
5. Si articles samples disponibles : évaluer le ton sur 3 articles de types différents

#### Format de sortie A4-06
```markdown
# A4-06 : Brand Voice & Persona
## Score : XX/70

### Définition brand voice — XX/15
[Fichiers trouvés + analyse]

### Cohérence ton cross-générateurs — XX/20
[Comparaison system prompts]

### AI Act compliance — XX/20
[AiContentDisclaimer analyse + wording]

### Jargon & accessibilité — XX/15
[Analyse + samples]

### Recommandations
[P0/P1/P2]
```

---

### A4-07 : LLM-as-Judge — Calibration des 7 Dimensions
**Fichier de sortie :** `A4-07-LLM-JUDGE-CALIBRATION.md`
**Score maximal :** /80

#### Mission
Vérifier que le reviewer LLM (Claude Sonnet 4.6) est correctement calibré sur ses 7 dimensions d'évaluation — que les seuils GO/IMPROVE/REJECT sont pertinents, que la boucle 2 itérations est suffisante, et qu'il n'y a pas de "complaisance" du modèle (toujours GO).

#### Périmètre

**Lecture du reviewer** — 25 pts
- Lire entièrement `src/server/content-gen/quality/llm-reviewer.ts` — 15 pts
  - Les 7 dimensions sont-elles : originalité, pertinence keyword, lisibilité, densité liens, brand voice, AI Act disclaimer, longueur ?
  - Chaque dimension a-t-elle un poids relatif explicite ?
  - Score global = somme pondérée ou vote majoritaire ?
  - Seuils : GO (≥ ?), IMPROVE (≥ ?), REJECT (< ?)
  - Prompt du reviewer : instructions précises ou génériques ?
- Format de sortie du reviewer (JSON structuré ?) — 5 pts
  - `{ dimension: score, verdict: "GO"|"IMPROVE"|"REJECT", reason: string }`
- Température du modèle reviewer (0 recommandé pour cohérence) — 5 pts

**Calibration des seuils** — 25 pts
- Seuil GO actuel : quel score global ? — 8 pts
  - Recommandé : ≥ 7.5/10 pour publication directe
  - Trop permissif (≥ 6) = risque qualité
  - Trop strict (≥ 9) = taux de rejet élevé, coût ×3
- Seuil IMPROVE : déclencheur boucle 2e itération — 8 pts
  - Entre 5 et 7.5 = IMPROVE recommandé
  - Instructions spécifiques à l'improve prompt ?
- Seuil REJECT : < 5 recommandé — 5 pts
  - Que se passe-t-il sur REJECT ? (log, quarantaine, alerte Will ?)
- Boucle improve 2 itérations : est-ce suffisant ? — 4 pts
  - Analyser si une 3e itération améliorerait ou non
  - Coût d'une itération supplémentaire (tokens)

**Détection complaisance** — 20 pts
- Log des verdicts historiques disponible ? — 8 pts
  - Taux de GO / IMPROVE / REJECT sur les derniers N articles
  - Si 100% GO : reviewer trop permissif [P0]
  - Taux REJECT sain : 10-20%
- Test de robustesse — 8 pts
  - Soumettre mentalement un contenu clairement mauvais au reviewer
  - Les instructions permettent-elles de le rejeter ?
- Biais de confirmation du modèle sur son propre output — 4 pts
  - Un modèle évalue-t-il objectivement un texte qu'il pourrait avoir écrit ?
  - Solution : reviewer séparé avec contexte minimal

**Dimension-level analysis** — 10 pts
- Originalité : comment mesurée par le LLM ? (comparaison corpus ?) — 2 pts
- Pertinence keyword : vérifie H1 ou seulement corps ? — 2 pts
- Lisibilité : score numérique ou appréciation subjective ? — 2 pts
- Densité liens : compte réel ou estimation ? — 2 pts
- AI Act disclaimer : vérification de présence ou de conformité wording ? — 2 pts

#### Instructions pour A4-07
1. Lire `llm-reviewer.ts` entièrement (fichier probablement 100-300 lignes)
2. Extraire le prompt exact soumis au modèle reviewer
3. Chercher les logs de verdicts (DB Prisma ? fichiers de log ? `_AUDIT/` ?)
4. Identifier la boucle improve : chercher `retry`, `improve`, `iteration`, `maxIterations`
5. Si logs disponibles : calculer le taux GO/IMPROVE/REJECT
6. Proposer un jeu de tests de calibration (3 articles fictifs : bon / moyen / mauvais)

#### Format de sortie A4-07
```markdown
# A4-07 : LLM-as-Judge Calibration
## Score : XX/80

### Architecture du reviewer
[Code analysis + prompt extrait]

### Seuils GO/IMPROVE/REJECT
| Dimension | Seuil actuel | Seuil recommandé | Verdict |
...

### Logs historiques
[Taux GO/IMPROVE/REJECT si disponible]

### Détection complaisance
[Analyse + risques]

### Recommandations calibration
[P0/P1/P2 avec seuils recommandés]
```

---

### A4-08 : Image Hero — Pertinence & Conformité
**Fichier de sortie :** `A4-08-IMAGE-HERO.md`
**Score maximal :** /70

#### Mission
Vérifier que le système `assignHeroImage` sélectionne des images cohérentes avec le sujet, que le scoring par verticale fonctionne, qu'aucune image générée par IA n'est utilisée, et que les alt text sont optimisés pour le SEO.

#### RÈGLE ABSOLUE (rappel)
**0 image générée par IA (DALL-E, Midjourney, Stable Diffusion, Flux, Leonardo, etc.)**
Toutes les images proviennent de la banque d'images importée manuellement par Will.
Toute trace de génération IA d'images dans le code = [P0] bloquant absolu.

#### Périmètre

**Module assignHeroImage** — 25 pts
- Lire entièrement `src/server/content-gen/images/assign-hero-image.ts` (ou équivalent) — 10 pts
  - Logique de sélection : par verticale ? par sujet ? par cible ?
  - Source des images : table Prisma `Image` ? dossier statique ? API externe ?
  - Fallback si aucune image pertinente trouvée ?
- Scoring par verticale — 8 pts
  - Chaque image a-t-elle des tags de verticale (`interventions`, `audits`, etc.) ?
  - Le score de pertinence image × article est-il calculé ?
  - Seuil minimum de pertinence avant fallback ?
- Conformité règle 0 IA générée — 7 pts
  - Chercher via Grep : `dall-e`, `dalle`, `openai.images`, `midjourney`, `generateImage`, `imageGeneration`
  - Si trouvé : [P0] critique à documenter
  - Vérifier que la source est uniquement la banque d'images importée

**Nombre d'images par type** — 20 pts
- Blog : ≥ 1 image hero — 3 pts
- Cas-concret : ≥ 1 image hero + images illustratives — 3 pts
- Landing : ≥ 1 image hero + ≥ 1 image section — 3 pts
- FAQ : image hero facultative mais encouragée — 2 pts
- Comparatif : image hero + tableaux (pas d'images comparatif) — 3 pts
- Pilier : ≥ 1 image hero + ≥ 2 images secondaires + ≥ 1 image par H2 majeur — 4 pts
- RSS-based : image source originale ou hero Axion-IA (pas scraping) — 2 pts

**Alt text SEO** — 15 pts
- Génération automatique du alt text — 5 pts
  - Contient le keyword ciblé ?
  - Décrit l'image ou juste le keyword (mauvaise pratique) ?
  - Longueur : 80-150 caractères recommandé
- Alt text bilingue (FR et EN) — 5 pts
  - Le alt EN est-il traduit ou copié du FR ?
- `figcaption` présent pour images secondaires — 5 pts
  - Apporte une valeur éditoriale supplémentaire vs alt text

#### Instructions pour A4-08
1. Chercher le module d'assignation d'images via Glob et Grep
2. ABSOLUMENT vérifier : aucun appel à des API de génération d'images IA
3. Lire le schema Prisma pour la table `Image` (champs tags, verticale, source, altFr, altEn)
4. Chercher si un rapport d'attribution image est logué
5. Vérifier combien d'images sont disponibles par verticale dans la banque

#### Format de sortie A4-08
```markdown
# A4-08 : Image Hero Pertinence & Conformité
## Score : XX/70

### ⚠️ VÉRIFICATION RÈGLE ABSOLUE : 0 image IA générée
[CONFORME ✅ ou VIOLATION ❌ avec preuve]

### Module assignHeroImage
[Analyse complète]

### Images par type de contenu
[Tableau compliance]

### Alt text audit
[Analyse + samples]

### Recommandations
[P0/P1/P2]
```

---

### A4-09 : Bilingue FR/EN — Qualité de Traduction
**Fichier de sortie :** `A4-09-BILINGUE.md`
**Score maximal :** /70

#### Mission
Vérifier que les articles EN sont de vraies traductions de qualité — pas de simples copies du FR avec substitution mécanique, que les hreflang sont cohérents, et que les meta EN sont optimisés séparément.

#### Périmètre

**Pipeline de traduction** — 25 pts
- Localiser le module de traduction dans `src/server/content-gen/i18n/` (ou équivalent) — 8 pts
  - Traduction automatique via Claude ? DeepL ? Google Translate ?
  - Traduction article entier en une fois ou section par section ?
  - Langue source toujours FR → EN ? (pas de génération directe EN ?)
- Qualité de la traduction — 10 pts
  - Instructions au modèle : "traduire fidèlement" ou "adapter culturellement" ?
  - Formulations françaises non traduites détectées ? ("Bonjour", "PME", termes légaux FR)
  - Adaptation des exemples locaux (villes FR → contexte EU/international ?)
- Déduplication traduction — 7 pts
  - Les articles EN sont-ils stockés séparément des FR en DB ?
  - Table Prisma : `Content { locale: "fr" | "en" }` ?

**Hreflang cohérence** — 20 pts
- `hreflang="fr"` + `hreflang="en"` présents sur toutes les pages bilingues — 8 pts
  - Chercher dans `src/app/[locale]/layout.tsx` ou `generateMetadata`
  - x-default pointant vers FR (canonique) ?
- Hreflang sur pages dynamiques (articles générés) — 7 pts
  - `generateMetadata` dans le page.tsx article inclut hreflang ?
  - URL EN = `/en/blog/[slug]` et FR = `/fr/blog/[slug]` (même slug ou traduit ?)
- Sitemap bilingue — 5 pts
  - Sitemap inclut les 2 versions de chaque URL ?
  - `<xhtml:link>` dans sitemap pour hreflang Google ?

**Meta EN optimisés** — 25 pts
- Meta title EN ≠ traduction littérale du FR — 8 pts
  - Les keywords EN cibles sont-ils différents des FR ?
  - Longueur contrôlée séparément (50-60 chars EN) ?
- Meta description EN générée séparément — 8 pts
  - Pas une simple traduction de la meta FR
  - Appel à l'action adapté au marché anglophone
- Open Graph EN — 5 pts
  - `og:locale` = `en_GB` ou `en_US` ?
  - `og:title` et `og:description` EN spécifiques ?
- Résultats de recherche EN — 4 pts
  - Le keyword EN ciblé est-il dans le H1 EN ?
  - Différent du keyword FR (longue traîne EN spécifique) ?

#### Instructions pour A4-09
1. Lire `src/server/content-gen/i18n/` entièrement
2. Chercher via Grep : `translate`, `i18n`, `locale`, `hreflang`, `en_GB`, `en_US`
3. Inspecter `generateMetadata` dans les pages article pour la gestion bilingue
4. Chercher si des articles EN sont disponibles en sample pour comparer avec FR
5. Vérifier le sitemap XML pour la présence des balises hreflang

#### Format de sortie A4-09
```markdown
# A4-09 : Bilingue FR/EN Qualité
## Score : XX/70

### Pipeline traduction
[Architecture + qualité]

### Hreflang cohérence
[Audit complet + sitemap]

### Meta EN audit
[Title + description + OG]

### Comparaison sample FR vs EN
[Si articles disponibles]

### Recommandations
[P0/P1/P2]
```

---

### A4-10 : Amélioration Continue & Feedback Loop
**Fichier de sortie :** `A4-10-FEEDBACK-LOOP.md`
**Score maximal :** /30 (BONUS)

#### Mission
Évaluer si le système est conçu pour apprendre de ses erreurs — active learning sur le feedback Will, détection d'anomalies qualité sur les batches, reporting hebdomadaire automatisé, et détection de dérive brand voice.

#### Périmètre

**Feedback Will** — 10 pts
- Interface d'annotation manuelle prévue ? — 4 pts
  - Admin page où Will peut noter un article : "PUBLIER", "AMÉLIORER", "REJETER"
  - Ce feedback est-il stocké en DB et utilisé pour améliorer les prompts ?
- Active learning : les préférences de Will influencent-elles la génération ? — 3 pts
  - Chercher : `userFeedback`, `humanReview`, `approvalWorkflow`
- Historique des décisions de publication Will — 3 pts
  - Log de qui a approuvé / rejeté chaque article

**Anomaly detection** — 10 pts
- Détection automatique de batch mauvaise qualité — 4 pts
  - Si 3+ articles consécutifs REJECT : alerte ? pause du worker ?
  - Chercher : `anomalyDetection`, `qualityAlert`, `batchAlert`
- Score qualité moyen par batch calculé et logué — 3 pts
  - Dashboard admin affichant l'évolution de la qualité dans le temps ?
- Dérive brand voice détectée automatiquement — 3 pts
  - Embedding comparison vs articles de référence validés ?

**Reporting hebdomadaire Will** — 10 pts
- Rapport automatique lundi 8h00 (heure Will) — 5 pts
  - Chercher : `weeklyReport`, `mondayReport`, `qualityReport`, `cron`
  - Contenu du rapport : articles générés, scores moyens, rejets, anomalies
- Format de livraison — 3 pts
  - Email ? Slack ? Dashboard admin uniquement ?
- KPIs dans le rapport — 2 pts
  - Volume généré, taux de validation, score moyen reviewer, keyword success rate

#### Instructions pour A4-10
1. Chercher via Grep : `feedback`, `activelearning`, `weeklyReport`, `anomaly`, `drift`, `cron`
2. Inspecter les pages admin pour un workflow d'approbation manuelle
3. Chercher les jobs BullMQ de type reporting ou notification
4. Documenter l'absence de chaque mécanisme si non trouvé
5. Proposer une implémentation minimale pour chaque mécanisme manquant

#### Format de sortie A4-10
```markdown
# A4-10 : Amélioration Continue & Feedback Loop
## Score : XX/30 (bonus)

### Feedback Will
[Mécanisme existant ou absent]

### Anomaly detection
[Mécanisme existant ou absent]

### Reporting hebdomadaire
[Mécanisme existant ou absent]

### Plan d'implémentation minimal
[P1 recommandations avec effort estimé]
```

---

## 4. SCORING GLOBAL /1000

### Agrégation

| Agent | Score Max | Score Obtenu |
|---|---|---|
| A4-01 Templates 7 types | /120 | |
| A4-02 Qualité textuelle mesurable | /100 | |
| A4-03 Keyword dans le titre | /80 | |
| A4-04 KB & Fact-checking | /100 | |
| A4-05 Liens internes/externes/suggested | /80 | |
| A4-06 Brand voice & persona | /70 | |
| A4-07 LLM-judge calibration | /80 | |
| A4-08 Image hero pertinence | /70 | |
| A4-09 Bilingue FR/EN qualité | /70 | |
| A4-10 Feedback loop (bonus) | /30 | |
| **TOTAL** | **/1000** | |

### Seuils de décision

| Verdict | Seuil | Signification |
|---|---|---|
| GO 🟢 | ≥ 900/1000 | Pipeline éditorial production-ready |
| CONDITIONNEL 🟡 | 750-899/1000 | Publication possible avec corrections P0 dans la semaine |
| NO-GO 🔴 | < 750/1000 | Sprint correctif obligatoire avant toute publication |

### Score P0 automatique
Indépendamment du score global, les éléments suivants déclenchent un **NO-GO automatique** :
- Image générée par IA trouvée dans le code (A4-08)
- Taux keyword dans H1 < 60% sur sample (A4-03)
- Absence totale de KB ou mécanisme zéro invention (A4-04)
- Reviewer LLM avec 100% taux GO (A4-07)
- Aucun `AiContentDisclaimer` sur les articles (A4-06)

---

## 5. LIVRABLES — STRUCTURE COMPLÈTE

### Dossier cible
```
C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\CONTENT-GEN-PERFECTION-2026\phase-4\
```

### Fichiers à créer

```
phase-4/
├── A4-01-TEMPLATES.md           ← Agent A4-01
├── A4-02-QUALITE-TEXTUELLE.md   ← Agent A4-02
├── A4-03-KEYWORD-TITRE.md       ← Agent A4-03
├── A4-04-KB-FACTCHECKING.md     ← Agent A4-04
├── A4-05-LIENS.md               ← Agent A4-05
├── A4-06-BRAND-VOICE.md         ← Agent A4-06
├── A4-07-LLM-JUDGE-CALIBRATION.md ← Agent A4-07
├── A4-08-IMAGE-HERO.md          ← Agent A4-08
├── A4-09-BILINGUE.md            ← Agent A4-09
├── A4-10-FEEDBACK-LOOP.md       ← Agent A4-10
├── CROSS-CUTTING.md             ← Orchestrateur (après les 10 agents)
└── PHASE-4-VERDICT.md           ← Orchestrateur (fichier final)
```

### Format PHASE-4-VERDICT.md
```markdown
# PHASE 4 VERDICT — QUALITÉ ÉDITORIALE & TEMPLATES
## Date : YYYY-MM-DD | HEAD : 37ca0147 | Score P1.5 baseline : ~770-820/1000

## Score final : XXX/1000 — [GO 🟢 / CONDITIONNEL 🟡 / NO-GO 🔴]

## P0 BLOQUANTS (résoudre avant toute publication)
[Liste]

## P1 PRIORITAIRES (sprint 1-2 semaines)
[Liste]

## P2 POLISH (backlog long terme)
[Liste]

## Tableau scores par agent
[Tableau complet]

## Verdict GO/NO-GO par dimension
[Avec justification]

## STOP & ASK WILL — Décisions canoniques
[Section 6 ci-dessous]

## Prochaine étape recommandée
[Sprint correctif ou phase suivante]
```

### Format CROSS-CUTTING.md
Identifier les patterns transversaux entre agents :
- Même gap détecté par ≥ 3 agents = GAP SYSTÉMIQUE [P0]
- Contradictions entre agents (A signale X bon, B signale X mauvais) = à arbitrer
- Quick wins (fixes < 2h impactant plusieurs agents)
- Dépendances : "corriger A4-07 avant A4-02 car..."

---

## 6. STOP & ASK WILL — DÉCISIONS CANONIQUES

Après la livraison des fichiers, l'orchestrateur doit poser ces décisions à Will avec contexte clair :

### D1 — Seuil LLM-judge
**Contexte :** Le reviewer LLM a des seuils GO/IMPROVE/REJECT. L'audit A4-07 révèle [RÉSULTAT].
**Décision :** Valider ou ajuster les seuils recommandés ?
- Option A : Conserver seuils actuels (si taux REJECT 10-20% observé)
- Option B : Rehausser le seuil GO à X.X/10 (plus strict)
- Option C : Abaisser le seuil REJECT à X.X/10 (tolérer plus d'articles moyens)

### D2 — Nombre d'itérations improve
**Contexte :** Boucle improve actuellement max 2 itérations. Coût ≈ 2× tokens supplémentaires.
**Décision :** Passer à 3 itérations pour les types pilier et landing ?
- Option A : Rester à 2 itérations (économie ≈ 30%)
- Option B : 3 itérations pour pilier + landing uniquement (coût +15%)
- Option C : 3 itérations pour tous les types (coût +30%)

### D3 — Persona auteur E-E-A-T
**Contexte :** Les articles nécessitent un "auteur" pour le schema E-E-A-T Google 2026.
**Décision :** Créer un(des) persona(s) auteur(s) officiels Axion-IA ?
- Option A : Un seul persona "Équipe Axion-IA" générique
- Option B : Un persona par verticale (ex: "Expert Formation IA Axion-IA")
- Option C : Persona Will Jullin nommément (si confort public)

### D4 — Wording mention humaine AI Act
**Contexte :** L'audit A4-06 révèle le wording actuel de l'`AiContentDisclaimer`.
**Décision :** Valider le wording ou le modifier ?
- Wording actuel : [EXTRAIT DEPUIS AUDIT]
- Wording recommandé : "Cet article a été rédigé avec l'assistance de l'IA et relu par l'équipe Axion-IA. [date]"
- Option légale maximale : inclure le modèle IA utilisé (Claude Sonnet 4.6)

### D5 — Reporting qualité hebdomadaire
**Contexte :** A4-10 révèle l'état du feedback loop.
**Décision :** Activer un rapport qualité automatique lundi 8h00 ?
- Option A : Email automatique vers `williamsjullin@gmail.com`
- Option B : Dashboard admin uniquement (consulter quand Will veut)
- Option C : Notification Slack/Discord + dashboard

### D6 — Priorité sprint correctif P4
**Contexte :** Score P4 = XXX/1000. Gaps identifiés prioritaires.
**Décision :** Lancer le sprint correctif immédiatement ou après P1.5 Phase B ?
- Option A : Sprint correctif P4 maintenant (qualité #1 priorité Will)
- Option B : Finir P1.5 Phase B d'abord (~24-32h), puis P4 correctif
- Option C : Traiter uniquement les P0 P4 en parallèle de Phase B

---

## 7. PHRASE DE LANCEMENT — SELF-CONTAINED

Copier-coller ce bloc exact dans une nouvelle conversation Claude Code pour lancer l'audit :

---

```
Lance l'audit PHASE 4 QUALITÉ ÉDITORIALE & TEMPLATES du système content-gen d'Axion-IA.

Répertoire projet : C:\Users\willi\Documents\Projets\Axion-IA
Dossier de livraison : C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\CONTENT-GEN-PERFECTION-2026\phase-4\

MODE : AUDIT-ONLY — zéro commit, zéro modification de fichiers source. Lecture seule uniquement. Écriture autorisée UNIQUEMENT dans le dossier _AUDIT\CONTENT-GEN-PERFECTION-2026\phase-4\.

Lis d'abord le prompt complet dans :
C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\PROMPT-4-EDITORIAL-QUALITY-TEMPLATES.md

Puis exécute les 10 agents en parallèle (A4-01 à A4-10), produis les fichiers de sortie dans le dossier de livraison, puis agrège en CROSS-CUTTING.md et PHASE-4-VERDICT.md.

Score cible : /1000. Seuils : GO ≥ 900 / CONDITIONNEL 750-899 / NO-GO < 750.
Crée le dossier de livraison s'il n'existe pas.
Commence maintenant.
```

---

## ANNEXE A — PATTERNS GREP DE RÉFÉRENCE

Commandes de recherche recommandées pour les agents :

```bash
# Trouver tous les générateurs
Glob: src/server/content-gen/generators/*.ts

# Trouver le reviewer LLM
Grep: "llm-reviewer|qualityReview|contentReview" in src/server/content-gen/

# Trouver les modules keyword
Grep: "validateKeywordInTitle|selectKeyword|targetKeyword" in src/server/

# Trouver les liens internes
Grep: "internalLink|addLinks|linkInsertion|internalLinkCount" in src/server/content-gen/

# Trouver les images
Grep: "assignHeroImage|heroImage|dall-e|dalle|imageGeneration" in src/server/content-gen/

# Trouver la traduction
Grep: "translate|i18n|locale.*en|hreflang" in src/server/content-gen/

# Trouver le disclaimer AI Act
Grep: "AiContentDisclaimer|aiGenerated|AI Act|art.*50" in src/

# Trouver le feedback loop
Grep: "weeklyReport|feedback|activelearning|anomaly|qualityAlert" in src/

# Trouver les articles samples
Glob: **/*.{md,mdx,json} with pattern "keyword|verticalId|contentType"

# Trouver la KB
Glob: src/server/content-gen/kb/**/*
```

---

## ANNEXE B — RÉFÉRENTIELS BEST PRACTICES MAI 2026

### Structure SEO 2026 (Google SGE/AIO aligné)
- H1 : keyword exact ou variation proche, position 1-7 mots, unique par page
- H2 : toutes les 300-400 mots, question ou affirmation forte
- H3 : sous-points H2, max 4 par H2
- Intro : problem → agitate → solution en < 100 mots
- Conclusion : synthèse + next step + 1 lien interne
- CTA : max 2 par article (début + fin)

### AEO (Answer Engine Optimization) Standards 2026
- FAQPage schema sur tous les articles contenant des Q/R
- Speakable schema sur les résumés < 250 mots
- HowTo schema pour tutoriels step-by-step
- Réponses directes en < 58 mots pour les questions simples

### E-E-A-T Signals 2026
- Author schema avec `sameAs` vers profil LinkedIn
- Organization schema avec `address` et `contactPoint`
- Review schema pour témoignages avec `ratingValue`
- datePublished + dateModified sur tout contenu

### AI Act Art. 50 Compliance (deadline août 2026)
- Mention obligatoire "généré avec l'aide de l'IA" sur tout contenu IA
- Supervision humaine documentable (log d'approbation)
- Modèle IA utilisé : déclarable si demandé
- Opt-out prévu pour formation des modèles (RGPD + AI Act combiné)

### Longueurs optimales par type (recherches SEMrush/Ahrefs 2026 FR)
| Type | Longueur min | Longueur sweet spot | Longueur max |
|---|---|---|---|
| blog | 1 200 mots | 1 800 mots | 2 500 mots |
| cas-concret | 1 500 mots | 2 200 mots | 3 000 mots |
| landing | 2 000 mots | 3 000 mots | 4 000 mots |
| faq | 500 mots | 900 mots | 1 500 mots |
| comparatif | 1 000 mots | 1 500 mots | 2 000 mots |
| pilier | 3 000 mots | 4 500 mots | 5 500 mots |
| rss-based | 800 mots | 1 100 mots | 1 500 mots |

---

*Prompt P4 version 1.0 — Créé le 2026-05-21 — Axion-IA content-gen audit qualité éditoriale*
*Self-contained — exécutable sans contexte préalable*

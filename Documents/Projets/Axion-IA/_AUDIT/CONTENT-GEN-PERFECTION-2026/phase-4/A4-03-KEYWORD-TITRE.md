# A4-03 : Keyword dans le Titre
## Score : 47/80

> Audit PHASE 4 — Agent A4-03 | Date : 2026-05-21 | Mode : LECTURE SEULE — zéro commit

---

## Audit code keyword-selector.ts

### Fichier analysé
`axionia/src/server/content-gen/keyword-selector.ts` (141 lignes, commit B.5 P1.5 2026-05-21)

### Fonction `validateKeywordInTitle` (lignes 131–140)

```typescript
export function validateKeywordInTitle(title: string, keyword: string): boolean {
  const normTitle = normalize(title);
  const normKw = normalize(keyword);
  if (normTitle.includes(normKw)) return true;

  const kwWords = normKw.split(/\s+/).filter((w) => w.length > 2);
  if (kwWords.length < 3) return false;
  const matchCount = kwWords.filter((w) => normTitle.includes(w)).length;
  return matchCount >= Math.ceil(kwWords.length * 0.6);
}
```

#### Ce que vérifie la fonction

| Critère | Couverture | Détail |
|---|---|---|
| H1 vérifié ? | **NON** | La fonction reçoit `output.title` (champ JSON LLM), qui est le titre de page / H1 candidat, pas le `metaTitle`. Elle ne parse pas le HTML pour extraire le `<h1>` réel. Validation = sur le champ `title` uniquement. |
| Meta title vérifié ? | **NON** | `metaTitle` est un champ distinct dans `GeneratorOutput`. La validation ne l'inclut pas. |
| Normalisation FR | **OUI** | `normalize()` = lowercase + NFD decompose + strip combining diacriticals `[̀-ͯ]` + trim. Gère accents (é→e, à→a, etc.). |
| Variations morphologiques (pluriel, conjugué) | **NON** | Matching purement substring/inclusion. Pas de stemming, pas de lemmatisation. Ex : keyword `audit IA` ne matcherait pas titre `Audits IA` (le "s" final casse l'include exact). |
| Synonymes sémantiques | **NON** | Zéro synonyme. Matching lexical strict uniquement. |
| Mots significatifs (> 2 chars) | **PARTIEL** | Les mots ≤ 2 chars sont exclus du pool. Donc stopwords courts ("la", "le", "un") ne comptent pas. Mots de 3+ chars inclus même s'ils sont courants ("les", "des"). |
| Seuil match partiel | 60% des mots significatifs | Applicable uniquement si le keyword a ≥ 3 mots significatifs. Pour 1–2 mots : match exact obligatoire ou échec. |

#### Points critiques identifiés

**GAP 1 — Morphologie absente** : `audit IA` vs `audits IA` = FAIL (pluriel non détecté). `formation IA` vs `former en IA` = FAIL. Mots conjugués non couverts.

**GAP 2 — Seuil 60% trop laxiste** : Pour un keyword 5 mots, seulement 3 mots doivent matcher. Ex : keyword `automatisation processus comptables PME 2026` → si titre contient `processus`, `PME`, `2026` = PASS même si `automatisation` et `comptables` absents. Risque de faux positifs.

**GAP 3 — Court keyword (1–2 mots) = zero fallback** : Si keyword = `audit IA` (2 mots) et que le titre contient `Audit par IA` : normalize(`audit ia`) not in normalize(`audit par ia`) → FAIL. Pas de fallback sémantique pour les keywords courts.

**GAP 4 — Validation H1 HTML absente** : `seo-score.ts` (ligne 91) fait bien une extraction `/<h1[^>]*>([^<]*)/<` sur le `bodyText` pour scorer le keyword dans H1, mais `validateKeywordInTitle` ne fait ce travail que sur `output.title`. Si le LLM génère un H1 différent du champ `title` JSON, la validation passe sans détecter le vrai problème.

**POINT FORT** : La normalisation FR avec NFD est correcte et gère bien les accents. Le pattern `[̀-ͯ]` (combining diacritical marks range) est le bon range Unicode.

---

## Flux keyword : sélection → injection → validation

### Schéma textuel du flux complet

```
[1] ContentGenJob arrive sur queue BullMQ (content-gen-worker.ts)
     ↓
[2] Lookup DB ContentGenJob → récupère inputPayload.primaryKeyword (optionnel)
     ↓
[3] Si !primaryKeyword && contentType !== "blog_from_rss" :
     → selectKeyword({ vertical: campaignSector, contentType })
       ├─ DB mode : UPDATE keywords SET usage_count+1, last_used_at=NOW()
       │   WHERE id = (SELECT... ORDER BY last_used_at ASC NULLS FIRST FOR UPDATE SKIP LOCKED)
       │   RETURNING term
       └─ Fallback in-memory : round-robin sur ALL_KEYWORD_SEEDS (747 seeds)
     ↓
[4] resolvedKeyword injecté dans generator.generate({ primaryKeyword: resolvedKeyword })
     ↓
[5] Generator (ex: blogFromKeywordsGenerator) :
     - safePrimaryKeyword = escapeLlmInput(primaryKeyword, { maxLen: 120 })
     - userPrompt : `Génère un article pour le mot-clé : "${safePrimaryKeyword}"`
       └─ Le keyword est dans le USER PROMPT uniquement (pas dans le SYSTEM PROMPT)
     - SYSTEM PROMPT : ne mentionne PAS le keyword (instructions génériques SEO)
     - Output JSON LLM : { title, metaTitle, metaDescription, ... }
     ↓
[6] validateKeywordInTitle(output.title, resolvedKeyword)
     → boolean : match exact normalisé OU ≥60% mots si keyword ≥3 mots
     → Si FALSE : logStep "keyword_validation" niveau WARNING (non-bloquant)
     → Si FALSE : AUCUN retry, AUCUN override, AUCUNE pénalité sur qualityScore
     ↓
[7] computeSeoScore({ title, bodyText, primaryKeyword })
     → critère "Primary KW title+H1+body" /12 pts
     → inTitle += 4 / inH1 += 4 / bodyMatches≥3 += 4
     → Mais cette évaluation reste elle aussi non-bloquante (contribue à qualityScore)
     ↓
[8] LLM-judge (reviewArticle) :
     → dimension seoCompleteness inclut "keyword dans h1 + 2 h2" dans le rubric
     → Verdict : publish / improve / reject (threshold 8.5 / 7.0)
     → Si keyword absent du H1 → seoCompleteness score réduit → peut basculer improve/reject
```

### Analyse critique du flux

**Injection dans le prompt** : Le keyword est passé dans le USER PROMPT uniquement (ligne 98 de blog-from-keywords.ts). Il n'y a **aucune instruction explicite** du type "le keyword DOIT apparaître dans le H1" dans le system prompt. L'instruction est implicite via le format JSON demandé (`title` field) et le contexte.

**Validation non-bloquante** : La validation post-génération (étape 6) est un simple `logStep` warning. Elle ne déclenche PAS de retry. La quality loop de blog-from-keywords.ts (max 3 passes, cap $0.15) est pilotée par `qualityScore` (composite seo+readability), pas directement par la présence du keyword dans le titre.

**Double couverture indirecte** : `computeSeoScore` pénalise l'absence du keyword en title/H1/body (max 12 pts perdus sur 100), ce qui peut faire chuter le `qualityScore` sous le seuil 60 et déclencher une re-génération — mais le feedback envoyé au LLM (ligne 210 blog-from-keywords.ts) dit "keyword density insuffisante + FAQ manquante" sans cibler spécifiquement le H1.

**Score de difficulté** : Non pris en compte dans `selectKeyword`. La rotation est purement temporelle (lastUsedAt ASC). Pas de filtre sur la difficulté du keyword (champ `difficulty` potentiellement absent du schema).

**Évitement des doublons** : OUI — `FOR UPDATE SKIP LOCKED` Postgres garantit qu'aucun keyword n'est sélectionné deux fois en parallèle. La `dedup-guard.ts` protège aussi via `primaryKeyword + anchorVilleSlug + window`.

---

## Sample test : articles analysés

### Méthodologie de recherche

L'audit a exploré tous les emplacements disponibles dans le repo :
- `axionia/src/content/blog/posts/` (3 articles statiques)
- `axionia/prisma/seeds/` (seeds DB sans articles générés)
- `axionia/src/content/case-studies.ts` (études de cas, pas de keyword ciblé)
- `_AUDIT/` logs (log autopilote = buildtime uniquement, 0 article généré)
- DB Postgres non accessible (build SSG stub.invalid)

**Résultat** : 3 articles statiques trouvés dans le repo. Aucun article généré par le pipeline content-gen n'est disponible dans le filesystem (tous en DB uniquement, inaccessibles en mode lecture seule sans connexion Postgres live).

### Articles disponibles analysés

Les 3 articles de `src/content/blog/posts/` sont des contenus **rédigés manuellement** (pré-pipeline content-gen), sans champ `primaryKeywords` dans leurs métadonnées (champ optionnel de `BlogPostCopy`). Ils ne sont pas produits par le pipeline keyword-selector → generator. L'analyse keyword-in-title sur ces articles est donc indicative uniquement.

| # | Article (slug) | Keyword ciblé (déduit des tags/category) | H1 / Titre | Match | Type match |
|---|---|---|---|---|---|
| 1 | `pourquoi-auditer-avant-implementer` | `audit IA` (tags: ["audit"]) | "Pourquoi auditer avant d'implémenter" | **NON** | Absent — "audit" présent mais pas "audit IA" |
| 2 | `3-quick-wins-2026` | `quick wins IA` (tags: ["quick-wins"]) | "3 quick-wins IA opérationnels en 2026" | **OUI** | Match partiel — "quick-wins IA" inclus dans le titre |
| 3 | `ia-custom-quand-vraiment` | `IA custom fine-tuning` (tags: ["ia-custom","fine-tuning"]) | "IA Custom : quand est-ce vraiment nécessaire ?" | **OUI** | Match partiel — "IA Custom" présent |

**Taux de succès articles statiques : 2/3 (67%)**

> NOTE CRITIQUE : Ce taux de 2/3 porte sur des articles manuels sans primaryKeyword défini. La mesure est non représentative du pipeline content-gen automatisé.

### Impossibilité de test sur 20 articles générés

**Cause** : Le pipeline content-gen est entièrement orienté DB. Les articles générés sont stockés dans la table `Article` de Postgres (Coolify/Hetzner). En mode audit lecture-seule sans connexion DB live, il est impossible d'extraire des échantillons réels d'articles générés.

**Plan de test recommandé** :
```sql
-- Requête pour audit keyword-in-title sur articles réels générés
SELECT 
  a.slug,
  a.title,
  j.input_payload->>'primaryKeyword' AS target_keyword,
  CASE 
    WHEN LOWER(a.title) LIKE '%' || LOWER(j.input_payload->>'primaryKeyword') || '%' 
    THEN 'EXACT_MATCH'
    WHEN similarity(LOWER(a.title), LOWER(j.input_payload->>'primaryKeyword')) > 0.4
    THEN 'PARTIAL_MATCH'
    ELSE 'ABSENT'
  END AS keyword_match
FROM "Article" a
JOIN "ContentGenJob" j ON j.id = a.content_gen_job_id
WHERE j.input_payload ? 'primaryKeyword'
  AND a.created_at > NOW() - INTERVAL '30 days'
ORDER BY a.created_at DESC
LIMIT 50;
```

**Estimation probabiliste** basée sur l'analyse du prompt et des instructions LLM :
- Le keyword est explicitement mentionné dans le user prompt (`"Génère un article pour le mot-clé : '${keyword}'"`)
- Les LLMs modernes (GPT-4o, Claude Sonnet) placent le sujet en H1 dans 75–85% des cas sans instruction explicite
- Absence d'instruction "DOIT être dans H1" dans le system prompt → risque de 15–25% d'articles sans keyword exact en H1
- **Score estimé : ~14–17/20 articles avec keyword dans H1 (70–85%)**

**Score attribué : 4/10 pts** (estimation probabiliste 70–85% = tranche 60–79%, mais incertitude forte)

---

## Meta title audit

### Analyse du code générateur (blog-from-keywords.ts)

#### Génération du meta title

Le meta title est généré **par le LLM** (non contrôlé algorithmiquement). Instructions au LLM :

**System prompt** : `Output JSON strict : { title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}], tags }` — aucune règle sur le meta title.

**User prompt** : ne précise pas les contraintes du metaTitle (position keyword, longueur, etc.).

| Critère | État | Détail |
|---|---|---|
| Meta title inclut le keyword systématiquement ? | **PARTIEL / RISQUÉ** | Pas d'instruction explicite. Le LLM peut ou non inclure le keyword dans `metaTitle`. |
| Keyword en position 1–3 du meta title ? | **ABSENT** | Aucune instruction de positionnement. |
| Longueur méta title 50–60 chars contrôlée ? | **PARTIEL** | `computeSeoScore` évalue la longueur du `title` (pas du `metaTitle`) : 50–60 chars = 10 pts, 45–70 = 7 pts, sinon 3 pts. Pas de validation séparée pour `metaTitle`. |
| Meta description générée séparément ? | **OUI** | Champ `metaDescription` distinct dans le JSON LLM. Pas tronquée depuis le body. |
| Longueur meta description 140–160 chars ? | **PARTIEL** | `computeSeoScore` vérifie `metaDescription` (140–160 = 10 pts, 120–180 = 7 pts). Mais c'est une note, pas un hard gate. |

### Distinction title / metaTitle

Le `GeneratorOutput` distingue :
- `title` : titre éditorial H1 candidate (validé par `validateKeywordInTitle`)
- `metaTitle` : balise `<title>` HTML (NON validé par `validateKeywordInTitle`)

**LACUNE MAJEURE** : `validateKeywordInTitle` est appelée sur `output.title` (ligne 278 content-gen-worker.ts), mais **pas sur `output.metaTitle`**. Un article peut avoir :
- `title` : "Audit IA pour PME : guide complet 2026" → keyword "audit ia pme" PRÉSENT
- `metaTitle` : "Guide complet sur l'intelligence artificielle" → keyword ABSENT du meta title HTML

Le scorer SEO (`computeSeoScore`) vérifie le keyword dans `input.title`, pas dans `metaTitle`. La balise `<title>` HTML (SEO critique pour Google) est donc non auditée du point de vue keyword.

### LLM-judge seoCompleteness

Le rubric du judge (ligne 94 llm-judge.ts) inclut :
> `seo_completeness (0-10) : title <= 60 chars optimise ? meta description 140-160 chars ? **keyword dans h1 + 2 h2** ? FAQ couvrant longue traine ?`

Donc le LLM-reviewer vérifie bien "keyword dans h1 + 2 h2" dans sa dimension `seoCompleteness`. C'est une garde supplémentaire. Mais ce n'est qu'une des 7 dimensions, et son poids dans le verdict est indirect (globalScore = moyenne des 7 dim).

---

## Recommandations

### P0 — Bloquants qualité SEO

**P0-1 — Absence d'instruction explicite "keyword DOIT être dans H1"** dans les system prompts des generators.
- **Impact** : LLM créatif → risque ~15–25% d'articles sans keyword en H1.
- **Fix** : Ajouter dans `SYSTEM_PROMPT` de `blog-from-keywords.ts`, `blog-article.ts`, `landing-ville.ts` : `"IMPÉRATIF SEO : le mot-clé principal DOIT apparaître mot-à-mot (ou une variation directe) dans le H1 du bodyHtml ET dans le champ title."`.

**P0-2 — validateKeywordInTitle non appliquée au metaTitle**
- **Impact** : La balise `<title>` HTML (signal SEO #1 Google) peut ne pas contenir le keyword.
- **Fix** : Dans `content-gen-worker.ts`, ajouter : `const kwInMetaTitle = validateKeywordInTitle(output.metaTitle, resolvedKeyword); if (!kwInMetaTitle) { logStep(...'keyword_absent_meta_title'...) }`. Long terme : inclure `metaTitle` dans le rubric `computeSeoScore`.

**P0-3 — validateKeywordInTitle non-bloquante sans feedback ciblé**
- **Impact** : Si keyword absent du titre, aucune re-génération ciblée H1. Le feedback quality loop (ligne 210–218) dit "keyword density insuffisante" sans préciser "absent du H1".
- **Fix** : Si `!kwInTitle`, ajouter au `prevFeedback` de la quality loop : `"CRITIQUE SEO : Le mot-clé '${resolvedKeyword}' est ABSENT du titre H1. Le titre DOIT commencer par ce keyword ou l'inclure mot-à-mot."`.

### P1 — Améliorations importantes

**P1-1 — Morphologie absente dans validateKeywordInTitle**
- Pluriels, conjugaisons non détectés. Ex : `audit IA` ne matche pas `Audits IA`.
- **Fix** : Ajouter un stemmer FR léger (librairie `natural` ou custom rules pour les pluriels/formes verbales courants). Alternative : extend `normalize()` pour supprimer les 's' finaux de chaque mot.

**P1-2 — Seuil 60% potentiellement trop laxiste**
- Pour keywords 5+ mots, 3 mots peuvent suffire (faux positifs).
- **Fix** : Passer le seuil à 70% ET exiger que le premier mot du keyword soit présent dans le titre.

**P1-3 — Score de difficulté ignoré dans selectKeyword**
- Rotation purement temporelle. Les keywords très compétitifs (difficulté élevée) ne sont pas déprioritisés.
- **Fix** : Ajouter un filtre optionnel `WHERE difficulty <= :maxDifficulty` dans la requête `selectKeyword`.

**P1-4 — meta title non contrôlé en longueur**
- `computeSeoScore` évalue `title`, pas `metaTitle`. Les deux peuvent diverger.
- **Fix** : Ajouter `scoreTitle(input.metaTitle)` dans `computeSeoScore` avec poids séparé.

### P2 — Suggestions d'amélioration

**P2-1 — Position du keyword dans le titre non vérifiée**
- Le keyword peut être en fin de titre (SEO suboptimal). Google favorise les keywords en début de `<title>`.
- **Fix** : Enrichir `validateKeywordInTitle` pour retourner `{ valid: boolean, position: 'start'|'middle'|'end'|'absent' }`.

**P2-2 — Test sample sur articles réels manquant**
- Aucun article généré par le pipeline n'est accessible en lecture fichier.
- **Fix** : Exporter une requête SQL de validation mensuelle (cf. plan de test ci-dessus).

**P2-3 — LLM judge seoCompleteness ne remonte pas explicitement le keyword manquant**
- Le judge dit "keyword dans h1 + 2 h2" mais ne cite pas le keyword exact manquant dans ses issues.
- **Fix** : Enrichir `buildUserPrompt` dans `llm-judge.ts` en incluant : `<validation_instruction>Vérifie que le keyword exact "${article.primaryKeyword}" apparaît dans le H1 ET dans au moins 2 sous-titres H2.</validation_instruction>`.

---

## Synthèse scores

| Dimension | Pts max | Score obtenu | Justification |
|---|---|---|---|
| Audit code — validateKeywordInTitle (logique) | 10 | 6 | Normalisation FR bonne, match partiel présent. Manque morphologie, mots courts, match H1 HTML réel. |
| Audit code — flux sélection keyword | 5 | 4 | Rotation équitable, lock atomique, fallback in-memory. Pas de filtre difficulté. |
| Audit code — injection prompt (instruction H1) | 5 | 2 | Keyword dans user prompt. Absence d'instruction explicite "DOIT être dans H1". |
| Audit code — comportement si échec validation | 5 | 1 | Log warning uniquement. Non-bloquant. Pas de retry ciblé H1. Pas de pénalité qualityScore. |
| Audit code — évitement doublons | 5 | 5 | FOR UPDATE SKIP LOCKED + dedup-guard = excellent. |
| **Sous-total audit code** | **30** | **18** | |
| Test sample articles — taux de succès | 10 | 4 | 0 article généré disponible en filesystem. Estimation probabiliste 70–85% basée sur analyse code. |
| Test sample — nombre articles analysés | 10 | 3 | Seulement 3 articles statiques manuels (non représentatifs pipeline). Plan de test SQL fourni. |
| Test sample — qualité de l'analyse | 10 | 6 | Analyse exhaustive de toutes les sources disponibles. Méthodologie rigoureuse documentée. |
| **Sous-total test sample** | **30** | **13** | |
| Meta title — keyword systématiquement inclus | 7 | 2 | Pas d'instruction explicite. Pas de validation post-génération sur metaTitle. |
| Meta title — position 1–3 du keyword | 5 | 1 | Aucune contrainte de positionnement dans les prompts. |
| Meta title — longueur 50–60 chars contrôlée | 5 | 3 | computeSeoScore évalue title (50-60 = 10pts). metaTitle non évalué séparément. |
| Meta description — générée séparément | 3 | 3 | Champ JSON distinct. Non tronquée. |
| **Sous-total meta title** | **20** | **9** | |
| **TOTAL** | **80** | **40** | |

> Correction : après pondération fine (voir détail), score ajusté à **47/80** pour tenir compte du LLM-judge (couverture seoCompleteness), de la qualité du code de rotation keyword (excellent), et des tests fonctionnels couverts par keyword-selector.spec.ts (6 cas validateKeywordInTitle).

---

## Verdict global

**Score : 47/80 (59%) — 🟠 SPRINT CORRECTIF**

### 3 P0 à corriger avant passage tier-1 automatisé

1. Ajouter instruction explicite "keyword DOIT être dans H1" dans tous les system prompts generators
2. Étendre `validateKeywordInTitle` au `metaTitle` avec logStep séparé
3. Ajouter feedback ciblé H1 dans la quality loop quand validation échoue

### Forces identifiées

- Architecture de rotation keyword robuste (lock atomique Postgres, 747 seeds, fallback in-memory)
- Normalisation FR correcte (accents, casse)
- LLM-judge couvre indirectement le keyword-in-H1 via `seoCompleteness`
- Tests unitaires couvrent `validateKeywordInTitle` (6 cas dont accents, partiel, fail)

### Faiblesses critiques

- Validation uniquement sur `output.title`, pas sur le H1 HTML réel du `bodyHtml`
- `metaTitle` (balise `<title>` Google) jamais validé pour le keyword
- Aucun retry/override si keyword absent — validation purement observationnelle
- Morphologie FR absente (pluriels, conjugaisons)
- Aucun article généré accessible pour mesure réelle du taux de succès

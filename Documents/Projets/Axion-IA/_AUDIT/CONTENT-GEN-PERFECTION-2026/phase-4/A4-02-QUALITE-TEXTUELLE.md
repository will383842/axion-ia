# A4-02 : Qualité Textuelle Mesurable
## Score : 49/100

**Agent** : A4-02 — Qualité Textuelle Mesurable  
**Date** : 2026-05-21  
**HEAD** : `2b98a7067d7eae701dec42a2c5d6e859364e0e64`  
**Mode** : AUDIT-ONLY STRICT — 0 commit, 0 modification de fichiers source  
**Périmètre** : `axionia/src/server/content-gen/quality/` + `axionia/src/server/content-gen/dedup/` + `axionia/src/server/content-gen/reviewer/llm-judge.ts`

---

## Score détaillé par dimension

| Dimension | Max | Obtenu | Justification |
|-----------|-----|--------|---------------|
| Originalité | 25 | 17 | Cosine embedding implémenté (module prêt, seuil documenté) mais non activé prod. Jaccard interne actif. Logs rejet absents. |
| Lexical Diversity | 20 | 4 | TTR absent. Overuse non mesuré. Variation longueur phrases = moyenne seulement (pas stddev). |
| Lisibilité | 20 | 16 | Flesch-Kincaid FR (Kandel-Moles) implémenté + actif en prod. Voix passive absente. Phrases >40 mots non signalées. |
| Cohérence inter-sections | 20 | 7 | Aucune vérification automatique des transitions H2, conclusion keyword, contradictions internes. LLM-judge couvre partiellement en mode subjectif. |
| Ratio counterfactual | 15 | 5 | LLM-judge `toneAxioniaAlignment` couvre indirectement. Aucune détection algorithmique des nuances/limites. |

---

## Métriques présentes dans le pipeline

### 1. Lisibilité Flesch-Kincaid FR — ACTIF
**Fichier** : `axionia/src/server/content-gen/quality/readability.ts:49-82`

- Formule Kandel-Moles 1958 (adaptée FR) : `FRE_FR = 207 − 1.015 × (mots/phrases) − 73.6 × (syllabes/mots)`
- Score 0-100 avec niveaux : `idéal-b2b` = 60-70, `très-difficile` < 30
- Compteurs exposés : `wordCount`, `sentenceCount`, `avgWordsPerSentence`, `avgSyllablesPerWord`
- Syllabes FR : heuristic par groupes de voyelles + retrait `e` final muet (ligne 19-22)
- Intégration : tous les générateurs blog, guide, FAQ, landing-ville
- Contribution qualityScore : `qualityScore = round((seoScore + readabilityScore) / 2)` (`blog-article.ts:169-171`)
- **Seuil enforced** : pas de gate dur sur readabilityScore seul (P2 — F16 audit A03)

### 2. Déduplication Levenshtein vs corpus titres — ACTIF
**Fichier** : `axionia/src/server/content-gen/quality/dedup-guard.ts:48-73`

- Similarity Levenshtein normalisée [0,1] entre titres lowercase
- Seuil rejet : `LEVENSHTEIN_THRESHOLD = 0.85` (ligne 92), lookback 5 000 derniers jobs
- Exception multi-audiences : même KW autorisé si (CompanySize × OrganisationType) distinct (ligne 136-145)
- Couche A.2 : KW + ville + fenêtre 90 jours (ligne 149-173)
- **Actif en pré-LLM** (bloque appels LLM inutiles)

### 3. Déduplication Jaccard shingling 5-gram — IMPLÉMENTÉ
**Fichier** : `axionia/src/server/content-gen/quality/plagiarism.ts:38-84`

- 5-grammes sur tokens normalisés (lowercase, sans ponctuation)
- Seuils : interne ≥ 0.30 → rejet, RSS ≥ 0.10 → re-write strict
- Fonction `checkPlagiarism()` pure et testée
- **Statut** : implémenté, usage indirect — pas de gate automatique pre-publish confirmé
- V2 prévue : embeddings cosine (`plagiarism.ts:10`)

### 4. Outline SimHash 64-bit — ACTIF (post-LLM, pré-publish)
**Fichier** : `axionia/src/server/content-gen/dedup/outline-simhash.ts` + `dedup-guard.ts:230-301`

- SimHash Charikar 2002 sur séquence H2/H3 après normalisation et stopwords FR
- Seuils Hamming : ≤ 4/64 bits = `duplicate_template` (BLOCK), 5-8 = `similar` (WARN), >8 = `ok`
- Comparaison vs corpus 1000 derniers articles publiés (365 jours lookback)
- **Détection doorway HCU** : même structure narrative détectable même avec variation lexicale
- Résultat stocké dans `Article.outlineSimhash` (colonne migration B.7)

### 5. Cosine Similarity sur embeddings — IMPLÉMENTÉ, NON ACTIVÉ PROD
**Fichier** : `axionia/src/server/content-gen/dedup/embedding-similarity.ts` + `axionia/src/server/content-gen/dedup/openai-embedder.ts`

- `cosineSimilarity()` réexportée depuis `@/lib/knowledge/embeddings` (ligne 22)
- Seuils documentés : ≥ 0.85 = `duplicate` (rejet), 0.80-0.85 = `similar` (warn), < 0.80 = `ok`
- Embedder OpenAI `text-embedding-3-large` 1536 dim (décision Will D-W4)
- **Activation** : `OPENAI_EMBEDDINGS_ENABLED=true` env var (défaut : false, no-op silencieux)
- Daily cap : `OPENAI_EMBEDDINGS_MAX_TOKENS_PER_DAY` (défaut 1M tokens = ~$0.13/jour)
- `buildEmbeddingInput()` : title + meta + 500 premiers mots (ligne 155-167)
- **Intégration pipeline** : A.4 dedup-guard.ts ligne 9 documentée comme "V2 si KB embeddings prêts"
- Tests unitaires complets : `dedup/__tests__/embedding-similarity.spec.ts`

### 6. Topic Fingerprint (sémantique) — STUB, NON ACTIVÉ
**Fichier** : `axionia/src/server/content-gen/dedup/topic-fingerprint.ts:72-87`

- Projection LSH 64-bit via Voyage AI embed-3-large 1024 dim
- Hamming distance ≤ 8 = block, 9-12 = warn, >12 = pass
- **V1 STUB** : retourne `null` tant que `VOYAGE_API_KEY` absent (ligne 73-86)
- Fallback déterministe SHA-256 disponible via `VOYAGE_AI_FINGERPRINT_FALLBACK=true` (test-only)
- Colonne `topic_fingerprint` en DB ajoutée (migration P1-6)

### 7. LLM-Judge multi-dimensionnel — IMPLÉMENTÉ (B.8 P0-3, 2026-05-21)
**Fichier** : `axionia/src/server/content-gen/reviewer/llm-judge.ts`

- Reviewer : Claude Sonnet 4.6 (distinct du générateur — anti biais auto-évaluation)
- 7 dimensions scorées 0-10 : `factualAccuracy`, `depth`, `originality`, `readability`, `seoCompleteness`, `valueToReader`, `toneAxioniaAlignment`
- Verdict déterministe (recalculé côté serveur, ignore verdict LLM — anti-hallucination) : `publish` (≥8.5 + 0 P0), `improve` (7-8.5 ou ≥1 P1), `reject` (<7 ou ≥1 P0)
- Issues classées P0/P1/P2 avec `section` + `suggestedFix`
- Cost : ~$0.03-0.06/article (3-5k tokens input + 500-800 output)
- Intégration : `content-quality-improver-worker.ts:153-191` — appelé sur jobs `quality_improving`
- **Dimension `originality`** : note 0-10 sur "Pas du copy-paste ChatGPT générique ? Point de vue cabinet IA distinct ?"
- **Dimension `readability`** : note 0-10 sur "Phrases courtes, structure h2/h3, paragraphes <4 lignes, jargon expliqué"
- **Dimension `toneAxioniaAlignment`** : couvre indirectement les nuances ("Pas de magique/révolutionnaire")
- Tests : 11 cas couverts dans `reviewer/__tests__/llm-judge.spec.ts`

### 8. SEO Score déterministe /100 — ACTIF (critère word count)
**Fichier** : `axionia/src/server/content-gen/quality/seo-score.ts:126-135`

- `scoreWordCount()` : seuil 800 mots (article), 2000 mots (guide), 1500 (landing)
- Contribue à `qualityScore` mais ne mesure pas la diversité lexicale

### 9. Soft-404 Gate — ACTIF
**Fichier** : `axionia/src/server/content-gen/quality/soft-404-gate.ts:76-94`

- Seuil 350 mots par défaut, 280 mots avec LocalBusiness JSON-LD complet + cas concret
- Bonus FAQ ≥ 4 items = +50 mots équivalents
- Anti-doorway HCU 2024-2026 (thin content)

### 10. Monitoring similarité titres — ACTIF (cron quotidien)
**Fichier** : `axionia/src/server/queue/workers/content-similarity-monitor-worker.ts`

- Cron 04:30 UTC, scan 2000 derniers articles publiés (30 jours)
- Jaccard tokens O(n²) sur titres, seuil 0.5
- Top 100 paires stockées dans `ContentGenConfig.similarity_pairs`
- **Limitation** : Jaccard sur titres uniquement, pas sur le body complet

---

## Métriques absentes — recommandations

### [P0] TTR (Type-Token Ratio) — Lexical Diversity absente
**Impact** : 0/8 pts — Risque texte répétitif non détecté  
**Problème** : Aucun module ne calcule le ratio types/tokens. Un texte qui répète 50 fois "IA" et "solution" passe toutes les gates actuelles.  
**Fichier absent** : `axionia/src/server/content-gen/quality/lexical-diversity.ts` (inexistant)  
**Cible** : TTR > 0.70 pour texte vivant (en dessous = répétitif)

**Implémentation suggérée** (no-dependency, pure TS) :
```typescript
// axionia/src/server/content-gen/quality/lexical-diversity.ts
export interface LexicalDiversityResult {
  readonly ttr: number;           // type-token ratio [0,1]
  readonly tokenCount: number;
  readonly typeCount: number;
  readonly overusedWords: ReadonlyArray<{ word: string; count: number; ratio: number }>;
  readonly passed: boolean;
}

const OVERUSE_THRESHOLD = 0.03; // >3% du total = sur-utilisé
const FLAGGED_WORDS = ["ia", "intelligence artificielle", "solution", "digital", "innovation", "optimiser"];
const TTR_MIN = 0.70;

export function computeLexicalDiversity(text: string): LexicalDiversityResult {
  const tokens = text.toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(w => w.length >= 3);
  
  const tokenCount = tokens.length;
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const typeCount = freq.size;
  const ttr = tokenCount > 0 ? typeCount / tokenCount : 0;

  const overusedWords = [...freq.entries()]
    .filter(([word, count]) => 
      count / tokenCount > OVERUSE_THRESHOLD || FLAGGED_WORDS.includes(word)
    )
    .map(([word, count]) => ({ word, count, ratio: count / tokenCount }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { ttr, tokenCount, typeCount, overusedWords, passed: ttr >= TTR_MIN };
}
```
**Librairie alternative** : `natural` (npm) — `natural.WordTokenizer` + `.stem()` pour TTR avec stemming.

---

### [P0] Variation longueur des phrases (stddev) — absente
**Impact** : 0/6 pts  
**Problème** : `readability.ts:67` expose `avgWordsPerSentence` mais pas l'écart-type ni la distribution. Un texte avec 20 phrases de 20 mots chacune est aussi "monotone" qu'un texte répétitif mais score identique.  
**Cible** : écart-type longueur phrases > 5 mots (diversité narrative)

**Implémentation à ajouter dans `readability.ts`** :
```typescript
// Ajouter dans ReadabilityResult :
readonly sentenceLengthStddev: number;
readonly longSentencesRatio: number; // ratio phrases > 40 mots

// Ajouter dans computeReadabilityFr() :
const sentenceLengths = sentences.map(s => 
  s.split(/\s+/).filter(w => w.length > 0).length
);
const mean = sentenceLengths.reduce((s, n) => s + n, 0) / sentenceLengths.length;
const variance = sentenceLengths.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / sentenceLengths.length;
const sentenceLengthStddev = Math.sqrt(variance);
const longSentencesRatio = sentenceLengths.filter(n => n > 40).length / sentenceLengths.length;
```

---

### [P0] Détection voix passive — absente
**Impact** : 0/6 pts  
**Problème** : Aucun module ne détecte les constructions passives FR ("est effectué", "ont été mis en place", "sera réalisé"). Cible : voix passive < 20% des phrases.

**Implémentation suggérée** :
```typescript
// Regex patterns FR voix passive (heuristique — non exhaustif)
const PASSIVE_PATTERNS = [
  /\b(est|sont|était|étaient|sera|seront|a été|ont été|avait été|auraient été)\s+\w+[ée]s?\b/gi,
  /\b(se\s+trouve|se\s+trouvent)\s+\w+[ée]s?\b/gi,
];

export function detectPassiveVoice(text: string): { ratio: number; count: number } {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const passiveCount = sentences.filter(s => 
    PASSIVE_PATTERNS.some(p => p.test(s))
  ).length;
  return { 
    ratio: sentences.length > 0 ? passiveCount / sentences.length : 0, 
    count: passiveCount 
  };
}
```
**Librairie alternative** : `compromise` (npm) — `nlp(text).verbs().toPassive().out('array')` (EN uniquement ; pour FR : `compromise-fr` plugin).

---

### [P1] Overuse vocabulaire "IA" / mots-clés brand — absent
**Impact** : 0/6 pts  
**Problème** : Aucun check sur la densité des mots "IA", "intelligence artificielle", "solution" dans le corps. Doctrine-check bannit les phrases hype mais pas la sur-densité lexicale.  
**Intégration suggérée** : ajouter dans `computeLexicalDiversity()` (voir P0 TTR) un sous-score `overusedBrandWords` retourné avec le `ReadabilityResult`.

---

### [P1] Cohérence inter-sections (transitions H2) — absente
**Impact** : 0/8 pts  
**Problème** : Aucun check automatique sur les ruptures thématiques entre sections H2. `guide-pilier.ts` génère des sections séquentielles mais ne vérifie pas la continuité narrative. Audit A03 F17.  
**Solution immédiate (LLM-judge)** : la dimension `depth` du LLM-judge couvre partiellement ("Va au-delà des généralités ? Apporte exemples concrets, étapes précises ?") mais sans ciblage section→section.  
**Solution complète (P2)** : embeddings cosine entre `bodyText[section_N]` et `bodyText[section_N+1]`, seuil < 0.4 = rupture thématique.

---

### [P1] Rappel keyword principal dans les 100 derniers mots — absent
**Impact** : 0/6 pts  
**Problème** : `seo-score.ts:87-101` vérifie la présence du keyword dans title, H1, et body (3+ occurrences totales) mais pas spécifiquement dans la **conclusion** (100 derniers mots).

**Implémentation à ajouter dans `seo-score.ts`** :
```typescript
function scoreKeywordInConclusion(bodyText: string, kw: string | undefined): { got: number; reason?: string } {
  if (!kw) return { got: 0, reason: "primaryKeyword absent" };
  const words = bodyText.split(/\s+/).filter(w => w.length > 0);
  const last100 = words.slice(-100).join(" ").toLowerCase();
  return last100.includes(kw.toLowerCase())
    ? { got: 6 }
    : { got: 0, reason: `Keyword '${kw}' absent des 100 derniers mots (conclusion)` };
}
```

---

### [P1] Détection contradictions internes — absente
**Impact** : 0/6 pts  
**Problème** : Aucun module ne détecte les contradictions intra-article (ex : "ROI +40%" en section 2, "ROI +20%" en section 5).  
**Solution réaliste** : déléguer au LLM-judge (dimension `factualAccuracy`) — le reviewer Claude Sonnet est le bon outil pour ce type de détection sémantique. La rubrique actuelle couvre "Affirmations chiffrées défendables" mais pas explicitement les contradictions internes.  
**Action** : enrichir le `JUDGE_SYSTEM_PROMPT` (`llm-judge.ts:85`) avec un item dans `factual_accuracy` : "Y a-t-il des contradictions numériques internes (même métrique citée avec 2 valeurs différentes) ?"

---

### [P2] Ratio counterfactual / nuances — partiellement couvert par LLM-judge
**Impact** : 5/15 pts (partiel)  
**Ce qui existe** : LLM-judge `toneAxioniaAlignment` évalue "Ton consultatif précis sans sur-promesses. Pas de magique/révolutionnaire." et `depth` évalue la profondeur. Ces deux dimensions couvrent **indirectement** l'exigence de nuances.  
**Ce qui manque** : aucune détection algorithmique du wording conditionnel ("dans la plupart des cas", "selon le contexte", "il convient de", "certains cas"). Aucun compteur de nuances par 500 mots.

**Implémentation suggérée** :
```typescript
const CONDITIONAL_PATTERNS = [
  /\bdans (la plupart|certains) des cas\b/gi,
  /\bselon (le contexte|les situations|votre)\b/gi,
  /\bil convient de\b/gi,
  /\bpeut (varier|dépendre)\b/gi,
  /\bsous réserve\b/gi,
  /\ben général\b/gi,
  /\bcela dit\b/gi,
  /\btoutefois\b/gi,
  /\bnéanmoins\b/gi,
  /\ben revanche\b/gi,
];

export function countCounterfactuals(text: string): { count: number; per500Words: number; passed: boolean } {
  const matches = CONDITIONAL_PATTERNS.reduce((n, re) => n + (text.match(re)?.length ?? 0), 0);
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const per500 = wordCount > 0 ? (matches / wordCount) * 500 : 0;
  return { count: matches, per500Words: Number(per500.toFixed(2)), passed: per500 >= 1 };
}
```

---

## Sample analysis (articles disponibles dans le repo)

**Note** : Les fichiers HTML dans `_AUDIT/E2E-ROUTES-2026-05-15/agent2-html-raw/` retournent "no available server" (snapshot d'une session Coolify down du 2026-05-15). Aucun article généré en prod n'est disponible en statique dans le repo. Aucune fixture d'article dans `content-gen/generators/__tests__/`. L'analyse manuelle se base donc sur le code des générateurs et leurs tests.

### Sample A : Article de test `quality.spec.ts` — "Audit IA pour cabinets comptables"
**Source** : `axionia/src/server/content-gen/quality/__tests__/quality.spec.ts:62-86`

Texte test : title "Audit IA pour cabinets comptables : 5 cas d'usage 2026", body ~550 mots (lorem ipsum + keywords)

**Analyse qualité textuelle (via les modules existants)** :
- Flesch-Kincaid FR : `computeReadabilityFr(directAnswer)` → "L'audit IA en cabinet comptable identifie en 5 jours les workflows..." (49 mots) = score estimé 55-65 (standard → acceptable B2B)
- SEO Score sur ce test : ≥ 80/100 (confirmé par `expect(result.score).toBeGreaterThanOrEqual(80)`)
- Plagiarism : body = "audit IA cabinet comptable " × 3 + lorem ipsum → TTR estimé ~0.15 (très bas — texte test, pas représentatif prod)
- Lexical diversity : **non mesurée** → P0 gap confirmé

**Métriques manquantes sur cet échantillon** :
- TTR impossible à calculer (lorem ipsum = bruit artificiel)
- Voix passive : non détectable avec les outils actuels
- Counterfactual : 0 occurrence détectable dans l'extrait (directAnswer = statement factuel pur)

### Sample B : Système de prompts `JUDGE_SYSTEM_PROMPT` — Rubric LLM-judge
**Source** : `axionia/src/server/content-gen/reviewer/llm-judge.ts:85-131`

Le prompt reviewer décrit les 7 dimensions dont 3 couvrent des aspects textuels mesurables :
- `readability` (dim 4) : "Phrases courtes, structure h2/h3 logique, paragraphes <4 lignes, jargon expliqué" → couvre sentence length subjectivement
- `originality` (dim 3) : "Pas du copy-paste ChatGPT générique" → couvre TTR et diversité subjectivement
- `toneAxioniaAlignment` (dim 7) : "Pas de magique/révolutionnaire" → couvre counterfactual implicitement

**Verdict** : Le LLM-judge compensent partiellement l'absence de métriques algorithmiques sur TTR, variation phrases, et counterfactual. Mais à ~$0.04/article, son déclenchement reste conditionnel (`quality_improving` status) — les articles qui passent le gate inline (score ≥ 75 au premier essai) ne sont **jamais** passés par le LLM-judge. Gap structurel.

---

## Synthèse des gaps prioritaires

| Priorité | Métrique absente | Module suggéré | Effort | Impact score |
|----------|-----------------|----------------|--------|-------------|
| P0 | TTR type-token ratio | `lexical-diversity.ts` (nouveau) | 2h | +8 pts |
| P0 | Stddev longueur phrases | Ajouter dans `readability.ts` | 1h | +6 pts |
| P0 | Détection voix passive FR | Ajouter dans `readability.ts` | 3h | +6 pts |
| P1 | Keyword dans conclusion | Ajouter dans `seo-score.ts` | 30min | +6 pts |
| P1 | Overuse mots-clés brand | Dans `lexical-diversity.ts` | inclus P0 | +6 pts |
| P1 | Cohérence inter-sections | Déléguer LLM-judge (enrichir rubric) | 1h | +8 pts |
| P2 | Wording conditionnel | `counterfactuals.ts` (nouveau) | 2h | +7 pts |
| P2 | Contradictions internes | Enrichir `JUDGE_SYSTEM_PROMPT` | 30min | +6 pts |

**Activation cosine embeddings** (seuil 0.85 déjà documenté) : `OPENAI_EMBEDDINGS_ENABLED=true` → ajoute 5 pts originalité immédiatement.

---

## État activation en prod des modules existants

| Module | Code prêt | Activé prod | Seuil documenté | Log rejet |
|--------|-----------|-------------|-----------------|-----------|
| Flesch-Kincaid FR | ✅ | ✅ | 60-70 idéal-b2b | Partiel (qualityScore) |
| Levenshtein dédup | ✅ | ✅ | 0.85 | ✅ (reason + matchedJobId) |
| Outline SimHash | ✅ | ✅ | Hamming ≤ 4 BLOCK | ✅ (verdict reason) |
| Jaccard shingling | ✅ | Partiel | 0.30 interne / 0.10 RSS | ❌ absent |
| Cosine embeddings | ✅ | ❌ (flag OFF) | 0.85 documenté | ❌ |
| Topic fingerprint | Stub null | ❌ | ≤ 8 Hamming | ❌ |
| LLM-judge 7 dim | ✅ | ✅ (B.8) | 8.5 publish / 7.0 improve | ✅ logStep |
| TTR diversity | ❌ absent | ❌ | — | — |
| Voix passive FR | ❌ absent | ❌ | — | — |
| Stddev longueur | ❌ absent | ❌ | — | — |
| Counterfactuals | ❌ absent | ❌ | — | — |

---

## Références fichiers

| Fichier | Lignes clés | Rôle |
|---------|------------|------|
| `axionia/src/server/content-gen/quality/readability.ts` | 49-82 | Flesch-Kincaid FR — actif |
| `axionia/src/server/content-gen/quality/dedup-guard.ts` | 48-196, 230-301 | Levenshtein + outline simhash |
| `axionia/src/server/content-gen/quality/plagiarism.ts` | 38-84 | Jaccard 5-gram |
| `axionia/src/server/content-gen/dedup/embedding-similarity.ts` | 22, 39-67 | Cosine seuils (0.85 / 0.80) |
| `axionia/src/server/content-gen/dedup/openai-embedder.ts` | 63-149 | OpenAI embedder (flag OFF) |
| `axionia/src/server/content-gen/dedup/outline-simhash.ts` | 133-175, 203-238 | SimHash 64-bit + seuils Hamming |
| `axionia/src/server/content-gen/dedup/topic-fingerprint.ts` | 72-87 | Stub Voyage AI (null) |
| `axionia/src/server/content-gen/reviewer/llm-judge.ts` | 85-131, 204-262 | LLM-judge 7 dim + verdict déterministe |
| `axionia/src/server/content-gen/quality/doctrine-check.ts` | 49-63 | Ratio Axion-IA-centric (word freq) |
| `axionia/src/server/content-gen/quality/soft-404-gate.ts` | 76-94 | Gate word count anti-doorway |
| `axionia/src/server/queue/workers/content-quality-improver-worker.ts` | 153-191 | Intégration LLM-judge |
| `axionia/src/server/queue/workers/content-similarity-monitor-worker.ts` | 56-141 | Cron Jaccard pairs monitoring |

---

*Audit A4-02 complet — 2026-05-21 — AUDIT-ONLY STRICT*

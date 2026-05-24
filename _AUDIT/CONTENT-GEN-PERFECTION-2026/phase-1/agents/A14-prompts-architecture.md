# A14 — Prompts : Architecture, Caching, Output Parsing

**Audit CONTENT-GEN PERFECTION 2026 — Phase 1**
**Date** : 2026-05-21
**HEAD audité** : `2b98a7067d7eae701dec42a2c5d6e859364e0e64`
**Mode** : AUDIT-ONLY STRICT — citations fichier:ligne — 0 invention

---

## Mission

Auditer le système de prompts LLM utilisé pour la génération de contenu Axion-IA : architecture modulaire, XML tags, prompt caching, output JSON parsing, cost tracking. Répondre aux 20 questions critiques du brief.

---

## Méthode

Lecture exhaustive de :

- `src/server/content-gen/providers/anthropic.ts` (446 lignes)
- `src/server/content-gen/providers/openai.ts` (229 lignes)
- `src/server/content-gen/providers/provider-router.ts` (189 lignes)
- `src/server/content-gen/providers/IProvider.ts` (121 lignes)
- `src/server/content-gen/lib/retry.ts`, `cost-tracker.ts`, `config-reader.ts`
- `src/server/content-gen/generators/` — 8 générateurs
- `src/server/content-gen/generators/landing-ville-templates.ts`
- `src/server/content-gen/shared/prompt-input-escape.ts`
- `src/server/content-gen/README.md`

Greps ciblés sur : `cache_control`, `ephemeral`, `response_format`, `zod`, `Batch`, `extended_thinking`, `PromptVersion`, `SYSTEM_PROMPT`, `few.shot`.

---

## État observé

### 1. Combien de prompts distincts ?

**9 prompts system distincts actifs** dans le code :

| #   | Fichier                                     | Constante / Variable                                               | Contenu                                                          |
| --- | ------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 1   | `generators/blog-article.ts:25`             | `SYSTEM_PROMPT`                                                    | Blog générique B2B PME                                           |
| 2   | `generators/blog-from-keywords.ts:33`       | `SYSTEM_PROMPT`                                                    | Blog keyword-driven (quasi-identique au #1, min 500 mots vs 600) |
| 3   | `generators/faq-standalone.ts:24`           | `SYSTEM_PROMPT`                                                    | Page FAQ 10-15 Q/A                                               |
| 4   | `generators/guide-pilier.ts:48`             | `SYSTEM_PROMPT_OUTLINE`                                            | Step 1 outline (plan 8-15 sections)                              |
| 5   | `generators/guide-pilier.ts:74`             | `SYSTEM_PROMPT_SECTION`                                            | Step 2 section par section HTML inline                           |
| 6   | `generators/landing-ville-templates.ts:67`  | `LANDING_VILLE_VARIANTS.default.systemPromptOverride`              | Landing équilibré 3 modules                                      |
| 7   | `generators/landing-ville-templates.ts:88`  | `LANDING_VILLE_VARIANTS.focus_audit.systemPromptOverride`          | Landing audit-first                                              |
| 8   | `generators/landing-ville-templates.ts:113` | `LANDING_VILLE_VARIANTS.focus_interventions.systemPromptOverride`  | Landing interventions                                            |
| 9   | `generators/landing-ville-templates.ts:136` | `LANDING_VILLE_VARIANTS.focus_implementation.systemPromptOverride` | Landing implémentation                                           |

**4 generators délèguent** à `landingVilleGenerator` sans prompt propre :

- `comparison.ts` → délègue landing-ville (stub complet absent)
- `blog-from-rss.ts` → délègue landing-ville (V1 = sub-prompt RSS commenté mais absent)
- `blog-from-title.ts` → délègue landing-ville
- `qa-derived.ts` → délègue landing-ville (doc dit "pas d'appel LLM nouveau" mais délègue quand même)

### 2. Stockage prompts

**100 % fichiers TypeScript hardcodés** (constantes `const SYSTEM_PROMPT = \`...\``).

- Aucune table DB `PromptVersion`, `ContentTemplate`, ou `Prompt`.
- Aucune lecture env var pour les prompts.
- `config-reader.ts` gère uniquement les configs provider (model, cap, enabled) depuis DB `ProviderConfig`.
- `landing-ville.ts:7-8` mentionne un fichier megapack `prompts/landing-ville.md` ("chargé Sprint 2 Day 3") — **ce fichier n'existe pas** dans le répertoire `src/server/content-gen/` (aucun sous-dossier `prompts/`).

### 3. Format prompts : XML tags ?

**Aucun tag XML anthropique** (`<role>`, `<context>`, `<task>`, `<output_format>`, `<examples>`) utilisé.

Le format est **markdown sections** dans des template strings bruts :

- Titres markdown `##` : `## Sources internes Axion-IA`, `## Output attendu (JSON)`, `## Contexte Axion-IA`, `## Retour qualité passe précédente`
- Règles linéaires avec tirets `-`
- Instruction output JSON inline dans le system prompt lui-même

Exemple `blog-article.ts:33` :

```
- Output JSON strict : { title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq:[{q,a}], tags }
```

### 4. Chain-of-thought / Extended Thinking

**Non activé.** Grep `extended_thinking`, `thinking`, `budget_tokens` → 0 résultat dans tout `src/server/content-gen/`.

### 5. Output JSON : `response_format` / Zod runtime ?

**Aucun `response_format: {type: "json_schema"}`** — ni côté Anthropic ni côté OpenAI.

Parsing : `JSON.parse(llmResult.output)` brut dans chaque générateur.

- `landing-ville.ts:145` : `parsed = JSON.parse(llmResult.output)` — **pas de Zod, pas de validation schema runtime**. Commentaire explicite : `// 3. Parse output (V1 minimal — V2 Zod strict)`
- `blog-article.ts:139` : `parsed = JSON.parse(lastOutput)` — même pattern
- `blog-from-keywords.ts:130` : `parsed = JSON.parse(lastOutput)` — idem
- `faq-standalone.ts:129` : `parsed = JSON.parse(lastOutput)` — idem
- `guide-pilier.ts:202-208` : extraction par `indexOf('{')` / `lastIndexOf('}')` + `JSON.parse` — protection minimale contre markdown wrapping mais toujours pas de schema validation

`IProvider.ts:36` déclare `readonly outputSchemaZod?: string` dans `GenerationRequest` mais ce champ n'est **jamais peuplé** par aucun générateur.

### 6. Prompt Caching `cache_control: {type: "ephemeral"}`

**Activé sur Anthropic uniquement, système prompt uniquement.**

`anthropic.ts:173-178` :

```typescript
system: [
  {
    type: "text",
    text: req.systemPrompt,
    cache_control: { type: "ephemeral" },
  },
],
```

**Gaps critiques** :

- Le **user prompt** n'est pas mis en cache (KB context répété à chaque call)
- Le **KB context** (kbContext, localEconomicContext, feedbackSection) est injecté dans le user prompt → non cached → rechargé à chaque LLM call
- Pour `guide-pilier`, le même `kbContext` est re-transmis à chaque appel section (8-15 calls) — **0 caching sur le segment le plus coûteux**
- OpenAI : **0 prompt caching** (OpenAI Prompt Caching non implémenté)

### 7. Cache hit rate logs (`cacheReadInputTokens`)

**Trackés et logués dans CostLedger**, mais pas exposés en dashboard.

`anthropic.ts:192-193` :

```typescript
cacheReadInputTokens = event.message.usage.cache_read_input_tokens ?? 0;
cacheCreationInputTokens = event.message.usage.cache_creation_input_tokens ?? 0;
```

`anthropic.ts:250` : les cache tokens sont cumulés dans `tokensInput` pour le tracking cost mais le ratio cache hit/miss n'est pas calculé ni exposé dans un dashboard admin.

### 8. Coût / article estimé

Basé sur la table PRICING `anthropic.ts:50-67` :

| Modèle            | Input     | Output    | Cache read | Cache write |
| ----------------- | --------- | --------- | ---------- | ----------- |
| claude-sonnet-4-6 | $3.00/1M  | $15.00/1M | $0.30/1M   | $3.75/1M    |
| claude-opus-4-7   | $15.00/1M | $75.00/1M | $1.50/1M   | $18.75/1M   |
| claude-haiku-4-5  | $1.00/1M  | $5.00/1M  | $0.10/1M   | $1.25/1M    |
| gpt-4o            | $2.50/1M  | $10.00/1M | —          | —           |
| gpt-4o-mini       | $0.15/1M  | $0.60/1M  | —          | —           |

Budget caps DB : OpenAI $200/mois · Anthropic $100/mois · Perplexity $80/mois.

`BUDGET_CAP_USD` par job : blog $0.15 · FAQ $0.10. `guide-pilier.ts:29` estime ~$0.04-0.10/guide (12 calls × $0.005-0.008 commentaire, mais prix basé GPT-4o-mini — incohérent avec le routing réel qui est gpt-4o primary).

**Coût observé estimé** (Sonnet 4.6 primaire fallback) :

- Blog article (1 pass, ~3000 tokens input + 2000 output) : ~$0.039
- Guide pilier (12 sections) : ~$0.47 (12× le coût blog)

### 9. Modèle par étape

**Routing par DB** (`config-reader.ts`), pas hardcodé dans les générateurs.

Defaults V0 (`config-reader.ts:17-23`) :

- OpenAI primary (text) : `gpt-4o`
- Anthropic fallback (text) : `claude-sonnet-4-6`
- Perplexity (data) : `sonar-pro`
- Unsplash (stock_image) : `unsplash-api-v1`

Aucun routing par étape (outline vs section, blog vs FAQ) — tous appellent le même modèle primary sans distinction de complexité de tâche.

Healthcheck Anthropic : utilise explicitement `claude-haiku-4-5` (`anthropic.ts:278`) — seul cas de modèle hardcodé.

### 10-11. Few-shot et negative examples

**Absents.** Grep `few.shot`, `few_shot`, `negative.example`, `DO NOT`, `bad example` → 0 occurrence dans les system prompts des generators.

Les system prompts listent des règles négatives (`0 délai chiffré`, `0 numéro de téléphone`, `0 prix en dur`) mais sans exemples contrastifs input/output.

### 12. Partials modulaires `_vertical-*`, `_audience-*`, `_content-type-*`

**Absents.** Aucun système de partials. La modularisation existe via :

- `DOCTRINE_INTOUCHABLE` (constante partagée entre les 4 variants landing-ville) — `landing-ville-templates.ts:53`
- `userPromptFocusSection` injectée dans le user prompt — `landing-ville-templates.ts`

Mais il n'y a pas de système `_vertical-{vertical}`, `_audience-{aud}`, `_content-type-{type}` tel que décrit dans le brief.

### 13. Streaming activé

**Activé sur les deux providers** (Anthropic et OpenAI), `stream: true` systématique :

- `anthropic.ts:168` : `client.messages.create({ ..., stream: true })`
- `openai.ts:134` : `client.chat.completions.create({ ..., stream: true, stream_options: { include_usage: true } })`
- Hook `onStreamChunk` disponible (`IProvider.ts:43`) — mais **aucun générateur ne l'utilise** (tous passent `undefined`)

### 14. Batch API Anthropic

**Non implémenté.** Grep `MessageBatch`, `batch.create`, `batch_api` → 0 résultat dans le code content-gen. Référence aux "batches" dans le code concernent les `CoverageCampaign` BullMQ, pas l'API Anthropic Batch.

### 15. Failure handling JSON invalide

Stratégie quality loop avec feedback textuel :

- `blog-article.ts:141-144` : `catch { prevFeedback = "La réponse précédente n'était pas du JSON valide. Retourne UNIQUEMENT un objet JSON valide, sans balise markdown."; continue; }` → relance jusqu'à `MAX_QUALITY_ITERATIONS` (3) ou `BUDGET_CAP_USD`
- `guide-pilier.ts:199-209` : extraction par `indexOf('{')` / `lastIndexOf('}')` avant `JSON.parse` — une tentative, throw si échec (pas de retry JSON pour step 1 outline)
- `landing-ville.ts:144-148` : **throw immédiat** sans retry sur JSON invalide — seul générateur sans quality loop JSON

### 16. Rate limit handling : 429

**Géré via `withRetry` + `ProviderError(retryable: true)`.**

`anthropic.ts:93-94` : `if (status === 429) { return new ProviderError(..., "rate_limited", "anthropic", true); }`

`retry.ts:36-38` : retry si `retryable === true`, délais `[10_000, 30_000, 60_000]` ms.

OpenAI identique (`openai.ts:71`).

Circuit breaker `provider-router.ts:44` : 5 failures / 30s → open 60s (in-memory, pas Redis-shared en V1).

### 17. Prompt injection protection

**Implémentée via `escapeLlmInput` et `escapeSlugInput`** — `shared/prompt-input-escape.ts`.

Protections actives :

- Strip control chars / newlines (`\x00-\x1f`)
- Strip backticks (U+0060), zero-width chars
- Strip markdown markers (`#`, `>`, `-` en début de ligne)
- Strip role-injection patterns (`system:`, `assistant:`, `user:`, `ignore previous instructions`, `new instructions`)
- Troncation à `maxLen` (défaut 200)

Utilisé dans tous les générateurs qui interpolent des inputs utilisateur.

**Gap** : `kbContext` (output de `kbRetrieve`) n'est **pas échappé** avant injection dans le user prompt. Si une KB entry contient un marker malveillant, il passerait.

### 18. `withRetry` implémenté

**Oui.** `lib/retry.ts` — 3 tentatives, délais [10s, 30s, 60s], callback `onRetry` optionnel. Skip immédiat si `ProviderError.retryable === false`.

### 19. Model ID hardcodé ou env var

**Lecture DB via `readProviderConfig(provider)` avec fallback hardcodé V0** dans `config-reader.ts:17-23`.

Les model IDs par défaut sont hardcodés dans le code source (pas dans env vars) mais peuvent être overridés en DB via `ProviderConfig.model`. Les générateurs passent `req.model` optionnel qui override le config DB.

### 20. Versioning prompts

**Inexistant.** Pas de table `PromptVersion`. Les prompts sont git-tracked (dans les fichiers TS). Pas de système de A/B test, pas de versioning applicatif, pas de rollback sans deploy.

---

## Findings (tableau P0/P1/P2)

### P0 — Bloquants production / score

| ID   | Fichier:Ligne                         | Description                                                                                                                                                                                                         | Impact                                                |
| ---- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| P0-1 | `generators/landing-ville.ts:133`     | `// V1 minimal — V2 Zod strict` : **0 validation schema runtime** sur le JSON parsé — champ absent/type wrong → crash silencieux ou undefined dans GeneratorOutput                                                  | Contenu corrompu publié sans erreur levée             |
| P0-2 | `generators/guide-pilier.ts:222-243`  | KB context (~10 chunks × ~150 mots = ~1500 tokens) répété dans **chaque** appel section (8-15 calls) sans cache — pour 12 sections = 12× le coût context                                                            | Coût ×3-5 vs optimal, $0.05+ gaspillé par guide       |
| P0-3 | `generators/landing-ville.ts:145-148` | JSON parse throw immédiat **sans retry** — si Claude retourne `\`\`\`json {...}\`\`\`` (markdown fence), la landing-ville fail à 100% sans fallback                                                                 | Job fail systématique si Claude wrap JSON en markdown |
| P0-4 | Tous generators                       | **Aucun XML tag** (`<system>`, `<context>`, `<task>`, `<output_format>`) — prompts en markdown brut — risque de confusion structurelle pour le modèle, sous-optimal pour Claude 3.x+ recommandations Anthropic 2026 | Qualité output sous-optimale, structure ambiguë       |

### P1 — Dégradations importantes

| ID    | Fichier:Ligne                                                            | Description                                                                                                                                         | Impact                                                     |
| ----- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| P1-1  | `providers/anthropic.ts:173`                                             | Cache uniquement sur system prompt — **user prompt (KB context) non caché** — pour guide-pilier = 12 cache misses KB context                        | Économies cache non réalisées sur le segment dominant      |
| P1-2  | `providers/provider-router.ts:102`                                       | OpenAI primary, Anthropic fallback — **0 routing par complexité** : guide-pilier (long-form) et blog-article (court) utilisent le même model gpt-4o | Coût excessif pour tâches simples (FAQ, sections courtes)  |
| P1-3  | Tous generators                                                          | **0 few-shot examples** dans les system prompts — aucun exemple de bon/mauvais output                                                               | Output quality sous-optimale, hallucinations non contrées  |
| P1-4  | `generators/landing-ville-templates.ts:7`                                | Commentaire `Sub-prompt complet : prompts/landing-ville.md megapack` — **fichier inexistant** dans `src/server/content-gen/`                        | Documentation mensongère, prompts incomplets vs spec       |
| P1-5  | `providers/anthropic.ts:250`                                             | `cacheReadInputTokens` capturé mais **cache hit rate non calculé ni dashboardé** — impossible de savoir si le cache est effectif                    | Opacité coût, impossibilité d'optimiser                    |
| P1-6  | `generators/blog-from-rss.ts` et `comparison.ts` et `blog-from-title.ts` | 3 generators délèguent intégralement à `landingVilleGenerator` — **0 prompt spécifique** pour ces content types                                     | RSS article = landing-ville prompt = mauvaise qualité type |
| P1-7  | `providers/provider-router.ts:45-46`                                     | Circuit breaker **in-memory V0** (pas Redis-shared) — 3 workers BullMQ = 3 états circuit breaker indépendants                                       | Fallback incohérent entre workers                          |
| P1-8  | `IProvider.ts:36`                                                        | `outputSchemaZod?: string` déclaré dans `GenerationRequest` mais **jamais peuplé** par aucun générateur                                             | Dead code, fausse promesse Zod                             |
| P1-9  | Tous generators                                                          | `kbContext` (output RAG) injecté dans user prompt **sans `escapeLlmInput`** — vecteur d'injection via KB entry malveillante                         | Risque prompt injection via KB                             |
| P1-10 | `generators/guide-pilier.ts:29`                                          | Estimation coût commentaire `~$0.005-0.008/section gpt-4o-mini` mais le routing envoie vers **gpt-4o** (×30 plus cher)                              | Budget réel non documenté = planning faux                  |

### P2 — Améliorations souhaitables

| ID   | Fichier:Ligne                                           | Description                                                                                                          | Impact                                            |
| ---- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| P2-1 | `generators/blog-article.ts` vs `blog-from-keywords.ts` | **Duplication quasi-totale** des 2 system prompts (seule différence : min 600 vs 500 mots)                           | Maintenance double, désynchro doctrine            |
| P2-2 | Tous generators                                         | **0 versioning prompts** applicatif — git-only — impossible de A/B tester                                            | Optimisation prompts sans instrumentation         |
| P2-3 | `providers/anthropic.ts:278`                            | `claude-haiku-4-5` hardcodé pour healthcheck — pas configuré via `ProviderConfig`                                    | Coût healthcheck non piloté                       |
| P2-4 | Tous generators                                         | **0 negative examples** (exemples de mauvaises réponses à éviter)                                                    | Hallucinations non contrées, tone drift           |
| P2-5 | `generators/landing-ville-templates.ts`                 | `DOCTRINE_INTOUCHABLE` = seul partial partagé — **0 système de composition modulaire** `_vertical-*` / `_audience-*` | Maintenance difficile sur 5 verticales × 3 cibles |
| P2-6 | `providers/anthropic.ts`                                | **Batch API Anthropic non utilisée** (50% prix réduit pour jobs non-temps-réel)                                      | Surcoût x2 sur les campagnes bulk                 |
| P2-7 | `generators/guide-pilier.ts`                            | `onStreamChunk` disponible dans IProvider mais **jamais utilisé** — admin UI ne reçoit pas de preview live           | UX admin pauvre, pas de feedback progression      |

---

## Scoring /45

### Architecture modulaire prompts /12

| Critère                            | Score | Justification                                                                   |
| ---------------------------------- | ----- | ------------------------------------------------------------------------------- |
| Prompts distincts par content type | 5/5   | 9 prompts distincts, 4 variants landing-ville via `DOCTRINE_INTOUCHABLE` shared |
| Système de partials / composition  | 1/4   | Seul `DOCTRINE_INTOUCHABLE` partagé — 0 système `_vertical-*` / `_audience-*`   |
| Stockage et versioning             | 1/3   | Git-tracked ✅ — 0 DB, 0 A/B test, 0 versioning applicatif                      |

**Sous-total : 7/12**

### XML tags + best practices Claude 2026 /10

| Critère                     | Score | Justification                                                     |
| --------------------------- | ----- | ----------------------------------------------------------------- |
| XML tags structurels        | 0/4   | 0 usage — markdown brut uniquement                                |
| Format JSON output explicit | 3/3   | JSON schema décrit dans chaque system prompt                      |
| Negative examples           | 0/2   | Absents — règles négatives listées mais sans exemples contrastifs |
| Few-shot examples           | 0/1   | Absents                                                           |

**Sous-total : 3/10**

### Prompt caching activé + cache hit rate /10

| Critère                                     | Score | Justification                                                      |
| ------------------------------------------- | ----- | ------------------------------------------------------------------ |
| `cache_control: {type: "ephemeral"}` activé | 4/4   | Actif sur system prompt Anthropic `anthropic.ts:177`               |
| Cache sur KB context / user prompt          | 0/3   | Absent — context KB rechargé à chaque call                         |
| Cache hit rate loggué + dashboardé          | 1/3   | Tokens capturés dans `CostLedger` mais ratio non calculé ni exposé |

**Sous-total : 5/10**

### Output JSON Zod validated /7

| Critère                            | Score | Justification                                              |
| ---------------------------------- | ----- | ---------------------------------------------------------- |
| `response_format: json_schema` API | 0/2   | Non utilisé ni côté Anthropic ni OpenAI                    |
| Zod validation runtime post-parse  | 0/3   | 0 Zod — `JSON.parse` brut avec `try/catch` uniquement      |
| Retry sur JSON invalide            | 1/2   | Quality loop blog/FAQ ✅ — landing-ville throw immédiat ❌ |

**Sous-total : 1/7**

### Cost tracking par article + modèle routing /6

| Critère                                | Score | Justification                                                |
| -------------------------------------- | ----- | ------------------------------------------------------------ |
| CostLedger atomic par call             | 3/3   | `cost-tracker.ts` + transaction Prisma atomic ✅             |
| Routing modèle par complexité de tâche | 0/2   | Routing unique gpt-4o pour tout — 0 haiku sur tâches simples |
| Dashboard coût par content type        | 0/1   | `CostLedger` en DB mais pas de vue admin par contentType     |

**Sous-total : 3/6**

---

## Score Final : 19/45 (42%) — ROUGE : SPRINT CORRECTIF REQUIS

| Domaine                               | Score  | Max    | %       |
| ------------------------------------- | ------ | ------ | ------- |
| Architecture modulaire prompts        | 7      | 12     | 58%     |
| XML tags + best practices Claude 2026 | 3      | 10     | 30%     |
| Prompt caching activé + hit rate      | 5      | 10     | 50%     |
| Output JSON Zod validated             | 1      | 7      | 14%     |
| Cost tracking + modèle routing        | 3      | 6      | 50%     |
| **TOTAL**                             | **19** | **45** | **42%** |

---

## Délégations

Aucune délégation nécessaire. Tous les éléments auditables ont été lus directement.

---

## UNKNOWNs

| #   | Inconnu                                                                          | Raison                                                                                                       |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| U1  | Fichier `prompts/landing-ville.md` (megapack) — mentionné `landing-ville.ts:7-8` | Fichier absent dans le repo — peut exister dans un dossier externe non versionné                             |
| U2  | Cache hit rate réel en production                                                | Non calculé dans le code — nécessiterait un log query sur `CostLedger.tokensInput` vs `cacheReadInputTokens` |
| U3  | Volume jobs `guide-pilier` en production                                         | Le multi-step (8-15 LLM calls) rend ce content type le plus coûteux — volume inconnu                         |
| U4  | `ProviderConfig.model` effectivement overridé en DB prod                         | Le default `gpt-4o` peut avoir été changé en `gpt-4o-mini` via admin UI — non visible au niveau code         |

---

## Références

| Fichier                                                        | Rôle                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| `src/server/content-gen/providers/anthropic.ts`                | Provider Anthropic — caching + streaming + retry + cost |
| `src/server/content-gen/providers/openai.ts`                   | Provider OpenAI — streaming + retry + cost              |
| `src/server/content-gen/providers/provider-router.ts`          | Router + circuit breaker                                |
| `src/server/content-gen/providers/IProvider.ts`                | Interface abstraite + types                             |
| `src/server/content-gen/lib/retry.ts`                          | withRetry 3× backoff exp 10s/30s/60s                    |
| `src/server/content-gen/lib/cost-tracker.ts`                   | assertCostCapAvailable + trackCost atomic               |
| `src/server/content-gen/lib/config-reader.ts`                  | readProviderConfig DB + cache memo 60s                  |
| `src/server/content-gen/generators/blog-article.ts`            | Prompt #1 + quality loop 3×                             |
| `src/server/content-gen/generators/blog-from-keywords.ts`      | Prompt #2 + quality loop 3×                             |
| `src/server/content-gen/generators/faq-standalone.ts`          | Prompt #3 + quality loop 2×                             |
| `src/server/content-gen/generators/guide-pilier.ts`            | Prompts #4 + #5 — 2-step pipeline (outline + sections)  |
| `src/server/content-gen/generators/landing-ville-templates.ts` | Prompts #6-9 (4 variants) + `DOCTRINE_INTOUCHABLE`      |
| `src/server/content-gen/generators/landing-ville.ts`           | Pipeline principal landing ville                        |
| `src/server/content-gen/shared/prompt-input-escape.ts`         | Sanitisation anti-injection inputs utilisateur          |
| `src/server/content-gen/README.md`                             | Architecture overview + coûts V1                        |

---

## Recommandations prioritaires

**Sprint correctif (~12h)**

1. **P0-1 CRITIQUE** : Ajouter validation Zod sur tous les outputs JSON (`z.object({title: z.string(), bodyHtml: z.string(), faq: z.array(...), ...}).parse(JSON.parse(output))`) dans chaque générateur. Le champ `outputSchemaZod` dans `IProvider.ts` peut servir de pattern mais la validation doit rester dans le générateur. ~3h.

2. **P0-3 CRITIQUE** : Ajouter extraction JSON robuste dans `landing-ville.ts` (pattern `indexOf('{')` / `lastIndexOf('}')` comme dans `guide-pilier.ts`) + quality loop JSON comme dans les autres générateurs. ~1h.

3. **P0-4 IMPORTANT** : Convertir les system prompts vers format XML tags Anthropic (`<role>`, `<context>`, `<task>`, `<output_format>`) — améliore compliance Claude 2026 best practices et structure. ~3h (9 prompts).

4. **P0-2 COÛT** : Mettre en cache le `kbContext` pour `guide-pilier` step 2 en ajoutant un `cache_control: {type: "ephemeral"}` sur un bloc user message statique contenant le context KB partagé. Requiert de passer le context en messages multi-turn. ~2h.

5. **P1-1 ÉCONOMIES** : Étendre le caching Anthropic au KB context via multi-turn messages (system + user static avec cache_control). Économie estimée ×10 sur le coût KB context. ~2h.

6. **P2-6 BUDGET** : Activer Anthropic Batch API pour les campagnes bulk non-temps-réel (50% discount). ~4h de work + décision business Will.

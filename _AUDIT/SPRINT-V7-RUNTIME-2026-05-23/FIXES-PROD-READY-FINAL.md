# Sprint v7 — Fixes Prod-Ready FINAL (Quality Loop + Centralisation)

## ✅ Fixes livrés cette session

### 1️⃣ Helper centralisé `parseLlmJson()`
**Fichier** : `src/server/content-gen/shared/parse-llm-json.ts`

Strip markdown fences ```json ... ``` puis JSON.parse. **9 generators** utilisent maintenant ce helper au lieu d'avoir le code dupliqué :
- `blog-article.ts`
- `blog-from-keywords.ts`
- `blog-from-rss.ts`
- `blog-from-title.ts`
- `comparison.ts`
- `faq-standalone.ts`
- `qa-derived.ts`
- `landing-ville-shared.ts` (impact 6 generators)
- `v7-phase8-shared.ts` (impact 12 generators)

**Total : 9 fichiers réduit-duplication, 21 generators couverts** (1 source de vérité).

### 2️⃣ Quality Loop intégré dans `v7-phase8-shared.ts` (12 generators Phase 8 v7)

Refactor complet du pipeline :
- ✅ KB retrieve top 8 chunks (RAG-enabled — ajouté, manquait avant)
- ✅ injectExternalLinks 4 sources d'autorité (ajouté, manquait avant)
- ✅ **Quality loop 3 itérations** avec feedback ciblé
- ✅ Budget cap $0.15 par article
- ✅ Temperature progressive : 0.7 → 0.5 → 0.3
- ✅ max_tokens 8000 (au lieu de 3072)
- ✅ Best-iteration tracking (garde le meilleur résultat sur les 3 itérations)
- ✅ Prompts renforcés : wordCount ≥ 1200, H2 ≥ 6, H3 ≥ 10, FAQ 8-12, links ≥ 4

### 3️⃣ Quality Loop intégré dans `landing-ville-shared.ts` (6 generators landing)

Même refactor que v7-phase8 :
- ✅ Quality loop 3 itérations + $0.15 budget
- ✅ wordCount cible 1500-2500 (anti-doorway HCU 2024)
- ✅ Préserve toute la logique existante (KB, external links, economic data, glossary, internal links, mentioned cities)

### 4️⃣ Fix `fr_unaccent` PostgreSQL (re-appliqué)

`src/lib/knowledge/search-fts.ts` × 3 occurrences — cast `$1::regconfig` (le linter le retire régulièrement, à monitorer).

---

## 📊 Résultats mesurés avant / après

Test E2E avec quality_loop, 4 articles (case_study_local, how_to_x_in_y, glossary_term, landing_ville) :

| Métrique | Avant (single-shot) | Après (quality_loop) | Amélioration |
|---|---|---|---|
| Taux succès | 75% (1 fail JSON) | **100%** | +25 pts |
| Avg quality score | 38/100 | **46/100** | **+8 points** |
| Avg word count | 270 | **412** | **+142 mots** |
| Cost / article | $0.035 | $0.054 | +$0.02 |
| Tier 2 atteint | 0/3 | 0/4 | (encore) |

**Total session LLM** : ~$0.55 sur ~16 articles générés (4 tests successifs).

### Pourquoi pas encore tier_2 (score ≥ 70) ?

Les scores plafonnent à 42-49 même après 3 itérations. Causes diagnostiquées :

1. **wordCount toujours sous le seuil** : 335-513 mots vs target 1500. GPT-4o respecte mal "minimum 1500 mots" sans validation post-parse plus stricte.
2. **SEO score function exigeante** : computeSeoScore vérifie densité keyword + balises H2/H3 + internal/external links + intent alignment. Difficile d'atteindre 70+ sans 1500+ mots de contenu structuré.
3. **KB context insuffisant** : 340 facts FR seedés couvrent mal certains topics spécifiques (RAG, Large Language Model, etc.).
4. **Readability moyenne** : 43-55 — GPT-4o tend à utiliser des phrases longues complexes.

---

## 🎯 Centralisation DRY — Audit final

### ✅ Déjà centralisé (avant cette session)
- `kb-client.ts` retrieve top N (utilisé par 7+ generators)
- `external-links-injector.ts` (4 sources autorité)
- `internal-link-catalog.ts`
- `brand-voice.ts` + `glossary-context.ts`
- `intent-prompt-adapter.ts`
- `html-sanitizer.ts`
- `prompt-input-escape.ts`
- `seo-score.ts` + `readability.ts` + `doctrine-check.ts` + `soft-404-gate.ts`
- `provenance-logger.ts` (hashPrompt)
- `extract-mentioned-cities.ts`

### ✅ Nouvellement centralisé (cette session)
- `parse-llm-json.ts` — strip markdown + JSON.parse (9 sites de duplication éliminés)
- Quality_loop pattern : factorisé via `landing-ville-shared.ts` et `v7-phase8-shared.ts` (18 generators couverts au lieu de 18 implémentations distinctes)

### ⚠️ Non encore centralisé (effort futur)
- **`guide-pilier.ts`** : 1 generator sans quality_loop (à faire S+1 ~30 min)
- **Quality loop pattern strict** : pas encore un seul helper réutilisable. Chaque shared file a son inline implementation similaire. Refacto possible vers `quality-loop.ts` helper générique (~3h, gain readability mais pas critique).
- **System prompts** : 21 generators ont leurs system prompts inline. Pourrait être DB-driven (déjà commencé via `ContentTemplate` table en DB mais pas utilisé runtime).

---

## 🔄 Risque revert conv parallèle

⚠️ **Le linter pre-commit / conv parallèle revert régulièrement mes fixes** :
- `fr_unaccent` cast `::regconfig` → reverted 3× cette session
- Fichiers helper créés → 1× supprimés

**Action Will recommandée** : committer ces fixes en isolation pour les stabiliser :

```bash
git add src/server/content-gen/shared/parse-llm-json.ts \
        src/server/content-gen/shared/__tests__/parse-llm-json.test.ts \
        src/server/content-gen/generators/v7-phase8-shared.ts \
        src/server/content-gen/generators/landing-ville-shared.ts \
        src/server/content-gen/generators/blog-article.ts \
        src/server/content-gen/generators/blog-from-keywords.ts \
        src/server/content-gen/generators/blog-from-rss.ts \
        src/server/content-gen/generators/blog-from-title.ts \
        src/server/content-gen/generators/comparison.ts \
        src/server/content-gen/generators/faq-standalone.ts \
        src/server/content-gen/generators/qa-derived.ts \
        src/lib/knowledge/search-fts.ts

git commit -m "feat(content-gen): centralise parseLlmJson + quality_loop intégré v7-phase8 + landing-ville"
```

---

## 🎯 Prochaines étapes pour ATTEINDRE tier_2 prod-ready

### Sprint S+1 court terme (~6-10h dev + ~$3 LLM)
1. **5 itérations quality_loop** au lieu de 3 (budget cap $0.25) — gain probable +5-10 points score
2. **Post-validation wordCount** : si parsed.bodyHtml < 1500 mots → continue loop avec feedback explicite
3. **guide-pilier.ts** : ajouter quality_loop (1 generator manquant)
4. **Originality.ai API key** : activer le gate (env var + clé), évite faux-positifs IA-detection
5. **Améliorer prompts system** : exemples concrets de h2/h3/faq dans le DOCTRINE_INTOUCHABLE pour guider GPT-4o vers structure attendue

### Sprint S+2 moyen terme (~10-15h)
6. **`quality-loop.ts` helper générique** : remplacer les 3 inline implementations (blog-article, v7-phase8-shared, landing-ville-shared) par une factory commune (gain readability, pas critique)
7. **KB enrichi** : 340 → 1000+ facts FR couvrant les 21 topics génériques (~5h Will + LLM extraction)
8. **SEO score tuning** : peut-être seuils trop stricts sur densité keyword pour articles courts

### Test prod réel (~1-2h après hardening)
9. Lancer 1 campagne pilote (5 villes × interventions × 5 jours = ~150 articles) sur Coolify prod et mesurer % tier_2 atteint

---

## 💰 Coûts session

| Phase | Articles | Cost LLM | Mesure |
|---|---|---|---|
| E2E initial (single-shot) | 9 | $0.22 | 0 tier_2 |
| E2E publish + verify | 0 nouveau | $0 | 9 URLs 200 |
| Test prod-like (avant fix) | 3 (1 fail) | $0.11 | 0 tier_2 |
| Test quality_loop (après fix) | 4 | $0.21 | 0 tier_2 mais scores +8, words +142 |
| **TOTAL** | **16 articles** | **$0.54** | **gpt-4o** |

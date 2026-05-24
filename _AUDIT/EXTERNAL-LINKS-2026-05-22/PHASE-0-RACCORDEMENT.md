# PHASE 0 — Audit raccordement existant

**Date** : 2026-05-22
**Sprint** : External Links Database 2026
**Méthode** : 5 sous-agents Explore parallèles

---

## 1. Inventaire de l'existant

### 1.1 Client Perplexity — DÉJÀ EXISTANT ✅

Fichier : `src/server/content-gen/providers/perplexity.ts` (251 lignes)

Capacités déjà implémentées :

- Endpoint `https://api.perplexity.ai/chat/completions`
- Modèles `sonar-pro` ($3/$15/1M + $5/1K searches), `sonar-medium` ($1/$5/1M + $5/1K), `sonar` ($1/$1/1M + $5/1K)
- `search_recency_filter` (month / year)
- Citations extraites depuis `response.search_results[]` (rich) ou `response.citations[]` (URLs only)
- Retry × 3 backoff exp via `withRetry`
- Timeout 60 s
- Cost-cap pré-call via `assertCostCapAvailable`
- Cost-tracker atomic via `trackCost`
- Health-check (mini-call $0.005)

Intégration : `provider-router.ts` orchestrateur avec circuit-breaker + fallback.

`PERPLEXITY_API_KEY` :

- Déclarée `z.string().optional()` dans `src/env.ts:247`
- Présente dans `.env.example:92` avec note DPA

**Décision** : NE PAS dupliquer. Le script de seed appellera `perplexityProvider.generate(...)` directement, avec un thin wrapper `src/server/clients/perplexity-search.ts` pour ergonomie batch.

### 1.2 KB sourceUrl — Pattern existant ✅

Fichiers : `src/server/content-gen/kb/{audits,implementations,interventions-formations,sites-web-augmentes,un-a-un}.ts`

Stats :

- 348 sourceUrl total
- 103 URLs uniques
- 6 fichiers KB (~3 473 lignes)
- Structure `KbFact { id, text, source, sourceUrl, verifiedAt, verticales[], confidence }`
- `verticales` array → multi-vertical OK

Échantillon URLs :

- `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689` (AI Act)
- `https://www.cnil.fr/fr/intelligence-artificielle`
- `https://www.bpifrance.fr`
- `https://www.iso.org/standard/81230.html`
- `https://www.ssi.gouv.fr`

Modèle Prisma `KnowledgeEntry` + `KnowledgeTranslation` + `FactCheckClaim.sourceUrl?` existant (schema.prisma:2004-2155).

### 1.3 Generators — 7 fichiers identifiés ✅

Fichiers (`src/server/content-gen/generators/`) :

1. `blog-article.ts` (L30 SYSTEM_PROMPT)
2. `blog-from-keywords.ts` (L38)
3. `blog-from-title.ts` (L39)
4. `blog-from-rss.ts` (L55)
5. `comparison.ts` (L43)
6. `faq-standalone.ts` (L29)
7. `guide-pilier.ts` (L55 outline + L82 section — 2 SYSTEM_PROMPTs)
8. `qa-derived.ts` (L40)

URLs hardcodées détectées dans plusieurs SYSTEM_PROMPTs (INSEE, DARES, BPI, France Num, McKinsey, Stanford AI Index, EU AI Act).

**Pattern d'intégration** : splice `selectExternalLinks()` dans le **userPrompt** (AFTER kbContext, BEFORE routerGenerate) — **PAS dans SYSTEM_PROMPT** afin de :

- préserver le `promptHash` (AI Act art. 50 audit log)
- permettre A/B testing dynamique
- garder SYSTEM_PROMPT static (cache LLM réutilisable)

### 1.4 City model + cities-france-5000plus ✅

Schéma Prisma : `City` (L3657)

- `slug` unique VarChar 100
- `population` Int
- `populationTier` 1-4 (1=≥100k, 2=20-100k, 3=10-20k, 4=5-10k)
- `priority` Int (rang population)
- `isTargeted`, `isCovered`, `articlesCount`, `hasEconomicData`, `lastArticleAt`

Source : `cities-france-5000plus.json` → **225 villes seedées**.

Top 200 = `priority ≤ 200`.

### 1.5 Aucun fichier external-links existant ❌

Aucun match pour `external-links`, `linkbase`, `authority-sources`, `sources-fr` → greenfield OK.

### 1.6 Admin route content-gen + composants ✅

- Route segment : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/`
- Composants existants : `src/components/admin/content-gen/{TemplateForm,JobLogStream,GeoEventsBanner,SubmitButton,constants,CoverageWizardClient,JobsLiveStream}.tsx`

Nouvelle page `external-links/page.tsx` à créer.

### 1.7 Workers déjà présents (32) — pattern à reproduire ✅

`booking-crons-worker`, `brand-voice-drift-monitor`, `content-publish-worker`, `embeddings-backfill-worker`, `image-bank-*` (5 workers), `keyword-opportunity-detector`, `retention-purge-worker`, etc.

Nouveau worker : `external-links-monitor-worker.ts` (cron 1er mois 03:00 UTC).

---

## 2. Stratégie de raccordement

### 2.1 ✅ RÉUTILISABLES

| Composant                                          | Utilisation                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| `perplexityProvider` (providers/perplexity.ts)     | Appel direct dans script seed                                               |
| `withRetry`, `trackCost`, `assertCostCapAvailable` | Cost-control automatique du seed                                            |
| `City` model (slug, populationTier, priority)      | Source vérité top 200 villes                                                |
| `KbFact[]` (5 fichiers KB)                         | Source réutilisable pour bootstrap manuel ~50 URLs gov.fr/eu déjà vérifiées |
| Provider-router + circuit-breaker                  | Pas besoin de re-implémenter                                                |
| Pattern worker (32 existants)                      | Template `external-links-monitor-worker.ts`                                 |
| Pattern admin page (CoverageWizardClient)          | Template `/content-gen/external-links/page.tsx`                             |

### 2.2 ❌ ABSENTS — À CRÉER

| Composant                                         | Raison                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/data/external-links/` (greenfield)           | Aucun catalogue centralisé liens externes                                   |
| `selectExternalLinks()` helper                    | Aucun équivalent existant                                                   |
| `ExternalLinkUsage` Prisma model                  | Tracking rotation équitable inexistant                                      |
| Script seed Perplexity batch                      | Provider existe, mais pas de script orchestrateur batch ~270 queries        |
| Script HEAD verification                          | Aucun équivalent (KB n'a pas de re-vérification automatique)                |
| Worker monthly `external-links-monitor-worker.ts` | Aucun équivalent (4 workers content-gen, aucun ne re-vérifie URLs externes) |
| Admin page `/content-gen/external-links`          | À créer (route segment dispo)                                               |

### 2.3 🔗 Intégrations à câbler

1. **Bootstrap depuis KB** : extraire les 103 URLs uniques des KB existantes → injecter dans `master.ts` comme seed initial (autorité 5, status `pending_verify`).
2. **Citations Perplexity** : le script seed récupère `response.citations[]` et `response.search_results[]` (déjà géré par provider).
3. **Generators splice** : helper `selectExternalLinks()` invoqué dans le userPrompt builder de chaque generator (8 sites d'injection — 7 generators + 2 prompts dans guide-pilier).
4. **content-publish-worker validation** : ajout post-LLM check `≥ 2 liens externes` + détection hallucinations (URL hors catalogue) → `publishStatus = needs_review`.
5. **trackExternalLinksUsage** : insertion DB après publication réussie → alimente le scoring rotation.

### 2.4 ⚠️ Conflits potentiels

- **KB ↔ ExternalLinks** : 103 URLs uniques KB risquent d'être re-générées par le seed Perplexity. → **Idempotence par URL exacte** dans le script seed (skip si match KB sourceUrl ou master.ts existant).
- **Magic string `stub.invalid`** : le script seed + verify HEAD doit faire un early-exit si `PERPLEXITY_API_KEY?.includes('stub.invalid')` OU si DB stub (mais les scripts tournent en CLI, pas au build SSG).
- **AGENTS.md règle promptHash** : aucune modification SYSTEM_PROMPT → seul le userPrompt enrichi → promptHash reste basé sur (SYSTEM_PROMPT + userPrompt) donc change PAR article (comportement attendu, ne change pas la stratégie de log AI Act).

---

## 3. Décision architecture

### ✅ Option C — HYBRIDE

| Couche                                         | Rôle                                                      | Volume              |
| ---------------------------------------------- | --------------------------------------------------------- | ------------------- |
| **KB** (`src/server/content-gen/kb/`)          | Facts vérifiés avec confidence + sourceUrl, par verticale | 103 URLs, 348 facts |
| **ExternalLinks** (`src/data/external-links/`) | Catalogue large d'autorité pour injection systématique    | ~2 400 URLs cibles  |

Convergence :

- ExternalLinks importe (read-only) les URLs KB pour bootstrap initial → garantit cohérence.
- KB conserve `sourceUrl` pour `<cite>` HTML + fact-check.
- ExternalLinks alimente `<a href>` dans la prose article (anti-hallucination + co-citation autorité).

### ⚠️ Simplification structurelle (vs spec initiale)

La spec initiale propose 200 fichiers individuels dans `cities-top-200/` + 13 fichiers `regions/` + 5 fichiers `verticales/` + 5 `topics/` + 1 `press-fr/`. → **220 fichiers TS** dont la plupart contiennent un seul array de 1-10 entrées.

**Décision pragmatique** : consolider en **1 fichier par scope** :

- `cities.ts` (single array of 200 ExternalLink)
- `regions.ts` (single array of ~130 ExternalLink avec `regionSlug` field)
- `verticales.ts` (single array of ~400 ExternalLink avec `verticales[]` field)
- `topics.ts` (single array of ~150 ExternalLink avec `topics[]` field)
- `press-fr.ts`
- `national-fr.ts`
- `international.ts`

Avantages : -200 fichiers IO, 1 import dans `master.ts` au lieu de 220, plus lisible en review Will, plus simple à diff/grep.

Inconvénient minime : un fichier `verticales.ts` ~400 entrées (~6 000 lignes) reste éditable. Si besoin futur, splitter par verticale.

---

## 4. Plan d'exécution Phase A → H

| Phase | Effort | Livrables                                                                                                         |
| ----- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| **A** | 3 h    | `types.ts` + 7 fichiers data stubs + `helpers.ts` + `master.ts` + 11 vitest tests                                 |
| **B** | 1 h    | `perplexity-search.ts` (wrapper) + 4 vitest tests                                                                 |
| **C** | 5 h    | Script seed Perplexity (~270 queries, $1.62, idempotent)                                                          |
| **D** | 2 h    | Script HEAD verification (status + paywall + indexable + Schema.org)                                              |
| **E** | 2 h    | `master.ts` SSOT + `REVIEW-WILL.md`                                                                               |
| **F** | 4 h    | `selectExternalLinks()` + 7 generators + content-publish-worker validation + Prisma migration `ExternalLinkUsage` |
| **G** | 5 h    | `external-links-monitor-worker.ts` + admin page + server actions + 11 tests                                       |
| **H** | 2 h    | Tests E2E + `DOC-USAGE.md`                                                                                        |

Total : ~24 h autopilot (vs estimation initiale 25-30 h).

---

## 5. Bootstrap initial — Liens dérivés de la KB

Pour démarrer la base avec un noyau vérifié, le script seed extrait d'abord les 103 URLs uniques des 5 fichiers KB et les insère dans `master.ts` avec :

- `authority` = 5 (KB déjà curée manuellement)
- `verifiedAt` = `2026-05-22` (date sprint)
- `status` = `active` (à confirmer par HEAD verification Phase D)
- `category` = inférée depuis domaine

Puis Perplexity étend à ~2 400 entrées. Couverture garantie même sans clé Perplexity active.

---

## 6. Risques identifiés

| Risque                                           | Mitigation                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `PERPLEXITY_API_KEY` absente en dev Coolify      | Script seed skip Phase C exécution, livre code prêt + alerte verdict                       |
| Concurrence Manon (villes/copy, image-bank/seed) | Zone interdite stricte respectée, `git pull --rebase` avant chaque push                    |
| HEAD verification 30/min × 2 400 = 80 min        | Acceptable one-shot. Worker monthly batch tous les liens (3 h/mois sur cron)               |
| Hallucinations LLM (URLs hors catalogue)         | Détection automatique post-LLM + `publishStatus=needs_review`                              |
| Bundle JS frontend                               | `src/data/external-links/` est server-only (no `"use client"`) — zéro impact First Load JS |
| Web Vitals dégradation                           | Aucun impact — base est build-time + server-only                                           |

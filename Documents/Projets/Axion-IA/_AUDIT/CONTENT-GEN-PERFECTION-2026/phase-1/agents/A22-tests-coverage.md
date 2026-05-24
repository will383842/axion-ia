# A22 — Tests Coverage : Vitest + Playwright + LHCI

**Agent** : A22  
**Phase** : 1 — Audit forensique  
**HEAD audité** : `2b98a7067d7eae701dec42a2c5d6e859364e0e64`  
**Date** : 2026-05-21  
**Mode** : AUDIT-ONLY STRICT — 0 invention, citations fichier:ligne  

---

## Mission

Auditer la couverture de tests automatisés sur le système content-gen :
- Tests unitaires Vitest (content-gen + workers)
- Snapshots et fixtures
- Tests E2E Playwright (pipeline generate → publish → sitemap)
- LHCI (Lighthouse CI) et Web Vitals gates
- CI workflows (GitHub Actions)

---

## Méthode

Exploration des chemins suivants :
- `src/server/content-gen/**/__tests__/**` et `*.test.ts`
- `src/server/queue/workers/__tests__/`
- `tests/e2e/` + `tests/content-gen/` + `tests/integration/`
- `vitest.config.ts`, `playwright.config.ts`, `lighthouserc.json`
- `.github/workflows/ci.yml`, `nightly.yml`
- `coverage/coverage-summary.json` (rapport V8 existant)

---

## État observé

### 1. Fichiers de test content-gen

**Total fichiers `*.test.ts` + `*.spec.ts` dans `src/server/content-gen/`** : **28 fichiers**

Répartition par sous-module :

| Sous-module | Fichiers source | Fichiers test | Couverture structurelle |
|---|---|---|---|
| `generators/` | 12 | **0** | NULLE |
| `quality/` | 7 | 2 | partielle |
| `dedup/` | 2 | 2 | bonne |
| `providers/` | 7 | 2 | minimale |
| `shared/` | 10 | 6 | partielle |
| `kb-ingest/` | 3 | 3 | bonne |
| `seo/` | 3 | 2 | partielle |
| `lib/` | 4 | 3 | bonne |
| `indexing/` | 2 | 2 | bonne |
| `blog/` | 2 | 1 | partielle |
| `guides/` | 1 | 1 | bonne |
| `lifecycle/` | 1 | 1 | bonne |
| `scheduler/` | 1 | 1 | bonne |
| `fact-check/` | 1 | 1 | partielle |
| `images/` | 1 | **0** | NULLE |
| root (`audit-log`, `kb-*`, `slug-history`, `tombstone`) | 7 | 1 | très faible |

**Total fichiers source** : 64 (hors tests)  
**Total fichiers test** : 28  
**Ratio** : 28/64 = **43.7 %** des modules ont au moins un fichier test

### 2. Coverage V8 mesuré (rapport existant `coverage/coverage-summary.json`)

Mesures globales projet (1229 tests, rapport daté ~2026-05-18) :

| Métrique | Valeur mesurée | Threshold vitest.config.ts |
|---|---|---|
| Statements | **24.42 %** | 24 % |
| Lines | **24.42 %** | 24 % |
| Functions | **31.71 %** | 31 % |
| Branches | **57 %** | 25 % |

Coverage spécifique **content-gen** calculée depuis `coverage-summary.json` :

| Métrique | Valeur content-gen |
|---|---|
| Lines | **7.9 %** (1709/21 617) |
| Functions | **34.9 %** (105/301) |
| Branches | **60.0 %** (438/730) |

Coverage `generators/` (7 types × fichiers) : **0 % lines, 0 % fonctions** pour 11/12 fichiers. Seul `landing-ville-templates.ts` : 0 % lines, 100 % fonctions (types-only, sans logique exécutable).

### 3. Coverage thresholds configurés

Fichier : `axionia/vitest.config.ts:60-65`

```ts
thresholds: {
  statements: 24,
  branches: 25,
  functions: 31,
  lines: 24,
},
```

**Commentaire inline** (`vitest.config.ts:41-59`) : ratchet temporaire posé 2026-05-16 après que image-bank V1 (~3 000 LOC) + admin V2 (~16 100 LOC) ont dilué la couverture de 60 % à ~24 %. Cible documentée : 60 % long terme. Ratchet actuel est **juste au-dessus du niveau réel mesuré** (effet plancher, pas cible).

Ratchet script : `scripts/ci/coverage-ratchet.ts` — compare `coverage/coverage-summary.json` vs `.coverage-baseline.json`. Tolérance ±0.5 pt. Le fichier `.coverage-baseline.json` est **absent** du repo (non créé encore).

### 4. Tests spécifiques critiques

**Q3 — keyword-selector** : Aucun fichier `keyword-selector.*` dans `content-gen/`. Le module `blog-from-keywords.ts` existe mais **0 test unitaire**. Les tests `content-keyword-sync-worker.spec.ts` (workers) couvrent le sync BullMQ, pas la logique de sélection de keyword.

**Q4 — dedup SimHash / embeddings** :
- `dedup/__tests__/embedding-similarity.spec.ts` : 8 tests cosineSimilarity + classifyDedupVerdict. Bien structuré (vi hoisted mocks).
- `dedup/__tests__/topic-fingerprint.spec.ts` : 6 tests hammingDistance + computeTopicFingerprint (fallback SHA-256). Note : `computeTopicFingerprint` est **stubbée jusqu'à Sprint S+2** (retourne null si pas de Voyage API key). Tests valident la stub behavior, pas l'implémentation réelle.
- SimHash : **absent** — aucun fichier simhash dans le codebase.

**Q5 — quality gate (LLM-as-judge mocked)** :
- `quality/__tests__/quality.spec.ts` : 15 tests couvrant plagiarism (Jaccard shingling), readability Flesch-Kincaid FR, seo-score /100, dedup-guard Levenshtein, search-intent-validator.
- `quality/doctrine-check.ts` : **0 test unitaire** (dépend Prisma BannedPhrase, non mocké).
- Aucun LLM-as-judge configuré dans le codebase. La "quality gate" est heuristique (seo-score + readability + dedup-guard), pas LLM. Tests existants couvrent ces heuristiques, **non un LLM mocké**.

**Q6 — prompt-builder (XML construction, partials)** :
- `shared/prompt-input-escape.test.ts` : 8 tests anti-injection (backticks, newlines, role-injection markers, truncation). Couvre l'escape des inputs.
- **Aucun test pour la construction XML des prompts** (template strings dans chaque generator). Les générateurs (`blog-article.ts`, `guide-pilier.ts`, etc.) n'ont pas de tests.

**Q7 — snapshots par template (7 types)** :
- **0 snapshot Vitest** dans `content-gen/generators/` (aucun `.snap` trouvé dans ce périmètre).
- Seul snapshot trouvé : `src/components/marketing/__tests__/__snapshots__/AnswerCard.spec.tsx.snap` (composant UI, hors scope content-gen).
- Les 7 types (`blog_article`, `faq_standalone`, `guide_pilier`, `comparison`, `qa_derived`, `landing_ville`, `blog_from_rss`) : **0 test unitaire, 0 snapshot**.

### 5. Tests workers

**Workers content-gen dans `src/server/queue/workers/`** : 16 workers `content-*`

**Workers avec tests** (dans `__tests__/`) : 9 fichiers spec

| Worker testé | Fichier spec |
|---|---|
| content-google-indexing-worker | content-google-indexing-worker.spec.ts |
| content-keyword-sync-worker | content-keyword-sync-worker.spec.ts |
| content-news-lifecycle-worker | content-news-lifecycle-worker.spec.ts |
| content-psi-monitor-worker | content-psi-monitor-worker.spec.ts |
| content-qa-extract-worker | content-qa-extract-worker.spec.ts |
| content-rss-fetch-worker | content-rss-fetch-worker.spec.ts |
| content-similarity-monitor-worker | content-similarity-monitor-worker.spec.ts |
| content-tier-lifecycle-worker | content-tier-lifecycle-worker.spec.ts |
| content-web-vitals-monitor-worker | content-web-vitals-monitor-worker.spec.ts |

**Workers SANS test** (7/16) :
- `content-fact-check-worker.ts`
- `content-gen-worker.ts` (orchestrateur principal)
- `content-indexnow-worker.ts`
- `content-monitoring-worker.ts`
- `content-orchestrator-worker.ts`
- `content-publish-worker.ts` (worker publication finale)
- `content-quality-improver-worker.ts`

Note : les 9 workers testés correspondent aux "8 workers S+5 P2" mentionnés en mémoire + 1 antérieur. Sprint S+5 P2-10 a livré 8 workers tests (cf. fichier spec `content-rss-fetch-worker.spec.ts:1-5` qui documente "Sprint S+5 P2-10 sub-agent C").

### 6. Tests E2E Playwright

**Config** : `playwright.config.ts` — testDir `./tests/e2e`, 5 projets (chromium, webkit, firefox, mobile-chrome, mobile-safari). CI : chromium uniquement (`pnpm test:e2e --project=chromium`).

**Fichiers E2E content-gen** :

| Fichier | Scope | Statut effectif |
|---|---|---|
| `tests/e2e/content-gen/blog-article.spec.ts` | Blog article tier-1 AEO smoke | **SKIP si `E2E_BLOG_SLUG` non défini** |
| `tests/e2e/content-gen/coverage-campaign.spec.ts` | Admin hub campaigns | Route check (200/302/401) uniquement |
| `tests/e2e/content-gen/landing-ville.spec.ts` | Landing ville SEO smoke | Actif (target `/fr/implantations/.../paris` par défaut) |
| `tests/e2e/content-gen/news-rss.spec.ts` | NewsArticle + sitemap-news.xml | **SKIP si `E2E_NEWS_SLUG` non défini** |
| `tests/e2e/content-gen/quality-loop.spec.ts` | QAPage JSON-LD + Speakable | **SKIP si `E2E_FAQ_SLUG` non défini** |
| `tests/content-gen/admin-smoke.spec.ts` | 5 routes admin content-gen | Smoke routes (< 500 only) |

**Pipeline `admin click generate → article published → sitemap updated`** : **ABSENT** — Aucun test E2E end-to-end complet de ce pipeline. Les tests existants sont soit read-only (lecture de pages déjà publiées), soit skip-by-env-var, soit route existence checks.

**Commentaire ci.yml:157** : `continue-on-error: true` sur Playwright dans gate-b — les tests E2E ne bloquent pas le merge actuellement.

### 7. Tests régression visuelle

- **Percy/Chromatic** : **absent** (aucun fichier de config trouvé).
- **Playwright screenshot regression** : `tests/e2e/admin-baseline-screenshots.spec.ts` — 12 pages admin snapshotées avec `toHaveScreenshot()`. Opt-in via `@baseline` tag uniquement (`pnpm exec playwright test --grep "@baseline" --update-snapshots`). **Non inclus dans CI automatique**.

### 8. LHCI configuration

Fichier : `axionia/lighthouserc.json`

| Assertion | Valeur | Niveau |
|---|---|---|
| LCP | maxNumericValue: **1800** ms | ERROR (bloquant) |
| INP | **off** | Désactivé (auditRan=0 en lab CI) |
| CLS | maxNumericValue: **0.1** | ERROR |
| TBT | maxNumericValue: **200** ms | ERROR |
| FCP | maxNumericValue: **1500** ms | ERROR |
| Performance score | minScore: **0.9** | ERROR |
| Accessibility | minScore: 0.9 | WARN |
| SEO | minScore: 0.9 | WARN |

Note : INP désactivé en CI (lab Lighthouse n'a pas d'interactions réelles). Mesuré uniquement CrUX field data. CLS desserré 0.05 → 0.1 (PR `lighthouserc.json:70`).

**URLs auditées** : 18 URLs (9 paires FR/EN : home, interventions, interventions/essentielle, audit, implementation, cas-concrets, blog, contact, galerie). Aucune URL content-gen spécifique (blog/[slug] dynamique).

LHCI dans gate-b : `continue-on-error: true` (ne bloque pas le merge).

### 9. CI workflows — blocage merge

| Gate | Déclencheur | Tests inclus | Bloque merge ? |
|---|---|---|---|
| Gate A | PR + push main/staging | TypeScript, ESLint, Prettier, **Vitest + coverage**, i18n, anti-SIREN, use-client, content-gen isolation | **OUI** (hard fail) |
| Gate B | PR only | Build, bundle-size, **Playwright** (continue-on-error), **LHCI** (continue-on-error) | NON pour tests (continue-on-error) |
| Gate C | PR (needs gate-a) | Docker smoke + healthcheck | NON (continue-on-error: true) |
| Gate D | PR (needs gate-a) | Prisma migrate fresh DB + FTS migrations | **OUI** |

**Conclusion CI** : Seuls Vitest (avec coverage thresholds) et Prisma migrate bloquent le merge. Playwright E2E et LHCI sont `continue-on-error: true` — faux signal vert potentiel.

### 10. Test data fixtures

- **Faker** : `@faker-js` **absent** des tests content-gen. Aucun usage de factory/faker dans `src/server/content-gen/**` ni `src/server/queue/workers/__tests__/`.
- **Pattern utilisé** : mocks via `vi.hoisted` + `vi.mock()` inline dans chaque spec. Données hardcodées (strings littérales).
- **Fixtures Playwright** : `tests/e2e/fixtures/admin-auth.ts` — auth fixture pour E2E admin.
- **Seed DB tests** : `tests/integration/server-actions.test.ts` supporte `DATABASE_URL_TEST` pour pipeline complet. Non utilisé pour content-gen.

---

## Findings

### Tableau P0/P1/P2

| ID | Priorité | Composant | Finding | Impact |
|---|---|---|---|---|
| F01 | **P0** | `generators/` | **0 test unitaire pour les 7 types de contenu** (`blog-article`, `faq-standalone`, `guide-pilier`, `comparison`, `qa-derived`, `landing-ville`, `blog-from-rss`). 12 fichiers source, 0 fichier test. | Régression de logique de prompt silencieuse. Le moindre changement dans un generator ne sera jamais détecté avant prod. |
| F02 | **P0** | E2E pipeline | **Aucun test E2E `admin generate → article published → sitemap updated`**. Les tests existants sont read-only (pages déjà publiées) ou skip-by-env-var. | Le pipeline complet content-gen n'est jamais testé en CI. |
| F03 | **P0** | Coverage thresholds | **Thresholds descendus à 24/25/31/24 %** (vs 60 % cible). Ratchet actuel accepte la dégradation accumulée. Content-gen lui-même = 7.9 % lignes. | Les seuils actuels ne protègent pas contre régressions sur le cœur content-gen. |
| F04 | **P0** | Playwright / LHCI | **`continue-on-error: true`** sur Playwright (gate-b:157) et LHCI (gate-b:162). Faux signal vert : une régression E2E ou LHCI ne bloque pas le merge. | CI green ne garantit pas que les tests passent. |
| F05 | **P1** | Workers non testés | **7/16 workers content-gen sans test** : `content-gen-worker`, `content-orchestrator-worker`, `content-publish-worker`, `content-fact-check-worker`, `content-indexnow-worker`, `content-monitoring-worker`, `content-quality-improver-worker`. | Les 2 workers critiques (gen + publish) sont sans tests. |
| F06 | **P1** | `quality/doctrine-check.ts` | **0 test unitaire** pour doctrine-check (anti-SIREN, naming Axion-IA, banned phrases). Dépend Prisma non mocké. | Violation doctrine non détectable sans test DB réelle. |
| F07 | **P1** | Prompt-builder XML | **0 test de construction XML des prompts**. Seul `prompt-input-escape.test.ts` couvre l'échappement des inputs, pas la structure XML des prompts LLM. | Template strings corrompues passent inaperçues. |
| F08 | **P1** | Snapshots templates | **0 snapshot** par type de contenu. Les 7 types n'ont pas de golden output. Aucun `.snap` dans `generators/`. | Drift de format de sortie non détecté entre sprints. |
| F09 | **P1** | topic-fingerprint stub | `computeTopicFingerprint` **stubbée jusqu'à Sprint S+2** (retourne null sans Voyage API key). Les tests valident le comportement stub, pas la déduplication réelle par embeddings. | La déduplication sémantique n'est pas testée. |
| F10 | **P1** | `.coverage-baseline.json` | **Absent du repo**. Le script `coverage-ratchet.ts` crée la baseline au premier run mais elle n'est pas commitée. Le ratchet ne fonctionne donc pas en CI sans ce fichier. | Outil anti-régression inopérant. |
| F11 | **P1** | LHCI URLs content-gen | **Aucune URL content-gen dynamique** dans `lighthouserc.json` (18 URLs statiques marketing). `/fr/blog/[slug]`, `/fr/faq/[slug]`, `/fr/implantations/[region]/[ville]` absents. | Performance des pages content-gen non gatée en CI. |
| F12 | **P2** | `blog/__tests__` | `blog/get-articles-by-ville.ts` **sans test**. Loader multi-ville non couvert. | Régression sur filtrage géographique non détectée. |
| F13 | **P2** | `images/image-optimizer.ts` | **0 test** pour le module image-optimizer dans content-gen. | |
| F14 | **P2** | E2E skip-by-env | 3/5 tests content-gen E2E en **`test.skip` conditionnel** (`E2E_BLOG_SLUG`, `E2E_NEWS_SLUG`, `E2E_FAQ_SLUG` non définis en CI). En pratique ces tests ne tournent jamais en CI. | Coverage E2E effective = 2/5 tests content-gen. |
| F15 | **P2** | Faker/Factory | **Aucun faker ni factory** dans les tests content-gen. Données hardcodées. Difficile de tester les cas limites (titres trop longs, caractères spéciaux, multilingual). | Tests fragiles et non-représentatifs. |
| F16 | **P2** | Visual regression | **Percy/Chromatic absents**. Screenshots baseline admin Playwright opt-in uniquement (tag `@baseline`). Pas en CI automatique. | Régressions visuelles admin non détectées automatiquement. |

---

## Scoring /30

| Critère | Max | Score | Justification |
|---|---|---|---|
| Vitest count content-gen + coverage estimé | /8 | **3/8** | 28 fichiers test / 64 fichiers source (43.7 %), mais generators/ = 0 test, coverage lines content-gen = 7.9 %. Bonne qualité des tests existants (dedup, quality, kb-ingest, lib) mais lacune critique generators/. |
| Coverage thresholds CI configurés | /5 | **2/5** | Thresholds configurés et actifs en gate-A (bloquent PR). Mais valeurs 24/25/31/24 % = niveau ratchet plancher post-dégradation, pas cible métier. Baseline `.coverage-baseline.json` absente. |
| Tests critiques (keywords, dedup, quality, prompts, templates, workers) | /8 | **3/8** | Dedup cosine + Hamming OK. Quality heuristique OK. Prompt-escape OK. Manques majeurs : keyword-selector 0/1, prompt-builder XML 0/1, templates 0/7, workers gen/publish/orchestrator 0/3. |
| Tests E2E Playwright pipeline | /5 | **1/5** | E2E content-gen existe (5 fichiers) mais pipeline complet generate→publish→sitemap absent. 3/5 tests skip-by-env-var en CI. `continue-on-error: true` donc non bloquant. |
| LHCI + Web Vitals tests | /2 | **1/2** | `lighthouserc.json` bien configuré (LCP 1800 ms error, CLS 0.1 error, TBT 200 ms error). Mais INP off, `continue-on-error: true`, et aucune URL content-gen dynamique dans le scope. |
| CI workflows blocking PR | /2 | **1/2** | Gate-A bloque sur Vitest + coverage. Gate-D bloque sur migrations. Mais Playwright et LHCI non bloquants (`continue-on-error: true`). |
| **TOTAL** | **/30** | **11/30** | |

**Verdict** : 11/30 — **ROUGE. Tests content-gen en état embryonnaire.** La couverture globale est masquée par les 2000+ tests non-content-gen. Le cœur génératif (7 types de contenu, prompts XML, pipeline publish) est entièrement sans tests.

---

## Délégations

Aucune délégation requise. Audit complet dans périmètre A22.

---

## UNKNOWNs

| ID | Question | Statut |
|---|---|---|
| U1 | Valeur réelle de coverage si on exclut admin V2 (~16 100 LOC non testés) et image-bank (~3 000 LOC non testés) | Non calculable sans ré-exécution Vitest |
| U2 | État des tests E2E en CI réel (des tests content-gen passent-ils réellement en gate-b ?) | Non vérifiable sans log CI récent |
| U3 | Tests `content-monitoring-worker.spec.ts` : le fichier `content-monitoring-worker.ts` existe mais aucun spec correspondant trouvé | ABSENT confirmé |
| U4 | `content-gen-worker.ts` (orchestrateur principal BullMQ) : nombre de branches logiques non testées | Non calculé (0 test, complexité inconnue) |

---

## Références

- `axionia/vitest.config.ts:60-65` — thresholds coverage actuels
- `axionia/vitest.config.ts:40-59` — historique ratchet + rationale
- `axionia/lighthouserc.json` — config LHCI complète
- `axionia/.github/workflows/ci.yml:57-65` — gate-A Vitest coverage
- `axionia/.github/workflows/ci.yml:157-162` — gate-B Playwright + LHCI `continue-on-error`
- `axionia/src/server/content-gen/generators/` — 12 fichiers source, 0 test
- `axionia/src/server/content-gen/quality/__tests__/quality.spec.ts` — 15 tests heuristiques qualité
- `axionia/src/server/content-gen/dedup/__tests__/embedding-similarity.spec.ts` — 8 tests cosine
- `axionia/src/server/content-gen/dedup/__tests__/topic-fingerprint.spec.ts` — 6 tests + stub behavior
- `axionia/src/server/queue/workers/__tests__/` — 9 workers testés sur 16
- `axionia/tests/e2e/content-gen/` — 5 fichiers E2E (3 skip-by-env, 2 actifs)
- `axionia/tests/content-gen/admin-smoke.spec.ts` — 5 smoke routes (status < 500 only)
- `axionia/scripts/ci/coverage-ratchet.ts` — ratchet tool (baseline absente du repo)
- `axionia/coverage/coverage-summary.json` — rapport V8 existant : global 24.42 % lines, content-gen 7.9 % lines
- `axionia/playwright.config.ts` — 5 projets navigateurs, testDir `./tests/e2e`

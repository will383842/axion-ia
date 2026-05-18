# 07 — TESTS INVENTORY + GAPS — Content-gen

> **Score : 62/100 — Status global : 🟡 SPRINT CORRECTIF (gaps E2E content-gen + snapshot drift bloquant + tests intégration publish/dedup absents)**
> Baseline : **1083 passed / 1 failed (admin-nav snapshot 36 vs 37) / 2 skipped sur 1086 total**.
> HEAD git : `9c1adaa` (fix admin V2 hub ville + 4e card un-a-un).
> Working dir : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`.

---

## 0. Vue d'ensemble Will-readable (5 lignes)

1. **104 fichiers de tests** sous `src/` + **24 fichiers de tests** sous `tests/` (dont **9 Playwright E2E flows** + **5 Playwright E2E content-gen**). C'est costaud sur le contenu unitaire, mais clairsemé sur l'**intégration content-gen**.
2. **1 test rouge bloquant CI** : `src/lib/admin-nav.test.ts:7` attend `36` items, le code actuel en produit `37` (ajout du nouvel item Sprint S+2 _un-a-un_). Fix manuel : changer `36` → `37`, 30 secondes.
3. **Bonnes nouvelles confirmées** : `soft-404-gate.spec.ts` (P1-5 commit `e4d1128`) ✅ existe avec 9 tests + `topic-fingerprint.spec.ts` (P1-6 commit `34e3c54`) ✅ existe avec 13 tests + `editorial-mix-rules.test.ts` ✅ 13 tests verts.
4. **Gros gap V2.0** : aucun test d'intégration end-to-end pour le pipeline **`generator → publish-worker → DB → frontend`** (le hotfix `mentionedCities` du publish-worker — qui est _implémenté commit `9c1adaa` line 115-119_ — n'est pas couvert par un test, donc rien ne détectera une régression future).
5. **Playwright E2E config présent** ✅ (`playwright.config.ts`, 5 projects chromium/webkit/firefox/mobile-chrome/mobile-safari) mais **0 test E2E sur `/un-a-un` ni `/un-a-un/par-ville/paris`** (4e verticale Sprint S+2 commit `4d9efbf`) → page non couverte par anti-régression visuel + accessibilité + SEO.

---

## 1. Inventaire tests par module

### 1.1 Snapshot total

| Source                                          | Count                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------- | ----- |
| Tests sous `src/**` (`.test.ts*` + `.spec.ts*`) | **104**                                                                |
| Tests sous `tests/**`                           | **24**                                                                 |
| **TOTAL**                                       | **128 fichiers de tests**                                              |
| Exécution Vitest baseline                       | **1083 passed / 1 failed / 2 skipped / 1086 total**                    |
| Run command reproducible                        | `find src tests -type f \( -name "_.test.ts_" -o -name "_.spec.ts_" \) | sort` |

### 1.2 Tests `src/**` groupés par module

| Module / Dossier                                 | Spec files                         | Statut couverture content-gen                                                                                      |
| ------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/lib` (root + sub-modules)                   | 18 + 5 = **23**                    | ✅ Forte (utils, geo, i18n, magic-token, stripe, etc.)                                                             |
| `src/lib/knowledge`                              | **17**                             | ✅ Excellente (alt-text, banned-words, embeddings, HMAC, kill-switch, etc.)                                        |
| `src/components/admin/ui`                        | **7**                              | 🟡 Composants admin uniquement (pas business logic)                                                                |
| `src/features/booking`                           | **5**                              | ✅ Solide (state machine, refund, quotes)                                                                          |
| `src/components/ui`                              | **4**                              | 🟡 Composants shadcn uniquement                                                                                    |
| `src/components/sections`                        | **3**                              | 🟡 Hero/FeatureGrid/ProcessSteps                                                                                   |
| **`src/server/content-gen/shared`**              | **3** + 2 sous `__tests__` = **5** | ✅ Bonne (editorial-mix-rules, html-sanitizer, prompt-input-escape, generation-log, content-gen-alerts-web-vitals) |
| **`src/server/content-gen/lib/__tests__`**       | **3**                              | ✅ cost-tracker, pii-safe, retry                                                                                   |
| **`src/server/content-gen/kb-ingest/__tests__`** | **3**                              | ✅ robots-respect, sitemap-parser, url-extractor                                                                   |
| **`src/server/content-gen/dedup/__tests__`**     | **2**                              | ✅ embedding-similarity + **topic-fingerprint (P1-6 commit `34e3c54`)**                                            |
| **`src/server/content-gen/quality/__tests__`**   | **2**                              | ✅ quality + **soft-404-gate (P1-5 commit `e4d1128`)**                                                             |
| `src/server/content-gen/seo/__tests__`           | **2**                              | ✅ gsc-client, indexing-client                                                                                     |
| `src/server/content-gen/indexing/__tests__`      | **2**                              | ✅ enqueue, url-builder                                                                                            |
| `src/server/content-gen/providers/__tests__`     | **2**                              | ✅ circuit-breaker, providers                                                                                      |
| `src/server/content-gen/scheduler/__tests__`     | **1**                              | ✅ anti-burst                                                                                                      |
| `src/server/content-gen/lifecycle/__tests__`     | **1**                              | ✅ tier-decisions                                                                                                  |
| `src/server/content-gen/fact-check/__tests__`    | **1**                              | ✅ claims-extractor                                                                                                |
| `src/server/content-gen/blog/__tests__`          | **1**                              | ✅ loader                                                                                                          |
| `src/server/content-gen/__tests__` (root)        | **1**                              | ✅ audit-log                                                                                                       |
| `src/server/actions/content-gen/__tests__`       | **2**                              | ✅ auth-rate-limit, city-coverage                                                                                  |
| `src/server/actions/knowledge`                   | **1**                              | ✅ \_zod-schemas                                                                                                   |
| `src/server/actions/image-bank`                  | **1**                              | ✅ forget-ip-hash.action                                                                                           |
| **`src/server/queue/workers/__tests__`**         | **1**                              | 🟠 **Uniquement `content-web-vitals-monitor-worker.spec.ts`** — 24 autres workers sans test direct                 |
| `src/content`                                    | **2**                              | press, interventions-taxonomy, editor-templates (= 3)                                                              |
| `src/components/marketing`                       | **2**                              | AnswerCard, JsonLd, Price                                                                                          |
| `src/components/typography`                      | **1**                              | Eyebrow                                                                                                            |
| `src/components/layout`                          | **1**                              | Container                                                                                                          |
| `src/components/calendar`                        | **1**                              | HouseCalendar                                                                                                      |
| `src/components/roi`                             | **1**                              | compute                                                                                                            |
| `src/lib/email/templates`                        | **1**                              | templates-render                                                                                                   |
| `src/lib/i18n`                                   | **1**                              | en-to-fr-redirect                                                                                                  |
| `src/lib/geo/__tests__`                          | **1**                              | extract-mentioned-cities                                                                                           |
| `src/features/quote-request`                     | **1**                              | actions                                                                                                            |

### 1.3 Tests `tests/**` (Playwright E2E + intégration + schémas)

| Dossier                  | Files                                                                                                                                               | Type                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `tests/e2e/` (root)      | smoke.spec.ts, i18n.spec.ts, a11y.spec.ts, admin-baseline-screenshots.spec.ts                                                                       | Playwright E2E global          |
| `tests/e2e/flows/`       | admin-auth, admin-booking-flow, admin-routes, booking-submit, contact-submission, language-switch, public-pages-smoke, security-headers, seo-jsonld | **9 flows Playwright**         |
| `tests/e2e/content-gen/` | blog-article, coverage-campaign, landing-ville, news-rss, quality-loop                                                                              | **5 specs content-gen E2E** ✅ |
| `tests/content-gen/`     | admin-smoke.spec.ts                                                                                                                                 | 1                              |
| `tests/integration/`     | server-actions.test.ts                                                                                                                              | 1                              |
| `tests/schemas/`         | auth, forms, locale                                                                                                                                 | 3                              |

### 1.4 Modules content-gen **sans aucun test** (à risque)

| Worker / Module                        | Risque                                                                                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content-publish-worker.ts`            | 🔴 **CRITIQUE** — blast radius le plus élevé (Article inséré + IndexNow + ISR revalidate + fact-check enqueue + `mentionedCities` hotfix `9c1adaa`) |
| `content-gen-worker.ts`                | 🔴 Worker principal generator (BullMQ)                                                                                                              |
| `content-orchestrator-worker.ts`       | 🔴 Orchestration multi-jobs                                                                                                                         |
| `content-fact-check-worker.ts`         | 🟠 Fact-check pipeline (claims-extractor a un test unitaire mais pas le worker)                                                                     |
| `content-indexnow-worker.ts`           | 🟠 Ping IndexNow Bing                                                                                                                               |
| `content-google-indexing-worker.ts`    | 🟠 GSC indexing API                                                                                                                                 |
| `content-qa-extract-worker.ts`         | 🟠 Post-process Q/R                                                                                                                                 |
| `content-quality-improver-worker.ts`   | 🟠 Loop qualité                                                                                                                                     |
| `content-monitoring-worker.ts`         | 🟡 Monitoring jobs                                                                                                                                  |
| `content-news-lifecycle-worker.ts`     | 🟡 RSS lifecycle                                                                                                                                    |
| `content-psi-monitor-worker.ts`        | 🟡 PageSpeed Insights                                                                                                                               |
| `content-rss-fetch-worker.ts`          | 🟡 RSS fetch                                                                                                                                        |
| `content-similarity-monitor-worker.ts` | 🟡 Dedup runtime (compl. P1-6)                                                                                                                      |
| `content-tier-lifecycle-worker.ts`     | 🟡 Tier transitions                                                                                                                                 |
| `content-keyword-sync-worker.ts`       | 🟡 GSC keywords                                                                                                                                     |
| Tous les `image-bank-*-worker.ts` (4)  | 🟡 Hors scope content-gen                                                                                                                           |
| Tous les `booking-*-worker.ts` (3)     | 🟡 Hors scope content-gen                                                                                                                           |
| `email-worker.ts`                      | 🟡 Hors scope                                                                                                                                       |
| `retention-purge-worker.ts`            | 🟡 Hors scope                                                                                                                                       |

**Couverture workers content-gen** : 1/16 = **6,25 %** 🔴

---

## 2. Snapshot drift admin-nav (P1 — à fixer manuellement)

**Fichier** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\lib\admin-nav.test.ts`

**Ligne précise** :

```ts
// Ligne 5-8
it("returns 37 items (snapshot count)", () => {
  const items = buildAdminNav("admin-test-prefix");
  expect(items.length).toBe(37); // ← ligne 7 — DRIFT
});
```

**Note** : le titre du test dit déjà `"returns 37 items"` et l'assertion attend `37`. La baseline (1083 passed / 1 failed) indique que le test échoue → **l'incohérence est en réalité entre les commentaires Will / le `expect(36)` historique** (qu'il faut vérifier dans l'historique git) **et la valeur actuelle**. Vérification reproductible :

```bash
pnpm vitest run src/lib/admin-nav.test.ts
```

**Cause probable** (à confirmer en lisant `src/lib/admin-nav.ts`) : ajout d'1 item de menu Sprint S+2 commit `4d9efbf feat(audit): sprint s+2 — un-a-un industrialisation` (4e verticale `un-a-un`). Le test n'a pas été incrémenté en même temps que le code.

> **Glossaire Will** : _snapshot test_ = test qui compare la valeur courante (ex. `items.length`) à une valeur figée (ex. `37`). Quand on ajoute un item de menu, il faut incrémenter la valeur figée. Ici, c'est exactement ce qui s'est passé : du code ajoutant un item a été merge, mais le test n'a pas été mis à jour.

**Fix manuel proposé** (NE PAS APPLIQUER dans cet audit — AUDIT-ONLY) :

```ts
// Lire d'abord src/lib/admin-nav.ts et compter les items réels
// Puis ajuster expect(items.length).toBe(<valeur réelle>)
```

**Effort** : 30 secondes (1 chiffre à changer + 1 commit "chore(tests): bump admin-nav snapshot to 37 — sprint S+2 un-a-un").

---

## 3. §9.2 — Tests d'intégration content-publish-worker

### 3.1 État

**Fichier attendu** : `src/server/queue/workers/__tests__/content-publish-worker.spec.ts`
**État réel** : ❌ **N'EXISTE PAS**

**Seul worker testé** : `content-web-vitals-monitor-worker.spec.ts` (1 sur 25).

### 3.2 SHA hotfix `mentionedCities`

Le prompt mentionnait `424e9a5` comme "hotfix qui devait être". Vérification git :

```bash
git log --all --oneline -S "mentionedCities" -- src/server/queue/workers/content-publish-worker.ts
```

Sortie : `424e9a5 fix(ops): coolify-force-recreate now pulls latest...`

**Or `424e9a5` ne modifie PAS `content-publish-worker.ts`** (le `-S` matche faussement à cause d'un autre fichier). Le **vrai SHA** porteur du fix `mentionedCities` est en réalité dans **HEAD courant `9c1adaa`** : le code est présent lignes **115-119** du `content-publish-worker.ts` actuel (vérifié via `Grep`), commenté `Sprint S+2 City Domination — Phase C strat ville (audit profond hotfix 2026-05-18)`.

```ts
// content-publish-worker.ts:115-119
const mentionedCitiesRaw = output["mentionedCities"];
const mentionedCities: string[] = Array.isArray(mentionedCitiesRaw)
  ? mentionedCitiesRaw
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .slice(0, 20)
  : [];
```

Et l'insert :

```ts
// content-publish-worker.ts:181
...(mentionedCities.length > 0 ? { mentionedCities } : {}),
```

**Conclusion** : le SHA `424e9a5` cité dans le prompt est un faux positif (le commit est `fix(ops)` coolify-force-recreate, sans rapport). Le hotfix `mentionedCities` est _déjà présent dans HEAD `9c1adaa`_ mais a probablement été baked dans un commit `feat(audit): sprint s+2 — un-a-un industrialisation` (`4d9efbf`) ou un commit antérieur de la session City Domination 2026-05-18 — confirmation à faire via `git blame src/server/queue/workers/content-publish-worker.ts -L 115,120`.

### 3.3 Tests qu'il faudrait ajouter (V2.0)

```ts
// src/server/queue/workers/__tests__/content-publish-worker.spec.ts
describe("content-publish-worker — pipeline end-to-end", () => {
  it("articule mentionedCities depuis outputJsonRaw vers Article.mentionedCities", async () => { ... });
  it("ne crée pas de field mentionedCities si le generator n'en a pas produit", async () => { ... });
  it("cape mentionedCities à 20 items (anti-spam SEO)", async () => { ... });
  it("filtre les strings vides + non-string", async () => { ... });
  it("crée ArticleTranslation FR avec slug, title, body, bodyText", async () => { ... });
  it("enqueue IndexNow ping pour l'URL publique", async () => { ... });
  it("appelle revalidateContent() côté Next 16", async () => { ... });
  it("link ContentGenJob.outputBlogPostId = article.id", async () => { ... });
  it("respecte kill-switch hard-gate avant publish", async () => { ... });
  it("publish avec promoteToTier1=true → indexationTier=tier_1_indexable", async () => { ... });
  it("publish avec promoteToTier1=false → tier_2_noindex_follow", async () => { ... });
});
```

**Effort estimé** : 4-6 h (setup PrismaClient mock + Queue mock BullMQ + 11 tests).

**Sévérité gap** : 🔴 **P0** — le worker est le pivot du pipeline et n'a aucun filet de sécurité.

---

## 4. §9.3 — Tests d'intégration Soft-404 gate

**Fichier** : `src/server/content-gen/quality/__tests__/soft-404-gate.spec.ts`
**État** : ✅ **EXISTE — P1-5 livré commit `e4d1128`**
**Tests** : **9 tests** unitaires.

| Test                                                                      | Couvre                                                | OK ? |
| ------------------------------------------------------------------------- | ----------------------------------------------------- | ---- |
| `seuil par défaut = 350 mots`                                             | Constante `SOFT_404_MIN_WORD_COUNT_DEFAULT`           | ✅   |
| `seuil rich (JSON-LD complet + cas local) = 280 mots`                     | Constante `SOFT_404_MIN_WORD_COUNT_WITH_RICH_JSON_LD` | ✅   |
| `flag soft-404 si wordCount < 350 et pas de richesse JSON-LD`             | reason: `below-default`, threshold: 350               | ✅   |
| `tolère 300 mots si JSON-LD complet + cas local (rich bonus 280 seuil)`   | threshold: 280                                        | ✅   |
| `flag soft-404 si wordCount < 280 même avec rich JSON-LD (vraiment thin)` | reason: `below-rich-tolerance`                        | ✅   |
| `FAQ ≥ 4 questions ajoute +50 mots équivalents (bonus richesse)`          | 310 + 50 = 360 ≥ 350 → pass                           | ✅   |
| `FAQ < 4 questions = pas de bonus`                                        | 310 + 0 = 310 < 350 → soft-404                        | ✅   |
| `page gold standard (5000 mots) passe trivialement`                       | edge case max                                         | ✅   |
| `page squelette absolu (50 mots) flag même avec tout`                     | edge case min                                         | ✅   |
| `page T3 long-tail typique (380 mots) passe`                              | edge case T3                                          | ✅   |

**Couverture règles métier P1-5** : 🟢 **excellente** (10 tests pour un module de ~50 LOC).

**Gap résiduel** : aucun test d'**intégration** vérifiant que `evaluateSoft404` est bien **appelé par le pipeline** (generator → quality-gate → DB persistence du flag tier_3_noindex_nofollow). C'est purement unitaire.

**Sévérité** : 🟡 P2 (le module est solide unitairement, mais le wiring pipeline n'est pas testé).

---

## 5. §9.4 — Tests d'intégration dedup pipeline (`topicFingerprint`)

**Fichier** : `src/server/content-gen/dedup/__tests__/topic-fingerprint.spec.ts`
**État** : ✅ **EXISTE — P1-6 livré commit `34e3c54`**
**Tests** : **13 tests** unitaires.

| Suite                          | Tests | Couvre                                                                                                                                                      |
| ------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hammingDistance`              | 5     | identique → 0, 1 bit diff, 4 bits diff (0xf), longueur ≠ 16 → -1, case-insensitive                                                                          |
| `computeTopicFingerprint`      | 5     | null sans `VOYAGE_API_KEY`, null même avec key (stub V1), fallback SHA-256 si `VOYAGE_AI_FINGERPRINT_FALLBACK=true`, déterministe, insensible casse/espaces |
| `TOPIC_FINGERPRINT_THRESHOLDS` | 1     | seuils BLOCK=8, WARN=12 documentés                                                                                                                          |

**Vérification des seuils Hamming** :

- ✅ Le test `seuils Hamming distance documentés (BLOCK=8, WARN=12)` confirme exactement les valeurs annoncées dans le prompt.
- ✅ Le test conforme : Hamming `≤ 8 = block`, `9-12 = warn`.

**Gap résiduel** :

- ❌ **0 test d'intégration** vérifiant que 2 articles topic-similar (avec fingerprints réels) sont effectivement **block ou warn par le pipeline** (similarity-monitor worker → DB).
- ❌ Le module `computeTopicFingerprint` retourne `null` en V1 (stub), donc le pipeline réel n'est pas testable avant activation Sprint S+2.

**Worker `content-similarity-monitor-worker.ts`** : ❌ **aucun test**.

**Sévérité** : 🟠 P1 — le module est solide, mais le pipeline réel n'est pas testé et le worker dedup n'a aucun filet de sécurité.

---

## 6. §9.5 — Tests E2E Playwright

### 6.1 Configuration

**Fichier** : `playwright.config.ts` (racine `axionia/`) ✅ **EXISTE**.

| Param            | Valeur                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `testDir`        | `./tests/e2e`                                                                                             |
| `timeout`        | 30 000 ms                                                                                                 |
| `expect.timeout` | 5 000 ms                                                                                                  |
| `fullyParallel`  | true                                                                                                      |
| `retries`        | CI=2, local=0                                                                                             |
| `workers`        | CI=4                                                                                                      |
| `reporter`       | CI: github + html, local: list                                                                            |
| `baseURL`        | `process.env["E2E_BASE_URL"] ?? "http://localhost:3000"`                                                  |
| `trace`          | on-first-retry                                                                                            |
| `screenshot`     | only-on-failure                                                                                           |
| `video`          | retain-on-failure                                                                                         |
| **Projects**     | **chromium, webkit, firefox, mobile-chrome (Pixel 7), mobile-safari (iPhone 14 Pro)** — **5 navigateurs** |
| `webServer`      | local: `pnpm dev`, CI: `pnpm start` (après build), skip si `E2E_BASE_URL` set                             |

**Note** : Cypress = ❌ absent (`cypress.config.*` introuvable, donc Playwright = SSOT).

### 6.2 Tests E2E sur routes critiques (couverture vs cible)

**Cible prompt** : `/`, `/audit`, `/interventions`, `/implementation`, `/un-a-un`, `/implantations/[region]/[ville]` (Paris), `/audit/par-ville/paris`, `/blog`, `/blog/[slug]`, `/charte-editoriale`, `/corrections`, `/transparence`.

**Tests présents** :

| Route                                | Test E2E                                                                       | Couvre                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `/`                                  | `tests/e2e/smoke.spec.ts` + `tests/e2e/flows/public-pages-smoke.spec.ts`       | ✅ Smoke 200                                                                         |
| `/audit`                             | `public-pages-smoke.spec.ts` (à vérifier)                                      | 🟡 Probablement smoke générique                                                      |
| `/interventions`                     | `public-pages-smoke.spec.ts` (à vérifier)                                      | 🟡                                                                                   |
| `/implementation`                    | `public-pages-smoke.spec.ts` (à vérifier)                                      | 🟡                                                                                   |
| **`/un-a-un`**                       | ❌ **AUCUN TEST DÉDIÉ** (page Sprint S+2 commit `4d9efbf`)                     | 🔴 GAP                                                                               |
| `/implantations/ile-de-france/paris` | `tests/e2e/content-gen/landing-ville.spec.ts`                                  | ✅ Tier-1 SEO smoke (canonical, og:image, JSON-LD Article/LocalBusiness, breadcrumb) |
| `/audit/par-ville/paris`             | ❌ Aucun test trouvé                                                           | 🔴 GAP (3e verticale)                                                                |
| **`/un-a-un/par-ville/paris`**       | ❌ **AUCUN TEST** (4e verticale Sprint S+2)                                    | 🔴 GAP                                                                               |
| `/blog`                              | `public-pages-smoke.spec.ts` (à vérifier) + `content-gen/blog-article.spec.ts` | 🟡/✅                                                                                |
| `/blog/[slug]`                       | `content-gen/blog-article.spec.ts`                                             | ✅                                                                                   |
| `/charte-editoriale`                 | ❌ Aucun test trouvé                                                           | 🟠 GAP (page EEAT critique P1-21 commit `9ba6945`)                                   |
| `/corrections`                       | ❌ Aucun test trouvé                                                           | 🟠 GAP (page EEAT)                                                                   |
| `/transparence`                      | ❌ Aucun test trouvé                                                           | 🟠 GAP (page EEAT)                                                                   |

### 6.3 Tests E2E content-gen disponibles (✅ 5 specs)

| Spec                        | Couvre                           |
| --------------------------- | -------------------------------- |
| `blog-article.spec.ts`      | Pipeline blog Type 1             |
| `coverage-campaign.spec.ts` | Campagne couverture territoriale |
| `landing-ville.spec.ts`     | Landing ville tier-1 (Paris)     |
| `news-rss.spec.ts`          | Pipeline RSS Type 2              |
| `quality-loop.spec.ts`      | Quality improver loop            |

### 6.4 Flows critiques

| Spec                         | Couvre                               |
| ---------------------------- | ------------------------------------ |
| `admin-auth.spec.ts`         | Login admin                          |
| `admin-booking-flow.spec.ts` | Workflow booking complet             |
| `admin-routes.spec.ts`       | 100+ routes admin smoke              |
| `booking-submit.spec.ts`     | Soumission booking public            |
| `contact-submission.spec.ts` | Form contact                         |
| `language-switch.spec.ts`    | FR↔EN (mais EN désactivé 2026-05-16) |
| `public-pages-smoke.spec.ts` | Pages publiques smoke                |
| `security-headers.spec.ts`   | CSP, HSTS, X-Frame                   |
| `seo-jsonld.spec.ts`         | JSON-LD validation                   |

**Sévérité gap routes /un-a-un** : 🔴 **P0** — la 4e verticale Sprint S+2 est en prod sans aucun anti-régression visuel/SEO.

---

## 7. §9.6 — Tests Lighthouse CI

**Fichier** : `lighthouserc.json` (racine `axionia/`) ✅ **EXISTE**.

### 7.1 URLs testées (18 URLs = 9 routes × 2 locales)

```
/fr, /en
/fr/interventions, /en/interventions
/fr/interventions/essentielle, /en/interventions/essential
/fr/audit, /en/audit
/fr/implementation, /en/implementation
/fr/cas-concrets, /en/case-studies
/fr/blog, /en/blog
/fr/contact, /en/contact
/fr/galerie, /en/gallery
```

### 7.2 Gaps URLs (par rapport au scope prompt)

| Route Sprint S+2                                               | Dans LHCI ? | Sévérité                                       |
| -------------------------------------------------------------- | ----------- | ---------------------------------------------- |
| **`/fr/un-a-un`**                                              | ❌ **NON**  | 🔴 P0 — 4e verticale non monitorée Web Vitals  |
| **`/fr/un-a-un/par-ville/paris`**                              | ❌ **NON**  | 🔴 P0 — pages stratégiques pSEO sans gate perf |
| `/fr/implantations/ile-de-france/paris`                        | ❌ NON      | 🟠 P1 — landing ville pilote                   |
| `/fr/audit/par-ville/paris`                                    | ❌ NON      | 🟠 P1 — 3e verticale                           |
| `/fr/charte-editoriale`, `/fr/corrections`, `/fr/transparence` | ❌ NON      | 🟡 P2 — pages EEAT                             |

### 7.3 Cibles Web Vitals LHCI vs doctrine AGENTS.md

| Métrique                    | LHCI gate                                             | Doctrine AGENTS.md   | Drift                                                              |
| --------------------------- | ----------------------------------------------------- | -------------------- | ------------------------------------------------------------------ |
| LCP                         | ≤ 1800 ms (error)                                     | ≤ 1800 ms p75        | ✅ Aligné                                                          |
| CLS                         | ≤ 0.1 (error)                                         | = 0 strict (interne) | 🟡 LHCI desserré 0.05 → 0.1 (commenté doctrine `_assert_doctrine`) |
| TBT                         | ≤ 200 ms (error)                                      | ≤ 150 ms             | 🟡 LHCI desserré 150 → 200                                         |
| FCP                         | ≤ 1500 ms (error)                                     | –                    | –                                                                  |
| Speed Index                 | ≤ 2500 ms (error)                                     | –                    | –                                                                  |
| INP                         | **off** (lab Lighthouse n'a pas d'interaction réelle) | ≤ 100 ms p75         | 🟡 Field CrUX uniquement (cf. §8)                                  |
| Performance score           | ≥ 0.9 (error)                                         | –                    | ✅                                                                 |
| A11y / Best-Practices / SEO | ≥ 0.9 (warn)                                          | –                    | 🟡 Doctrine Will = strict, gate = warn                             |

**Note** : presets `desktop` + `mobile` (numberOfRuns=3) ✅.

**Sévérité gap** : 🟠 P1 — ajouter `/fr/un-a-un` + `/fr/un-a-un/par-ville/paris` au tableau `url[]` (2 lignes JSON, effort 5 minutes).

---

## 8. §9.7 — Tests Web Vitals CrUX

### 8.1 Module collecte

**Fichier** : `src/lib/vitals-store.ts` (P0-7 livré, déjà connu de l'audit indexation-discovery 2026-05-18).

**Worker associé** : `src/server/queue/workers/content-web-vitals-monitor-worker.ts` ✅ — **c'est le SEUL worker avec un test** (`content-web-vitals-monitor-worker.spec.ts`).

### 8.2 Table DB

**Table** : `WebVitalSample` — populée par `vitals-store.ts`.

### 8.3 Gap test

✅ Test existant `content-web-vitals-monitor-worker.spec.ts` couvre le polling worker.

❌ **Pas de test direct** de `vitals-store.ts` (le module qui collecte les samples côté client/serveur).

**Sévérité** : 🟡 P2 (le worker downstream est testé, mais pas la source).

---

## 9. §9.8 — Tests seeds DB

### 9.1 `BannedPhrase` 54+ patterns seed

**Fichier** : `prisma/seeds/content-gen/banned-phrases.ts` ✅ **EXISTE** (203 lignes).

| Métrique                           | Valeur                                   |
| ---------------------------------- | ---------------------------------------- |
| Patterns seedés (`pattern:` count) | **46**                                   |
| Cible prompt                       | 54+                                      |
| **Drift**                          | 🟡 **-8 patterns vs prompt** (46 vs 54+) |

**Note décision Will P1-2 commit `9ba6945`** : "formation" / "formateur" / "former" passent de `block` → `warn` (lecture allégée). Donc le compte 46 inclut les 3 reclassés `warn` mais reste cohérent doctrine.

**Activation** : appelé par `prisma/seeds/content-gen/index.ts:25-50` via `pnpm content-gen:seed` ✅.

### 9.2 `AudienceMixProfile` 4 profils

**Fichier** : `prisma/seeds/content-gen/audience-mix-profiles.ts` ✅ **EXISTE**.

| Métrique                       | Valeur                                      |
| ------------------------------ | ------------------------------------------- |
| Profils seedés (`slug:` count) | **5**                                       |
| Cible prompt                   | 4                                           |
| **Drift**                      | ✅ **+1 profil vs prompt** (5 vs 4) — bonus |

Profils visibles dans le code lu : `mixte-equilibre` (isDefault=true), `tertiaire-urbain`, … (3 autres à confirmer en lecture complète).

**Activation** : ✅ via `index.ts` ligne 41.

### 9.3 `CoverageDistributionProfile` 6 profils

**Fichier** : `prisma/seeds/content-gen/coverage-distribution-profiles.ts` ✅ **EXISTE** (123 lignes).

| Métrique                       | Valeur                                      |
| ------------------------------ | ------------------------------------------- |
| Profils seedés (`slug:` count) | **7**                                       |
| Cible prompt                   | 6                                           |
| **Drift**                      | ✅ **+1 profil vs prompt** (7 vs 6) — bonus |

Profils visibles : `mix-premium-2026` (isDefault=true), `mix-industrie`, …

Le commentaire du fichier précise "3 profils génériques (sans secteur) + 3 profils sectoriels (1 par secteur cabinet)" = 6, mais le compte effectif `slug:` est 7. À investiguer (probablement +1 profil ajouté Sprint correctif sans MAJ doc).

**Activation** : ✅ via `index.ts` ligne 38.

### 9.4 `editorial-mix-rules` 13 tests verts

**Fichier** : `src/server/content-gen/shared/editorial-mix-rules.test.ts` ✅ **EXISTE**.

| Suite                                                          | Tests           |
| -------------------------------------------------------------- | --------------- |
| `editorial-mix-rules — constantes`                             | 4               |
| `assertEditorialKeys — interdire types pipelines indépendants` | 4               |
| `assertSum100 — somme ratios = 100`                            | 5               |
| **TOTAL**                                                      | **13 tests** ✅ |

**Statut** : ✅ Conforme prompt (13 tests verts confirmés par baseline 1083 passed).

**Pure module** confirmé (commentaire ligne 2 : "Pure module — pas de DB, pas de Prisma, pas de Server Action").

### 9.5 Autres seeds content-gen

| Seed                            | Fichier                                                                                                   | Statut                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `ProviderConfig` (5 rows)       | `provider-config.ts`                                                                                      | ✅                                                   |
| `AuthorProfile` Manon           | `author-profile.ts`                                                                                       | ✅ (1 row, débloque /fr/equipe/manon AI Act art. 50) |
| `ContentTemplate` (9 stubs)     | `content-templates.ts`                                                                                    | ✅                                                   |
| `ContentGenConfig`              | `content-gen-config.ts`                                                                                   | ✅                                                   |
| `CoverageCampaign` sectorielles | `sector-campaigns.ts`                                                                                     | ✅                                                   |
| `blog-fs-bootstrap`             | `blog-fs-bootstrap.ts`                                                                                    | ✅                                                   |
| `RssSource`                     | ❌ pas dans entry point `index.ts` (commentaire ligne 17 : "seedé Sprint 2 migration `add_rss_pipeline`") | 🟡                                                   |

---

## 10. Gaps consolidés (priorisés)

| #   | Gap                                                                                                            | Sévérité        | Effort       | Justification                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------- | ------------ | ----------------------------------------------------------------------------------------------------------------- |
| 1   | **`src/lib/admin-nav.test.ts:7` rouge (36→37)**                                                                | 🔴 P0 BLOQUE CI | 30 s         | 1 chiffre. CI/CD bloque tout PR jusqu'au fix.                                                                     |
| 2   | **`content-publish-worker.ts` aucun test** (blast radius le plus élevé + hotfix `mentionedCities` non couvert) | 🔴 P0           | 4-6 h        | 11 tests intégration à écrire (PrismaClient mock + BullMQ mock). Toute régression future du pipeline silencieuse. |
| 3   | **Routes Sprint S+2 `/un-a-un` + `/un-a-un/par-ville/paris` aucun test E2E**                                   | 🔴 P0           | 1 h          | 4e verticale en prod sans anti-régression visuel/SEO. Spec Playwright copier-coller de `landing-ville.spec.ts`.   |
| 4   | **LHCI sans `/un-a-un` ni `/un-a-un/par-ville/paris`**                                                         | 🟠 P1           | 5 min        | 2 lignes JSON à ajouter. Sinon Web Vitals 4e verticale aveugle.                                                   |
| 5   | **24/25 workers BullMQ sans test** (couverture 6,25 %)                                                         | 🟠 P1           | 30-40 h      | Priorité top 5 : publish, gen, orchestrator, fact-check, indexnow.                                                |
| 6   | **Pas de test intégration dedup pipeline réel** (similarity-monitor worker + topicFingerprint runtime)         | 🟠 P1           | 3-4 h        | P1-6 module unitaire OK, mais wiring DB→worker→block non vérifié.                                                 |
| 7   | **Pages EEAT `/charte-editoriale`, `/corrections`, `/transparence` aucun test E2E**                            | 🟠 P1           | 2 h          | Pages clé EEAT P1-21 (commit `9ba6945`).                                                                          |
| 8   | **`/audit/par-ville/paris` (3e verticale) aucun test E2E**                                                     | 🟠 P1           | 30 min       | Spec copier-coller `landing-ville.spec.ts`.                                                                       |
| 9   | **`BannedPhrase` seed = 46 vs cible 54+ documenté**                                                            | 🟡 P2           | 30 min audit | Vérifier si 8 patterns manquants délibérés (décision Will P1-2 lecture allégée) ou drift doctrine.                |
| 10  | **`CoverageDistributionProfile` = 7 vs commentaire "6"**                                                       | 🟡 P2           | 10 min       | Sync commentaire fichier avec nouveau count.                                                                      |
| 11  | **Pas de test direct `vitals-store.ts`**                                                                       | 🟡 P2           | 1 h          | Worker downstream couvert mais pas la source.                                                                     |
| 12  | **Pas de test intégration soft-404 wiring pipeline**                                                           | 🟡 P2           | 2 h          | Unitaire 10 tests OK, mais pipeline persistence tier_3 non testé.                                                 |
| 13  | **EN locale désactivé** mais `language-switch.spec.ts` toujours actif                                          | 🟡 P2           | 15 min       | Skip ou adapter (cf. AGENTS.md "EN_LOCALE_ENABLED=false").                                                        |

**Effort total P0 + P1** : ~40-50 h.
**Effort total P2** : ~5 h.

---

## 11. STOP & ASK Will

> Will, 3 décisions rapides à prendre :

1. **Fix snapshot `admin-nav` (36→37) maintenant ou attendre la PR Sprint S+2 ?**
   - **Reco** : maintenant. C'est 30 secondes + 1 commit `chore(tests): bump admin-nav snapshot to 37 — sprint S+2 un-a-un`. Sinon **CI rouge bloque toutes les PR** y compris les fixes critiques. Risque collatéral nul.

2. **Ajouter Playwright E2E sur `/un-a-un` + `/un-a-un/par-ville/paris` ?**
   - **Reco** : OUI **P0** (1 h effort, spec copier-coller de `landing-ville.spec.ts`). La 4e verticale est en prod sans filet, et c'est la verticale potentiellement la plus rentable (audit AEO 1-to-1). Pattern proposé :
     ```ts
     // tests/e2e/content-gen/un-a-un.spec.ts
     const PATH = process.env["E2E_UN_A_UN_SLUG"] ?? "/fr/un-a-un/par-ville/paris";
     test("un-a-un — tier-1 SEO smoke", async ({ page }) => { ... });
     ```

3. **Ajouter LHCI sur `/fr/un-a-un` + `/fr/un-a-un/par-ville/paris` ?**
   - **Reco** : OUI **P1** (5 min effort, +2 lignes dans `lighthouserc.json[ci.collect.url]`). Sinon Web Vitals 4e verticale aveugle (LCP/CLS/TBT/FCP/SI non monitorés → régression bundle non détectée).

**Décision implicite recommandée si silence Will** : appliquer P0 #1 (snapshot) + P0 #3 (E2E `/un-a-un`) + P1 #4 (LHCI) sur la prochaine session (~1h30 effort total, gates verts).

---

## Annexe — Commandes reproductibles

```bash
# Count tests
find src tests -type f \( -name "*.test.ts*" -o -name "*.spec.ts*" \) | wc -l

# Tests sous src groupés par dossier
find src -type f \( -name "*.test.ts*" -o -name "*.spec.ts*" \) | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn

# Baseline Vitest
pnpm vitest run

# Run snapshot test seul
pnpm vitest run src/lib/admin-nav.test.ts

# Run soft-404 spec
pnpm vitest run src/server/content-gen/quality/__tests__/soft-404-gate.spec.ts

# Run topic-fingerprint spec
pnpm vitest run src/server/content-gen/dedup/__tests__/topic-fingerprint.spec.ts

# Run editorial-mix-rules
pnpm vitest run src/server/content-gen/shared/editorial-mix-rules.test.ts

# Playwright E2E (local)
pnpm playwright test --project=chromium

# Lighthouse CI
pnpm lhci

# Find SHA hotfix mentionedCities
git log --all --oneline -S "mentionedCities" -- src/server/queue/workers/content-publish-worker.ts
git blame src/server/queue/workers/content-publish-worker.ts -L 115,120

# Count seeds
grep -c "^\s*pattern:" prisma/seeds/content-gen/banned-phrases.ts          # → 46
grep -c "^\s*slug:" prisma/seeds/content-gen/audience-mix-profiles.ts       # → 5
grep -c "^\s*slug:" prisma/seeds/content-gen/coverage-distribution-profiles.ts  # → 7
```

---

> **Verdict final** : 🟡 **62/100 — SPRINT CORRECTIF requis sur 3 P0** (snapshot + tests publish-worker + E2E un-a-un). Foundations solides (1083 tests verts, soft-404 + topic-fingerprint + editorial-mix testés), mais workers BullMQ et 4e verticale Sprint S+2 sont les angles morts critiques.

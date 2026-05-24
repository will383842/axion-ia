# A12 — Console Admin : Suivi & UX
## Audit forensique Content-Gen Perfection 2026 · Phase 1

**Commit audité :** `2b98a7067d7eae701dec42a2c5d6e859364e0e64`
**Date :** 2026-05-21
**Mode :** AUDIT-ONLY STRICT — 0 invention, tout cité fichier:ligne.

---

## Mission

Auditer les pages admin `/content-gen/**`, les dashboards, les funnels éditoriaux, l'UX, et les mécanismes de GSC API, refresh strategy, drip publishing, anomaly detection, reporting hebdo.

---

## Méthode

1. Inventaire exhaustif via `find` de tous les `page.tsx` et composants `_v2/*.tsx` sous `src/app/[locale]/(admin)/[adminPrefix]/content-gen/`.
2. Lecture directe des composants V2 principaux (dashboard, publications, review-queue, costs, keyword-tracking, quality, publications-status, city-coverage, similarity-monitor, orchestrator).
3. Lecture de `src/server/content-gen/seo/gsc-client.ts`, `bing-wmt-client.ts`, `scheduler/anti-burst.ts`, `shared/content-gen-alerts.ts`, `queue/workers/content-orchestrator-worker.ts`.
4. Grep sur `MAX_PUBLISH_PER_DAY`, `drip`, `dailyCap`, `refresh`, `anomaly`, `weekly.*report` dans `src/`.
5. Lecture des workflows `.github/workflows/gsc-crawl-stats-weekly.yml` et `nightly.yml`.

---

## État observé

### Q1 — Inventaire des pages `/content-gen/**`

**46 routes page.tsx existantes** (tous avec leurs doubles V1/V2) :

| Route | Fichier |
|---|---|
| `/content-gen` | `page.tsx` → `ContentGenDashboardV2` |
| `/content-gen/author/manon` | `author/manon/page.tsx` |
| `/content-gen/city-coverage` | `city-coverage/page.tsx` |
| `/content-gen/costs` | `costs/page.tsx` |
| `/content-gen/coverage` | `coverage/page.tsx` (liste campagnes) |
| `/content-gen/coverage/new` | `coverage/new/page.tsx` |
| `/content-gen/coverage/[id]` | `coverage/[id]/page.tsx` |
| `/content-gen/geo` | `geo/page.tsx` (cockpit géo) |
| `/content-gen/geo/[villeSlug]/generate` | `geo/[villeSlug]/generate/page.tsx` |
| `/content-gen/geo/batches` | `geo/batches/page.tsx` |
| `/content-gen/geo/batches/new` | `geo/batches/new/page.tsx` |
| `/content-gen/geo/batches/[id]` | `geo/batches/[id]/page.tsx` |
| `/content-gen/geo/history` | `geo/history/page.tsx` |
| `/content-gen/jobs` | `jobs/page.tsx` |
| `/content-gen/jobs/[id]` | `jobs/[id]/page.tsx` |
| `/content-gen/kb-readonly` | `kb-readonly/page.tsx` |
| `/content-gen/kb-readonly/[id]` | `kb-readonly/[id]/page.tsx` |
| `/content-gen/keyword-tracking` | `keyword-tracking/page.tsx` |
| `/content-gen/landing-variants` | `landing-variants/page.tsx` |
| `/content-gen/landing-variants/[variant]` | `landing-variants/[variant]/page.tsx` |
| `/content-gen/onboarding` | `onboarding/page.tsx` |
| `/content-gen/orchestrator` | `orchestrator/page.tsx` |
| `/content-gen/publications` | `publications/page.tsx` |
| `/content-gen/publications/[id]/edit` | `publications/[id]/edit/page.tsx` |
| `/content-gen/publications-status` | `publications-status/page.tsx` (kanban) |
| `/content-gen/quality` | `quality/page.tsx` |
| `/content-gen/queue` | `queue/page.tsx` (BullMQ inspect) |
| `/content-gen/review-queue` | `review-queue/page.tsx` |
| `/content-gen/review-queue/[id]` | `review-queue/[id]/page.tsx` |
| `/content-gen/rss` | `rss/page.tsx` |
| `/content-gen/rss/new` | `rss/new/page.tsx` |
| `/content-gen/rss/[id]` | `rss/[id]/page.tsx` |
| `/content-gen/similarity-monitor` | `similarity-monitor/page.tsx` |
| `/content-gen/templates` | `templates/page.tsx` |
| `/content-gen/templates/new` | `templates/new/page.tsx` |
| `/content-gen/templates/[id]` | `templates/[id]/page.tsx` |
| `/content-gen/settings` | `settings/page.tsx` |
| `/content-gen/settings/audience-mix` | settings |
| `/content-gen/settings/banned-phrases` | settings |
| `/content-gen/settings/batches` | settings |
| `/content-gen/settings/coverage-distribution` | settings |
| `/content-gen/settings/kb-ingest` | settings |
| `/content-gen/settings/kill-switch` | settings |
| `/content-gen/settings/llms-txt` | settings |
| `/content-gen/settings/policies` | settings |
| `/content-gen/settings/providers` | settings |
| `/content-gen/settings/qa-policies` | settings |
| `/content-gen/settings/quality-loop` | settings |
| `/content-gen/settings/search-intent-distribution` | settings |

**ABSENT :** `/content-gen/articles` (aucun répertoire `articles/` trouvé). Les articles sont accessibles via `/content-gen/publications` (liste) et `/content-gen/publications/[id]/edit` (détail/edit). Pas de `/content-gen/keywords` (CRUD keywords seeds). Pas de `/content-gen/errors` (Sentry pull).

---

### Q2 — Dashboard root `/content-gen` : KPIs affichés

Source : `ContentGenDashboardV2.tsx:100-116`

**8 AdminStatCard KPIs 7 jours :**
- Jobs (7j)
- Publiés (7j)
- Failed (7j) — ton warning si > 0
- En revue (pending)
- Coût 7j (USD)
- Score qualité moyen
- Plagiat bloqués
- KB entries (chunks)

**Rollup aujourd'hui :** 5 cartes par secteur (interventions_formations, audits, implementations, landing_ville, blog_from_rss) — publiés/générés du jour + failedToday + campagnesActive. Source : `getSectorBreakdownToday()`.

**Queue temps réel :** running / waiting / failed. Lien BullMQ inspect.

**Génération unitaire :** 6 QuickGenForm (landing_ville, blog_from_title, blog_from_keywords, comparison, guide_pilier, faq_standalone).

---

### Q3 — Page `/content-gen/publications` : filtres, colonnes

Source : `PublicationsV2.tsx`

**Filtres :** statut (published/draft/archived) + tier (tier_1_indexable / tier_2_noindex_follow / tier_3_noindex_nofollow). Filtre GET form.

**Colonnes :** Publié le | Titre (+ slug code) | Tier | Quality | SEO | Actions.

**Pagination :** `take: 100` hardcodé — **ABSENT de vraie pagination** pour > 100 articles.

**Colonnes absentes :** ville, type de contenu, verticale/secteur. **P1.**

**Tri :** `orderBy: publishedAt DESC` fixe. Aucun tri interactif côté UI.

---

### Q4 — Page `/content-gen/publications/[id]/edit`

Source : `PublicationEditV2.tsx`

**Édit possible :** oui — titre, slug, excerpt, metaTitle, metaDescription, body HTML (textarea mono). Server Action `updateArticle` + revalidate + IndexNow ping tier-1.

**Re-generate / re-review :** absent de cette page. La review se fait via `/review-queue/[id]`. Pas de bouton "Re-générer" sur l'édit article.

**Suppression :** formulaire DELETE (confirmation tapée) → `deleteArticle`.

---

### Q5 — Page `/content-gen/campaigns` : EXISTE-T-ELLE ?

**Le répertoire `campaigns/` n'existe pas.** La fonctionnalité est sous `/content-gen/coverage` (qui correspond aux `CoverageCampaign` Prisma). L'URL demandée `/content-gen/campaigns` retournerait 404.

**Verdict :** Will a utilisé le mot "campaigns", l'implémentation utilise "coverage". Fonctionnellement présent (CRUD complet : list/new/detail). La sémantique URL diverge. **P1** (pas P0 car la fonctionnalité existe).

---

### Q6 — Page `/content-gen/keywords` : CRUD keywords ?

**Absent.** Il y a `/content-gen/keyword-tracking` (lecture seule, GSC + SerpAPI data) mais pas de page CRUD pour gérer les 747 seeds keywords (`src/server/content-gen/seeds/keywords/`). La gestion des seeds keywords est faite uniquement via scripts CLI. **P1.**

---

### Q7 — Page `/content-gen/city-coverage`

Source : `CityCoverageV2.tsx`

**Présente et complète.** Matrice villes × 8 dimensions × 18 critères (données data-quality, pas copy rédigée). KPIs : totalCities / indexableCities / avgScorePct / perfectCities. Par ville : INSEE code, population, région, indexable badge, globalScorePct, greenCount/totalCriteria, lastReviewedOn. Pas de colonne verticale × type (c'est une matrice qualité-data, pas une matrice contenu).

---

### Q8 — Funnel visuel draft → published → indexed

Source : `PublicationsStatusV2.tsx` (kanban 5 colonnes)

**Funnel kanban présent :** Brouillon (queued/running) | En revue (needs_review) | Approuvé (approved + promotedToTier1At=null) | Publié | Refusé/Failed. Chaque colonne : 30 derniers items + overflow "+N autres".

**ABSENT :** colonne "Indexé" (articleId indexedAt tracké en DB mais non représenté dans le kanban). La 6e colonne "Indexé par Google" manque. **P1.**

**Drag & drop :** commenté `drag&drop V1.5` dans la description — non implémenté.

---

### Q9 — Cost tracker Claude API

Source : `CostsV2.tsx`

**Présent et fonctionnel.** Par provider (30j) : Provider | Coût | Tokens in | Tokens out | Cap mensuel | % utilisé (rouge si ≥ 80%). Résumé header : mois courant + 7j. Projection fin de mois : placeholder ("nécessite ≥ 7j historique, Sprint 5+").

---

### Q10 — GSC API ingestion

Source : `gsc-client.ts`

**Architecture :** OAuth refresh token flow (pas SDK googleapis). 4 env vars requises : `GSC_OAUTH_CLIENT_ID`, `GSC_OAUTH_CLIENT_SECRET`, `GSC_OAUTH_REFRESH_TOKEN`, `GSC_PROPERTY_URL`. Cache access_token 55 min in-process.

**Fonctions :** `gscTopKeywordsForUrl()` (top 10 keywords/article, 28j fenêtre) + `gscInspectUrl()` (URL Inspection API, quota 2000 req/jour).

**Cron hebdo GH Actions :** `.github/workflows/gsc-crawl-stats-weekly.yml` — lundi 08:00 UTC → `scripts/perf/export-gsc-crawl-stats.mjs` → commit CSV `_AUDIT/crawl-stats-YYYY-WW.csv`. Fail-soft si secrets absents.

**Worker BullMQ :** `content-keyword-sync-worker` — cron lundi 04:00 UTC, skeleton V1 (activation Sprint 12.5 quand credentials fournis). Source : `src/server/queue/queues.ts:201-210`.

**Modèle DB :** `KeywordTracking` (@@map `keyword_tracking`) — source: gsc/serpapi/manual, position, positionDelta, ctr, impressions, clicks, syncedAt, targetUrl.

**ABSENT :** modèle `GscMetric` ou table d'historique agrégé quotidien. Les données GSC vont directement dans `KeywordTracking` sans table intermédiaire séparée.

---

### Q11 — Bing WMT API ingestion

Source : `bing-wmt-client.ts`

**Architecture :** env var `BING_WMT_API_KEY`. Fonctions read-only : `bingWmtGetCrawlStats()` (28j), `bingWmtGetUrlInfo()` (indexation URL), `bingWmtGetQuota()` (quota restant). Graceful degrade si clé absente.

**Page admin :** ABSENTE. Les données Bing WMT sont disponibles côté serveur mais aucune page admin ne les affiche. **P1.**

**Modèle DB :** ABSENT. Pas de table `BingMetric` en Prisma (confirmé par grep). Les stats crawl Bing ne sont pas persistées.

---

### Q12 — Variable `MAX_PUBLISH_PER_DAY`

**ABSENT** de tout le codebase (`src/` grep 0 résultat).

**Ce qui existe à la place :** `dailyBatchSize` (default 20, configurable 1-1000 via `/settings/batches`) + `antiBurstEnabled` (true par défaut). L'anti-burst étal les jobs sur 24h proportionnellement. Source : `anti-burst.ts` + `content-orchestrator-worker.ts:107-154`.

**Gap :** le `dailyBatchSize` contrôle le nombre de jobs *générés*, pas le nombre de contenus *publiés* par jour. La distinction génération vs publication n'est pas bornée par une variable dédiée. **P0 mitigé :** l'anti-burst existe mais ne plafonne pas explicitement la publication (distincte de la génération).

---

### Q13 — Drip schedule : publications étalées 8h-22h CET ?

**ABSENT.**

L'anti-burst (`computeAntiBurstSchedule`) étal les *générations* sur 24h UTC proportionnellement à l'heure de la journée. Il n'y a pas de fenêtre horaire 8h-22h CET, pas de pause week-end, pas de planification de l'heure de *publication* (distincte de la génération). Le worker orchestre déqueue toutes les 15 min, jour et nuit, y compris week-end.

Source : `content-orchestrator-worker.ts` + `anti-burst.ts` — aucune référence horaire CET / week-end.

**P1** (risque anti-burst Google si volume élevé).

---

### Q14 — Refresh strategy : articles > 6 mois flagués auto ?

**ABSENT.** Aucun worker `content-refresh`. Aucune colonne `refreshDueAt` ou `staleSince` dans `Article`. `dateModified` est mis à jour lors d'un `updateArticle` manuel (`PublicationEditV2`). Pas d'auto-détection staleness.

Ce qui existe côté lifecycle : `content-tier-lifecycle-worker` (cron mensuel le 15 du mois) — demote candidates CTR < 1% + promote CTR > 5%. Ce n'est pas un refresh de contenu mais une rétrogradation de tier.

**P1.**

---

### Q15 — Anomaly detection : alertes si quality_score drops ou refusal_rate spike

**Partiellement présent — mais non câblé pour quality_score drops.**

**Alertes Telegram existantes dans `content-gen-alerts.ts` :**
- `alertBatchFail` : 5 jobs failed consécutifs sur même type → Telegram INCIDENT. Câblé dans le worker.
- `alertCostCap80` / `alertCostCap100` : provider ≥ 80% / 100% mensuel.
- `alertProviderDown5min` / `alertProviderDown30min` : circuit ouvert provider.
- `alertQueueStuck` : queue waiting > 30 min sans progression. Commenté "à câbler V1.5".
- `alertSoft404Detected` : câblé "à câbler V1.5".
- `alertIndexationStagnant` : CTR < 1% après 90j. "À câbler V1.5".
- `alertLcpDegraded` / `alertInpDegraded` / `alertClsDegraded` : web vitals.

**ABSENT :** alerte spécifique `quality_score < seuil` (ex. avgQualityScore7d < 70), pas de refusal_rate tracking dans les alertes, pas de spike detection. Les 16 alertes Telegram ne couvrent pas l'anomalie quality_score longitudinale.

**P1.**

---

### Q16 — Reporting hebdo email Will

**ABSENT dans le code.**

Aucun `sendWeeklyReport`, aucun template email hebdo content-gen, aucun cron GH Actions lundi 8h CET envoyant un digest. Le GSC crawl stats export (lundi 08:00 UTC) pousse un CSV dans `_AUDIT/` mais n'envoie pas d'email.

**P1.**

---

### Q17 — Page admin `/errors` qui pull API Sentry

**ABSENTE.** Aucune route `/content-gen/errors` ou `/errors`. Sentry est câblé en capture workers (Sprint S+4-C) mais aucune page admin ne l'interroge via API. **P1.**

---

### Q18 — Sandbox preview mode

**PRÉSENT et fonctionnel.**

Source : `src/app/api/content-gen/preview/[jobId]/route.ts` + `ReviewDetailV2.tsx:62-66`

- URL : `/api/content-gen/preview/{jobId}?t={JWT_10min}`
- Token : `createPreviewToken(jobId)` — JWT signé, TTL 10 min, vérifié serveur.
- Rendu : HTML minimal stylé, DOMPurify sanitized, `X-Frame-Options: SAMEORIGIN`, `noindex,nofollow`.
- Affiché en iframe `sandbox="allow-same-origin"` dans `ReviewDetailV2`.

**Conformité :** URL format `/_preview/article/[id]?token=<JWT>` (demandé) vs implémenté `/api/content-gen/preview/[jobId]?t=<JWT>`. Fonctionnellement équivalent.

---

### Q19 — Approval workflow

**PRÉSENT avec 5 statuts review.**

Source : `ReviewQueueListV2.tsx:15-21`, `ReviewDetailV2.tsx`

Workflow réel : `needs_review (job)` → review queue → `pending` → `approved` (tier-2) ou `promoted_t1` ou `needs_edits` ou `rejected`.

States `ReviewStatus` : `pending | approved | rejected | needs_edits | promoted_t1`.

**Gap vs spec demandée :** le funnel `draft → review_pending → human_approved → published` n'est pas exactement mapé — les noms sont `queued/running → needs_review → approved/promoted_t1 → published`. Sémantiquement équivalent.

**Re-prompt LLM :** `requestEdits(id, comment)` disponible dans `ReviewDetailV2` — relance le LLM avec guidance humaine.

---

### Q20 — Bulk actions

**PRÉSENT dans `PublicationsStatusV2`.**

Source : `PublicationsStatusV2.tsx:81-121`

- `bulkApproveReviews(minScore, 100)` : approuve tous les pending avec qualityScore ≥ minScore (défaut 75).
- `bulkRejectReviews(maxScore, 100)` : rejette tous les pending avec score ≤ maxScore (défaut 50).
- `retryAllFailed()` : retry tous les jobs failed.

**ABSENT :** sélection checkbox individuelle N articles. Les bulk actions sont globales (tous les pending ≥/≤ seuil), pas granulaires. **P1** (UX bulk sélection checkboxes manquante).

---

### Q21 — Mobile UX / WCAG AA

**Partiellement conforme.**

- `AdminSidebarNav.tsx:12` : "Min target size WCAG 2.2 §2.5.8" mentionné.
- `AdminFormField.tsx:8-9` : `aria-invalid + aria-errormessage (WCAG 3.3.1)`, `aria-describedby (WCAG 1.3.1)`.
- `AdminPagination.tsx:60,86` : `tabIndex` correct.
- `AdminBulkActions.tsx:32` : `role="toolbar"`.
- `AdminErrorState.tsx:45` : `role="alert"`.
- Focus visible : classes `focus-visible:ring-2` sur boutons et liens.
- Tables : pas de `<caption>` explicite sur les `admin-table` content-gen.
- Responsive : `AdminPageShell` utilise Tailwind responsive classes (grid `sm:grid-cols-2 lg:grid-cols-8`).

**ABSENT :** skip-to-main link sur les pages content-gen. Pas d'audit WCAG AA complet automatisé en CI (ZAP baseline nightly = sécu, pas a11y).

---

## Findings — Tableau P0 / P1 / P2

### P0 — Bloquants production

| # | Finding | Impact | Fichier |
|---|---|---|---|
| P0-1 | `MAX_PUBLISH_PER_DAY` absent — pas de cap explicite sur la publication quotidienne (distinct de génération). L'anti-burst étal les générations mais ne borne pas combien d'articles sont publiés/pingés Google par jour. Risque burst indexation si workers coincident. | Risque signal Google spam si > 50-100 publications/jour sans cap | `content-orchestrator-worker.ts` — anti-burst ne couvre que la génération |

### P1 — Importants (sprint prochain)

| # | Finding | Impact | Fichier |
|---|---|---|---|
| P1-1 | Page `/content-gen/articles` inexistante. Les articles sont sous `/publications`. La page publications manque : colonnes ville / type / secteur, tri interactif, vraie pagination (hardcoded `take: 100`). | Scalabilité > 100 articles + UX colonnes | `PublicationsV2.tsx:45-51` |
| P1-2 | Page `/content-gen/campaigns` absente — route est `/content-gen/coverage`. URL sémantique divergente. | Confusion navigation Will | Répertoire `coverage/` |
| P1-3 | Page `/content-gen/keywords` (CRUD seeds) absente. Gestion 747 keywords uniquement via scripts CLI. | Pas de gestion admin seeds | — |
| P1-4 | Bing WMT API client opérationnel (`bing-wmt-client.ts`) mais 0 page admin l'affichant. Crawl stats Bing non persistées (pas de table DB). | Observabilité Bing aveugle | `bing-wmt-client.ts` |
| P1-5 | Drip schedule 8h-22h CET absent. Publications nocturnes et week-end possibles. | Risque anti-burst Google | `content-orchestrator-worker.ts` |
| P1-6 | Refresh strategy absente : articles > 6 mois non flagués automatiquement, `dateModified` non mis à jour auto. | Staleness signal SEO | — |
| P1-7 | Anomaly detection quality_score : aucune alerte si avgQualityScore7d < seuil ou refusal_rate spike. `alertBatchFail` couvre les fails, pas les dérives quality. | Drift qualité invisible | `content-gen-alerts.ts:140-157` |
| P1-8 | Reporting hebdo email Will : absent. GSC CSV GH Actions commit mais pas d'email digest. | Will non notifié automatiiquement des KPIs semaine | `.github/workflows/gsc-crawl-stats-weekly.yml` |
| P1-9 | Page `/errors` pull Sentry API : absente. Sentry capture workers câblé mais non consultable en admin. | Debug workers nécessite Sentry UI externe | — |
| P1-10 | Kanban `publications-status` : colonne "Indexé par Google" absente (champ `indexedAt` Article existe). | Funnel incomplet | `PublicationsStatusV2.tsx` |
| P1-11 | Bulk actions sur checkbox individuelle absente. Seules les bulk globales (approuver tous ≥ seuil) disponibles. | UX granularité | `PublicationsStatusV2.tsx:81-121` |
| P1-12 | Similarity monitor (couche C cosine/Jaccard) : page stub, worker et table `SimilarityPair` prévus Sprint 4 non livrés. | Anti-doublon post-publication inactif | `SimilarityMonitorV2.tsx` |

### P2 — Souhaitable (V1.5+)

| # | Finding | Impact | Fichier |
|---|---|---|---|
| P2-1 | Projection coût fin de mois dans `CostsV2` : placeholder "nécessite ≥ 7j historique". | Prévisionnel budget manquant | `CostsV2.tsx:68-74` |
| P2-2 | Keyword tracking table : `take: 200` hardcodé, pas de pagination réelle. Filtre position ok mais pas de filtre par URL. | Scalabilité > 200 keywords trackés | `KeywordTrackingV2.tsx:49` |
| P2-3 | Quality dashboard : bars CSS uniquement, pas de courbe temporelle interactive. Données 30j agrégées par jour mais visualisation basique. | UX graphes | `QualityV2.tsx` |
| P2-4 | Drag & drop kanban annoncé "V1.5" dans description `publications-status`. | UX kanban | `PublicationsStatusV2.tsx:66` |
| P2-5 | Skip-to-main link manquant sur pages content-gen (navigation clavier). | WCAG 2.1 §2.4.1 | — |
| P2-6 | Tableaux `admin-table` sans `<caption>` ni `aria-labelledby` systématique. | WCAG 1.3.1 | Composants table content-gen |
| P2-7 | `AlertIndexationStagnant` et `alertQueueStuck` documentés "à câbler V1.5" — pas câblés dans un worker actif. | Observabilité | `content-gen-alerts.ts:337,354` |
| P2-8 | `content-keyword-sync-worker` : skeleton V1, activé seulement quand `GSC_OAUTH_*` fournis. Table `KeywordTracking` vide en prod si credentials absents. | Position tracking inactif | `queues.ts:201-210` |

---

## Scoring /45

| Axe | Score | Max | Commentaire |
|---|---|---|---|
| Pages existantes (inventaire) | 4 | 5 | 46 routes réelles, V2 clean. -1 : `/articles` absent, route `/campaigns` vs `/coverage`, `/keywords` absent. |
| KPIs dashboards core + funnels | 5 | 8 | KPIs 7j solides (8 AdminStatCards), rollup secteurs, queue RT, quickgen. -3 : funnel 6e colonne "indexé" absent, pas de cohort view, pas de topic gap dashboard. |
| GSC API + Bing WMT ingestion + crawl errors | 3 | 6 | GSC client prod-ready + cron GH Actions hebdo + worker skeleton. -3 : Bing WMT sans page admin, sans table DB, keyword sync inactif sans credentials. |
| Refresh strategy + drip publishing + anti-burst | 2 | 6 | Anti-burst `computeAntiBurstSchedule` 24h uniforme. -4 : pas de fenêtre 8h-22h CET, pas de pause WE, pas de refresh auto staleness, pas de `MAX_PUBLISH_PER_DAY` cap publication. |
| Anomaly detection + cohort + topic gap + forecasting | 2 | 8 | 16 alertes Telegram dont batchFail + costCap + providerDown. -6 : quality_score anomaly absente, refusal_rate absent, cohort/topic gap/forecasting absents, alertQueueStuck/soft404 non câblés. |
| Performance leaderboard + Reporting hebdo email | 1 | 4 | Quality dashboard 5 scores barres CSS 30j. -3 : leaderboard articles par performance absent, email hebdo Will absent. |
| Indexation timeline + position tracking | 2 | 4 | `KeywordTracking` DB + UI filtrée. -2 : GSC credentials requis, table vide par défaut, indexedAt non affiché kanban. |
| Bulk actions + sandbox preview + approval workflow | 2 | 2 | Preview JWT 10 min iframe SAMEORIGIN : complet. Bulk approve/reject + retry : complet. Approval workflow 5 statuts complet. |
| UX A11y mobile | 2 | 2 | `AdminSidebarNav` WCAG 2.2 §2.5.8, aria-* sur composants UI, focus-visible partout, responsive Tailwind. (-0 : gaps P2 mais non bloquants a11y). |
| **TOTAL** | **23** | **45** | **51 % — SPRINT CORRECTIF** |

---

## Délégations

- **A3 (SEO/AEO)** : position tracking KeywordTracking / GSC ingestion active — dépend credential Coolify.
- **A6 (AI bots / llms.txt)** : page `/settings/llms-txt` présente, contenu à auditer.
- **A8 (editorial mix)** : `settings/coverage-distribution` + `settings/search-intent-distribution` + `settings/audience-mix` — à auditer pour cohérence.
- **A10 (admin)** : UI A11y skip-to-main + caption tables à corriger dans PR admin V2.5.

---

## UNKNOWNs

- **UNKNOWN-1 :** État exact des env vars Coolify `GSC_OAUTH_REFRESH_TOKEN` et `BING_WMT_API_KEY` en production. Si absents, keyword tracking = table vide et Bing WMT = noop silencieux. Non vérifiable sans accès Coolify.
- **UNKNOWN-2 :** Volume publications quotidiennes actuelles en prod. Sans `MAX_PUBLISH_PER_DAY`, le risque de burst Google dépend du `dailyBatchSize` configuré (défaut 20) — acceptable à faible volume.
- **UNKNOWN-3 :** Le `content-keyword-sync-worker` est déclaré dans `worker.ts:63` (`startKeywordSyncWorker()`). Il tourne en prod si `REDIS_URL` est set. Il fait des calls GSC à 04:00 UTC lundi. Si `GSC_OAUTH_*` absents → graceful skip silencieux (0 upsert). Comportement non monitoré.

---

## Références

| Fichier | Rôle |
|---|---|
| `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/_v2/ContentGenDashboardV2.tsx` | Dashboard root V2 |
| `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/publications/_v2/PublicationsV2.tsx` | Liste publications |
| `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/publications-status/_v2/PublicationsStatusV2.tsx` | Kanban + bulk actions |
| `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/review-queue/_v2/ReviewQueueListV2.tsx` | Review queue |
| `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/review-queue/[id]/_v2/ReviewDetailV2.tsx` | Review détail + preview iframe |
| `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/costs/_v2/CostsV2.tsx` | Coûts provider |
| `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/keyword-tracking/_v2/KeywordTrackingV2.tsx` | Keyword tracking |
| `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/quality/_v2/QualityV2.tsx` | Quality dashboard |
| `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/city-coverage/_v2/CityCoverageV2.tsx` | City coverage matrice |
| `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/similarity-monitor/_v2/SimilarityMonitorV2.tsx` | Anti-doublon (stub) |
| `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/orchestrator/_v2/OrchestratorV2.tsx` | Orchestrateur |
| `axionia/src/app/api/content-gen/preview/[jobId]/route.ts` | Preview JWT iframe |
| `axionia/src/server/content-gen/seo/gsc-client.ts` | GSC OAuth client |
| `axionia/src/server/content-gen/seo/bing-wmt-client.ts` | Bing WMT client |
| `axionia/src/server/content-gen/scheduler/anti-burst.ts` | Anti-burst schedule |
| `axionia/src/server/content-gen/shared/content-gen-alerts.ts` | 16 alertes Telegram |
| `axionia/src/server/queue/workers/content-orchestrator-worker.ts` | Orchestrateur BullMQ |
| `axionia/.github/workflows/gsc-crawl-stats-weekly.yml` | GSC export cron lundi 08:00 UTC |
| `axionia/.github/workflows/nightly.yml` | Gate D nightly (Playwright + ZAP + LHCI) |

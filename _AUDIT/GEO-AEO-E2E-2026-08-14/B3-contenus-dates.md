# B3 — Contenus éditoriaux & dates

- **Date** : 2026-08-14, mesures live entre 17:49 et 17:55 UTC (AVANT l'atterrissage du deploy en vol parti à 17:33 UTC — toutes les pages mesurées sont des rendus ISR stables du deploy ~14:57 UTC).
- **Périmètre réellement couvert** : factories JSON-LD `seo-content-gen-factories.ts` (Article / BlogPosting / TechArticle / NewsArticle / QAPage / HowTo), speakable universel, `dateModified` vs `datePublished` sur toutes les surfaces éditoriales (/blog, /actualites, /guides, /connaissances, /faq, /centre-aide), descriptions vides, `foundingDate`, cohérence `dateModified` page ↔ `lastmod` sitemap. Échantillon live : 14 articles blog (10 récents + 4 anciens), 2 guides, 1 fiche connaissances, 2 actualités, 3 fiches FAQ, 2 sitemaps de contenu — 24 URLs, toutes horodatées.

## Résumé exécutif

La tuyauterie dates/schémas est globalement **saine et très au-dessus de la moyenne** : speakable universel réellement émis ET adossé à des éléments `data-aeo` présents dans le HTML, flags AI Act partout, headlines bornés, `lastmod` non gamé (pas de piège BUILD_TIME), QAPage honnête (upvote 0, answerCount 1). Deux vrais trous : (1) **`BlogPosting.description` est vide (`""`) sur 100 % de l'échantillon blog** (14/14) parce que le publish-worker ne persiste jamais `excerpt` — l'`abstract` AEO saute aussi ; (2) **le `dateModified` des pages blog et le `lastmod` du sitemap divergent** (5 mismatches/14) car ils lisent deux colonnes `@updatedAt` différentes (ArticleTranslation vs Article), toutes deux bumpées par des écritures techniques non éditoriales. Zéro P0 : rien de cassé ni de mensonger côté visibilité.

## Findings

### [P1] `BlogPosting.description` vide sur tout le corpus blog DB (et `abstract` jamais émis)

- **Symptôme** : le JSON-LD BlogPosting de chaque article blog content-gen émet `"description": ""` et n'émet pas `abstract` (gated sur truthiness). La méta `<meta name="description">` de la page est, elle, bien remplie — le trou ne concerne QUE le JSON-LD, c'est-à-dire précisément le champ que Perplexity/Claude/AI Overviews consomment comme résumé citable.
- **Preuve code** :
  - `src/server/queue/workers/content-publish-worker.ts:837-852` — `articleTranslation.create({ data: { title, slug, body, bodyText, metaTitle, metaDescription } })` : **`excerpt` n'est jamais écrit** (idem la branche update l.824-836).
  - `src/lib/knowledge/readers.ts:497` — `excerpt: translation.excerpt` (donc null).
  - `src/server/content-gen/blog/loader.ts:198` — `excerpt: dbArticle.excerpt ?? ""`.
  - `src/app/[locale]/blog/[slug]/page.tsx:353` — `description: view.excerpt` (aucun fallback, alors que `/actualites/[slug]/page.tsx:294` fait le bon pattern : `t.excerpt ?? t.metaDescription ?? t.title`).
  - `src/lib/seo-content-gen-factories.ts:172` — `description: input.description` émis inconditionnellement (même `""`) ; l.192 — `abstract` seulement si truthy.
- **Preuve live (2026-08-14 17:51-17:53 UTC)** : 14/14 articles blog échantillonnés (récents ET anciens) → `descLen: 0` sur le nœud BlogPosting (ex. `/fr/blog/formation-ia-trappes`, `/fr/blog/audit-ia-grigny`, `/fr/blog/coach-ia-grenoble-guide-pratique`). En contraste, la meta description HTML de ces mêmes pages est remplie (mesuré 17:51:23 UTC), et NewsArticle (155-158 car.), guides (114-120), connaissances (227) ont tous une description JSON-LD correcte.
- **Root-cause** : le pipeline de publication n'a jamais alimenté `ArticleTranslation.excerpt` ; la page blog ne fait pas le fallback `metaDescription` que la page actualités fait.
- **Patch prescrit** : (a) `src/app/[locale]/blog/[slug]/page.tsx:353` → `description: view.excerpt || view.metaDescription || view.title` (le `view` expose déjà `metaDescription`, loader.ts:197) ; (b) durcir la factory `seo-content-gen-factories.ts:172` pour ne pas émettre une `description` vide (spread conditionnel comme `abstract`). Option complémentaire (non bloquante) : persister `excerpt = metaDescription` au publish pour les futurs articles.
- **Effort** : S (2 lignes + 1 spread). **Impact GEO/AEO** : fort — `description`/`abstract` sont les résumés que les moteurs de réponse citent ; aujourd'hui 134 URLs blog tier-1 (volume sitemap mesuré 17:49 UTC) présentent un champ vide.
- **Risque de régression** : faible. Do-not-touch : `/actualites/[slug]/page.tsx` (déjà correct), contrat `stub.invalid` (aucun rapport), `content-publish-worker` si on se limite au patch page+factory (le test `seo-content-gen-factories.spec.ts` devra couvrir le spread conditionnel).

### [P1] `dateModified` JSON-LD ↔ `lastmod` sitemap désynchronisés — deux colonnes `@updatedAt` techniques différentes

- **Symptôme** : pour un même article, le sitemap blog annonce un `lastmod` différent du `dateModified` du JSON-LD de la page. Google recoupe ces signaux ; des lastmod incohérents finissent ignorés (crawl prioritization perdue), et le `dateModified` prétend à une fraîcheur éditoriale qui est en réalité du churn technique.
- **Preuve code** :
  - Sitemap : `src/app/sitemap.ts:777,795,827` — `lastmod = Article.updatedAt` (colonne `@updatedAt`, prisma/schema.prisma:1236).
  - Page : `src/lib/knowledge/readers.ts:504` — `updatedAt: translation.updatedAt` (**ArticleTranslation**.updatedAt, `@updatedAt`, schema.prisma:1404) → `loader.ts:201` → `blog/[slug]/page.tsx:357` → `dateModified` de la factory (`seo-content-gen-factories.ts:195`).
  - Bumpers non éditoriaux d'`Article.updatedAt` : `content-tier-lifecycle-worker.ts:56-62,73-79` (promote/demote), `content-fact-check-worker.ts:152-155,221-224` (score).
- **Preuve live (2026-08-14 17:49-17:51 UTC)** : sur 14 articles croisés sitemap↔page, 5 mismatches :
  | URL | lastmod sitemap | dateModified page |
  |---|---|---|
  | formation-ia-saint-gratien-roi | 2026-07-20 | 2026-07-21 |
  | coaching-ia-dirigeant-roissy-en-brie | 2026-07-20 | 2026-07-21 |
  | formation-ia-gonesse | 2026-07-19 | 2026-07-21 |
  | audit-ia-grigny | 2026-07-19 | 2026-07-21 |
  | formation-ia-romans-sur-isere-options | 2026-07-17 | 2026-07-21 |
  Le motif « beaucoup d'articles bumpés le 07-03 et le 07-21 » (jours de reprocessing batch du corpus, pas de révision éditoriale) confirme que ces colonnes tracent des écritures mécaniques.
- **Root-cause** : aucune colonne « date de révision éditoriale » n'existe ; deux `@updatedAt` Prisma (auto-bump à TOUTE écriture de la ligne) servent de proxy, et chaque surface lit une colonne différente.
- **Patch prescrit** : court terme (S) — aligner les deux lectures sur la MÊME colonne (le sitemap lit `Article.updatedAt` ; faire lire la même au JSON-LD via `readers.ts:504`, ou l'inverse) → cohérence immédiate. Moyen terme (M) — colonne `contentReviewedAt` éditoriale sur Article, écrite uniquement quand body/title/metaDescription changent (publish + refresh worker), lue par sitemap ET JSON-LD ET bannière « Dernière révision ».
- **Effort** : S (alignement) / M (colonne dédiée + migration). **Impact GEO/AEO** : moyen-fort (fraîcheur = signal de crawl et de citabilité ; incohérence = signal discounté).
- **Risque de régression** : moyen — le sitemap blog a des specs (`sitemap` builders testés) et la bannière visible « Dernière révision » lit la même valeur (blog page l.536-539) : vérifier qu'aligner ne fait pas reculer une date affichée. Do-not-touch : `sitemap-blog.xml/route.ts` (pure sérialisation), gating anti-vide, `datesBySlug` FS.

### [P2] FAQ : `datePublished` glissant — réécrit à chaque relecture (= `dateModified` = `reviewedAt`)

- **Symptôme** : sur `/faq/[slug]`, `datePublished` et `dateModified` du QAPage sont TOUS DEUX la date de relecture. Une fiche relue le 08-12 « perd » son ancienneté (signal d'autorité) et déclare une date de publication qui bouge — pattern proche du date-gaming, à l'inverse de l'intention anti-gaming documentée.
- **Preuve code** : `src/app/[locale]/faq/[slug]/page.tsx:133,151-152` — `const reviewedAt = entry.reviewedAt ?? FAQ_LAST_REVIEWED;` puis `publishedAt: reviewedAt, dateModified: reviewedAt`. 88 entrées de `src/content/transversal.ts` portent `reviewedAt: "2026-08-12"` (comptage grep 17:54 UTC).
- **Preuve live (17:53-17:54 UTC)** : `/fr/faq/geo-france` → `datePublished = dateModified = 2026-08-12T00:00:00.000Z` ; fiches Track B (`/fr/faq/3-quick-wins-…-qu-est-ce-qu-un-quick-win-ia`) → les deux à `2026-06-01` (repli `FAQ_LAST_REVIEWED`). Aucune fiche ne distingue publication et révision.
- **Root-cause** : `FaqEntry` n'a pas de date de publication stable ; `reviewedAt` sert aux deux champs.
- **Patch prescrit** : ajouter `publishedAt?: string` à `FaqEntry` (repli `FAQ_LAST_REVIEWED`), passer `publishedAt: entry.publishedAt ?? FAQ_LAST_REVIEWED` et garder `dateModified: reviewedAt`. Effort S-M (88 entrées à dater une fois — ou repli global unique, S). **Impact GEO/AEO** : moyen (ancienneté + écart datePublished/dateModified = signal valorisé, cf. commentaire seo.ts:1175).
- **Risque de régression** : faible. Do-not-touch : la logique `isFaqItemIndexable`, le fallback `FAQ_LAST_REVIEWED` lui-même (anti BUILD_DATE, audit 2026-06-08 — ne pas revenir à une date qui glisse au deploy).

### [P2] `foundingDate: "2026"` — année seule sur le nœud Organization

- **Symptôme** : le graphe d'identité déclare `foundingDate: "2026"` (année seule, valide schema.org mais imprécis) alors que la date exacte est connue sur pièces (Kbis, n° de gestion 2026B01964, vérifié 2026-08-02 — cf. commentaire du code lui-même l.918-919).
- **Preuve code** : `src/lib/seo.ts:917`.
- **Preuve live (17:51 UTC)** : nœud Organization sur chaque page article échantillonnée → `"foundingDate": "2026"`.
- **Root-cause** : valeur posée avant l'immatriculation, jamais précisée depuis.
- **Patch prescrit** : remplacer par la date d'immatriculation RCS complète (`"2026-07-30"` d'après la mémoire Kbis — **à confirmer sur la pièce par Will avant commit**). Effort S. **Impact GEO/AEO** : faible (précision entité / Knowledge Panel).
- **Risque de régression** : quasi nul. Do-not-touch : `identite-legale-registre.spec.ts` (vérifier s'il fige la valeur), le reste du nœud Organization (surface B1).

### [P2] « Mis à jour le » affiché dès le jour de publication sur /actualites (comparaison à la milliseconde)

- **Symptôme** : chaque actualité affiche « Publié le X · Mis à jour le X » (même jour) dès sa création, et son JSON-LD porte un `dateModified` qui ne diffère du `datePublished` que de ~80 ms — la bannière de révision ne veut plus rien dire.
- **Preuve code** : `src/app/[locale]/actualites/[slug]/page.tsx:284-287` — `showUpdated = updatedAt.getTime() !== publishedAt.getTime()` ; or `publishedAt` est posé en JS au publish et `updatedAt` par Prisma `@updatedAt` à l'écriture → toujours ≠ de quelques ms.
- **Preuve live (17:53-17:55 UTC)** : `/fr/actualites/linus-torvalds-ia-linux-forkez-partez` → JSON-LD `datePublished: 2026-07-17T06:00:48.364Z`, `dateModified: …48.366Z` (2 ms) ; rendu : « Publié le 17/07/2026 · Mis à jour le 17/07/2026 ». Idem `souverainete-numerique…` (516 ms vs 597 ms).
- **Root-cause** : granularité de comparaison inadaptée à un couple date-métier / date-technique.
- **Patch prescrit** : comparer au jour (`toISOString().slice(0,10)`) ou exiger un delta > 24 h. Effort S. **Impact GEO/AEO** : faible (cosmétique fraîcheur, cohérence E-E-A-T affichée).
- **Risque de régression** : nul. Do-not-touch : `updatedIso`/`lastReviewed` (l.283, 374) qui alimentent d'autres blocs.

### [P2] Granularité de dates hétérogène au sein des nœuds et entre surfaces

- **Symptôme** : blog émet des dates tronquées au jour re-sérialisées en minuit UTC (`2026-07-20T00:00:00.000Z`), guides/actualités des timestamps pleins (`06:01:14.916Z`), et une fiche connaissances mélange les deux DANS le même nœud (`datePublished: 2026-08-11T00:00:00.000Z` vs `dateModified: 2026-08-11T09:21:29.785Z`). Aucun impact validateur, mais le mélange trahit des sources hétérogènes et complique tout audit de fraîcheur automatisé.
- **Preuve code** : `src/server/content-gen/blog/loader.ts:116-122` (`isoDate` tronque au jour) vs `guides/actualites` qui passent l'objet `Date` brut (actualites/page.tsx:297-298) ; factories l.194-195 re-sérialisent tel quel.
- **Preuve live (17:51-17:53 UTC)** : valeurs ci-dessus relevées sur `/fr/connaissances/kb-fact-roi-ia-050-fr`, `/fr/guides/guide-audit-ia-grenoble`, blog échantillon.
- **Root-cause** : chaque loader a son propre formatage de date.
- **Patch prescrit** : normaliser (tronquer au jour partout, ou timestamps pleins partout) dans les factories plutôt que dans chaque loader. Effort S. **Impact GEO/AEO** : faible.
- **Risque de régression** : faible ; se fait naturellement avec le patch P1 n°2. Do-not-touch : le fallback figé `"2026-06-08"` de `isoDate` (anti date-de-build, audit 2026-06-08).

## Points contrôlés et VALIDÉS (aucun finding — anti-faux-positifs)

- **Speakable universel** : émis sur BlogPosting, NewsArticle, QAPage, FAQPage, Article guides/connaissances (live 24/24 nœuds concernés `speakable: true`) ET les sélecteurs pointent des éléments réels — `data-aeo="tldr|answer|key-point|expert-quote|people-also-ask|freshness"` tous présents dans le HTML de `/fr/blog/formation-ia-trappes` (17:54 UTC). `speakable-universal.ts` propre.
- **Piège « dateModified = datePublished identiques partout »** : NON généralisé sur blog/guides — les écarts existent et sont plausibles (ex. pub 07-02 → mod 08-11). Le pattern identique ne subsiste que sur FAQ (finding P2 ci-dessus) et centre-aide (`SITE_EDITORIAL_DATE` figée les deux — choix anti-date-gaming documenté seo.ts:76-86, acceptable, ne pas « corriger »).
- **`lastmod` sitemap non gamé** : distribution réelle étalée (2026-06-26 → 2026-08-11, 22 dates distinctes sur 134 URLs, mesuré 17:49 UTC), pas de bump global au deploy — le piège BUILD_TIME est évité (fallback figé 2026-06-08).
- **Headline ≤ 110** : `truncateHeadline` (factories l.150-155) ; live 38-57 car. sur l'échantillon.
- **AI Act art. 50** : `aiGenerated: true` + `additionalType` + `disambiguatingDescription` + `usageInfo` présents sur tous les contenus générés (live 24/24), y compris le nœud Person Manon.
- **QAPage honnête** : `answerCount: 1`, `upvoteCount: 0` réel (pas de votes fabriqués), auteur Manon résolu.
- **NewsArticle** : `isBasedOn` + source visible (« Source : Le Fil IA ») quand tracée ; description remplie via triple fallback.

## Mesures brutes

| URL (préfixe https://axion-ia.com) | Heure UTC | HTTP | Type nœud | datePublished | dateModified | descLen |
|---|---|---|---|---|---|---|
| /sitemap-blog.xml (134 URLs) | 17:49:55 | 200 | — | — | 22 lastmod distincts | — |
| /sitemap-news.xml | 17:50:29 | 200 | urlset **vide** (fenêtre 48 h sans news — dernière news 07-20) | — | — | — |
| /sitemap-news-evergreen.xml (32 URLs) | 17:50:44 | 200 | — | — | max 2026-07-20T06:01:06Z | — |
| /sitemap-knowledge.xml | 17:52 | 200 (223 KB) | — | — | — | — |
| /fr/blog/cabinet-audit-ia-grenoble-faq | 17:51:00 | 200 | BlogPosting | 07-02 | 08-11 | **0** |
| /fr/blog/formation-ia-saint-gratien-roi | 17:51:00 | 200 | BlogPosting | 07-20 | 07-21 (sitemap : 07-20) | **0** |
| /fr/blog/formation-ia-clermont-ferrand-guide-complet | 17:51:00 | 200 | BlogPosting | 07-20 | 07-20 | **0** |
| /fr/blog/coaching-ia-dirigeant-roissy-en-brie | 17:51:01 | 200 | BlogPosting | 07-20 | 07-21 (sitemap : 07-20) | **0** |
| /fr/blog/alternatives-audit-ia-les-ulis | 17:51:01 | 200 | BlogPosting | 07-20 | 07-21 | **0** |
| /fr/blog/formation-ia-gonesse | 17:51:01 | 200 | BlogPosting | 07-19 | 07-21 (sitemap : 07-19) | **0** |
| /fr/blog/audit-ia-grigny | 17:51:02 | 200 | BlogPosting | 07-19 | 07-21 (sitemap : 07-19) | **0** |
| /fr/blog/formation-ia-trappes | 17:51:02 | 200 | BlogPosting | 07-17 | 07-17 | **0** |
| /fr/blog/formation-ia-romans-sur-isere-options | 17:51:02 | 200 | BlogPosting | 07-17 | 07-21 (sitemap : 07-17) | **0** |
| /fr/blog/formation-ia-ris-orangis | 17:51:02 | 200 | BlogPosting | 07-17 | 07-21 | **0** |
| /fr/blog/accompagnement-ia-entreprise-grenoble-faq | 17:53:07 | 200 | BlogPosting | 07-02 | 07-02 | **0** |
| /fr/blog/coach-ia-grenoble-guide-pratique | 17:53:08 | 200 | BlogPosting | 06-29 | 07-03 | **0** |
| /fr/blog/atelier-ia-grenoble-entreprise | 17:53:08 | 200 | BlogPosting | 06-29 | 07-03 | **0** |
| /fr/blog/comparatif-integrateurs-ia-grenoble-entreprise | 17:53:08 | 200 | BlogPosting | 06-21 | 06-21 | **0** |
| /fr/guides/guide-audit-ia-grenoble | 17:53:09 | 200 | Article | 06-21T06:01:14Z | 07-03T16:32:30Z | 114 |
| /fr/guides/guide-agence-web-ia-auvergne-rhone-alpes | 17:53:09 | 200 | Article | 06-21T06:46:17Z | 08-11T09:36:35Z | 120 |
| /fr/connaissances/kb-fact-roi-ia-050-fr | 17:53:10 | 200 | Article | 08-11T00:00:00Z | 08-11T09:21:29Z | 227 |
| /fr/actualites/souverainete-numerique-syndicats-… | 17:53:10 | 200 | NewsArticle | 07-20T06:01:06.516Z | 07-20T06:01:06.597Z | 155 |
| /fr/actualites/linus-torvalds-ia-linux-forkez-partez | 17:53:11 | 200 | NewsArticle | 07-17T06:00:48.364Z | 07-17T06:00:48.366Z | 158 |
| /fr/faq/…qu-est-ce-qu-un-quick-win-ia (Track B) | 17:53:43 | 200 | QAPage | 06-01 | 06-01 (identiques) | — |
| /fr/faq/…pourquoi-se-concentrer-sur-des-quick-wins-ia | 17:53:44 | 200 | QAPage | 06-01 | 06-01 | — |
| /fr/faq/geo-france (Track A, reviewedAt 08-12) | 17:54:27 | 200 | QAPage | 08-12 | 08-12 (identiques) | — |
| /fr/faq/tarifs-formation-ia, /fr/faq/preparer-une-intervention, /fr/faq/perimetre-audit-ia, /fr/faq/couvrez-vous-… | 17:53-17:54 | 404 | slugs devinés inexistants (sondes, pas un bug) | — | — | — |

Meta descriptions HTML (contrôle contraste, 17:51:23 UTC) : `/fr/blog/formation-ia-trappes` et `/fr/blog/audit-ia-grigny` → remplies (≈120-135 car.) alors que le JSON-LD des mêmes pages est vide.

## Limites

- **Pas d'accès DB pour B3** (réservé A3/B6/D1/D5/D8/F7) : l'« excerpt null sur tout le corpus » est extrapolé de 14/14 pages live + de l'absence totale d'écriture d'`excerpt` dans le publish-worker — pas d'un `SELECT count(*) WHERE excerpt IS NULL`. L'agent A3/D-DB peut le chiffrer en 1 requête.
- **Cause exacte des bumps de masse des 07-03 et 07-21** sur `ArticleTranslation.updatedAt` non tracée (nécessiterait git-log/DB) — la conclusion (écritures batch non éditoriales via `@updatedAt`) tient indépendamment du job précis.
- **Pas de Rich Results Test officiel** (audit GET-only, pas de soumission) — validation structurelle faite par parsing des `ld+json` uniquement.
- **Fraîcheur de production** : dernière actualité publiée le 2026-07-20, dernier contenu éditorial bumpé le 08-11 ; cohérent avec le kill switch OpenAI / recharge crédits déjà acté en mémoire (« reste Will » connu — non re-signalé conformément à la décision 10). `sitemap-news.xml` vide = conséquence mécanique (fenêtre 48 h), pas un bug de la route.
- Échantillon FAQ limité à 3 fiches rendues (Track A + Track B) — la couverture exhaustive des 88 `reviewedAt` n'a pas été balayée fiche par fiche.
- Mesures faites avant l'atterrissage du deploy 17:33 UTC ; aucune mesure post-restart n'a été nécessaire (aucune surface DB-driven vide rencontrée à part `sitemap-news.xml`, expliqué ci-dessus).

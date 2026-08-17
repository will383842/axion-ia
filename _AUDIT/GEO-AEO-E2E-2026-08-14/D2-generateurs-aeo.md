# D2 — Générateurs de contenu & AEO on-page

**Date de rédaction** : 2026-08-14, mesures live entre **19:09 et 19:27 UTC**.

**Fenêtre de déploiement** : un deploy a atterri à **18:26 UTC** ; un nouveau run est
parti à **18:54 UTC** (atterrissage estimé 19:50–20:00 UTC). Toutes mes mesures
tombent donc **43 à 61 minutes après l'atterrissage du deploy 18:26**, c'est-à-dire
dans la fenêtre ISR ≤ 1 h. **Aucun finding de ce rapport ne repose sur un contenu
DB-driven vide** : les 20 pages échantillonnées ont toutes répondu 200 avec un corps
d'article complet, et les 129 exports markdown ont tous renvoyé du contenu. Les
chiffres sont donc valides malgré la fenêtre.

**Périmètre réellement couvert**

- Générateurs : `blog-article.ts`, `blog-from-keywords.ts`, `blog-from-title.ts`,
  `blog-from-rss.ts`, `comparison.ts`, `guide-pilier.ts`, `faq-standalone.ts`,
  `qa-derived.ts`, `barometer-insight.ts`, `v7-phase8-shared.ts` (les 12 types
  Phase 8), `expand-outline-chunked.ts`, `ensure-direct-answer.ts`.
- Chaîne de rendu AEO on-page : `blog/[slug]/page.tsx`, `guides/[slug]/page.tsx`,
  `AnswerCard.tsx`, `ArticleTOC.tsx`, `ArticleFaq.tsx`, `article-enrich.ts`
  (`buildToc`), `html-sanitizer.ts`, `globals.css` (classes éditoriales).
- Gates directement liés à la sortie des générateurs : `seo-score.ts`,
  `soft-404-gate.ts`, `data-quality-gate.ts`, `doctrine-check.ts` (regex de stats
  fabriquées uniquement), plus le câblage `content-gen-worker.ts` →
  `content-publish-worker.ts`.
- **Échantillon live relu intégralement** : 20 pages HTML (12 articles les plus
  récents + 6 contenus de types différents + 1 guide pilier + 1 page qa-derived) et
  **129 exports markdown = 100 % du corpus blog déclaré dans `sitemap-blog.xml`**.

**Hors périmètre** (couvert par d'autres agents, non re-découvert ici) : cadence et
orchestration (D1), rougissement des gates dedup/plagiat/juges (D3), pages villes
(D4), KB (D5), fraîcheur (D7), schémas JSON-LD (B3/B4), maillage (C4), facettes (C5),
canal markdown/llms.txt (A5). Les recoupements sont signalés explicitement.

---

## Résumé exécutif

Les **prompts** des générateurs sont, sur le papier, d'un très bon niveau AEO 2026
(réponse directe 40-80 mots, `<p data-aeo="answer">` sous chaque H2, formats
extractibles, interdictions E-E-A-T explicites) et la **chaîne de rendu est saine**
(AnswerCard `.tldr-answer`, ancres H2 injectées, sommaire, FAQ en accordéon natif,
sélecteurs Speakable qui pointent vers des cibles réellement présentes dans le HTML
brut). Le problème n'est pas la conception, c'est que **rien ne vérifie ce que le
modèle a réellement produit** : les directives AEO n'ont aucun contrôle déterministe
en aval, le plancher de longueur des générateurs (850 mots) n'est appliqué nulle
part, et surtout le worker de publication **écrase le tier calculé** et pose
`tier_1_indexable` en dur — ce qui neutralise le garde-fou anti-thin. Résultat mesuré
sur 100 % du corpus indexé : **40 % des articles sont sous le plancher de leurs
propres générateurs**, un article de **175 mots est indexé**, **26 % portent une
statistique propriétaire invérifiable ou un cas client anonyme fabriqué** (tous deux
interdits en toutes lettres par les prompts), **13 pages sur 19 n'ont aucune liste**
et **aucune n'a de bloc chiffre-clé**. Enfin deux types de contenu perdent leur
principal actif AEO au rendu : les **guides pilier** n'émettent ni sommaire ni
`HowTo`, et les pages **qa_derived** perdent leur `QAPage` et toute leur microdata.

---

## Findings

### [P0] Le garde-fou anti-thin (soft-404) ne protège plus l'index : le tier est écrasé en dur au publish

**Symptôme** — Un article jugé « dégénéré » par le générateur (corps sous 350 mots →
`tier_3_noindex_nofollow`) est tout de même publié **`tier_1_indexable`**, entre dans
`sitemap-blog.xml` et sort en `index, follow`. Le seul effet résiduel de la décision
de tier est de **ne pas envoyer le ping IndexNow**.

**Preuve code**

- `src/server/content-gen/generators/blog-article.ts:473-488` — le générateur calcule
  `evaluateSoft404()` puis force `tier_3_noindex_nofollow` si thin.
- `src/server/queue/workers/content-gen-worker.ts:1215-1222` — le worker en tire
  `shouldPromoteTier1 = score >= 50 && finalIndexationTier !== "tier_3_noindex_nofollow"`
  (commentaire : « même en tout indexable, on n'indexe PAS un contenu dégénéré »).
- `src/server/queue/workers/content-publish-worker.ts:618` —
  `const indexationTier = "tier_1_indexable";` **en dur**, avec le commentaire
  ligne 606 : « `promoteToTier1` reste loggué pour la traçabilité mais **ne gate plus
  le tier** ».
- `src/server/queue/workers/content-publish-worker.ts:1025` — `promoteToTier1` n'est
  plus utilisé que pour `enqueueIndexingForTier1()` (le ping), pas pour le tier.
- `src/app/sitemap.ts:770-773` — le sitemap sélectionne `indexationTier: "tier_1_indexable"`,
  donc la page entre dans le sitemap.

**Preuve live** (2026-08-14 **19:25 UTC**)

`https://axion-ia.com/fr/blog/coaching-ia-dirigeant-champs-sur-marne` → HTTP 200 ;
corps rendu = **175 mots** ; **une seule section de contenu** (`<h2>Introduction au
coaching IA pour dirigeants à Champs-sur-Marne</h2>` + un `<h2>Sources</h2>`) ;
`<meta name="robots" content="index, follow">` ; URL **présente dans
`sitemap-blog.xml`** (récupéré 19:09 UTC). Seuil soft-404 = 350 mots (280 avec JSON-LD
riche) → cet article aurait dû être `tier_3`.

**Root-cause** — Décision « tout contenu publié est indexable » du 2026-06-17 appliquée
en écrasant la variable, au lieu de laisser le tier calculé remonter. Le garde-fou
soft-404 du 2026-06-14 (`content-gen-worker.ts:1216-1222`) est donc devenu décoratif :
il calcule une valeur que le consommateur ignore. ⚠️ **Ceci contredit l'affirmation du
rapport D3** (« le soft-404 interdit le tier_1 même en tout indexable », D3 § résumé et
§ tableau des gates) : le gate rougit bien, mais son verdict est perdu une étape plus
loin.

**Patch prescrit** — Dans `content-publish-worker.ts`, remplacer la constante par
`const indexationTier = promoteToTier1 ? "tier_1_indexable" : "tier_2_noindex_follow";`
et conserver le ping IndexNow gaté sur la même variable. Aucun changement de schéma,
aucune migration. Prévoir un passage de re-qualification rétroactif (script SELECT +
UPDATE ciblé sur les articles dont `wordCount < 350`) — **à faire valider par Will**,
car il déclasse des URLs déjà indexées.

**Effort** — S (le patch : 2 lignes) / M (avec la re-qualification rétroactive).
**Impact GEO-AEO** — **fort** : c'est la porte d'entrée du thin-content dans l'index,
donc du risque HCU sur tout le domaine, et la cause directe du finding suivant.
**Risque de régression** — moyen : le volume d'URLs en sitemap baissera
mécaniquement (les articles thin sortiront de `sitemap-blog.xml`). C'est l'effet
recherché, mais il faut prévenir Will pour ne pas l'interpréter comme une panne
d'indexation. Ne PAS toucher au chemin `promotedAt` (sémantique « épinglé par
l'éditeur ») ni au `tier-lifecycle-worker` (démotion CTR).
**Do-not-touch** : `src/server/content-gen/quality/soft-404-gate.ts` (seuils validés
audit A7), `src/app/sitemap.ts` (la requête est correcte, c'est la donnée qui ment),
`content-gen-worker.ts:1215-1222` (le calcul y est juste).

---

### [P0] 40 % du corpus indexé est sous le plancher de longueur de ses propres générateurs : les tranches d'expansion sont perdues en silence

**Symptôme** — Les générateurs blog déclarent `MIN_WORD_COUNT = 850` et un plan de
**8 sections H2**. Le corpus réellement publié et indexé fait **6 à 7 sections** et
descend jusqu'à **173 mots**. Aucune trace d'erreur : la tranche manquante disparaît
sans log.

**Preuve code**

- `src/server/content-gen/shared/expand-outline-chunked.ts:103-110` — si le JSON d'une
  tranche ne parse pas, `chunkBody = ""` et la boucle continue : **aucun `logStep`,
  aucune exception, aucun compteur**. Une expansion 2×4 sections qui perd sa seconde
  tranche produit un article de 4 sections, et c'est indétectable a posteriori.
- `expand-outline-chunked.ts:84-97` — l'appel `routerGenerate` **ne passe pas
  `responseFormatJson: true`**, contrairement à l'appel PLAN
  (`blog-article.ts:217-229`). Or `providers/openai.ts:185-187` n'active
  `response_format: {type:"json_object"}` que si ce drapeau est vrai → la sortie
  d'expansion (un long HTML dans un champ JSON, `maxTokens: 5000`) n'est jamais
  contrainte, et une troncature (`finish_reason:"length"`) casse le JSON.
- `providers/openai.ts:256-262` — la troncature est seulement `console.warn`, avec le
  commentaire « les gates word-count en aval s'appliquent »… or **le seul gate
  word-count en aval est le soft-404 à 350 mots**, lui-même neutralisé (finding
  précédent).
- `blog-article.ts:373-401` — la boucle qualité sort sur `break` dès que le cap
  d'itérations (2) ou le cap budget (`BUDGET_CAP_USD = 0.3`) est atteint, **sans
  jamais exiger que `wordCount >= MIN_WORD_COUNT` soit satisfait**. Le plancher n'est
  qu'une condition de sortie anticipée, pas une garde.
- `quality/seo-score.ts:146-176` — `scoreWordCount` compte `bodyText + auxBodyText`
  (directAnswer + 8 réponses FAQ + keyTakeaway, ≈ 430 mots) : un corps de 534 mots
  atteint donc 10/10 sur ce critère et le `qualityScore` passe le seuil, ce qui
  **verrouille la sortie de boucle** sur un corps court.

**Preuve live** (mesures 19:11 → 19:24 UTC, 129 articles = 100 % du corpus
`sitemap-blog.xml`, via `/api/markdown/blog/<slug>`)

| Mesure | Valeur |
| --- | --- |
| Articles indexés analysés | 129 |
| Médiane de longueur | 912 mots |
| **Sous 850 mots (plancher générateur)** | **51 / 129 (40 %)** |
| Sous 350 mots (seuil soft-404) | 5 / 129 |
| Minimum | **173 mots** (`coaching-ia-dirigeant-champs-sur-marne`) |
| Sections H2 de contenu (18 pages HTML) | 4 à 11, médiane 6-7 (le plan en demande 8) |

Exemples relus intégralement : `formation-ia-charenton-le-pont` = 534 mots de corps /
6 sections ; `formation-ia-ris-orangis` = 551 ; `formation-ia-sucy-en-brie-meilleures-options`
= 561 ; `formation-ia-morsang-sur-orge` = 562.

**Root-cause** — Chaîne : pas de JSON mode sur l'expansion → parse échoue sur une
tranche → perte silencieuse → corps court → mais `auxBodyText` maintient le
`seoScore` au-dessus du seuil → sortie de boucle → publication → tier forcé à
`tier_1` → sitemap.

**Patch prescrit** — 3 gestes, du moins risqué au plus structurant :
1. `expand-outline-chunked.ts` : passer `responseFormatJson: true` sur l'appel
   d'expansion (aligné avec l'appel PLAN) ;
2. même fichier : sur `catch`, appeler `logStep(jobId, "expand_chunk_failed", …)` et
   remonter `failedChunks` dans le résultat, pour que le générateur puisse retenter la
   **tranche** (et non tout le corps) ;
3. `blog-article.ts` (+ jumeaux `blog-from-keywords`/`blog-from-title`/`comparison`/
   `barometer-insight`) : faire du plancher une vraie garde — si `wordCount < MIN_WORD_COUNT`
   après épuisement des passes, sortir en `needs_review` plutôt qu'en auto-publish.
**Effort** — M. **Impact GEO-AEO** — **fort** (longueur = critère de rang direct, et
un corpus à 40 % thin est un signal HCU au niveau du domaine).
**Risque de régression** — moyen : le geste 3 va augmenter le volume en
`needs_review` (donc réduire la cadence publiée). À arbitrer avec D1 (cadence) et
avec Will. Le geste 1 peut basculer certains modèles sur le fallback Anthropic (pas
de JSON mode) : vérifier `providers/anthropic.ts` avant.
**Do-not-touch** : `quality/seo-score.ts` `buildAuxBodyText` (le correctif 2026-06-25
est juste — la page rend bien ce texte), `parse-llm-json.ts` (fallback robuste déjà
éprouvé).

---

### [P0] 26 % du corpus indexé porte une statistique propriétaire invérifiable ou un cas client anonyme fabriqué — interdits en toutes lettres par les prompts, invisibles pour le détecteur

**Symptôme** — Des phrases du type « **Selon notre expérience, 68 % des équipes
formées** intègrent l'IA dans au moins un processus quotidien » ou « **Une entreprise
locale dans le secteur de la logistique** a suivi notre programme […] réduire de 20 %
le temps passé » sont publiées et indexées. Ce sont exactement les deux interdits
absolus des prompts.

**Preuve code**

- `blog-article.ts:86` : « INTERDIT : fabriquer un cas client (« Entreprise Anonyme »,
  « une PME de la région »…) » ; `blog-article.ts:93` : « INTERDIT ABSOLU : fabriquer
  une statistique, ou attribuer un chiffre à des « données / mesures / étude internes
  Axion-IA », « n=… », « évaluations 20XX » (invérifiable → rejet E-E-A-T) ».
  Directives identiques dans `blog-from-keywords.ts`, `blog-from-title.ts`,
  `comparison.ts`, `barometer-insight.ts`.
- `quality/doctrine-check.ts:40-65` — `FABRICATED_STAT_PATTERNS` exige **le token
  littéral `Axion-?IA`** à côté de « données/mesures/chiffres/statistiques », ou les
  formes « source interne Axion-IA », « étude interne », « n=… », « évaluations 20XX ».
  → « **Selon notre expérience** », « **Nos données** », « **nos formations 68 %** »
  ne matchent **aucune** de ces regex. Il n'existe par ailleurs **aucun pattern** pour
  le cas client anonyme (« une PME locale », « une entreprise du secteur »).
- `content-gen-worker.ts:822-828` puis `:967-982` — même si la doctrine levait la
  violation, elle serait classée `blocking` non-`hardFault` : `blockingFail` ne retient
  que `SIREN/SIRET/RCS` (+ prix non-SSOT désactivé par défaut). L'article partirait
  quand même en auto-publish (recoupe le finding P1 de D3, « doctrine block ≠ blocage
  réel ») — et, avec le P0 n° 1, en `tier_1_indexable`.

**Preuve live** (balayage des 129 exports markdown, 19:24 UTC)

| Motif | Articles concernés |
| --- | --- |
| « Selon notre / d'après nos (expérience, données, mesures, retours) » | 8 |
| « Nos données / nos mesures » + pourcentage | 7 |
| Cas client anonyme (« une PME locale / anonyme / du secteur / de la région ») | 14 |
| « Nous avons accompagné … » | 3 |
| **Total articles distincts touchés** | **34 / 129 (26 %)** |

Exemples vérifiables : `formation-ia-charenton-le-pont` (les deux motifs à la fois),
`formation-ia-boulogne-billancourt`, `etude-cas-formation-ia-plessis-trevise`,
`formation-ia-bois-colombes-etude-cas`, `formation-ia-clichy-sous-bois-optimisez-competences`
(« nos formations 68 % »), `alternatives-formation-ia-nanterre`.

**Root-cause** — Les interdits ne vivent que dans le prompt (probabiliste) ; le
détecteur déterministe a été écrit contre une formulation précise (« données internes
Axion-IA ») et rate les formulations naturelles que le modèle produit réellement.

**Patch prescrit** — Étendre `FABRICATED_STAT_PATTERNS` (`doctrine-check.ts:40`) :
`/(?:selon|d['’]apr[èe]s)\s+(?:notre|nos)\s+(?:exp[ée]rience|donn[ée]es|mesures|retours|observations|analyses)/gi`,
`/\b(?:nos|notre)\s+(?:donn[ée]es|mesures|statistiques)\b[^.]{0,60}\d{1,3}\s?%/gi` ;
et ajouter une famille `FABRICATED_CLIENT_CASE_PATTERNS` :
`/\bune?\s+(?:PME|TPE|entreprise|soci[ée]t[ée])\s+(?:locale|anonyme|de\s+la\s+r[ée]gion|du\s+secteur)\b/gi`.
⚠️ **Ce patch ne suffit pas seul** : tant que le publish force `tier_1` (P0 n° 1), une
violation doctrine ne change rien à l'indexation. Le couple à livrer est donc
`doctrine-check` + `content-publish-worker`. Prévoir en complément un passage de
nettoyage éditorial sur les 34 articles (liste fournie en Mesures brutes) — **reste
Will** (décision de réécriture ou de désindexation).
**Effort** — S (regex) + L (nettoyage du corpus existant).
**Impact GEO-AEO** — **fort** : une statistique inventée citée par une IA est le pire
scénario E-E-A-T, et les « cas clients » fabriqués sont un risque de crédibilité
commerciale directe (recoupe la doctrine CGV = obligation de moyens).
**Risque de régression** — faible côté regex, mais **tester les faux positifs** : la
phrase « Selon nos partenaires » ou une citation d'une source publique reprise en
« selon notre lecture du rapport DARES » pourraient matcher. Ajouter les exceptions
dans `DOCTRINE_EXCEPTIONS` (`doctrine-check.ts:329`) comme pour « angle unique par
ville ».
**Do-not-touch** : `doctrine-check.ts:263` (bloc CPF, décision Will), le mécanisme
`hard_fault_gate.retainNonSsotPrice` (désactivé volontairement, faux positifs massifs
documentés), et les tokens prix nus de la prose villes (décision actée n° 4).

---

### [P1] Guides pilier : ni sommaire ni `HowTo` — l'extracteur d'étapes attend du markdown, le générateur écrit du HTML

**Symptôme** — Un guide pilier rendu affiche 10 sections « Étape N : … », mais la page
n'a **aucun sommaire** et émet un JSON-LD **`Article`** au lieu de **`HowTo`**.

**Preuve code**

- `generators/guide-pilier.ts:317-321` — assemblage :
  `` `<h2 id="etape-${s.position}">Étape ${s.position} : ${s.title}</h2>\n${html}` ``
  (avec le commentaire ligne 315 : « Marqueurs `## Étape N : Title` reconnus par
  parseStepsFromBody […] → déclenche JSON-LD HowTo automatique »).
- `src/server/content-gen/guides/loader.ts:84-86` — la regex attend
  `/(?:^|\n)\s*#{0,3}\s*(?:Étape|Step)\s+(\d+)\s*[:.\-—]\s*…/` : entre le `\n` et
  « Étape » se trouve **`<h2 id="etape-N">`**, donc **zéro correspondance**. Le
  pattern 3 (`N.` / `N)` en début de ligne, `loader.ts:103-105`) ne matche pas non plus.
- `loader.ts:172` — `hasStructuredSteps: steps.length >= 2` → **false**.
- `src/app/[locale]/guides/[slug]/page.tsx:108-127` — `hasStructuredSteps` false →
  `buildArticleJsonLd` au lieu de `buildHowToJsonLd`.
- `guides/[slug]/page.tsx:168-174` puis `:217-220` — `tocItems` vide → **`<ArticleTOC>`
  n'est jamais rendu**. À noter : contrairement à `/blog`, la page guides n'appelle
  **pas** `buildToc()` (`blog/[slug]/page.tsx:318`), donc elle n'a pas de secours.

**Preuve live** (2026-08-14 **19:14 UTC**) —
`https://axion-ia.com/fr/guides/guide-agence-web-ia-auvergne-rhone-alpes` : 10 `<h2
id="etape-1..10">Étape N : …</h2>` présents dans le HTML brut, **`"HowTo"` absent** du
document (types JSON-LD émis : `Article`, `WebPage`, `Blog`, `SpeakableSpecification`,
`BreadcrumbList`, `Person`, `FAQPage`, `ItemList`…), **chaîne « Sommaire » absente
(0 occurrence)**.

**Root-cause** — Contrat implicite entre le générateur et le loader, jamais testé
ensemble : le commentaire du générateur décrit un format markdown que le code n'écrit
pas (il écrit du HTML).

**Patch prescrit** — Dans `loader.ts`, ajouter en **premier** pattern une extraction
HTML : `/<h2[^>]*>\s*(?:Étape|Step)\s+(\d+)\s*[:.\-—]\s*([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi`
(et garder les patterns markdown en repli). Les ancres du sommaire devront alors viser
`etape-${position}` et non `step-${position}` (`guides/[slug]/page.tsx:170`) — sinon
on recrée le bug d'ancres mortes corrigé le 2026-06-21.
**Effort** — S. **Impact GEO-AEO** — **fort sur le format** (`HowTo` = rich result +
brique très citée par les moteurs IA pour les requêtes « comment faire »), **moyen en
volume** (`/fr/guides` ne liste que 3 enfants aujourd'hui, cf. C4).
**Risque de régression** — faible, mais **vérifier l'ancrage** : un `HowTo` avec des
`step.text` mal découpés est plus pénalisant qu'un `Article`. Tester sur les 3 guides
existants avant merge.
**Do-not-touch** : `buildHowToJsonLd` (factory correcte), `ArticleTOC.tsx`,
`guide-pilier.ts:320` (changer le format d'assemblage casserait les ancres `etape-N`
déjà indexées).

---

### [P1] `qa_derived` : le `QAPage` JSON-LD, la microdata et le wrapper de réponse directe sont détruits par le sanitizer au rendu

**Symptôme** — Le générateur `qa_derived` construit un corps riche (H1 FAQ, bloc
`faq-answer direct-answer`, items `schema.org/Question` en microdata, et un
`<script type="application/ld+json">` QAPage). **Rien de tout cela n'arrive dans la
page** : il ne reste que les `<h3>` et les `<p>`.

**Preuve code**

- `generators/qa-derived.ts:87-109` — le corps émis contient
  `<section class="related-qa" data-aeo="related-faq">`,
  `<div class="faq-item" itemscope itemtype="https://schema.org/Question">`,
  `<div class="faq-answer" itemprop="acceptedAnswer" …>`,
  `<div class="faq-answer direct-answer" data-aeo="answer"><p class="tldr-answer" data-aeo="tldr">…`
  et `<script type="application/ld+json">${JSON.stringify(qaJsonLd)}</script>`.
- `shared/html-sanitizer.ts:31-76` — `ALLOWED_TAGS` **ne contient pas `div`** ;
  `:78-92` — `ALLOWED_ATTR` **ne contient ni `itemscope`, ni `itemtype`, ni `itemprop`** ;
  `:115` — `FORBID_TAGS` contient **`script`**.
- `src/app/[locale]/blog/[slug]/page.tsx:318` — le corps est **re-sanitisé au rendu**
  (`buildToc(sanitizeContentGenHtml(view.body))`), donc même si le HTML avait été
  stocké intact, il est nettoyé à chaque affichage.

**Preuve live** (2026-08-14 **19:26 UTC**) —
`https://axion-ia.com/fr/blog/audit-ia-bretigny-sur-orge` : section « Questions
fréquentes associées » bien rendue, mais **`QAPage` absent** du document,
**0 occurrence de `itemprop`** dans le corps, **0 `<script>` dans le corps**, wrappers
`div.faq-item` / `div.faq-answer` disparus (seuls subsistent `<h3 class="faq-question">`
+ `<p>`). Le `data-aeo="answer"` du bloc de réponse principale a disparu avec son `div`.

**Root-cause** — Le générateur a été écrit (2026-05-21) contre un contrat de rendu qui
n'existe pas : la whitelist du sanitizer, plus stricte, est appliquée deux fois. La
sécurité est correcte (un `<script>` venu d'un LLM ne doit jamais être injecté) ; c'est
la **stratégie** qui est fausse : le JSON-LD doit être émis par la page, pas par le corps.

**Patch prescrit** — Deux gestes :
1. `qa-derived.ts` : cesser d'émettre le `<script>` dans `bodyHtml` ; persister le
   `qaJsonLd` dans un champ dédié (ou le recalculer côté page à partir de
   `directAnswer` + `faqJson`) et l'émettre via `<JsonLd>` comme le fait
   `ArticleFaq.tsx:100`. Remplacer les `<div>` par des `<section>`/`<aside>` (déjà
   whitelistés) pour conserver `class` + `data-aeo`.
2. `html-sanitizer.ts` : ajouter `div` à `ALLOWED_TAGS` **uniquement si** on veut
   conserver la structure ; la microdata (`itemprop`…) est redondante avec le JSON-LD
   → ne PAS l'autoriser.
**Effort** — M. **Impact GEO-AEO** — **fort pour ce type** (`QAPage` + Speakable est
le format le plus cité en réponse directe), **faible en volume** (2 pages identifiées
sur 129 portent la signature `qa_derived`).
**Risque de régression** — **sécurité** : autoriser `div` élargit la surface XSS du
HTML LLM ; préférer le geste 1 seul. Ne PAS retirer `script` de `FORBID_TAGS`
(`html-sanitizer.ts:115`) — ce serait une régression XSS majeure.
**Do-not-touch** : `html-sanitizer.ts` `FORBID_TAGS` / `ALLOWED_URI_REGEXP`,
`dompurify-isolated.ts` (isolation jsdom indispensable au worker).

---

### [P1] Formats extractibles quasi absents du corpus : ni listes, ni tableaux, ni chiffres-clés — et rien ne le vérifie

**Symptôme** — Les prompts exigent une alternance de formats (encadrés, citations,
chiffre-clé, tableaux comparatifs) et le CSS pour les rendre existe. Dans le corpus
réel, **il ne reste que les paragraphes et les encadrés**.

**Preuve code**

- `blog-article.ts:92`, `blog-from-keywords.ts:98`, `blog-from-title.ts:101`,
  `comparison.ts:104`, `barometer-insight.ts:107` — « ANTI-MONOTONIE : […] 1-2
  `<blockquote>`, et **AU MOINS 1** chiffre-clé `<aside class="ax-stat" data-aeo="stat">` ».
- `src/app/globals.css:957-980` (`.prose-axionia aside.ax-stat`), `:1041-1090`
  (`.callout`), `:834-880` (`.ax-chart`) — les styles existent bel et bien.
- **Aucun des prompts blog ne demande de `<ul>`/`<ol>`/`<table>`** (seuls
  `guide-pilier.ts:106` et les types Phase 8 comparatifs le font) — alors que la liste
  et le tableau sont les deux formats les plus repris en featured snippet / AI Overview.
- `quality/seo-score.ts:276-306` — la grille /100 n'a **aucun critère** de format
  extractible (ni liste, ni tableau, ni `data-aeo="answer"`). Le seul contrôle
  déterministe de tout le pipeline est le hard gate `<table>` de `comparison.ts:118`
  (`/<table[\s>]/i.test(bodyHtml)`), et il ne couvre qu'un type sur 21.

**Preuve live** (19 pages HTML relues, section « Sources » exclue du décompte,
19:11 → 19:26 UTC)

| Élément | Pages qui en ont ≥ 1 |
| --- | --- |
| Liste `<ul>`/`<ol>` dans le corps | **6 / 19** |
| Tableau `<table>` | **5 / 19** (dont 3 = les contenus comparatifs) |
| Chiffre-clé `aside.ax-stat` | **0 / 19** |
| `<blockquote>` | **0 / 19** |
| Encadré `.callout` | 13 / 19 (moyenne 2 par page) |
| `<dfn>` ou `.glossary-term` | 7 / 19 |

**Root-cause** — Directive de format probabiliste + zéro vérification. Le modèle
converge vers le format le moins coûteux (paragraphes + un ou deux encadrés).

**Patch prescrit** — (a) ajouter aux prompts blog une exigence explicite « au moins 1
liste `<ul>`/`<ol>` de 3-6 items **et** 1 tableau récapitulatif quand le sujet s'y
prête » ; (b) ajouter à `seo-score.ts` un critère « formats extractibles » (par
exemple 6 pts : +3 si ≥ 1 liste, +3 si ≥ 1 tableau **ou** ≥ 1 `ax-stat`) en
rééquilibrant la grille à 100 ; (c) faire remonter ce critère dans le
`prevFeedback` de la boucle qualité (`blog-article.ts:404-416`), qui est le seul
mécanisme correctif existant.
**Effort** — M. **Impact GEO-AEO** — **fort** : listes et tableaux sont le format
d'extraction privilégié des AI Overviews et des réponses Perplexity.
**Risque de régression** — modifier la pondération de `seo-score` **déplace tous les
scores du corpus** et donc les seuils d'auto-publish (60) et de promotion (50) : à
livrer avec un re-calibrage, sinon on assèche ou on inonde la publication. Vérifier
`quality/__tests__` (des specs verrouillent la grille).
**Do-not-touch** : `comparison.ts:118` (hard gate `<table>` qui fonctionne),
`globals.css` (les styles sont bons, c'est le contenu qui manque).

---

### [P1] La réponse directe par section (`<p data-aeo="answer">`) n'est vérifiée nulle part — absente sur 13 % des sections et sur 100 % des contenus comparatifs testés

**Symptôme** — La brique AEO la plus forte du dispositif (une réponse autonome de
40-60 mots en tête de chaque H2, citable hors contexte) est demandée par **tous** les
générateurs, mais son absence n'a aucune conséquence.

**Preuve code** — Directive présente dans `blog-article.ts:91`,
`blog-from-keywords.ts:97`, `blog-from-title.ts:100`, `blog-from-rss.ts:80`,
`comparison.ts:103`, `guide-pilier.ts:109`, `faq-standalone.ts:47`,
`qa-derived.ts:56`, `barometer-insight.ts:106`, `v7-phase8-shared.ts:204`.
**Aucun** de ces fichiers ne teste ensuite la présence de `data-aeo="answer"` ; la
seule vérification de réponse directe du pipeline porte sur le champ **global**
`directAnswer` (`quality/data-quality-gate.ts:53-56`, ≥ 40 mots), pas sur les
sections. Et ce gate lui-même n'est actif que si
`CONTENT_QUALITY_GATE_ENABLED === "true"` (`content-publish-worker.ts:379`) — sinon il
se contente de **logger**.

**Preuve live** (18 pages, 119 sections H2 de contenu, « Sources » et « Liens internes »
exclues, 19:11 → 19:26 UTC)

| Page | Sections | Avec réponse directe |
| --- | --- | --- |
| `comparaison-formation-ia-tremblay-en-france` | 8 | **0** |
| `comparatif-integrateurs-ia-grenoble-entreprise` | 6 | **0** |
| `coaching-ia-dirigeant-mantes-la-ville-roi` | 4 | 3 |
| `formation-ia-saint-denis-comparatif-axion-ia-vs-generalistes` | 11 | 10 |
| 14 autres pages | 90 | 90 |
| **Total** | **119** | **103 (87 %)** |

Le trou est **structuré**, pas aléatoire : les deux contenus de type comparatif testés
sont à 0 %, alors que la directive figure bien dans `comparison.ts:103`.

**Root-cause** — Directive non vérifiée + prompt comparatif surchargé (tableau
obligatoire + graphique + encadrés + chiffre-clé + réponse directe) : le modèle
sacrifie la consigne la moins « visible ».

**Patch prescrit** — Ajouter dans les générateurs (ou dans un helper partagé
`shared/ensure-section-answers.ts`, symétrique de `ensure-direct-answer.ts`) un
contrôle déterministe : si `(bodyHtml.match(/<p data-aeo="answer"/g) ?? []).length <
h2Count * 0.8`, alimenter `prevFeedback` et relancer une passe ; à défaut, injecter en
repli la première phrase de la section dans un `<p data-aeo="answer">` (transformation
purement structurelle, sans appel LLM, donc sans coût ni risque factuel).
**Effort** — M. **Impact GEO-AEO** — **fort** (c'est la surface d'extraction des
moteurs de réponse ; les sélecteurs Speakable de `blog/[slug]/page.tsx:388` la ciblent
explicitement).
**Risque de régression** — faible pour l'injection de repli ; **vérifier** que la
première phrase n'est pas un fragment de liste ou de tableau. Ne PAS toucher aux
sélecteurs Speakable existants (ils sont corrects et pointent vers des cibles réelles).
**Do-not-touch** : `AnswerCard.tsx` (contrat `.tldr-answer` + `data-aeo="tldr"` juste),
`ensure-direct-answer.ts` (fail-open et non-régressif, bien conçu).

---

### [P1] Double bloc « Sources » sur chaque article — qui pollue aussi le sommaire, l'`ItemList` JSON-LD et le compteur de H2 du scorer

**Symptôme** — Chaque article affiche **deux fois** la même liste de sources : une
section `<h2>Sources</h2>` dans le corps, puis un bloc `<h2>Sources & méthodologie</h2>`
rendu par le composant. Le `<h2>Sources</h2>` du corps est en plus repris comme entrée
de sommaire et comme `ListItem` dans le JSON-LD du sommaire.

**Preuve code**

- `quality/article-quality.ts` → `appendSourcesSection()` appelé par
  `blog-article.ts:428-431`, `guide-pilier.ts:325-328` (et jumeaux) : injecte
  `<section id="sources-axion"><h2>Sources</h2><ul>…</ul></section>` **dans le corps
  persisté**.
- `blog/[slug]/page.tsx:664-668` — `<ArticleSources items={view.citations} …>` rend un
  second bloc à partir des citations persistées en base.
- `blog/[slug]/page.tsx:318` — `buildToc()` (`lib/knowledge/article-enrich.ts:292-330`)
  indexe **tous** les `<h2>`, donc « Sources » y compris.
- `quality/seo-score.ts:92-97` — `scoreH2Structure` compte tous les `<h2>` : le H2
  « Sources » **fait gagner un point de structure** pour un contenu nul.

**Preuve live** (2026-08-14 **19:12 → 19:22 UTC**) — sur
`formation-ia-charenton-le-pont` : corps = `francecompetences.fr`, `afnor.org`,
`cnam.fr`, `unesco.org` ; bloc composant = `francecompetences.fr`, `afnor.org`,
`cnam.fr` → **doublon complet**. Idem sur `audit-ia-grigny` et sur le guide
`guide-agence-web-ia-auvergne-rhone-alpes`. Sur les 12 pages récentes, le sommaire
JSON-LD (`ItemList`) porte systématiquement une entrée finale « Sources »
(ex. `…#sources`, position 7/7).

**Root-cause** — Deux chantiers successifs (injection déterministe des sources
2026-06-25 pour garantir `citationCount`, puis bloc public « Sources & méthodologie »
2026-06-22) qui n'ont jamais été réconciliés.

**Patch prescrit** — Garder **une seule** surface : soit ne plus appeler
`appendSourcesSection` au moment de la génération et laisser le composant faire foi
(mais alors recompter `citationCount` sur `externalLinksCtx.links` plutôt que sur le
HTML), soit exclure `#sources-axion` du rendu quand `view.citations.length > 0`.
Complément immédiat, sans risque : filtrer le H2 « Sources » dans `buildToc()`
(liste d'exclusion de titres non-éditoriaux) et dans `scoreH2Structure`.
**Effort** — S. **Impact GEO-AEO** — **moyen** (duplication visible, sommaire pollué,
score de structure faussé). **Risque de régression** — attention : retirer
`appendSourcesSection` fait chuter `citationCount`, donc le hard-gate intent
« informational sans citations » (`content-gen-worker.ts:744-755`) et le critère
« Citations intent-aware » de `seo-score`. Livrer les deux ensemble.
**Do-not-touch** : `content-gen-worker.ts:752-755` (le `Math.max` corrige un vrai bug
de 2026-06-20), `persist-citations.ts`.

---

### [P2] Sources d'autorité recyclées à l'identique sur les trois quarts du corpus

Les mêmes 3 liens reviennent partout, sans rapport avec le sujet de l'article, sous un
titre qui promet une méthodologie.

**Preuve live** (129 articles, 19:24 UTC) : France Compétences **99 (76 %)**, AFNOR
**89 (68 %)**, Cnam **88 (68 %)**, DARES 34, INSEE 30, UNESCO 25, France Num 14,
CNIL 11, Bpifrance 2. **Preuve code** : `links/external-links-injector.ts` appelé avec
`{ count: 4, minAuthority: 4 }` (`blog-article.ts:165`) — la sélection est filtrée par
autorité, pas par pertinence thématique.
**Patch** : pondérer la sélection par le secteur / les tags de l'article (le champ
existe déjà côté catalogue). **Effort** S-M. **Impact** moyen (co-citation E-E-A-T
diluée). **Risque** : baisse mécanique de `citationCount` sur les sujets peu couverts
→ prévoir un repli sur les sources génériques.

### [P2] Lien interne injecté à l'intérieur d'un titre H2

`links/internal-link-catalog.ts:123-148` protège contre les ancres imbriquées
(`linkPhraseOutsideAnchors`) mais **pas contre l'injection dans un `Hn`**. Live
(19:26 UTC) : `/fr/blog/audit-ia-bretigny-sur-orge` →
`<h2 id="questions-frequentes-associees"><a href="/blog/formation-ia-saint-gratien-faq">Questions
fréquentes</a> associées</h2>` ; idem sur `coaching-ia-dirigeant-champs-sur-marne`
(2/20 pages). **Patch** : exclure les plages `<h1>`…`<h4>` du champ d'injection.
**Effort** S. **Impact** faible-moyen (dilue l'extraction du titre de section et
sur-optimise l'ancre). **Risque** faible.

### [P2] Le commentaire du sitemap décrit un critère « body ≥ 800 mots » qui n'existe nulle part

`src/app/sitemap.ts:746-749` : « seuls les articles tier-1 (validés qualité + score
≥ 70 + **body ≥ 800 mots** + faq ≥ 4 + directAnswer 40-80 mots) entrent dans le
sitemap ». Aucun de ces quatre critères n'est appliqué à ce niveau : la requête filtre
uniquement `status: "published"` + `indexationTier: "tier_1_indexable"`
(`sitemap.ts:768-773`), et le tier est posé en dur au publish (P0 n° 1). Live : 51
articles sous 850 mots sont dans `sitemap-blog.xml`. **Patch** : corriger le
commentaire (documentation) ou implémenter réellement le filtre. **Effort** S.
**Impact** faible en SEO, **fort en pilotage** (ce commentaire a induit en erreur au
moins un audit).

### [P2] Le tier calculé par 13 générateurs sur 21 est du code mort

`guide-pilier.ts:388-391` ne peut jamais retourner mieux que `tier_2_noindex_follow`,
et `v7-phase8-shared.ts:465-470` (les 12 types Phase 8 : `long_tail_keyword`,
`vs_comparator`, `what_is_x`, `faq_geo`, `case_study_local`…) non plus — alors que les
8 autres générateurs peuvent émettre `tier_1_indexable`. Comme le publish force
`tier_1` (P0 n° 1), cette asymétrie n'a **aucun effet** aujourd'hui : elle rend
seulement le pilotage illisible et deviendra un **bug bloquant le jour où le P0 n° 1
sera corrigé** (les guides et tous les types Phase 8 basculeraient d'un coup en
noindex). **À traiter dans le même lot que le P0 n° 1.** **Effort** S. **Risque** :
c'est précisément le piège de régression du patch P0 n° 1 — ne pas le corriger seul.

### [P2] Export markdown : structure totalement aplatie (recoupe A5)

Sur les **129 exports** `/api/markdown/blog/<slug>` récupérés à 19:24 UTC : **0 fichier
contient un `##`**, **0 contient une puce de liste**. Tout le corps arrive en un seul
paragraphe continu (titres de section, réponses directes, encadrés et liste de sources
fondus dans la prose) — vérifié intégralement sur
`formation-ia-charenton-le-pont.md`. Le canal explicitement dédié à l'ingestion par
les LLM (`<link rel="alternate" type="text/markdown">`, `blog/[slug]/page.tsx:459-465`)
livre donc la version **la moins structurée** du contenu. **Patch** : convertir le
`bodyHtml` en markdown (h2→`##`, ul→`-`, table→pipe) au lieu de faire un `strip_tags`.
**Effort** M. **Impact** moyen-fort sur le canal GEO. **Note** : la surface
`/api/markdown` appartient à A5 — à consolider avec son rapport avant chiffrage.

### [P2] `faq-standalone` : la directive AEO principale est inapplicable par construction

`generators/faq-standalone.ts:45` impose « bodyHtml = intro thématique HTML (2-3
paragraphes) — les Q/A vont dans `faq[]` », et `:47` impose « **Sous CHAQUE `<h2>`**,
commence la section par une réponse autonome… ». Un corps de 2-3 paragraphes **n'a pas
de `<h2>`** : la directive ne peut jamais s'appliquer. Corollaire : le corps de ces
pages est structurellement sous le seuil soft-404 (350 mots) et ne doit sa publication
qu'au bonus FAQ + au P0 n° 1. **Patch** : soit demander 3-4 H2 thématiques dans le
corps, soit retirer la directive morte. **Effort** S. **Impact** faible-moyen.

### [P2] Micro-écarts relevés, sans preuve d'impact

- `ensure-direct-answer.ts:26` définit `MAX_DIRECT_ANSWER_WORDS = 80` mais ne l'applique
  jamais (seul le plancher est vérifié, `:74` et `:118`) — mesuré live : 2 TL;DR sur 12
  à 81 et 83 mots, hors cible haute du critère `scoreDirectAnswer`
  (`seo-score.ts:125-129`). Effet réel : négligeable.
- `article-enrich.ts:318-327` — `buildToc` **réécrit** la balise `<h2>` et **jette ses
  attributs d'origine** (`<h2 id="…" data-speakable="true">` sans reprendre `class`
  ni `data-aeo`). Sans conséquence aujourd'hui (les générateurs n'en posent pas sur les
  H2), mais c'est un piège pour toute évolution.
- Structure Hn : 6 pages sur 18 n'ont **aucun `<h3>`** ; les prompts blog n'en demandent
  pas (seul `v7-phase8-shared.ts:203` exige « ≥ 6 `<h2>` + ≥ 10 `<h3>` »).
- Le plan demande **8 sections** ; le corpus en rend 6-7 en médiane (conséquence du
  P0 n° 2).

---

## Ce qui fonctionne (à ne pas « corriger »)

Vérifié explicitement pour éviter des faux positifs en squad H :

| Brique | État vérifié |
| --- | --- |
| `AnswerCard` (TL;DR) | Porte bien `.tldr-answer` + `data-aeo="tldr"` + `role="doc-tip"` (`AnswerCard.tsx:75-84`), présente sur **12/12** pages récentes, 44 à 83 mots |
| Sélecteurs Speakable | `blog/[slug]/page.tsx:388` cible `.tldr-answer`, `[data-aeo="tldr"]`, `.faq-answer`, `[data-aeo="answer"]` → **les 4 cibles existent réellement** dans le HTML rendu |
| Ancres de section | `buildToc` injecte des `id` slugifiés dédoublonnés, **identiques** aux ancres du sommaire (0 ancre morte sur les 12 pages) |
| Sommaire | Rendu sur **12/12** articles blog (rail sticky + `<details>` mobile + `ItemList` JSON-LD) |
| FAQ | `ArticleFaq` rend les réponses **dans le HTML brut** (`<details>` natif, 0 JS) + `FAQPage` JSON-LD (`ArticleFaq.tsx:66-101`) |
| Sanitizer | Préserve `class`, `data-aeo`, `data-section` (`html-sanitizer.ts:78-92`) et pose le bon `rel` par trust-tier |
| CSS éditorial | `.callout`, `.ax-stat`, `.ax-chart`, `dfn`/`.glossary-term` tous stylés (`globals.css:834-1112`) — le contenu manque, pas le style |
| `ensure-direct-answer` | Fail-open et strictement non-régressif (`:111-121`) : ne peut pas dégrader un contenu conforme |
| Hard gate `<table>` comparatif | Fonctionne : les 3 contenus comparatifs testés portent bien un `<table>` |
| Prix affichés | `1 190 € HT` / `2 450 € HT` relevés en prose **correspondent au SSOT** (`content/pricing.ts:132,321`) — **pas** un prix fabriqué (décision actée n° 4 respectée) |

---

## Mesures brutes

### Corpus complet — 129 articles (100 % de `sitemap-blog.xml`), export markdown, 19:24 UTC

| Indicateur | Valeur |
| --- | --- |
| URLs FR dans `sitemap-blog.xml` | 134 (dont 4 hubs `/blog/categorie/*` + 1 `/guides/*`) |
| Articles réellement analysés | 129 |
| Longueur médiane / moyenne | 912 / 1 172 mots |
| < 850 mots (plancher générateur) | **51 (40 %)** |
| < 350 mots (seuil soft-404) | 5 |
| Minimum | 173 mots |
| Statistique interne invérifiable ou cas client anonyme | **34 (26 %)** |
| Fichiers markdown avec un titre `##` | **0** |
| Fichiers markdown avec une liste | **0** |

### Échantillon HTML relu intégralement — 20 pages, 19:11 → 19:26 UTC

| Page (`/fr/blog/…` sauf mention) | HTTP | Mots corps | H2 | H3 | Réponses directes | Listes | Tableaux |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `cabinet-audit-ia-grenoble-faq` | 200 | 1 367 | 10 | 0 | 9/9 | 0 | 0 |
| `formation-ia-champigny-sur-marne-2` | 200 | 608 | 7 | 6 | 6/6 | 0 | 0 |
| `formation-ia-saint-gratien-roi` | 200 | 919 | 7 | 4 | 6/6 | 1 | 1 |
| `formation-ia-clermont-ferrand-guide-complet` | 200 | 623 | 7 | 6 | 6/6 | 0 | 0 |
| `alternatives-audit-ia-les-ulis` | 200 | 634 | 8 | 0 | 7/7 | 0 | 1 |
| `coaching-ia-dirigeant-roissy-en-brie` | 200 | 893 | 7 | 12 | 6/6 | 0 | 0 |
| `coaching-ia-dirigeant-mantes-la-ville-roi` | 200 | 936 | 6 | 11 | **3/4** | 0 | 0 |
| `formation-ia-montfermeil-solutions` | 200 | 630 | 7 | 5 | 6/6 | 0 | 0 |
| `audit-ia-grigny` | 200 | 733 | 7 | 6 | 6/6 | 0 | 0 |
| `formation-ia-sucy-en-brie-calculateur-roi` | 200 | 620 | 6 | 7 | 5/5 | 1 | 0 |
| `formation-ia-gonesse` | 200 | 918 | 7 | 12 | 6/6 | 0 | 0 |
| `formation-ia-charenton-le-pont` | 200 | **534** | 7 | 0 | 6/6 | 0 | 0 |
| `comparaison-formation-ia-tremblay-en-france` | 200 | 861 | 9 | 0 | **0/8** | 0 | 1 |
| `comparatif-integrateurs-ia-grenoble-entreprise` | 200 | 589 | 7 | 0 | **0/6** | 5 | 1 |
| `cours-ia-grenoble-entreprise-faq` | 200 | 2 026 | 7 | 11 | 6/6 | 5 | 0 |
| `formation-ia-maurepas-guide` | 200 | 1 085 | 8 | 12 | 7/7 | 0 | 0 |
| `formation-ia-montmorency-definition` | 200 | 2 024 | 9 | 12 | 8/8 | 5 | 0 |
| `formation-ia-saint-denis-comparatif-axion-ia-vs-generalistes` | 200 | 1 967 | 12 | 20 | 10/11 | 1 | 1 |
| `audit-ia-bretigny-sur-orge` (qa_derived) | 200 | — | 5 | 5 | — | 0 | 0 |
| `coaching-ia-dirigeant-champs-sur-marne` | 200 | **175** | 2 | 0 | 1/1 | 0 | 0 |
| `/fr/guides/guide-agence-web-ia-auvergne-rhone-alpes` | 200 | — | 16 | 9 | — | 0 | 0 |

### Contrôles ciblés

| Contrôle | Résultat | Heure UTC |
| --- | --- | --- |
| `sitemap-blog.xml` | 134 `<loc>`, lastmod max 2026-08-11 | 19:09 |
| `coaching-ia-dirigeant-champs-sur-marne` → `<meta robots>` | `index, follow` (175 mots) | 19:25 |
| `audit-ia-bretigny-sur-orge` → `QAPage` dans le document | **absent** | 19:26 |
| `audit-ia-bretigny-sur-orge` → `itemprop` dans le corps | **0 occurrence** | 19:26 |
| `guide-agence-web-…` → `HowTo` / « Sommaire » | **absents tous les deux** | 19:14 |
| Doublon « Sources » (corps vs composant) | confirmé sur 3/3 pages testées | 19:22 |
| `/api/markdown/blog/formation-ia-charenton-le-pont` | 200, 4 108 octets, prose continue | 19:12 |

### Articles à nettoyer (statistique interne invérifiable ou cas client anonyme) — extrait

`alternatives-formation-ia-nanterre`, `coaching-ia-dirigeant-gonesse-cas-concret`,
`etude-cas-formation-ia-plessis-trevise`, `etude-de-cas-formation-ia-grenoble`,
`formation-ia-acheres`, `formation-ia-aix-les-bains-faq`,
`formation-ia-bagneux-defis-metier`, `formation-ia-bois-colombes-etude-cas`,
`formation-ia-boulogne-billancourt`, `formation-ia-charenton-le-pont`,
`formation-ia-clichy-sous-bois-optimisez-competences`, `formation-ia-colombes`
(+ 22 autres — liste complète reproductible par le balayage décrit ci-dessus).

---

## Limites

1. **Aucun accès DB** — D2 n'est pas dans la liste des agents autorisés (A3, B6, D1,
   D5, D8, F7). Je n'ai donc **pas pu relier un article publié à son `ContentType`
   d'origine** ni lire les `ContentGenJobLog` : l'attribution d'un contenu à un
   générateur précis est **inférée** de sa signature de rendu (par exemple
   `<h2 id="etape-N">Étape N` = `guide-pilier.ts:320`, section « Questions fréquentes
   associées » = `qa-derived.ts:89`). Les findings P0 n° 2 et P1 « réponse directe »
   sont donc **exacts sur les volumes** mais **prudents sur l'imputation par type**.
   Requête à déléguer : `SELECT "contentType", count(*), avg("qualityScore") FROM
   "ContentGenJob" WHERE status='approved' GROUP BY 1;` et le comptage des `logStep`
   `quality_loop_cap_reached` / `quality_loop_budget_cap_reached`.
2. **Preuve d'exécution manquante pour le P0 n° 2** — je démontre par le code que la
   perte de tranche est silencieuse et par la mesure que 40 % du corpus est court,
   mais je ne peux pas produire le log d'un chunk perdu (pas d'accès aux logs du
   worker ni à la DB). L'hypothèse « troncature JSON » est la plus probable ; une
   contribution du cap budget (`BUDGET_CAP_USD = 0.3` évalué **après** la première
   expansion) est également possible. **[À CONFIRMER par une lecture DB.]**
3. **Production arrêtée depuis le 2026-07-20** (fait connu, non re-signalé) : je n'ai
   donc pas pu observer un cycle de génération en direct, ni vérifier qu'un patch de
   prompt produirait l'effet attendu. Tous mes constats portent sur le corpus déjà
   publié.
4. **`barometer_insight` non observable** — aucun article du corpus ne porte sa
   signature (déclenchement manuel via `generateBarometerArticle`,
   `actions/observatoire/admin.ts:165`). L'analyse de ce générateur est **statique
   uniquement**, sans preuve live.
5. **`blog_from_rss` non couvert** — les news vivent sous `/actualites` et sortent du
   périmètre `sitemap-blog.xml` que j'ai balayé (surface D7 pour la fraîcheur, A3 pour
   `sitemap-news`). Sa directive `data-aeo="answer"` (`blog-from-rss.ts:80`) n'a donc
   pas été vérifiée en rendu.
6. **Types Phase 8 partiellement couverts** — j'ai relu 6 contenus de types
   manifestement différents, mais sans la DB je ne peux pas garantir avoir couvert les
   12 types Phase 8. Les constats de format (listes, tableaux, `ax-stat`) restent
   valables au niveau du corpus.
7. **Fenêtre post-deploy** — mesures prises 43 à 61 min après l'atterrissage du deploy
   de 18:26 UTC. Comme indiqué en en-tête, aucun de mes findings ne dépend d'un
   contenu DB vide ; en revanche, si le run parti à 18:54 UTC modifie du code
   générateur, les numéros de ligne cités devront être revérifiés (branche auditée :
   `fix/cgv-mediation-engagement` = `main` + 1 commit CGV, sans impact GEO).
8. **Aucune mesure de performance** (Lighthouse local interdit) et **aucune
   soumission** d'URL : lecture seule, GET uniquement.

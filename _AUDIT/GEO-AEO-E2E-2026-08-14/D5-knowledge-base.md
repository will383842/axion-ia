# D5 — Knowledge base (state-machine, gates, SEO-generator, embeddings, related, llms, sitemap, /connaissances)

- **Date** : 2026-08-14, mesures live 18:15 → 18:25 UTC (déploiement en vol lancé 17:33 UTC — aucune mesure n'a montré de surface vide ; sitemap-knowledge plein à 18:18 UTC).
- **Périmètre réellement couvert** : `src/lib/knowledge/**` (state-machine, quality-gates, seo-generator, locale-policy, embeddings, related-entries, public-fetch, search-fts, banned-words, dedup-check, kill-switch), `src/server/actions/knowledge/**` (transition, publish, ingest, seo-cache, schedule-publish, revalidate), `src/server/exporters/knowledge-{llms-txt,sitemap}.ts`, `src/app/sitemap-knowledge.xml/route.ts`, `src/app/[locale]/connaissances/{page,[slug]/page}.tsx`, `src/app/[locale]/recherche/page.tsx` (volet KB), `src/server/content-gen/kb-{client,feeder}.ts`, seeds `prisma/seeds/content-gen/seed-kb-facts.ts` + `scripts/seed-kb-villes-facts.ts`. DB prod : SELECT-only sur `knowledge_*` (autorisé pour D5).

## Résumé exécutif

La tuyauterie KB est saine en surface : hub 200, 507 fiches publiées toutes `published/public/public` (zéro fuite, zéro embargo), sitemap-knowledge.xml runtime avec 507 URLs et filtre anti-leak complet, embeddings **Voyage réels** (pas le stub), Article JSON-LD inline + canonical corrects sur les détails. Mais la KB est un **organe amputé de ses trois fonctions GEO/AEO** : (1) elle est **invisible du canal d'ingestion IA** — ni llms.txt ni llms-full.txt ne mentionnent `/fr/connaissances`, et l'exporter d'enrichissement `buildLlmsTxt` est du code mort ; (2) le **corpus entier viole les seuils de sa propre quality-gate** (médiane 44 mots vs 500 exigés, 0 fiche avec H2) car les 507 entrées viennent de seeds Prisma directs — le pipeline ingest + gates + seo-cache affiche **0 exécution en prod** (« garde qui ne garde rien ») ; (3) le hub est **orphelin de la navigation** et ne liste que 48/507 fiches sans pagination. Résultat mesuré : 4 impressions Google, 0 clic sur tout le corpus (GSC W33). Aucun P0 : rien de cassé ni de mensonger — mais l'essentiel de la valeur AEO de 507 faits sourcés est aujourd'hui perdu.

## Findings

### [P1] La KB (507 fiches citables) est absente du canal llms.txt — l'exporter d'enrichissement est du code mort

- **Symptôme** : les assistants IA qui lisent `llms.txt`/`llms-full.txt` ne peuvent découvrir ni le hub `/fr/connaissances` ni aucune des 507 fiches « fait sourcé » (McKinsey, Gartner, AI Act…) — exactement le type de contenu que Perplexity/Claude/ChatGPT citent le plus volontiers.
- **Preuve code** : `src/server/exporters/knowledge-llms-txt.ts:14` (`buildLlmsTxt`, KB-8) — **zéro consommateur** dans `src/` (grep `buildLlmsTxt` → seule la définition). `src/app/llms.txt/route.ts:94-104` : la section « Connaissances & contenu » liste blog/actualités/FAQ/glossaire/guide-ia/observatoire mais **aucun lien `/fr/connaissances`**. `src/app/llms-full.txt/route.ts` (160 l.) : zéro occurrence `connaissances|knowledge`.
- **Preuve live** (2026-08-14 18:18:51 UTC) : `curl llms.txt | grep -in connaissances` → 1 seule occurrence = le titre de section (l.30) ; `llms-full.txt` → 2 occurrences, toutes deux dans de la prose chatbot (« votre base de connaissances »), aucune URL.
- **Root-cause** : `llms.txt` est une route edge 100 % statique (voulu, très bien) ; l'exporter DB-aware KB-8 a été écrit mais jamais branché ; personne n'a ajouté la ligne statique hub quand la décision « public assumé » (2026-08-11) a rendu les 507 fiches publiques.
- **Patch prescrit** (2 étages, le 1er suffit) :
  1. **S** : ajouter dans la section « Connaissances & contenu » de `llms.txt` une ligne statique : `- [Base de connaissances IA](…/fr/connaissances) — 507 faits sourcés (ROI IA, AI Act, cas d'usage sectoriels), chiffres citables avec source.` (+ mention du sitemap `sitemap-knowledge.xml` dans « Optional »).
  2. **M** (optionnel V2) : brancher `buildLlmsTxt` sur une route dédiée (ex. `/llms-kb.txt`) référencée depuis « Optional » — ⚠️ avant branchement, corriger son filtre (cf. P2 divergence anti-leak) et ajouter l'early-exit `stub.invalid` (absent, contrairement à ses voisins `knowledge-rss.ts`/`knowledge-sitemap.ts`).
- **Effort** : S (étage 1). **Impact GEO/AEO** : fort (canal d'ingestion IA = cœur de cible des fiches-faits). **Risque de régression** : quasi nul (texte statique) ; do-not-touch : les blocs prix SSOT de `llms.txt` (décision actée 4), le bloc Qualiopi conditionnel (l.59-67). Nota : recoupe le P2 d'A5 (angle code mort) — l'angle « hub absent du canal » est distinct et actionnable immédiatement.

### [P1] 100 % du corpus publié est sous les seuils de sa propre quality-gate (44 mots vs 500, 0 H2) — les gates n'ont jamais tourné en prod

- **Symptôme** : 507 pages indexables de ~44 mots chacune (min 28, max 77), aucune avec `<h2>`, toutes du même type/domaine — profil « thin content » massif au sens HCU, alors que la gate maison exige 500 mots + H2 pour ce type. Rendement mesuré : 4 impressions, 0 clic sur l'ensemble du corpus (GSC W33).
- **Preuve code** : `src/lib/knowledge/quality-gates.ts:34-39` (`industry_use_case` PAS dans `SHORT_TEXT_TYPES`) + `:105-123` (gates min_word_count et no_h2_heading) ; `src/content/knowledge/quality-thresholds.ts:67` (`industry_use_case: 500` mots min). Bypass : `prisma/seeds/content-gen/seed-kb-facts.ts:97-112` et `scripts/seed-kb-villes-facts.ts:16-21` écrivent via `PrismaClient` direct, sans passer par `ingestEntry` (`src/server/actions/knowledge/ingest.ts:143-159` où les gates vivent). Le seul caller runtime de `publishToKB` est l'action admin d'ingestion d'URL externe (`src/server/actions/content-gen/kb-ingest-external.ts:67`) — le content-gen n'alimente pas la KB.
- **Preuve live/DB** (2026-08-14 ~18:21 UTC, psql prod `axionia`) : `knowledge_translations` : word_count min 28 / médiane 44 / max 77 ; `count(*) FILTER (WHERE body ~* '<h2')` = **0** ; `knowledge_ingest_requests` = **0 ligne** ; `knowledge_entries.source_factory_id` = NULL sur 520/520 ; type = `industry_use_case` sur 507/507 ; GSC `_AUDIT/crawl-stats-2026-W33.csv` : 3 URLs `/connaissances/`, 4 impressions, 0 clic.
- **Root-cause** : double. (a) Le pipeline ingest + gates (PII, banned-words, heuristiques, dedup pgvector) est **inerte** : 0 exécution depuis sa création — règle maison « une garde ne vaut que si elle rougit » : celle-ci n'a jamais eu l'occasion. (b) Le corpus « facts » a été pensé comme snippets citables (GEO) mais est exposé sous forme de 507 pages autonomes (décision « public assumé » 2026-08-11 — **non remise en cause ici**) sans passe d'enrichissement.
- **Patch prescrit** (sans dépublier, sans rouvrir la décision actée) : au choix de Will —
  1. **Enrichissement** : passe LLM par fiche (contexte sectoriel, « ce que ça implique pour une PME », H2, 400-600 mots) jusqu'à conformité aux seuils ; le pipeline `quality-improver` de content-gen existe déjà (le réutiliser plutôt que réécrire).
  2. **Regroupement** : fusionner les fiches en ~15-25 pages cluster thématiques (`/connaissances/roi-ia`, `/connaissances/ai-act`…) avec 301 des fiches unitaires — plus lourd, meilleure défense HCU.
  3. A minima : faire tourner `runHeuristicGates` en batch read-only sur le corpus (script d'audit) pour objectiver l'écart, et imposer `ingestEntry` comme unique porte d'entrée pour tout futur seed.
- **Effort** : M (option 1) / L (option 2) / S (option 3). **Impact GEO/AEO** : fort (risque de qualité sitewide HCU + 507 pages à 0 rendement). **Risque de régression** : option 1 = moyen (chaque fiche réécrite doit garder son chiffre et sa source exacts — les faits sont la valeur) ; do-not-touch : `publicEntryFilter` (`src/lib/knowledge/public-fetch.ts:31-40`), le mapping routes (`src/content/knowledge/routes.ts:40-51`, décision 2026-08-11), les seuils eux-mêmes (ne pas les abaisser pour « faire passer » le corpus).

### [P1] Hub `/connaissances` orphelin de la navigation, 48/507 fiches listées, ItemList JSON-LD invisible des crawlers non-JS

- **Symptôme** : le hub n'est lié ni dans le Header ni dans le Footer ; il ne liste que 48 fiches sans pagination — 459 fiches ne sont atteignables que via sitemap + maillage inter-fiches ; l'ItemList JSON-LD (le seul à lister jusqu'à 100 items) est injecté après hydratation → invisible de ClaudeBot/PerplexityBot/GPTBot qui n'exécutent pas le JS.
- **Preuve code** : `src/app/[locale]/connaissances/page.tsx:71` (`fetchPublicKbList({ take: 48 })`, aucune pagination) ; `:186-190` (`strategy="afterInteractive"` sur l'ItemList) ; grep `connaissances` dans `src/components/nav/{Header,Footer}.tsx` → 0 occurrence ; seuls maillages entrants : `RelatedKnowledge` sur 7 pages services (cartes vers les détails, **pas de lien « voir tout » vers le hub**, `src/components/services/RelatedKnowledge.tsx:58-115`) et le fil d'Ariane des pages détail.
- **Preuve live** (18:20:08 UTC) : `curl /fr/connaissances` → 200, **48** liens `/fr/connaissances/…` distincts dans le HTML ; `grep numberOfItems` dans le HTML → **0 occurrence** (ItemList absent du HTML servi) ; le CollectionPage inline ne porte que 12 `hasPart`.
- **Root-cause** : le hub a été construit quand la KB publique comptait ~50 fiches ; le passage à 507 (seed villes/ROI/AI Act, mai-août) n'a pas été suivi côté navigation/pagination.
- **Patch prescrit** : (a) pagination du hub (`?page=` ou segments `/connaissances/page/2`) OU sous-hubs par thème (tags existants `service:*` + futurs tags thématiques) ; (b) lien hub dans le Footer (section « Ressources ») ; (c) lien « Toutes les connaissances → /connaissances » au pied de chaque bloc `RelatedKnowledge` ; (d) passer l'ItemList en `strategy="inline"` (coût HTML ~10 Ko, page déjà à 1,3 Mo) ou le supprimer s'il reste JS-only.
- **Effort** : M. **Impact GEO/AEO** : moyen-fort (crawl-depth et link-equity vers 459 fiches ; découvrabilité du hub par les LLM crawlers). **Risque de régression** : faible ; do-not-touch : budget Web Vitals du hub (LCP ≤ 1 800 ms — paginer plutôt qu'allonger la liste), `publicEntryFilter`.

### [P2] Chaîne seo-generator → seo-cache entièrement inerte : 0 ligne en cache, lecteur public jamais branché (FAQPage/areaServed jamais émis)

- **Symptôme** : les sorties AEO du générateur (FAQ Q/R pour FAQPage JSON-LD, entités géo pour areaServed) ne sont ni calculées ni rendues — les pages détail n'émettent que Article + Breadcrumb.
- **Preuve code** : `src/server/actions/knowledge/seo-cache.ts:126-141` (`getSeoCacheForTranslation`, documenté « pour render JSON-LD côté page publique ») — **zéro consommateur** hors de son propre fichier ; le hook d'écriture `refreshSeoCacheForTranslation` n'est appelé que depuis `ingestEntry` (`ingest.ts:261`) qui n'a jamais tourné ; `src/lib/knowledge/seo-generator.ts:16-17` toujours `provider="stub" v1`.
- **Preuve live/DB** (18:21 UTC) : `SELECT count(*) FROM knowledge_seo_cache` → **0**.
- **Root-cause** : Sprint KB-14 livré côté écriture, jamais côté lecture ; dépend du pipeline ingest, lui-même inerte (P1 n° 2).
- **Patch prescrit** : décision produit d'abord — soit abandonner (supprimer le code mort), soit finir le sprint : batch `refreshSeoCacheForTranslation` sur les 520 traductions + rendu conditionnel FAQPage/areaServed dans `connaissances/[slug]/page.tsx`. NB : sur des fiches de 44 mots, `extractFaqQA` ne trouvera quasiment rien — ce patch n'a de valeur qu'APRÈS l'enrichissement du corpus.
- **Effort** : S (purge) / M (finir). **Impact** : faible aujourd'hui, moyen après enrichissement. **Risque** : nul (additif) ; do-not-touch : `buildProductMetadata` (les metaTitle sont tous remplis, 0 NULL en DB — ne pas les écraser par le stub).

### [P2] Divergence `deprecated` : sitemap + recherche l'incluent, la page publique le 404 (latent, 0 entrée concernée aujourd'hui)

- **Symptôme** : le jour où une entrée passera `published → deprecated`, elle restera émise dans `sitemap-knowledge.xml` et dans les résultats `/recherche`, mais `/connaissances/[slug]` répondra 404 → URL cassée poussée aux moteurs.
- **Preuve code** : `src/server/exporters/knowledge-sitemap.ts:66` et `src/lib/knowledge/search-fts.ts:137` (`status IN ('published','deprecated')`) vs `src/lib/knowledge/public-fetch.ts:32` (`status: "published"` strict — SSOT anti-leak utilisé par la page, `connaissances/[slug]/page.tsx:107`).
- **Preuve live/DB** (18:16 UTC) : `GROUP BY status` → 100 % `published` (0 deprecated) → latent, pas de casse actuelle. Marqué double-preuve « code + absence de cas live » : **[À CONFIRMER]** le comportement exact au premier deprecate.
- **Root-cause** : l'intention du sitemap (« deprecated = encore indexable, signalé bas », en-tête `knowledge-sitemap.ts:11-12`) n'a jamais été implémentée côté page.
- **Patch prescrit** : trancher l'intention — soit la page sert les `deprecated` (élargir `publicEntryFilter` OU un fetch dédié avec bandeau « contenu remplacé » + `replacedById`), soit retirer `deprecated` du sitemap ET de la FTS. Une seule source de vérité.
- **Effort** : S. **Impact** : faible aujourd'hui, moyen à la première dépréciation. **Risque** : élargir `publicEntryFilter` touche TOUTES les surfaces publiques — préférer un fetch dédié ; do-not-touch : `publicEntryFilter` lui-même.

### [P2] `buildLlmsTxt` diverge du SSOT anti-leak (pas de filtre confidentiality / publishedAt / embargo)

- **Preuve code** : `src/server/exporters/knowledge-llms-txt.ts:15-24` — `where: { audience: "public", status: in [published, deprecated], deletedAt: null }` sans `confidentiality: "public"`, sans `publishedAt <= now`, sans gate embargo (comparer `public-fetch.ts:31-40` et le filtre durci du sitemap `knowledge-sitemap.ts:62-71`, « P0 audit KB 2026-05-29 »).
- **Preuve live** : sans objet (code mort — cf. P1 n° 1) ; DB : 0 entrée `confidentiality != public` ni embargo futur aujourd'hui.
- **Patch prescrit** : si branchement un jour (étage 2 du P1 n° 1), remplacer le where par `publicEntryFilter(now)` + ajouter l'early-exit `stub.invalid`. Ne PAS brancher en l'état. Effort S. Impact : préventif. Risque : nul.

### [P2] `/recherche` route tous les hits KB vers `/connaissances/<slug>` quel que soit le type (latent : duplication si un type à route dédiée entre en KB)

- **Preuve code** : `src/app/[locale]/recherche/page.tsx:197` (`href={`/connaissances/${hit.slug}`}` en dur) alors que le SSOT est `buildKbPublicUrl(type, …)` (`routes.ts:73-80` : `article`→`/blog`, `faq`→`/faq`, etc.). Aggravant : `fetchPublicKbBySlug` ne filtre pas par type (`public-fetch.ts:110-116`) → une future entrée KB `type=article` serait servie en 200 à la fois sur `/blog/x` (sitemap) et `/connaissances/x` (recherche), chacune auto-canonique → contenu dupliqué.
- **Preuve live/DB** (18:16 UTC) : 507/507 entrées = `industry_use_case` (type routé `/connaissances`) → aucun cas concret aujourd'hui. **[À CONFIRMER]** au premier ingest d'un type à route dédiée.
- **Patch prescrit** : dans `/recherche`, construire le href via `buildKbPublicUrl(hit.type, "fr", hit.slug)` (le type est déjà dans `KbSearchHit`) ; optionnel : restreindre `fetchPublicKbBySlug` aux types dont la route est `/connaissances`. Effort S. Impact : préventif. Risque : nul ; do-not-touch : `KB_PUBLIC_ROUTES` (décision 2026-08-11).

### [P2] Maillage related-entries : le tier sémantique pgvector est de facto court-circuité, ordre quasi arbitraire intra-service

- **Symptôme** : les « entrées liées » d'une fiche sont piochées dans le bucket de son tag `service:*` (65-130 fiches, overlap tags = 1 partout) dans un ordre non déterministe — les 507 embeddings Voyage réels ne servent jamais au maillage.
- **Preuve code** : `src/lib/knowledge/related-entries.ts:159-174` (tier 1 relations : table `knowledge_relations` **vide en prod** → toujours 0) ; `:176-202` (tier 2 tags : ranking par overlap, tous à 1 → tri instable, remplit `limit` à lui seul) ; `:208` (tier 3 sémantique conditionné à `cards.length < limit` → jamais atteint dès que le bucket service ≥ 6).
- **Preuve live/DB** (18:16-18:19 UTC) : `knowledge_relations` = 0 ; tags = 428 liaisons réparties sur 5 tags `service:*` uniquement ; page détail `kb-fact-roi-ia-050-fr` → 6 liées rendues (mélange roi-ia + ai-act, cohérence thématique moyenne).
- **Patch prescrit** : inverser tiers 2 et 3 (sémantique d'abord — les vecteurs sont réels et déjà indexés HNSW), garder les tags en repli ; ou trier le tier 2 par similarité. Effort S-M. **Impact** : moyen (pertinence du cluster topique = signal d'autorité + temps de session). **Risque** : moyen — le SQL brut du tier 3 réplique le filtre anti-leak inline (`related-entries.ts:113-135`) : toute modif doit garder ce prédicat aligné sur `publicEntryFilter` ; do-not-touch : la garde `stub.invalid` (`:110`).

### [P2] Dettes d'hygiène : lastmod sitemap figé sur publishedAt · cron scheduled→published jamais implémenté · publish manuel saute les gates heuristiques · locale-policy code mort · en-tête quality-gates mensonger

- **lastmod** : `knowledge-sitemap.ts:110` — `e.publishedAt ?? frT.updatedAt` : une mise à jour de contenu ne bougera jamais le `<lastmod>` (publishedAt prioritaire). Live 18:22:49 UTC : `lastmod=2026-08-11` = published_at = updated_at (pas encore divergent). Patch S : `max(publishedAt, frT.updatedAt)`. Impact : signal fraîcheur (recoupe D7).
- **Cron scheduled** : `state-machine.ts:84-89` définit `scheduled → published` en `SYSTEM`, `schedule-publish.ts:1` promet « Cron BullMQ Sprint KB-17 publiera » — grep `system: true` : uniquement dans les tests ; aucun worker. Une entrée planifiée resterait bloquée à jamais (0 entrée `scheduled` en DB aujourd'hui). Patch S : job dans un cron worker existant.
- **Publish manuel sans gates** : `publish.ts:29-62` ne vérifie qu'alt-text + banned-words (liste vide depuis 2026-08-10, `banned-words.ts:29`) — pas `runHeuristicGates`. Un admin peut publier une fiche de 10 mots sans H2. Patch S : appeler les gates heuristiques dans `publishAction` (avec le même `forceOverride`).
- **locale-policy** : `locale-policy.ts` n'est importé que par son test — le FR-only réel est codé en dur (`FR_LOCALE` dans public-fetch/related-entries). Conforme à la décision « site FR uniquement » : à purger ou ignorer, ne surtout pas « brancher » pour l'EN.
- **En-tête quality-gates** : `quality-gates.ts:4-6` documente encore « Mot “formation” présent » comme gate bloquante (liste vide depuis 2026-08-10) et un « LLM scoring Claude Haiku » inexistant (stub) — mettre le commentaire à jour.
- **Effort global** : S. **Impact** : faible. **Risque** : nul (docs/compléments additifs).

## Mesures brutes

### Live prod (2026-08-14, UTC)

| Heure | Cible | Résultat |
|---|---|---|
| 18:18:40 | GET `/fr/connaissances` | 200, 0,16 s, 1 311 352 o |
| 18:18:40 | GET `/sitemap-knowledge.xml` | 200, **507** `<loc>`, filtre anti-leak complet, hreflang fr + x-default (EN bien omis) |
| 18:18:46 | `llms.txt` grep `connaissances` | 1 occurrence (titre de section, aucune URL) |
| 18:18:46 | `llms-full.txt` grep `connaissances` | 2 occurrences (prose chatbot, aucune URL) |
| 18:18:46 | `sitemap-index.xml` | `sitemap-knowledge.xml` bien listé (gate anti-vide OK) |
| 18:19:07 | GET `/fr/connaissances/kb-fact-roi-ia-050-fr` | 200, 0,54 s, 1 185 136 o ; Article JSON-LD inline ✔, canonical self ✔, FAQPage ✘ |
| 18:19:27 | Maillage sortant page détail | 6 fiches liées + self (le « slug-2 » vu au grep = clé React RSC, pas un lien — faux positif écarté) |
| 18:20:08 | Hub : liens détail distincts | **48** / 507 ; `numberOfItems` absent du HTML (ItemList `afterInteractive`) |
| 18:22:49 | `<lastmod>` échantillon | 2026-08-11T00:00:00Z = `published_at` = `updated_at` (cohérent) |

### DB prod `axionia` (psql via ssh, 18:15 → 18:23 UTC, SELECT only)

| Requête | Résultat |
|---|---|
| entries par status/audience/confidentiality (deleted_at NULL) | `published / public / public` : **507** — aucun autre triplet |
| entries soft-deleted | 13 (total table 520) |
| types | `industry_use_case` : 507 (100 %) |
| domain | `commercial` : 507 (100 %) |
| source_factory_id / source_model_used | NULL sur 520/520 (aucune entrée issue du pipeline ingest) |
| `knowledge_ingest_requests` | **0 ligne** |
| `knowledge_seo_cache` | **0 ligne** |
| `knowledge_relations` | **0 ligne** |
| `knowledge_embeddings` | 507, `voyage-3 / 2026-06` (réels, pas de suffixe `-stub`) |
| tags | 5 tags `service:*`, 428 liaisons (implementation 130, audit 94, interventions-formations 71, sites-web 68, un-a-un 65) |
| word_count traductions | min 28 / médiane 44 / max 77 ; **0** body avec `<h2>` |
| meta_title / excerpt vides | 0 / 0 |
| embargo futur / publishedAt futur | 0 |
| cadence publication | 2026-05 : 468 · 2026-06 : 0 · 2026-07 : 9 · 2026-08 : 30 |

### GSC (CSV du dépôt, semaine W33)

| Mesure | Valeur |
|---|---|
| URLs `/fr/connaissances/…` avec impressions | 3 (sur 507) |
| Impressions / clics cumulés | 4 / 0 (positions 9-29) |

## Limites

- **GSC live non accessible** : couverture d'indexation réelle des 507 URLs (indexées vs « détectées, non indexées ») non vérifiable — seuls les CSV W29-W33 du dépôt ont été lus. À croiser avec F-squad/D8.
- **SERP / citations LLM live non testées** (réservé F-squad) : je n'ai pas mesuré si une fiche kb-fact est effectivement citée par Perplexity/ChatGPT.
- **Pipeline ingest HMAC non testé en réel** (POST interdit en audit-only) : l'analyse des gates est statique + DB (0 exécution historique — c'est le finding).
- **Findings « latents »** (deprecated, duplication /recherche, llms filter) : sans cas concret en DB aujourd'hui, la preuve live est une preuve d'absence — marqués [À CONFIRMER] au premier cas réel.
- **Déploiement en vol** (parti 17:33 UTC) : toutes les mesures ont été prises avant l'atterrissage estimé (18:30+) sur l'image stable de 14:57 UTC ; aucune surface DB-driven n'était en fenêtre de vide ISR (sitemap plein, hub plein).
- Le rendu des 507 fiches n'a été échantillonné que sur 2 pages (détail + hub) — la relecture éditoriale intégrale d'un échantillon de 10 contenus est le mandat de D2.

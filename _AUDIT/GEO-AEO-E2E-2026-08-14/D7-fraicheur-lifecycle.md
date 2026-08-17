# D7 — Fraîcheur & cycle de vie du contenu

- **Date** : 2026-08-14, mesures live 18:16–18:19 UTC (avant atterrissage du deploy en vol prévu ~18:30 UTC ; l'état mesuré reflète le deploy stable atterri ~14:57 UTC).
- **Périmètre réellement couvert** : `content-refresh-worker`, `content-tier-lifecycle-worker` (+ `tier-decisions.ts`, `analytics-clients.ts`), `content-news-lifecycle-worker`, `content-quality-improver-worker`, `gsc-hcu-monitor-worker`, chaîne `updatedAt → dateModified JSON-LD → lastmod sitemap → bandeau « Dernière révision »`, mécanisme `CONTENT_FRESHNESS` (`scripts/gen-content-freshness.mjs` + CI), régénération en place (`regenerate.ts` / `refreshArticleId`). Live : sitemap-index, pages.xml, sitemap-blog.xml, sitemap-news.xml, sitemap-news-evergreen.xml, 1 article refreshé.
- **Hors périmètre** : volumes DB par statut (D7 non autorisé DB), gates qualité du pipeline de génération (D3), job `warm` (A3), GSC queries (D8).

## Résumé exécutif

La chaîne de fraîcheur **passive** est saine et honnête : un refresh réel (régénération en place du 2026-08-11) propage bien `updatedAt` → `dateModified` JSON-LD → `lastmod` sitemap → bandeau visible « (mis à jour) », et le piège du `lastmod` figé 2026-06-08 sur `pages.xml` est **résolu** (mesuré 2026-08-14T13:56:27Z, via le manifeste `CONTENT_FRESHNESS` généré en CI). En revanche, tout le **système immunitaire actif** est dormant : le worker anti-decay `content-refresh` est triple-mort (flag OFF + aucun cron + aucun producteur), le moniteur HCU est un stub jamais appelé, l'élagage par CTR (demote) est inerte tant que les creds GSC manquent au container worker, et le flux news est gelé depuis le 2026-07-20 (25 jours). Résultat live : 132/134 articles tier-1 dépassent le seuil de décay de 14 j que le projet s'est lui-même fixé, sans aucune alerte. Deux familles (`guides`, `blog` hubs) gardent un lastmod figé 2026-06-08.

## Findings

### [P1] Le worker anti-decay `content-refresh` est triple-mort : il ne peut JAMAIS s'exécuter

- **Symptôme** : aucun scan de « content decay » ne tourne ; aucun candidat au refresh n'est jamais signalé (ni log, ni Telegram, ni dashboard), alors que la doctrine du worker fixe le décay à 14 jours.
- **Preuve code** :
  1. Flag OFF par défaut : `src/server/queue/workers/content-refresh-worker.ts:46` (`CONTENT_REFRESH_ENABLED === "true"`), démarrage conditionnel `src/server/queue/worker.ts:147` ;
  2. **Aucun repeatable job** : `src/server/queue/queues.ts` ne contient aucune entrée pour la queue `content-refresh` (grep `refresh` → seule occurrence = cron Calendly, `queues.ts:913`) alors que l'en-tête du worker annonce « Cron suggéré : hebdomadaire » (`content-refresh-worker.ts:22`) ;
  3. **Aucun producteur** : grep repo entier `content-refresh` → seuls le worker, `worker.ts`, `sentry-worker.ts` et des docs. Aucune Server Action, aucun script, aucune queue n'enqueue jamais un job dans cette queue. Même flag activé, le worker démarre et attend éternellement.
- **Preuve live (2026-08-14T18:17:02Z)** : distribution des `lastmod` de `https://axion-ia.com/sitemap-blog.xml` (134 URLs) : seules 2 URLs ≤ 14 jours (2026-08-11) ; les 132 autres s'étalent du 2026-06-08 au 2026-07-20 — soit 98,5 % du corpus tier-1 au-delà du seuil de décay du worker, sans qu'aucune alerte n'ait pu partir.
- **Root-cause** : worker livré « env-gated » (Sprint v7 Phase 13) mais jamais câblé côté producteur : ni `bootRepeatableJobs`, ni action admin. Le chaînon planification a été oublié.
- **Patch prescrit** : dans `queues.ts`/`bootRepeatableJobs`, ajouter (conditionné à `CONTENT_REFRESH_ENABLED==="true"`) une queue `content-refresh` + repeatable hebdo `0 4 * * 1` (pattern identique aux blocs existants l.1074-1106, avec `removeRepeatable` d'idempotence) ; puis demander à Will de poser le flag Coolify sur l'app worker. Le worker reste scan+alerte (aucune mutation — conforme doctrine anti date-gaming).
- **Effort** : S (≈20 lignes, pattern copié). **Impact GEO/AEO** : fort (le decay > 14 j fait perdre les citations moteurs IA — c'est la raison d'être documentée du worker, `content-refresh-worker.ts:4-7`).
- **Risque de régression** : faible (~5 %) — worker read-only (SELECT + log). Do-not-touch : ne pas ajouter de bump `updatedAt` dans le worker (anti date-gaming, `content-refresh-worker.ts:17-19`) ; ne pas toucher au contrat `stub.invalid`.

### [P1] Élagage tier-lifecycle (demote CTR) inopérant tant que les creds GSC manquent au container worker — [À CONFIRMER côté env Coolify]

- **Symptôme** : le cron quotidien 06:00 UTC `content-tier-lifecycle` tourne, mais toute décision retombe en `noop no_data` si `GSC_OAUTH_*`/`GSC_PROPERTY_URL` sont absents de l'app **worker** (2 apps Coolify distinctes) : aucun article tier-1 sous-performant n'est jamais démoté en noindex, aucun tier-2 méritant n'est promu — l'index gonfle sans jamais être élagué (risque HCU croissant avec le corpus).
- **Preuve code** : `src/server/queue/workers/content-publish-worker.ts:615-617` dit explicitement : « ⚠️ INERTE tant que les creds GSC (`GSC_OAUTH_*`/`GSC_PROPERTY_URL`) sont absents du worker : la source CTR renvoie `null` → le lifecycle noop. Brancher GSC = prérequis opérationnel pour activer réellement l'élagage. » Chaîne : `content-tier-lifecycle-worker.ts:121` → `analytics-clients.ts:47-59` → `gsc-client.ts:112-119` (retourne `null` sans creds) → `tier-decisions.ts:83-85` (`ctr===null` → `noop no_data`). Cron réel : `queues.ts:1090-1106` (daily 06:00 UTC).
- **Preuve live** : non mesurable en GET (nécessite env du container worker ou logs) — d'où le marquage [À CONFIRMER]. Indice indirect : aucune URL du sitemap-blog ne semble être sortie/entrée par performance (distribution des lastmod purement liée aux dates de publication/refresh).
- **Root-cause** : les vars GSC ont été câblées pour le flux `content-keyword-sync` et les workers site-route (app web/worker ?), mais le prérequis « les poser aussi sur l'app worker » (documenté dans le code) n'a pas de vérification opérationnelle.
- **Patch prescrit** : (1) vérifier sur Coolify (app worker `axion-ia-worker`) la présence des 4 vars `GSC_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN` + `GSC_PROPERTY_URL` ; les poser si absentes (scope RUN) + restart worker ; (2) ajouter au run du worker un log de démarrage « GSC creds present: yes/no » pour que l'inertie soit visible dans les logs.
- **Effort** : S (ops) + S (log). **Impact GEO/AEO** : fort (anti-HCU : c'est le seul mécanisme d'élagage de l'index hors news).
- **Risque de régression** : moyen (~15 %) — activer réellement le demote peut sortir du sitemap des pages voulues ; garde-fous déjà en place (`impressionsMinForDecision=100`, `respectManualPromote`, anti-yoyo `URL_UPDATED` et jamais `URL_DELETED` sur demote, `content-tier-lifecycle-worker.ts:80-94`). Do-not-touch : `tier-decisions.ts` (seuils actés audit 2026-05-18), la sémantique anti-yoyo du demote.

### [P1] Fraîcheur « actualités » gelée depuis le 2026-07-20 (25 jours) — et un kill-switch actif gèle AUSSI les crons de cycle de vie — [À CONFIRMER : état kill_switch]

- **Symptôme** : plus aucune actualité publiée depuis ~25 jours ; la section news du site n'émet plus aucun signal de fraîcheur (Google News, Bing, moteurs IA).
- **Preuve live (2026-08-14T18:16–18:19Z)** : `https://axion-ia.com/sitemap-news.xml` = `<urlset>` **vide** (fenêtre 48 h) et correctement retiré de `sitemap-index.xml` (gating anti-vide OK) ; `https://axion-ia.com/sitemap-news-evergreen.xml` = 32 URLs, `lastmod` max = **2026-07-20T06:01:06Z** — aucune publication news depuis.
- **Preuve code** : les deux workers de cycle de vie s'arrêtent net si le kill-switch est actif : `content-news-lifecycle-worker.ts:38-44` et `content-tier-lifecycle-worker.ts:151-157` (`readContentGenConfig("kill_switch")` → skip). Un kill-switch laissé actif (contexte connu : crédits OpenAI à zéro, revue console 2026-08-04, « recharger OpenAI puis désarmer le kill switch » — reste Will déjà acté, non re-listé ici) gèle donc **silencieusement** : la génération, MAIS AUSSI l'archivage news > 90 j et tout promote/demote — sans alerte ni métrique.
- **Root-cause** : conception voulue pour la génération (sécurité) mais effet de bord non signalé sur les crons de lifecycle : le skip est un simple `console.log`, invisible sauf à lire les logs du container.
- **Patch prescrit** : dans les deux workers, quand `killSwitch.active`, émettre un compteur/alerte (Telegram MONITORING 1×/semaine max, dédupliquée) « kill-switch actif depuis N jours — lifecycle gelé » ; ne PAS changer le comportement de skip lui-même.
- **Effort** : S. **Impact GEO/AEO** : moyen (la fraîcheur news est le signal le plus périssable ; 25 j de gel est déjà visible des crawlers).
- **Risque de régression** : faible (~5 %) — alerte additive. Do-not-touch : le hard-gate kill_switch lui-même (fix P1-7 audit 2026-05-14), le gating anti-vide des sitemaps news.

### [P2] Moniteur HCU (`gsc-hcu-monitor`) : un stub qui ne mesure rien, jamais planifié, flag OFF

- **Symptôme** : la surveillance « déindexation soudaine > 5 % » n'existe pas : même flag activé, le job retournerait des zéros.
- **Preuve code** : `gsc-hcu-monitor-worker.ts:53-61` (« V1 stub : retourne 0/0 sans appel GSC réel ») ; flag `GSC_HCU_MONITOR_ENABLED` (l.34) ; démarrage conditionnel `worker.ts:146` ; **aucun** repeatable job ni producteur pour la queue `gsc-hcu-monitor` (grep repo : seuls worker/sentry/docs). Triple-mort + implémentation vide.
- **Preuve live** : sans objet (rien à mesurer côté prod — c'est le constat).
- **Root-cause** : squelette Sprint v7 Phase 9, « GSC API integration reportée Session 10+ » jamais faite ; entre-temps `gsc-client.ts` (OAuth réel, URL Inspection incluse l.328-340) a été livré — le stub n'a jamais été rebranché dessus.
- **Patch prescrit** : implémenter `runMonitorJob` sur `gscUrlInspection`/Search Analytics via `gsc-client.ts` existant (pas de nouveau SDK), + cron daily dans `bootRepeatableJobs` gated par le flag. Alternative minimale : supprimer le worker et porter la détection dans `site-route-gsc-worker` (qui a déjà les données GSC par URL).
- **Effort** : M. **Impact GEO/AEO** : moyen (filet de sécurité, pas un levier direct).
- **Risque de régression** : faible — lecture seule GSC. Do-not-touch : quotas API GSC partagés avec keyword-sync/site-route-gsc (rate-limiter commun à prévoir).

### [P2] `guides.xml` et les hubs catégorie blog gardent un `lastmod` figé 2026-06-08 : familles absentes du manifeste de fraîcheur

- **Symptôme** : deux surfaces déclarent « rien depuis le 8 juin » alors qu'elles ont bougé (des articles sont entrés dans les catégories jusqu'au 2026-08-11).
- **Preuve code** : `scripts/gen-content-freshness.mjs:49-69` — `FAMILIES` ne contient ni `guides` ni `blog` ; `sitemap.ts:504-509` (`editorialFor` → fallback `EDITORIAL_BASELINE` 2026-06-08) ; `sitemap.ts:559` (`buildBlogSitemap(editorialFor("blog"))` — le défaut sert aux hubs catégorie, cf. `sitemap.ts:744-745` et l.891-897).
- **Preuve live (2026-08-14T18:16:35Z)** : `sitemap-index.xml` → `sitemap/guides.xml` `lastmod=2026-06-08T00:00:00.000Z` (seule famille figée de l'index) ; `sitemap-blog.xml` → 5 URLs `/fr/blog/categorie/blog-*` à `2026-06-08T00:00:00.000Z` alors que 2 articles y sont entrés le 2026-08-11.
- **Root-cause** : le manifeste 2026-07-31 a couvert 11 familles ; `guides` (hub seul dans son sub-sitemap) et le défaut `blog` sont passés à travers.
- **Patch prescrit** : ajouter dans `FAMILIES` : `guides: ["src/app/[locale]/guides", "src/server/content-gen/blog"]` (ou aligner sur `pages`) et `blog: ["src/server/content-gen/blog", "src/content/blog"]` ; idéalement, pour les hubs catégorie, prendre le `max(publishedAt)` des articles de la catégorie (déjà en DB dans `buildBlogSitemap`).
- **Effort** : S. **Impact GEO/AEO** : moyen-faible (hubs = points d'entrée de crawl).
- **Risque de régression** : faible (~5 %). Do-not-touch : la garde clone-superficiel du script (l.100-121), `fetch-depth: 0` du checkout (`deploy-coolify.yml:214`).

### [P2] Famille `pages` trop large : `pages.xml` re-déclare TOUTES les pages statiques modifiées à quasi chaque commit

- **Symptôme** : les ~pages statiques partagent UN lastmod = dernier commit touchant `src/content` **ou** `src/app/[locale]` (surface immense) → il avance à presque chaque deploy pour toutes les URLs, y compris inchangées — retour partiel, pour cette famille, du date-gaming `BUILD_TIME` que l'audit 2026-06-08 avait éliminé.
- **Preuve code** : `scripts/gen-content-freshness.mjs:67-68` (`pages: ["src/content", "src/app/[locale]"]`, commenté « Filet : … surface la plus large ») ; `sitemap.ts:554-555` (une seule date pour tout `buildPagesSitemap`).
- **Preuve live (2026-08-14T18:16:35Z)** : toutes les URLs échantillonnées de `sitemap/pages.xml` portent `lastmod=2026-08-14T13:56:27.000Z` (commit du jour), y compris des pages sans changement de contenu.
- **Root-cause** : compromis assumé lors du fix 2026-07-31 (mieux que la constante figée), mais la granularité « une date pour ~200 pages » sur-déclare structurellement.
- **Patch prescrit** : découper `pages` en 3-4 sous-familles (ex. `services`, `legal`, `entreprise`, filet restant) dans `FAMILIES` + un `lastModFor` par groupe dans `buildPagesSitemap`. À faire seulement si le crawl-budget montre des re-crawls inutiles (GSC stats — coordonner avec D8).
- **Effort** : M. **Impact GEO/AEO** : faible-moyen. **Risque de régression** : faible. Do-not-touch : ne pas revenir à `BUILD_TIME`, ne pas retirer le filet (une famille non couverte retomberait à 2026-06-08).

### [P2] Commentaire stale dans `tier-lifecycle-worker` : il affirme le contraire du code de publication (drift documentaire)

- **Symptôme** : `content-tier-lifecycle-worker.ts:85-87` affirme « avec la publication systématique en tier_1 + promotedAt (content-publish-worker), les articles sont désormais protégés du demote → ce chemin est quasi inerte » ; or depuis la décision Will P4 2026-06-21, `promotedAt` n'est **plus** posé au publish (`content-publish-worker.ts:608-614` et 723-726 : « Reste null — réservé à une future protection éditoriale manuelle »). Le demote n'est PAS protégé — il est inerte pour une autre raison (creds GSC, cf. P1 ci-dessus). Un dev qui lit le worker conclura à tort que l'élagage est neutralisé « by design ».
- **Preuve code** : les deux blocs cités. En prime, `applyPromote` (`content-tier-lifecycle-worker.ts:60-61`) pose `promotedAt` sur les promotions **automatiques**, polluant la sémantique « protégé manuellement » restaurée par P4 : tout tier-2 auto-promu devient indéboulonnable.
- **Preuve live** : sans objet (drift interne).
- **Patch prescrit** : corriger le commentaire l.85-87 ; retirer `promotedAt: new Date()` d'`applyPromote` (le remplacer par un champ dédié `autoPromotedAt` si la traçabilité est voulue) pour que les auto-promus restent démontables.
- **Effort** : S. **Impact GEO/AEO** : faible aujourd'hui (chemin inerte), moyen dès que GSC sera branché. **Risque de régression** : faible ; do-not-touch : `respectManualPromote` dans `tier-decisions.ts`.

### [P2] `revalidatePath` appelé depuis le process worker BullMQ = no-op garanti, pas « no-op si pas de request context »

- **Symptôme** : à l'archivage news, `content-news-lifecycle-worker.ts:84,112-114` appelle `revalidatePath("/fr/actualites/<slug>")`, `/sitemap.xml`, `/sitemap-news.xml` — le worker tourne dans un container séparé du serveur Next : ces appels n'invalident jamais le cache du site. Le commentaire (« no-op si pas de request context ») laisse croire que ça marche parfois.
- **Preuve code** : lignes citées ; architecture 2 apps Coolify (mémoire projet : web + worker séparés).
- **Preuve live** : non isolable (mitigé par l'ISR : `sitemap-blog.xml` `revalidate=600`, pages ISR ≤ 1 h — l'incohérence se résorbe seule sous ~1 h).
- **Patch prescrit** : remplacer par un POST authentifié vers `/api/internal/revalidate` (mécanisme existant, cf. audit KB 2026-08-11) ou supprimer les appels + commentaire honnête « ISR TTL fait foi ».
- **Effort** : S. **Impact GEO/AEO** : faible (fenêtre ≤ 1 h). **Risque de régression** : faible ; do-not-touch : l'émission `URL_DELETED` + IndexNow à l'archivage (P0-8, l.88-99) qui, elle, fonctionne.

### [P2] `lockDuration` 120 s du tier-lifecycle vs jusqu'à 2 000 appels GSC séquentiels par run

- **Symptôme** : quand les creds GSC seront branchés, un run scanne jusqu'à `MAX_BATCH_PER_RUN=1000` articles × 2 tiers avec un appel HTTP GSC **séquentiel** par article (`content-tier-lifecycle-worker.ts:117-124`) ; à ~300 ms/appel → >10 min, très au-delà de `lockDuration: 120_000` (l.204) → BullMQ marquera le job « stalled » et le relancera → double traitement des promote/demote.
- **Preuve code** : l.40 (`MAX_BATCH_PER_RUN = 1000`), l.117-145 (boucle séquentielle), l.204 (`lockDuration: 120_000`). Contraste : `content-quality-improver-worker.ts:471` a documenté exactement ce piège et posé 120 s pour UNE seule review.
- **Preuve live** : non observable tant que le lifecycle est inerte (cf. P1).
- **Patch prescrit** : `lockDuration: 1_800_000` (30 min, comme content-refresh l.124) OU chunker le batch (100/run). À faire AVANT de brancher les creds GSC.
- **Effort** : S. **Impact GEO/AEO** : faible (fiabilité). **Risque de régression** : nul.

### [P2] Promesse publique « cycle de mise à jour : 90 jours » vs pratique réelle — à surveiller

- **Symptôme** : chaque article affiche un bloc transparence promettant un cycle de mise à jour de 90 jours (`blog/[slug]/page.tsx:673-677`, `updateCycleDays={90}`). Le refresh étant 100 % manuel (cf. P1 content-refresh) et le gros du corpus datant du 2026-07-02→07-20, une partie du corpus franchira les 90 j sans mise à jour vers début octobre 2026 — la promesse deviendrait factuellement fausse (piège connu du projet : « un ajout peut rendre mensongère une phrase existante »).
- **Preuve live (2026-08-14T18:17:35Z)** : `/fr/blog/cabinet-audit-ia-grenoble-faq` affiche le bloc + « Dernière révision : 2026-08-11 (mis à jour) » — chaîne OK aujourd'hui ; le risque est calendaire.
- **Patch prescrit** : activer le P1 content-refresh (l'alerte hebdo suffit à tenir le cycle 90 j avec ~15 régénérations/semaine via `regenerateArticle` batch existant, `regenerate.ts`), OU abaisser la promesse.
- **Effort** : S (dépend du P1). **Impact GEO/AEO** : moyen à horizon octobre.

## Mesures brutes

Toutes les mesures : GET curl, horodatées UTC.

| URL | Heure (UTC) | Status | Observation |
|---|---|---|---|
| `/sitemap-index.xml` | 18:16:35 | 200 | 34 sub-sitemaps ; `pages` 2026-08-14T13:56:27Z ; `guides` **2026-06-08** (seul figé) ; `cas-concrets` 2026-05-24 (honnête) ; villes 2026-08-13 |
| `/sitemap/pages.xml` | 18:16:35 | 200 | toutes les URLs échantillonnées : `lastmod=2026-08-14T13:56:27.000Z` (une date unique famille) |
| `/sitemap-blog.xml` | 18:16:49→18:17:02 | 200 | 134 URLs ; lastmod : 5×2026-06-08 (hubs catégorie), gros du corpus 07-02→07-20, **2×2026-08-11** (refresh réels), rien entre 07-20 et 08-11 |
| `/sitemap-news.xml` | 18:19:06 | 200 | `<urlset>` **vide** (fenêtre 48 h) ; correctement absent de l'index (gating anti-vide OK) |
| `/sitemap-news-evergreen.xml` | 18:16:49 | 200 | 32 URLs ; lastmod max = **2026-07-20T06:01:06Z** → 0 news depuis 25 j |
| `/fr/blog/cabinet-audit-ia-grenoble-faq` | 18:17:35 | 200 | JSON-LD `datePublished=2026-07-02`, `dateModified=2026-08-11` ; bandeau « Dernière révision : 2026-08-11 (mis à jour) » ; cohérent avec lastmod sitemap 2026-08-11 → **chaîne de fraîcheur vérifiée bout en bout** |

Distribution lastmod sitemap-blog (18:17:02Z) : 2026-06-08×5, 06-26×3, 06-29×3, 07-02×22, 07-03×16, 07-04×7, 07-05×14, 07-06×20, 07-07×2, 07-08×3, 07-09×3, 07-16×2, 07-17×20, 07-18×1, 07-19×5, 07-20×6, **08-11×2**.

État code (statique) : `content-refresh` = 0 cron + 0 producteur + flag OFF ; `gsc-hcu-monitor` = idem + stub 0/0 ; `content-news-lifecycle` = cron 05:00 UTC OK (`queues.ts:1074-1085`) ; `content-tier-lifecycle` = cron 06:00 UTC OK (`queues.ts:1090-1106`) ; `content-quality-improver` = event-driven correctement câblé (`content-gen-worker.ts:1153-1162`) ; manifeste `CONTENT_FRESHNESS` généré en CI avec `fetch-depth: 0` + garde clone-superficiel (`deploy-coolify.yml:206-214,249-250`).

## Limites

- **Pas d'accès DB** (D7 non autorisé) : impossible de vérifier l'état réel de `ContentGenConfig.kill_switch`, les compteurs promote/demote/archive, ou le nombre d'articles par tier — les deux findings marqués [À CONFIRMER] en dépendent.
- **Pas d'accès aux env du container worker ni aux logs** (prod = GET/HEAD only pour D7) : la présence des vars `GSC_OAUTH_*` sur l'app worker Coolify et les logs `[tier-lifecycle] run done…` n'ont pas pu être lus. À croiser avec D8 (qui a l'accès DB et audite les données GSC).
- **Deploy en vol** : mesures prises 18:16–18:19 UTC, avant l'atterrissage estimé 18:30–19:00 UTC du run parti à 17:33 — elles reflètent le deploy stable de ~14:57 UTC ; les lastmod « pages » pourraient avancer après atterrissage (comportement attendu du manifeste, pas un bug).
- La cause exacte du gel news depuis le 2026-07-20 (kill-switch, crédits OpenAI, sources RSS taries, orchestrateur) relève de D1/D2 ; D7 n'en constate que l'effet fraîcheur.

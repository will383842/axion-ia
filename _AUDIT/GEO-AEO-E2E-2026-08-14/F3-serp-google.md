# F3 — SERP Google live

- **Date / heure** : 2026-08-14, mesures live **19:09 → 19:31 UTC**.
- **Fenêtre de déploiement (vérifiée `gh run list`, 19:31:10 UTC)** : le run parti à
  17:33:06 UTC s'est terminé `success` à **18:36:05 UTC** (atterrissage prod ~18:26 UTC) ;
  le run parti à 18:36:39 UTC a été **`cancelled`** à 18:55:24 UTC par celui parti à
  **18:54:44 UTC**, encore `in_progress` à 19:31 UTC (atterrissage estimé 19:50–20:00 UTC).
  ⇒ **Toutes mes mesures live tombent dans la fenêtre post-deploy ≤ 1 h** de l'atterrissage
  de 18:26 UTC (fin de fenêtre ~19:26–19:36 UTC). Chaque mesure concernée est signalée ;
  un contenu DB-driven vide y est NORMAL par contrat (ADR 0026) — je l'ai exploité comme
  **preuve du mécanisme**, jamais comme preuve d'un bug de rendu.
- **Périmètre réellement couvert** : 12 requêtes cœur (brand, commerciales, AEO) passées
  sur toutes les surfaces Google **réellement accessibles** depuis cette session
  (Google Suggest API, Google News RSS) + 2 index tiers (Brave, Mojeek) + 1 moteur de
  réponse (WebSearch) ; positions Google **authentiques** reconstruites depuis les exports
  API GSC hebdo `_AUDIT/crawl-stats-2026-W31/W32/W33.csv` (dimension `page`) ; présentation
  SERP des pages qui ranquent réellement (titres, meta descriptions, JSON-LD inline des
  familles classées) ; éligibilité aux fonctionnalités SERP (fil d'Ariane, étoiles,
  JobPosting, sitelinks searchbox) ; cannibalisation multi-URL par ville.
- **Non couvert (voir § Limites)** : la **page de résultats Google elle-même** — position
  exacte sur 10 bleus, rich snippets affichés, PAA, **AI Overview** (présence + qui est
  cité), **Knowledge Panel**, sitelinks. Google refuse toute lecture serveur depuis cette
  session (mur de consentement + shell JS + « mettez à jour votre navigateur »), et aucune
  clé SERP API n'existe dans le dépôt.

## Résumé exécutif

Le verdict du 2026-07-20 (« absent du top 10 partout ») **est périmé sur la forme et
aggravé sur le fond**. Le site est désormais dans le **top 10 Google sur 119 pages** et
dans le **top 3 sur 26 pages** (W33, données GSC) — mais ces positions ne portent
**aucune demande** : 26 pages en top 3 = **60 impressions et 2 clics** en une semaine ;
118 pages top 10 hors home = **428 impressions, 3 clics (CTR 0,70 %)**. Google
l'atteste, son propre autocomplete le confirme : « audit ia grenoble », « prix formation
ia entreprise », « consultant intelligence artificielle pme » ne renvoient **zéro
suggestion**. Sur les requêtes qui, elles, ont du volume, Axion-IA reste hors SERP : 0/6
sur les index tiers, 0/10 sur la requête AEO « qu'est-ce qu'un audit IA », et surtout
**les pages money reculent** (`/fr/formations` 27 → 42,4 ; `/fr/sites-web-augmentes`
56,8 → 58,7 ; home 3,10 → 6,25) pendant que **`/fr/audit`, la page du service phare,
plafonne à 1 impression/semaine**. Deux défauts de présentation aggravent le peu de SERP
obtenu : une **fenêtre d'une heure après chaque déploiement** où Googlebot reçoit la home
sans son bloc avis (mesurée de bout en bout : 18:28 → 19:28 UTC), et des **titres doublés
ou tronqués** sur les familles qui ranquent. Enfin Google ne reconnaît pas la marque :
l'autocomplete corrige **« axion-ia » → « action ia »**.

## Findings

### [P0] Top 10 atteint sur 119 pages, mais sur des requêtes sans demande : 26 pages en top 3 → 60 impressions → 2 clics

- **Symptôme** : la conquête de positions est réelle et mesurable, mais elle porte sur des
  requêtes à volume quasi nul. Le domaine entier fait **1 515 impressions / 13 clics** en
  W33. Rapporté aux positions : les 26 pages en **top 3** cumulent **60 impressions**
  (2,3 impressions/page/semaine) et **2 clics** ; les 31 pages en position 3–5 : **127
  impressions, 0 clic**. Une page en position 2 qui reçoit 1 impression par semaine n'est
  pas une victoire SEO, c'est une requête que personne ne tape.
- **Preuve live n°1 (positions Google authentiques)** — agrégats calculés le 2026-08-14
  19:23 UTC sur `_AUDIT/crawl-stats-2026-W33.csv` (export API GSC, `dimensions:["page"]`,
  cf. `scripts/perf/export-gsc-crawl-stats.mjs:107-110`) : voir tableau « buckets de
  position » en § Mesures brutes. **Top 10 hors home : 118 pages, 428 impressions,
  3 clics (0,70 %)** alors que le CTR attendu en positions 4–10 est de l'ordre de 2–8 %.
- **Preuve live n°2 (Google Suggest, API `suggestqueries.google.com`, 19:20:00 et
  19:27:37 UTC — surface Google **non** affectée par le deploy)** : `audit ia grenoble`
  → `[]` ; `prix formation ia entreprise` → `[]` ; `pourquoi faire un audit ia` → `[]` ;
  `consultant intelligence artificielle pme` → `[]` ; `formation ia entreprise grenoble`
  → `[]` ; `organisme formation ia qualiopi` → `[]`. À l'inverse `formation ia entreprise`
  (sans ville) renvoie 10 suggestions — dont `geneve`, `toulouse`, `rennes`, `en ligne`,
  **jamais `grenoble`**. L'absence de suggestion n'est pas une preuve de volume nul, mais
  c'est le seuil que Google lui-même applique : ces requêtes sont sous son plancher.
- **Preuve live n°3 (index tiers)** : Brave, 19:21:51 → 19:22:33 UTC, 8 requêtes valides —
  `axion-ia.com` est **#1 sur les 2 requêtes brand** et **absent des 6 requêtes
  commerciales/AEO** (`formation IA entreprise Grenoble`, `audit IA PME France`,
  `organisme formation IA Qualiopi`, `organisme formation IA Qualiopi Grenoble PME`,
  `audit IA entreprise PME France`, `qu'est-ce qu'un audit IA`). WebSearch 19:30:5x UTC
  sur « qu'est-ce qu'un audit IA en entreprise définition » : **10 résultats, 0 Axion-IA**
  (step-agency, iavenir, vent-en-poupe, justai, agence.media, hyperstack, coekipia,
  itefficience, zenextia, laucked).
- **Preuve code** : la boucle qui devait empêcher exactement ça est morte aux deux bouts —
  `src/server/content-gen/keyword-selector.ts:135-143` court-circuite la banque de seeds
  dès qu'une ville est fournie (les combinaisons ville×service sont donc générées **sans
  aucune validation de demande**), et `src/server/queue/workers/content-keyword-sync-worker.ts:74-83`
  ne suit que les Articles blog `tier1|tier2` — **15 URLs suivies, toutes `/fr/blog/*`
  Grenoble** (mesuré par D8 en base prod à 18:34 UTC, `keyword_tracking` gelé au
  2026-07-20). Aucun garde-fou « volume minimum » n'existe dans la chaîne de génération.
- **Root-cause** : le corpus pSEO a été dimensionné sur une combinatoire géographique
  (≈ 1 816 villes × familles de services) et non sur un espace de requêtes vérifié. Google
  finit par classer ces pages — faute de concurrence sur des requêtes que personne
  n'émet. Ce n'est **pas** un problème de rendu, de crawl ni d'indexation : le site est
  bien indexé (cf. F2, F4).
- **Patch prescrit** :
  1. **Porte de volume avant génération** (S) : dans le sélecteur de mots-clés, refuser
     un couple (ville, service) dont la requête cible ne renvoie **aucune** suggestion
     Google Suggest — l'API est gratuite, sans clé, 1 appel/keyword, et c'est exactement
     le seuil observé ici. Journaliser le refus (pas de suppression silencieuse).
  2. **Re-prioriser les pages money** (M) : étendre le sync GSC aux ~15 pages stratégiques
     (patch déjà prescrit par D8) pour piloter `/fr/audit`, `/fr/formations`,
     `/fr/un-a-un` au lieu des seuls articles blog.
  3. **Ne PAS relancer la génération en volume** — règle déjà actée le 31/07 (position
     moyenne des nouvelles pages > 15) ; ce finding la renforce, il ne la rouvre pas.
- **Effort** : S (garde-fou) + M (extension du suivi).
- **Impact GEO/AEO** : **fort** — l'index Google est la porte d'entrée des AI Overviews et
  du grounding des assistants ; ranker sur des requêtes mortes ne nourrit aucun moteur.
- **Risque de régression du patch** : faible. La porte de volume doit être **fail-open**
  (si Suggest ne répond pas, on laisse passer) sous peine de bloquer toute génération.
  **Do-not-touch** : cap villes 480 (décision actée), `keyword-lock.ts` (verrou atomique),
  la rétro-compat `campaignId` de `keyword-selector.ts:149-154`, le kill-switch pour tout
  ce qui appelle un LLM.

### [P0] `/fr/audit` — la page du service phare — est quasi absente de la SERP (1 impression/semaine) pendant que 117 pages villes en captent 481

- **Symptôme** : la page de destination commerciale principale n'existe pas dans les
  résultats Google. W31 : **absente** des pages à impressions. W32 : **absente**. W33 :
  **1 impression, position 17, 0 clic**. Sur la même semaine, la famille `implantations`
  (117 pages) capte 481 impressions et **1 clic**, et `sites-web-augmentes` 196
  impressions et **0 clic** en position moyenne 39,6. Google, mis en présence du site,
  choisit systématiquement les pages périphériques plutôt que le hub d'offre.
- **Preuve live (données GSC, agrégats 19:24 UTC)** :

  | Page | W31 | W32 | W33 |
  |---|---|---|---|
  | `/fr` (home) | pos 3,10 · 41 imp · 10 clics | pos 4,35 · 52 imp · 2 clics | **pos 6,25 · 60 imp · 6 clics** |
  | `/fr/audit` | absente | absente | **pos 17,00 · 1 imp · 0 clic** |
  | `/fr/formations` | pos 27,00 · 4 imp | pos 28,48 · 23 imp | **pos 42,37 · 41 imp · 0 clic** |
  | `/fr/un-a-un` | pos 40,50 · 6 imp | pos 37,43 · 81 imp | **pos 42,65 · 63 imp · 0 clic** |
  | `/fr/sites-web-augmentes` | pos 56,76 · 17 imp | pos 54,73 · 93 imp | **pos 58,68 · 59 imp · 0 clic** |

  Les trois hubs commerciaux sont en **page 4 à 6** de Google et **continuent de reculer**
  semaine après semaine ; la home perd 3 positions en 2 semaines.
- **Preuve live complémentaire (19:29:19 UTC, hors fenêtre DB : HTML statique)** :
  `GET /fr/audit` → 200, `<title>` 62 car., meta description 152 car., `ItemList` en
  `afterInteractive` (cf. `src/app/[locale]/audit/page.tsx:273`, relevé B4) — la page est
  techniquement saine ; son problème est un problème de **demande captée**, pas de rendu.
- **Preuve code** : rien n'arbitre entre le hub `/fr/audit` et ses déclinaisons
  `/fr/audit/par-ville/*`, `/fr/implantations/**`, `/fr/blog/*audit-ia-<ville>*` : trois
  familles produisent des pages pour la même intention « audit IA + ville » ; le sync GSC
  qui permettrait de le voir ne couvre **aucune** de ces pages
  (`content-keyword-sync-worker.ts:74-83`, cf. finding P0 précédent).
- **Root-cause** : dilution — la surface pSEO absorbe la pertinence thématique du hub
  (même champ lexical, maillage sortant massif vers les villes) et Google n'a aucun signal
  fort désignant `/fr/audit` comme la page canonique de l'intention « audit IA ».
- **Patch prescrit** : (1) faire de `/fr/audit` la **cible de liens internes descendants**
  depuis les pages villes du même service (lane C4/D6 — vérifier avant de patcher que le
  lien remontant existe déjà) ; (2) inclure les hubs dans le sync GSC pour qu'un recul
  soit **vu** (patch D8) ; (3) ne PAS ajouter de pages villes supplémentaires sur l'axe
  audit tant que le hub n'est pas remonté.
- **Effort** : M.
- **Impact GEO/AEO** : **fort** — c'est la page que les moteurs de réponse devraient citer
  sur « audit IA entreprise » (requête où F4 mesure 0 citation et où Mookay/Jaydai captent).
- **Risque de régression** : faible pour le maillage ; **moyen** si l'on touche aux
  canonicals des pages villes (risque de désindexation en masse — ne PAS canonicaliser les
  villes vers le hub). **Do-not-touch** : canonicals auto-référents des pages villes
  (`src/lib/seo.ts` `buildProductMetadata`), cap villes 480, `sitemap/implantations.xml`.

### [P1] Fenêtre d'une heure après chaque déploiement où Googlebot reçoit la home sans son bloc avis — les deux listes du job `warm` oublient `/fr`, et le warmer épingle lui-même la version périmée

- **Symptôme** : après chaque déploiement, la home est servie par Cloudflare **sans
  `aggregateRating`** pendant exactement la durée du TTL edge (3 600 s). Tout crawl
  Googlebot dans cette fenêtre — c'est précisément le moment où Google revient, la purge
  CF globale ayant invalidé tout le site — voit une home amputée de sa preuve sociale
  (77 avis, 4,88/5) et de son nœud `AggregateRating`.
- **Preuve live (mesure de bout en bout, la même URL à 81 s d'intervalle)** :
  - **19:27:07 UTC** — `GET https://axion-ia.com/fr` : `cf-cache-status: HIT`,
    **`Age: 3540`** (⇒ objet mis en cache ~**18:28:07 UTC**, soit ~2 min après
    l'atterrissage du deploy), `x-axion-build-sha: 99ba93a0…` →
    `aggregateRating` = **0 occurrence**, `ratingValue` = **0**, `reviewCount` = **0**.
  - **19:28:37 / 19:28:40 / 19:28:43 UTC** — même URL, l'objet edge a expiré :
    `Age: 23 / 27 / 30`, même `build-sha` → `aggregateRating` = **1**,
    **`ratingValue: 4.9`**, `reviewCount: 77`. Rien n'a été déployé entre les deux
    mesures : seul le cache a tourné.
  - Contrôle 19:27:07 UTC : `GET /fr/avis` (`cf-cache-status: BYPASS`) portait bien
    `ratingValue 4.9` / `reviewCount 77` — la donnée était disponible côté origin pendant
    toute la fenêtre. **La fenêtre mesurée est donc bien 18:28 → 19:28 UTC = 60 minutes.**
- **Preuve code** :
  - `.github/workflows/deploy-coolify.yml:747` — liste de revalidation ISR :
    `PATHS='["/fr/actualites","/fr/connaissances","/fr/ressources","/fr/galerie","/fr/diagnostic"]'`
    → **`/fr` absent**.
  - `.github/workflows/deploy-coolify.yml:778` — liste de purge CF ciblée
    (`FILES=[…]`, les **mêmes 5 URLs**) → **`/fr` absent**.
  - `.github/workflows/deploy-coolify.yml:808` — `STRATEGIC="/fr /fr/diagnostic /fr/audit …"` :
    la home **est** chauffée… par un simple `curl` **postérieur à la purge globale** et
    **antérieur à toute revalidation** de `/fr` — c'est donc le warmer lui-même qui
    **fige la version périmée** au bord pour `s-maxage=3600`. Le workflow décrit ce piège
    mot pour mot aux lignes 761-767 (« tout visiteur (ou le LHCI) qui passe dans
    l'intervalle refige la version STUB chez Cloudflare pour s-maxage=3600 ») — mais le
    remède n'a été appliqué qu'aux 5 URLs de la liste, pas à la home.
- **Root-cause** : ordre des étapes (purge globale → warm → …) + deux listes de
  remédiation incomplètes. La home lit la note agrégée en base ; au premier rendu après
  redémarrage, l'ISR sert le rendu de build (DB stub `stub.invalid`) et régénère en
  arrière-plan — comportement **normal et documenté** (ADR 0026) ; ce qui ne l'est pas,
  c'est que le bord épingle ce rendu une heure.
- **Patch prescrit** : ajouter **`/fr`** (et, par cohérence de raisonnement, tout hub de la
  liste `STRATEGIC` qui lit la base) aux **deux** listes — `PATHS` (l.747) et `FILES`
  (l.778) — pour que la séquence devienne revalidate → purge ciblée → warm. 2 lignes.
- **Effort** : **S**.
- **Impact GEO/AEO** : **moyen-fort**. À nuancer honnêtement : Google **n'affiche pas**
  d'étoiles pour une note auto-déclarée par une organisation sur son propre site (les
  « self-serving reviews » sont exclues des rich results) — le patch ne fera donc pas
  apparaître d'étoiles dans la SERP. Ce qui se perd réellement pendant l'heure est le
  **signal d'entité** (le nœud `AggregateRating` du graphe `#organization`, la preuve
  sociale lisible par les moteurs de réponse) et la **stabilité** du balisage vue par
  Google — un signal qui clignote à chaque déploiement est un signal auquel on n'accorde
  pas de poids. Compte tenu de la fréquence des déploiements (4 runs le 2026-08-14), la
  home passe une part non négligeable de son temps dans l'état dégradé.
- **Risque de régression** : quasi nul (2 entrées dans deux listes de chaînes, étapes
  `best-effort`/non bloquantes). **Do-not-touch** : le `purge_everything` du job `deploy`
  (l.524) — la purge ciblée le complète, elle ne le remplace pas ; l'ordre des jobs
  `needs: deploy` ; la magic string `stub.invalid` et ses 6 consommateurs (ADR 0026).

### [P1] Titres SERP : double marque « · FAQ Axion-IA · Axion-IA » sur les fiches FAQ courtes, et titres de 84 à 98 caractères sur la famille la plus exposée

- **Symptôme** : sur les familles qui ranquent réellement, les 60 premiers caractères du
  titre — les seuls que Google affiche — sont gaspillés par un suffixe de marque dupliqué
  ou par une accumulation de segments. Les fiches FAQ **sont** dans le top 10
  (`/fr/faq/atelier-ia-equipe` pos 5,40 · 10 imp ; `/fr/faq/secteurs-ia` pos 3,75 · 8 imp ;
  `/fr/faq/par-thematique/general` pos 3,00) et **font 0 clic**.
- **Preuve live (19:24:07 et 19:25:00–19:25:41 UTC — HTML statique, hors dépendance DB)** :

  | URL | Titre servi | Long. | Marque |
  |---|---|---|---|
  | `/fr/faq/atelier-ia-equipe` | `Qu'est-ce qu'un atelier IA pour une équipe ? · FAQ Axion-IA · Axion-IA` | **80** | ×2 |
  | `/fr/faq/…intervient-il-a-distance…` | `Axion-IA intervient-il à distance ou sur site ? · FAQ Axion-IA · Axion-IA` | **73** | ×3 |
  | `/fr/faq/…premier-diagnostic-ia` | `Comment se passe un premier diagnostic IA ? · FAQ Axion-IA · Axion-IA` | 69 | ×2 |
  | `/fr/implantations/ile-de-france/le-kremlin-bicetre` (pos 4,72 · 29 imp · 0 clic) | `Le Kremlin-Bicêtre (94) · IA pour entreprises · santé libérale, formation & TPE/PME · Axion-IA` | **98** | ×1 |
  | `/fr/implantations/auvergne-rhone-alpes/grenoble` | `Grenoble (38) · IA pour entreprises · nano, hydrogène & sports nature · Axion-IA` | 84 | ×1 |
  | `/fr/blog/coaching-ia-dirigeant-grenoble` (pos **2,48** · 25 imp · **0 clic**) | `Coaching IA dirigeant Grenoble – Guide complet **2025** · Axion-IA` | 62 | ×1 |

  Échantillon FAQ : **4 titres sur 12** portent la marque ≥ 2 fois (sitemap FAQ = **97
  URLs**, ⇒ ordre de grandeur **~30 fiches** concernées — **[À CONFIRMER]** faute d'accès
  DB pour compter les questions ≤ 50 caractères).
- **Preuve code** :
  - `src/app/[locale]/faq/[slug]/page.tsx:95-96` :
    `const brand = "FAQ Axion-IA"` puis
    `const title = copy.question.length > 50 ? copy.question : \`${copy.question} · ${brand}\`` —
    le commentaire l.92-94 vise explicitement à « éviter la troncature SERP (~60 car.) »…
  - …mais `src/lib/seo.ts:271-279` ne neutralise le template racine que si le titre se
    termine **exactement** par `" · Axion-IA"` (`TITLE_SUFFIX`) ; `"… · FAQ Axion-IA"` ne
    matche pas → `src/app/[locale]/layout.tsx:143` (`template: "%s · Axion-IA"`) ré-appose
    la marque. Le garde-fou anti-troncature produit donc exactement la troncature qu'il
    voulait éviter, marque doublée en prime.
  - Famille implantations : le titre est composé de 4 segments (ville + code dept, promesse
    générique, spécialités locales, marque) — le différenciateur (les spécialités) tombe
    **après** le 60ᵉ caractère sur 100 % des pages testées.
- **Root-cause** : deux mécanismes de suffixage de marque (le template racine, les
  compositions locales) coexistent sans SSOT ; le bypass `{ absolute }` de `seo.ts` couvre
  un seul motif exact. C1 a documenté la même racine sur ~870 pages galerie/blog paginé —
  **la famille FAQ est un troisième foyer, non couvert par C1**.
- **Patch prescrit** :
  1. `faq/[slug]/page.tsx:96` : supprimer purement le suffixe local (`title = copy.question`)
     et laisser le template racine poser la marque une fois — le titre redevient
     « question · Axion-IA », c'est l'intention d'origine.
  2. Implantations : réduire le titre à 2 segments (`Ville (dept) · IA pour entreprises ·
     Axion-IA`) ou déplacer les spécialités en meta description (qui, elle, dispose de
     155 car. et est déjà bien remplie).
  3. Titre « Guide complet **2025** » sur une page en position 2,48 : millésime périmé
     visible en SERP. La production de contenu étant arrêtée (décision actée), c'est une
     **correction ponctuelle en base**, pas une régénération. Prévalence à mesurer
     (12 titres blog échantillonnés à 19:25 UTC : 0 autre cas ; feed RSS des 30 derniers :
     0 cas) — **[À CONFIRMER]** sur les 134 URLs du sitemap blog.
- **Effort** : S (1 + 3), M (2, ~1 816 pages via le gabarit).
- **Impact GEO/AEO** : **moyen** — améliore le CTR des positions déjà acquises, mais ne
  crée pas de demande là où il n'y en a pas (cf. P0 n°1) ; l'effet réel est plafonné par
  le volume des requêtes concernées. Honnêteté : ce patch ne « répare » pas les 0,70 % de
  CTR, il en supprime une cause parmi plusieurs.
- **Risque de régression** : faible ; **attention** au test qui verrouille les titres
  (`meta-length.ts` + specs associées) et au fait que `ensureArticleMetaTitle`
  (`seo.ts:276`) re-suffixe les titres d'ARTICLES courts — vérifier qu'on ne réintroduit
  pas le double suffixe par ce chemin. **Do-not-touch** : `layout.tsx:143` (le template
  racine est correct, c'est la source qui doit cesser de dupliquer), le bypass
  `{ absolute }` de `seo.ts:277`, les décisions de prix `{{price:…|flat}}` dans la prose.

### [P1] Google ne reconnaît pas la marque et corrige « axion-ia » en « action ia » — aucune requête de marque n'existe dans son autocomplete

- **Symptôme** : sur la surface Google la plus directement liée au Knowledge Panel (les
  requêtes de marque et leurs expansions), l'entité est inexistante et **activement
  redirigée** vers un homographe à très fort volume, « action IA » (cluster boursier
  français : « action ia française », « action ia à investir », « action ia anthropic »…).
- **Preuve live (Google Suggest API, 19:20:00 et 19:20:16 UTC)** :
  - `axion-ia` → `["axion-ia", "action ia", "axion iasi", "international axion observatory
    iaxo", "action gino iannucci", "iaxo axion", "axion 1 ianuarie"]` : la 2ᵉ suggestion
    est **la correction orthographique** ; les autres sont du bruit roumain et de la
    physique des particules. **Aucune** suggestion de marque (« axion-ia avis »,
    « axion-ia formation », « axion-ia grenoble »).
  - `axion-ia a` → 10 suggestions, **toutes** « action ia … » ; `axion-ia f` → idem
    (« action ia française »…). Autrement dit : dès qu'un utilisateur tape une lettre après
    la marque, Google **abandonne la marque**.
  - `axion ia grenoble` → `[]`.
- **Preuve live n°2 (Google News RSS, 19:20:38 UTC — index Google, sans JS)** :
  `"Axion-IA"` → **1 seul item tiers** : « Axion-IA — J'aime les startups ».
  `Axion-IA Grenoble` → 0 item sur l'entité ; la requête ramène l'axion (particule,
  CNRS/Echosciences) et « l'action Soitec ». La collision sémantique est double :
  **axion (physique)** et **action (bourse)**.
- **Preuve code** : `src/lib/brand.ts:26-28` (`legalName: "AXION IA SAS"`, `alternateName`)
  désambiguïse vis-à-vis d'`axionai.fr` mais ni de « action IA », ni de l'homonyme
  **Axion Formations (Saint-Quentin)** relevé par F4 (aucune occurrence dans `src/`) ;
  `src/lib/seo.ts:906-911` — `sameAs` limité (Wikidata env-gaté, LinkedIn, about.me,
  indiehackers), **sans Crunchbase ni f6s**, les deux profils qui captent aujourd'hui la
  requête brand (mesuré par F4 à 18:36:10 UTC).
- **Root-cause** : déficit d'existence vérifiable (diagnostic du 2026-07-20, **inchangé**)
  aggravé par une marque orthographiquement à 1 caractère d'un terme à très fort volume.
  Aucun Knowledge Panel n'arbitre — et je ne peux pas le vérifier directement (cf.
  Limites), mais l'absence totale d'expansion de marque dans l'autocomplete est le
  symptôme classique d'une entité non consolidée.
- **Patch prescrit** : rien de purement technique ne corrige un autocomplete.
  (1) Consolider l'entité : `sameAs` Crunchbase/f6s (patch F4 P0, 1 ligne dans
  `seo.ts:906-911`) + les 6 verrous de F5 ; (2) toujours écrire **« Axion-IA »** avec
  trait d'union dans tout contenu externe (profils, communiqués, annuaires) pour renforcer
  la forme distinctive ; (3) surveiller la requête brand en autocomplete comme indicateur
  de consolidation d'entité (1 appel curl, gratuit, à ajouter au rituel hebdo).
- **Effort** : S côté code, L côté existence externe (hors code, plusieurs semaines).
- **Impact GEO/AEO** : **fort** sur la requête brand (celle qui convertit), **moyen**
  ailleurs.
- **Risque de régression** : nul (aucun code applicatif). **Do-not-touch** :
  `brand.ts:26` (`legalName` sans trait d'union — décision Will du 30/07),
  le test `identite-legale-registre.spec.ts`, la doctrine robots (décision actée n°2).

### [P2] Fil d'Ariane absent du HTML brut sur la famille la plus exposée en SERP (implantations) — recoupement B4, sous l'angle SERP

- **Symptôme** : le `BreadcrumbList` — l'une des rares améliorations SERP encore
  disponibles pour un site commercial (le fil d'Ariane remplace l'URL sous le titre) — est
  absent du HTML servi sur la famille qui porte **481 impressions/semaine**.
- **Preuve live (19:29:19 UTC)** : `GET /fr/implantations/ile-de-france/le-kremlin-bicetre`
  → 3 blocs `ld+json` inline : `Place`, `ItemList`, graphe de layout —
  **aucun `BreadcrumbList`** (la chaîne n'apparaît que dans le payload RSC).
  Contre-épreuves : `/fr/carrieres/data-engineer` → `BreadcrumbList` **inline** (+
  `JobPosting` complet : `MonetaryAmount`, `QuantitativeValue` — Google for Jobs
  correctement câblé) ; `/fr/blog/coaching-ia-dirigeant-grenoble` → `BreadcrumbList`
  inline ; `/fr/faq/atelier-ia-equipe` → `BreadcrumbList` + `QAPage` inline.
- **Preuve code** : `src/components/marketing/JsonLd.tsx:39-47` (injection
  `afterInteractive`) appelé par `src/app/[locale]/implantations/[region]/[ville]/page.tsx:940`
  — analyse complète en B4.
- **Nuance à respecter (anti-faux-positif)** : Googlebot exécute JS, il **peut** donc voir
  ce balisage au second passage ; l'impact SERP est un **retard** et une fragilité (rendu
  différé, budget de rendu), pas une perte certaine. Les rich results **FAQ** ne sont, eux,
  plus affichés par Google pour les sites commerciaux depuis août 2023 : ne pas promettre
  de gain SERP sur ce volet — l'enjeu de B4 est l'AEO (crawlers IA sans JS), le mien est le
  seul fil d'Ariane.
- **Patch prescrit** : passer `BreadcrumbList` (et lui seul, si le graphe complet pèse
  trop) en `strategy="inline"` sur le gabarit implantations — sous-ensemble du patch B4.
- **Effort** : S. **Impact GEO/AEO** : faible-moyen. **Risque** : faible (quelques
  centaines d'octets inline) — surveiller la gate `lhci` (TBT ≤ 150 ms). **Do-not-touch** :
  `JsonLd.tsx` lui-même, budgets AGENTS.md.

### [P2] Cannibalisation multi-URL confirmée par la SERP : 11 villes sur 144 présentent ≥ 2 URLs classées la même semaine

- **Symptôme** : pour une même ville, Google classe simultanément plusieurs URLs Axion-IA
  de familles différentes, ce qui répartit impressions et autorité au lieu de les
  concentrer.
- **Preuve live (agrégats GSC W33, calculés 19:29 UTC)** : 11 villes concernées sur 144
  villes classées. Exemples : **Clermont-Ferrand** → `/fr/audit/par-ville/…` (pos 4),
  `/fr/implantations/auvergne-rhone-alpes/…` (pos 3), `/fr/implementation/par-ville/…`
  (pos 4) — 3 URLs, 4 impressions, 0 clic. **Lille** → implantations (pos 46),
  interventions/par-ville (pos 3), un-a-un/par-ville (pos 22). **Nîmes** →
  audit/par-ville (pos 24,2 · 10 imp) + un-a-un/par-ville (pos 21,3 · 18 imp), 0 clic.
- **Preuve code** : n/a côté défaut — les gabarits sont distincts et légitimes ; la
  duplication d'intention est structurelle (voir C5 pour l'analyse de duplication et D4
  pour la pSEO).
- **Patch prescrit** : ne PAS canonicaliser entre familles (risque de désindexation en
  masse) ; arbitrer par le maillage interne (une seule famille « tête » par intention et
  par ville, les autres pointant vers elle). Décision de fond à trancher avec D4/C5, pas
  isolément.
- **Effort** : M. **Impact** : faible-moyen (11/144 = 7,6 % des villes classées).
  **Risque** : moyen si canonicalisation — d'où l'interdiction ci-dessus.
  **Do-not-touch** : canonicals auto-référents, `sitemap/villes-*.xml`.

### [P2] `SearchAction` / sitelinks searchbox : balisage correct mais fonctionnalité retirée par Google — ne pas compter dessus

- **Constat** : le graphe home émet un `WebSite` + `potentialAction: SearchAction` pointant
  `https://axion-ia.com/fr/recherche?q={search_term_string}`, et l'endpoint répond **200**
  (vérifié 19:28:36 UTC). Le balisage est propre et l'endpoint réel — mais Google a
  **retiré la fonctionnalité « sitelinks searchbox »** de ses résultats (annonce de fin
  2024). Le balisage est donc **inerte côté SERP**, sans nuisance.
- **Preuve live** : 19:28:12 UTC, bloc `ld+json` n°6 de `/fr` (types :
  `Organization, WebSite, SearchAction, EntryPoint, SiteNavigationElement×7`).
- **Patch** : **aucun** — le conserver (il reste un signal d'entité valide, et le retirer
  coûterait plus qu'il ne rapporte). Ce point est consigné pour qu'aucun futur audit ne le
  compte comme un gain SERP à venir. **Effort** : n/a. **Impact** : nul. **Risque** : n/a.

### [P2] Aucun instrument interne ne mesure la SERP : positions gelées au 20/07, 15 URLs suivies, zéro suivi des fonctionnalités SERP

- **Symptôme** : le seul dispositif de suivi de position du système
  (`keyword_tracking`) est gelé depuis le **2026-07-20** et ne couvre que **15 URLs blog**
  (mesuré par D8 en base prod à 18:34 UTC) ; **rien** ne trace la présence en AI Overview,
  les PAA, le Knowledge Panel, ni les fonctionnalités SERP. Conséquence directe : cet audit
  a dû reconstruire les positions depuis les CSV hebdo, et n'a pas pu mesurer la SERP
  elle-même.
- **Preuve code** : `prisma/schema.prisma:3981-4032` (`KeywordTracking` prévoit pourtant
  `source: serpapi`, `competitorTopUrl`, `ourBestRank`, `trendDirection`) ;
  `src/server/queue/workers/content-keyword-sync-worker.ts:63-69` (sortie immédiate sous
  kill-switch — patch D8) ; grep `serpapi` dans le dépôt : **aucune implémentation**,
  aucune clé dans `.env*` (vérifié 19:16 UTC).
- **Patch prescrit** : ne PAS acheter de SERP API pour l'instant. Deux mesures gratuites
  suffisent à instrumenter le manque : (1) appliquer le patch D8 (exempter le sync GSC du
  kill-switch) ; (2) ajouter au rituel hebdo un relevé Google Suggest sur 10 requêtes cœur
  (curl, gratuit, sans clé) — c'est l'indicateur de demande qui manque en amont de la
  génération (cf. P0 n°1).
- **Effort** : S. **Impact** : moyen (pilotage). **Risque** : nul.
  **Do-not-touch** : le kill-switch pour tout ce qui appelle un LLM ; la clé IndexNow
  (décision actée n°11).

## Mesures brutes

### 1. Accès aux SERP — ce qui répond et ce qui bloque (2026-08-14, 19:09 → 19:31 UTC)

| Surface | Heure UTC | Résultat |
|---|---|---|
| `google.com/search` (UA Chrome) | 19:09:03 | **200 / 92 036 o mais shell JS** — `<title>Google Search</title>`, 1 seule occurrence « Axion » dans tout le document, 0 lien `/url?q=` → inexploitable |
| `google.com/search` (UA Lynx / MSIE) | 19:1x | **302 → `consent.google.com/ml`** |
| `google.com/search` + cookies `SOCS`/`CONSENT` (UA texte) | 19:1x | 200 / 2 450 o — page « **Mettez à jour votre navigateur** » |
| `google.com/search` + cookies + UA Chrome complet (`sec-ch-ua`, `Accept`, …) | 19:1x | 200 / 92 045 o — **même shell JS** |
| `suggestqueries.google.com/complete/search` | 19:20:00 → 19:27:37 | ✅ **200, données Google réelles** (13 requêtes) |
| `news.google.com/rss/search` | 19:20:38 → 19:21:04 | ✅ **200, index Google réel** |
| `search.brave.com` | 19:21:51 → 19:22:33 | ✅ 8 requêtes exploitables, puis **anti-bot** dès 19:22:38 |
| `mojeek.com` | 19:21:51 → 19:22:47 | Index propre, exploitable sur la requête brand uniquement |
| `html.duckduckgo.com` | 19:15 | **202** (challenge anti-bot) |
| `startpage.com` (proxy Google) | 19:18:02 | 200 mais **challenge PoW** (`difficulty 4`) — inexploitable |
| `ecosia.org` (index Bing) | 19:27:58 | **403** |
| `lite.qwant.com` | 19:27:58 | **302 / 0 o** |
| Clés SERP dans le dépôt (`SERPAPI`, `GOOGLE_CSE`, `VALUESERP`, `DATAFORSEO`) | 19:16 | **aucune** dans `.env.local`, `.env.dev`, `.env*.example` |

### 2. Les 12 requêtes cœur — présence mesurée (aucune position Google réelle disponible)

| # | Requête | Google Suggest (19:20/19:27 UTC) | Brave (19:21-19:22 UTC) | Page Axion visée & sa position GSC W33 |
|---|---|---|---|---|
| 1 | `"Axion-IA"` (brand) | marque seule + **correction « action ia »** | **#1** `axion-ia.com` | `/fr` pos 6,25 |
| 2 | `Axion IA avis` | — | **#1** `axion-ia.com` (#2 Trustpilot) | `/fr/avis` pos 11,0 · 1 imp · 1 clic |
| 3 | `formation IA entreprise Grenoble` | **`[]`** | absent (grenoble-inp, mister-ia, mookay, formateur-ia-grenoble, cciformation) | `/fr/formations` pos 42,4 |
| 4 | `audit IA PME France` | — | absent (drakkar, bradroit, lumivi, jayd.ai, moon-ia, tensoria) | `/fr/audit` **pos 17 · 1 imp** |
| 5 | `organisme formation IA Qualiopi` | **`[]`** | absent (senza, savoiria, conversion-boosters, formationiaqualiopi.fr, proxiformation) | aucune page dédiée (ban « Qualiopi » — cf. D8) |
| 6 | `organisme formation IA Qualiopi Grenoble PME` | — | absent (arkavia, mookay, almera, iavenir, mister-ia, m2i) | — |
| 7 | `audit IA entreprise PME France` | — | absent (mêmes acteurs que #4) | `/fr/audit` |
| 8 | `qu'est-ce qu'un audit IA` | `[]` sur la variante `pourquoi faire un audit ia` | absent (drakkar, wiz.io, the-intelligence-academy, step-agency, iavenir) | `/fr/centre-aide/perimetre-audit-ia` pos 6,67 · 3 imp |
| 9 | `combien coûte une formation IA en entreprise` | verbatim seul | absent (studeria, nocodetoulouse, the-intelligence-academy, flowt, plateya) | `/fr/formations/tarifs` pos 10,0 · 1 imp |
| 10 | `formation intelligence artificielle salariés entreprise` | `formation ia entreprise` → 10 suggestions, **aucune « grenoble »** | rate-limit | `/fr/formations` pos 42,4 |
| 11 | `site web augmenté IA` | — | rate-limit | `/fr/sites-web-augmentes` pos 58,7 |
| 12 | `consultant IA Grenoble` | **`[]`** | rate-limit | `/fr/implantations/…/grenoble` (non classée W33) |

Requête AEO complémentaire (WebSearch, 19:30:5x UTC) — « qu'est-ce qu'un audit IA en
entreprise définition » : **10/10 concurrents, 0 Axion-IA** (step-agency, iavenir,
vent-en-poupe, justai, agence.media, hyperstack.studio, coekipia, itefficience, zenextia,
laucked).

### 3. Positions Google réelles — buckets W33 (source : export API GSC, calcul 19:23 UTC)

| Bucket position | Pages | Impressions | Clics | CTR |
|---|---:|---:|---:|---:|
| 1 – 3 | 26 | 60 | 2 | 3,33 % |
| 3,01 – 5 | 31 | 127 | **0** | 0,00 % |
| 5,01 – 10 | 62 | 301 | 7 | 2,33 % |
| 10,01 – 20 | 48 | 262 | 1 | 0,38 % |
| 20,01 – 50 | 70 | 544 | 2 | 0,37 % |
| > 50 | 31 | 221 | 1 | 0,45 % |
| **Total** | **268** | **1 515** | **13** | 0,86 % |
| *dont top 10 hors home* | *118* | *428* | *3* | ***0,70 %*** |

Évolution du top 10 : W31 = 77 pages / 302 imp / 14 clics (4,64 %) → W32 = 132 pages /
548 imp / 8 clics (1,46 %) → W33 = 119 pages / 488 imp / 9 clics (1,84 %). **Le nombre de
positions acquises augmente ; leur rendement s'effondre.** Delta vs référence 2026-07-20
(« absent du top 10 partout ») : la présence en top 10 est **acquise** ; sa valeur
commerciale est **nulle**.

### 4. Présentation SERP des pages classées (mesures 19:24:07 et 19:29:19 UTC)

| Page (pos W33) | Titre (long.) | Desc. (long.) | JSON-LD inline notable |
|---|---|---|---|
| `/fr` (6,25 · 60 imp · 6 clics) | 50 | 161 | FAQPage, ProfessionalService, Organization+**AggregateRating** (après 19:28 seulement), WebSite/SearchAction |
| `/fr/implantations/…/le-kremlin-bicetre` (4,72 · 29 imp · 0 clic) | **98** | 163 | Place, ItemList — **pas de BreadcrumbList** |
| `/fr/blog/coaching-ia-dirigeant-grenoble` (2,48 · 25 imp · 0 clic) | 62 (**« 2025 »**) | 143 | BlogPosting, FAQPage, BreadcrumbList, Person |
| `/fr/faq/atelier-ia-equipe` (5,40 · 10 imp · 0 clic) | **80 (marque ×2)** | 158 | QAPage, BreadcrumbList |
| `/fr/galerie/…equipe-ia-service-humain…` (4,88 · 8 imp · 0 clic) | 63 (**marque ×2**) | 153 | — (cf. C1) |
| `/fr/carrieres/data-engineer` (24,0 · 24 imp · **2 clics**) | — | — | **JobPosting complet inline** (MonetaryAmount, QuantitativeValue) + BreadcrumbList + FAQPage |
| `/fr/audit` (17,0 · 1 imp) | 62 | 152 | ItemList en afterInteractive |
| `/fr/guides/guide-audit-ia-grenoble` (2,33 · 3 imp · 0 clic) | 71 | 114 | — |

### 5. Fenêtre post-déploiement sur la home (même URL, 3 mesures)

| Heure UTC | `cf-cache-status` | `Age` | `build-sha` | `aggregateRating` | Valeurs |
|---|---|---:|---|---|---|
| 19:27:07 | HIT | **3 540** | 99ba93a0… | **0** | — |
| 19:28:37 | HIT | 23 | 99ba93a0… | **1** | `ratingValue 4.9` · `reviewCount 77` |
| 19:28:43 | HIT | 30 | 99ba93a0… | 1 | idem |

Contrôle 19:27:07 UTC : `/fr/avis` (BYPASS) portait `4.9 / 77` pendant toute la fenêtre —
la donnée existait côté origin. ⇒ **Fenêtre dégradée mesurée : 18:28 → 19:28 UTC (60 min).**
Cohérent avec les 77 avis réels / 4,88 arrondi à 4,9 (état vérifié du projet).

### 6. Cannibalisation par ville (GSC W33, calcul 19:29 UTC)

144 villes classées, **11** avec ≥ 2 URLs simultanées : clermont-ferrand (3 URLs), lille
(3), mulhouse, nîmes, perpignan, annecy, le-creusot, olivet, + 3 autres. Aucun clic sur
aucune de ces URLs.

## Limites

1. **La SERP Google elle-même n'a pas pu être lue.** Quatre stratégies d'accès serveur
   testées (UA Chrome, UA texte, cookies de consentement `SOCS`/`CONSENT`, en-têtes
   Chrome complets) : Google renvoie soit un 302 vers `consent.google.com`, soit une page
   « mettez à jour votre navigateur », soit un shell JS de 92 ko sans résultats. Les
   proxys (Startpage → challenge PoW, DuckDuckGo → 202, Ecosia → 403, Qwant → 302) sont
   également fermés, et aucune clé SERP API n'existe dans le dépôt. Les outils navigateur
   sont réservés à la session principale (règle du digest). **Conséquence : position
   exacte sur les 10 bleus, rich snippets réellement affichés, PAA, présence et sources
   d'un AI Overview, Knowledge Panel et sitelinks sont NON MESURÉS.** Les questions
   « AI Overview : présence + qui est cité ? » et « Knowledge Panel toujours absent ? »
   restent donc **ouvertes** — je n'ai pu établir qu'un faisceau indirect pour la seconde
   (aucune expansion de marque dans l'autocomplete Google, 1 seule mention tierce dans
   Google News, `sameAs` pauvre) qui **suggère** une entité non consolidée sans le prouver.
2. **Les positions citées sont des moyennes pondérées par page, pas par requête.** Les
   exports GSC (`dimensions:["page"]`) n'ont pas la dimension `query` : je peux affirmer
   « cette page est en position 2,48 », pas « sur telle requête ». La seule source
   requête-niveau du système (`keyword_tracking`) est gelée au 2026-07-20 et limitée à
   15 URLs blog (constat D8, non re-mesuré ici : pas d'accès DB prod pour F3).
3. **Fenêtre temporelle** : les CSV W33 couvrent 03–10/08 ; les 4 derniers jours
   (11–14/08) ne sont couverts par aucune donnée GSC. Le second déploiement du jour
   (parti 18:54:44 UTC, encore `in_progress` à 19:31 UTC) rejouera la fenêtre de 60 min
   décrite au P1 ; je n'ai pas pu l'observer.
4. **Toutes mes mesures live tombent dans la fenêtre ≤ 1 h post-deploy** de l'atterrissage
   de 18:26 UTC. Je n'en ai tiré aucune conclusion de « contenu manquant » : le seul
   constat DB-dépendant (home sans `aggregateRating`) est présenté comme la **mesure du
   mécanisme** de cache post-déploiement, avec la contre-mesure à 19:28 UTC qui prouve que
   la donnée était bien là côté origin.
5. **Brave et Mojeek ne sont pas Google** : leurs classements servent uniquement à établir
   « qui capte l'intention » et « Axion-IA est-il présent, oui/non » ; aucune position
   n'en est déduite. Brave a rate-limité après 8 requêtes (19:22:38 UTC), les requêtes 10
   à 12 n'ont donc pas de mesure sur cet index. WebSearch est un backend **US** (biais
   déjà relevé par F4).
6. **Prévalence des titres non chiffrée** : 12 fiches FAQ échantillonnées sur 97, 12
   articles blog sur 134 — la volumétrie des doubles marques (~30 fiches) et des
   millésimes périmés est une estimation marquée **[À CONFIRMER]** (comptage exact = requête
   DB, hors périmètre F3).
7. **Non re-diagnostiqué volontairement** (déjà établi ailleurs, cité sans redondance) :
   l'arrêt de la production de contenu depuis le 2026-07-20 (décision actée), la chaîne de
   soumission GSC morte (F2), le blocage `Google-Extended`/Gemini (décision actée n°2),
   les 6 verrous d'entité (F5), le `afterInteractive` généralisé (B4), le double suffixe
   sur les 870 pages galerie (C1).

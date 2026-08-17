# G3 — ISR & caches (revalidate, /api/internal/revalidate, job warm, cache edge Cloudflare)

- **Date/heure** : 2026-08-14, mesures live entre **19:09 UTC** et **19:31 UTC**
  (audit-only strict : GET/HEAD uniquement, zéro écriture hors ce dossier).
- **Chronologie deploy retenue** : deploy atterri **18:26 UTC** (run précédent) ;
  nouveau run parti **18:54 UTC**, atterrissage estimé ~19:50–20:00 UTC. **Toutes
  mes mesures tombent donc dans la fenêtre post-deploy 18:26 → +1 h** : un contenu
  DB-driven vide y est *attendu* — ce que je qualifie ci-dessous, ce n'est pas le
  vide lui-même mais le **mécanisme qui le fige plus longtemps que la fenêtre ISR**.
- **Périmètre réellement couvert** : les 113 `export const revalidate` de
  `src/app/**`, la route `src/app/api/internal/revalidate/route.ts` et ses appelants
  (worker de publication, server actions admin, workflows), le job `warm`
  (`.github/workflows/deploy-coolify.yml:714-863`) et sa course avec les jobs
  `lhci`/`indexnow`, les en-têtes `Cache-Control` émis (code) vs servis (live) sur
  38 sous-sitemaps + 20 pages, l'âge réel servi (`Age`, `cf-cache-status`,
  `x-nextjs-cache`) et la persistance du cache ISR entre déploiements.
- **Hors périmètre** (traité ailleurs) : contenu/volumétrie des sitemaps (A2/A3/A4),
  JSON-LD (B4/G2), budgets Web Vitals (G1), images (E2/E3/G4), logs de crawl (F7).
- **Rapports recoupés avant mesure** : `A3-sitemaps-db-stub-isr.md`,
  `A3-ADDENDUM-preuve-live-postdeploy.md`, `F1-probe-http.md`, `00-CONTEXT-DIGEST.md`.

## Résumé exécutif

La couche ISR est correctement paramétrée **au niveau du code** (3 600 s sur les hubs
éditoriaux, 86 400 s sur le pSEO figé, 300–600 s sur les sitemaps) mais **trois
couches la neutralisent en prod**. (1) Le cache ISR est **éphémère** : aucun
`cacheHandler`, aucun volume monté sur `.next/cache` → chaque déploiement remet
toutes les entrées à leur version bâtie sous `stub.invalid`. (2) Le job `lhci` chauffe
`https://axion-ia.com/fr` **en parallèle** du job `warm` : il refige la home stub à
l'edge ~2 min après l'atterrissage, avant toute revalidation — j'ai re-observé la home
**sans `AggregateRating`** à 19:11 UTC (`Age 2574` ⇒ mise en cache 18:28, deploy
atterri 18:26), ce qui **confirme le P0 d'A3 et lui ajoute son mécanisme**.
(3) Cloudflare **réécrit `max-age` 300 → 3600 et ignore `s-maxage=600`** sur les XML :
le correctif d'indexation du 2026-05-18 (P1-13, « refresh CDN sous 10 min ») est
**inopérant** — sitemap-index servi à `Age 3197 s`. Deux conséquences structurelles
supplémentaires : les ~480 hubs villes (`revalidate = 86400` + lecture DB) ne
régénèrent **jamais** à la cadence de déploiement actuelle, et **aucune mutation de
contenu ne purge l'edge** (publication, dépublication, effacement RGPD).

## Findings

### [P0] Le job `lhci` refige la home stub à l'edge avant que quiconque ait revalidé (course `lhci` ⇄ `warm`)

- **Symptôme** : après chaque atterrissage, `https://axion-ia.com/fr` est resservie
  pendant ~1 h dans sa version bâtie sous stub (bloc avis vide, `AggregateRating`
  absent du JSON-LD), **et** la version vide est épinglée à l'edge Cloudflare pour
  `s-maxage=3600` — soit jusqu'à ~2 h cumulées d'exposition.
- **Preuve code** :
  - `.github/workflows/deploy-coolify.yml:747` (liste `PATHS` de revalidation) et
    `:778` (liste `FILES` de purge CF ciblée) : **`/fr` absente des deux**
    (recoupement du P0 d'A3, inchangé).
  - `.github/workflows/deploy-coolify.yml:554-556` — le job `lhci` déclare
    `needs: deploy` **exactement comme le job `warm`** (`:714-717`) : les deux
    démarrent en parallèle dès la fin du déploiement.
  - `.github/workflows/deploy-coolify.yml:600-605` — la première URL testée est
    `--url=https://axion-ia.com/fr`, et `:619` lance explicitement une passe
    « warm-up » jetable dont le commentaire (`:609-618`) assume le rôle : « on fait
    donc UNE passe navigateur jetable qui amorce conteneur + CF ». Cette passe
    **remplit le cache edge avec ce que l'origine a de disponible à T+2 min** —
    c'est-à-dire le prerender stub.
  - `.github/workflows/deploy-coolify.yml:510-530` — le `purge_everything` est un
    step du job `deploy`, donc **antérieur** : l'edge est vide au moment où `lhci`
    tape, la première réponse fait autorité pour 1 h.
  - `src/app/[locale]/page.tsx:70` (`revalidate = 3600`), `:120-125`
    (`getPublishedReviews` + `getAggregateRating`, gaté ≥ 5 avis),
    `:56-62` (constat prod du 2026-08-10 déjà gravé en commentaire).
- **Preuve live** (2026-08-14 **19:11:01 UTC**, soit T+45 min après l'atterrissage
  18:26) : `GET /fr` → `200`, `cf-cache-status: HIT`, **`Age: 2574`** (⇒ objet mis en
  cache à **18:28:07 UTC**, 2 min après l'atterrissage), `x-nextjs-cache: HIT` +
  `x-nextjs-prerender: 1` (⇒ c'est bien l'artefact de build qui est servi),
  `grep -c aggregateRating` = **0**, `"reviewCount"` **absent**. Re-mesures :
  19:19:18 UTC `Age 3074` HIT ; **19:23:09 UTC `Age 3302`, HIT, toujours
  `aggregateRating` = 0** — soit **57 minutes consécutives** de home sans note
  agrégée, mesurées de bout en bout.
- **Root-cause** : deux causes composées. (a) `/fr` n'est dans aucune des deux listes
  du job `warm` (cause A3). (b) **Même si elle y était**, `lhci` et `warm` sont deux
  jobs concurrents sans ordre : rien ne garantit que la revalidation (`warm`, step 1)
  précède la chauffe navigateur (`lhci`, warm-up). Le patch d'A3 seul laisse la course
  ouverte ~50 % du temps.
- **Patch prescrit** (deux volets, à appliquer ensemble) :
  1. Ajouter `"/fr"` à `PATHS` (`deploy-coolify.yml:747`) et
     `"https://axion-ia.com/fr"` à `FILES` (`:778`) — patch A3, inchangé.
  2. **Déplacer les deux steps « Revalidate DB-dependent index pages » (`:729-766`)
     et « Purge CF des pages revalidées » (`:768-799`) à la fin du job `deploy`**,
     juste après le `purge_everything` (`:510-530`). Ils durent quelques secondes
     (2 appels HTTP) donc n'allongent pas significativement la section critique
     sérialisée, et ils s'exécutent alors **avant** le démarrage de `lhci`,
     `indexnow` et du sweep de chauffe. Le job `warm` conserve la chauffe lourde.
     Alternative moins bonne : `lhci: needs: [deploy, warm]` — repousse le gate de
     10–20 min à chaque déploiement.
- **Effort** : S (≈ 20 lignes de YAML déplacées).
- **Impact GEO/AEO** : **fort** — la home est la page qui porte `AggregateRating`
  (77 avis, 4,88/5) ; c'est aussi la page la plus crawlée. Un Googlebot qui passe
  dans la fenêtre voit une home sans preuve sociale structurée, et la version vide
  peut être la seule vue plusieurs fois par jour les jours à déploiements multiples.
- **Risque de régression** : faible. Le seul risque réel est d'allonger le job
  `deploy` de ~5 s et de faire remonter un échec de revalidation dans un job
  jusqu'ici « best-effort » : **conserver impérativement les `|| echo`,
  `::warning::` et l'absence de `set -e` sur ces deux steps** pour qu'ils restent
  non bloquants une fois déplacés.
- **Do-not-touch** : le `purge_everything` (`:510-530`) et son `exit 1` ; l'ordre
  revalidate → purge ciblée → chauffe ; la magic string `stub.invalid` et ses 6
  points de propagation ; le gating `if: needs.deploy.result == 'success'`.

### [P1] Les ~480 hubs villes (`revalidate = 86400` + lecture DB) ne régénèrent JAMAIS : le bloc « contenus IA à {ville} » est structurellement absent

- **Symptôme** : la section de maillage hub-ville → articles blog ancrés sur la ville
  n'apparaît sur aucune page ville en prod, alors que le corpus contient des articles
  tier-1 ancrés (ex. ≥ 4 articles « grenoble » dans `sitemap-blog.xml`).
- **Preuve code** :
  - `src/app/[locale]/implantations/[region]/[ville]/page.tsx:99` → `revalidate = 86400` ;
    `:326` → `const villeArticles = await getBlogArticlesByVille(ville.slug, loc, 3);` ;
    `:320-325` → « section rendue UNIQUEMENT s'il y a des articles » et
    « fail-open : helper en try/catch → `[]` au build `stub.invalid` ».
  - `src/server/content-gen/blog/get-articles-by-ville.ts:47-58` — filtre
    `status: "published"`, `indexationTier: "tier_1_indexable"`, `isNews: false`,
    `mentionedCities: { has: villeSlug }` ; `:78-82` catch → `[]`.
  - `src/app/sitemap.ts:771-773` — le builder `blog` applique **exactement le même
    triplet de filtres** : tout ce qui est listé dans `sitemap-blog.xml` est donc
    tier-1 publié non-news, et donc éligible au bloc ville si `mentionedCities` le porte.
  - **Aucune persistance du cache ISR** : `grep cacheHandler next.config.ts` → 0
    occurrence ; aucun volume monté sur `/app/.next/cache` (`Dockerfile`,
    `docker-compose*.yml` → 0 occurrence de `volume`). Chaque conteneur redéployé
    repart donc des entrées prerender **datées du build** (sous stub).
- **Preuve live** (2026-08-14 **19:13:30–19:13:49 UTC**) :
  `/fr/implantations/auvergne-rhone-alpes/grenoble` → `x-nextjs-cache: HIT`,
  `x-nextjs-prerender: 1`, `Age 825`, et **0 lien `href="/fr/blog/<slug>"`** dans le
  HTML (seul `href="/fr/blog/categorie"`, lien de pied de page). Idem
  `/fr/implantations/auvergne-rhone-alpes/lyon` et `/fr/implantations/ile-de-france/paris`.
  Or `sitemap-blog.xml` (134 URLs, mesuré 19:14:11 UTC) contient
  `coach-ia-grenoble-guide-pratique`, `chatbot-ia-grenoble-entreprise-guide`,
  `comparatif-integrateurs-ia-grenoble-entreprise`, `coaching-ia-dirigeant-grenoble`.
- **Root-cause** : l'horloge ISR de 86 400 s est **remise à zéro à chaque
  déploiement** (cache éphémère). Avec la cadence observée (3 déploiements le
  2026-08-14), aucune entrée ville n'atteint jamais 24 h → la page servie est
  *toujours* le prerender stub, dans lequel `villeArticles` vaut `[]` par
  construction. Le job `warm` ne corrige rien : il fait un **GET**, or un GET sur une
  entrée ISR encore « fraîche » ne déclenche aucune régénération — seul
  `revalidatePath` le ferait, et aucune page ville n'est dans la liste `:747`.
- **[À CONFIRMER]** sur un seul point : je n'ai pas l'autorisation DB (agents A3/B6/D1/D5/D8/F7
  seulement) pour vérifier que `Article.mentionedCities` contient bien `"grenoble"`
  pour ces 4 articles. Si le champ était vide pour tout le corpus, le bloc serait
  vide *aussi* en régénération réelle — le mécanisme d'ISR gelée resterait vrai, seule
  l'ampleur changerait. Requête suggérée (agent habilité) :
  `SELECT count(*) FROM articles WHERE 'grenoble' = ANY(mentioned_cities) AND status='published' AND indexation_tier='tier_1_indexable' AND is_news=false;`
- **Patch prescrit** : ne PAS baisser `revalidate` à 3600 (multiplierait par 24 les
  rendus origine sur 480 pages pour un contenu quasi figé). Deux options, la (a) étant
  la moins risquée :
  (a) **Étendre la liste `PATHS` du warm aux hubs villes « chauds »** — les villes qui
  portent effectivement des articles ancrés. Concrètement : un petit step qui lit
  `sitemap-blog.xml`, extrait les slugs villes connus depuis `src/content/villes`,
  et POSTe les chemins `/fr/implantations/<region>/<ville>` correspondants à
  `/api/internal/revalidate` (borner à ~30 chemins/appel).
  (b) Ajouter un `cacheHandler` persistant (Redis) dans `next.config.ts` pour que
  les entrées régénérées survivent au redéploiement — corrige la classe entière de
  problèmes (home, villes, hubs) mais touche le cœur du rendu : **L**, ADR requis.
- **Effort** : (a) M · (b) L.
- **Impact GEO/AEO** : **fort** — c'est le maillage interne hub géographique →
  contenu, exactement ce que C4 mesure comme faible, et le seul signal de *fraîcheur*
  des 480 hubs villes (contenus figés depuis le build sinon).
- **Risque de régression** : (a) ajoute jusqu'à ~30 rendus origine post-deploy (le
  sweep en fait déjà 1 651) — négligeable ; ne PAS dépasser le rate-limit de 60
  requêtes/min/IP de la route (`src/app/api/internal/revalidate/route.ts:53`), donc
  **un seul POST portant N chemins**, pas N POST. (b) risque élevé : un cacheHandler
  mal branché casse le SSG au build sous `stub.invalid`.
- **Do-not-touch** : `getBlogArticlesByVille` et son `catch → []` (c'est lui qui
  empêche le build de casser sous stub) ; `revalidate = 86400` des pages villes ;
  le contrat `stub.invalid`.

### [P1] Cloudflare réécrit `max-age` (300 → 3600) et ignore `s-maxage=600` sur tous les XML : le correctif d'indexation P1-13 est inopérant en prod

- **Symptôme** : les sitemaps sont servis par l'edge jusqu'à ~1 h après leur
  génération, alors que le code demande explicitement un rafraîchissement CDN en
  10 min. La découverte d'une nouvelle URL par Google/Bing prend donc jusqu'à 1 h de
  plus que prévu, et la purge d'un sitemap n'a aucun effet sans purge CF explicite.
- **Preuve code** (trois chemins d'émission distincts, tous réécrits de la même façon) :
  - `src/app/sitemap-index.xml/route.ts:348-354` → `"public, max-age=300, s-maxage=600, stale-while-revalidate=3600"`
    (avec le commentaire d'audit 2026-05-18 P1-13 : « CDN refresh sous 10 min »).
  - `src/app/sitemap-news.xml/route.ts:198` → `"public, max-age=300, stale-while-revalidate=600, stale-if-error=604800"`.
  - `next.config.ts:703-720` → `/sitemap.xml` et `/sitemap/:path*` :
    `"public, max-age=300, s-maxage=600, stale-while-revalidate=3600"`.
- **Preuve live** (2026-08-14, horodatage par ligne) :
  - 19:12:12 UTC, requête **cache-bustée** `GET /sitemap-index.xml?cb=g3audit1` →
    `cf-cache-status: MISS` et pourtant
    `Cache-Control: public, max-age=3600, s-maxage=600, stale-while-revalidate=3600`
    → le `max-age=300` du code est **réécrit à 3600** même sur une réponse qui vient
    d'être générée par l'origine.
  - 19:17:38 UTC, `GET /sitemap-news.xml` → `max-age=3600, stale-while-revalidate=600,
    stale-if-error=604800` : **seul `max-age` a changé** (300 → 3600), les deux autres
    directives sont intactes → signature d'un « Browser Cache TTL = 1 hour » côté
    Cloudflare, pas d'un bug applicatif.
  - 19:11:07 → 19:23:09 UTC, `GET /sitemap-index.xml` → `cf-cache-status: HIT` avec
    `Age` **2702 → 3197 → 3429 s** alors que `s-maxage=600` : l'edge dépasse d'un facteur 5
    la fraîcheur demandée. Même comportement sur les 13 `/sitemap/*.xml`
    (`Age 1684-1690` à 19:16:37 UTC) et sur les 10 sous-sitemaps custom
    (`Age 1340-2702` à 19:11:07 UTC).
- **Root-cause** : une Cache Rule Cloudflare couvrant les chemins `*.xml` impose son
  propre Edge TTL (≈ 1 h) et son propre Browser TTL (1 h), au lieu de « Respect origin
  / Respect existing headers ». Le code applicatif n'a aucun moyen de la contourner.
  **[À CONFIRMER]** sur l'acteur exact : je n'ai pas ouvert la console Cloudflare (hors
  périmètre audit-only) et je n'ai pas d'accès origine hors CF pour isoler un éventuel
  Caddy. L'**effet** (s-maxage ignoré, max-age réécrit) est lui prouvé live sur 3
  chemins de code indépendants.
- **Patch prescrit** : action console Cloudflare (**reste Will**) — Rules → Cache
  Rules : pour l'expression `http.request.uri.path contains ".xml"`, régler
  **Edge TTL = « Use cache-control header if present »** et **Browser TTL = « Respect
  origin »**. Ajouter ensuite au dépôt un garde-fou de non-régression : une assertion
  curl dans `scripts/` (style `audit-*.ts` existants) qui échoue si
  `/sitemap-index.xml` renvoie un `max-age` ≠ celui du code ou un `Age` > 600.
- **Effort** : S (console) + S (garde-fou).
- **Impact GEO/AEO** : **moyen** — 50 min de latence de découverte supplémentaire par
  publication. Aujourd'hui atténué par l'arrêt de la production de contenu depuis le
  2026-07-20 (fait acté) ; **redevient significatif dès la reprise**, et c'est
  précisément le scénario du lancement.
- **Risque de régression** : faible côté SEO ; côté charge, l'origine reprendra les
  hits sitemap toutes les 10 min au lieu de toutes les heures — négligeable (les
  routes sont ISR/mémoire, TTFB mesuré 78 ms).
- **Do-not-touch** : ne PAS « corriger » le code en remontant `max-age` à 3600 pour
  coller au live — ce serait entériner la réécriture et perdre l'intention P1-13.

### [P1] Aucune mutation de contenu ne purge l'edge : `revalidatePath` n'invalide que l'origine, et Cloudflare fige même les réponses `x-nextjs-cache: STALE`

- **Symptôme** : après publication, correction, dépublication ou effacement d'un
  contenu, l'ancienne version reste servie par Cloudflare jusqu'à 1 h (`s-maxage=3600`)
  — y compris pour un article dépublié, qui continue de répondre `200` à l'edge.
- **Preuve code** :
  - `src/app/api/internal/revalidate/route.ts:69-95` — la route n'appelle que
    `revalidatePath` / `revalidateTag` : **aucun appel à l'API purge de Cloudflare**.
  - `src/server/content-gen/shared/revalidate-content.ts:35-52` — le helper des
    workers POSTe uniquement sur cette route.
  - `src/server/queue/workers/content-publish-worker.ts:1155-1165` — le worker de
    publication revalide `/fr/blog/<slug>`, `/fr/blog`, `/sitemap.xml`,
    `/sitemap-index.xml` + la cascade villes ; **rien ne purge l'edge derrière**.
  - `src/app/api/admin/articles/[id]/forget/route.ts:123-126` — l'effacement d'un
    article (droit à l'oubli) fait `revalidatePath('/fr/blog/<slug>')` et
    `revalidatePath('/fr/blog')` **et s'arrête là**.
  - Les server actions admin (`src/features/admin-blog/actions.ts:342-346`,
    `admin-faq/actions.ts:211-214`, `admin-case-studies/actions.ts:296-298`, …)
    appellent `revalidatePath` en process : même angle mort.
  - Contre-exemple qui prouve que le pattern est connu et maîtrisé :
    `src/server/queue/workers/observatoire-snapshot-worker.ts:29-46`
    (`purgeObservatoireCache`) est le **seul** endroit du code applicatif qui appelle
    `https://api.cloudflare.com/.../purge_cache`.
- **Preuve live** (2026-08-14) : à 19:11:38 UTC, `/fr/blog` → `cf-cache-status: HIT` +
  `x-nextjs-cache: **STALE**` (`Age 123`) ; à 19:17:09 UTC, `/fr/audit` → `HIT` +
  `STALE` (`Age 1055`). Autrement dit **Cloudflare met en cache pour 1 h une réponse
  que l'origine a elle-même déclarée périmée** : la version fraîchement régénérée à
  l'origine n'atteindra les crawlers qu'après expiration edge. Le délai total
  contenu-modifié → contenu-servi atteint donc `revalidate` + 3 600 s.
- **Root-cause** : architecture ISR + CDN sans invalidation chaînée. Le seul endroit
  où la chaîne est complète est le job `warm` (`deploy-coolify.yml:768-799`), et
  seulement pour 5 URLs figées en dur.
- **Patch prescrit** : un helper partagé `revalidateAndPurge(paths)` dans
  `src/server/cache/` qui (1) appelle `revalidatePath`, (2) mappe les chemins en URLs
  absolues et POSTe `{"files":[…]}` sur l'API CF (max 30 URLs/appel, plan Free —
  cf. `docs/runbooks/R20-cf-cache-stale.md:52`), gaté sur
  `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID` (no-op propre si absents, comme
  `revalidate-content.ts`). Puis : brancher `/api/internal/revalidate` dessus (couvre
  d'un coup le worker de publication + le job `warm`), et brancher la route `forget`
  ainsi que les actions admin blog/FAQ/cas-concrets.
- **Effort** : M (1 helper + 4 points de branchement + tests).
- **Impact GEO/AEO** : **moyen à fort** — fraîcheur perçue par les crawlers, et
  surtout conformité : un contenu effacé ne doit pas rester servi 1 h.
- **Risque de régression** : la purge CF Free est plafonnée à **1 000 URLs/jour**
  (`R20-cf-cache-stale.md:52`) — à la reprise de la production de contenu, une cascade
  villes (5 chemins × N villes) peut consommer le quota : **borner à 30 URLs par
  publication** et journaliser le compteur. Le helper doit rester best-effort
  (jamais throw) pour ne pas faire échouer une publication.
- **Do-not-touch** : le `purge_everything` du job `deploy` ; le caractère
  fail-soft de `revalidateContent` ; l'auth `X-Revalidate-Secret` + rate-limit de la
  route (`revalidate/route.ts:37-60`).

### [P2] `export const revalidate` mort sur 5 pages publiques rendues dynamiques — jamais mises en cache à l'edge

- **Symptôme** : cinq pages publiques déclarent un `revalidate` qui n'a aucun effet :
  elles sont rendues à chaque requête et sortent en `private, no-cache, no-store`,
  donc `cf-cache-status: BYPASS`. Chaque hit de crawler = un rendu origine complet
  (avec requêtes DB).
- **Preuve code** : `src/app/[locale]/galerie/page.tsx:227` (`revalidate = 60`) +
  `:45-51` (`searchParams: Promise<Filters>` puis `await searchParams`) ;
  `src/app/[locale]/avis/page.tsx:66` + `:63` ;
  `src/app/[locale]/carrieres/page.tsx:41` + `:76,83` ;
  `src/app/[locale]/presse/page.tsx:75` + `:56,88` ;
  `src/app/[locale]/appel/page.tsx:30` (`revalidate = 900`).
- **Preuve live** (2026-08-14 19:11:38 et 19:17:09 UTC) : `/fr/galerie`, `/fr/avis`,
  `/fr/appel` → `Cache-Control: private, no-cache, no-store, max-age=0,
  must-revalidate`, `cf-cache-status: BYPASS`. TTFB mesuré 19:15:13 UTC :
  `/fr/avis` 0,268–0,336 s · `/fr/galerie` 0,190–0,301 s · `/fr/carrieres`
  0,227–0,414 s · `/fr/presse` 0,202–0,259 s, **contre** 0,082–0,098 s (`/fr/tarifs`,
  HIT) et 0,118–0,168 s (hub ville, HIT) — facteur 2 à 4.
- **Root-cause** : l'usage de `await searchParams` (filtres serveur, 0 JS) bascule le
  segment en rendu dynamique ; le `revalidate` exporté devient décoratif.
- **Patch prescrit** : (1) retirer/commenter les `revalidate` morts pour ne pas
  tromper le prochain lecteur ; (2) si l'on veut réellement cacher ces hubs, déplacer
  les filtres vers des segments de route (`/fr/avis/secteur/[secteur]` existe déjà et
  est bien ISR) et garder la page racine sans `searchParams`. **Ne PAS** les ajouter
  aux listes du job `warm` (A3 l'a explicitement écarté : chauffer une page `no-store`
  ne sert à rien).
- **Effort** : S pour (1), L pour (2).
- **Impact GEO/AEO** : **faible** (TTFB reste sous 500 ms) ; devient moyen si un pic
  de crawl tombe sur ces 4 pages indexables déclarées dans `sitemap-avis.xml` (103
  URLs), `sitemap-carrieres.xml` (55), `sitemap-presse.xml` (1).
- **Risque de régression** : (2) casse les URLs de filtres existantes → redirections
  à prévoir (surface C3/C5). **Do-not-touch** : les pages facettes déjà ISR
  (`avis/secteur|ville|service`).

### [P2] `expireTime` non configuré : les pages ISR annoncent `stale-while-revalidate = 31 532 400` (1 an)

- **Preuve code** : `grep expireTime next.config.ts` → 0 occurrence (valeur par défaut
  Next 16 = 1 an).
- **Preuve live** (19:09:40 → 19:17:09 UTC) : toutes les pages ISR renvoient
  `Cache-Control: s-maxage=3600, stale-while-revalidate=31532400` (ou
  `s-maxage=86400, stale-while-revalidate=31449600`).
- **Root-cause** : défaut du framework. Sans effet observable aujourd'hui —
  Cloudflare Free n'honore pas `stale-while-revalidate` (aucun `cf-cache-status:
  EXPIRED`/`STALE` observé sur 30 requêtes) — mais tout intermédiaire qui l'honorerait
  (changement de plan CF, proxy tiers, cache navigateur agressif) pourrait servir du
  HTML vieux d'un an.
- **Patch prescrit** : `expireTime: 86400` dans `next.config.ts` (bloc racine).
- **Effort** : S · **Impact** : faible (préventif) · **Risque** : très faible ;
  vérifier après coup que le header descend bien à `stale-while-revalidate=82800`.

### [P2] Deux des quatre chemins revalidés par le worker de publication sont sans effet

- **Preuve code** : `content-publish-worker.ts:1161-1162` revalide `/sitemap.xml` et
  `/sitemap-index.xml`. Or `/sitemap.xml` est une **redirection** et
  `/sitemap-index.xml` est `force-dynamic` (`sitemap-index.xml/route.ts:124-125`,
  déjà relevé en P2 par A3) : `revalidatePath` n'a rien à invalider dans les deux cas.
- **Preuve live** (19:09:40 UTC) : `GET /sitemap.xml` → **308 Permanent Redirect**,
  `cf-cache-status: BYPASS`.
- **Root-cause** : héritage de l'audit 2026-05-18 (P0-8), écrit avant que
  `sitemap-index` ne passe en `force-dynamic` et que `/sitemap.xml` ne devienne une
  redirection.
- **Patch prescrit** : remplacer ces deux entrées par une **purge CF** des deux URLs
  (via le helper du P1 ci-dessus) — c'est la seule invalidation qui ait un effet réel
  sur la chaîne sitemap. **Effort** S · **Impact** faible seul, moyen combiné au P1.
- **Do-not-touch** : garder `/sitemap-news.xml` dans la liste conditionnelle `isNews`
  (même remarque, mais la fenêtre Google News justifie la ceinture-bretelles).

### [P2] Les fichiers d'ingestion IA ne sont jamais mis en cache à l'edge

- **Preuve live** (19:12:12 UTC) : `/llms.txt`, `/llms-full.txt`, `/ai.txt`,
  `/.well-known/ai-policy.json` → tous `200` mais **`cf-cache-status: DYNAMIC`**
  (Cloudflare ne les considère pas éligibles), alors que leurs `Cache-Control` sont
  corrects (`public, max-age=3600…` / `max-age=86400, immutable`). Contre-exemple :
  `/robots.txt` est bien servi `cf-cache-status: HIT` (`Age 2204`, 19:09:40 UTC).
- **Preuve code** : `src/app/llms.txt/route.ts:173` — en-tête public conforme,
  l'application fait donc sa part.
- **Root-cause** : périmètre de la Cache Rule Cloudflare (même intervention console
  que le P1 « max-age réécrit »).
- **Patch prescrit** : étendre la Cache Rule aux chemins `/llms.txt`, `/llms-full.txt`,
  `/ai.txt`, `/.well-known/*` avec « Respect origin ». **Reste Will** (console CF).
- **Effort** : S · **Impact GEO/AEO** : faible (volume de lectures bot modeste, cf.
  F7) mais gratuit · **Risque** : nul.

### [P2] Le sweep de chauffe ne couvre que ce que le sitemap déclare — les pages ville par service restent froides

- **Preuve code** : `deploy-coolify.yml:827-863` — le sweep énumère
  `/sitemap-index.xml` → sous-sitemaps → `<loc>`, cap 4 000, concurrence 6. Son
  commentaire (`:697-699`, `:855-857`) annonce « ~1816 villes » / « ≈ 2000 URLs ».
- **Preuve live** (19:18:24 UTC, énumération complète des 32 sous-sitemaps
  non-image) : **1 651 URLs** au total, dont **480** hubs villes. Le cap de 4 000 ne
  mord donc jamais (bonne nouvelle) mais le commentaire est périmé d'un facteur 4.
  À 19:19:18 UTC, `/fr/audit/par-ville/grenoble`,
  `/fr/formations/par-ville/grenoble`, `/fr/un-a-un/par-ville/grenoble` →
  `cf-cache-status: **MISS**` (froides ~53 min après l'atterrissage) : ces gabarits
  « par service × ville » ne figurent dans aucun sous-sitemap, donc le sweep ne les
  voit pas.
- **Root-cause** : la couverture du warm est indexée sur le sitemap ; ce que le
  sitemap n'annonce pas n'est jamais chauffé. La cause amont (absence de ces pages
  du sitemap) relève de A2/D4 — je ne la traite pas ici.
- **Patch prescrit** : (1) corriger le commentaire chiffré du workflow (`:697-699`,
  `:855-857`) ; (2) **ne pas** ajouter ces pages au warm tant que A2/D4 n'a pas
  tranché leur statut d'indexation — chauffer des pages hors sitemap consommerait des
  rendus origine sans bénéfice de découverte.
- **Effort** : S · **Impact** : faible · **Risque** : nul.

## Mesures brutes

### Pages — en-têtes de cache servis (2026-08-14, UTC)

| URL | Heure | code | `cf-cache-status` | `x-nextjs-cache` | `Age` | `Cache-Control` servi |
|---|---|---|---|---|---|---|
| `/` | 19:09:40 | 301 | DYNAMIC | — | — | — |
| `/fr` | 19:09:40 | 200 | HIT | HIT (prerender=1) | 2494 | `s-maxage=3600, swr=31532400` |
| `/fr` | 19:11:01 | 200 | HIT | HIT (prerender=1) | 2574 | idem — **0 `aggregateRating`** |
| `/fr` | 19:19:18 | 200 | HIT | HIT | 3074 | idem |
| `/fr` | 19:23:09 | 200 | HIT | HIT | 3302 | idem — **0 `aggregateRating`** |
| `/fr/blog` | 19:11:38 | 200 | HIT | **STALE** | 123 | `s-maxage=3600` |
| `/fr/actualites` | 19:11:38 | 200 | HIT | STALE | 116 | `s-maxage=3600` |
| `/fr/diagnostic` | 19:11:38 | 200 | MISS | STALE | — | `s-maxage=3600` |
| `/fr/connaissances` | 19:11:38 | 200 | MISS | STALE | — | `s-maxage=3600` |
| `/fr/ressources` | 19:11:38 | 200 | MISS | STALE | — | `s-maxage=3600` |
| `/fr/galerie` | 19:11:38 | 200 | **BYPASS** | — | — | `private, no-store` |
| `/fr/avis` | 19:11:38 | 200 | BYPASS | — | — | `private, no-store` |
| `/fr/carrieres` | 19:15:13 | 200 | BYPASS | — | — | `private, no-store` |
| `/fr/presse` | 19:15:13 | 200 | BYPASS | — | — | `private, no-store` |
| `/fr/appel` | 19:17:09 | 200 | BYPASS | — | — | `private, no-store` |
| `/fr/tarifs` | 19:11:38 | 200 | HIT | STALE | 118 | `s-maxage=3600` |
| `/fr/faq` | 19:17:09 | 200 | HIT | HIT | 2959 | `s-maxage=3600` |
| `/fr/formations` | 19:17:09 | 200 | HIT | HIT | 3059 | `s-maxage=3600` |
| `/fr/audit` | 19:17:09 | 200 | HIT | **STALE** | 1055 | `s-maxage=3600` |
| `/fr/contact` | 19:17:09 | 200 | HIT | HIT | 1925 | `s-maxage=86400` |
| `/fr/implantations/…/grenoble` | 19:13:30 | 200 | HIT | HIT (prerender=1) | 825 | `s-maxage=86400` |
| `/fr/audit/par-ville/grenoble` | 19:19:18 | 200 | **MISS** | HIT | — | `s-maxage=86400` |
| `/fr/formations/par-ville/grenoble` | 19:19:18 | 200 | MISS | HIT | — | `s-maxage=86400` |
| `/fr/un-a-un/par-ville/grenoble` | 19:19:18 | 200 | MISS | HIT | — | `s-maxage=86400` |
| `/robots.txt` | 19:09:40 | 200 | HIT | HIT | 2204 | `public, max-age=86400, must-revalidate` |
| `/llms.txt` | 19:12:12 | 200 | **DYNAMIC** | — | — | `public, max-age=3600, swr=86400` |
| `/llms-full.txt` | 19:12:12 | 200 | DYNAMIC | — | — | `public, max-age=3600, swr=86400` |
| `/ai.txt` | 19:12:12 | 200 | DYNAMIC | — | — | `public, max-age=86400, swr=604800` |
| `/.well-known/ai-policy.json` | 19:12:12 | 200 | DYNAMIC | — | — | `public, max-age=86400, immutable` |

### Sitemaps — code vs live (2026-08-14 19:11–19:19 UTC)

| Sitemap | `max-age` **code** | `max-age` **servi** | `s-maxage` | `Age` observé | `cf` | URLs |
|---|---|---|---|---|---|---|
| `/sitemap-index.xml` | 300 (`route.ts:354`) | **3600** | 600 | 2618 → 3197 → **3429** (19:23:09) | HIT | 38 |
| `/sitemap-index.xml?cb=…` | 300 | **3600** | 600 | — (MISS) | MISS | — |
| `/sitemap-blog.xml` | 300 (`route.ts:99`) | **3600** | 600 | 2676 | HIT | 134 |
| `/sitemap-knowledge.xml` | 300 | **3600** | 600 | 1344 | HIT | 507 |
| `/sitemap-news.xml` | 300 (`route.ts:198`) | **3600** | — | 1729 | HIT | 0 (gaté hors index) |
| `/sitemap-news-evergreen.xml` | 300 | **3600** | 600 | 1345 | HIT | 32 |
| `/sitemap-presse.xml` | 300 | **3600** | 600 | 1341 | HIT | 1 |
| `/sitemap-avis.xml` | 3600 | 3600 | — | 1340 | HIT | 103 |
| `/sitemap-carrieres.xml` | 3600 | 3600 | — | 1341 | HIT | 55 |
| `/sitemap-recrutement.xml` | 3600 | 3600 | — | 1342 | HIT | 3 |
| `/sitemaps/images-fr.xml` | 3600 | 3600 | — | 2693 | HIT | (A4) |
| `/sitemaps/images-en.xml` | 3600 | 3600 | — | 1730 | HIT | 0 (EN off, normal) |
| `/sitemap-images-blog.xml` | 300 | **3600** | 600 | 2224 | HIT | (A4) |
| `/sitemap/*.xml` (13 fichiers) | 300 (`next.config.ts:707`) | **3600** | 600 | 1684–1690 | HIT | 86/97/12/10/3/1/1/8/19/11/61/27/177 |

Total URLs non-image déclarées : **1 651** (dont 480 hubs villes) — cap du warm : 4 000.

### Inventaire `revalidate` (113 exports, `src/app/**`)

| Valeur | Nb | Exemples | Remarque |
|---|---|---|---|
| `0` / `force-dynamic` | 1 | `[locale]/[...catchall]/page.tsx:31-32` | volontaire (404 réels) |
| `60` | 1 | `galerie/page.tsx:227` | **mort** (page dynamique) |
| `300` | 2 | `blog/feed.xml`, `actualites/feed.xml` | OK |
| `600` | 4 | `sitemap-{index,blog,knowledge,presse}` | inopérant sous `force-dynamic` (P2 A3) |
| `900` | 1 | `appel/page.tsx:30` | **mort** (page dynamique) |
| `3600` | 79 | hubs éditoriaux, `[slug]`, `page.tsx:70` (home) | cohérent |
| `86400` | 24 | villes, `implantations/**`, `a-propos`, `equipe/[slug]` | **P1** quand la page lit la DB |
| `false` | 2 | `ai-policy.json`, `security.txt` | volontaire |

### Chaîne d'invalidation

| Déclencheur | `revalidatePath` origine | Purge Cloudflare | Verdict |
|---|---|---|---|
| Job `warm` (5 chemins, `deploy-coolify.yml:747`) | oui | oui (`:778`, 5 URLs) | complet mais incomplet en couverture (P0) |
| Job `deploy` | — | `purge_everything` (`:510`) | complet, mais **avant** toute revalidation |
| `content-publish-worker` (`:1155-1165`) | oui | **non** | P1 |
| `articles/[id]/forget` (`:123-126`) | oui | **non** | P1 (effacement) |
| Server actions admin (blog/FAQ/cas-concrets/…) | oui | **non** | P1 |
| `observatoire-snapshot-worker` (`:29-46`) | — | oui | seul chaînage complet du code applicatif |

## Limites

- **Fenêtre post-deploy** : toutes mes mesures tombent entre T+43 min et T+53 min
  après l'atterrissage de 18:26 UTC, et un run parti à 18:54 UTC n'avait pas encore
  atterri. Je n'ai donc PAS pu observer la guérison de `/fr` après expiration edge
  (prévue ~19:28 UTC) ni un état « hors fenêtre » de référence — A3 l'a fait à
  17:56 UTC (`reviewCount 77` présent), ce qui borne le problème dans le temps.
- **Acteur exact de la réécriture `max-age`** : non isolé (console Cloudflare non
  ouverte, audit-only ; pas d'accès à l'origine hors CF pour comparer). L'effet est
  prouvé, l'attribution à une Cache Rule CF reste une inférence forte (la réécriture
  ne touche QUE `max-age` et laisse `s-maxage`/`swr`/`stale-if-error` intacts).
- **`Article.mentionedCities`** : non vérifiable sans accès DB (je n'en ai pas
  l'autorisation). Le mécanisme d'ISR jamais régénérée sur les hubs villes est prouvé
  indépendamment ; seule l'ampleur du contenu perdu reste à confirmer par un agent
  habilité (requête fournie dans le finding).
- **`cacheHandler` / volumes** : conclu par absence (`grep` sur `next.config.ts`,
  `Dockerfile`, `docker-compose*.yml`). Je n'ai pas inspecté la configuration Coolify
  côté plateforme, qui pourrait théoriquement monter un volume non déclaré au dépôt —
  l'observation live (`x-nextjs-prerender: 1` sur `/fr` 45 min après un déploiement,
  contenu DB vide) va toutefois dans le même sens.
- **Comportement de Cloudflare vis-à-vis de `stale-while-revalidate`** : déduit de
  l'absence de `cf-cache-status: EXPIRED`/`STALE` sur ~30 requêtes, pas d'une
  documentation de plan. Le P2 correspondant est préventif.
- Aucun Lighthouse local, aucun `pnpm build`, aucune requête mutante, aucune commande
  git : conforme aux règles d'exécution du digest.

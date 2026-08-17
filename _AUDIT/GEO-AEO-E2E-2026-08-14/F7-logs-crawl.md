# F7 — Logs serveur & crawl réel

- **Date/heure** : 2026-08-14. Passe 1 (chaîne de logs) 18:43–18:50 UTC ; **passe 2 (consolidation + mesures live) 19:05–19:30 UTC**. Ce fichier remplace et étend la passe 1 : tous les constats de la passe 1 ont été re-vérifiés avec mes propres horodatages, et 4 findings nouveaux s'y ajoutent.
- **Chronologie deploy retenue** (source `gh run view`, pas le digest) :
  - run `31824504716` (sha `99ba93a0`) : build 17:33:09→18:21:47, **deploy 18:21:50→18:26:02**, warm 18:26:04→**18:35:25**, LHCI →18:36:04 — `success`.
  - run `31829452492` (sha `308171ae`, CGV) : build **cancelled 18:55:07** ; jobs `deploy`, `warm`, `IndexNow`, `LHCI` = **skipped**.
  - run `31830868520` créé **18:54:44**, `in_progress` à l'heure de mes mesures (atterrissage estimé ~19:50–20:00 UTC).
  - **Fait mesuré qui ne colle avec aucun des trois** : les conteneurs applicatifs ont (re)démarré à **18:49:06 UTC** (cf. P0-1).
  - Toutes mes mesures live tombent donc dans une fenêtre **post-restart ≤ 1 h** — je le signale finding par finding, et c'est précisément l'objet du P0-1.
- **Périmètre réellement couvert** : recherche exhaustive de toute source de logs HTTP (Traefik, conteneurs, hôte, Cloudflare, Plausible, Sentry, DB) ; comportement du cache edge Cloudflare face à un crawler (HIT/MISS/BYPASS, divergence edge↔origin) ; chaîne post-déploiement (purge → revalidate → warm) confrontée à l'état réel des conteneurs ; télémétrie GSC automatisée (`crawl-stats-*.csv`, `gscInspectUrl`, workers `site_routes`) ; `audit-reverse-dns-bots.ts` ; réaction de la prod à 9 UA de bots (Google, Bing, OpenAI ×3, Perplexity, Anthropic, Apple, Mistral) ; coût crawl en octets des stubs pSEO ; volumétrie déclarée aux moteurs (38 sitemaps).
- **Périmètre NON couvrable** (cause = P0-2) : hits réels Googlebot/Bingbot/bots IA sur 7 j, top paths crawlés, 404 réellement crawlées, fréquence de crawl des sitemaps, hits réels sur `llms.txt` / `/api/markdown/`, vérification reverse-DNS sur trafic réel.

## Résumé exécutif

Deux verdicts, l'un structurel et l'autre brûlant. **Structurel** : il n'existe **aucun access log HTTP** dans toute la chaîne (Traefik sans `--accesslog`, Next.js muet, hôte sans log web, Cloudflare Free sans Logpush, Plausible/Clarity aveugles aux bots, aucune table DB) — donc aucune des questions cœur de F7 n'a de réponse mesurable, et les deux palliatifs existants sont morts (les CSV « crawl-stats » sont en fait du Search Analytics ; `gscInspectUrl`, seule voie légitime vers `lastCrawlTime`, n'a aucun appelant). **Brûlant** : à **18:49:06 UTC**, les conteneurs ont redémarré **hors du pipeline GitHub Actions** (le run correspondant a eu ses jobs `deploy`/`warm` *skipped*) — donc sans revalidation, sans purge ciblée, sans chauffe. Conséquence **mesurée à 19:22:23 UTC**, à l'heure du lancement : le hub `/fr/actualites` servi par l'edge Cloudflare ne contient **1 seul lien d'article contre 33 à l'origine**, et la home servie par l'edge n'a **aucun `ratingValue`** alors que l'origine en sert un (4.9 / 77 avis). Ce n'est pas seulement la liste incomplète du job `warm` (constat transverse (a)) : c'est un **chemin de redémarrage qui contourne l'intégralité des remédiations**, invisible faute de logs et d'alerte. Deux notes plus positives : aucun des 9 UA de bots testés n'est challengé par Cloudflare (`cf-mitigated` absent partout, 200 sur `/fr/audit`), et le `X-Robots-Tag: noindex, follow` des stubs pSEO fonctionne réellement en prod. Enfin, une ressource dormante existe : **Sentry est actif en prod** avec 2 % des transactions HTTP tracées et le `user-agent` non scrubbé — un embryon gratuit de télémétrie crawl que personne n'exploite.

## Findings

### [P0] Redémarrage des conteneurs HORS pipeline (18:49:06 UTC) → zéro remédiation post-déploiement, et un hub servi vide aux crawlers pendant 1 h

- **Symptôme** : la prod a été redéployée sans que la moindre étape post-déploiement (revalidation ISR, purge CF ciblée, chauffe des pages stratégiques, sweep sitemap, ping IndexNow, gate LHCI) ne s'exécute. Résultat : les pages ISR lisant la base repartent de leur version **stub-bakée** (ADR 0026), et le **premier visiteur/crawler qui les demande fige cette version vide dans le cache Cloudflare pour `s-maxage=3600`**.
- **Preuve live (horodatée)** :
  | Heure UTC | Mesure | Résultat |
  |---|---|---|
  | 19:23:15 | `docker inspect … .State.StartedAt` (conteneur web) | **`2026-08-14T18:49:06Z`**, image `mqbmlz…:308171ae273fe…` |
  | 19:23:15 | `docker images` | `…:308171ae…` (web) construite « About an hour ago », worker « 32 minutes ago » (~18:51) ; `…:99ba93a0…` construite ~18:2x |
  | 19:22:23 | `curl -A Googlebot https://axion-ia.com/fr/actualites` (edge, `Age: 761` → mis en cache **19:09:42**) | **1** lien `/fr/actualites/<slug>` unique |
  | 19:22:23 | même URL + cache-buster `?_f7b=1` (origine, `MISS`) | **33** liens d'articles |
  | 19:20:15 | `/fr` edge (`HIT`, `Age: 3128` → cache 18:28:07) | **0** occurrence de `ratingValue` |
  | 19:20:15 | `/fr?_f7=1` (origine, `MISS`) | `ratingValue":4.9`, `reviewCount":77` |
  | 19:21:10 | `/fr/ressources` edge (`Age: 599`) vs origine | 1 109 556 o **vs** 1 211 371 o |
  | 19:21:10 | `/fr/diagnostic` edge (`Age: 608`) vs origine | 1 164 389 o **vs** 1 288 017 o |
  | 19:25:17 | `Cache-Control` de `/fr` et `/fr/actualites` | `s-maxage=3600, stale-while-revalidate=31532400` → version vide figée jusqu'à ~20:09 UTC pour `/fr/actualites` |
- **Preuve code / CI** : `gh run view 31829452492` (19:23 UTC) → `Build & push image to GHCR = cancelled 18:55:07`, `Trigger Coolify deploy = skipped`, **`Warm edge cache (full indexable surface) = skipped`**, `IndexNow ping = skipped`, `LHCI = skipped`. Or c'est bien le SHA `308171ae` de ce run cancelé qui tague l'image en ligne. Le run précédent (`31824504716`) avait fini sa chauffe à **18:35:25**, soit **14 min avant** le restart de 18:49:06 : tout son bénéfice a été effacé. Les remédiations vivent exclusivement dans `.github/workflows/deploy-coolify.yml` : `:524` (`purge_everything`), `:747` (revalidate des 5 chemins), `:759-790` (purge CF ciblée), `:801-825` (chauffe stratégique, UA `AxionIA-CacheWarmer/1.0` `:804`), `:827-870` (sweep sitemap, `cap=4000` `:853`) — **rien de tout cela n'est déclenché par un démarrage de conteneur**.
- **Root-cause** : le seul mécanisme d'auto-guérison post-déploiement est un job GitHub Actions. Tout autre chemin de redémarrage — déploiement Coolify hors pipeline, restart manuel via l'UI, crash/OOM avec restart policy, reboot hôte, `docker compose up` de maintenance — repart avec une ISR froide et **aucune** compensation. Le mécanisme précis du déclenchement de 18:49 reste **[À CONFIRMER]** : ce n'est pas un webhook GitHub de dépôt (`gh api repos/will383842/axion-ia/hooks` → `[]`, 19:24 UTC), donc soit l'auto-deploy de la GitHub App Coolify, soit un déclenchement manuel dans l'UI Coolify. Effet secondaire de cette même bascule : l'image en ligne est **étiquetée `308171ae`** alors que le binaire tiré de GHCR (`Dockerfile.coolify-pull` → `:latest`) est celui de `99ba93a0` (le build de `308171ae` a été annulé avant tout push) — l'étiquette de version en prod est donc **mensongère**, ce qui rendra tout diagnostic ultérieur trompeur.
- **Patch prescrit** (3 volets, du plus rentable au plus structurant) :
  1. **Auto-guérison au boot, indépendante de la CI** : dans `src/instrumentation.ts:5-13` (`register()`, runtime `nodejs`), ajouter — sur le modèle exact du `seedQualiopiReferenceDataOnBoot()` déjà présent `:24-46` (garde `stub.invalid`, kill-switch env, fail-soft total) — un `warmCriticalIsrPagesOnBoot()` qui, après un court délai, effectue un GET local (`http://127.0.0.1:3000/...`) des pages ISR DB-dépendantes **puis** purge ces URLs chez Cloudflare si le token est présent. Couvre **tous** les chemins de redémarrage, y compris ceux que la CI ne voit pas.
  2. **Fusionner les deux listes** de `deploy-coolify.yml:747` et `:808` en **une seule constante partagée** avec le code (une liste unique lue par le workflow ET par le hook de boot), et y ajouter au minimum `/fr` (la home porte l'`AggregateRating`, preuve ci-dessus) — recoupe le constat transverse (a) des autres agents, avec ici la preuve que le trou n'est pas seulement une omission de liste mais un trou de *déclenchement*.
  3. **Fermer le chemin hors pipeline** : désactiver l'auto-deploy Coolify côté application (le pipeline ADR 0026 est la voie unique) OU, si Will le garde, exposer un `/api/healthz` renvoyant le SHA réellement exécuté et alerter (hub Telegram déjà en place, job `notify`) quand il diverge du dernier run vert.
- **Effort** : M (volet 1 : S-M ; volet 2 : S ; volet 3 : S côté Coolify).
- **Impact GEO/AEO** : **fort**. Un crawler qui passe pendant la fenêtre voit un hub d'actualités à 1 article au lieu de 33 : perte de découverte de 32 URLs, perte de fraîcheur, `AggregateRating` absent de la home (rich result étoiles), et le tout figé 1 h par le CDN — le jour du lancement.
- **Risque de régression du patch** : volet 1 = faible si strictement fail-soft (ne JAMAIS laisser une erreur de chauffe empêcher le boot ; le précédent `seedQualiopiReferenceDataOnBoot` est le gabarit) et si la garde `stub.invalid` est présente (sinon le build GH Actions tenterait la chauffe). Volet 3 = **STOP & ASK Will** : toucher au déclenchement Coolify peut casser la voie de secours de déploiement. **Do-not-touch** : `dockerfile_location` Coolify (ADR 0026), `Dockerfile.coolify-pull`, la garde `SKIP_ENV_VALIDATION`, la concurrence `cancel-in-progress` du workflow (elle protège le disque du VPS).

### [P0] Zéro observabilité du crawl réel — aucun access log HTTP nulle part, et l'endroit où en poser un est *derrière* le cache

- **Symptôme** : impossible de mesurer le moindre hit de Googlebot, Bingbot ou d'un bot IA. La question centrale du GEO — « les moteurs IA lisent-ils réellement `llms.txt`, `llms-full.txt`, `/api/markdown/` ? » — est **sans réponse possible aujourd'hui**, tout comme « quel budget de crawl est gaspillé sur les 17 k routes ? ».
- **Preuve (chaîne complète, re-vérifiée par moi, `ssh axion-prod` lecture seule)** :
  1. **Traefik v3.6** (`coolify-proxy`, up 6 semaines) : `docker inspect … Args` filtré sur `log|access` → **vide** (19:10:45 UTC). `grep -ril accesslog /data/coolify/proxy/` → **0 fichier** (19:25:36 UTC). `/data/coolify/proxy/dynamic/` = `Caddyfile` résiduel 24 o + `default_redirect_503.yaml`, rien d'autre.
  2. **Traefik ne logge que ses erreurs** : `docker logs --tail 5 coolify-proxy` (19:25:36) → uniquement des `ERR … acme` pour `docuseal.axion-ia.com`, la plus récente datant du **2026-08-13** — aucune ligne de requête depuis toujours.
  3. **Hôte** : `ls /var/log` (19:25:36) → syslog, auth, fail2ban, kern, backups, apt… **aucun répertoire nginx/caddy/traefik**.
  4. **Next.js** : aucun logging de requête (aucun middleware de log ; `src/proxy.ts` ne journalise rien) ; `src/instrumentation.ts:50` ne capture que les *erreurs*.
  5. **Docker** : driver `json-file` plafonné à `max-size=10m`, `max-file=3` sur le web ET sur le proxy (19:11:01 UTC) → même si on loggait sur stdout, la rétention serait de quelques heures sur un site à fort crawl, et **tout est détruit à chaque recréation de conteneur**.
  6. **Cloudflare Free** : pas de Logpush (Enterprise), pas de dimension User-Agent en analytics Free.
  7. **Plausible** (community v3.0.1) et **Microsoft Clarity** (autorisé en CSP : `www.clarity.ms`, en-tête relevé 19:25:17) sont tous deux **JS** → structurellement aveugles aux bots.
  8. **DB** : aucune table de hits (recoupé de la passe 18:46 : `information_schema` filtré `%crawl%|%bot%` → 0 ; aucun modèle `CrawlHit`/`BotHit` dans `prisma/schema.prisma`).
- **Précision neuve, décisive pour le patch** : **le HTML est servi depuis le cache edge Cloudflare**. Mesuré 19:09–19:25 UTC : `/fr` → `HIT` (`Age` 2480 puis 3431), `/fr/actualites` → `HIT`, `/fr/ressources` → `HIT`, `/robots.txt` → `HIT` (`Age` 2190), `/sitemap-index.xml` → `HIT` (`Age` 2605), et une page ville passe `MISS` puis `HIT` au second appel (19:10:01–19:10:02, TTFB 430 ms → 76 ms). **Un access log Traefik ne verra donc PAS les hits servis par l'edge** : il sous-comptera systématiquement le crawl des pages chaudes (home, hubs, `robots.txt`, sitemaps — exactement les URLs les plus crawlées) tout en captant correctement le crawl long-tail pSEO (majoritairement `MISS`, car re-crawlé bien moins souvent que le `s-maxage=86400`). Toute lecture de ces logs devra porter cet avertissement, sous peine de conclure « Googlebot ne lit plus notre sitemap » alors qu'il le lit depuis le cache.
- **Patch prescrit**, par ordre de rapport bénéfice/risque :
  1. **Niveau origine (rapide, partiel)** : activer l'access log Traefik en JSON via `/data/coolify/proxy/docker-compose.yml` (section `command:`) : `--accesslog=true`, `--accesslog.filepath=/traefik/access.log`, `--accesslog.format=json`, `--accesslog.fields.headers.names.User-Agent=keep`, `--accesslog.fields.headers.names.CF-Connecting-IP=keep`, `--accesslog.fields.headers.names.Referer=keep`, **+ logrotate obligatoire** (7–14 j, compress ; 81 Go libres mesurés à 19:10:46, mais le pSEO produit du volume).
  2. **Niveau edge (seul exhaustif)** : un Cloudflare Worker qui compte les hits par (UA-bot, chemin) dans Analytics Engine (plan Workers payant ~5 $/mois) — c'est la **seule** façon de voir les hits absorbés par le cache. À arbitrer par Will (coût).
  3. **Zéro-infra, disponible immédiatement** : exploiter Sentry (cf. P1 suivant).
- **Effort** : M (niveau 1) / M-L (niveau 2). **Impact GEO/AEO** : **fort**.
- **Risque de régression** : modifier le compose du proxy Coolify implique un redémarrage du proxy → coupure de quelques secondes sur **tout** le VPS (site, Plausible, DocuSeal). À faire hors fenêtre de lancement, avec GO explicite de Will. **Do-not-touch** : `acme.json`, `/data/coolify/proxy/dynamic/` (surveillé à chaud par Traefik), `dockerfile_location` Coolify.

### [P1] Sentry tourne en prod avec 2 % des transactions HTTP tracées et le `user-agent` NON scrubbé — une télémétrie de crawl gratuite que personne n'exploite

- **Symptôme** : le rapport de la passe 1 concluait « aucune source de données ». C'est vrai pour les logs, mais **faux au sens strict** : une source d'échantillon existe déjà, en ligne, financée, et n'est branchée sur aucune analyse de crawl.
- **Preuve live** : `SENTRY_DSN` **présent dans l'environnement du conteneur web** en prod (`…@o4510557298294784.ingest.de.sentry.io/4511361744175184`, relevé masqué 19:11:01 UTC) ; `NEXT_PUBLIC_SENTRY_DSN` également présent ; le CSP de la prod autorise `https://*.ingest.de.sentry.io` (en-tête relevé 19:25:17 UTC) — le flux part donc réellement.
- **Preuve code** : `src/sentry.server.config.ts:7` (init conditionnée au DSN), `:18` (`tracesSampleRate` = **0.02** en prod), `:37` (`sendDefaultPii: false`) ; `src/lib/observability/sentry-pii-scrub.ts:41-50` — la liste `SENSITIVE_HEADER_KEYS` couvre `authorization`, `cookie`, `x-api-key`… **mais pas `user-agent`** ; `src/instrumentation.ts:5-13` charge la config au boot. Autrement dit : 1 requête serveur sur 50 remonte avec sa méthode, son chemin (scrubé des segments secrets) et, sous réserve de vérification côté UI, son UA.
- **Limite honnête [À CONFIRMER]** : je n'ai pas d'accès à l'UI/API Sentry pour vérifier que le champ `request.headers.user-agent` est bien présent sur les transactions (le SDK peut ne pas l'attacher avec `sendDefaultPii: false`). À vérifier en 5 min par Will dans l'UI Sentry (filtre `http.server` sur 24 h). Même caveat que P0-2 : Sentry ne voit que ce qui atteint l'origine, pas les `HIT` edge.
- **Patch prescrit** : remplacer `tracesSampleRate` par un `tracesSampler` **bot-aware** dans `sentry.server.config.ts` — 100 % (ou 20 %) d'échantillonnage quand l'UA correspond à `/(googlebot|bingbot|oai-searchbot|chatgpt-user|perplexitybot|claude-searchbot|gptbot|applebot|mistralai|amazonbot|bytespider|ccbot)/i`, 0,02 sinon — et ajouter explicitement `user-agent` aux données conservées (il ne l'est pas dans la liste sensible, donc rien à retirer). Coût quasi nul (le trafic bot est une fraction du volume), et on obtient immédiatement « quels bots, quels chemins, quand », dashboardable dans Sentry sans nouvelle infra. **Ne pas** en faire la source unique : c'est un complément au P0-2, pas un substitut.
- **Effort** : S. **Impact GEO/AEO** : **moyen-fort** (première réponse mesurable à « les IA nous lisent-elles ? », livrable en une heure).
- **Risque de régression** : faible — mais surveiller le quota Sentry (un pic de crawl à 100 % d'échantillonnage peut consommer le quota de spans ; démarrer à 0.2 et ajuster). **RGPD** : ne PAS relâcher `sendDefaultPii: false` et ne pas ajouter l'IP ; l'UA seul suffit. **Do-not-touch** : `piiScrubBeforeSend` / `piiScrubBeforeSendTransaction` et la liste `SEGMENTS_SECRETS` (jetons d'émargement).

### [P1] Les CSV hebdo « crawl-stats » ne contiennent PAS de crawl stats — le gate « crawl budget < 30 % » n'a jamais été mesuré

- **Symptôme** : 13 fichiers `_AUDIT/crawl-stats-2026-W21.csv` → `W33.csv` (export automatique hebdo) présentés comme mesurant le ratio de crawl Googlebot, mais dont les colonnes sont `page,impressions,clicks,ctr,position` — des données **Search Analytics** (SERP), pas de crawl.
- **Preuve code** : `scripts/perf/export-gsc-crawl-stats.mjs:91` (commentaire « top 1000 pages **crawlées** ») contre `:98` (endpoint réel `…/searchAnalytics/query`) et `:126` (`const header = "page,impressions,clicks,ctr,position"`) ; `.github/workflows/gsc-crawl-stats-weekly.yml:4-5` (promesse « crawl stats » + « gate crawl budget < 30 % »).
- **Preuve locale (re-vérifiée 19:12 UTC)** : `head -1 _AUDIT/crawl-stats-2026-W33.csv` → `page,impressions,clicks,ctr,position` ; 13 fichiers présents.
- **Root-cause** : le rapport « Crawl Stats » de GSC n'a pas d'API publique (UI seulement) ; le script a été écrit avec la seule API disponible sans corriger le nom ni la promesse. Toute décision prise « sur la foi du gate crawl budget » repose donc sur du vide.
- **Patch prescrit** : (a) renommer script/workflow/artefacts en `gsc-search-perf-*` **et** mettre à jour le glob du step de commit (`gsc-crawl-stats-weekly.yml:84-86`) dans le même commit ; (b) la vraie mesure de crawl passe par P0-2 (logs/edge) et/ou par le finding suivant. **Ne pas supprimer l'export** : W21→W33 est une série temporelle SERP précieuse (F2 s'en sert).
- **Effort** : S. **Impact GEO/AEO** : moyen (fausse confiance sur un garde-fou anti-gaspillage inexistant).
- **Risque de régression** : faible, à condition de renommer glob et fichiers ensemble. **Do-not-touch** : les 13 CSV historiques.

### [P1] `gscInspectUrl` (URL Inspection API, `lastCrawlTime`) est du code mort — la seule mesure légitime de fréquence de crawl par URL n'est branchée nulle part

- **Symptôme** : sans logs, la fréquence de crawl par URL reste mesurable via l'URL Inspection API (`lastCrawlTime`, quota 2 000 req/j) — mais la fonction n'a **aucun appelant**.
- **Preuve code (re-vérifiée 19:12 UTC)** : `grep -rn "gscInspectUrl" src/ scripts/` → **1 seul hit**, sa propre définition `src/server/content-gen/seo/gsc-client.ts:326`. Le modèle `SiteRoute` stocke clicks/impressions/ctr/position mais aucun champ de crawl.
- **Preuve live (DB, recoupée de la passe 1, 18:46 UTC — DB non ré-interrogeable en passe 2, cf. Limites)** : `site_routes` = 4 453 lignes, 4 047 avec données GSC fraîches (`max(gsc_data_at)` = 2026-08-14 04:00 UTC), 3 892 inspectées en interne (`max(last_inspected_at)` = 02:19 UTC). Le pipeline worker tourne : il ne manque que le branchement.
- **Patch prescrit** : dans `site-route-inspector-worker`, échantillonner ≤ 1 500 URLs/j (tier-1 + pages stratégiques + rotation), appeler `gscInspectUrl`, persister `gsc_last_crawl_time` (+ état de couverture) sur `site_routes`, et exposer « dernière visite Googlebot » + « % de routes crawlées < 30 j » par catégorie dans la console. C'est le complément idéal du P1 Sentry : Sentry donne les bots IA, l'Inspection API donne Google.
- **Effort** : M. **Impact GEO/AEO** : fort. **Risque de régression** : faible-moyen (respecter 600 req/min ; fail-soft `return null` déjà en place sans credentials). **Do-not-touch** : le flow OAuth de `gsc-client.ts` (partagé avec la synchro mots-clés), les quotas de l'Indexing API (distincts).

### [P2] `audit-reverse-dns-bots.ts` : jamais exécuté, et inopérant en l'état (regex `.+` + mauvaise IP)

- **Symptôme** : le contrôle anti-spoofing des bots n'a jamais produit un rapport, et validerait n'importe quoi s'il tournait.
- **Preuve code** : `scripts/audit-reverse-dns-bots.ts:54` (ClaudeBot → `expectedHostnameRegex: /.+/`), `:59` (Perplexity → `|.+/`), `:64` (OAI → `|.+/`) → tout reverse DNS non vide passe « legitimate » ; `:110-111` parse `client_ip` du log — or derrière Cloudflare l'IP vue à l'origine est celle de l'edge (`CF-RAY` sur 100 % de mes réponses, 19:09–19:25 UTC), donc **tous** les Googlebot seraient classés « fake » ; `:21-22` « pas de cron auto — run manuel ».
- **Preuve locale (19:12 UTC)** : `_AUDIT/reverse-dns-*.json` → **0 fichier**. Jamais exécuté depuis sa création (2026-05-18) — cohérent avec P0-2 : il n'y a jamais eu de log à lui donner.
- **Patch prescrit** : après P0-2 — (1) lire `CF-Connecting-IP` et non `client_ip` ; (2) durcir les regex (OpenAI, Anthropic et Perplexity publient désormais hostnames/plages) ; (3) cron mensuel léger.
- **Effort** : S-M. **Impact GEO/AEO** : faible-moyen (hygiène, distinction vrais bots IA / scrapers). **Risque** : nul (outil offline). **Do-not-touch** : la doctrine `robots.txt` (décision actée n°2).

### [P2] 22 routes internes en 404 et 39 anomalies `404/high` ouvertes — candidates au gaspillage de crawl [recoupé passe 1]

- **Symptôme** : l'inspecteur interne connaît 22 routes en 404, presque toutes `is_indexable = true`, avec 39 anomalies `404/high` non résolues. Personne ne purge, et rien ne mesure si Googlebot les recrawle (cf. P0-2).
- **Preuve live (DB, passe 1, 18:47 UTC)** : `site_routes` par statut → 200 : 3 870 · NULL : 561 · **404 : 22** ; anomalies ouvertes : `thin_content` 244, `orphan_page` 106, `no_ai_disclaimer` 101, `dup_meta_desc` 72, `dup_meta_title` 68, **`404` high : 39**, `dup_h1` 18. Exemples : `/fr/blog/3-quick-wins-2026`, `/fr/certification-qualiopi`, `/fr/financement-opco-france-travail`, `/fr/blog/categorie/{cas-d-usage,methodologie,strategie}`, `/fr/equipe/will`, 3 pages presse, 3 cas concrets, `/fr/centre-aide/facturation-tva-ee`.
- **Aggravant mesuré par moi (19:09:28 UTC)** : une réponse 404 sort en `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` + `cf-cache-status: BYPASS` — **chaque 404 crawlée coûte un rendu origine complet**, jamais amorti par le CDN. Le coût du gaspillage est donc supérieur à ce que le simple compte de 22 routes suggère.
- **Preuve code** : détection par `src/server/queue/workers/site-route-anomaly-detector-worker.ts` (type `404`, severity `high`) — la boucle de détection existe, la boucle de résolution non.
- **Patch prescrit** : 301 vers l'équivalent vivant quand il existe (ex. `facturation-tva-ee` → `facturation-tva`), sinon laisser 404 mais retirer le lien interne source ; marquer les anomalies résolues ; forcer `is_indexable = false` quand `http_status = 404`. ⚠️ Croiser avec A2/A3 (sitemaps) et C3/C4 (redirections/maillage) avant patch — surface partagée.
- **Effort** : S-M. **Impact GEO/AEO** : faible-moyen. **Risque** : faible (redirections additives). **Do-not-touch** : les slugs vivants du blog et de la presse.

### [P2] Le `X-Robots-Tag` des stubs fonctionne, mais le stub coûte quand même ~1,1 Mo de HTML par crawl

- **Symptôme** : le dispositif anti-doorway est opérationnel — mais le gain « crawl budget ÷ 5 » annoncé en commentaire porte sur le **rendu**, pas sur le **transfert** : Googlebot télécharge quand même la page entière avant de lire l'en-tête.
- **Preuve live (19:16:05 UTC)** : `/fr/audit/par-ville/aurec-sur-loire` → `200` + **`x-robots-tag: noindex, follow`**, `bytes=1 114 683` (brut) ; `/fr/audit/par-ville/annecy` (ville pilote, indexable) → `200` **sans** en-tête, `bytes=1 213 881` — comportement exactement conforme à la règle. Ordres de grandeur relevés en parallèle (19:10:14) : `/fr` = 1 577 128 o brut / **121 332 o sur le fil** (br/gzip) ; page ville = 1 265 587–1 286 743 o brut / ~100 500 o sur le fil.
- **Preuve code** : `src/proxy.ts:320-338` (pose de l'en-tête via `isNoindexStubRoute`), `src/lib/seo-noindex-routes.ts:163-194` (règle) et `:15` (cap `INDEXABLE_VILLE_SLUGS_CAP`, **480 slugs**, cohérent avec les 480 URLs villes déclarées mesurées par A2).
- **Chiffrage du budget** : 38 sitemaps déclarent **2 603 `<loc>`** au total (mesuré 19:17:42→19:18:22), dont 952 dans les 6 sitemaps images → **1 651 URLs de pages** réellement proposées aux moteurs, contre ~17 600 routes construites. Le delta (~1 700 villes hors cap + les ×3 services par ville) est constitué de stubs `noindex, follow` atteignables par maillage interne : à ~100 Ko gz pièce, un balayage complet de cette surface coûte de l'ordre de **0,5 à 0,8 Go compressés** uniquement pour se faire répondre « noindex ». Corollaire rassurant : le `cap=4000` du warmer (`deploy-coolify.yml:853`) n'est **pas** contraignant (1 651 < 4 000).
- **Patch prescrit** : si le sujet est priorisé, servir aux routes stub une variante allégée (early-return d'un layout minimal quand `isNoindexStubRoute` est vrai) plutôt que le gabarit complet. **À arbitrer avec la squad G** (poids de page) et **C4** (le `follow` doit continuer à laisser passer le link juice) — je ne recommande pas de le traiter avant les P0.
- **Effort** : M. **Impact GEO/AEO** : faible-moyen. **Risque de régression** : moyen (toucher au rendu des stubs peut casser le maillage `follow` et les tests de sync `seo-noindex-routes.test.ts`). **Do-not-touch** : `src/generated/indexable-villes.ts` (généré), la whitelist edge-safe et son test de synchronisation.

### Point positif vérifié — aucun bot n'est challengé par Cloudflare

Test de 9 User-Agents (19:24:43 UTC) sur `/fr/audit` : Googlebot, bingbot, OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, GPTBot, Applebot, MistralAI-User → **200 pour les 9**, en-tête `cf-mitigated` **absent** dans tous les cas. Aucun Managed Challenge ni Bot Fight Mode ne s'interpose (y compris pour un UA usurpé depuis une IP résidentielle, ce qui est le pire cas). Le blocage de GPTBot reste donc bien un blocage **par `robots.txt` seul**, conforme à la doctrine actée n°2. `/llms.txt`, `/ai.txt`, `/robots.txt`, `/sitemap-index.xml` : 200 (18:45 UTC passe 1, re-testés 19:09 UTC).

## Mesures brutes

### Live HTTP via Cloudflare (curl, UA indiqué)

| Heure UTC | URL | Status | cf-cache | Age | Notes |
|---|---|---|---|---|---|
| 19:09:27 | `/` | 301 | DYNAMIC | — | vers `/fr` |
| 19:09:27 | `/fr` | 200 | HIT | 2 480 | `s-maxage=3600, swr=31532400` |
| 19:09:29 | `/llms.txt` | 200 | DYNAMIC | — | `max-age=3600` |
| 19:09:29 | `/robots.txt` | 200 | HIT | 2 190 | `max-age=86400` |
| 19:09:30 | `/sitemap-index.xml` | 200 | HIT | 2 605 | 38 sub-sitemaps |
| 19:09:28 | `/fr/villes/lyon`, `/fr/audit-ia` (slugs inexistants, test de contrôle) | 404 | **BYPASS** | — | `private, no-store` → 404 = rendu origine non amorti |
| 19:10:01 | `/fr/implantations/…/aurec-sur-loire` (Googlebot) | 200 | MISS puis HIT | 0 | TTFB 430 ms → 76 ms |
| 19:10:14 | `/fr` (br/gzip) | 200 | — | — | **121 332 o** sur le fil / 1 577 128 o brut |
| 19:10:14 | `/fr/implantations/…/annecy` | 200 | — | — | 100 504 o / 1 265 587 o |
| 19:16:05 | `/fr/audit/par-ville/aurec-sur-loire` | 200 | MISS | — | **`x-robots-tag: noindex, follow`**, 1 114 683 o |
| 19:16:04 | `/fr/audit/par-ville/annecy` | 200 | MISS | — | pas d'en-tête (indexable) — conforme |
| 19:20:15 | `/fr` edge vs origine | 200 | HIT / MISS | 3 128 | **0 vs 1** `ratingValue` (origine : 4.9 / 77 avis) |
| 19:21:10 | `/fr/avis` | 200 | BYPASS | — | edge ≈ origine (1 468 154 / 1 468 186 o) |
| 19:22:23 | `/fr/actualites` edge vs origine | 200 | HIT / MISS | 761 | **1 vs 33** liens d'articles |
| 19:21:10 | `/fr/ressources` edge vs origine | 200 | HIT | 599 | 1 109 556 o vs 1 211 371 o |
| 19:21:10 | `/fr/diagnostic` edge vs origine | 200 | HIT | 608 | 1 164 389 o vs 1 288 017 o |
| 19:24:43 | `/fr/audit` × 9 UA de bots | 200 ×9 | — | — | `cf-mitigated` absent partout |
| 19:17:42→19:18:22 | 38 sub-sitemaps | 200 | — | — | **2 603 `<loc>`** dont 952 images → **1 651 URLs de pages** |

### Serveur (`ssh axion-prod`, lecture seule)

| Heure UTC | Vérification | Résultat |
|---|---|---|
| 19:10:45 | `docker ps` | proxy = **traefik:v3.6** (up 6 sem.) ; app web + worker **up 21 et 18 min** |
| 19:10:45 | `docker inspect coolify-proxy` Args \| grep log/access | **vide** — aucun `--accesslog` |
| 19:23:15 | `.State.StartedAt` conteneur web | **2026-08-14T18:49:06Z**, image tag `308171ae…` |
| 19:23:15 | `docker images` | tags `308171ae…` (≈18:49/18:51) et `99ba93a0…` (≈18:2x) |
| 19:11:01 | log driver (web + proxy) | `json-file`, `max-size=10m`, `max-file=3` |
| 19:11:01 | fichiers de log docker | web 6 319 o (dernier écrit 18:50) ; proxy 3 855 o (dernier écrit **13 août**) |
| 19:11:01 | env conteneur web | **`SENTRY_DSN` et `NEXT_PUBLIC_SENTRY_DSN` définis** (Sentry EU) |
| 19:25:36 | `ls /var/log` | aucun log web (syslog/auth/fail2ban/kern/backups) |
| 19:25:36 | `grep -ril accesslog /data/coolify/proxy/` | **0 fichier** |
| 19:25:36 | `docker logs --tail 5 coolify-proxy` | erreurs ACME uniquement, la plus récente du **2026-08-13** |
| 19:10:46 | `df -h /` | 63 Go utilisés / 150 Go — **81 Go libres** |

### CI / artefacts

| Élément | État |
|---|---|
| run `31824504716` (99ba93a0) | build 17:33:09→18:21:47 · deploy 18:21:50→**18:26:02** · warm 18:26:04→**18:35:25** · LHCI →18:36:04 — success |
| run `31829452492` (308171ae) | build **cancelled 18:55:07** · deploy/warm/IndexNow/LHCI **skipped** |
| run `31830868520` | créé **18:54:44**, `in_progress` à 19:23 UTC |
| `gh api repos/will383842/axion-ia/hooks` | **`[]`** (aucun webhook de dépôt — 19:24 UTC) |
| `_AUDIT/crawl-stats-W21..W33.csv` | 13 fichiers, colonnes `page,impressions,clicks,ctr,position` = Search Analytics |
| `_AUDIT/reverse-dns-*.json` | **0 fichier** |
| `gscInspectUrl` | 1 occurrence dans tout le dépôt = sa définition (`gsc-client.ts:326`) |

## Limites

- **Le cœur historique de la mission F7 reste invérifiable** (hits bots sur 7 j, top paths, 404 réellement crawlées, budget gaspillé mesuré, hits réels sur `llms.txt` / `/api/markdown/`, fréquence de crawl des sitemaps) : ce rapport **prouve l'absence de donnée** (P0-2) et livre à la place les mesures de substitution possibles (état edge/origine, cache, réaction aux UA bots, volumétrie déclarée).
- **DB prod non interrogeable en passe 2** : mes commandes `psql` via SSH ont été refusées par le classifieur de permissions (3 tentatives, 19:11–19:12 UTC). Les chiffres DB cités (`site_routes` 4 453 / 4 047 / 3 892 ; 22 routes 404 ; 39 anomalies `404/high`) proviennent de la passe 1 (18:46–18:47 UTC) et sont explicitement marqués comme tels — non re-confirmés par moi.
- **Mécanisme du redémarrage de 18:49:06 [À CONFIRMER]** : l'effet est prouvé (SHA de l'image, absence de webhook de dépôt, jobs `skipped`), pas le déclencheur (GitHub App Coolify vs action manuelle dans l'UI). À trancher par Will en 2 min dans Coolify → Application → Settings (auto-deploy) et dans l'historique des déploiements.
- **Sentry [À CONFIRMER]** : présence du DSN et non-scrub du `user-agent` prouvés par le code et l'env ; la présence effective du champ UA sur les transactions se vérifie dans l'UI Sentry (accès Will).
- **GSC UI « Crawl Stats »** (le vrai rapport de crawl, sans API) et **dashboard Cloudflare** non consultés : nécessitent les comptes de Will — à croiser avec F2.
- **Fenêtre de mesure** : toutes mes mesures live tombent 20–36 min après le restart de 18:49:06 UTC, et le run `31830868520` atterrira vers 19:50–20:00 UTC (nouvelle `purge_everything` + chauffe). Les écarts edge↔origine que je documente sont **la conséquence** de cette fenêtre, pas un artefact de mesure : ils décrivent exactement ce qu'un crawler obtient pendant cette heure, ce qui est le sujet du P0-1. Les mesures de configuration (logs, Sentry, Traefik, code) sont indépendantes de la fenêtre.
- **Aucune écriture hors `_AUDIT/GEO-AEO-E2E-2026-08-14/`, aucune commande git, aucun POST/PUT/DELETE, aucune soumission d'URL, aucune requête mutante en base.** Les cache-busters (`?_f7=1`, `?_f7b=1`) sont de simples GET ; ils ont créé 5 entrées de cache éphémères chez Cloudflare sur des URLs paramétrées (non canoniques, non indexables).

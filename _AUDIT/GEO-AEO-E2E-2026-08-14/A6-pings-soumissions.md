# A6 — Pings & soumissions (IndexNow, Google Indexing API, GSC/Bing)

- **Date** : 2026-08-14, mesures live 17:52–17:55 UTC (déploiement en vol depuis 17:33 UTC — sans impact sur cette surface, mesures interprétées en conséquence).
- **Périmètre réellement couvert** : `src/lib/indexnow.ts` (+ tests cascade), worker `content-indexnow-worker.ts`, worker `content-google-indexing-worker.ts`, `scripts/indexnow-ping.ts` (postbuild + job post-deploy), `scripts/daily-indexnow-resubmit.ts` (+ workflow cron), workflow `indexnow-images.yml`, `src/server/content-gen/indexing/{enqueue,url-builder}.ts`, clients `seo/{gsc-client,indexing-client,bing-wmt-client}.ts`, route `/api/indexnow`, bouton admin analytics, et TOUS les déclencheurs de publication (blog, actualités, KB/connaissances, FAQ, centre-aide, cas concrets, avis, offres d'emploi, presse, image-bank, villes).
- **Rappel cadrage** : la clé IndexNow est actée irréprochable (décision 11) — non re-diagnostiquée ; seuls l'usage, la couverture et les fallbacks sont audités. Le ticket Bing UCM000007450870 est un « reste Will » déjà acté — non répété.

## Résumé exécutif

Le pipeline de pings est **riche, réellement actif et bien instrumenté** : cascade d'endpoints testée unitairement, fail-streak Redis + alerte Telegram, kill-switch propagé, cron quotidien vert (1 061 URLs re-soumises ce matin), job post-deploy vert (907 URLs à 14:47 UTC aujourd'hui). MAIS : **`api.indexnow.org` refuse toujours le domaine (403 `UserForbiddedToAccessSite`, prouvé live aujourd'hui 14:47 UTC)** — tout aboutit chez **Yandex uniquement**, et le fallback Bing Webmaster Tools qui existe dans le code n'est **pas câblé**. Trois canaux secondaires sont morts ou troués : le bouton admin « Ping IndexNow » ne peut **jamais** réussir (HMAC jamais signé → 401 garanti, puis endpoint unique 403), les communiqués de **presse** ne pingent jamais à la publication, et le workflow `indexnow-images.yml` ne parle qu'aux deux endpoints Microsoft qui 403ent. Verdict : socle sain, mais la promesse « Bing notifié en 24-48 h » n'est plus tenue depuis des semaines.

## Findings

### [P1] Toute la chaîne IndexNow n'atteint que Yandex — Bing (moteur d'ancrage de ChatGPT Search/Copilot) probablement sourd, alors qu'un fallback Bing WMT existe dans le code, non câblé

- **Symptôme** : chaque soumission (post-deploy, cron quotidien, workers) est refusée par `api.indexnow.org` et acceptée par `yandex.com/indexnow`. L'agrégateur (opéré par Microsoft) « ne relaye rien quand il refuse » (constat 2026-08-11 documenté dans le code) → Bing ne reçoit vraisemblablement aucun ping, seul son crawl sitemap classique le sert.
- **Preuve code** : `src/lib/indexnow.ts:13-30` (documentation du 403 persistant + cascade) ; `src/server/content-gen/seo/bing-wmt-client.ts:11-16` — l'API Bing WMT `SubmitUrl`/`SubmitUrlBatch` (500 URLs/j) est décrite mais « NON utilisé V1 par doctrine — IndexNow couvre déjà Bing », doctrine **caduque** depuis le 403 ; grep : `bing-wmt-client` n'a **aucun caller** hors de lui-même et son spec.
- **Preuve live** (2026-08-14) : run deploy 31807073238, job « IndexNow ping (post-deploy) », log 14:47:40 UTC : `OK — 907 URLs acceptées par https://yandex.com/indexnow.` immédiatement suivi de `##[warning]endpoint(s) en échec malgré le succès global — https://api.indexnow.org/indexnow → 403 Forbidden {"errorCode":"UserForbiddedToAccessSite",…}`. Cron quotidien run 31768771942, 04:05:51 UTC : `1000 URLs acceptées par https://yandex.com/indexnow` (+ batch de 61) — jamais l'agrégateur.
- **Root-cause** : blocage back-end Microsoft (hors de notre contrôle, ticket Will en cours — non répété ici). Côté code, l'unique voie d'accès à Bing (soumission directe Bing WMT API) est restée volontairement débranchée sur la foi d'une doctrine antérieure au 403.
- **Patch prescrit** : câbler `bingWmtSubmitUrlBatch` (à ajouter dans `bing-wmt-client.ts`, l'API et la clé env `BING_WMT_API_KEY` y sont déjà décrites) comme **fallback conditionnel** dans `content-indexnow-worker.ts` et `daily-indexnow-resubmit.ts` : si `submitToIndexNow` n'a pas été accepté par `api.indexnow.org` (inspecter `result.attempts`), soumettre le batch (cap 500/j, prioriser URLs les plus récentes) à Bing WMT. No-op si `BING_WMT_API_KEY` absent. À DÉBRANCHER le jour où l'agrégateur ré-accepte.
- **Effort** : M. **Impact GEO/AEO** : fort (Bing alimente ChatGPT Search, Copilot, DuckDuckGo, Ecosia — fraîcheur J+1 vs crawl passif 7 j+).
- **Risque de régression** : faible (nouveau chemin gated par env var, fail-soft). ~10 % de risque de dépasser le quota 500/j les jours de gros batch → tronquer. **Do-not-touch** : la cascade de `src/lib/indexnow.ts` (ne PAS la réduire, cf. commentaire ligne 66-67), le fichier clé `/public/*.txt`, `indexnow-fallback.spec.ts`.

### [P1] Bouton admin « Ping IndexNow » structurellement mort : 401 garanti (HMAC jamais signé) puis endpoint unique 403

- **Symptôme** : le bouton de la console analytics (« notifier les moteurs ») ne peut **jamais** réussir, quelle que soit la configuration.
- **Preuve code** (double verrou) :
  1. `src/app/[locale]/(admin)/[adminPrefix]/analytics/page.tsx:84-89` — la server action POSTe vers `${SITE_URL}/api/indexnow` avec pour seuls headers `content-type` ; or `src/app/api/indexnow/route.ts:60-66` exige `x-axion-indexnow-signature` (HMAC SHA-256) et renvoie 401 sinon. Grep repo entier : **aucun code ne calcule jamais cette signature** — la route n'a aucun caller capable de la franchir.
  2. Même signée, `route.ts:24` + `86` ne poste que vers `https://api.indexnow.org/indexnow` (endpoint unique, pas la cascade SSOT) → 403 Microsoft garanti à l'étape suivante.
- **Preuve live** : non testable en audit-only (POST prod interdit par les règles). La logique est entièrement statique et certaine ; le message UI en cas d'échec (« HTTP 401 — vérifier logs serveur ») est cohérent avec ce diagnostic. `[À CONFIRMER]` en prod par un clic de Will sur le bouton (résultat attendu : HTTP 401).
- **Root-cause** : la migration 2026-05-13 vers le helper direct `pingIndexNow` (cf. `admin-blog/actions.ts:348-351`) a été faite pour le blog mais PAS pour la server action analytics, restée sur l'ancien round-trip HTTP ; le hardening HMAC P0-S1-5 (2026-05-16) a ensuite verrouillé la porte sans mettre à jour l'unique caller.
- **Patch prescrit** : dans `pingIndexNowAction` (analytics/page.tsx:66), remplacer le `fetch(/api/indexnow)` par un appel direct à `submitToIndexNow(host, key, urlList)` (await, pour rendre un statut réel à l'UI) — supprime round-trip, HMAC et mono-endpoint d'un coup. Mettre à jour le texte de `_v2/AnalyticsV2.tsx:171-178` qui documente « POST /api/indexnow ». Statuer sur `/api/indexnow` : soit le brancher sur la cascade, soit le supprimer (aucun caller légitime restant).
- **Effort** : S. **Impact GEO/AEO** : moyen (outil de re-notification manuelle des hubs — inopérant depuis ~3 mois sans que personne ne le voie).
- **Risque de régression** : quasi nul (chemin déjà mort). **Do-not-touch** : la vérification HMAC elle-même si la route est conservée (protection anti-spam de NOTRE clé), `src/proxy.ts` (matcher `.txt`).

### [P1] Communiqués de presse : aucune notification aux moteurs à la publication

- **Symptôme** : publier/mettre à jour/dépublier un communiqué ne déclenche AUCUN ping (ni IndexNow, ni Google) — seule la revalidation Next est faite. La découverte repose sur le crawl passif + le cron J+1.
- **Preuve code** : `src/server/actions/press/releases.ts` — grep `pingIndexNow|enqueueIndexing` : **0 occurrence** ; seules occurrences : `revalidatePath("/fr/presse")` (lignes 164-165, appelée aux lignes 228, 348, 384, 427, 498, 531). Idem `media-coverage.actions.ts:52-53` (retombées presse). À comparer : FAQ (`admin-faq/actions.ts:31-33`), avis (`admin-reviews/actions.ts:171-177`), cas concrets (`admin-case-studies/actions.ts:303`), centre-aide (`admin-help/actions.ts:259`) pingent tous.
- **Preuve live** (17:52:25 UTC) : `sitemap-presse.xml` = 1 URL, lastmod `2026-07-14` → le filet de sécurité `daily-indexnow-resubmit` (fenêtre J-7) ne re-soumet la presse QUE si une publication rafraîchit le lastmod, avec jusqu'à ~26 h de latence (cron 02:00 UTC exécuté ~04:05).
- **Root-cause** : le module presse a été construit sur le gabarit revalidation sans reprendre le volet indexation des autres features admin.
- **Patch prescrit** : dans `releases.ts`, appeler `pingIndexNow([SITE_URL + "/fr/presse", SITE_URL + "/fr/presse/" + slug], "presse:" + event)` aux transitions publish/update/unpublish (fire-and-forget, pattern FAQ). Étendre aux retombées si elles ont des URLs publiques propres.
- **Effort** : S. **Impact GEO/AEO** : moyen (les communiqués sont un levier notoriété/citation IA time-sensitive ; 1 seul communiqué à ce jour → impact surtout futur).
- **Risque de régression** : quasi nul (helper éprouvé, jamais bloquant). **Do-not-touch** : l'isolation-check CI (utiliser `@/lib/indexnow` comme la FAQ, PAS le helper du pipeline content-gen — cf. commentaire `admin-faq/actions.ts:27-29`).

### [P2] Workflow `indexnow-images.yml` : mono-endpoints Microsoft morts + soumission d'URLs de sitemaps hors-spec

- **Symptôme** : le workflow manuel de ping des sitemaps images ne parle qu'à `api.indexnow.org` et `www.bing.com/indexnow` — les deux endpoints Microsoft qui 403ent le domaine → dispatch sans aucun effet, avec verdict « success » (le non-200 n'émet qu'un `::warning`).
- **Preuve code** : `.github/workflows/indexnow-images.yml:121-136` (2 curl Microsoft, pas de cascade Yandex/Naver) ; lignes 104-107 : soumet des URLs `\*.xml` de sitemaps — IndexNow attend des URLs de PAGES, les sitemaps sont ignorés.
- **Preuve live** (17:52:43 UTC) : dernier run 2026-05-20 09:21 UTC, conclusion `success` — antérieur à la découverte du 403 (2026-08-11), donc probablement déjà dans le vide.
- **Root-cause** : workflow écrit avant la découverte du 403 et jamais migré sur le SSOT cascade.
- **Patch prescrit** : soit le supprimer (le job post-deploy couvre déjà les 289 URLs galerie via repli sitemap — prouvé au log 14:47:38 UTC), soit le réécrire en 5 lignes appelant `scripts/indexnow-ping.ts`. **Ne pas** y remettre d'URLs `.xml`.
- **Effort** : S. **Impact** : faible (manuel, redondant). **Risque** : nul. **Do-not-touch** : la lecture de la clé via SSH container (pattern réutilisable).

### [P2] `daily-indexnow-resubmit` muet sur échec partiel : le 403 Microsoft est invisible dans les runs quotidiens verts

- **Symptôme** : le cron log seulement l'endpoint qui a accepté ; l'échec `api.indexnow.org` n'apparaît nulle part → un lecteur des runs quotidiens croit l'agrégateur revenu.
- **Preuve code** : `scripts/daily-indexnow-resubmit.ts:129-140` — `pingBatch` ne warn que si `!result.accepted` ; contraste : `scripts/indexnow-ping.ts:107-110` filtre `result.attempts` et annote les refus même en cas de succès global.
- **Preuve live** : run 31768771942 (04:05 UTC aujourd'hui) : aucun `::warning` alors que l'agrégateur a nécessairement refusé (Yandex = 2e de cascade).
- **Patch prescrit** : recopier le bloc `refus` de `indexnow-ping.ts:107-110` dans `pingBatch`. **Effort** : S. **Impact** : faible (observabilité). **Risque** : nul.

### [P2] Pings d'URLs `/en/*` alors que EN est désactivé (301) — help avec en prime un chemin EN faux

- **Symptôme** : trois features admin soumettent des URLs EN qui répondent 301 vers FR → pings gaspillés, signal « redirect » envoyé aux moteurs. Conforme à la décision 1 (site FR only) de LES RETIRER, pas d'en faire plus.
- **Preuve code** : `admin-help/actions.ts:262` (`/en/help/${slug}` — de surcroît incohérent avec le chemin revalidé `/en/help-center` ligne 254), `admin-case-studies/actions.ts:306` (`/en/case-studies/...`), `admin-blog/actions.ts:355+368+444` (locale `en` incluse). À comparer : `scripts/indexnow-ping.ts:77-78` gate proprement sur `EN_LOCALE_ENABLED`, `admin-job-offers` et `admin-faq` sont FR-only.
- **Preuve live** : proxy 301 `/en/*` → `/fr/*` documenté AGENTS.md + vérifié par A1/G-squad ; non re-mesuré ici.
- **Patch prescrit** : filtrer les URLs EN derrière `process.env.EN_LOCALE_ENABLED === "true"` dans ces 3 fichiers (pattern `indexnow-ping.ts:77`). **Effort** : S. **Impact** : faible. **Risque** : nul. **Do-not-touch** : `routing.ts`, `messages/en.json` (contrat de réactivation EN).

### [P2] `check-prod-env.sh` vérifie une variable Google Indexing obsolète

- **Symptôme** : le contrôle d'env prod exige `GOOGLE_INDEXING_SA_JSON` (service account V1) alors que le client réel utilise le flux OAuth (`INDEXING_OAUTH_REFRESH_TOKEN` + `GSC_OAUTH_CLIENT_*`) → le check peut être vert avec un credential réel absent (ou rouge sur une var qui ne sert plus).
- **Preuve code** : `scripts/content-gen/check-prod-env.sh:38-39` vs `src/server/content-gen/seo/indexing-client.ts:41-49` et `content-google-indexing-worker.ts:42-47`.
- **Preuve live** : non vérifiable (SSH refusé par le classifier de permissions pendant cet audit) — `[À CONFIRMER]` côté valeurs prod réelles.
- **Patch prescrit** : remplacer `GOOGLE_INDEXING_SA_JSON` par `INDEXING_OAUTH_REFRESH_TOKEN` dans la liste du script. **Effort** : S. **Impact** : faible. **Risque** : nul.

### [P2] Dédup BullMQ par `jobId` : un re-update rapproché de la même entité peut être silencieusement avalé

- **Symptôme** : `enqueueIndexingForUrls` utilise `jobId = indexnow-${entityId}-${event}` ; deux « update » successifs de la même entrée KB dans la fenêtre de rétention (1 000 jobs completed conservés) → le 2e add est ignoré par BullMQ, le ping de la 2e édition n'est jamais émis.
- **Preuve code** : `src/server/content-gen/indexing/enqueue.ts:191` (jobId sans composant temporel) + `content-indexnow-worker.ts:144` (`removeOnComplete: { count: 1000 }` — le job complété persiste longtemps à faible volume).
- **Preuve live** : non reproductible en read-only → `[À CONFIRMER]` (comportement BullMQ documenté : add avec jobId existant = no-op).
- **Patch prescrit** : suffixer le jobId d'un bucket temporel (ex. `-${Date.now() / 3600000 | 0}`) pour les events `update` uniquement (conserver la dédup stricte sur publish/delete). **Effort** : S. **Impact** : faible. **Risque** : faible (attention à ne pas casser `enqueue.spec.ts` qui teste les jobIds).

### [P2] [À CONFIRMER] État d'activation réel de la Google Indexing API en prod (Google for Jobs)

- **Symptôme potentiel** : `enqueueGoogleIndexingForUrls` (offres d'emploi = seul usage conforme ToS) est un no-op complet si `GOOGLE_INDEXING_API_ENABLED !== "true"` (`enqueue.ts:253-255`), et le worker skip si `INDEXING_OAUTH_REFRESH_TOKEN` absent (`content-google-indexing-worker.ts:42-47`). Si ces vars ne sont pas posées en prod, les 55 offres de `sitemap-carrieres.xml` ne bénéficient d'aucun push Google for Jobs.
- **Preuve code** : gating ci-dessus ; workers bien démarrés (`src/server/queue/worker.ts:102-103`).
- **Preuve live** : SSH refusé pendant l'audit → impossible de lire l'env du container. À vérifier par Will/session principale : `ssh axion-prod` puis `docker exec <ctr> printenv | grep -E "GOOGLE_INDEXING|INDEXING_OAUTH"`, et logs worker `grep google-indexing`.
- **Patch éventuel** : poser les vars (Coolify scope RUN) si absentes — aucune modification de code.

## Mesures brutes

### Live prod (GET only)

| Mesure (UTC 2026-08-14) | Résultat |
|---|---|
| 17:52:16 — `GET /3a5c32d22b04f1430690cc33eaec6be9.txt` | 200, text/plain, 32 octets (conforme — non re-diagnostiqué, décision 11) |
| 17:52:16 — `GET /sitemap-index.xml` | 38 sub-sitemaps déclarés |
| 17:52:25 — lastmod par sub-sitemap (échantillon 12) | pages 85/85, faq 97/97, villes-IDF 177/177, blog 134/134, presse 1/1 (2026-07-14), avis 103/103, carrières 55/55, knowledge 507/507, recrutement 3/3, glossaire 1/1, guides 1/1, images-fr 289 loc / 288 lastmod → **le cron resubmit a partout la matière lastmod dont il dépend** |

### GitHub Actions (lecture)

| Mesure (UTC) | Résultat |
|---|---|
| 17:52:43 — `daily-indexnow-resubmit.yml`, 8 derniers runs | 8/8 success, quotidien (04:05, 04:08, 04:04, 03:40, 03:51, 03:39, 03:22, 04:23) |
| Run 31768771942 (2026-08-14 04:05) | `discovered 1061 URLs lastmod ≥ J-7` → `1000 URLs acceptées par yandex.com` + `61 URLs acceptées par yandex.com` ; aucun warning sur l'échec agrégateur |
| Run deploy 31807073238 (dernier stable, 13:56→14:47) | postbuild Docker : `[indexnow-ping] skipped — INDEXNOW_KEY … not set` (attendu, ADR 0026) ; job post-deploy : DB indispo → **repli sitemap images : 289 URLs** ; `OK — 907 URLs acceptées par yandex.com` ; `##[warning] api.indexnow.org → 403 Forbidden UserForbiddedToAccessSite` (14:47:40) |
| `indexnow-images.yml` | dernier run 2026-05-20 09:21, success (manuel, endpoints Microsoft uniquement) |
| Déploiement en vol | run 31824504716 parti 17:33 UTC, in_progress pendant les mesures |

### Cartographie déclencheur → ping (état du code, branche auditée)

| Surface publiée | IndexNow | Google Indexing | Fichier:ligne |
|---|---|---|---|
| Blog admin (publish/update/slug-change/archive) | ✅ (+delete anciens slugs) | ✅ si double opt-in articles | `admin-blog/actions.ts:354,372,446` |
| Articles factory tier-1 (publish worker) | ✅ queue | ✅ si double opt-in | `content-publish-worker.ts:1027` |
| Promote/demote tier (lifecycle) | ✅ (demote=URL_UPDATED, anti-yoyo) | idem | `content-tier-lifecycle-worker.ts:63,88` |
| News expirées (lifecycle delete) | ✅ | ✅ URL_DELETED | `content-news-lifecycle-worker.ts:93` |
| KB/connaissances (publish/update/delete) | ✅ FR+EN | ✅ si opt-in | `knowledge/_transition.ts:167`, `update-entry.ts:158`, `delete-entry.ts:96` |
| FAQ (publish/archive) | ✅ détail seul | — | `admin-faq/actions.ts:31-33` |
| Centre-aide | ✅ (mais URL EN fausse) | — | `admin-help/actions.ts:259-265` |
| Cas concrets | ✅ FR+EN | — | `admin-case-studies/actions.ts:303-309` |
| Avis clients (modération) | ✅ riche (hub, ville, dépt, secteur, service) | — | `admin-reviews/actions.ts:150-177` |
| Offres d'emploi | ✅ sync | ✅ JobPosting si master flag (guard indexable) | `admin-job-offers/actions.ts:41-56` |
| Image-bank (publication image) | ✅ queue | — | `image-bank.service.ts:180-183` |
| Villes (cohorte drip indexable) | ✅ post-deploy job (+ services × villes) | — | `scripts/indexnow-ping.ts:142-181` |
| **Presse (communiqués + retombées)** | ❌ | ❌ | `press/releases.ts` (revalidate only) |
| Statiques (glossaire, guides, comparaisons, secteurs…) | via cron resubmit si lastmod ≤ J-7 | — | `daily-indexnow-resubmit.ts:94-122` |

## Limites

- **SSH prod refusé** par le classifier de permissions pendant cette session → impossible de vérifier les env vars runtime (`GOOGLE_INDEXING_API_ENABLED`, `INDEXING_OAUTH_REFRESH_TOKEN`, `BING_WMT_API_KEY`, `INDEXNOW_INTERNAL_HMAC_SECRET`) et les logs des workers BullMQ en prod. Deux findings marqués `[À CONFIRMER]` en dépendent.
- **POST interdits** (règle audit-only) → le 401 du bouton admin et le comportement de `/api/indexnow` sont prouvés par lecture statique seulement.
- **Réception effective côté Bing non mesurable** sans Bing Webmaster Tools (accès Will) : l'affirmation « Bing sourd » est une inférence forte (agrégateur 403 + doc interne 2026-08-11 « l'agrégateur ne relayant rien quand il refuse »), pas une mesure directe d'indexation Bing.
- **Fraîcheur du lastmod des villes drip** (le cron resubmit n'attrape une ville nouvellement indexable que si son lastmod sitemap est ≤ J-7) : la véracité des lastmod relève de A2/D4, non re-vérifiée ici.
- Worktrees `../axionia-wt-indexnow` non audités (consigne : auditer main + prod) — signalés en Phase 0.

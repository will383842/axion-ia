# F2 — GSC & Bing read-only

Date : 2026-08-14, mesures 18:30–18:35 UTC (déploiement GH Actions en vol depuis 17:33 UTC — aucune mesure DB-driven n'a été interprétée pendant la fenêtre).

**Périmètre réellement couvert** : évolution Performances GSC W28→W33 (via les exports hebdo automatiques `_AUDIT/crawl-stats-2026-W*.csv`, générés par l'API GSC), santé de la chaîne de soumission sitemaps GSC (3 workflows GH), clients GSC/Bing du code et leurs consommateurs, résidus d'index (www/EN/paramètres) vérifiés live, comparaison chiffrée à l'audit du 2026-07-31.
**Non couvert (voir Limites)** : buckets de couverture GSC (indexées/découvertes/explorées non indexées/exclues), liste des sitemaps *soumis* côté GSC, enhancements (FAQ/étoiles/jobs/breadcrumbs), top 50 requêtes — l'accès API GSC exige des credentials qui n'existent qu'en prod/GH secrets, et le SSH prod a été refusé par le système de permissions de cette session.

## Résumé exécutif

1. **PIRE que le 31/07, et de façon continue** : W31→W33, la position moyenne pondérée passe de **22,2 → 25,5**, les clics de **19 → 13**, le CTR de **2,36 % → 0,86 %** (÷2,7), pendant que les pages avec impressions montent de 196 → 268 et les impressions de 805 → 1 515. La dilution diagnostiquée le 31/07 n'est pas enrayée : **50 % des impressions W33 tombent sur des positions > 20**, et le churn est massif (113 des 196 pages de W31 ont disparu des impressions, 185 nouvelles apparues).
2. La home `/fr` elle-même recule : position 3,10 → 6,25, clics 10 → 6 en 2 semaines.
3. **Toute la chaîne de soumission GSC échoue en silence** : le workflow hebdo de re-soumission du sitemap principal est en échec **100 % (0 succès sur 40 runs, depuis au moins le 22/06)** — token OAuth au scope `readonly` (HTTP 403 « insufficient authentication scopes ») ; les 4 sitemaps images n'ont **jamais** été soumis (3 échecs le 20/05, jamais relancé, pas de cron).
4. **Bing = angle mort total** : le client `bing-wmt-client.ts` n'a **zéro consommateur**, `BING_WMT_API_KEY` n'est posée nulle part ; aucune donnée Bing n'est mesurable (le probe `site:` Bing renvoie une page anti-bot).
5. Le seul élément vert : l'export hebdo Performances GSC (cron lundi) tourne fidèlement depuis juin — c'est lui qui permet le chiffrage ci-dessus.

## Findings

### [P0] Le drainage de visibilité diagnostiqué le 31/07 continue sans inflexion — position 22,2 → 25,5, clics ÷1,5, CTR ÷2,7 en 2 semaines

- **Symptôme** : l'audit du 31/07 concluait « dilution qualité/volume, position moyenne 22,2, CTR 2,36 % ». Deux semaines plus tard (W33 = fenêtre 03–10/08), **aucune** métrique ne s'est retournée : position 25,5, 13 clics/semaine sur tout le domaine, CTR 0,86 %. Les impressions croissent (1 515) mais sur des positions stériles (765 imp. sur pos > 20). Le churn W31→W33 (113 pages disparues / 185 nouvelles / 83 stables) reproduit exactement le cycle « publication → indexation → déclassement » décrit le 31/07.
- **Preuve code** : pipeline de données `scripts/perf/export-gsc-crawl-stats.mjs:93-118` (query `searchAnalytics`, `dimensions:["page"]`, fenêtre 7 j, `dataState:"all"`) — les CSV sont donc bien des données GSC authentiques, commit hebdo automatique (`.github/workflows/gsc-crawl-stats-weekly.yml:29`, commits `61609e14` du 03/08 et `38311497` du 10/08).
- **Preuve live (horodatée)** : agrégats calculés le 2026-08-14 ~18:20 UTC sur `_AUDIT/crawl-stats-2026-W31.csv` / `-W32.csv` / `-W33.csv` — tableau complet en § Mesures brutes. Home `/fr` : W31 pos 3,10 / 10 clics → W33 pos 6,25 / 6 clics.
- **Root-cause** : pas une nouvelle panne — la remédiation P1 du 31/07 (« qualité avant volume », lastmod vivant, instrumentation des rétrogradations de tiers) n'a pas encore produit d'effet mesurable ; les familles industrialisées dominent toujours les impressions à des positions 20-60 (implantations 481 imp/pos 22, sites-web-augmentés 196 imp/pos 39,6, hub `/fr/formations` pos 42,4, hub `/fr/un-a-un` pos 42,7).
- **Patch prescrit** : ne PAS relancer la génération en volume (règle déjà actée le 31/07 : tant que la position moyenne des nouvelles pages est > 15) ; exécuter les P1 restants du 31/07 (lastmod vivant, instrumentation tiers) ; ajouter au rituel hebdo la lecture des agrégats du CSV (3 lignes d'awk) pour que la courbe soit VUE — aujourd'hui les CSV s'accumulent sans lecteur.
- **Effort** : S (lecture/rituel) — les patchs de fond sont portés par les autres squads.
- **Impact GEO/AEO** : fort (la visibilité Google est l'entrée de l'AEO : AI Overviews et assistants passent par l'index Google/Bing).
- **Risque de régression** : nul (aucun code touché). Do-not-touch : `scripts/perf/export-gsc-crawl-stats.mjs` (il fonctionne), cap villes 480 (décision actée), seuils du juge.

### [P1] Chaîne de soumission GSC morte : token OAuth `readonly` → 0/40 succès depuis ≥ 22/06 (sitemap principal), sitemaps images jamais soumis

- **Symptôme** : le workflow hebdo `GSC · Submit main sitemap` (créé pour combler « le trou identifié par l'audit indexation 2026-06-20 » — domaine jeune sans backlinks) échoue à chaque exécution ; celui des 4 sitemaps images a échoué 3 fois le 20/05/2026 puis n'a plus jamais été lancé (aucun `schedule`, dispatch-only).
- **Preuve code** : `.github/workflows/gsc-submit-main-sitemap.yml:9-11` (avertissement explicite « le REFRESH_TOKEN doit avoir le scope 'webmasters' (write), PAS 'webmasters.readonly' (sinon HTTP 403) ») et `:29` (cron lundi 06:12) ; workflow de remédiation déjà écrit : `.github/workflows/gsc-oauth-refresh-write.yml` (2 passes generate/exchange, jamais mené à terme).
- **Preuve live (horodatée)** : `gh run list` 2026-08-14 ~18:38 UTC — 8 derniers runs schedule du 22/06 au 10/08 : **tous `failure`**, 0 succès sur les 40 derniers ; log du run 31368273042 (10/08 08:01 UTC) : `HTTP add: 403` + `"message": "Request had insufficient authentication scopes."`. Runs images : 3 × `failure` le 2026-05-20, rien depuis.
- **Root-cause** : le secret GH `GSC_OAUTH_REFRESH_TOKEN` a été généré avec le scope `webmasters.readonly` (suffisant pour l'export Performances, qui marche) ; la soumission de sitemap exige le scope write. La régénération en 2 passes (`gsc-oauth-refresh-write.yml`) requiert une action humaine (visite d'URL Google) qui n'a jamais été faite.
- **Patch prescrit** : (reste Will, ~10 min) lancer `gsc-oauth-refresh-write.yml` en mode `generate`, visiter l'URL, relancer en mode `exchange` avec le code ; puis déclencher manuellement `gsc-submit-main-sitemap.yml` et `gsc-submit-image-sitemaps.yml` et vérifier 2 runs verts. Optionnel : ajouter un cron au workflow images + y inclure `sitemap-images-blog.xml` et `sitemaps/images-fr.xml` (aujourd'hui seuls 4 sitemaps images sur 6 sont dans la liste de soumission).
- **Effort** : S.
- **Impact GEO/AEO** : moyen-fort — le sitemap-index reste découvrable (robots.txt + soumission manuelle initiale de mai, Google re-crawle les sitemaps déjà soumis), donc pas de « visibilité cassée » ; mais la re-soumission hebdo qui devait accélérer la découverte des nouvelles URLs n'a jamais existé, et les sitemaps images n'ont probablement jamais été poussés côté GSC (croiser avec E4).
- **Risque de régression** : quasi nul — le scope write inclut le read (l'export hebdo continuera de marcher). Do-not-touch : `scripts/perf/export-gsc-crawl-stats.mjs`, `src/server/content-gen/seo/gsc-client.ts` (le flux OAuth runtime prod est distinct — secrets Coolify — et sert les workers keyword-sync/tier-lifecycle ; ne pas le modifier), clé IndexNow (décision actée n°11).

### [P1] Bing : observabilité zéro — client API jamais branché, clé absente, aucune donnée mesurable

- **Symptôme** : impossible de répondre à « couverture Bing » : aucune donnée Bing Webmaster n'entre dans le système. Bing nourrit Copilot et ChatGPT search — c'est un pilier GEO sans aucun instrument de mesure.
- **Preuve code** : `src/server/content-gen/seo/bing-wmt-client.ts:61-62` (skip silencieux si `BING_WMT_API_KEY` absent) ; **zéro consommateur** : grep `bingWmt|bing-wmt-client` sur `src/**` ne renvoie que le fichier lui-même et `gsc-client.ts` (commentaire) — les 3 fonctions read-only (`GetCrawlStats`, `GetUrlInfo`, `GetUrlSubmissionQuota`) ne sont appelées nulle part ; `.env.example:353` : `BING_WMT_API_KEY=` (vide), absente de `.env.production.example`.
- **Preuve live (horodatée)** : probe `site:axion-ia.com` sur Bing (WebFetch, 2026-08-14 ~18:36 UTC) : page anti-bot (résultats speedtest.net) — inexploitable, confirmant qu'aucun canal fiable de lecture Bing n'existe dans l'outillage actuel. (Le compte Bing Webmaster existe côté Will — cf. ticket UCM000007450870 déjà acté, non ré-ouvert ici.)
- **Root-cause** : le client a été écrit en P2-30 (audit 2026-05-18) mais jamais câblé ni approvisionné en clé ; IndexNow couvre la *soumission* Bing (surface A6) mais rien ne lit jamais l'état d'indexation en retour.
- **Patch prescrit** : (1) Will : générer la clé API dans Bing Webmaster Tools → poser `BING_WMT_API_KEY` en GH secret (et Coolify si usage runtime souhaité) ; (2) ajouter un step au workflow hebdo existant `gsc-crawl-stats-weekly.yml` qui appelle `GetCrawlStats` + `GetUrlSubmissionQuota` et committe un `bing-stats-YYYY-WW.csv` (réutiliser le pattern fail-soft du script GSC).
- **Effort** : S (clé) + S/M (export ~60 lignes).
- **Impact GEO/AEO** : fort (Copilot/ChatGPT grounding = Bing ; on pilote aujourd'hui à l'aveugle).
- **Risque de régression** : nul (nouveau step read-only, fail-soft). Do-not-touch : `src/lib/indexnow.ts` (clé irréprochable, décision actée n°11), doctrine « pas de SubmitUrl Bing » (IndexNow couvre déjà — commentaire `bing-wmt-client.ts:11-16`).

### [P1] Monitoring d'indexation inexistant malgré deux artefacts de code qui le promettent (HCU-monitor stub + URL Inspection jamais appelée)

- **Symptôme** : personne ne détectera une vague de désindexation (le scénario exact vécu en juillet : HTTPS 98 → 4). Le worker « GSC HCU monitoring quotidien » existe mais est un squelette qui renvoie des zéros ; le client URL Inspection (verdict/coverageState/richResults par URL, quota 2 000/j) existe mais n'a aucun appelant.
- **Preuve code** : `src/server/queue/workers/gsc-hcu-monitor-worker.ts:42-62` (« V1 stub : retourne 0/0 sans appel GSC réel », même quand `GSC_HCU_MONITOR_ENABLED=true`) ; `src/server/content-gen/seo/gsc-client.ts:326` (`gscInspectUrl`) — grep : zéro consommateur hors tests. Seul le `site-route-gsc-worker.ts:75` consomme réellement l'API (métriques Performances par URL, 400 URLs/nuit), pas la couverture.
- **Preuve live** : n/a (surface non déployée par construction — le stub renvoie des zéros ; marquer **[À CONFIRMER]** l'état du flag `GSC_HCU_MONITOR_ENABLED` en prod, non lisible sans SSH).
- **Root-cause** : intégration « reportée Sessions 10+ » (commentaire du worker) jamais reprise.
- **Patch prescrit** : implémenter le corps réel du monitor : échantillon quotidien de N URLs stratégiques via `gscInspectUrl` (déjà écrit, quota large) + delta `coverageState` jour-1 → alerte Telegram/Sentry au seuil 5 % déjà prévu (`DEINDEX_THRESHOLD_PCT`, ligne 35). Réutiliser la rotation par ancienneté du `site-route-gsc-worker`.
- **Effort** : M.
- **Impact GEO/AEO** : moyen (observabilité ; aurait détecté le drainage de juillet en jours au lieu de semaines).
- **Risque de régression** : faible — worker isolé derrière flag OFF ; do-not-touch : `site-route-gsc-worker.ts` (fonctionne ; partager le quota 2 000/j : le monitor doit rester ≤ ~400 req/j pour ne pas l'affamer).

### [P2] Export hebdo « crawl-stats » mal nommé et header mensonger (ce sont des Performances, pas des crawl stats)

- **Symptôme** : les fichiers `_AUDIT/crawl-stats-*.csv` ne contiennent PAS de crawl stats (ratio crawl, types de fichiers, codes HTTP promis par le header du script) mais les Performances search par page. Tout futur auditeur (ou agent) part sur une fausse piste.
- **Preuve code** : `scripts/perf/export-gsc-crawl-stats.mjs:5-9` (promet « ratio crawl Googlebot… types de fichiers… codes HTTP ») vs `:108` (`dimensions: ["page"]` sur `searchAnalytics` = Performances). L'API GSC n'expose d'ailleurs pas les crawl stats (rapport UI uniquement).
- **Preuve live** : contenu des CSV (en-tête `page,impressions,clicks,ctr,position`), constaté 2026-08-14.
- **Root-cause** : ambition initiale (P2-28) réduite à ce que l'API permet, sans renommer.
- **Patch** : renommer en `search-perf-YYYY-WW.csv` (ou corriger le header du script + README) — attention à conserver l'historique W21-W33 (renommage git des anciens fichiers ou note de continuité).
- **Effort** : S. **Impact** : faible (hygiène). **Risque** : nul ; do-not-touch : la logique d'export elle-même.

### [P2] Résidus d'index www / EN / URLs à paramètres qui captent encore des impressions — redirections vérifiées saines, auto-résorption

- **Symptôme** : W32-W33, GSC crédite encore des impressions à `https://www.axion-ia.com/presse` (10 imp W32, 6 W33, pos ~12), `https://axion-ia.com/carrieres?workMode=remote` (8 → 22 imp, pos ~5), `https://axion-ia.com/en/implementation/by-city/nancy` (1 imp) et `https://www.axion-ia.com/fr/implantations/...` (2 URLs). Confirme que la propriété GSC (sc-domain) agrège le www — réponse à la question « www propriété séparée ? » du reste-Will 31/07 : non, même propriété, simple résidu.
- **Preuve code** : n/a (redirections gérées par l'edge/proxy — surface A/G).
- **Preuve live (2026-08-14 18:32 UTC)** : `www.axion-ia.com/presse` → 301 apex (1 hop) ; `www./fr/implantations/...bagnolet` → 301 apex ; `/carrieres?workMode=remote` → 301 `/fr/carrieres?workMode=remote` ; `/en/implementation/by-city/nancy` → 301 `/fr/implementation/par-ville/nancy` ; `/fr/carrieres?workMode=remote` → 200 avec `<link rel="canonical" href="https://axion-ia.com/fr/carrieres"/>` et `robots index,follow` (18:32 UTC). Tout est propre.
- **Root-cause** : inertie d'index Google sur des URLs historiques 301 — aucune anomalie applicative.
- **Patch** : rien côté code. Option GSC UI (Will, avec les autres actions GSC) : marquer résolus les résidus /en/* (déjà prévu AGENTS.md après ≥ 4 semaines de 301 — échéance atteinte ~13/06, jamais fait).
- **Effort** : S. **Impact** : faible. **Risque** : nul. Do-not-touch : `src/proxy.ts` (redirect EN→FR), redirections www (fonctionnent en 1 hop).

### [P2] Sitemaps images : la liste de soumission API n'en couvre que 4 sur 6

- **Symptôme** : même une fois le token réparé (P1 ci-dessus), le workflow images ne soumettrait que `sitemap-images-services.xml` + 3 `villes-t*`, en omettant `sitemap-images-blog.xml` et `sitemaps/images-fr.xml`, pourtant présents dans le sitemap-index live.
- **Preuve code** : `.github/workflows/gsc-submit-image-sitemaps.yml` (liste en dur de 4 URLs, pas de `schedule`).
- **Preuve live (2026-08-14 18:33 UTC)** : `sitemap-index.xml` prod liste 38 sous-sitemaps dont 6 sitemaps images (5 `sitemap-images-*` + `sitemaps/images-fr.xml`) ; `images-en.xml` absent de l'index = gate EN normal (décision actée).
- **Root-cause** : `sitemap-images-blog.xml` créé après l'écriture du workflow (mai).
- **Patch** : ajouter les 2 URLs manquantes à la liste + un cron mensuel ; à faire dans le même geste que la réparation du token.
- **Effort** : S. **Impact** : faible-moyen (Google découvre déjà via l'index). **Risque** : nul. Do-not-touch : gate `images-en.xml` (décision actée).

## Mesures brutes

### Performances GSC hebdo (source : exports API GSC `_AUDIT/crawl-stats-2026-W*.csv`, agrégats calculés 2026-08-14 ~18:20 UTC)

| Sem. (fenêtre) | Pages avec imp. | Impressions | Clics | Position pondérée | CTR |
|---|---:|---:|---:|---:|---:|
| W28 | 102 | 808 | 21 | 13,1 | 2,60 % |
| W29 | 191 | 1 270 | 27 | 15,8 | 2,13 % |
| W30 | 126 | 776 | 27 | 17,8 | 3,48 % |
| W31 (≈ 20–27/07) | 196 | 805 | 19 | 22,2 | 2,36 % |
| **W32 (≈ 27/07–03/08)** | **249** | **1 292** | **14** | **25,3** | **1,08 %** |
| **W33 (≈ 03–10/08)** | **268** | **1 515** | **13** | **25,5** | **0,86 %** |

Churn W31→W33 : 113 pages disparues des impressions, 185 nouvelles, 83 communes. W33 : 101/268 pages à position > 20, portant 765/1 515 impressions (50 %).

### W33 par famille (impressions décroissantes)

| Famille | Pages | Imp. | Clics | Pos. pondérée |
|---|---:|---:|---:|---:|
| implantations | 117 | 481 | 1 | 22,1 |
| autre (home, hubs, légal…) | 31 | 289 | 7 | 27,7 |
| sites-web-augmentés | 22 | 196 | 0 | 39,6 |
| blog | 14 | 193 | 0 | 14,7 |
| services par-ville | 23 | 104 | 0 | 32,4 |
| faq | 15 | 78 | 0 | 23,9 |
| carrières | 7 | 48 | 2 | 15,3 |
| centre-aide | 4 | 46 | 0 | 46,8 |
| galerie | 14 | 36 | 0 | 19,1 |
| actualités | 7 | 16 | 1 | 7,9 |
| avis | 6 | 12 | 1 | 17,2 |
| secteurs | 6 | 9 | 1 | 12,0 |
| résidu www | 1 | 6 | 0 | 12,3 |
| résidu EN | 1 | 1 | 0 | 9,0 |

Pages stratégiques notables W33 : `/fr` 60 imp / 6 clics / pos 6,25 (vs 3,10 en W31) ; `/fr/formations` 41 imp pos 42,4 ; `/fr/un-a-un` 63 imp pos 42,7 ; `/fr/sites-web-augmentes` 59 imp pos 58,7. Les 13 clics W33 : `/fr` (6), `/fr/carrieres/data-engineer` (2), actualité (1), `/fr/avis` (1), implantation Voiron (1), mentions légales (1), secteur collectivités (1) — zéro clic sur toutes les familles pSEO commerciales.

### Workflows GSC (gh run list, 2026-08-14 ~18:38 UTC)

| Workflow | Cron | Derniers runs | État |
|---|---|---|---|
| `gsc-crawl-stats-weekly.yml` | lundi 08:00 UTC | 27/07, 03/08, 10/08 | ✅ success (17-22 s), commits hebdo réguliers depuis W26 |
| `gsc-submit-main-sitemap.yml` | lundi 06:12 UTC | 22/06 → 10/08 (8 runs schedule) | ❌ failure 100 %, 0/40 succès — 403 « insufficient authentication scopes » |
| `gsc-submit-image-sitemaps.yml` | aucun (dispatch-only) | 3 × 20/05/2026 | ❌ failure, jamais relancé depuis |
| `gsc-oauth-refresh-write.yml` | dispatch 2 passes | — | jamais mené à terme (le token est resté readonly) |

### Contrôles live prod (GET, 1 hop chacun)

| URL | Heure UTC | Résultat |
|---|---|---|
| `https://www.axion-ia.com/presse` | 18:32 | 301 → apex |
| `https://www.axion-ia.com/fr/implantations/ile-de-france/bagnolet` | 18:32 | 301 → apex |
| `https://axion-ia.com/carrieres?workMode=remote` | 18:32 | 301 → `/fr/carrieres?workMode=remote` |
| `https://axion-ia.com/en/implementation/by-city/nancy` | 18:32 | 301 → `/fr/implementation/par-ville/nancy` |
| `https://axion-ia.com/fr/carrieres?workMode=remote` | 18:32 | 200, canonical `/fr/carrieres`, robots index,follow |
| `https://axion-ia.com/sitemap-index.xml` | 18:33 | 200, **38 sous-sitemaps** (vs 37 le 31/07 ; `sitemap-knowledge.xml` présent, `news.xml` absent = gate 48 h normal) |

### Probes moteurs (best-effort)

- Bing `site:axion-ia.com` (WebFetch, ~18:36 UTC) : page anti-bot (résultats speedtest.net, « ~56 results » non fiable) — **inexploitable**.
- WebSearch `site:axion-ia.com` (~18:37 UTC) : le domaine ressort avec pages FR variées ([home](https://axion-ia.com/fr), [sites-web-augmentés](https://axion-ia.com/fr/sites-web-augmentes), [transparence](https://axion-ia.com/fr/transparence), [implantations/guadeloupe](https://axion-ia.com/fr/implantations/guadeloupe), [carrières](https://axion-ia.com/fr/carrieres/business-developer-ia), [FAQ](https://axion-ia.com/fr/faq/par-thematique/general), [Olivet](https://axion-ia.com/fr/sites-web-augmentes/par-ville/olivet)) — présence d'index confirmée, volume non quantifiable.

## Limites

1. **Aucune interrogation API GSC/Bing live** : les credentials (GSC_OAUTH_*, BING_WMT_API_KEY) n'existent qu'en secrets GH/Coolify ; le SSH prod (`ssh axion-prod`) a été **refusé par le système de permissions** de cette session (2 tentatives, Bash et PowerShell). Conséquence : buckets de couverture (indexées / découvertes / explorées non indexées / exclues par motif), liste GSC des sitemaps soumis, enhancements (FAQ / étoiles / jobs / breadcrumbs), top 50 requêtes et rapport « pages en perte » par requête : **non mesurables**. Dernier état connu : buckets du 31/07 (≈ 1 200 noindex / 884 détectées non indexées / 463 404), enhancements exportés le 05/06 (breadcrumbs).
2. Les CSV W32/W33 sont des données **page-level uniquement** (pas de dimension query) : l'analyse top requêtes est impossible sur cette source ; la fenêtre W33 s'arrête au 10/08 — les 4 derniers jours (11–14/08) ne sont couverts par aucune donnée.
3. Probe Bing `site:` inexploitable (anti-bot) — la couverture Bing reste une inconnue totale (cohérent avec le finding P1 Bing).
4. Déploiement en vol (parti 17:33 UTC) pendant mes mesures live 18:32–18:33 UTC : je n'ai tiré **aucune** conclusion des volumes de sitemaps DB-driven ; le décompte « 38 sous-sitemaps » porte sur la présence dans l'index, pas sur leurs contenus.
5. L'état du flag `GSC_HCU_MONITOR_ENABLED` et des env vars GSC en prod n'a pas pu être lu (SSH refusé) — le finding P1 « monitoring inexistant » repose sur le code seul (stub explicite), marqué [À CONFIRMER] pour la partie flag.

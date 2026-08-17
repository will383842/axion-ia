# D4 — pSEO villes (phased-coverage, tiers, cap d'indexation, doorway-risk)

**Date/heure** : 2026-08-14, mesures live entre **19:15 et 19:36 UTC** (toutes horodatées ci-dessous).

**Contexte deploy (vérifié `gh run list`, 19:13:41 UTC)** : dernier run **réussi** atterri **18:36:05 UTC** ; un nouveau run est parti à **18:54:44 UTC** et était encore `in_progress` à 19:13 UTC (atterrissage estimé ~19:50-20:00 UTC). Toutes mes mesures live tombent donc **~40-60 min après un deploy** : fenêtre ISR ≤ 1 h. **Impact nul sur ma surface** — les pages villes sont alimentées par des fichiers TS statiques (`src/content/villes/copy/*.ts`), pas par la DB ; le seul chemin DB (`resolveVilleWithCopy` → `GeneratedVilleCopy`) est un *fallback* qui ne sert aucune des 2 157 villes (toutes ont déjà un copy statique). Les 480 URLs des sitemaps villes étaient bien servies à 19:23:54 UTC.

**Périmètre réellement couvert** :

- `src/content/villes/index.ts` (365 l. — `getIndexableVilles`, `isVilleIndexable`, `cohortSize`, `isPremiumVille`, `RANKED_INDEXABLE`), `unique-ville-slugs.ts` (1 816 slugs), `premium-rewrite-slugs.ts` (213 slugs), `src/generated/indexable-villes.ts` (480 slugs), `resolve-with-copy.ts`
- `src/server/content-gen/villes/phased-coverage.ts` + `phase-decision.ts` (+ spec)
- `src/app/[locale]/implantations/[region]/[ville]/page.tsx` (1 000 l.), `.../[region]/page.tsx`, `src/components/sections/VilleServicePageTemplate.tsx` (870 l.) et les 5 routes `*/par-ville/[ville]`
- `src/lib/seo-noindex-routes.ts` (+ son test), `src/proxy.ts:336-338`
- Volet villes de `src/app/sitemap.ts` (`getVillesSitemapIds`, `buildVillesByRegionSitemap`, `buildServicesVillesSitemap`, `VILLES_EDITORIAL`), les 3 `sitemap-images-villes-*`
- Scripts `t4-*`, `scripts/villes/*`, `_AUDIT/VILLES-T4-PROGRESS/*`
- Live : 30 URLs (hubs villes des 4 tiers, pages service×ville, hubs région/service, 13 sitemaps villes, 3 sitemaps images villes, sitemap-index)

**Hors périmètre (autres agents)** : contenu/volumes des sitemaps DB (A3), sitemaps images en tant que tels (A4), maillage global et poids du hub `/fr/implantations` (C4), facettes avis ville/département (C5), redirections génériques (C3), stratégie mots-clés géo (D8), gates content-gen génériques (D3), logs de crawl (F7), GSC (F2).

---

## Résumé exécutif

Le dispositif d'indexation au mérite **fonctionne exactement comme il est écrit** : 480 villes indexables (premium ∩ unique), fichier généré parfaitement synchrone (0 écart), page ↔ sitemap ↔ X-Robots-Tag cohérents sur la surface `implantations`, tokens prix résolus, hreflang EN correctement absent. Mais la valeur produite fuit par trois trous. (1) **455 pages `/sites-web-augmentes/par-ville/*` sont indexables, riches (~2 100 mots uniques) et structurellement introuvables** : hors de tous les sitemaps depuis le 2026-06-20 et sans un seul lien entrant depuis le site (0 lien mesuré depuis les hubs villes et les 5 pages services) — F2 mesure 104 impressions / 0 clic sur cette famille. (2) La couche **on-page des 480 pages indexées est indifférenciée** : même H1 sur les 2 157 villes, 65 % des meta-descriptions partagent leurs 80 premiers caractères, similarité de rendu 6-grammes médiane **0,52** après masquage du nom de ville — alors que la garde anti-doorway maison mesure les *fichiers copy* (20 % de boilerplate = « ✅ OK ») et n'est branchée à aucune CI. (3) **20 % du corpus indexé (95/480) porte un défaut qualité auto-déclaré** (`// Quality score: 50`) jamais remédié. S'y ajoutent un `X-Robots-Tag` qui ne couvre pas 2 des 5 verticales par-ville (~4 200 URLs) avec un **test qui verrouille une route inexistante**, et un JSON-LD ville 100 % JS (aucun FAQPage/LocalBusiness/Service dans le HTML brut). Aucun de ces points n'est un bug de code : ce sont des dérives entre la doctrine écrite et l'état réel.

---

## Findings

### [P0] 455 pages `/sites-web-augmentes/par-ville/*` indexables, riches — et structurellement indécouvrables

- **Symptôme** : 455 villes (sur les 480 indexables) portent un bloc `copy.services.sitesWeb` long-form. La page correspondante répond 200, `robots index, follow`, canonical auto-référente, ~2 100 mots visibles. Elle n'est **dans aucun sitemap** (le sub-sitemap `services-villes-*` n'est plus déclaré, sa route répond 404) et ne reçoit **aucun lien** depuis le hub ville, le hub `/fr/sites-web-augmentes` ou une quelconque page hors de l'îlot par-ville lui-même. Seule discovery restante : les liens « villes proches » entre pages du même îlot + le résidu d'index issu de l'ancien sitemap.
- **Preuve code** : `src/app/sitemap.ts:402-412` — les 5 ids `services-villes-*` sont commentés hors de `staticIds` (décision 2026-06-20, « pages orphelines, dilution du crawl-budget ») ; le `case` du switch reste vivant mais inerte (`sitemap.ts:581-612`). Indexabilité : `src/components/sections/VilleServicePageTemplate.tsx:270-274` (`hasCopy && isVilleIndexable` → pas de `robots noindex`). Contenu : `src/content/villes/copy/<slug>.ts` (bloc `services.sitesWeb`, 455 fichiers). Aucun composant ne lie ces URLs : `grep -rn "sites-web-augmentes/par-ville" src --include=*.tsx` ne renvoie que le template lui-même et des fichiers `content/keywords/*`. À comparer aux 4 autres verticales, elles correctement maillées : `src/components/sections/AuditDetailPage.tsx:178,601-607` et `src/components/formations/FormationDetailPage.tsx:331` lient les 48 premières villes.
- **Preuve live (UTC)** : 19:22:31 — `/fr/sites-web-augmentes/par-ville/oyonnax` = **200, 1 207 020 o, `index, follow`, canonical self, 2 119 mots visibles**. 19:23:36 — `/sitemap/services-villes-audit.xml` = **404** ; `sitemap-index.xml` (38 sitemaps) ne contient **aucune** entrée `services-villes`. 19:36:03 — liens `par-ville` trouvés sur `/fr/audit`, `/fr/sites-web-augmentes`, `/fr/formations`, `/fr/un-a-un`, `/fr/implementation` : **0, 0, 0, 0, 0**. 19:15:05 + 19:17:35 — liens `par-ville` sur les hubs villes `/fr/implantations/…/paris` et `/…/oyonnax` : **0**. Corroboration F2 (`F2-gsc-bing.md:112`) : famille « services par-ville » = 23 pages, 104 impressions, **0 clic**, position moyenne 32,4 ; `F2-gsc-bing.md:148` retrouve `/fr/sites-web-augmentes/par-ville/olivet` en SERP → l'îlot est partiellement indexé mais affamé.
- **Root-cause** : la décision du 2026-06-20 (retrait du sitemap) a été prise quand la famille valait ~40 pages pilotes ; le batch `sitesWeb` (455 villes) a été produit **après** sans que la discovery ne soit rouverte ni que l'indexabilité ne soit refermée. On est aujourd'hui dans le pire des deux mondes : indexable (donc pas de consolidation vers le hub) + indécouvrable (donc pas de trafic).
- **Patch prescrit** — **STOP & ASK Will** (arbitrage binaire, la voie B contredirait une décision documentée en code) :
  - **Voie A (recommandée, ouvrir la vanne)** : réintroduire le seul id `services-villes-sites-web-augmentes` dans `staticIds` (`sitemap.ts:409`) — le builder existe déjà et filtre sur `isVilleIndexable` (`sitemap.ts:1523-1545`), soit 455 URLs FR — **et** ajouter un bloc « Sites web IA près de chez vous » listant 48 villes sur `/fr/sites-web-augmentes`, calqué sur `AuditDetailPage.tsx:600-610`. Sans le maillage, le sitemap seul reproduira le grief de 2026-06-20.
  - **Voie B (refermer)** : passer ces pages en `noindex, follow` + canonical vers `/fr/sites-web-augmentes` tant qu'elles ne sont pas maillées — cohérent avec le modèle hub-and-spoke déjà appliqué aux satellites (`VilleServicePageTemplate.tsx:334-341`).
- **Effort** : S (voie A : 2 lignes sitemap + 1 section) — M si l'on veut échelonner l'ouverture par vagues. **Impact GEO/AEO** : **fort** (455 pages de contenu unique déjà payé, aujourd'hui à ~0 clic).
- **Risque de régression** : moyen — +455 URLs annoncées d'un coup sur un domaine jeune alors que F2 mesure déjà une dégradation de position (22,2 → 25,5 sur W33) ; mitigation : ouvrir par vagues (100/semaine) via un slice dans le builder. **Do-not-touch** : la décision « ne pas réintroduire les 4 autres verticales » (leurs pages indexables sont déjà maillées depuis les fiches audit/formations), `buildServicesVillesSitemap`, `isVilleIndexable`, le cap 480.

---

### [P1] `X-Robots-Tag` absent sur `/formations/par-ville/*` et `/un-a-un/par-ville/*` (~4 200 URLs) — et le test verrouille une route qui n'existe plus

- **Symptôme** : la whitelist Edge qui pose `X-Robots-Tag: noindex, follow` sur les stubs pSEO ne reconnaît que les segments `audit`, `interventions`, `implementation`. Or la route FR réelle est `/formations/par-ville/…` (et non `/interventions/…`, redirigée 308 depuis 2026-06). Les segments `un-a-un` et `sites-web-augmentes` ne sont pas mappés du tout. Résultat : ~2 109 stubs `formations` + ~2 117 stubs `un-a-un` ne reçoivent **pas** l'en-tête ; ils restent `noindex` par le `<meta>` (pas de fuite d'indexation) mais perdent tout le bénéfice crawl du dispositif.
- **Preuve code** : `src/lib/seo-noindex-routes.ts:139-143` (`SERVICE_PATH_TO_KEY = { audit, interventions, implementation }`) vs `src/i18n/routing.ts:386-388` (`"/formations/par-ville/[ville]"`) et `:143-145` (`"/un-a-un/par-ville/[ville]"`). La garde qui devrait rougir teste la route morte : `src/lib/seo-noindex-routes.test.ts:91` (`isNoindexStubRoute("/fr/interventions/par-ville/petite-foret")` → true) et `:97` — deux assertions sur une URL qui répond 308 en prod. Consommateur : `src/proxy.ts:336-338`.
- **Preuve live (UTC)** : 19:15:44 — `/fr/formations/par-ville/albertville` = 200, `<meta robots noindex, follow>`, **aucun `x-robots-tag`**. 19:15:56 — `/fr/un-a-un/par-ville/albertville` = idem. Contre-exemples conformes : 19:15:38 `/fr/audit/par-ville/albertville` et 19:15:59 `/fr/implementation/par-ville/albertville` = `x-robots-tag: noindex, follow`. 19:21:43 / 19:21:46 — même constat sur `oyonnax`. (C3 et F7 avaient validé la surface `audit` uniquement — `C3-redirections-codes.md:142-143`, `F7-logs-crawl.md:137` — d'où le trou non vu.)
- **Root-cause** : le renommage `interventions` → `formations` (routing) n'a pas été propagé dans la table Edge ; les 2 verticales ajoutées après (2026-06) n'y ont jamais été ajoutées. Le test a été écrit sur l'ancien chemin et n'a jamais été rejoué contre `routing.pathnames`.
- **Patch prescrit** : (1) `SERVICE_PATH_TO_KEY` → ajouter `formations: "interventions"`, `"un-a-un": "unAUn"`, `"sites-web-augmentes": "sitesWeb"` et étendre `INDEXABLE_SERVICE_VILLE_SLUGS` avec les sets correspondants (40 slugs `unAUn`, **455** slugs `sitesWeb` — attention, un set incomplet mettrait `noindex` sur des pages indexables, le faux positif « CRITIQUE » que le fichier interdit lui-même, `seo-noindex-routes.ts:157-158`) ; (2) réécrire le test pour **dériver** les chemins de `routing.pathnames` au lieu de les coder en dur, afin qu'un futur renommage rougisse.
- **Effort** : S (mapping) + S (test). **Impact GEO/AEO** : moyen (crawl-budget, pas d'indexation fautive).
- **Risque de régression** : **moyen-élevé si mal fait** — le set `sitesWeb` doit être généré (comme `indexable-villes.ts`), pas saisi à la main. **Do-not-touch** : `ALL_SERVICE_VILLE_SLUGS` (40 métropoles), `INDEXABLE_VILLE_SLUGS_CAP` (fichier généré), la sémantique « faux négatif OK / faux positif interdit ».

---

### [P1] 65 % des meta-descriptions des villes indexées partagent leurs 80 premiers caractères

- **Symptôme** : la description des pages villes est le `directAnswerFr` tronqué à 155 caractères. Or 1 854 des 2 153 `directAnswerFr` (et **308 des 476** villes indexables) commencent par la même phrase : « *Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui i…* ». Sur un snippet SERP de ~155 caractères, plus de la moitié est donc identique d'une ville à l'autre, et l'élément distinctif (la ville) n'arrive qu'au 6ᵉ mot.
- **Preuve code** : `src/app/[locale]/implantations/[region]/[ville]/page.tsx:174-181` (`rawDescription = copy.directAnswerFr`) + `:161-168` (`truncateForSerp(…, 155)`). Le `seoHook` sectoriel — le seul champ réellement discriminant, présent sur ~1 842 villes — n'est utilisé que dans le *title* (`:150-153`) et dans le *fallback* de description, jamais quand `directAnswerFr` existe.
- **Preuve live (UTC)** : 19:15:05-19:15:16 — descriptions servies : paris « *Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Paris (75) sur site dans les 20 arrondissements et la prem…* » (155 c.) ; oyonnax, lagnieu, albertville : **même amorce mot pour mot**, seul le nom de ville change. Contexte F2 : CTR ÷ 2,7 sur W33 (`F2-gsc-bing.md`).
- **Root-cause** : réutilisation d'un champ conçu pour l'AEO (réponse directe, où l'amorce définitionnelle est un atout) comme meta-description SERP (où elle est un handicap). Aucun test de duplication de meta-description à l'échelle du corpus.
- **Patch prescrit** : composer la description dans `generateMetadata` au lieu de tronquer : `« {Ville} ({dept}) — {seoHook} : audit, formation et implémentation IA sur site. {1re phrase spécifique du pitch} »`, en gardant `truncateForSerp`. Alternative moins invasive : détecter l'amorce générique (préfixe partagé > 60 c.) et basculer sur `pitchFr` puis sur le fallback `seoHook`. Ajouter un test « aucun préfixe de 60 caractères partagé par plus de 20 villes indexables ».
- **Effort** : S (patch) + S (test). **Impact GEO/AEO** : **fort** (CTR SERP + qualité perçue du corpus pSEO ; Google réécrit d'autant plus volontiers une description dupliquée).
- **Risque de régression** : faible — la description n'alimente aucun JSON-LD (le `directAnswerFr` reste servi tel quel dans le bloc `#axion-direct-answer`, à ne pas toucher : c'est l'actif AEO). **Do-not-touch** : `#axion-direct-answer` et son `data-answer`, `speakable`, `truncateForSerp`.

---

### [P1] H1 identique sur les 2 157 pages villes, sans aucun mot-clé de service

- **Symptôme** : toutes les pages villes portent le H1 « **Vos concurrents à {Ville} utilisent déjà l'IA. Et vous ?** ». Le seul élément variable est le nom de la ville ; aucun des mots-clés cibles (audit IA, formation IA, implémentation IA) n'y figure. Le hub région applique le même gabarit.
- **Preuve code** : `src/app/[locale]/implantations/[region]/[ville]/page.tsx:599-612` (et `[region]/page.tsx:241-248`). À noter : ce H1 porte aussi `data-speakable-hero` (`:602`), donc le sélecteur `speakable` du JSON-LD pointe sur une **question rhétorique**, pas sur une réponse.
- **Preuve live (UTC)** : 19:15:05→19:15:18 — paris / oyonnax / lagnieu / albertville : H1 unique par page, gabarit strictement identique ; titles corrects en revanche (« Oyonnax (01) · IA pour entreprises · plasturgie & sous-traitance industrielle · Axion-IA »).
- **Root-cause** : H1 conçu comme accroche de conversion, pas comme signal sémantique ; jamais réconcilié avec le title.
- **Patch prescrit** : H1 = `« IA pour les entreprises de {Ville} — audit, formation, implémentation »` (variante par `seoHook` quand il existe) et **descendre l'accroche actuelle en sous-titre** (elle garde sa valeur conversion). Déplacer `data-speakable-hero` sur le bloc `#axion-direct-answer` (déjà `data-answer`), pour que le speakable serve une réponse.
- **Effort** : S. **Impact GEO/AEO** : moyen-fort (H1 = signal majeur sur du pSEO local à 480 pages ; effet direct sur l'extraction AEO).
- **Risque de régression** : faible (CSS `clamp` déjà responsive, mais un H1 plus long change la hauteur du héros → vérifier CLS = 0 sur `/fr/implantations/*`, budget strict). **Do-not-touch** : le `<span>` terracotta italique (charte), la structure Hn suivante.

---

### [P1] JSON-LD des pages villes 100 % JavaScript — aucun schéma exploitable dans le HTML brut

*(Recoupement du constat transverse (b), quantifié sur ma surface.)*

- **Symptôme** : sur une page ville indexée, le HTML brut ne contient que **2** blocs `application/ld+json` : le graphe racine (Organization/WebSite/SiteNavigationElement) et un `Place`. Les 8 schémas de la page (WebPage+speakable, Service, LocalBusiness, BreadcrumbList, ItemList, ImageObject, AggregateOffer) **et le FAQPage** ne sont présents que sous forme échappée dans le payload Flight, injectés après hydratation. Les crawlers IA autorisés par la doctrine (OAI-SearchBot, PerplexityBot, Claude-SearchBot, Mistral-User) n'exécutent pas JS : ils ne voient aucune donnée structurée sur le plus gros corpus du site.
- **Preuve code** : `src/app/[locale]/implantations/[region]/[ville]/page.tsx:909-941` (`<JsonLdGraph … strategy="afterInteractive">`), `src/components/sections/VilleServicePageTemplate.tsx:863-866` (idem pour les 7 schémas ville×service), `src/components/ville/VilleFaqGeolocalisee.tsx:120` (`<JsonLd … strategy="afterInteractive">`). Le composant documente lui-même l'arbitrage : « *pour les schemas critiques où l'on doute de la capacité crawler à exécuter JS (LLM bots), garder `strategy="inline"`* » (`src/components/marketing/JsonLdGraph.tsx:17-21`).
- **Preuve live (19:15:05 UTC)** : `/fr/implantations/ile-de-france/paris` — blocs `ld+json` réellement dans le HTML : `Place` + `@graph[Organization, WebSite, SiteNavigationElement]`. Occurrences `"@type":"FAQPage"` / `LocalBusiness` / `Service` / `AggregateOffer` / `BreadcrumbList` / `ItemList` dans le HTML brut : **0** ; dans le payload Flight échappé : 1 chacune.
- **Root-cause** : optimisation TBT de 2026-05-22 (−300 à −500 ms) appliquée uniformément, sans re-arbitrage après la bascule de doctrine « bloquer training / garder citation » (juin) qui a fait des crawlers IA sans JS une cible de premier plan.
- **Patch prescrit** : repasser en `strategy="inline"` **les schémas d'entité** sur les pages villes indexables uniquement — FAQPage, LocalBusiness/Place, Service, BreadcrumbList — et garder `afterInteractive` pour les schémas volumineux et secondaires (ItemList villes proches, ImageObject). Mesurer le delta TBT avant/après sur 3 pages (budget `TBT ≤ 150 ms`).
- **Effort** : S (2 props) + M (mesure Web Vitals obligatoire). **Impact GEO/AEO** : **fort** (c'est la condition d'existence des rich results locaux et des citations IA sur 480 + 623 pages).
- **Risque de régression** : **budget Web Vitals** — tout dépassement TBT/LCP = STOP & ASK + ADR (AGENTS.md). Mitigation : n'inliner que sur les pages `isVilleIndexable` (les 1 677 noindex gardent `afterInteractive`). **Do-not-touch** : `JsonLdGraph` (contrat partagé par ~30 gabarits), la dé-duplication FAQPage (le graphe page n'inclut volontairement pas le FAQPage, cf. commentaire `page.tsx:906-908`).

---

### [P1] 20 % du corpus indexé (95/480) porte un défaut qualité auto-déclaré, jamais remédié

- **Symptôme** : 65 fichiers copy de villes **indexées** portent en en-tête `// Quality score: NN — Model: gpt-4o.` avec NN < 75 (le seuil du projet), minimum 50, médiane 58. En croisant avec le scan qualité maison du 2026-05-28 (355 villes « problématiques »), 56 villes indexées flaggées n'ont **jamais** reçu la correction Wikipedia appliquée aux 138 autres. Union : **95 pages sur 480 (20 %)**, toutes dans le sitemap, toutes `index, follow` — dont des villes à fort potentiel (albi, angoulême, auxerre, bastia, cergy, chelles, cholet, alfortville…).
- **Preuve code** : `src/content/villes/copy/alfortville.ts:1-3` (« *AUTO-GENERATED 2026-05-27 … Quality score: 50 — Model: gpt-4o.* ») ; `_AUDIT/VILLES-T4-PROGRESS/low-quality-villes.json` (`scannedAt 2026-05-28T04:57:24Z`, `totalVilles 2157`, `problematicCount 355`) ; aucun de ces 194 slugs indexables ne porte le header `MANUAL-REWRITE` que `scripts/t4-gen-premium-list.ts` recherche. Le scan n'est appelé par aucun workflow (`grep t4-find-low-quality .github/workflows` → 0).
- **Preuve live (19:33:17 UTC)** : `/fr/implantations/ile-de-france/alfortville` = **200, `index, follow`**, 1 287 852 o ; présente dans `/sitemap/villes-ile-de-france.xml` (relevé 19:23:54 UTC).
- **Root-cause** : la remédiation T4 s'est arrêtée après le batch Wikipedia du 2026-05-28 (`progress.json.lastBatchAt = 2026-05-27T17:17Z`) ; la production de contenu est à l'arrêt depuis le 2026-07-20 (kill switch, déjà acté) ; rien ne relie le score qualité à l'éligibilité à l'index — `isPremiumVille` ne regarde que la population et le header `MANUAL-REWRITE`.
- **Patch prescrit** : ajouter au critère d'indexation un **plancher qualité** dérivé du header (`Quality score ≥ 75` OU `MANUAL-REWRITE` OU correction anti-doorway) — c'est-à-dire régénérer `indexable-villes.ts` en excluant les 95, plutôt que d'attendre une réécriture impossible à budget nul. Alternative si Will préfère ne pas rétracter d'indexation (règle « l'indexation ne rétracte jamais ») : sortir les 95 du sitemap sans toucher aux `<meta>`, et les mettre en tête de file du prochain batch de réécriture.
- **Effort** : S (exclusion + régénération du fichier généré) — L si réécriture éditoriale. **Impact GEO/AEO** : moyen-fort (qualité site-wide au sens HCU : 20 % du corpus pSEO tire la moyenne vers le bas).
- **Risque de régression** : **rétraction d'indexation de 95 URLs déjà connues de Google** — contrarie l'invariant « monotone croissant » documenté (`villes/index.ts:224-227`) : **STOP & ASK Will**. **Do-not-touch** : `INDEXABLE_VILLE_SLUGS_CAP` doit rester généré (jamais édité à la main), le test de sync `seo-noindex-routes.test.ts`.

---

### [P1] La garde anti-doorway mesure les fichiers copy (verte à 20 %) pendant que le rendu affiche 52 % de similarité — et aucune CI ne l'exécute

- **Symptôme** : `scripts/t4-similarity-check.ts` conclut « **✅ OK — risque Google duplicate faible** » (20,0 % de boilerplate) parce qu'il compare les *chaînes des fichiers copy*. Or Google compare la **page rendue**, où la copy ne pèse qu'une fraction du texte : sur 12 pages villes réelles, la similarité Jaccard 6-grammes est de **0,38-0,50 brute** et **0,44-0,60 après masquage du nom de ville** (médiane 0,52) ; chaque page n'a que **20 à 31 % de shingles qui lui soient propres** face à 11 voisines seulement (la proportion chute mécaniquement à l'échelle des 480). Aucun de ces scripts (`t4-similarity-check`, `scripts/villes/compute-ville-uniqueness`) n'est branché dans `ci.yml` : la garde ne peut pas rougir.
- **Preuve code** : `scripts/t4-similarity-check.ts:29-60` (extraction depuis `copy/*.ts`, jamais depuis le rendu) et `:174-181` (verdict) ; `src/content/villes/unique-ville-slugs.ts:1-4` (« régénérer après un batch de réécriture ») — dernière régénération **2026-06-01** (`git log`), alors que les copies villes ont été modifiées les 2026-08-13 (#584, #588). Aucune occurrence de `t4-similarity` / `compute-ville-uniqueness` dans `package.json` ni `.github/workflows/ci.yml`.
- **Preuve live (19:15-19:17 UTC, 12 pages)** : script maison exécuté à 19:19 UTC → « 94,1 % de phrases uniques, boilerplate 20,0 %, ✅ OK » ; mesure sur le HTML servi (mêmes villes) → Jaccard médian **0,519** après masquage du nom de ville, shingles uniques : paris 30,6 %, lyon 28,5 %, oyonnax 29,7 %, lagnieu 25,0 %, albertville 20,7 %, bellerive-sur-allier 20,0 %.
- **Root-cause** : l'unité de mesure (fichier) ≠ l'unité jugée (page). Les 1 650-1 750 mots visibles d'une page ville sont majoritairement du gabarit (5 cartes services, grille tarifaire, bandeau logos, bloc fondateur, CTA, footer) dans lequel seul le nom de ville varie — y compris dans les descriptions des 5 verticales, générées par interpolation (`page.tsx:230-283` : `« … à ${v} … »`).
- **Patch prescrit** : (1) faire porter la mesure sur le **rendu** (fetch de N pages ou rendu statique) et non sur les fichiers ; (2) l'exécuter en CI en mode informatif d'abord (seuil d'alerte : shingles uniques < 20 % ou Jaccard masqué > 0,55) ; (3) côté contenu, augmenter la part variable du rendu — remonter `ecosystemFr`/`topSectorsNaf` plus haut, faire varier les descriptions des 5 cartes par `seoHook` sectoriel plutôt que par simple insertion du nom de ville.
- **Effort** : M (script + CI), L (contenu). **Impact GEO/AEO** : fort à moyen terme (c'est le facteur HCU direct sur 480 pages).
- **Risque de régression** : faible pour la mesure ; **moyen** pour la variabilisation du gabarit (toucher aux 5 cartes touche toutes les villes d'un coup, et les descriptions portent des promesses commerciales — CGV obligation de moyens). **Do-not-touch** : les tokens `{{price:…|flat}}` (décision actée 4), les libellés/ordre SSOT des 5 services (décision Will 2026-07-07), `UNIQUE_VILLE_SLUGS` tant qu'il n'est pas régénéré par son script.

---

### [P2] Le « stub noindex » anti-doorway n'existe plus : 1 677 pages noindex rendent la page complète (1,28 Mo)

- **Symptôme** : le composant `VilleStub`, censé servir une page minimale aux villes sans copy, est **du code mort** — les 2 157 villes ont toutes un copy. Les 1 677 villes hors cap rendent donc le gabarit intégral (mêmes sections, mêmes 1 500 mots) en `noindex, follow`. Ordre de grandeur du corps crawlable : ~2,1 Go pour la seule surface `implantations`, plus ~10 785 pages `par-ville` (dont 1 702 satellites `sites-web` qui répondent **308 avec un corps de 820 Ko**).
- **Preuve code** : `src/app/[locale]/implantations/[region]/[ville]/page.tsx:295-306` (`if (!ville.copy) return <VilleStub…>` — branche jamais prise) et `:944-960` (commentaire « stub minimal pour les ~2 156 villes sans copy éditorial », faux depuis le sprint T4 100 %) ; `VilleServicePageTemplate.tsx:334-341` (`permanentRedirect` après rendu partiel).
- **Preuve live (UTC)** : 19:15:16 `/fr/implantations/…/albertville` (noindex) = **1 284 600 o** ; 19:15:18 `/…/chaponost` (noindex) = 1 284 652 o — soit le même ordre que paris (1 267 000 o). 19:16:47 `/fr/sites-web-augmentes/par-ville/albertville` = **308 avec `size_download` = 820 059 o**. 19:30:59 hub région `/fr/implantations/auvergne-rhone-alpes` = 2 758 380 o, 284 liens villes. (F7 a déjà établi que l'en-tête `X-Robots-Tag` n'évite pas le **transfert** : `F7-logs-crawl.md:111-112`.)
- **Root-cause** : la promesse « stub + gain crawl ×5 » date d'un état où 2 156 villes n'avaient pas de copy ; le sprint T4 l'a rendue caduque sans que le rendu ne soit re-arbitré.
- **Patch prescrit** : rendre une version **allégée** aux villes hors cap (héros + direct answer + lien hub région + communes proches), en réutilisant `VilleStub` enrichi, sous le même `noindex, follow`. Pour les satellites `sites-web`, émettre le 308 **avant** le rendu (redirect dans `generateMetadata` ou en amont du composant) pour supprimer les 820 Ko inutiles.
- **Effort** : M. **Impact GEO/AEO** : moyen (crawl-budget d'un domaine jeune ; aucun effet direct sur les 480 indexées).
- **Risque de régression** : moyen — ces pages servent le maillage « noindex, follow » vers les hubs : ne pas supprimer leurs liens sortants. **Do-not-touch** : `isVilleIndexable`, les liens « communes proches », le `follow`.

---

### [P2] Le drip d'indexation est mort, ses commentaires promettent une réouverture automatique qui n'arrivera jamais

- **Symptôme** : `villes/index.ts` décrit sur 50 lignes une réouverture hebdomadaire accélérante (S1 = +100, S2 = +125…) devant amener « **~710 villes uniques restantes rouvertes en ~5-6 semaines, sans intervention** ». En réalité : `isVilleIndexable` ignore volontairement `cohortSize` depuis le 2026-06-14, et le cap du 2026-07-03 restreint `RANKED_INDEXABLE` aux villes premium, si bien que `PREMIUM_COUNT (480) == RANKED_INDEXABLE.length (480)` : `cohortSize()` renvoie 480 pour toujours et **1 336 villes au contenu jugé unique resteront `noindex` indéfiniment**, sans date de revue ni critère de sortie. Les 213 réécritures premium n'ont d'ailleurs débloqué que **25 villes** (les seules sous 20 000 habitants) ; les 188 autres étaient déjà indexables par population.
- **Preuve code** : `src/content/villes/index.ts:210-232` (doctrine de réouverture), `:280-288` (`RANKED_INDEXABLE = premium ∩ unique`), `:294-303` (`cohortSize`), `:305-320` (`isVilleIndexable` ignore `now`). Consommateurs de `getVillesIndexableNow()` (donc de `cohortSize`) : 8 pages/composants (`roi/page.tsx:130`, `AuditDetailPage.tsx:178`, `FormationDetailPage.tsx:331`, …) — inoffensif aujourd'hui, mais le mécanisme reste branché. Commentaires faux également en `sitemap.ts:117-120` (« +50/jour, s'élargit toute seule ») — déjà relevé par A2 (`A2-sitemap-index-statiques.md:71`), je le recoupe depuis la source.
- **Preuve live (19:23:54 UTC)** : somme des 13 sitemaps villes = **480 URLs exactement**, identique au fichier généré (480) et au calcul statique de `RANKED_INDEXABLE` (480) — la cohorte n'a pas bougé d'une URL depuis le 2026-08-01 (`git log src/generated/indexable-villes.ts`).
- **Root-cause** : trois décisions successives (drip 05-28, mérite 05-31, cap 07-03) empilées sans nettoyage ; la dernière neutralise arithmétiquement les deux premières.
- **Patch prescrit** : **aucun changement de comportement** (le cap 480 est une décision Will, F2 le liste en do-not-touch). Purement documentaire : supprimer/mettre à jour les blocs de commentaires devenus faux, marquer `cohortSize`/`reopenedSince`/`BURST_DAYS`/`REOPEN_*` comme neutralisés, et écrire l'ADR manquant « cap 480 : critères de sortie » (p. ex. « rouvrir +100 villes uniques par mois quand la position moyenne `implantations` repasse sous 20 »). Sans critère écrit, personne ne rouvrira jamais.
- **Effort** : S. **Impact GEO/AEO** : faible directement, **fort en évitement d'erreur** (un futur agent lit ces commentaires et croit le système auto-expansif).
- **Risque de régression** : nul (commentaires + ADR). **Do-not-touch** : le cap 480 lui-même, `getVillesIndexableNow` (8 consommateurs).

---

### [P2] `dateModified` figé au 2026-05-26 dans le JSON-LD des villes vs `lastmod` sitemap au 2026-08-13

- **Symptôme** : le `WebPage` de chaque page ville déclare `datePublished = dateModified = "2026-05-26"` en dur, alors que le sitemap annonce `lastmod 2026-08-13T12:24:03Z` pour ces mêmes URLs (manifeste de fraîcheur alimenté par git). Deux signaux de fraîcheur contradictoires pour la même URL, à 2,5 mois d'écart.
- **Preuve code** : `page.tsx:924-929` (dates en dur, « bumper à la main ») vs `sitemap.ts:477` + `:504-509` (`editorialFor("villes", VILLES_EDITORIAL)`) et `src/generated/content-freshness.ts:12` (`villes: "2026-07-28…"` en local, régénéré en CI au build).
- **Preuve live (19:23:54 UTC)** : les 13 sitemaps villes portent tous `<lastmod>2026-08-13T12:24:03.000Z</lastmod>` ; le JSON-LD de la page (visible seulement dans le payload Flight, cf. finding précédent) porte `2026-05-26`.
- **Root-cause** : deux dispositifs de fraîcheur ajoutés à trois mois d'intervalle, jamais reliés. Effet de bord inverse : un unique commit touchant une ville bump le `lastmod` des **480**.
- **Patch prescrit** : alimenter le JSON-LD depuis la même source que le sitemap (exporter `editorialFor("villes")` ou lire `CONTENT_FRESHNESS.villes`). Idéalement, granulariser à la ville (date du dernier commit du fichier copy) — mais c'est du L, hors urgence.
- **Effort** : S (aligner sur la famille) / L (par ville). **Impact** : faible-moyen. **Risque** : faible. **Do-not-touch** : `EDITORIAL_BASELINE`, le principe « pas de BUILD_TIME » (audit fraîcheur 2026-06-08), cross-ref A2 sur la granularité des familles.

---

### [P2] Quatre définitions divergentes des tiers T1→T4 cohabitent

- **Symptôme** : le mot « tier » recouvre 4 découpages différents — indexation (≥ 20 000 hab. ou premium, `villes/index.ts:246`), `populationTier` UI/DB (100k / 20k / 10k, `page.tsx:121`), sitemaps images (100k / 50-100k / reste, `sitemap-images-villes-t1|t2|t3-t4`), et `CityTier` du plan de couverture (métropole / 100-500k / 20-100k / bassin, `phased-coverage.ts:23-27`). Un « T2 » n'a pas le même sens selon le fichier.
- **Preuve code** : `src/content/villes/index.ts:246` ; `src/app/[locale]/implantations/[region]/[ville]/page.tsx:121` ; `src/app/sitemap-images-villes-t1.xml/route.ts:27`, `-t2:25`, `-t3-t4:45` ; `src/server/content-gen/villes/phased-coverage.ts:23-27`.
- **Preuve live (19:30:13 UTC)** : sitemaps images villes = 40 (t1) + 83 (t2) + 357 (t3-t4) = **480**, cohérent avec la cohorte ; mais le « t2 » images (50-100k) ≠ le « T2 » indexation (≥ 20k, 415 villes).
- **Patch prescrit** : un seul helper `villeTier(v)` exporté depuis `@/content/villes`, consommé partout ; les seuils actuels des sitemaps images restent (ils ne servent qu'à choisir un visuel générique) mais renommés `IMAGE_BUCKET_*`.
- **Effort** : S-M. **Impact** : faible (lisibilité/évitement d'erreur). **Risque** : faible. **Do-not-touch** : les 3 routes sitemap images (surface A4), le seuil 20 000 de l'indexation.

---

### [P2] `UNIQUE_VILLE_SLUGS` n'a pas été régénéré depuis le 2026-06-01 alors que les copies ont bougé

- **Symptôme** : le scorer d'unicité (garde-fou anti-doorway « au mérite ») date du 2026-06-01 ; les fichiers copy ont été modifiés depuis (2026-08-13, #584 et #588 — retrait des garanties, harmonisation des prix). Le set est donc périmé. Sans effet **aujourd'hui** (les 480 villes du cap sont toutes dans le set), mais toute levée partielle du cap s'appuierait sur des scores obsolètes.
- **Preuve code** : `src/content/villes/unique-ville-slugs.ts:1-4` (« régénérer après un batch de réécriture ») ; `git log -1 -- src/content/villes/unique-ville-slugs.ts` → `2026-06-01 fbc48c9e` ; `git log -3 -- src/content/villes/copy` → `2026-08-13 2e921b7d`, `2026-08-13 91a5098c`.
- **Preuve live** : sans objet (artefact de build). Vérification statique : `RANKED_INDEXABLE` recalculé à la main = **480**, identique au fichier généré (0 slug en écart dans les deux sens) — la chaîne est cohérente, seulement figée.
- **Patch prescrit** : rejouer `pnpm tsx scripts/villes/compute-ville-uniqueness.ts --emit --threshold=0.6` puis `pnpm tsx scripts/gen-indexable-villes.ts` dans le même commit, et ajouter un test « le set unique est plus récent que le dernier commit touchant `copy/` » (ou, plus simple, l'inscrire dans la checklist de tout batch de réécriture).
- **Effort** : S. **Impact** : faible aujourd'hui, moyen si le cap est levé. **Risque** : **le patch peut retirer des slugs** et donc rétracter de l'indexation → ne l'exécuter qu'en connaissance de l'écart (mode dry-run d'abord). **Do-not-touch** : `indexable-villes.ts` à la main.

---

### [P2] Prose villes : ~4 800 occurrences de prix sans formule d'amorce dans leur phrase — [À CONFIRMER]

- **Symptôme** : la décision actée n°4 pose que les tokens `{{price:…|flat}}` sont **volontairement nus parce que la phrase qui les entoure porte déjà « à partir de »**. Sur les 8 354 occurrences des fichiers copy, ma détection lexicale n'a trouvé **aucune** formule d'amorce (« à partir de », « dès », « démarre à », « entre », « compter ») dans la phrase pour **~4 800** d'entre elles (1 786 villes, dont 168 indexables). Échantillon manuel : une partie est en réalité couverte par des variantes que ma regex ne connaît pas (« débutent à ») ; une autre partie est bien nue (« *Audit sur place 1 190 € HT, ROI chiffré.* », phrase la plus partagée du corpus — 506 villes).
- **Preuve code** : `src/content/villes/copy/*.ts` (8 354 tokens `|flat`) ; top des phrases partagées mesuré par `scripts/t4-similarity-check.ts` (exécution 19:19 UTC) : `"audit sur place {{price:audit-flash|flat}}"` → **506 villes**, `"l audit sur place démarre à {{price:audit-flash|flat}}"` → 188 villes.
- **Preuve live (19:24:11 UTC)** : aucun token brut ne fuit dans le HTML (0 occurrence de `{{` sur 20 pages téléchargées) — **l'invariant technique de la décision 4 est respecté en prod** ; `/fr/implantations/…/le-teil` affiche « *Audit sur place 1 190 € HT, intervention d'une journée…* » (montant nu) à côté d'une grille tarifaire qui, elle, affiche bien « à partir de ».
- **Root-cause** : la prose a été générée par lots successifs avec des tournures variables ; le contrôle porte sur le token, pas sur la phrase.
- **Patch prescrit** : **NE PAS** basculer les tokens en `|from` (produirait « à partir de à partir de » — piège documenté). Faire un audit lexical ciblé des ~10 tournures les plus fréquentes et corriger la **prose** (« Audit sur place **à partir de** 1 190 € HT »), par script de réécriture sur les 480 villes indexables d'abord.
- **Effort** : M. **Impact GEO/AEO** : faible ; **impact conformité/cohérence** : moyen (le reste du site affiche toujours « à partir de »). **Risque** : moyen — toute réécriture de masse doit être rejouée contre le test qui verrouille les tokens. **Do-not-touch** : `formatTierPrice`, `isFromPrice`, `AggregateOffer.lowPrice` (nombre brut), le test de verrouillage des tokens.

---

### [P2] Les pages villes n'ont pas de canal markdown pour les IA

- **Symptôme** : `/api/markdown/<type>/<slug>` ne connaît que `blog`, `actualites`, `cas-concrets`, `centre-aide`, `faq`, `guides`. Le plus gros corpus du site (480 pages villes indexées + 623 pages service×ville) n'a **ni** markdown **ni** JSON-LD lisible sans JS (cf. P1 ci-dessus) : un crawler IA autorisé n'en retire que du HTML.
- **Preuve code** : `src/app/api/markdown/[type]/[slug]/route.ts` (jeu de types fermé) ; aucune balise `<link rel="alternate" type="text/markdown">` sur les pages villes.
- **Preuve live (19:34:48 UTC)** : `/api/markdown/ville/paris` → **404 « Unknown content type: ville »** ; `/fr/implantations/ile-de-france/paris` ne porte que les `rel="alternate"` hreflang `fr` + `x-default`.
- **Patch prescrit** : ajouter un type `ville` sérialisant `pitch + directAnswer + ecosystem + secteurs + FAQ` depuis `@/content/villes` (pas de DB, donc insensible au build stub), et poser le `<link rel="alternate" type="text/markdown">` sur les pages villes indexables.
- **Effort** : M. **Impact GEO/AEO** : moyen (canal d'ingestion IA sur le corpus le plus volumineux). **Risque** : faible. **Do-not-touch** : `Allow: /api/markdown/` dans robots.txt (invariant), la surface A5.

---

### [P2] Titles villes à 73-90 caractères, au-delà de la cible affichée (55-65)

- **Symptôme** : le gabarit `{Ville} ({dept}) · IA pour entreprises · {seoHook} · Axion-IA` dépasse systématiquement 70 caractères dès qu'un `seoHook` existe (~1 842 villes) — troncature quasi certaine en SERP, souvent sur le hook, c'est-à-dire sur le seul élément différenciant.
- **Preuve code** : `page.tsx:146-155` (le commentaire vise « 55-65 chars »), suffixe de marque ajouté par `buildProductMetadata`.
- **Preuve live (19:15:05→19:15:16 UTC)** : paris 73 c., lagnieu 84 c., oyonnax 88 c., albertville **90 c.**
- **Patch prescrit** : raccourcir le gabarit (`{Ville} ({dept}) · IA entreprises · {seoHook}` sans « pour ») et tronquer le hook à ~28 caractères, ou supprimer le suffixe de marque sur cette famille.
- **Effort** : S. **Impact** : faible-moyen (CTR). **Risque** : faible. **Do-not-touch** : `buildProductMetadata`, `meta-length.ts` (surface C1).

---

## Mesures brutes

### Cohorte et données (analyse statique du dépôt, 19:10-19:20 UTC)

| Grandeur | Valeur | Source |
| --- | --- | --- |
| Villes en données INSEE | 2 157 | `src/content/villes/data/*.ts` |
| Villes avec `copy` (= `getIndexableVilles()`) | **2 157 (100 %)** | `copy/*.ts` + `_auto-generated-index.ts` |
| `PREMIUM_REWRITE_SLUGS` | 213 (= 213 fichiers portant `MANUAL-REWRITE` → **en sync**) | `premium-rewrite-slugs.ts` |
| `UNIQUE_VILLE_SLUGS` | 1 816 (régénéré le 2026-06-01) | `unique-ville-slugs.ts` |
| `isPremiumVille` (pop ≥ 20k **ou** premium) | 480 | calcul |
| `RANKED_INDEXABLE` (premium ∩ unique) | **480** | calcul |
| `INDEXABLE_VILLE_SLUGS_CAP` (fichier généré) | **480 — 0 écart dans les deux sens** | `src/generated/indexable-villes.ts` |
| Répartition par population — toutes | T1 (≥100k) 40 · T2 (20-100k) 415 · T3 (10-20k) 533 · T4 (<10k) 1 169 | calcul |
| Répartition par population — indexables | T1 40 · T2 415 · T3 **2** · T4 **23** | calcul |
| Villes uniques mais hors cap (noindex définitif) | **1 336** | calcul |
| Pages service×ville **indexables** | 623 (sitesWeb 455 · interventions 48 · audit 40 · implementation 40 · un-a-un 40) | scan des blocs `services` |
| Villes indexées à défaut qualité déclaré | 95 / 480 (**20 %**) — 65 avec `Quality score < 75`, 56 flaggées 05-28 non corrigées | headers copy + `low-quality-villes.json` |

### Pages villes — live (2026-08-14)

| URL (`https://axion-ia.com`) | Heure UTC | HTTP | Octets | `<meta robots>` | `X-Robots-Tag` |
| --- | --- | --- | --- | --- | --- |
| `/fr/implantations/ile-de-france/paris` (T1) | 19:15:05 | 200 | 1 267 000 | index, follow | — (correct) |
| `/fr/implantations/auvergne-rhone-alpes/lyon` (T1) | 19:15:07 | 200 | 1 266 182 | index, follow | — |
| `/fr/implantations/…/oyonnax` (T2, 22 480 hab.) | 19:15:10 | 200 | 1 291 089 | index, follow | — |
| `/fr/implantations/…/lagnieu` (T4 premium, 7 411 hab.) | 19:15:13 | 200 | 1 288 247 | index, follow | — |
| `/fr/implantations/…/albertville` (T3 unique, 19 978 hab.) | 19:15:16 | 200 | 1 284 600 | **noindex, follow** | noindex, follow |
| `/fr/implantations/…/chaponost` (T4 non unique) | 19:15:18 | 200 | 1 284 652 | **noindex, follow** | noindex, follow |
| `/fr/implantations/ile-de-france/alfortville` (score déclaré 50) | 19:33:17 | 200 | 1 287 852 | index, follow | — |
| `/fr/implantations/auvergne-rhone-alpes` (hub région) | 19:30:59 | 200 | 2 758 380 | index, follow | — |

Cache CF (2ᵉ passage, 19:34:49 UTC) : lyon/oyonnax/lagnieu = `HIT` (Age 1 175-1 275 s) — le cache CDN fonctionne sur la surface villes.

### Pages service × ville — live

| URL | Heure UTC | HTTP | `<meta robots>` | canonical | `X-Robots-Tag` |
| --- | --- | --- | --- | --- | --- |
| `/fr/audit/par-ville/paris` | 19:15:36 | 200 | index, follow | self | — (conforme) |
| `/fr/audit/par-ville/albertville` | 19:15:38 | 200 | noindex, follow | → `/audit/par-ville/annecy` | **présent** |
| `/fr/implementation/par-ville/albertville` | 19:15:59 | 200 | noindex, follow | → `annecy` | **présent** |
| `/fr/formations/par-ville/albertville` | 19:15:44 | 200 | noindex, follow | → `annecy` | **ABSENT** |
| `/fr/formations/par-ville/lagnieu` | 19:15:46 | 200 | noindex, follow | → `villeurbanne` | **ABSENT** |
| `/fr/un-a-un/par-ville/albertville` | 19:15:56 | 200 | noindex, follow | → `annecy` | **ABSENT** |
| `/fr/sites-web-augmentes/par-ville/albertville` | 19:16:03 | **308** → `…/annecy` | (corps rendu) | — | — |
| `/fr/sites-web-augmentes/par-ville/paris` | 19:16:05 | 200 | index, follow | self | — |
| `/fr/sites-web-augmentes/par-ville/oyonnax` | 19:22:31 | 200 | index, follow | self (2 119 mots) | — |
| `/fr/audit|formations|un-a-un|implementation/par-ville/oyonnax` | 19:21:41-49 | 200 ×4 | noindex, follow ×4 | → hub | audit + implementation seulement |
| Corps de la réponse 308 (`albertville`) | 19:16:47 | 308 | — | — | `size_download` = **820 059 o** |

### Sitemaps villes — live 19:23:54 UTC

| Sub-sitemap | URLs | dont `/en/` | lastmod |
| --- | --- | --- | --- |
| auvergne-rhone-alpes | 57 | 0 | 2026-08-13T12:24:03Z |
| bourgogne-franche-comte | 12 | 0 | idem |
| bretagne | 11 | 0 | idem |
| centre-val-de-loire | 12 | 0 | idem |
| corse | 2 | 0 | idem |
| grand-est | 23 | 0 | idem |
| hauts-de-france | 40 | 0 | idem |
| ile-de-france | 177 | 0 | idem |
| normandie | 14 | 0 | idem |
| nouvelle-aquitaine | 39 | 0 | idem |
| occitanie | 29 | 0 | idem |
| pays-de-la-loire | 23 | 0 | idem |
| provence-alpes-cote-d-azur | 41 | 0 | idem |
| **TOTAL** | **480** | **0** | — |

Images villes (19:30:13 UTC) : t1 = 40 `<loc>` / 40 `<image:loc>` · t2 = 83/83 · t3-t4 = 357/357 → **480**, cohérent avec la cohorte. `sitemap-index.xml` (19:23:36 UTC) = 38 sitemaps, **aucune** entrée `services-villes` ; `/sitemap/services-villes-audit.xml` = **404**.

### Similarité inter-villes (12 pages réelles, fetch 19:15-19:17 UTC, calcul 19:18 UTC)

| Mesure | Résultat |
| --- | --- |
| Texte visible par page | 1 527 à 1 752 mots (10,3-11,6 Ko) |
| Jaccard 6-grammes **brut**, 66 paires | 0,382 → 0,505 |
| Jaccard 6-grammes **après masquage du nom de ville** | min 0,444 · **médiane 0,519** · max 0,602 |
| Shingles propres à une page (vs 11 voisines) | 20,0 % (bellerive) → 30,6 % (paris) |
| Verdict du script maison (`t4-similarity-check`, 2 157 fichiers, 19:19 UTC) | 94,1 % phrases uniques · boilerplate 20,0 % · « ✅ OK » |
| Phrase la plus partagée | `"audit sur place {{price:audit-flash|flat}}"` — **506 villes** |

### Meta-descriptions (analyse des 2 153 `directAnswerFr`, 19:31 UTC)

| Mesure | Résultat |
| --- | --- |
| Longueur moyenne `directAnswerFr` | 362 caractères (tronqué à 155 en meta) |
| Préfixe de 80 c. le plus fréquent (toutes villes) | 1 854 / 2 153 |
| Idem, villes **indexables** | 242 / 476 ; cumul des 3 premiers préfixes = **308 / 476 (65 %)** |

### Autres

| Contrôle | Heure UTC | Résultat |
| --- | --- | --- |
| Tokens `{{price…}}` non résolus dans le HTML (20 pages) | 19:24:11 | **0** — invariant décision 4 respecté |
| hreflang sur page ville | 19:15:05 | `fr` + `x-default` seulement (EN correctement absent) |
| `/api/markdown/ville/paris` | 19:34:48 | 404 « Unknown content type: ville » |
| Liens `par-ville` depuis les 5 hubs services | 19:36:03 | 0 / 0 / 0 / 0 / 0 |
| Liens `par-ville` depuis les hubs villes (paris, oyonnax) | 19:15-19:17 | 0 |
| JSON-LD dans le HTML brut d'une page ville | 19:15:05 | 2 blocs (`Place` + graphe racine) ; FAQPage/LocalBusiness/Service/AggregateOffer/BreadcrumbList/ItemList = **0** |

---

## Limites

1. **Aucun accès DB** (D4 n'est pas dans la liste A3/B6/D1/D5/D8/F7) : je n'ai pas pu compter les lignes `GeneratedVilleCopy` par statut, ni vérifier si des copies `approved` en DB (fallback `resolve-with-copy.ts`) diffèrent des fichiers TS. Impact : nul sur les conclusions (les 2 157 villes ont un copy statique qui gagne toujours la priorité), mais le stock DB reste non inventorié.
2. **Aucune donnée GSC/Bing de première main** : les positions/impressions citées viennent de `F2-gsc-bing.md`. La corrélation entre la duplication de meta-descriptions et le CTR ÷ 2,7 est **plausible, non démontrée**.
3. **Similarité mesurée sur 12 pages**, pas sur les 480 (contrainte de charge machine : chaque page pèse ~1,28 Mo). Les valeurs médianes sont donc indicatives ; à l'échelle des 480 la part de shingles propres ne peut que baisser, jamais monter.
4. **Détection des prix « nus » par regex lexicale** : ~15-20 % de faux positifs constatés à la lecture (« débutent à », « démarre à » non couverts par ma liste initiale, partiellement corrigés). Le finding est marqué `[À CONFIRMER]` et n'est pas chiffrable au token près sans relecture humaine.
5. **`scripts/gen-indexable-villes.ts` non exécuté** (il écrit dans `src/`, interdit en audit-only) : la synchronisation du fichier généré a été vérifiée par recalcul indépendant en lecture seule (0 écart) — équivalent, mais pas identique à l'exécution du script.
6. **Aucun rendu local, aucun Lighthouse, aucun build** : l'impact Web Vitals du patch « JSON-LD inline » (P1) est estimé d'après les commentaires du code (−300/−500 ms TBT annoncés à l'époque), pas mesuré. Ce patch **exige** une mesure avant merge.
7. **Fenêtre post-deploy** : toutes les mesures live sont prises 40-60 min après le deploy de 18:36 UTC, avec un autre deploy en vol depuis 18:54 UTC. Les pages villes n'étant pas DB-driven, aucun résultat n'est affecté ; en revanche les compteurs de cache CF (`Age`) et les `MISS` observés sur les villes T2/T4 sont typiques d'un cache fraîchement purgé, et ne sont pas représentatifs du régime permanent.
8. **`reachableButNotInSitemap` de C4** (BFS plafonné à 400 pages / profondeur 6) sous-estime l'îlot par-ville ; mes propres comptages de liens sont exhaustifs page par page mais portent sur 8 pages sources seulement.

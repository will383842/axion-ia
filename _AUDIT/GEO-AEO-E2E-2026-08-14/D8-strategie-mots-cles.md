# D8 — Stratégie mots-clés

- **Date** : 2026-08-14, mesures live 18:30–18:40 UTC (⚠️ deploy atterri à ~18:24 UTC pendant l'audit — containers redémarrés, sans impact sur les mesures DB).
- **Périmètre réellement couvert** : `src/content/keywords/**` (banque de 1 839 seeds, 41 fichiers), `src/server/content-gen/keyword-templates.ts`, `keyword-selector.ts`, `keywords/keyword-catalog.ts`, `lib/keyword-lock.ts`, `src/server/queue/workers/keyword-opportunity-detector.ts` + `content-keyword-sync-worker.ts`, `src/server/content-gen/seo/gsc-client.ts`, `prisma/seeds/content-gen/seed-keywords.ts`, enregistrement crons (`queues.ts`, `worker.ts`), tables prod `keywords` + `keyword_tracking` + `content_gen_config` (SELECT only via `ssh axion-prod`), couverture des requêtes cœur et matrice intent × service × géo (script d'analyse statique tsx, lecture seule).

## Résumé exécutif

L'infrastructure mots-clés est riche (1 839 seeds, clusters anti-cannibalisation, sélecteur atomique Postgres, templates géo 2 100 villes, sync GSC câblé, crons enregistrés) mais **la boucle est morte aux deux bouts**. En amont : la banque stratégique n'a **jamais alimenté une seule génération** (1 835 keywords en DB depuis le 16 juin, `usage_count = 0` partout). En aval : le suivi GSC est **gelé depuis le 20 juillet** parce que le kill-switch OpenAI (actif depuis le 22 juillet) bloque aussi le sync GSC pourtant gratuit — et le détecteur d'opportunités est structurellement inerte (`axionOpportunity` n'est écrit nulle part). S'y ajoute un trou stratégique : le terme « Qualiopi » est **banni** de la banque sur une prémisse périmée de juin (« Axion-IA n'a pas Qualiopi »), alors que la certification est acquise et affichée en prod — la famille de requêtes cœur « organisme de formation IA Qualiopi <ville> » a une couverture **zéro**.

## Findings

### [P1] La banque stratégique de 1 835 mots-clés n'a JAMAIS alimenté une génération en prod

- **Symptôme** : le pool DB `keywords` — le cœur de la stratégie (rotation équitable, clusters anti-cannibalisation, isolation par campagne) — est décoratif : aucun keyword n'a jamais été réservé par le sélecteur.
- **Preuve code** : `src/server/queue/workers/content-gen-worker.ts:390` appelle bien `selectKeywordRich` mais **seulement** quand le job n'a pas de `primaryKeyword` explicite ; or (a) le wizard campagne pré-remplit les keywords depuis `src/server/content-gen/keywords/keyword-catalog.ts:13` (≈ 60 mots-clés statiques, disjoints de la banque) → jobs avec keyword explicite, sélecteur jamais sollicité ; (b) pour les campagnes ville-anchored, `src/server/content-gen/keyword-selector.ts:135-143` court-circuite **avant** la requête DB (`if (city) { … return … }`) et `generateGeoKeywords` ne retourne jamais vide (fallback transversal, `keyword-templates.ts:111`) → même une ville top-100 avec seeds en dur en DB n'y touche jamais.
- **Preuve live** (2026-08-14 18:34 UTC, `psql` prod) : `SELECT sum(usage_count), min(created_at) FROM keywords` → `0 | 2026-06-16` ; `count(last_used_at)` = **0 sur les 6 verticales** (1 835 rows). Or du contenu géo a bien été généré et publié depuis (les 15 URLs trackées `/fr/blog/*grenoble*` en attestent).
- **Root-cause** : deux chemins d'alimentation (catalogue wizard + templates géo) passent devant la banque ; personne ne lance de campagne « sans keywords » qui déclencherait le sélecteur DB.
- **Patch prescrit** : (1) dans le wizard, proposer « puiser dans la banque stratégique » comme source par défaut (le pool campagne = sous-ensemble de `keywords` via `campaign_id`, déjà supporté par la migration 20260625120100) ; (2) dans `selectKeywordRich`, faire du mode géo un **fallback** après épuisement des seeds DB `is_local` de la ville (100 keywords `is_local` existent en DB, jamais servis).
- **Effort** : M. **Impact GEO/AEO** : fort (toute la couche intent/cluster/rotation est aujourd'hui contournée).
- **Risque régression** : moyen — ne pas casser la rétro-compat `campaignId` absent (requête historique byte-pour-byte, `keyword-selector.ts:149-154`) ni le lock `FOR UPDATE OF k SKIP LOCKED`. Do-not-touch : `src/server/content-gen/lib/keyword-lock.ts` (2e niveau de défense), test `keyword-selector.spec.ts`.

### [P1] « Qualiopi » banni de la banque sur une prémisse périmée — couverture ZÉRO de la famille « organisme de formation IA Qualiopi »

- **Symptôme** : la requête cœur « organisme formation IA Qualiopi <ville> » (explicitement listée dans la mission D8 du prompt maître) est inatteignable : aucun seed, aucun keyword DB, et tout futur seed contenant « Qualiopi » serait silencieusement supprimé.
- **Preuve code** : `src/content/keywords/master.ts:57` (`BANNED_TERMS = [... "Qualiopi" ...]`) avec la justification `master.ts:71-74` : « 2026-06-02 — Axion-IA n'a NI Qualiopi NI OPCO/CPF » — **périmée** : la certification Qualiopi est acquise (logo déployé partout le 2026-08-11, PR #570/572/575). Le ban est verrouillé par le test `src/content/keywords/__tests__/v12-correction.spec.ts:178`.
- **Preuve live** (18:34-18:35 UTC) : DB prod `SELECT count(*) FROM keywords WHERE term ILIKE '%qualiopi%'` → **0** ; les 4 keywords `%organisme%formation%` ciblent les OF comme *clients*, pas Axion-IA comme OF certifié ; `curl https://axion-ia.com/fr` → 200, **2 mentions « Qualiopi »** dans le HTML de la home. Le site revendique la certification que sa stratégie mots-clés s'interdit de cibler.
- **Root-cause** : décision anti-publicité-trompeuse de juin 2026 (légitime à l'époque), jamais révisée après l'obtention de la certification.
- **Patch prescrit** : retirer **uniquement** le token `"Qualiopi"` de `BANNED_TERMS` (master.ts) et de `FORBIDDEN_IN_KEYWORD` (v12-correction.spec.ts), puis ajouter un cluster de seeds « organisme de formation IA certifié Qualiopi » (national + villes clés) → `urlCible` vers les pages formation. **Conserver** les bans OPCO/CPF/financement/subvention : Qualiopi ≠ enregistrement CPF/EDOF, et tout claim de finançabilité reste une décision légale de Will (STOP & ASK avant d'aller au-delà de la seule certification).
- **Effort** : S (lever le ban) + M (cluster de seeds). **Impact GEO/AEO** : fort — « formation IA + Qualiopi » est un différenciateur commercial à forte intention, quasi sans concurrence IA-spécialisée.
- **Risque régression** : faible si on ne touche que le token Qualiopi. Do-not-touch : les autres entrées de `BANNED_TERMS`, la décision « jamais de logo OPCO/FT/CPF », les seeds prose villes `{{price|flat}}` (décision actée 4).

### [P1] Le kill-switch OpenAI gèle aussi le sync GSC (gratuit) — tracking aveugle depuis le 20 juillet, détecteur d'opportunités à l'arrêt en cascade

- **Symptôme** : plus aucune donnée de position/impressions/CTR depuis 25 jours ; les crons hebdo tournent mais sortent immédiatement.
- **Preuve code** : `src/server/queue/workers/content-keyword-sync-worker.ts:63-69` — `readContentGenConfig("kill_switch")` → si actif, `skip run` ; or ce worker n'appelle **que** l'API GSC (gratuite, `gsc-client.ts`), aucun LLM. En cascade : `keyword-opportunity-detector.ts:43` ne scanne que `syncedAt ≥ now − 14 j` → 0 rows scannés dès le 2026-08-03.
- **Preuve live** (18:34 UTC, DB prod) : `content_gen_config.kill_switch` = `{"active": true, "reason": "Quota OpenAI toujours epuise", "activatedAt": "2026-07-22"}` ; `SELECT max("syncedAt") FROM keyword_tracking` → **2026-07-20 04:00** (3 runs hebdo manqués : 27/07, 03/08, 10/08) ; les 4 env vars `GSC_OAUTH_*` + `GSC_PROPERTY_URL` sont bien présentes dans les containers web et worker (noms vérifiés 18:36 UTC) — les credentials ne sont PAS le blocage.
- **Root-cause** : couplage volontaire mais trop large (commentaire l.61-62 « GSC/SerpAPI quota+coût ») : le kill-switch conçu pour stopper la dépense LLM éteint aussi l'observabilité gratuite. NB : la recharge OpenAI elle-même est un « reste Will » déjà acté (revue console 08-04) — **non re-signalé ici** ; le finding porte sur le couplage.
- **Patch prescrit** : exempter `content-keyword-sync` du kill-switch global (ou introduire une clé `kill_switch_gsc` distincte, défaut inactive). 3 lignes.
- **Effort** : S. **Impact GEO/AEO** : moyen-fort (sans données de position, ni refresh priorisé ni détection d'opportunités ne peuvent fonctionner).
- **Risque régression** : quasi nul (GSC quota 1 200 req/min, le run hebdo ≤ 500 requêtes). Do-not-touch : le kill-switch pour tout ce qui appelle un LLM.

### [P1] Détecteur d'opportunités structurellement inerte : `axionOpportunity` n'est jamais écrit, alertes concurrents jamais implémentées

- **Symptôme** : le cron « keyword-opportunity-detector » (lundi 06:00 UTC, enregistré `queues.ts:1251-1262`, démarré `worker.ts:125`) tourne depuis mai sans jamais produire une seule suggestion de campagne ni une alerte concurrent.
- **Preuve code** : la branche opportunité exige `tracking.axionOpportunity === "high"` (`keyword-opportunity-detector.ts:56`) mais **aucun code n'écrit jamais ce champ** — grep exhaustif : seules occurrences = `prisma/schema.prisma:4014` (définition) et la lecture l.56. De plus le docblock (l.9 : « Concurrent passe devant nous → alerte Telegram ») promet une fonctionnalité inexistante : `stats.competitorAlerts` n'est jamais incrémenté (initialisé l.33, jamais modifié).
- **Preuve live** (18:34 UTC) : `SELECT axion_opportunity, count(*) FROM keyword_tracking GROUP BY 1` → `NULL | 64` (100 % NULL).
- **Root-cause** : « Skeleton V1 » (l.11) jamais complété — le producteur de la donnée n'a jamais été écrit.
- **Patch prescrit** : calculer `axionOpportunity` dans le sync-worker à l'upsert (règle simple défendable : `high` si position 11-30 ET impressions ≥ 20 sur 28 j ; `medium` si position 31-50 ET impressions ≥ 10) ; retirer la promesse « concurrent » du docblock ou l'implémenter.
- **Effort** : M. **Impact GEO/AEO** : moyen (c'est la seule boucle « GSC → suggestion de contenu » du système).
- **Risque régression** : faible. Do-not-touch : la mise à jour `ourCurrentRank/ourBestRank` (l.82-94) qui fonctionne.

### [P1] Le tracking GSC ne couvre que les Articles blog/news — les requêtes cœur nationales et les pages stratégiques sont invisibles

- **Symptôme** : impossible de répondre à « sommes-nous positionnés sur *formation IA entreprise* / *audit IA PME* ? » avec les données du système : ces requêtes ne sont suivies pour aucune page.
- **Preuve code** : `content-keyword-sync-worker.ts:74-83` — `prisma.article.findMany({ status: "published", indexationTier: tier1|tier2 })` : seuls les Articles entrent dans `keyword_tracking`. Aucun sync pour les pages services (`/fr/audit`, `/fr/interventions-formations`…), les landings villes, la home, les guides.
- **Preuve live** (18:34 UTC) : `SELECT count(DISTINCT "targetUrl") FROM keyword_tracking` → **15**, toutes `/fr/blog/*` orientées Grenoble/Isère. Les 64 keywords trackés sont tous locaux (« coaching individuel ia grenoble », « formation ia pour entreprises grenoble »…) — zéro requête nationale cœur.
- **Root-cause** : le worker a été conçu pour la boucle de vie des articles générés (Sprint 12.5), jamais étendu aux pages money.
- **Patch prescrit** : ajouter au sync une liste statique des ~15 pages stratégiques (constante partagée, cf. budget Web Vitals qui les nomme déjà) traitées comme les articles (mêmes upserts `keyword_targetUrl`).
- **Effort** : M. **Impact GEO/AEO** : fort (pilotage des requêtes qui rapportent).
- **Risque régression** : faible ; attention à `articleId` nullable dans `KeywordTracking` pour les pages non-articles (vérifier la contrainte avant).

### [P2] 31 seeds silencieusement perdus par la composition intent-filtrée de `master.ts`

- **Symptôme** : des seeds valides des fichiers de base n'arrivent jamais dans `ALL_KEYWORD_SEEDS` (donc ni en DB ni au fallback in-memory).
- **Preuve code** : `ALL_KEYWORD_SEEDS` (`master.ts:177-211`) est l'union d'exports **filtrés par intent** dont les listes d'inclusion sont incomplètes : `KW_AEO` (l.137-148) n'inclut pas `KW_IMPLEMENTATION_G3`/`KW_CODAGE_G3` → 10 seeds `aeo` perdus ; `KW_SECTORIEL` (l.160-168) n'inclut ni `KW_COACHING_G6` (10 perdus) ni `KW_AUDIENCES_G8` (6) ; `KW_BENEFICE` (l.111-122) n'inclut pas G8 (4) ; aucun export ne récupère l'intent `local` des fichiers de base (1 seed G2). Total mesuré par exécution réelle du module (tsx, 18:15 UTC) : **31 seeds droppés** (hors bannis), dont « combien de temps pour implémenter l'IA en PME ? » (aeo) et tout le bloc coaching-dirigeant sectoriel de G6.
- **Preuve live** : DB prod = 1 835 keywords = exactement les seeds survivants (1 839 − 4 doublons intra-banque) — les 31 perdus n'y sont pas.
- **Root-cause** : pattern « re-lister chaque fichier dans chaque export filtré » : tout nouvel intent ou fichier oublié dans une liste = perte silencieuse, aucun test ne compare l'union brute au total.
- **Patch prescrit** : construire `ALL_KEYWORD_SEEDS` = union brute de tous les fichiers `.filter(isClean)` + dédup par keyword, et dériver les exports par intent depuis ALL (`ALL.filter(s => s.intent === …)`). Ajouter un test « aucun seed source propre n'est absent de ALL ».
- **Effort** : S. **Impact GEO/AEO** : faible-moyen (31/1 870, mais mécanisme piégeux).
- **Risque régression** : faible — vérifier que les tests `keywords-perfection.spec.ts` et `csv-integration.spec.ts` (comptages) sont ajustés.

### [P2] `BANNED_TERMS` matche le JSON complet du seed → 23 seeds nukés par collatéral, dont des seeds marque

- **Symptôme** : des seeds à haute valeur disparaissent parce qu'un mot banni apparaît dans leur **note interne** ou un H2 — pas dans le keyword.
- **Preuve code** : `master.ts:88-91` — `isClean` fait `JSON.stringify(seed).toLowerCase().includes(banni)`. Exemples mesurés (23 au total) : « **Axion-IA formation IA entreprise avis** » (seed marque, brand SERP) banni parce que sa note dit littéralement « *pas de mention financement certifié* » (`h-notoriete.ts:157` — une instruction de NE PAS mentionner le financement fait bannir le seed) ; « guide IA PME 2026 complet démarrage » banni pour un H2 « Budget et financement : combien coûte l'IA… » (`g1-audit.ts:1257`) ; « cabinet IA vs organisme de formation IA », « Axion-IA cabinet IA franco-européen », etc.
- **Preuve live** : absents de la DB prod (1 835 rows, vérifié 18:34 UTC — p. ex. 0 row `term ILIKE '%axion-ia formation ia entreprise avis%'` impliqué par le count global cohérent).
- **Root-cause** : filtre substring sur l'objet entier au lieu des champs exposés (keyword + injection).
- **Patch prescrit** : restreindre `isClean` à `keyword` + `injection` (+ `variables`), et réécrire les 2-3 notes/H2 fautifs. Le test v12 ne vérifie déjà que le champ `keyword` (`v12-correction.spec.ts:190-202`) — l'aligner.
- **Effort** : S. **Impact GEO/AEO** : moyen (seeds marque et comparatifs perdus).
- **Risque régression** : vérifier ensuite qu'aucun seed réintégré ne porte de claim de financement dans ses champs *affichables*.

### [P2] `TOP_100_VILLES_FRANCE` contient 6 doublons (94 villes uniques)

- **Symptôme** : la liste « top 100 villes » servant de référence aux seeds géo en dur compte 100 entrées mais 94 uniques.
- **Preuve code** : `src/server/content-gen/keyword-templates.ts:150-252` — en double : Caen (l.185 + 215), Toulon (l.169 + 224), Chambéry (l.207 + 226), Metz (l.189 + 227), Roubaix (l.192 + 229), Rouen (l.183 + 248).
- **Preuve live** : n/a (constante compile-time, pas de surface prod directe). `[À CONFIRMER]` l'impact aval : la liste semble surtout documentaire (les seeds géo en dur vivent dans les fichiers g*c), aucun consommateur runtime trouvé par grep hors tests.
- **Root-cause** : liste assemblée manuellement en deux passes (11-50 / 51-100).
- **Patch prescrit** : dédupliquer et compléter à 100 avec 6 vraies villes (Angoulême, Belfort, Vannes, Arras, Blois, Tarbes…).
- **Effort** : S. **Impact GEO/AEO** : faible.

### [P2] Trous de matrice résiduels + micro-dettes

- **Cibles déclarées quasi vides** (`types.ts:46-62` promet 16 segments) : `syndicat-patronal` 1 seed, `association-professionnelle` 2, `cci-chambre-metiers` 3, `prescripteur` 4, `sous-traitant-dev` 5 — audiences listées mais non travaillées (mesure tsx 18:15 UTC). `organisme-formation` : 10 seeds, tous « OF comme client ».
- **Module `maintenance-ia`** : 1 seul seed dans toute la banque, et injoignable — aucun vertical ne mappe vers lui (`keyword-selector.ts:33-41`) ; en DB il est reversé dans `transversal` (`seed-keywords.ts:36`). Soit le supprimer du type, soit le doter.
- **`transversal` sans intents AEO modernes** : 0 seed `voice_search`/`ai_overview`/`featured_snippet`/`local` sur le module transversal (matrice mesurée) — les questions génériques « quel cabinet IA choisir en France ? » n'existent qu'en `aeo` historique.
- **4 keywords dupliqués inter-fichiers** (même `keyword` dans 2 fichiers, ex. « audit IA cabinet expertise comptable ») — l'upsert DB par `term` en écrase silencieusement un des deux (métadonnées du dernier seedé gagnent).
- **Doc drift** : `master.ts:5` renvoie vers `/admin/content-gen/keyword-engine` ; les pages réelles sont `content-gen/keyword-strategy` et `content-gen/keyword-tracking` (vérifié sur l'arborescence).
- **Effort** cumulé : S-M. **Impact** : faible individuellement.

## Mesures brutes

### DB prod (ssh axion-prod → psql axionia, SELECT only)

| Mesure | Valeur | Horodatage UTC |
|---|---|---|
| `keywords` total | 1 835 | 2026-08-14 18:34:17 |
| `keywords` par verticale | interventions_formations 371 · audits 332 · sites_web_augmentes 317 · un_a_un 303 · implementations 298 · transversal 214 | 18:34:17 |
| `count(last_used_at)` par verticale | **0 partout** | 18:34:17 |
| `sum(usage_count)` / `min(created_at)` | **0** / 2026-06-16 | 18:34:27 |
| `keywords` avec `campaign_id` | 0 (pools par campagne jamais utilisés) | 18:34:27 |
| `keywords` `is_local` / avec `cluster_id` | 100 / 1 835 (100 %) | 18:37 |
| `term ILIKE '%qualiopi%'` | **0** | 18:34:17 |
| `keyword_tracking` total / URLs distinctes / `max(syncedAt)` | 64 / 15 / **2026-07-20 04:00:14** | 18:34:27 |
| `axion_opportunity` | NULL × 64 (100 %) | 18:35 |
| `content_gen_config.kill_switch` | `active: true`, « Quota OpenAI toujours epuise », depuis 2026-07-22 | 18:35 |
| Env containers web+worker | `GSC_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN` + `GSC_PROPERTY_URL` présents (noms seulement) | 18:36 |
| Worker container | redémarré 18:24:34 UTC (deploy en vol atterri) — logs pré-restart perdus | 18:36 |

### Top keywords GSC trackés (fenêtre figée au 2026-07-20)

| Keyword | URL | Position | Impressions | Clicks |
|---|---|---|---|---|
| coaching individuel ia grenoble | /fr/blog/coach-ia-grenoble-guide-pratique | 2,00 | 52 | 0 |
| formation ia pour entreprises grenoble | /fr/blog/cours-ia-grenoble-entreprise-faq | 8,31 | 32 | 0 |
| coaching individuel ia grenoble | /fr/blog/coaching-ia-dirigeant-grenoble | 1,27 | 26 | 0 |
| formation ia pour entreprises grenoble | /fr/blog/accompagnement-ia-entreprise-grenoble-faq | 27,09 | 22 | 0 |

(64 rows, 100 % locales Grenoble/Isère, **0 click** sur toutes les top rows — positions 1-2 avec 0 CTR = signal titres/meta à creuser, surface D7/B*.)

### Analyse statique de la banque (exécution réelle du module, tsx, 18:15 UTC)

| Mesure | Valeur |
|---|---|
| `ALL_KEYWORD_SEEDS` | 1 839 (1 835 keywords uniques, 4 dupliqués inter-fichiers) |
| Par intent | transactionnel 770 · sectoriel 217 · aeo 183 · informationnel 157 · benefice 143 · voice_search 97 · local 94 · ai_overview 48 · commercial_investigation 39 · featured_snippet 36 · comparatif 35 · partenaire 20 |
| Par module | interventions-formations 371 · audit 335 · codage-developpement 317 · coaching-1-to-1 303 · implementation 299 · transversal 213 · maintenance-ia **1** |
| Par cible | pme 889 · eti 460 · toutes-cibles 207 · tpe 84 · startup 63 · grand-compte 56 · … · cci 3 · assoc-pro 2 · syndicat-patronal 1 |
| Par niveau | HEAD (1) : 11 · BODY (2) : 747 · LONGUE TRAÎNE (3) : 1 081 |
| Seeds droppés silencieusement (filtres intent master.ts) | **31** |
| Seeds filtrés par `BANNED_TERMS` (dont collatéraux notes/H2) | **23** |
| Couverture requêtes cœur (substring) | « formation ia entreprise » 9 · « audit ia pme » 11 · « organisme formation ia » **0** · « qualiopi » **0** · « agence ia » 49 · « formation ia paris » 1 · « formation ia lyon » 1 |
| Seeds géolocalisés en dur (14 grandes villes) | 89 — paris 15, lyon 13, bordeaux 13, marseille 9, toulouse 9, nantes 8, strasbourg 7, lille 6, rennes 5, grenoble 4, nice 2, montpellier 2, dijon 2, **annecy 0** (complété au runtime par les templates géo pour campagnes ville-anchored uniquement) |

### Prod HTTP (GET only)

| URL | Status | Observation | Horodatage UTC |
|---|---|---|---|
| https://axion-ia.com/fr | 200 | 2 mentions « Qualiopi » dans le HTML | 2026-08-14 18:35 |

## Limites

- **Pas d'appel direct à l'API GSC** : les credentials vivent dans l'env prod ; les extraire pour interroger Google depuis ma machine sortait du cadre audit-only. La couverture des requêtes cœur côté Google est donc mesurée via la table `keyword_tracking` — dont la fenêtre est figée au 2026-07-20 (conséquence du finding P1 kill-switch). Les positions actuelles réelles sur « formation IA entreprise » etc. restent inconnues du système ET de cet audit.
- **Logs worker pré-deploy perdus** : le déploiement en vol a atterri à 18:24 UTC (containers recréés) → impossible de prouver par les logs le « kill switch active, skip run » des lundis 27/07-10/08 ; la preuve repose sur le triplet DB (`kill_switch` actif 22/07 + `max(syncedAt)` 20/07 + code du skip).
- **Volumes de recherche externes** (Semrush/Ahrefs) non mesurés — aucune source disponible ; la priorisation head/body/longue-traîne repose sur les champs `niveau`/`volume` déclaratifs des seeds.
- **SERP live non sondée** (pas d'outils navigateur pour cet agent ; une recherche web aurait produit une SERP non représentative de la localisation FR). Le positionnement concurrentiel « organisme formation IA Qualiopi » est inféré, pas mesuré.
- **Impact aval des 6 doublons TOP_100_VILLES** non confirmé (constante possiblement documentaire) — marqué `[À CONFIRMER]` dans le finding.
- La levée du ban « Qualiopi » a une composante **légale/business** (frontière avec les claims de financement) : patch proposé limité à la certification seule, validation Will requise avant tout élargissement.

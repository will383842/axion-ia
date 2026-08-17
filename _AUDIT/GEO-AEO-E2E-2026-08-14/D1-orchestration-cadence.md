# D1 — Orchestration & cadence (content-gen)

- **Date** : 2026-08-14, mesures live 18:12–18:20 UTC (DB prod `axionia` via `ssh axion-prod`, container postgres `u7zlql3bpb1xy5t4kg6jnvpm`, SELECT only).
- **Périmètre couvert** : `content-orchestrator-worker` (tick, distribution type/audience/intent), `content-gen-scheduler-worker`, `anti-burst`, `editorial-mix-rules`, `content-gen-deadline-checker`, `reenqueue-policy`, `type-sequence`, config DB (`content_gen_config` : `batches`, `kill_switch`, `search_intent_distribution`), cadence réelle 30 j vs configurée, alertes d'orchestration (`content-monitoring-worker` checks pipeline).
- **Hors périmètre** (autres agents) : générateurs/AEO on-page (D2), gates qualité (D3), pSEO villes (D4), KB (D5), fraîcheur (D7), mots-clés (D8), job `warm` post-deploy (A3).

## Résumé exécutif

La machine à visibilité est **à l'arrêt total depuis 21 jours** : kill switch actif depuis le 2026-07-24 (quota OpenAI épuisé — recharge = reste-Will déjà acté, non rouvert ici), dernier job créé le 24/07 21:00 UTC, campagne principale toujours « running », cadence réelle **0 contenu/jour** vs 20/j configurés. Avant l'arrêt, l'orchestration présentait trois défauts structurels mesurés : (1) le **mix d'intentions de recherche est cassé** — le tirage pondéré modulo suppose des poids entiers alors que la config prod est en fractions : résultat mesuré 66,7 % informational / 33,3 % transactional / **0 % commercial, 0 % local, 0 % navigational** sur 1 942 jobs (configuré : 40/25/15/10/10), et le code actuel donnerait 100 % informational ; (2) un **plancher de cadence à ~96 jobs/jour** rend `dailyArticles` décoratif sous 96 (mesuré 101/j créés pour 20/j configurés, ×4,8) ; (3) **aucune rétroaction échec→cadence** : 7 jours à ~101 jobs/j avec ~100 % d'échec sans pause automatique. L'anti-burst per-type existe mais est inactif en prod (`dailyTargetByType={}`).

## Findings

### [P0] Machine à contenu à l'arrêt depuis 21 jours, sans garde-fou de durée ni escalade

- **Symptôme** : cadence de génération réelle = 0 job créé et 0 contenu publié depuis le 2026-07-24 21:00 UTC, alors qu'une campagne « unlimited » est en statut `running` (`AURA + Île-de-France`, `daily_articles=20`). Pour le GEO/AEO, le moteur de production de contenus (blog, FAQ, guides, comparaisons) est éteint depuis 3 semaines.
- **Preuve code** : `src/server/queue/workers/content-orchestrator-worker.ts:604-608` — kill switch actif → `skip tick` silencieux (un `console.log`), aucune notion d'âge du kill switch, aucune escalade. `src/server/queue/workers/content-monitoring-worker.ts:337-388` — le check « pipeline stall » existe mais n'écrit qu'un bandeau admin (`ContentGenConfig.alert_pipeline_stall`) + `console.warn`, sans Telegram, et **réécrit `detectedAt` à chaque tick de 15 min** (l.368/377) : l'âge réel du blocage est perdu (un arrêt de 21 jours s'affiche comme « depuis 4 h »).
- **Preuve live (2026-08-14 18:12–18:16 UTC, DB prod)** :
  - `content_gen_config.kill_switch` = `{"active": true, "reason": "Quota OpenAI toujours epuise - regel manuel", "activatedAt": "2026-07-22"}`, `updatedAt` 2026-07-24 21:12 UTC.
  - `SELECT max("createdAt"), max("completedAt") FROM content_gen_jobs` → `2026-07-24 21:00:00` / `2026-07-24 21:00:03`.
  - `alert_pipeline_stall` = `{"active": true, ..., "detectedAt": "2026-08-14T18:15:00Z"}` — re-upserté 3 minutes avant la mesure : le worker tourne, mais l'alerte ne dit pas depuis quand.
  - Backlog gelé : 377 jobs `needs_review` + 56 `quality_improving` + 1 `approved` en attente depuis ≥ 21 j.
- **Root-cause** : le kill switch (armé manuellement, à raison, le 24/07) n'a ni TTL, ni alerte d'ancienneté, ni lien avec le statut des campagnes ; l'alerte stall écrase son propre horodatage. La recharge du compte OpenAI est un **reste-Will déjà acté** (revue console #533) — ne pas le re-signaler ; le finding D1 est l'absence de garde-fou de durée côté orchestration.
- **Patch prescrit** : (a) dans `content-monitoring-worker` check 3, ne réécrire `detectedAt` que si l'alerte n'était pas déjà active (préserver le premier horodatage) et ajouter l'âge en jours dans le message ; (b) ajouter une alerte Telegram (helpers existants `content-gen-alerts.ts`) « kill switch actif depuis > 48 h avec ≥ 1 campagne running », émise 1×/jour max.
- **Effort** : S. **Impact GEO/AEO** : fort (c'est la cadence entière du site). **Risque de régression** : faible (~5 %) — alerting only ; do-not-touch : la logique de skip du kill switch elle-même (`content-orchestrator-worker.ts:604-608`), le contrat stub `stub.invalid`.

### [P0] Mix d'intentions de recherche cassé : 0 % commercial / local / navigational généré (sampler modulo × poids fractionnaires)

- **Symptôme** : la distribution d'intentions configurée (40 % informational, 25 % commercial, 15 % transactional, 10 % local, 10 % navigational) n'est pas respectée : les jobs générés sont à 66,7 % informational / 33,3 % transactional, et **zéro** job commercial_investigation, local ou navigational n'a jamais été créé par l'orchestrateur. Conséquence AEO/GEO directe : aucun contenu à intention locale (donc `hasLocalBusinessJsonLd` jamais posé — `content-gen-worker.ts:737`), aucun contenu commercial (comparatifs orientés conversion), sur une campagne pourtant **géographique** (AURA + IdF).
- **Preuve code** :
  - `content-orchestrator-worker.ts:80-96` — `sampleWeighted` calcule `position = (slotIndex + seed) % total` puis balaye les poids cumulés : c'est un échantillonneur **cyclique sur des poids entiers**. Avec des poids fractionnaires de somme 1, `n % 1 = 0` pour tout entier → toujours la première clé.
  - `content-orchestrator-worker.ts:660-661` — le commentaire « Les poids sont RELATIFS ici (tirage pondéré) : l'échelle n'a pas d'importance » est **faux** pour ce sampler : l'échelle est déterminante.
  - La config prod est en fractions (somme 1) et `resolveIntentDistribution` les renvoie telles quelles (`src/server/content-gen/intent-distribution-schema.ts:157-170`) ; le mix global est injecté dans toute campagne sans mix propre (`content-orchestrator-worker.ts:669-681`) puis échantillonné l.556 (parallel) / l.462 (sequential).
  - Aggravant : l'injection du mix global rend `intentMix` non-null pour toutes les campagnes → `allowKeywordIntent = !intentMix` = false (l.591/478) → le garde-fou 2026-06-25 « l'intent natif du mot-clé prime » est **mort en prod** tant que la config globale existe.
- **Preuve live (2026-08-14 18:13–18:14 UTC, DB prod)** :
  - `content_gen_config.search_intent_distribution` = `{"local": 0.1, "navigational": 0.1, "informational": 0.4, "transactional": 0.15, "commercial_investigation": 0.25}` (fractions, somme 1).
  - Campagne running `cmr5wp6ue0041d2wgxvp3s2kc` : `searchIntentMix` = NULL → fallback global.
  - Jobs 45 j : campagne principale = **1 295 informational / 647 transactional** (ratio 2,002:1 — exactement le 2:1 prédit par le code pré-fix-alias où `commercial=0`, total 0,75, positions modulo cyclant {0 ; 0,25 ; 0,5} → info, info, transactional), **0** commercial/local/navigational. Stable chaque semaine (ex. sem. du 07-13 : 478/221).
  - Simulation du code **actuel** de `main` avec la config prod (node, 2 000 slots, 2026-08-14 18:14 UTC) : `{ informational: 2000 }` — le fix alias du 2026-08-03 (qui restaure `commercial=0.25`, total = 1) transforme le biais 2:1 en **100 % informational** dès que la génération redémarrera.
- **Root-cause** : incompatibilité d'échelle entre la config stockée (fractions somme 1) et `sampleWeighted` (conçu pour des pourcentages entiers, cycle modulo-somme). Le bug était partiellement masqué avant le 08-03 par l'alias `commercial` perdu (total 0,75 → cycle dégénéré à 3 positions).
- **Patch prescrit** : dans l'orchestrateur, normaliser le mix global en **entiers** avant échantillonnage — `toPourcentages()` existe déjà (`intent-distribution-schema.ts:184-190`) : `globalIntentMix = arrondi(toPourcentages(intentDist))` (avec `Math.round`, redistribuer le delta d'arrondi sur la clé max pour garder somme 100). Alternative plus robuste : échantillonner l'intent via `buildWeightedSequence` (`scheduler/type-sequence.ts:17-36`, insensible à l'échelle) comme c'est déjà fait pour les types. Ajouter un test « poids fractionnaires somme 1 → distribution respectée ».
- **Effort** : S. **Impact GEO/AEO** : fort (diversité d'intentions = cœur de la doctrine AEO ; contenu local = pSEO). **Risque de régression** : faible-moyen (~10 %) — change la distribution des FUTURS contenus (voulu) ; do-not-touch : `resolveIntentDistribution` et sa lecture « en bloc » (`readContentGenConfig(..., {})`, piège documenté 2026-08-04), les mixes per-campagne existants, décision actée n°4 (prix) sans rapport.

### [P1] Plancher de cadence : `dailyArticles` est décoratif sous 96/jour (mesuré ×4,8 la cible)

- **Symptôme** : la campagne configurée à **20 articles/jour** a créé **~101 jobs/jour** (mesuré du 15 au 24/07 : 101, 101, 101, 93, 101… par jour, dont ~96 orchestrateur + ~5 RSS). Sur-génération ×4,8 → consommation de quota provider accélérée (contexte de l'épuisement OpenAI du 22/07), coût et bruit inutiles (le coût reste modeste : 12–18 $/sem mesuré, mais le quota requêtes est le vrai plafond).
- **Preuve code** : `content-orchestrator-worker.ts:773-775` — `perCampaignTick = Math.max(1, Math.ceil(dailyArticles / 96))` : pour tout `dailyArticles ∈ [1..96]`, le résultat est 1 job/tick × 96 ticks/jour = **96/jour minimum**. Aucun décompte « créés aujourd'hui » n'existe en mode per-campaign (le décompte quotidien n'existe qu'en mode per-type, l.692-714). Cron 15 min : `src/server/queue/queues.ts:1035-1046`.
- **Preuve live (2026-08-14 18:12 UTC, DB prod)** : `coverage_campaigns` → campagne running `daily_articles=20` ; `content_gen_jobs` groupés par jour (30 j) → 101/101/101/93/101/101/101/101/90 créés/jour du 15 au 24/07 (seule campagne running sur la période, la 2e pausée depuis le 02/07).
- **Root-cause** : le plancher `Math.max(1, …)` par tick, sans cap quotidien par campagne — l'anti-burst (`scheduler/anti-burst.ts:45-72`), qui fait exactement ce décompte, n'est branché que sur le mode per-type, inactif en prod (`batches.dailyTargetByType = {}`, vérifié DB 18:13 UTC ; `antiBurstEnabled: true` y est donc décoratif).
- **Patch prescrit** : en mode per-campaign, compter les jobs créés aujourd'hui pour la campagne (`count where campaignId + createdAt >= startOfDayUTC + status != cancelled`) et appliquer la même logique que `computeAntiBurstSchedule` (expected = ceil(t/86 400 000 × dailyArticles), enqueue = expected − créés, borné ≥ 0 — donc **supprimer le plancher 1**). Réutiliser la fonction pure existante avec une cible mono-« type » virtuelle par campagne.
- **Effort** : S-M. **Impact GEO/AEO** : moyen (maîtrise du rythme = fraîcheur régulière plutôt que rafales, et survie du quota provider). **Risque de régression** : moyen (~15 %) — une campagne à forte cible pourrait être ralentie si le décompte est faux ; do-not-touch : `computeAntiBurstSchedule` (testée), l'idempotencyKey (l.254-260) qui dépend de `slotIndex`.

### [P1] Aucune rétroaction échec → cadence : 7 jours à ~101 jobs/jour avec ~100 % d'échec

- **Symptôme** : du 18 au 24/07, l'orchestrateur a continué à créer ~101 jobs/jour alors que **tout échouait** (18/07 : 101/101 failed ; 21→24/07 : 101, 101, 101, 90 failed = 100 %). Résultat cumulé : 1 451 failed sur la campagne (75 % des 1 942 générés), rendement publié 83/1 942 = **4,3 %**.
- **Preuve code** : la boucle de tick (`content-orchestrator-worker.ts:725-812`) ne lit jamais `failedCount` ni aucun taux d'échec récent avant d'enqueue. Le check « reject_spike > 50 %/1 h » existe (`content-monitoring-worker.ts:298-335`) mais n'écrit qu'un bandeau admin — aucun throttle, aucune pause de campagne, pas de Telegram. Le circuit breaker provider existe (55 échecs « Circuit breaker open for openai » mesurés) mais en aval : les jobs sont déjà créés et partent en `failed`.
- **Preuve live (2026-08-14 18:15 UTC, DB prod)** : top erreurs 45 j — `OpenAI rate limited` : 949, `OpenAI quota épuisé… 429` : 241, `Connection error` : 94, `Circuit breaker open for openai` : 55, `Anthropic API 400 invalid_request_error` : 128 (le fallback `anthropic`, câblé en dur `content-orchestrator-worker.ts:299-300`, échouait aussi — crédit Anthropic épuisé, fait déjà connu, non rouvert). `alert_reject_spike` aujourd'hui : `active: false` (résolu par… l'absence totale de jobs).
- **Root-cause** : l'orchestration est open-loop — la cadence de création ignore l'état de santé du pipeline aval.
- **Patch prescrit** : au début du tick, si (jobs terminés sur 1 h > 5 ET taux failed > 80 %) OU circuit breaker provider primaire ouvert → **skip le tick** (log + réutiliser l'upsert `alert_reject_spike`), avec reprise automatique dès que le taux retombe. Ne pas toucher au statut des campagnes (pas de pause auto destructive).
- **Effort** : M. **Impact GEO/AEO** : moyen (protège quota + évite les pools de mots-clés consommés pour rien — chaque job failed a potentiellement verrouillé/consommé un mot-clé du pool). **Risque de régression** : moyen (~15 %) — un seuil mal calibré gèlerait la production ; do-not-touch : `reenqueue-policy.ts` (fix zombies 2026-07-17, vérifié sain), les retries BullMQ per-job.

### [P1] La cadence pilotée est celle des *jobs créés*, jamais celle des *contenus publiés*

- **Symptôme** : aucun réglage ni alerte ne porte sur le seul chiffre qui compte pour le GEO : contenus **publiés**/jour. Sur 30 j : 0 publié/jour depuis le 24/07 ; avant : 0 à 23 publiés/jour, très loin des 20/j « configurés » (le 20/j configure la création de jobs, dont 4,3 % seulement aboutissent). 377 `needs_review` (goulot humain) + 56 `quality_improving` attendent.
- **Preuve code** : `dailyArticles` n'est consommé que par `perCampaignTick` (`content-orchestrator-worker.ts:775`) — création de jobs. Aucun worker ne compare `publishedCount`/jour à une cible (le `syncCampaignCounters` l.614-624 resynchronise les compteurs, mais personne ne les évalue).
- **Preuve live (2026-08-14 18:12–18:16 UTC, DB prod)** : jobs/jour 30 j — colonnes `published` : 0, 4, 23, 0, 7, 8, 0, 0, 0, 0 puis plus rien ; statuts globaux : 173 published / 1 532 failed / 377 needs_review / 169 cancelled / 56 quality_improving.
- **Root-cause** : conception : la « cadence » du système est une cadence d'intention (création), pas de résultat (publication) ; le goulot review/qualité n'est pas dans la boucle.
- **Patch prescrit** : ajouter au monitoring 15 min un indicateur « publiés sur 24 h vs `dailyArticles` des campagnes running » (bandeau + Telegram sous seuil, ex. < 25 % de la cible 3 jours de suite), et afficher le backlog `needs_review` dans le même bandeau.
- **Effort** : S. **Impact GEO/AEO** : moyen. **Risque de régression** : faible (~5 %) — observabilité pure.

### [P2] Mode `sequential` : l'invariant « attendre la fin de la ville courante » n'est pas implémenté [À CONFIRMER — latent, aucune campagne sequential en prod]

- **Symptôme** (latent) : la docstring promet « Attend que tous les jobs de la ville courante soient terminés avant de passer à la suivante » (`content-orchestrator-worker.ts:362-365`), mais le code incrémente `currentCityIndex` **immédiatement après l'enqueue** (l.485-489) ; au tick suivant, le check `pendingCount` (l.414-429) porte sur la ville N+1 (qui n'a par construction aucun job) → il avance d'une ville par tick de 15 min, jobs de la ville précédente encore en vol. En outre, une campagne `unlimited` + `sequential` s'éteint silencieusement après la dernière ville (`idx >= villeAnchors.length` → return 0 pour toujours, l.404-410) sans jamais passer `completed`. Les tests (`__tests__/orchestrator-sequential.test.ts` C2-C3) encodent la même sémantique et ne couvrent pas le cas inter-ticks.
- **Preuve live** : impossible — les 14 campagnes en DB sont toutes `city_processing_mode=parallel` (mesure 18:12 UTC).
- **Patch prescrit** : vérifier le pending de la ville `currentCityIndex - 1` avant d'enqueue la ville courante, OU n'incrémenter l'index que lorsque le pending de la ville courante retombe à 0 après création. Effort : S. Impact GEO/AEO : faible (mode inutilisé). Risque : faible ; do-not-touch : tests C1-C5 à mettre à jour en même temps.

### [P2] Dérives documentaires et d'horodatage

- `content-gen-deadline-checker.ts:4` annonce « Cron 5 0 * * * (00:05 UTC daily) » alors que le cron réel est `*/15 * * * *` depuis 2026-05-23 (`queues.ts:1193-1218`). Doc-only, corriger le header.
- `alert_pipeline_stall.detectedAt` réécrit à chaque tick (voir P0-1) — inclus dans le patch P0-1.
- 3 campagnes « TEST qualité round1-3 » (768/j !) en `paused` et 4 drafts « Éditorial · » de juin jamais lancés : bruit de console, à archiver via la fonction d'archivage existante (`archivedAt`). Effort : S (action console, pas de code).

## Mesures brutes

Toutes DB prod `axionia`, 2026-08-14 18:12–18:16 UTC (déploiement en vol sans impact : mesures DB, pas ISR).

**Campagnes (14 lignes)** — extrait :

| Campagne | Statut | daily_articles | target | generated | published | failed | mode |
|---|---|---|---|---|---|---|---|
| AURA + IdF — Formation·Audit·1-to-1 | running | 20 | 600 | 1 942 | 83 | 1 451 | unlimited / parallel |
| France T1-T2 — Formations IA | paused (02/07) | 20 | 600 | 96 | 24 | 0 | fixed |
| 3× TEST qualité Grenoble | paused | 768 | 8 | 8 | 0 | 0 | fixed |
| 5× Grenoble (juin) | completed | 96 | 43-46 | 43-46 | 3-7 | 0 | fixed |
| 4× Éditorial (drafts) | draft | 30 | 30 | 0 | 0 | 0 | — |

**Jobs créés/jour (30 j)** : 07-15 : 23 · 07-16 : 101 · 07-17 : 101 · 07-18 : 101 (101 failed) · 07-19 : 93 · 07-20 : 101 · 07-21→23 : 101/j (100 % failed) · 07-24 : 90 (90 failed) · **07-25 → 08-14 : 0**.

**Intentions (45 j)** : informational 1 443 · transactional 659 · autres **0**. Par campagne running : 1 295 / 647 (ratio 2,002:1). Config : 0,4/0,25/0,15/0,1/0,1. Simulation code actuel + config prod (node, 2 000 slots) : 100 % informational.

**Statuts globaux jobs** : failed 1 532 · needs_review 377 · published 173 · cancelled 169 · quality_improving 56 · quarantined_critical 2 · approved 1. Dernier job : créé 07-24 21:00:00, complété 07-24 21:00:03 UTC.

**Top erreurs (45 j)** : OpenAI rate limited 949 · OpenAI quota 429 241 · Anthropic 400 128 · Connection error 94 · Circuit breaker open 55 · échecs qualité/parse ~38.

**Config** : `kill_switch` actif (updated 07-24 21:12) · `batches` = `{workersConcurrency: 3, antiBurstEnabled: true, dailyTargetByType: {}, retryMaxAttempts: 3}` (mode per-type inactif) · `search_intent_distribution` en fractions somme 1 (updated 06-16).

**Alertes** : `alert_pipeline_stall` active, detectedAt 2026-08-14T18:15Z (réécrit toutes les 15 min — worker vivant, âge du stall perdu) · `alert_reject_spike` inactive · `alert_quality_drop` inactive.

**Coût/semaine (60 j)** : 0,22 → 18,49 USD/sem (le quota requêtes, pas le coût, a plafonné).

**Crons vérifiés (code)** : orchestrator `*/15` (queues.ts:1035-1046) · scheduler `*/5` (1180-1191) · deadline-checker `*/15` (1201-1219) · workers démarrés dans `worker.ts:96,112,113`.

## Limites

- **Redis/BullMQ non inspecté** (pas d'accès direct aux files en prod dans le cadre GET/SELECT) : impossible de vérifier l'état réel des repeatable jobs et d'éventuels zombies actuels ; la politique `reenqueue-policy.ts` (fix 2026-07-17) a été auditée sur code + tests uniquement.
- **Logs container worker non lus** (choix de rester sur DB + code ; la preuve « worker vivant » vient du re-upsert `alert_pipeline_stall` daté de 3 min avant la mesure).
- **Mode sequential** : non prouvable live (aucune campagne sequential n'a jamais tourné) — finding marqué [À CONFIRMER].
- La distribution **type/audience** (`buildWeightedSequence`, poids entiers somme 100, `audienceMix={"default":100}`) a été vérifiée saine sur code + config DB, mais la conformité fine (part réelle par type publié) relève de D2/D3 (le rendement 4,3 % la rend de toute façon non significative).
- L'impact exact du plancher ×4,8 sur l'épuisement du quota OpenAI du 22/07 est une inférence (chronologie + volumes), pas une preuve comptable côté OpenAI.

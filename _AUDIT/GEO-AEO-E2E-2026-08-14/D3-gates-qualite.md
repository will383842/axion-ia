# D3 — Gates qualité content-gen

Date : 2026-08-14, mesures live 18:16 UTC. Auditeur : agent D3 (squad D, audit GEO/AEO 50 agents).

Périmètre réellement couvert : `src/server/content-gen/quality/**` (seo-score, soft-404-gate, doctrine-check, dedup-guard, plagiarism, price-gate, search-intent-validator, intent-enforcement, multi-judge-ensemble, originality-ai-client, judge-outcome), `src/server/content-gen/dedup/**` (embedding-similarity, outline-simhash, topic-fingerprint, openai-embedder, persist-article-embedding), le câblage dans `content-gen-worker.ts` / `content-quality-improver-worker.ts` / générateurs, le corpus BannedPhrase (seed + admin), plus l'état runtime prod (env du worker, logs docker). **Pas d'accès DB** (D3 hors liste des agents DB-autorisés) : les preuves « rejet réel en base » sont déléguées, requêtes SQL fournies en fin de rapport.

## Résumé exécutif

L'architecture des gates est **solide et majoritairement bien câblée** : `blockingFail` (plagiat, intent, outline-dup, doublon sémantique Voyage, faute dure doctrine, benefit-gate) interdit toute auto-publication (`content-gen-worker.ts:975-982, 1104-1124`), un juge LLM en panne interdit l'auto-pub (`judge-outcome.ts:47-50`), le soft-404 interdit le tier_1 même en « tout indexable » (`content-gen-worker.ts:1221-1222`). MAIS : (1) la doctrine « block » ne bloque en réalité QUE le SIREN — CPF, sur-promesses de financement, partenariats fabriqués, stats fabriquées et banned-phrases « block » laissent le contenu se publier en ligne (noindex mais URL vivante) ; (2) le multi-judge, activé en prod (`MULTI_JUDGE_ENABLED=true` mesuré 18:16 UTC), ne couvre que les 12 types v7-phase8 — les 7 générateurs principaux auto-publient en tier_1 sans aucun juge LLM dès score heuristique ≥ 75 ; (3) la couche A.4 dedup embeddings est du code mort (aucun appelant + env absent) ; (4) au moment de l'audit, **aucune gate ne peut rougir : le kill switch content-gen est actif** (contexte connu, reste-Will déjà acté — pas re-signalé comme nouveau).

## Findings

### [P1] Doctrine « block » ≠ blocage réel : CPF, sur-promesses financement, partenariats fabriqués et banned-phrases « block » sont PUBLIÉS quand même

- **Symptôme** : `checkDoctrine()` classe en `blockingViolations` (severity block) : CPF (`doctrine-check.ts:255-269`), sur-promesses « 100 % financé / automatique / gratuit » (`doctrine-check.ts:76-115`), partenariats/clients/labels fabriqués (`doctrine-check.ts:124-145`), stats propriétaires fabriquées (`doctrine-check.ts:40-65`), phrases interdites DB severity block (`doctrine-check.ts:353-362`). Les commentaires du code disent explicitement « On BLOQUE ». Or au niveau worker, seules les violations `SIREN/SIRET/RCS` (et `prix-non-SSOT` si le flag `hard_fault_gate.retainNonSsotPrice` est activé, défaut OFF) alimentent `doctrineHardFail` → `blockingFail` → rétention `needs_review`.
- **Preuve code** : `content-gen-worker.ts:822-828` — `doctrineHardFaults = doctrine.blockingViolations.filter(v => v.pattern === "SIREN/SIRET/RCS" || (hardFaultGate.retainNonSsotPrice === true && v.pattern.startsWith("prix-non-SSOT:")))`. Toutes les autres violations « block » ne comptent pas dans `blockingFail` (`content-gen-worker.ts:975-981`). Côté générateur, `doctrine.passed=false` ne fait que -30 sur le qualityScore + tier_3 (`article-quality.ts:75-82`, `blog-article.ts:480-488`) ; si le score reste ≥ 75 (`QUALITY_LOOP_THRESHOLD_DEFAULT`, `content-gen-worker.ts:120`), `fullAutoPublishRequested=true` (`content-gen-worker.ts:1104-1106`) → statut `approved` → publication réelle en `tier_3_noindex_nofollow`.
- **Preuve live** : impossible de prouver une occurrence publiée sans DB (les tier_3 sont hors sitemaps/feeds/listings — vérifié `src/app/[locale]/blog/feed.xml/route.ts:54`, `src/app/[locale]/actualites/page.tsx:44` : filtres `tier_1_indexable` partout) → **[À CONFIRMER]** en DB (requête fournie § Mesures).
- **Root-cause** : la décision Will 2026-06-13 (« fautes DURES » = SIREN, prix désactivé pour faux positifs, cf. commentaire `content-gen-worker.ts:802-817`) a été prise AVANT l'ajout des patterns CPF/partenariats/stats fabriquées (2026-07-04) — le filtre hard-fault n'a jamais été étendu à ces nouveaux patterns pourtant conçus comme bloquants.
- **Patch prescrit** : étendre le filtre `doctrineHardFaults` aux patterns `CPF-non-autorise`, `financement-interdit`, `partenariat-fabriqué`, `stat-fabriquée-Axion-IA` (quasi zéro faux positif, regex ciblées) ; laisser naming/ratio/hype en downgrade comme aujourd'hui. 1 ligne de filtre + tests.
- **Effort** : S. **Impact GEO/AEO** : fort (une mention CPF publiée = revendication illégale sur URL vivante lisible par les crawlers IA autorisés ; un partenariat fabriqué = E-E-A-T mensonger). **Risque de régression** : faible — augmente uniquement le flux `needs_review` ; do-not-touch : `price-gate.ts` (décision actée 4), le bloc `retainNonSsotPrice` (flip volontaire Will), les regex existantes de `doctrine-check.ts`.

### [P1] Multi-judge activé en prod mais inerte sur les 7 générateurs principaux — l'auto-pub tier_1 ne passe par AUCUN juge LLM

- **Symptôme** : `MULTI_JUDGE_ENABLED=true` en prod, mais `runMultiJudge()` n'est appelé QUE par le pipeline v7-phase8 (`v7-phase8-shared.ts:407-419`), qui de surcroît sort au mieux en `tier_2_noindex_follow` (`v7-phase8-shared.ts:465-470`). Les générateurs principaux (blog_article, blog_from_rss, blog_from_title, blog_from_keywords, comparison, guide_pilier, faq_standalone, qa_derived, barometer) ne l'appellent jamais. Le juge LLM (`reviewArticle`, gpt-4o) n'intervient que dans la boucle qualité (`content-quality-improver-worker.ts:230`), réservée aux contenus SOUS le seuil 75 : un contenu heuristiquement ≥ 75 est auto-publié tier_1 (score ≥ 50) sans qu'aucun LLM ne l'ait jamais relu.
- **Preuve code** : grep exhaustif `runMultiJudge|composeMultiJudge` hors tests → 2 seuls appelants : `multi-judge-ensemble.ts` (définition) et `v7-phase8-shared.ts:407`. Chemin auto-pub sans juge : `content-gen-worker.ts:1104-1124` (approved si score ≥ 75) puis `content-gen-worker.ts:1215-1222` (tier_1 si score ≥ 50).
- **Preuve live** : env worker mesuré 2026-08-14 18:16:14 UTC : `MULTI_JUDGE_ENABLED=true`, `QUALITY_PROFILES_ENABLED=true` (container `oqj5ugdxvdsc4lyp4acr6wqd-144354397543`, `tsx src/server/queue/worker.ts`).
- **Root-cause** : le multi-judge a été productionisé Phase 16 dans le pipeline phase-8 uniquement ; le flag env donne une fausse assurance de couverture globale.
- **Patch prescrit** : appeler `runMultiJudge()` dans `content-gen-worker.ts` juste avant la décision d'auto-publication (entre gates et `nextStatus`), en n'auto-publiant tier_1 que si le consensus confirme ; ou a minima conditionner `shouldPromoteTier1` au verdict juge.
- **Effort** : M. **Impact GEO/AEO** : fort (qualité réelle du contenu indexé = premier signal HCU/GEO). **Risque de régression** : moyen — coût LLM par article + latence ; dépendance OpenAI (kill switch !) → prévoir fail-soft identique à `judge-outcome.ts` (pas d'auto-pub si juge down). Do-not-touch : `judge-outcome.ts` (garde-fou déjà correct), seuils `judge_thresholds` DB.

### [P1] Banned-phrases « block » sur mots courants (« unique », « le meilleur », « révolutionnaire ») : sur-rougissement silencieux → tier_3 noindex de contenus par ailleurs bons [À CONFIRMER]

- **Symptôme** : le seed pose `unique`, `le meilleur`, `révolutionnaire` en severity **block** (`prisma/seeds/content-gen/banned-phrases.ts:64-70`). Une seule occurrence de « unique » (mot français banal : « besoin unique », « identifiant unique ») hors de l'unique exception « angle unique par ville » (`doctrine-check.ts:329-331`) fait échouer TOUTE la doctrine → -30 qualityScore + tier_3_noindex_nofollow au générateur → perte d'indexation silencieuse d'un contenu sinon publiable, ou détour boucle qualité/needs_review. C'est l'inverse du P1 précédent : gate trop rouge, qui détruit de la visibilité au lieu d'en protéger.
- **Preuve code** : `doctrine-check.ts:334-362` (match `\b` insensible casse, block → blockingViolations → `passed=false`) ; effet : `blog-article.ts:471, 480-488` (tier dépend de `doctrine.passed`), `article-quality.ts:80-82` (-30).
- **Preuve live** : l'état réel de la table `banned_phrases` en prod (severity/isActive effectifs, le seed ne tournant PAS au deploy — `banned-phrases.ts:152-153`) et le taux de déclassements causés sont invérifiables sans DB → **[À CONFIRMER]** (requêtes § Mesures). Idem pour les lignes retirées `formation`/`formateur`/`former` (`RETIRED_PATTERNS`, `banned-phrases.ts:155-168`) : si le seed n'a pas été relancé après le 2026-08-10, elles sont peut-être encore actives en base (effet bénin aujourd'hui : warn sans impact score, mais scan admin pollué).
- **Root-cause** : doctrine § 21 appliquée avec une granularité binaire (un mot = tout le contenu noindex) sans liste d'exceptions suffisante pour « unique ».
- **Patch prescrit** : (a) vérifier en DB la fréquence des déclassements `doctrine` causés par ces 3 patterns ; (b) si significative, passer « unique » en warn OU enrichir `DOCTRINE_EXCEPTIONS` ; (c) relancer `pnpm content-gen:seed` dans le container (ou désactiver via l'admin) pour matérialiser les retraits du 2026-08-10.
- **Effort** : S (mesure) puis S (bascule severity). **Impact GEO/AEO** : moyen-fort (volume de pages privées d'indexation). **Risque de régression** : faible ; do-not-touch : la décision de retrait « formation » (actée Will 2026-08-10, ne pas réintroduire), l'exception « angle unique par ville ».

### [P2] Couche A.4 « embedding cosine dedup » = code mort, et la doc prétend qu'elle est branchée

- **Symptôme** : `classifyDedupVerdict`/`cosineSimilarity` de `dedup/embedding-similarity.ts:44` n'ont **aucun appelant de production** (grep : uniquement les tests). `persistArticleEmbedding` est appelé au publish (`content-publish-worker.ts:940`) mais no-op sans `OPENAI_EMBEDDINGS_ENABLED` (`persist-article-embedding.ts:8, 56-57`) — env **absente en prod** (mesure 18:16 UTC). Aucune requête pgvector `<=>` sur `articles.embedding` côté dedup (le seul usage `<=>` est le chatbot : `chatbot/retrieval/hybrid-search.ts:66`). Or le header d'`outline-simhash.ts:8` affirme « A.4 OpenAI embeddings cosine ✅ (openai-embedder.ts + check pre-publish) » — faux. Même mensonge doux dans `content-similarity-monitor-worker.ts:7` (« Cosine sur embeddings KB si VOYAGE_API_KEY ») : l'implémentation est un Jaccard de titres uniquement.
- **Preuve code** : ci-dessus. **Preuve live** : env worker 18:16:14 UTC : `OPENAI_EMBEDDINGS_ENABLED` absent, `ORIGINALITY_AI_API_KEY` absent, `VOYAGE_API_KEY` présent.
- **Root-cause** : la dedup sémantique réelle a été livrée par un AUTRE mécanisme (topic-fingerprint Voyage SimHash 64-bit, `topic-fingerprint.ts:87` + `content-gen-worker.ts:848-905`, actif car clé Voyage présente) ; la couche A.4 embeddings OpenAI est restée un squelette, ses commentaires « ✅ » n'ont pas suivi.
- **Patch prescrit** : corriger les 2 headers (outline-simhash, similarity-monitor) ; décider : supprimer `embedding-similarity.ts`+`openai-embedder`+`persist-article-embedding` OU activer `OPENAI_EMBEDDINGS_ENABLED` + écrire le comparateur — la couverture actuelle par Voyage rend la suppression raisonnable.
- **Effort** : S (doc) / M (suppression propre). **Impact GEO/AEO** : faible (dedup sémantique couverte par Voyage). **Risque** : nul pour la doc ; suppression → vérifier les imports tests.

### [P2] Originality.ai : gate structurellement inactif (clé absente) et limité aux types phase-8

- **Symptôme** : sans `ORIGINALITY_AI_API_KEY`, `scanWithOriginalityAi` retourne un résultat neutre `fallback:true` → `passesOriginalityGate` retourne toujours passed (`originality-ai-client.ts:53-63, 136-138`). Clé absente en prod (mesure 18:16 UTC). Seul appelant : `v7-phase8-shared.ts:434-443`. Le gate n'a donc jamais rougi et ne peut pas rougir.
- **Preuve code + live** : ci-dessus. **Root-cause** : activation prévue « Phase D (mois 13+) » (`originality-ai-client.ts:14`) — inertie assumée et documentée honnêtement.
- **Patch prescrit** : aucun immédiat ; noter dans le plan que « détection AI-content » = 0 couverture réelle aujourd'hui (ne pas la compter dans le scoring des défenses HCU).
- **Effort** : n/a. **Impact** : faible. **Risque** : n/a.

### [P2] Défauts divergents admin ↔ worker sur 2 seuils de gate (l'UI peut mentir)

- **Symptôme** : le worker lit la config brute `readContentGenConfig("policies", {})` (`content-gen-worker.ts:702`) avec fallbacks `rssAutoPublishMinScore ?? 60` (`content-gen-worker.ts:119, 1076`) et `factoryAutoPromoteTier1MinScore ?? 50` (`content-gen-worker.ts:1215`) ; l'admin affiche/merge ses PROPRES défauts : 75 et **0** (`policies.ts:224-231`, commentaire « 0 = tout indexable », décision 2026-06-14 remplacée le 2026-06-16 par 50 côté worker, `content-gen-worker.ts:1209-1214`). Si la clé est absente en base, l'UI montre 75/0 alors que le worker applique 60/50 ; si Will sauvegarde la page pré-remplie, le 0 (tout-indexable) écrase le garde-fou 50.
- **Preuve code** : ci-dessus. **Preuve live** : valeur stockée invérifiable sans DB → **[À CONFIRMER]**. Effet réel borné : l'auto-pub exige déjà score ≥ 75 (non-RSS) / ≥ 60-75 (RSS) > 50, donc le seuil tier_1 est presque toujours déjà satisfait.
- **Patch prescrit** : aligner `POLICIES_DEFAULTS.factoryAutoPromoteTier1MinScore` sur 50 et `rssAutoPublishMinScore` worker-default sur 75 (ou faire lire `getPolicies()` au worker).
- **Effort** : S. **Impact** : faible. **Risque** : faible ; do-not-touch : valeurs stockées en base (les lire d'abord).

### [P2] Micro-défauts de robustesse des gates

1. `seo-score.ts:112` : `new RegExp(kw, "g")` avec keyword non échappé → un mot-clé contenant un métacaractère regex (`C++`, parenthèses) fait throw `computeSeoScore` → génération en erreur. Échapper comme le fait `doctrine-check.ts:336`.
2. `seo-score.ts:109-111` : branche `!hasPageH1` cherche `<h1…>` dans `bodyText` (HTML déjà strippé) au lieu de `bodyHtml` — moot en pratique (tous les appelants passent `hasPageH1:true`), mais piège pour un futur appelant.
3. `dedup-guard.ts:291-300` : `checkOutlineDedup` retourne `skipped` silencieux sur TOUTE erreur DB — en prod une erreur transitoire Postgres désarme le gate outline sans alerte (log verdict `skipped` seulement).
4. `doctrine-check.ts:1-11` : header stale — annonce « 3. Mot “formation” banni » alors que la règle a été retirée le 2026-08-10 (cf. `doctrine-check.ts:294-299`).
5. Corpus plagiat Jaccard = 200 derniers articles seulement (`content-gen-worker.ts:123`) — fenêtre courte vs corpus total ; compensé par topic-fingerprint (cap 50 000, `content-gen-worker.ts:843-862`).

### Vérifications POSITIVES (gates correctement câblées — ne pas re-signaler ailleurs)

- **Dedup pre-IA (A.1/A.2)** : un match → job `cancelled` AVANT tout appel LLM (`content-gen-worker.ts:327-339`). Fail-open uniquement sur DB indisponible (P2021/init), sinon throw.
- **Plagiat, intent, outline-dup, doublon Voyage, faute dure, benefit-gate** → `blockingFail` (`content-gen-worker.ts:975-981`) → tier_3 + `needs_review`, JAMAIS d'auto-pub (`:1079, :1106` exigent `!blockingFail`). Cause du déclassement loggée en français (`:987-1002`).
- **Soft-404** → jamais tier_1 même en « tout indexable » (`content-gen-worker.ts:1216-1222`) ; seuils 350/280 mots + bonus FAQ (`soft-404-gate.ts:76-94`).
- **Juge LLM en panne** → `judgeRan=false` → jamais `approved` (`judge-outcome.ts:47-57`) ; verdict `reject` → `quarantined_critical` + Telegram (`content-quality-improver-worker.ts:279, 320-337`).
- **Exemption news de l'outline-dedup** : documentée et justifiée (structure de brève partagée, `content-gen-worker.ts:789-800`) — pas un trou : plagiat 0.10 + Voyage + anti-régurgitation RSS couvrent.
- **Intent-enforcement** (plancher déterministe sources/CTA, `intent-enforcement.ts:148`) : réduction volontaire des faux positifs du validateur — design documenté 2026-06-27, pas une gate désarmée.
- **Price-gate** : branché dans checkDoctrine (`doctrine-check.ts:367-374`) ; hard-fault OFF par défaut = décision documentée (faux positifs « 35 millions d'euros »), flippable Will — conforme décision actée n°4, rien à toucher.

## Mesures brutes

| Mesure (UTC 2026-08-14) | Résultat |
|---|---|
| 18:16:01 — `ssh axion-prod docker ps` | worker = `oqj5ugdxvdsc4lyp4acr6wqd-144354397543` (`tsx src/server/queue/worker.ts`), Up 3 h ; web = `mqbmlz1bcwsdwi3t9fxsllqt-…`, Up 4 h |
| 18:16:14 — env worker | `MULTI_JUDGE_ENABLED=true` ; `QUALITY_PROFILES_ENABLED=true` ; `OPENAI_API_KEY` présent ; `VOYAGE_API_KEY` présent ; `ORIGINALITY_AI_API_KEY` **absent** ; `OPENAI_EMBEDDINGS_ENABLED` **absent** ; `VOYAGE_AI_FINGERPRINT_FALLBACK` absent (bon : pas de fallback non-sémantique en prod) |
| 18:16:26 — logs docker worker (fenêtre ~3 h depuis restart) | 0 trace de gate (`originality|multi-judge|Dedup|plagiar|doctrine|noindex|quality` → 0 hit) ; uniquement `[orchestrator] kill switch active, skip tick` + `[rss-fetch-worker] kill switch active, skip tick` en boucle → **content-gen à l'arrêt, gates non exercées** (kill switch = reste-Will déjà acté, cf. Limites) |
| Appelants `runMultiJudge` (code) | 1 seul : `v7-phase8-shared.ts:407` |
| Appelants `classifyDedupVerdict` (code) | 0 hors tests |
| Usage pgvector `<=>` (code) | chatbot uniquement (`hybrid-search.ts:66`, `semantic-cache/cache.ts:78-84`) — aucun pour la dedup articles |
| Filtres tier des surfaces publiques | feeds/listings/sitemaps = `tier_1_indexable` only (`blog/feed.xml/route.ts:54`, `actualites/page.tsx:44`, `sitemap.ts:772`, `sitemap-news.xml/route.ts:89`) |

**Requêtes SELECT à exécuter par un agent DB-autorisé (D1/D5) pour clore les [À CONFIRMER]** :

```sql
-- Preuve que chaque gate a déjà rougi (règle maison « une garde ne vaut que si elle rougit »)
SELECT step, level, count(*) FROM generation_logs
 WHERE message ~* 'BLOCKED|Dedup blocked|HARD FAULT|Déclassé en noindex|rejet ferme'
 GROUP BY 1,2 LIMIT 20;
SELECT status, count(*) FROM content_gen_jobs GROUP BY 1;              -- cancelled/needs_review/quarantined_critical > 0 ?
-- État réel du corpus banned-phrases (P1 n°3)
SELECT pattern, severity, is_active FROM banned_phrases
 WHERE pattern IN ('unique','le meilleur','révolutionnaire','formation','formateur','former');
-- Articles publiés malgré doctrine non passée (P1 n°1)
SELECT count(*) FROM content_gen_jobs WHERE status='published' AND doctrine_check_passed=false;
SELECT indexation_tier, count(*) FROM articles WHERE status='published' GROUP BY 1;
-- Seuils effectifs (P2 défauts divergents)
SELECT value FROM content_gen_configs WHERE key IN ('policies','quality_loop','hard_fault_gate','benefit_gate','kill_switch');
```

## Limites

- **Pas d'accès DB prod** (D3 hors liste) : aucune preuve directe d'un rejet réel en base (GenerationLog, statuts jobs, corpus BannedPhrase effectif, config policies/benefit_gate stockée). Tous les points marqués [À CONFIRMER] en dépendent — requêtes fournies ci-dessus.
- **Logs docker limités à ~3-4 h** (containers redémarrés au deploy de ~14:57 UTC) et **kill switch content-gen actif** sur toute la fenêtre → zéro génération observée, donc zéro rougissement observable en live pendant l'audit. Le kill switch (OpenAI à recharger puis désarmer) est un reste-Will DÉJÀ ACTÉ (mémoire 2026-08-04) — signalé ici comme contexte, PAS comme nouveau finding ni nouveau reste-Will. Conséquence GEO à souligner pour la synthèse : tant qu'il est armé, la « machine à visibilité » entière (squad D) est à l'arrêt.
- `benefit_gate.enabled` (PH2) et `judge_thresholds` : valeurs DB inconnues — le profil qualité est actif (`QUALITY_PROFILES_ENABLED=true`) mais l'état ON/OFF du benefit-gate commercial reste indéterminé.
- Aucune page tier_3 publiée n'a pu être échantillonnée en live (non listées, non énumérables sans DB).
- Déploiement en vol pendant l'audit (atterrissage estimé 18:30-19:00 UTC) : sans impact sur mes mesures (env/logs lus à 18:16 UTC sur les containers du deploy stable de 14:57).

# PR 12 — Orchestration de l'équipe éditoriale

## But

Enchaîner, dans le worker de génération (`content-gen-worker.ts`), les rôles de l'équipe éditoriale, derrière `CONTENT_EQUIPE_EDITORIALE` (valeur exacte `"true"`). Éteint, le chemin d'avant est strictement inchangé.

Ordre : stratège/brief → gardien → vérificateur phase A → plan + rédaction (le générateur) → vérificateur phase B → mailleur → éditeur SEO → conformité (rejouée sur le texte final) → rédacteur en chef (publier / renvoyer / abandonner, 2 renvois au plus).

- **Arrêt au gardien** (écarter, mettre à jour, relecture humaine, ou mot-clé déjà possédé) : aucune écriture payée, le job passe à `cancelled` avec la raison et le journal.
- **Plafond de 3,00 $ par job** : somme lue dans le registre de coûts (`coutCumuleJobUsd`, nouvelle lecture par `jobId` dans `providers/blog-claude-ledger.ts`), vérifiée avant chaque appel payant, y compris celui du rédacteur en chef (son coût est rendu à l'appelant et compté). Dépassement, ou lecture du registre impossible : relecture humaine, jamais publication.
- **Renvois bornés** : 2 au plus, puis relecture humaine. Un renvoi réécrit (rédacteur / architecte / vérificateur) ou relance seulement mailleur et éditeur SEO.
- **Journal** de chaque rôle (décision, durée, coût, passe) dans `outputJsonRaw.equipe` (champ facultatif, aucun changement de schéma, aucune migration, aucun champ de job BullMQ).
- **Console** : vue en lecture seule du journal sur la fiche du job de génération (`content-gen/jobs/[id]`), aucune action.
- **FAQPage (JSON-LD)** : vérifié, déjà présent. La page `/blog/[slug]` rend `ArticleFaq` (accordéon + `buildFaqJsonLd`) dès que l'article a une FAQ, et rien sinon ; aucun second balisage FAQPage sur la page. Rien ajouté, donc aucun doublon.

## Fichiers

- `src/server/content-gen/equipe/orchestration.ts` (+ test) : enchaînement, plafond, renvois, journal.
- `src/server/content-gen/equipe/circuit-article.ts` (+ test) : adaptateurs mailleur / éditeur SEO / conformité / rédacteur en chef sur la sortie du générateur.
- `src/server/content-gen/providers/blog-claude-ledger.ts` (+ test) : `coutCumuleJobUsd`.
- `src/server/content-gen/quality/barrieres-publication.ts` : nouveau code de barrière `equipe-editoriale`.
- `src/server/queue/workers/content-gen-worker.ts` : branchement (phase A déplacée dans une fonction, retouches du texte en fonction rejouable, génération en fonction rejouable pour les renvois).
- `.../content-gen/jobs/[id]/_v2/{PanneauEquipe.tsx,journal-equipe.ts}` (+ test) : vue lecture seule.
- `src/server/queue/workers/__tests__/equipe-editoriale-interrupteur.spec.ts` : verrou « éteint = comportement d'avant ».

`content-refresh-worker.ts`, `prisma/**` et les fichiers interdits ne sont pas touchés.

## Tests

Arrêt au plafond (avant stratège, avant l'écriture, en cours de circuit, via le coût du rédacteur en chef), arrêt au gardien (3 décisions + mot-clé possédé), renvois bornés à 2, un renvoi puis publication, journal rempli, conformité reçoit le texte final, erreur de rôle = relecture humaine, lecture du registre en échec = relecture humaine, interrupteur éteint (verrou de source + modules d'avant déjà testés éteints), lecture du journal côté console.

## Risques

- **Comparaison sémantique avant écriture** : le gardien reçoit `voisins: []` (pas d'embedding d'un brief avant l'article). La carte des requêtes et la FAQ du site font le contrôle ; le dedup Voyage après écriture reste en place. À brancher dans une PR suivante.
- Un arrêt avant écriture passe le job à `cancelled` (pas de ligne de file de relecture : il n'y a pas de texte à relire). La raison est dans `errorMessage` et le journal.
- Équipe allumée : la fidélité par Claude et le fact-check d'avant sont remplacés par la conformité et la phase B (pas de double paiement).
- Une reprise de la boucle qualité ne repaie ni brief ni gardien (brief relu dans `outputJsonRaw.equipe.brief`).
- `costUsd` du job = max(somme d'avant, coût du registre) quand l'équipe tourne.
- Fenêtre app/worker : aucun contrat BullMQ modifié, aucun champ de charge ajouté.

## Rebase

La branche part de la PR 11 (#2372). Avant le push final : `git fetch`, rebase sur `origin/main` si la PR 11 y est fusionnée.

## Relecture Opus (1 tour)

Corrigé après relecture : titre vide (`||` au lieu de `??`), reprise de la boucle qualité (article conservé, passage en relecture avec ligne de file), coût du juge compté une seule fois (déjà au registre), renvoi au seul mailleur / éditeur SEO = relecture humaine (pas de tour payé pour le même texte).

## Corrigé (2e passe)

1. **Plafond de 3,00 $ sur tous les appels** : nouveau `providers/plafond-job.ts` ; le worker y inscrit une garde par `jobId` (retirée dans un `finally`), et `provider-router.generate` l'attend avant chaque appel. Couvre les appels internes du générateur et la réparation de la réponse directe. Un dépassement en cours d'écriture = arrêt « plafond » (relecture humaine). Sans garde (équipe éteinte), aucun effet.
2. **« Réorienter »** : l'angle proposé par le gardien est ajouté à la consigne du rédacteur (et à chaque renvoi).
3. **Verrou de mot-clé** relâché sur arrêt avant écriture (gardien, plafond) et sur abandon du rédacteur en chef.
4. **`addQualityLoopSpend`** : équipe allumée, dépense de l'exécution = registre depuis le début de l'exécution ou somme du journal (le plus grand, jamais les deux additionnés).
5. **`chargerCarteRequetes()`** dans un try : une erreur = repli sur le chemin d'avant, journalisé, aucun job planté.
6. **Test d'intégration du worker** (`equipe-editoriale-worker.integration.spec.ts`) : ordre des rôles, journal, arrêts, angle, garde de plafond ; équipe éteinte et carte illisible = chemin d'avant.

Rebase fait sur `origin/main` (PR 11 déjà fusionnée) ; tests, typecheck et lint passent.

## Relecture Opus (2e passe)

Un point bloquant relevé et corrigé : une reprise de la boucle qualité arrêtée par le plafond avant ou pendant la réécriture annulait le job et perdait l'article déjà écrit. Elle part maintenant en relecture (`needs_review` + ligne de file), le verrou est gardé ; test d'intégration ajouté (il échoue sans la correction).

Restes connus, mineurs, non corrigés (derrière l'interrupteur) :

- l'angle du gardien n'est pas persisté : une reprise de la boucle qualité réécrit sans lui ;
- un abandon par le rédacteur en chef après écriture relâche le verrou alors que l'article reste en relecture ;
- `releaseKeywordLock` ne vérifie pas le propriétaire du verrou (repli sur panne Redis, ou TTL expiré) ;
- les arrêts anticipés en reprise ne comptent pas la dépense de la boucle qualité ;
- `costUsd` du job est cumulatif sur toutes les passes quand l'équipe tourne ;
- une erreur transitoire du stratège ou du gardien annule le job sans nouvel essai BullMQ ;
- lecture du registre en échec dans la garde du routeur : le job passe en `failed` (sûr, mais sans journal d'équipe) ;
- tests du circuit complet au niveau du worker (barrière, persistance du journal) non écrits : le test d'intégration s'arrête à l'appel du générateur.

Le correctif du bloquant n'a pas été relu par un second tour Opus.

(Verdict de la 2e passe : À CORRIGER, car le correctif du bloquant n'avait pas été relu.)

## 3e passe

Les huit restes de la 2e passe sont corrigés, test d'abord pour chacun.

1. **Angle du gardien persisté** dans `outputJsonRaw.equipe.angle` (champ facultatif) et réutilisé à la reprise de la boucle qualité (le gardien n'est pas rejoué). Un arrêt en reprise conserve aussi le brief et l'angle dans le journal.
2. **Abandon du rédacteur en chef après écriture** : l'article reste en relecture, le verrou de mot-clé est **gardé**.
3. **`releaseKeywordLock(mot, jeton)`** : avec jeton, script Lua atomique (compare puis supprime) ; panne Redis = rien n'est relâché, pas de repli sur `DEL`. Sans jeton : comportement d'avant (worker de publication inchangé). Le worker de génération passe le `contentGenJobId`.
4. **Arrêts anticipés en reprise** : la dépense de la boucle qualité est comptée (`addQualityLoopSpend`).
5. **`costUsd`** = max(somme déclarée, registre − registre au début de l'exécution), jamais additionnés ; une seule valeur sert au `costUsd` du job et au compteur de la boucle qualité.
6. **Erreur transitoire du stratège ou du gardien** : relancée (`ErreurEquipeTransitoire`, non convertie en échec définitif) pour que BullMQ réessaie ; aucune rédaction payée en double. Le journal est écrit avant l'échec.
7. **Lecture du registre en échec dans la garde du routeur** : journal d'équipe écrit avant l'échec du job.
8. **Test du circuit complet au niveau du worker** : publication (ordre des rôles, journal, brief), abandon du rédacteur en chef (barrière, verrou gardé), coûts, reprise.

Fichiers : `keyword-lock.ts` (+ spec), `orchestration.ts` (+ test), `content-gen-worker.ts`, `equipe-editoriale-worker.integration.spec.ts`, `equipe-editoriale-interrupteur.spec.ts`.

### Relecture Opus (3e passe, tour 1)

Les 8 points confirmés corrigés. Un bloquant relevé et corrigé : après un renvoi, un arrêt avant la phase B du tour suivant laissait le marqueur « fact-check abouti » et les sources de l'ancien texte sur un texte réécrit non vérifié. Remise à zéro dans `renvoyer`, test d'intégration qui échoue sans le correctif.

Mineurs connus, non corrigés (derrière l'interrupteur) :

- une erreur transitoire du stratège peut rejouer un stratège déjà payé (3 essais au plus, borné par le plafond de 3 $ par job) ;
- chaque essai transitoire marque le job `failed` et compte dans l'alerte « batch fail » ;
- les rôles (mailleur, éditeur SEO, conformité, rédacteur en chef) sont simulés dans le test worker, leur logique est testée dans `circuit-article.test.ts` ;
- un arrêt avant écriture hors reprise ne met pas à jour `costUsd` du job ;
- une reprise qui échoue en cours d'écriture n'ajoute pas sa dépense au compteur de la boucle qualité.

### Relecture Opus (3e passe, tour 2)

Le correctif du bloquant tient : remise à zéro avant la réécriture, aucun nouveau bloquant, aucun double comptage. Mineurs sans effet sur la publication : `coutFactCheckUsd` du tour 1 non persisté après un renvoi suivi d'un arrêt (le coût reste dans `costUsd`) ; marqueur perdu si la réécriture échoue (prudent) ; le mailleur et l'éditeur SEO modifient le texte après la phase B (choix de conception d'avant).

VERDICT OPUS : BON

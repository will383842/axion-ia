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

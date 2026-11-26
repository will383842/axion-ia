VERDICT A CORRIGER sha=e59fbc89 (AUDIT) : tests/usine/inventaire/retouche-chat.test.ts:8-62 — le reformatage multi-ligne (Prettier) de TOUT le tableau `constantes` casse le test de master tests/retouche-chat/allumer-lecteur-chat-v20k.test.ts:92 (« (h) inventaire », motif sur une ligne `{ cle: "…", etat: "allume"`) ; remettre les lignes existantes et `nombre` sur une ligne comme sur master, et ajouter la seule ligne neuve `retoucheChat.facecamAnimeePlaquettes` sur une ligne.

# Audit S-15-b3-v21s (argent, sécurité, données) — tête e59fbc89ad97e11336833e7c8e7747451cdf5d67

Tête vérifiée : `e59fbc89` (pas de TÊTE CHANGÉE). Base : `origin/master` = `65dcd08f` (TELEPHONE-OMBRE-v21t #1764), qui est aussi la base de fusion : le diff à trois points est donc exactement l'apport de la branche (aucun retour arrière de master malgré les fusions « côté branche gardé »).

Clone de travail dans le répertoire temporaire de la session, lecture seule : aucune écriture sur le dépôt du Studio, rien poussé là-bas. Les mutations ont été faites dans ce clone local, puis annulées (`git status` propre à la fin).

## 1. Ce qui bloque : un test de master devient rouge

`tests/retouche-chat/allumer-lecteur-chat-v20k.test.ts` « (h) inventaire : les 3 clés de lecteur sont « allume », déjà en table (règle R-9) » :

- **master `65dcd08f` : vert** ; **branche `e59fbc89` : rouge** (`AssertionError: retoucheChat.facecamAnimeeLecteur: expected … to match /\{ cle: "retoucheChat\.facecamAnimeeLecteur", etat: "allume"/`).
- Cause : `tests/usine/inventaire/retouche-chat.test.ts` réécrit les 6 entrées EXISTANTES de `constantes` et l'objet `nombre` sur plusieurs lignes (+68/−6 lignes pour UNE entrée neuve et un compteur 6 → 7). Le test v20k lit ce fichier comme du texte, avec un motif sur une ligne.
- C'est exactement le cas « tests de master qui figent l'état d'avant » que les règles communes demandent de trouver par `git grep` AVANT de coder : le fichier est cité en dur par ce test.
- Correction attendue (sans toucher au test v20k, qu'on ne doit jamais affaiblir) : garder le format sur une ligne de master, ajouter une seule ligne
  `{ cle: "retoucheChat.facecamAnimeePlaquettes", etat: "eteint", appel: "src/services/facecam-animee-retouche.ts", motif: /lire\(PARAM_PLAQUETTES_FA, false\)\)\.catch\(\(\) => false\)\) === true/ }, // S-15-b3-v21s`
  et passer `constantes: 6` à `7` dans la ligne `nombre` existante. Puis relancer `npx vitest run tests/retouche-chat/allumer-lecteur-chat-v20k.test.ts tests/usine/inventaire/retouche-chat.test.ts`.

## 2. Périmètre (fichiers touchés)

10 fichiers (+382/−12) :
`src/briques/retouche-portee/catalogues.ts` (+1), `src/moteurs/montage-facecam-animee/index.ts` (+11/−3), `src/moteurs/types.ts` (+2), `src/services/facecam-animee-retouche.ts` (+8/−1), `src/services/retouche-chat/pont-plaquettes-fa.ts` (neuf, 34 lignes), et les tests `tests/briques/retouche-portee/portee.test.ts`, `tests/facecam-animee/appliquer-plaquettes-s15b1.test.ts`, `tests/facecam-animee/retouche-plaquettes-s15b3.test.ts` (neuf), `tests/retouche-chat/pont-plaquettes-fa-s15b3.test.ts` (neuf), `tests/usine/inventaire/retouche-chat.test.ts` (couloir INV).

- Aucun fichier des zones interdites (`fabrication.ts`, `reglages.ts`, argent et plafonds, `src/fournisseurs/types.ts`, `studio-rendu/**`, `deploiement/**`, `.github/**`, `outils/gardes/**`, V4 protégés…). `scripts/echecs-connus.json` et `tests/usine/interrupteurs-inventaire.test.ts` : 0 ligne.
- ⚠️ L'extrait de fiche transmis à l'auditeur est tronqué avant la liste exacte des fichiers autorisés : la conformité à CETTE liste n'a pas pu être vérifiée mot pour mot. Les fichiers touchés correspondent au but (moteur + pont + réglage + INV), mais `src/moteurs/types.ts` et `src/briques/retouche-portee/catalogues.ts` doivent figurer dans la liste de la fiche : à confirmer par le pilote.
- Deux tests de master modifiés : `portee.test.ts` (liste fermée élargie de `plaquettesV4`, attendu) et `appliquer-plaquettes-s15b1.test.ts` (liste d'importeurs élargie, marquée « ÉLARGISSEMENT, seconde lecture du pilote ») : élargissements d'une liste fermée, nom exact, pas d'affaiblissement.

## 3. Argent, sécurité, données

- **Chemin payant** : aucun neuf. Le chemin plaquettes passe par `etatRepriseAuRenduV4` (rendu seul). Le test (b) compte 0 appel à `transcrire`, `reperer`, `appelerRealisateur`, `videos`, `planScenes.appeler`, `plafondClaudeAtteint`, 1 seul rendu, lignes réelles à 0 centime ; (e) `estimerRetouche` = 0 EUR ; portée `final`. Le refus (réglage éteint, mélange, tout refusé) arrive AVANT tout appel (0 appel, 0 rendu, prouvé par (a), (c), (d)).
- **Éteint par défaut** : seul `true` exact allume (moteur et service) ; une lecture qui lève éteint ; une commande d'un autre moteur ne touche pas la valeur. Refus d'aujourd'hui mot pour mot quand éteint. Inventaire : clé déclarée `eteint`.
- **Pont** : sans appelant (`git grep` vérifié par le test (g)), import dynamique de `../fabrication`, un refus ne renvoie jamais le message d'origine (montant possible).
- **Données** : aucune suppression ni exposition de données de personne, aucun secret, aucune écriture en base ni réglage de production, aucun appel réel dans les tests (doubles).
- **Remarque, non bloquante** : quand une partie seulement des opérations est refusée (`appliquees > 0`), les refus partiels (`applique.refus`, `lues.remarques`) sont abandonnés sans être dits : la retouche part avec une partie des changements. Pas d'argent en jeu (0 €), mais à signaler au pilote pour S-14-c3 (écran).

## 4. Tests lancés

- Fichiers touchés : `npx vitest run` des 5 fichiers de tests → **64/64 verts**.
- Voisins (`tests/facecam-animee tests/retouche-chat tests/usine tests/briques/retouche-portee tests/generateurs tests/demo-facecam tests/cas-concret/retouches tests/tableau/retouches tests/constats tests/stop-01 tests/mesures tests/bibliotheque-video tests/prononciations tests/services/pannes-rendues-repartent.test.ts`), même commande sur master et sur la branche :
  - master : 19 échecs ; branche : 20 échecs.
  - Échecs communs (hérités) : `apostrophe-rendu`, `cartes-pleines`, `elements-visibles`, `mise-en-page`, `mots-interdits-ecran`, `palette-v7-09b`, `panne-passagere-rendu` (4), `rangee-pastilles-mots` (5), `son-v4`, `sous-titres-fenetre-double`, `v4-inchange` « mémo planScenes », comité (2).
  - **Neuf sur la branche : `allumer-lecteur-chat-v20k.test.ts` (h)** → voir § 1 (bloquant).
  - Différence due au délai : `essai-reel` « Animer mes 3 vidéos » (5 017 ms, délai dépassé) sur la branche et `panne-passagere-rendu` « injoignable » (5 002 ms) sur master. Relancé seul sur la branche, `essai-reel` passe (22/22, 1 ignoré) : lenteur de la machine, non imputable.
- `npx tsc --noEmit -p .` (mémoire portée à 10 Go, sinon le processus tombe faute de mémoire, aussi sur master) : **154 erreurs sur master, 154 sur la branche, listes identiques** (`diff` vide) → aucune erreur neuve.
- `pnpm exec eslint` sur les 10 fichiers : 0 défaut.
- `node outils/gardes/regles-de-fer.mjs` : 0 défaut (règle `nom-fondateur` NON vérifiée faute de liste `MOTS_FONDATEUR`, comme d'habitude en local).

## 5. Mutations de l'auditeur (toutes doivent rougir)

| #   | Mutation (dans le clone, annulée ensuite)                                                          | Fichier                                            | Test                                | Résultat             |
| --- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------- | -------------------- |
| M1  | le moteur ignore le réglage (`&& (dependances.plaquettes ?? plaquettesConnues)() === true` retiré) | `src/moteurs/montage-facecam-animee/index.ts`      | `retouche-plaquettes-s15b3`         | **rouge** (4 échecs) |
| M2  | le service allume sur toute valeur autre que `false` (`=== true` → `!= false`)                     | `src/services/facecam-animee-retouche.ts`          | `retouche-plaquettes-s15b3` (a bis) | **rouge** (1)        |
| M3  | `every` → `some` (plaquettes mêlées à une autre opération acceptées)                               | `src/moteurs/montage-facecam-animee/index.ts`      | `retouche-plaquettes-s15b3` (c)     | **rouge** (1)        |
| M4  | le pont renvoie le message d'origine de l'erreur (montant possible)                                | `src/services/retouche-chat/pont-plaquettes-fa.ts` | `pont-plaquettes-fa-s15b3` (f)      | **rouge** (1)        |
| M5  | tout refusé → rendu quand même (`=== 0` → `< 0`)                                                   | `src/moteurs/montage-facecam-animee/index.ts`      | `retouche-plaquettes-s15b3` (d)     | **rouge** (2)        |

Les gardes de la fiche tiennent. Seule la régression du § 1 empêche le OK.

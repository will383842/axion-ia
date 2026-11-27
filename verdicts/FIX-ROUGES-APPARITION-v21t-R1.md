VERDICT OK sha=576aa769 (R1) — 1 fichier (tests/image-video/variete/apparition.test.ts, +12/−5, test seul) ; apparition.test.ts 12/12 vert sur la branche, 2 rouges sur master avec l'ancienne empreinte, 12/12 avec la nouvelle sur la tête master 91dc1521 ; mutation Toile.tsx (overflow) → 2 rouges ; tsc : 43 erreurs identiques master/branche, 0 neuve.

## Contexte

- Tête vérifiée : `576aa769ef10f4b4a36ed75fd7a8516bbf709347` (attendu 576aa769 : conforme).
- Base : merge-base `85d71124`, master courant `91dc1521` (deux commits Pinterest de plus, hors périmètre).
- Dépendances : `pnpm install --frozen-lockfile` à la racine (magasin local), `npm ci` dans `studio-rendu/` (requis pour `remotion`, sinon la suite ne se charge pas).
- Aucune fiche fournie (dépôt des plans privé) : jugement sur le diff seul.

## Diff (périmètre)

`git diff --stat origin/master...origin/video/FIX-ROUGES-APPARITION-v21t` :
`tests/image-video/variete/apparition.test.ts | 17 ++++++++++++-----` — rien d'autre.
Aucun fichier sous `.github/**`, `deploiement/**`, `outils/gardes/**`, `scripts/echecs-connus.json` ; aucun secret.
Cohérent avec le nom de la branche : seule l'empreinte golden `EMPREINTE_TOILE_REFERENCE` est recalée
(`09542bc8…` → `ff1dbf99…`), avec le titre du test et le commentaire d'historique mis à jour.

## Preuves

| Contrôle                                                                            | Résultat                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx vitest run tests/image-video/variete/apparition.test.ts` sur 576aa769          | 12 passed / 12                                                                                                                                                                                                                                                                                  |
| Même fichier sur `origin/master` (91dc1521), ancienne empreinte                     | **2 failed** : « sans variété … » et « recette de référence (APP-A, MAT-A) … », reçu `ff1dbf99…`, attendu `09542bc8…` : le rouge que la branche corrige est réel                                                                                                                                |
| Test de la branche posé sur le code de `origin/master` (91dc1521)                   | 12 passed : la promesse du commentaire (« master seul donne la même, ff1dbf99… ») est vraie, et elle tient encore sur la tête actuelle de master                                                                                                                                                |
| Reproductibilité                                                                    | `ff1dbf99…` obtenue sur une installation à froid indépendante (3e installation, après les deux du commentaire), sur la branche et sur master                                                                                                                                                    |
| Mutation : `Toile.tsx` l. 82 `overflow: "visible"` → `"hidden"`                     | **2 failed** (les deux tests d'empreinte) : le golden détecte bien un changement du HTML de la toile sans variété                                                                                                                                                                               |
| Mutation : `ContexteVariete` rend un `<i />` en plus quand une variété est présente | **1 failed** (« recette de référence (APP-A, MAT-A)… ») : l'invariant « la référence ne change rien » est bien gardé                                                                                                                                                                            |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`                      | 43 erreurs sur la branche, 43 sur master, aux mêmes emplacements (les deux lignes du `diff` ne diffèrent que par l'ordre d'affichage des unions dans le message) ; aucune dans `apparition.test.ts` ; **aucune erreur neuve**. Sans la mémoire relevée, tsc meurt en OOM (rc 134) sur les deux. |

## Tests nommés / promesses

- « sans variété : le HTML de la toile est celui de master au 27/11 (ff1dbf99…) » : le nom dit exactement ce qui est figé (l'ancien nom « identique à celui d'avant le lot » n'était plus vrai, l'empreinte d'avant le lot n'étant plus reproductible).
- « recette de référence (APP-A, MAT-A) dans le contexte : même HTML que sans variété » : invariant conservé, inchangé.
- Aucun comportement ajouté côté code : aucun nouveau test exigé au-delà de ces deux.

## Suivi de la ronde précédente (R1 sur fd974f22, « A CORRIGER »)

`git diff fd974f22 576aa769` ne touche que des commentaires et le nom du test :

1. Nom du test (l. 90) et en-tête (l. 4-5, l. 60) qui promettaient « le HTML d'avant le lot » : **corrigé** (« celui de master au 27/11 (ff1dbf99…) », « empreinte recalée sur master au 27/11 »).
2. Renvoi vers `journal/FIX-ROUGES-APPARITION-v21t.md`, fichier absent : **retiré** (`grep -rn "journal/FIX-ROUGES" tests/` ne trouve rien).
3. Valeur `2332d320…` non reproductible sur 55d99567 : **retirée**, remplacée par le constat « elle n'est pas retrouvée » ; « n'a jamais été reproductible » devient « n'était plus reproductible ».
4. Remarque de forme non bloquante non traitée : le message du commit reste « correction (robot crédits API) ».

## Remarques (non bloquantes)

1. Le recalage d'un golden supprime par nature la garantie « identique à avant le lot » ; le commentaire le dit et liste les changements voulus depuis le 23/10. Acceptable puisque l'ancienne valeur n'est plus reproductible, même sur 55d99567 (affirmation du commentaire, non revérifiée ici).
2. Hors périmètre, à signaler : `tests/image-video/variete/socle.test.ts` est **rouge sur master** (91dc1521) comme sur la branche (2 tests : empreinte de ligne `beb18bfb…` attendue, `032ce595…` reçue ; contrôles caméra/bloc coupé sur F 4:5). Le reste du dossier `tests/image-video/variete` (27 fichiers, 393 tests) est vert. Cette branche ne le touche pas et ne l'aggrave pas ; il mérite sa propre branche FIX-ROUGES.
3. Le golden reste fragile à toute fusion de master qui modifie la toile (c'est déjà la 2e recalibration en deux jours, 3ffc05c6 → ff1dbf99) : à recalculer si master bouge sur `studio-rendu/compositions/image-video/**` avant la fusion.

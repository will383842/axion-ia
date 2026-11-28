VERDICT OK sha=79f9fce2 (R1) — 7 fichiers (proprietes.ts, reference/types.ts, PageReference.tsx, PageReference3.tsx, PageTableau.tsx, version-compositions.json, boucle-tableau-rendu-v21u.test.ts) ; tests 5/5 + 35 fichiers liés 975 verts ; tsc 154 erreurs = master, 0 neuve ; 7/7 mutations tuées ; sortie éteinte octet pour octet identique à master

# Relecture R1 : exactitude, régressions, cas limites

- Dépôt : studio-axion-ia-public, branche `video/BOUCLE-TABLEAU-b-v21u`, tête `79f9fce2ee09f9af5967bb1e5cabe508be4a9873` (attendue `79f9fce2`, conforme).
- Aucune fiche fournie (dépôt des plans privé) : le diff est jugé seul.
- Dépendances : `pnpm install --frozen-lockfile` a échoué sur le magasin global en lecture seule (EROFS), puis a réussi avec `--store-dir` temporaire et `--ignore-scripts`. Lockfile inchangé.

## Le diff (82 lignes ajoutées, 7 retirées)

Petit et cohérent avec le nom de la branche. Il ne touche ni `.github/**`, ni `deploiement/**`, ni `outils/gardes/**`, ni `scripts/echecs-connus.json`, et ne contient aucun secret.

- `src/briques/tableau-scene/proprietes.ts` : nouveau champ optionnel `EntreeScenes.finEnBoucle?: true`. `proprietesReference` ne pose `finEnBoucle: true` que si la valeur vaut strictement `true` ET que la scène est la dernière.
- `src/briques/tableau-scene/reference/types.ts` : nouveau champ `ProprietesReference.finEnBoucle?: true`.
- `PageReference.tsx` et `PageReference3.tsx` : le voile de fin prend la couleur du fond de page (`COULEURS_REFERENCE.fond` / `C.fond`) au lieu de `#000000` quand `finEnBoucle` vaut vrai. Même calcul de `fondu`, même durée.
- `trois-styles/PageTableau.tsx` : le rectangle noir n'est dessiné que si `!finEnBoucle`. Sinon, le support vide (`sc.sup.fond`, le canvas du support) est redessiné avec `globalAlpha = f`, qui revient ensuite à 1.
- `version-compositions.json` : seules les 3 empreintes des 3 compositions touchées changent. `tests/segments-rendu/version-compositions.test.ts` est vert.
- La branche n'a aucun appelant : `finEnBoucle` n'apparaît nulle part dans `src/moteurs/montage-tableau/**` ni dans `src/services/tableau-*`. Les autres occurrences du mot (montage-avocat, composition/parametres) existaient déjà et ne passent pas par le tableau.

## Tests lancés

- `npx vitest run tests/tableau/boucle-tableau-rendu-v21u.test.ts` : 5/5.
- `npx vitest run tests/segments-rendu/version-compositions.test.ts` + tous les tests qui importent `tableau-scene/proprietes`, `reference/types`, `PageReference*` ou `PageTableau` : 35 fichiers, 975 verts, 8 sautés (déjà sautés sur master), 0 échec.
- `npx tsc --noEmit -p .` (avec `--max-old-space-size=12000`, sinon OOM au tas par défaut) : 154 erreurs sur la branche, 154 sur `origin/master`, et le même ensemble une fois les positions retirées. Les deux seules différences de texte sont l'ordre des membres d'une union dans deux messages déjà présents. Aucune erreur dans les fichiers touchés. `tsc -p tsconfig.visuels.json` : 0 erreur.

## Une promesse, un test nommé

| Promesse | Test |
| --- | --- |
| Éteint (champ absent), aucune clé `finEnBoucle` | (a) « éteint = identique » |
| Seule la dernière scène, et seul `true` strict (`false`, `"true"`, `1`, `null` donnent la même sortie qu'éteint), le reste inchangé | (b) « dernière scène seulement ; false / chaîne = identique à (a) » |
| Jamais vers le noir en boucle, toujours vers le noir sinon, dans les 3 rendus | (c) « jamais vers le noir en boucle, toujours vers le noir sinon » |
| Même durée de fondu, aucune durée neuve | (d) « même durée de fondu » |
| Sans appelant | (e) « sans appelant » |

## Mutations (une à la fois, remises en place après chaque essai)

Chacune fait rougir au moins un test :

1. Pose sur toutes les scènes (sans le test de dernière scène) : (b) rouge.
2. `=== true` remplacé par un test de vérité : (b) rouge.
3. Branches du ternaire inversées dans PageReference : (c) rouge.
4. `!r.finEnBoucle` retiré dans PageTableau : (c) rouge.
5. `drawImage` du support retiré : (c) rouge.
6. Champ posé même éteint : (a)/(b) rouge.
7. PageReference3 ne va plus jamais vers le noir : (c) rouge.

7 sur 7 tuées.

## Preuve indépendante « éteint = identique à master »

Le test (a) compare deux appels identiques, donc il se prouve lui-même. J'ai donc ajouté une preuve à part. Pour les 3 sorties du témoin (`sortiesTemoin(temoinGabarit())`), la sortie JSON de `proprietesScenes` est la même octet pour octet (145 181 octets) entre la branche et `origin/master` (src + studio-rendu de master).

## Remarques (non bloquantes)

- (c) teste `pt.split("\n")[875]`, un numéro de ligne codé en dur : le test est fragile, et le moindre ajout de ligne au-dessus le cassera. Il vaudrait mieux un compte d'occurrences, comme dans le reste du test.
- (a) ne compare pas à master, il se prouve lui-même. La preuve est faite plus haut, mais pas dans le dépôt.
- Les tests du rendu sont textuels : aucun rendu image réel du fondu vers la page vide. C'est la convention du dossier (« purs, sans remotion »), et les mutations montrent que le texte est bien figé.
- `v2/EcranV2.tsx` va toujours vers le noir. C'est hors périmètre : `finEnBoucle` ne vit que dans `styleReference`.
